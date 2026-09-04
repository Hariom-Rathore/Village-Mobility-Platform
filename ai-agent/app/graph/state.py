"""
LangGraph State Definition for RideLocal AI Agent
"""
from typing import TypedDict, List, Dict, Any, Optional
from datetime import datetime
from typing import Annotated


class AgentState(TypedDict):
    """State for the RideLocal AI Agent conversation"""
    
    # User Identification
    user_id: Optional[str]              # Authenticated user ID
    auth_token: Optional[str]          # Authentication token/session
    conversation_id: str                # Unique conversation identifier
    
    # Conversation Context
    conversation_history: List[Dict]   # Chat history
    current_intent: Optional[str]      # Current user intent
    last_response: Optional[str]       # Last agent response
    messages: Optional[List[Dict]]     # Compatibility alias for chat history
    intent: Optional[str]              # Compatibility alias for current intent

    # Search Parameters
    pickup: Optional[str]              # Compatibility alias for pickup location
    pickup_location: Optional[str]     # Pickup location/address
    pickup_coordinates: Optional[List[float]]  # [lng, lat]
    destination: Optional[str]         # Destination address
    destination_coordinates: Optional[List[float]]  # [lng, lat]
    travel_date: Optional[str]         # Compatibility alias for trip date
    start_date: Optional[str]          # Pickup date (ISO format)
    end_date: Optional[str]            # Return date (ISO format)
    pickup_time: Optional[str]         # Pickup time (HH:MM format)
    return_time: Optional[str]         # Return time (HH:MM format)
    passengers: Optional[int]          # Number of passengers
    vehicle_type: Optional[str]        # Vehicle type (SUV, Sedan, etc.)
    trip_type: Optional[str]           # Trip type (local, outstation, etc.)
    
    # Budget & Preferences
    budget_max: Optional[float]        # Maximum budget
    budget_min: Optional[float]        # Minimum budget
    ac_required: Optional[bool]        # AC required
    min_rating: Optional[float]        # Minimum rating
    seats_required: Optional[int]      # Minimum seats required
    
    # Search Results
    search_results: List[Dict]         # Available vehicles from search
    search_performed: bool             # Whether search has been performed
    search_filters: Dict[str, Any]     # Applied search filters
    
    # Vehicle Selection
    selected_vehicle: Optional[Dict]   # User's selected vehicle
    selected_vehicle_index: Optional[int]  # Index in search results
    
    # Availability
    availability_status: Optional[bool] # Whether selected vehicle is available
    availability_checked: bool         # Whether availability has been checked
    unavailable_reason: Optional[str]  # Reason if unavailable
    
    # Booking Context
    booking_details: Optional[Dict]    # Pending booking information
    booking_id: Optional[str]         # Active booking ID
    booking_status: Optional[str]      # Current booking status
    booking_created: bool              # Whether booking has been created
    booking_confirmed: bool            # Whether user confirmed booking
    
    # Pricing
    estimated_fare: Optional[float]   # Estimated fare
    price_breakdown: Optional[Dict]   # Price breakdown details
    
    # System Flags
    needs_confirmation: bool           # Whether user needs to confirm action
    missing_information: List[str]     # Required but missing fields
    awaiting_user_input: bool          # Whether waiting for specific user input
    error_message: Optional[str]       # Last error if any
    error_occurred: bool               # Whether an error occurred
    
    # Tool Results
    last_tool_used: Optional[str]      # Last tool executed
    tool_results: Dict[str, Any]      # Results from tools
    
    # Conversation State
    conversation_stage: str            # Current stage of conversation
    requires_clarification: bool       # Whether clarification is needed
    clarification_question: Optional[str]  # Question to ask user