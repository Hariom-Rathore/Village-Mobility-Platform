"""
LangGraph Edges for RideLocal AI Agent
Define the conditional routing between nodes
"""
from typing import Literal
from loguru import logger


def should_ask_clarification(state: dict) -> Literal["clarification", "execute"]:
    """Determine if clarification is needed or execution should proceed"""
    try:
        requires_clarification = state.get("requires_clarification", False)
        missing_info = state.get("missing_information", [])
        
        if requires_clarification and missing_info:
            logger.info(f"Routing to clarification - missing: {missing_info}")
            return "clarification"
        else:
            logger.info("Routing to execution - all info present")
            return "execute"
            
    except Exception as e:
        logger.error(f"Error in should_ask_clarification: {e}")
        return "execute"


def route_by_intent(state: dict) -> str:
    """Route to appropriate execution node based on intent"""
    try:
        intent = state.get("current_intent", "general_question")
        
        logger.info(f"Routing by intent: {intent}")
        
        intent_routing = {
            "vehicle_search": "search",
            "availability_check": "availability",
            "vehicle_details": "generate_response",
            "booking_request": "booking",
            "user_bookings": "user_bookings",
            "cancellation": "generate_response",
            "greeting": "generate_response",
            "general_chat": "generate_response",
            "general_question": "generate_response",
            "unknown": "generate_response"
        }
        
        return intent_routing.get(intent, "generate_response")
        
    except Exception as e:
        logger.error(f"Error in route_by_intent: {e}")
        return "generate_response"


def should_confirm_booking(state: dict) -> Literal["confirm", "execute_booking"]:
    """Determine if booking confirmation is needed"""
    try:
        needs_confirmation = state.get("needs_confirmation", False)
        booking_confirmed = state.get("booking_confirmed", False)
        
        if needs_confirmation and not booking_confirmed:
            logger.info("Routing to booking confirmation")
            return "confirm"
        else:
            logger.info("Proceeding with booking execution")
            return "execute_booking"
            
    except Exception as e:
        logger.error(f"Error in should_confirm_booking: {e}")
        return "execute_booking"


def check_authentication(state: dict) -> Literal["auth_required", "proceed"]:
    """Check if user is authenticated for protected operations"""
    try:
        auth_token = state.get("auth_token")
        intent = state.get("current_intent", "")
        
        protected_intents = ["booking_request", "user_bookings", "cancellation", "booking_details"]
        
        if intent in protected_intents and not auth_token:
            logger.info(f"Authentication required for intent: {intent}")
            return "auth_required"
        else:
            logger.info("Authentication not required or user is authenticated")
            return "proceed"
            
    except Exception as e:
        logger.error(f"Error in check_authentication: {e}")
        return "proceed"


def should_check_availability(state: dict) -> Literal["check_availability", "skip_availability"]:
    """Determine if availability check is needed"""
    try:
        intent = state.get("current_intent", "")
        selected_vehicle = state.get("selected_vehicle")
        start_date = state.get("start_date")
        
        # Check availability if user is asking about availability or proceeding to booking
        if intent == "availability_check" or (intent == "booking_request" and selected_vehicle and start_date):
            logger.info("Availability check needed")
            return "check_availability"
        else:
            logger.info("Skipping availability check")
            return "skip_availability"
            
    except Exception as e:
        logger.error(f"Error in should_check_availability: {e}")
        return "skip_availability"


def handle_error(state: dict) -> Literal["end", "retry"]:
    """Determine if workflow should end or retry on error"""
    try:
        error_occurred = state.get("error_occurred", False)
        
        if error_occurred:
            logger.info("Error occurred, ending workflow")
            return "end"
        else:
            logger.info("No error, continuing workflow")
            return "retry"
            
    except Exception as e:
        logger.error(f"Error in handle_error: {e}")
        return "end"