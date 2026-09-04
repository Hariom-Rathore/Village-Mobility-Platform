import asyncio

from app.conversation_store import ConversationStore
from app.graph.nodes import extract_information_node


def test_hinglish_route_and_upcoming_date_are_extracted():
    state = {
        "conversation_history": [{"role": "user", "content": "mere ko jhunjhunu se jaipur jana h 28 ko kon kon si car available h"}],
        "pickup_location": None, "destination": None, "start_date": None,
        "passengers": None, "awaiting_user_input": False, "search_results": [],
    }
    result = asyncio.run(extract_information_node(state))
    assert result["pickup_location"] == "Jhunjhunu"
    assert result["destination"] == "Jaipur"
    assert result["start_date"] is not None


def test_passenger_follow_up_preserves_existing_context():
    state = {
        "conversation_history": [{"role": "user", "content": "5"}],
        "pickup_location": "Jhunjhunu", "destination": "Jaipur", "start_date": "2026-08-28",
        "passengers": None, "awaiting_user_input": True, "search_results": [],
    }
    result = asyncio.run(extract_information_node(state))
    assert result["passengers"] == 5
    assert result["pickup_location"] == "Jhunjhunu"


def test_conversation_store_returns_a_copy_of_saved_state():
    store = ConversationStore()
    state = {"conversation_id": "test", "conversation_history": [], "pickup_location": "Jaipur"}
    store.save(state)
    restored = store.get("test")
    restored["pickup_location"] = "Changed"
    assert store.get("test")["pickup_location"] == "Jaipur"
