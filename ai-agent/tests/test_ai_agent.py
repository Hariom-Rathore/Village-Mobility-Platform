"""
Tests for RideLocal AI Agent
"""
import pytest
import asyncio
from app.graph.workflow import agent_workflow
from app.graph.state import AgentState


class TestAgentWorkflow:
    """Test the LangGraph workflow"""
    
    @pytest.mark.asyncio
    async def test_vehicle_search_intent(self):
        """Test vehicle search intent classification"""
        state = {
            "conversation_history": [{"role": "user", "content": "I need an SUV in Jaipur"}],
            "current_intent": None,
            "last_response": None,
            "pickup_location": None,
            "destination": None,
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
            "clarification_question": None,
            "user_id": "test-user",
            "auth_token": None,
            "conversation_id": "test-conversation"
        }
        
        result = await agent_workflow.ainvoke(state)
        
        assert result is not None
        assert result.get("current_intent") == "vehicle_search"
        assert result.get("last_response") is not None
    
    @pytest.mark.asyncio
    async def test_general_chat_intent_does_not_search(self):
        """Greeting or general chat should not trigger vehicle search."""
        state = {
            "conversation_history": [{"role": "user", "content": "hello"}],
            "current_intent": None,
            "last_response": None,
            "pickup_location": None,
            "destination": None,
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
            "clarification_question": None,
            "user_id": "test-user",
            "auth_token": None,
            "conversation_id": "test-conversation"
        }

        result = await agent_workflow.ainvoke(state)

        assert result.get("current_intent") in ("general_chat", "greeting")
        assert result.get("search_performed") is False
        assert "pickup" not in str(result.get("last_response", "")).lower()

    @pytest.mark.asyncio
    async def test_follow_up_trip_details_continue_vehicle_search(self):
        """A fragment like 'for 5 passengers' should continue the existing vehicle-search state."""
        state = {
            "conversation_history": [
                {"role": "user", "content": "I need a vehicle from Jaipur to Jhunjhunu"},
                {"role": "user", "content": "for 5 passengers"},
            ],
            "current_intent": "vehicle_search",
            "last_response": "Could you please provide the number of passengers?",
            "pickup_location": "Jaipur",
            "destination": "Jhunjhunu",
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
            "missing_information": ["number of passengers"],
            "awaiting_user_input": True,
            "error_message": None,
            "error_occurred": False,
            "last_tool_used": None,
            "tool_results": {},
            "conversation_stage": "search",
            "requires_clarification": True,
            "clarification_question": "Could you please provide the number of passengers?",
            "user_id": "test-user",
            "auth_token": None,
            "conversation_id": "test-conversation"
        }

        result = await agent_workflow.ainvoke(state)

        assert result.get("current_intent") == "vehicle_search"
        assert result.get("passengers") == 5
        assert result.get("requires_clarification") is False
        assert result.get("search_performed") is True

    @pytest.mark.asyncio
    async def test_extract_full_vehicle_search_state(self, monkeypatch):
        """A complete search message should persist location, date and passengers in state."""
        import app.graph.nodes as nodes_module

        async def fake_search(*args, **kwargs):
            return {"success": True, "vehicles": [], "trip": {}}

        monkeypatch.setattr(nodes_module, "search_vehicles", fake_search)

        state = {
            "conversation_history": [{"role": "user", "content": "I need a vehicle from Jaipur to Jhunjhunu on 4 September for 5 passengers."}],
            "current_intent": None,
            "last_response": None,
            "pickup_location": None,
            "destination": None,
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
            "clarification_question": None,
            "user_id": "test-user",
            "auth_token": None,
            "conversation_id": "test-conversation"
        }

        result = await agent_workflow.ainvoke(state)

        assert result.get("current_intent") == "vehicle_search"
        assert result.get("pickup_location") == "Jaipur"
        assert result.get("destination") == "Jhunjhunu"
        assert result.get("passengers") == 5
        assert result.get("start_date") == "2026-09-04"
        assert result.get("requires_clarification") is False

    @pytest.mark.asyncio
    async def test_missing_information_detection(self):
        """Test missing information detection"""
        state = {
            "conversation_history": [{"role": "user", "content": "I need a car"}],
            "current_intent": "vehicle_search",
            "pickup_location": None,
            "destination": None,
            "start_date": None,
            "passengers": None,
            "missing_information": [],
            "requires_clarification": False,
            "last_response": None,
            "error_occurred": False,
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
            "awaiting_user_input": False,
            "error_message": None,
            "last_tool_used": None,
            "tool_results": {},
            "conversation_stage": "start",
            "clarification_question": None,
            "user_id": "test-user",
            "auth_token": None,
            "conversation_id": "test-conversation",
            "end_date": None,
            "pickup_time": None,
            "return_time": None,
            "vehicle_type": None,
            "trip_type": None,
            "budget_max": None,
            "budget_min": None,
            "ac_required": None,
            "min_rating": None,
            "seats_required": None
        }
        
        result = await agent_workflow.ainvoke(state)
        
        assert result.get("requires_clarification") == True
        assert len(result.get("missing_information", [])) > 0
        assert result.get("clarification_question") is not None

    @pytest.mark.asyncio
    async def test_search_payload_matches_backend_contract(self):
        """Search tool should include all backend-supported filters."""
        from app.services.ridelocal_client import ridelocal_client

        captured = {}

        class DummyResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"success": True, "vehicles": [], "trip": {}}

        class DummyClient:
            async def post(self, url, json):
                captured["url"] = url
                captured["json"] = json
                return DummyResponse()

        async def fake_get_client():
            return DummyClient()

        import app.services.ridelocal_client as client_module
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(client_module.ridelocal_client, "get_client", fake_get_client)

        try:
            result = await ridelocal_client.search_vehicles(
                pickup="Jaipur",
                destination="Delhi",
                passengers=5,
                vehicle_type="SUV",
                pickup_lat=26.9124,
                pickup_lng=75.7873,
                dest_lat=28.6139,
                dest_lng=77.2090,
                ac_only=True,
                min_rating=4.5,
                max_price=1500,
                sort="rating",
                verified_only=True,
                seat_capacity=5
            )
        finally:
            monkeypatch.undo()

        assert result["success"] is True
        assert captured["url"].endswith("/customers/api/search")
        assert captured["json"]["vehicleType"] == "SUV"
        assert captured["json"]["passengers"] == 5
        assert captured["json"]["acOnly"] is True
        assert captured["json"]["minRating"] == 4.5
        assert captured["json"]["maxPrice"] == 1500
        assert captured["json"]["verifiedOnly"] is True
        assert captured["json"]["seatCapacity"] == 5
    
    @pytest.mark.asyncio
    async def test_greeting_intent(self):
        """Test greeting intent classification"""
        state = {
            "conversation_history": [{"role": "user", "content": "Hello"}],
            "current_intent": None,
            "last_response": None,
            "pickup_location": None,
            "destination": None,
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
            "clarification_question": None,
            "user_id": "test-user",
            "auth_token": None,
            "conversation_id": "test-conversation"
        }
        
        result = await agent_workflow.ainvoke(state)
        
        assert result.get("current_intent") == "greeting"
        assert result.get("last_response") is not None


class TestInformationExtraction:
    """Test information extraction from user messages"""
    
    @pytest.mark.asyncio
    async def test_extract_passengers(self):
        """Test extracting passenger count"""
        from app.graph.nodes import extract_information_node
        
        state = {
            "conversation_history": [{"role": "user", "content": "I need a car for 5 people"}],
            "passengers": None,
            "vehicle_type": None,
            "error_occurred": False,
            "error_message": None,
            "current_intent": "vehicle_search",
            "last_response": None,
            "pickup_location": None,
            "destination": None,
            "start_date": None,
            "end_date": None,
            "pickup_time": None,
            "return_time": None,
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
            "last_tool_used": None,
            "tool_results": {},
            "conversation_stage": "start",
            "requires_clarification": False,
            "clarification_question": None,
            "user_id": "test-user",
            "auth_token": None,
            "conversation_id": "test-conversation"
        }
        
        result = await extract_information_node(state)
        
        assert result.get("passengers") == 5
    
    @pytest.mark.asyncio
    async def test_extract_vehicle_type(self):
        """Test extracting vehicle type"""
        from app.graph.nodes import extract_information_node
        
        state = {
            "conversation_history": [{"role": "user", "content": "I need an SUV"}],
            "passengers": None,
            "vehicle_type": None,
            "error_occurred": False,
            "error_message": None,
            "current_intent": "vehicle_search",
            "last_response": None,
            "pickup_location": None,
            "destination": None,
            "start_date": None,
            "end_date": None,
            "pickup_time": None,
            "return_time": None,
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
            "last_tool_used": None,
            "tool_results": {},
            "conversation_stage": "start",
            "requires_clarification": False,
            "clarification_question": None,
            "user_id": "test-user",
            "auth_token": None,
            "conversation_id": "test-conversation"
        }
        
        result = await extract_information_node(state)
        
        assert result.get("vehicle_type") == "SUV"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])