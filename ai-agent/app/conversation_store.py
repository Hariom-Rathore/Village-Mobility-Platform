"""Small development conversation store for structured agent state."""
from copy import deepcopy
from typing import Dict, Optional

from .graph.state import AgentState


class ConversationStore:
    def __init__(self) -> None:
        self._states: Dict[str, AgentState] = {}

    def get(self, conversation_id: str) -> Optional[AgentState]:
        state = self._states.get(conversation_id)
        return deepcopy(state) if state else None

    def save(self, state: AgentState) -> None:
        # Keep enough context for follow-ups without unbounded growth.
        state["conversation_history"] = state.get("conversation_history", [])[-12:]
        self._states[state["conversation_id"]] = deepcopy(state)


conversation_store = ConversationStore()
