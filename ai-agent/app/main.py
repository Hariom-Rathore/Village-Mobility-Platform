"""
Main FastAPI Application for RideLocal AI Agent
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uuid
from loguru import logger
import sys

from .config import settings
from .services.ridelocal_client import ridelocal_client
from .graph.workflow import agent_workflow
from .graph.state import AgentState
from .conversation_store import conversation_store

# Configure logging
logger.remove()
logger.add(sys.stdout, level=settings.LOG_LEVEL)


# Pydantic models for API
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    auth_token: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: str
    state: Optional[Dict[str, Any]] = None
    vehicles: Optional[List[Dict[str, Any]]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None


# Initialize FastAPI app
app = FastAPI(
    title=settings.AI_SERVICE_NAME,
    version=settings.AI_SERVICE_VERSION,
    description="AI-powered vehicle rental assistant for RideLocal"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info(f"Starting {settings.AI_SERVICE_NAME} v{settings.AI_SERVICE_VERSION}")
    logger.info(f"LLM Provider: {settings.LLM_PROVIDER}")
    logger.info(f"RideLocal Backend: {settings.RIDELocal_BACKEND_URL}")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down AI service")
    await ridelocal_client.close()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": settings.AI_SERVICE_NAME,
        "version": settings.AI_SERVICE_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "llm_provider": settings.LLM_PROVIDER,
        "backend_url": settings.RIDELocal_BACKEND_URL
    }


@app.post("/ai/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Main chat endpoint for AI agent
    
    Args:
        request: Chat request with message and context
    
    Returns:
        Chat response with message and structured data
    """
    try:
        # Generate or use existing conversation ID
        conversation_id = request.conversation_id or str(uuid.uuid4())
        
        logger.info(f"Chat request - Conversation: {conversation_id}, User: {request.user_id}")
        logger.info(f"Message: {request.message}")
        
        # Create a new structured state only for a new conversation. Follow-up
        # messages merge into the saved state identified by conversation_id.
        initial_state: AgentState = {
            "user_id": request.user_id,
            "auth_token": request.auth_token,
            "conversation_id": conversation_id,
            "conversation_history": [{"role": "user", "content": request.message}],
            "current_intent": None,
            "last_response": None,
            "pickup_location": None,
            "pickup_coordinates": None,
            "destination": None,
            "destination_coordinates": None,
            "start_date": None,
            "end_date": None,
            "pickup_time": None,
            "return_time": None,
            "passengers": None,
            "vehicle_type": None,
            "trip_type": None,
            "budget_max": None,
            "budget_min": None,
            "ac_required": None,
            "min_rating": None,
            "seats_required": None,
            "search_results": [],
            "search_performed": False,
            "search_filters": {},
            "selected_vehicle": None,
            "selected_vehicle_index": None,
            "availability_status": None,
            "availability_checked": False,
            "unavailable_reason": None,
            "booking_details": None,
            "booking_id": None,
            "booking_status": None,
            "booking_created": False,
            "booking_confirmed": False,
            "estimated_fare": None,
            "price_breakdown": None,
            "needs_confirmation": False,
            "missing_information": [],
            "awaiting_user_input": False,
            "error_message": None,
            "error_occurred": False,
            "last_tool_used": None,
            "tool_results": {},
            "conversation_stage": "start",
            "requires_clarification": False,
            "clarification_question": None
        }

        saved_state = conversation_store.get(conversation_id)
        if saved_state:
            initial_state = saved_state
            initial_state["user_id"] = request.user_id or initial_state.get("user_id")
            initial_state["auth_token"] = request.auth_token or initial_state.get("auth_token")
            initial_state["conversation_id"] = conversation_id
            initial_state["conversation_history"] = initial_state.get("conversation_history", []) + [{"role": "user", "content": request.message}]
            initial_state["last_response"] = None
            initial_state["error_occurred"] = False
            initial_state["error_message"] = None
            logger.info(f"Restored conversation context: {conversation_id}")
        
        # Run the workflow
        logger.info("Running LangGraph workflow")
        result = await agent_workflow.ainvoke(initial_state)
        result["conversation_history"] = result.get("conversation_history", []) + [{"role": "assistant", "content": result.get("last_response", "")}]
        conversation_store.save(result)
        
        # Extract response from result
        response_message = result.get("last_response", "I'm sorry, I couldn't process your request.")
        
        # Prepare structured data for response
        vehicles = result.get("search_results", [])
        actions = []
        
        # Add action if vehicles are available for selection
        if vehicles and result.get("current_intent") == "vehicle_search":
            actions.append({
                "type": "select_vehicle",
                "prompt": "Select a vehicle to book or get more details"
            })
        
        # Add action if booking confirmation is needed
        if result.get("needs_confirmation") and result.get("selected_vehicle"):
            actions.append({
                "type": "confirm_booking",
                "prompt": "Confirm booking request",
                "vehicle": result.get("selected_vehicle")
            })
        
        # Prepare state for response (exclude sensitive data)
        response_state = {
            "conversation_id": conversation_id,
            "current_intent": result.get("current_intent"),
            "conversation_stage": result.get("conversation_stage"),
            "search_performed": result.get("search_performed"),
            "booking_created": result.get("booking_created"),
            "booking_id": result.get("booking_id"),
            "booking_status": result.get("booking_status"),
            "requires_clarification": result.get("requires_clarification"),
            "error_occurred": result.get("error_occurred")
        }
        
        return ChatResponse(
            message=response_message,
            conversation_id=conversation_id,
            state=response_state,
            vehicles=vehicles if vehicles else None,
            actions=actions if actions else None,
            error=result.get("error_message") if result.get("error_occurred") else None
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.AI_SERVICE_PORT,
        reload=False,
        log_level=settings.LOG_LEVEL.lower()
    )
