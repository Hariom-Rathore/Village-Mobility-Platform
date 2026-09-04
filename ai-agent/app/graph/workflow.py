"""
LangGraph Workflow for RideLocal AI Agent
Defines the complete conversation workflow using nodes and edges
"""
from typing import Dict, Any
from loguru import logger
from langgraph.graph import StateGraph, END

from .state import AgentState
from .nodes import (
    classify_intent_node,
    extract_information_node,
    check_missing_info_node,
    generate_clarification_node,
    execute_search_node,
    execute_availability_check_node,
    execute_booking_node,
    execute_user_bookings_node,
    generate_response_node
)
from .edges import (
    should_ask_clarification,
    route_by_intent,
    should_confirm_booking,
    check_authentication,
    should_check_availability,
    handle_error
)


def create_workflow() -> StateGraph:
    """Create the LangGraph workflow for the AI agent"""
    
    # Initialize the workflow graph
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("classify_intent", classify_intent_node)
    workflow.add_node("extract_info", extract_information_node)
    workflow.add_node("check_missing_info", check_missing_info_node)
    workflow.add_node("clarification", generate_clarification_node)
    workflow.add_node("search", execute_search_node)
    workflow.add_node("availability", execute_availability_check_node)
    workflow.add_node("booking", execute_booking_node)
    workflow.add_node("user_bookings", execute_user_bookings_node)
    workflow.add_node("generate_response", generate_response_node)
    
    # Simple linear workflow for MVP
    workflow.set_entry_point("classify_intent")
    workflow.add_edge("classify_intent", "extract_info")
    workflow.add_edge("extract_info", "check_missing_info")
    
    # Conditional: need clarification or proceed
    workflow.add_conditional_edges(
        "check_missing_info",
        should_ask_clarification,
        {
            "clarification": "clarification",
            "execute": "route_by_intent"
        }
    )
    
    # Add routing node (pass-through)
    async def route_pass_through(state: AgentState) -> AgentState:
        return state
    workflow.add_node("route_by_intent", route_pass_through)
    
    # Route based on intent
    workflow.add_conditional_edges(
        "route_by_intent",
        route_by_intent,
        {
            "search": "search",
            "availability": "availability",
            "booking": "booking",
            "user_bookings": "user_bookings",
            "generate_response": "generate_response"
        }
    )
    
    # End clarification with response
    workflow.add_edge("clarification", "generate_response")
    
    # All execution nodes go to response generation
    workflow.add_edge("search", "generate_response")
    workflow.add_edge("availability", "generate_response")
    workflow.add_edge("booking", "generate_response")
    workflow.add_edge("user_bookings", "generate_response")
    
    # End with response
    workflow.add_edge("generate_response", END)
    
    # Compile the workflow
    logger.info("Compiling LangGraph workflow")
    app = workflow.compile()
    
    return app


# Global workflow instance
agent_workflow = create_workflow()