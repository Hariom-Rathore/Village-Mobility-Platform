"""
LangGraph Nodes for RideLocal AI Agent
Each node represents a step in the conversation workflow
"""
from typing import Dict, Any, Optional
from datetime import datetime, date
from zoneinfo import ZoneInfo
import re
from loguru import logger
from langchain_core.messages import HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
import httpx

from .state import AgentState
from ..config import settings
from ..tools.search_vehicles import search_vehicles
from ..tools.vehicle_details import get_vehicle_details
from ..tools.availability import check_vehicle_availability
from ..tools.booking import create_booking_request, cancel_booking
from ..tools.user_bookings import get_user_bookings, get_booking_details
from ..prompts.system_prompt import SYSTEM_PROMPT, INTENT_CLASSIFICATION_PROMPT, INFORMATION_EXTRACTION_PROMPT


# Initialize the LLM only when credentials are configured. This keeps the local
# assistant available for its rule-based search and booking flows without an
# OpenAI key.
llm = None
if settings.LLM_API_KEY:
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=settings.LLM_MAX_TOKENS,
        api_key=settings.LLM_API_KEY
    )


class GeminiResponse:
    def __init__(self, content: str):
        self.content = content


class GeminiChat:
    """Small REST client for Gemini's generateContent endpoint."""

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model.removeprefix("models/")

    def invoke(self, messages: list[dict]) -> GeminiResponse:
        contents = []
        system_instruction = None
        for message in messages:
            role = message.get("role")
            content = message.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            else:
                contents.append({
                    "role": "model" if role == "assistant" else "user",
                    "parts": [{"text": content}],
                })

        payload = {"contents": contents}
        if system_instruction:
            payload["system_instruction"] = system_instruction

        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
            headers={"x-goog-api-key": self.api_key},
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        text = "".join(
            part.get("text", "")
            for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        ).strip()
        if not text:
            raise ValueError("Gemini returned an empty response")
        return GeminiResponse(text)


if settings.LLM_PROVIDER.lower() == "gemini" and settings.GEMINI_API_KEY:
    llm = GeminiChat(settings.GEMINI_API_KEY, settings.GEMINI_MODEL)


async def classify_intent_node(state: AgentState) -> AgentState:
    """Classify user intent from their message."""
    try:
        user_message = state["conversation_history"][-1]["content"] if state["conversation_history"] else ""

        logger.info(f"Classifying intent for message: {user_message[:50]}...")

        message_lower = user_message.lower().strip()
        message_lower = re.sub(r'\badn\b', 'and', message_lower)
        message_lower = re.sub(r'\bdesination\b', 'destination', message_lower)

        def contains_word(words: list[str]) -> bool:
            return any(re.search(rf'\b{re.escape(word)}\b', message_lower) for word in words)

        greeting_words = ["hello", "hi", "hey", "greetings", "good morning", "good evening"]
        general_help_words = ["how are you", "how can you help me", "what can you do", "help me"]
        is_greeting = contains_word(greeting_words)
        is_general_chat = any(word in message_lower for word in general_help_words)
        if is_greeting:
            intent = "greeting"
        elif is_general_chat:
            intent = "general_chat"
        elif any(word in message_lower for word in ["cancel", "cancellation"]):
            intent = "cancellation"
        elif any(word in message_lower for word in ["my booking", "my trips", "show my bookings", "upcoming bookings"]):
            intent = "user_bookings"
        elif (
            state.get("needs_confirmation")
            and re.fullmatch(r"(?:yes|haan|ha|confirm|proceed|ok|okay|yes,?\s*(?:please\s*)?(?:proceed|confirm)?)", message_lower)
        ):
            intent = "booking_request"
            state["booking_confirmed"] = True
        elif any(word in message_lower for word in ["cancel booking", "cancel my booking"]):
            intent = "cancellation"
        elif any(phrase in message_lower for phrase in [
            "compare", "which one is cheaper", "which car is cheap", "cheapest", "best car",
            "more seats", "most seats", "sasti", "sabse sasti", "kaunsi car better"
        ]):
            intent = "vehicle_comparison"
        elif any(phrase in message_lower for phrase in [
            "available", "availability", "check availability", "is this car available",
            "ye available", "available hai", "book kar sakte"
        ]) and state.get("selected_vehicle"):
            intent = "availability_check"
        elif any(phrase in message_lower for phrase in [
            "details", "detail", "price", "how many seats", "kitne seats", "ac hai",
            "owner kaun", "driver", "this car", "this vehicle", "iski", "is car ke"
        ]) and state.get("search_results"):
            intent = "vehicle_details"
        elif state.get("search_results") and re.search(
            r'\b(?:select|selected|choose|chosen|first|second|third|last|pehli|pahli|dusri|doosri|teesri|aakhri|cheapest|sasti)\b',
            message_lower,
        ):
            intent = "vehicle_details"
        elif (
            any(word in message_lower for word in ["book", "reserve", "confirm booking", "proceed with booking"])
            and (state.get("selected_vehicle") or state.get("search_results"))
        ):
            intent = "booking_request"
        elif any(
            phrase in message_lower
            for phrase in [
                "want to book a car", "want booking a car", "book a car", "rent a car",
                "hire a car", "need a car for", "car for trip", "booking a car",
                "need a car for booking", "car for booking",
            ]
        ) and not state.get("selected_vehicle"):
            intent = "vehicle_search"
        elif state.get("search_results") and re.search(
            r'\b(?:pickup|pick-up)?\s*(?:date|time)\b|\b(?:\d{1,2}\s*(?:am|pm)|\d{1,2}\s+(?:jan|january|february|march|april|may|june|july|august|september|october|november|december))\b',
            message_lower,
        ):
            if state.get("current_intent") == "availability_check":
                intent = "availability_check"
            else:
                intent = "booking_request" if state.get("selected_vehicle") else "vehicle_details"
        elif re.search(r'\b(?:pickup|destination|desination)\b', message_lower):
            intent = "vehicle_search"
        elif state.get("search_results") and re.search(r'\b(?:cars|vehicles|options|tell me about|show me)\b', message_lower):
            intent = "vehicle_search"
        elif any(word in message_lower for word in ["book", "reserve", "booking", "confirm booking"]) and state.get("selected_vehicle"):
            intent = "booking_request"
        elif any(word in message_lower for word in ["which car", "which one", "applicable", "details", "more info"]):
            intent = "vehicle_details"
        elif any(word in message_lower for word in ["is this car available", "check availability", "is it available"]):
            intent = "availability_check"
        elif (
            any(word in message_lower for word in ["search", "find", "looking for", "show me", "available", "jana", "jaana", "car chahiye", "vehicle chahiye"])
            or " i need a vehicle" in message_lower
            or "need a car" in message_lower
            or "need an suv" in message_lower
            or "need a suv" in message_lower
            or "need a vehicle" in message_lower
            or re.search(r"\bneed(s)?\s+(?:an\s+)?(?:suv|sedan|hatchback|car|vehicle)\b", message_lower)
            or (
                re.search(r"\b[a-z][a-z .-]{1,30}\s+to\s+[a-z][a-z .-]{1,30}\b", message_lower)
                and any(term in message_lower for term in ["car", "vehicle", "ride", "trip", "travel", "pickup", "drop"])
            )
        ):
            intent = "vehicle_search"
        elif (
            state.get("awaiting_user_input")
            and state.get("current_intent") in {"vehicle_search", "booking_request", "availability_check"}
        ):
            intent = state["current_intent"]
        elif (
            state.get("current_intent") in {"vehicle_search", "booking_request", "availability_check"}
            and (state.get("awaiting_user_input") or state.get("requires_clarification") or state.get("missing_information"))
            and not is_greeting
            and not is_general_chat
        ):
            intent = state["current_intent"]
        elif re.fullmatch(r"(?:yes|haan|ha|confirm|proceed|ok|okay)", message_lower) and state.get("needs_confirmation"):
            intent = "booking_request"
            state["booking_confirmed"] = True
        elif re.fullmatch(r"\d+", message_lower) and state.get("awaiting_user_input"):
            intent = state.get("current_intent") or "vehicle_search"
        elif any(word in message_lower for word in ["jaipur", "delhi", "jhunjhunu", "mumbai", "pune", "udaipur"]) and any(word in message_lower for word in ["need", "want", "looking", "search", "find", "booking", "book", "car", "vehicle", "suv", "sedan"]):
            intent = "vehicle_search"
        else:
            intent = "general_question"

        state["current_intent"] = intent
        state["intent"] = intent
        logger.info(f"Classified intent: {intent}")

        return state
        
    except Exception as e:
        logger.error(f"Error in classify_intent_node: {e}")
        state["current_intent"] = "unknown"
        state["error_occurred"] = True
        state["error_message"] = str(e)
        return state


async def extract_information_node(state: AgentState) -> AgentState:
    """Extract structured information from user message and keep previous values."""
    try:
        user_message = state["conversation_history"][-1]["content"] if state["conversation_history"] else ""

        logger.info(f"Extracting information from message")

        if state.get("current_intent") not in {
            "vehicle_search", "vehicle_details", "vehicle_comparison",
            "availability_check", "booking_request",
        }:
            return state

        def normalize_text(value: Optional[str]) -> Optional[str]:
            if value is None:
                return None
            return value.strip(" .-")

        def parse_date_text(date_text: str) -> Optional[str]:
            date_text = date_text.lower().strip()
            month_map = {
                "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
                "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
                "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
                "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
            }

            try:
                for pattern in [
                    r"(\d{1,2})\s*(?:th|st|nd|rd)?\s*(?:of)?\s*(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)",
                    r"(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s*(\d{1,2})(?:st|nd|rd|th)?",
                    r"(\d{1,2})\s*(?:on|for|at|to)?\s*(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)",
                ]:
                    match = re.search(pattern, date_text)
                    if match:
                        day = int(match.group(1))
                        # Determine month from matched source text.
                        month_match = re.search(r"(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)", date_text)
                        if not month_match:
                            return None
                        month = month_map.get(month_match.group(1))
                        year_match = re.search(r'\b(20\d{2})\b', date_text)
                        year = int(year_match.group(1)) if year_match else 2026
                        candidate = date(year, month, day)
                        return candidate.isoformat()
            except ValueError:
                return None

            return None

        extracted: Dict[str, Any] = {}
        message_lower = user_message.lower()
        message_lower = re.sub(r'\badn\b', 'and', message_lower)
        message_lower = re.sub(r'\bdesination\b', 'destination', message_lower)

        def clean_city(value: Optional[str]) -> Optional[str]:
            if not value:
                return None
            cleaned = normalize_text(value)
            if not cleaned:
                return None
            cleaned = re.sub(r'^(?:the|a|an|my|pickup|destination|location|for)\s+', '', cleaned).strip(" .,-")
            cleaned = re.sub(r'\s+(?:and|adn|with|for|on|at|is|are|destination|desination|pickup).*$', '', cleaned).strip(" .,-")
            if not cleaned or len(cleaned) < 2:
                return None
            return cleaned.title()

        combined_route = re.search(
            r'pickup(?:\s+location)?\s+(?:is\s+)?([a-z][a-z .-]*?)\s+(?:and|adn)\s+(?:my\s+)?(?:destination|desination)\s+(?:is\s+)?([a-z][a-z .-]+)',
            message_lower,
        )
        if combined_route:
            extracted["pickup_location"] = clean_city(combined_route.group(1))
            extracted["destination"] = clean_city(combined_route.group(2))

        route_match = re.search(r'\bfrom\s+([a-z][a-z .-]*?)\s+to\s+([a-z][a-z .-]*?)(?:\s+(?:on|for|with|at)\b|$)', message_lower)
        if " se " in message_lower:
            before, after = message_lower.split(" se ", 1)
            pickup_words = before.strip().split()
            destination_words = after.strip().split()
            if pickup_words and destination_words:
                extracted["pickup_location"] = pickup_words[-1].title()
                extracted["destination"] = destination_words[0].title()
        if not route_match:
            route_match = re.search(r'(?:\b(?:mere ko|mujhe|mujko)\s+)?([a-z][a-z .-]*?)\s+se\s+([a-z][a-z .-]*?)(?=\s+(?:jana|jaana|jane|on|ko|for|with|car|available)\b|$)', message_lower)
        if route_match and "pickup_location" not in extracted:
            extracted["pickup_location"] = clean_city(route_match.group(1))
            extracted["destination"] = clean_city(route_match.group(2))

        city_route = re.search(r'\b([a-z]{3,})\s+to\s+([a-z]{3,})\b', message_lower)
        generic_booking_phrase = re.search(r'\b(?:need|want)\s+to\s+book\b', message_lower)
        if city_route and not generic_booking_phrase and "pickup_location" not in extracted:
            extracted["pickup_location"] = clean_city(city_route.group(1))
            extracted["destination"] = clean_city(city_route.group(2))

        simple_route = re.search(
            r'(?:\bfor\s+the\s+)([a-z][a-z .-]+?)\s+to\s+([a-z][a-z .-]+?)(?:\s+(?:on|for|with|at|and)\b|[?.!,]|$)',
            message_lower,
        )
        if simple_route and "pickup_location" not in extracted:
            extracted["pickup_location"] = clean_city(simple_route.group(1))
            extracted["destination"] = clean_city(simple_route.group(2))

        pickup_explicit = re.search(
            r'pickup(?:\s+location)?\s+(?:is\s+)?([a-z][a-z .-]+?)(?:\s+(?:and|adn)\s+|\s*,|\s*$)',
            message_lower,
        )
        if pickup_explicit and "pickup_location" not in extracted:
            extracted["pickup_location"] = clean_city(pickup_explicit.group(1))

        destination_explicit = re.search(
            r'(?:destination|desination)\s+(?:is\s+)?([a-z][a-z .-]+?)(?:\s+(?:and|adn)\s+|\s*,|\s*$)',
            message_lower,
        )
        if destination_explicit and "destination" not in extracted:
            extracted["destination"] = clean_city(destination_explicit.group(1))

        passenger_match = re.search(r'\b(\d{1,2})\s*(?:passengers?|people|persons?|members?|log|travellers?|pax)\b', message_lower)
        if passenger_match:
            extracted["passengers"] = int(passenger_match.group(1))
        elif state.get("awaiting_user_input") and state.get("passengers") is None and re.fullmatch(r'\s*\d{1,2}\s*', user_message):
            extracted["passengers"] = int(user_message.strip())

        seater_match = re.search(r'\b(\d{1,2})\s*[- ]?seater\b', message_lower)
        if seater_match:
            seat_count = int(seater_match.group(1))
            extracted["seats_required"] = seat_count
            if extracted.get("passengers") is None:
                extracted["passengers"] = seat_count

        date_match = re.search(r'\b(?:on|for|date is|travel date|journey date)?\s*(\d{1,2}\s*(?:th|st|nd|rd)?\s*(?:of\s*)?(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)(?:\s+20\d{2})?)\b', message_lower)
        if date_match:
            parsed_date = parse_date_text(date_match.group(1))
            if parsed_date:
                extracted["start_date"] = parsed_date
        else:
            day_match = re.search(r'\b([1-9]|[12]\d|3[01])\s*(?:ko|th|st|nd|rd)\b', message_lower)
            if day_match:
                try:
                    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
                except Exception:
                    today = datetime.now().date()
                day = int(day_match.group(1))
                try:
                    candidate = date(today.year, today.month, day)
                    if candidate < today:
                        candidate = date(today.year + (today.month == 12), (today.month % 12) + 1, day)
                    extracted["start_date"] = candidate.isoformat()
                except ValueError:
                    pass

        time_match = re.search(
            r'\b(?:at|around|time is|pickup time is|pick-up time is)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b',
            message_lower,
        )
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2) or "00")
            meridiem = time_match.group(3)
            if 1 <= hour <= 12 and 0 <= minute <= 59:
                if meridiem == "pm" and hour != 12:
                    hour += 12
                elif meridiem == "am" and hour == 12:
                    hour = 0
                extracted["pickup_time"] = f"{hour:02d}:{minute:02d}"

        vehicle_types = ["suv", "sedan", "hatchback", "innova", "scorpio", "creta", "ertiga", "bmw", "audi", "mercedes"]
        for vtype in vehicle_types:
            if vtype in message_lower:
                extracted["vehicle_type"] = "SUV" if vtype == "suv" else vtype.capitalize()
                break

        budget_match = re.search(r'(?:under|below|budget)\s*(?:₹|rs\.?|inr)?\s*(\d+)', message_lower)
        if budget_match:
            extracted["budget_max"] = float(budget_match.group(1))
        if "non ac" in message_lower or "without ac" in message_lower:
            extracted["ac_required"] = False
        elif re.search(r'\bac\b|air conditioning', message_lower):
            extracted["ac_required"] = True

        selection_match = re.search(r'(?:option|car|vehicle)\s*(?:number\s*)?(\d+)', message_lower)
        if selection_match and state.get("search_results"):
            index = int(selection_match.group(1)) - 1
            if 0 <= index < len(state["search_results"]):
                extracted["selected_vehicle_index"] = index
                extracted["selected_vehicle"] = state["search_results"][index]

        if state.get("search_results") and not extracted.get("selected_vehicle"):
            ordinal_match = re.search(r'\b(first|one|1st|second|two|2nd|third|three|3rd|last|pehli|pahli|dusri|doosri|teesri|aakhri)\b', message_lower)
            if ordinal_match:
                ordinal_map = {
                    "first": 0, "one": 0, "1st": 0, "pehli": 0, "pahli": 0,
                    "second": 1, "two": 1, "2nd": 1, "dusri": 1, "doosri": 1,
                    "third": 2, "three": 2, "3rd": 2, "teesri": 2,
                    "last": len(state["search_results"]) - 1, "aakhri": len(state["search_results"]) - 1,
                }
                index = ordinal_map[ordinal_match.group(1)]
                if 0 <= index < len(state["search_results"]):
                    extracted["selected_vehicle_index"] = index
                    extracted["selected_vehicle"] = state["search_results"][index]

        if state.get("search_results") and not extracted.get("selected_vehicle") and any(
            phrase in message_lower for phrase in ["cheapest", "sasti", "lowest price", "most affordable"]
        ):
            extracted["selected_vehicle_index"] = min(
                range(len(state["search_results"])),
                key=lambda index: float(state["search_results"][index].get("estimatedFare") or state["search_results"][index].get("baseFare") or 0),
            )
            extracted["selected_vehicle"] = state["search_results"][extracted["selected_vehicle_index"]]

        if state.get("search_results") and not extracted.get("selected_vehicle"):
            for index, vehicle in enumerate(state["search_results"]):
                vehicle_name = (vehicle.get("vehicleName") or vehicle.get("title") or "").lower()
                if vehicle_name and vehicle_name in message_lower:
                    extracted["selected_vehicle_index"] = index
                    extracted["selected_vehicle"] = vehicle
                    break

        for key, value in extracted.items():
            if value is not None:
                state[key] = value
                if key in {"pickup_location", "destination", "start_date"}:
                    state["travel_date"] = state.get("start_date")
                    state["pickup"] = state.get("pickup_location")

        logger.info(f"Extracted information: {extracted}")

        return state
        
    except Exception as e:
        logger.error(f"Error in extract_information_node: {e}")
        state["error_occurred"] = True
        state["error_message"] = str(e)
        return state


async def check_missing_info_node(state: AgentState) -> AgentState:
    """Check missing information using the full conversation state instead of just the newest message."""
    try:
        intent = state.get("current_intent", "unknown")
        missing = []

        # Compatibility aliases for persisted state across turns.
        pickup = state.get("pickup_location") or state.get("pickup")
        destination = state.get("destination")
        travel_date = state.get("start_date") or state.get("travel_date")
        passengers = state.get("passengers")

        logger.info(f"Checking missing information for intent: {intent}")

        if intent == "vehicle_search":
            if not pickup:
                missing.append("pickup location")
            if not destination:
                missing.append("destination")
            if passengers is None:
                state["passengers"] = 1
                passengers = 1

            # Explicitly keep in-progress search state consistent for follow-up fragments.
            if pickup and destination and passengers is not None:
                state["requires_clarification"] = False
                state["missing_information"] = []

        elif intent == "booking_request":
            # Required for booking
            if not state.get("selected_vehicle"):
                missing.append("vehicle selection")
            if not state.get("pickup_location"):
                missing.append("pickup location")
            if not state.get("destination"):
                missing.append("destination")
            if not state.get("start_date"):
                missing.append("pickup date")
            if not state.get("pickup_time"):
                missing.append("pickup time")
            if not state.get("passengers"):
                missing.append("number of passengers")

        state["missing_information"] = missing
        state["requires_clarification"] = len(missing) > 0

        if missing:
            logger.info(f"Missing information: {missing}")
        else:
            logger.info("All required information present")

        state["pickup"] = state.get("pickup_location") or state.get("pickup")
        state["travel_date"] = state.get("start_date") or state.get("travel_date")
        state["intent"] = state.get("current_intent")

        return state

    except Exception as e:
        logger.error(f"Error in check_missing_info_node: {e}")
        state["error_occurred"] = True
        state["error_message"] = str(e)
        return state


async def generate_clarification_node(state: AgentState) -> AgentState:
    """Generate clarification question for missing information"""
    try:
        missing = state.get("missing_information", [])
        
        if not missing:
            state["last_response"] = "I have all the information I need. How can I help you?"
            return state
        
        # Generate appropriate clarification question
        if len(missing) == 1:
            question = f"Could you please provide the {missing[0]}?"
        else:
            question = f"I need a few more details: {', '.join(missing[:-1])}, and {missing[-1]}."
        
        state["last_response"] = question
        state["clarification_question"] = question
        state["awaiting_user_input"] = True
        
        logger.info(f"Generated clarification: {question}")
        
        return state
        
    except Exception as e:
        logger.error(f"Error in generate_clarification_node: {e}")
        state["error_occurred"] = True
        state["error_message"] = str(e)
        return state


def _format_vehicle_search_response(pickup: str, destination: str, vehicles: list) -> str:
    if not vehicles:
        return f"I couldn't find any vehicles available for your trip from {pickup} to {destination}. Would you like to try different dates or a different location?"

    response = f"I found {len(vehicles)} vehicle(s) for your trip from {pickup} to {destination}:\n\n"
    for i, vehicle in enumerate(vehicles[:5], 1):
        name = vehicle.get("vehicleName", vehicle.get("title", "Vehicle"))
        price = vehicle.get("estimatedFare", vehicle.get("baseFare", "Price on request"))
        seats = vehicle.get("seats", "N/A")
        city = vehicle.get("city") or vehicle.get("location") or "Nearby"
        distance = vehicle.get("distanceFromPickup")
        distance_text = f" - {distance} km from pickup" if isinstance(distance, (int, float)) and distance > 0 else f" - {city}"
        response += f"{i}. {name} - {seats} seats - ₹{price}{distance_text}\n"

    if len(vehicles) > 5:
        response += f"\nAnd {len(vehicles) - 5} more vehicles available."

    response += "\n\nWould you like more details about any of these vehicles, or would you like me to help you book one?"
    return response


async def execute_search_node(state: AgentState) -> AgentState:
    """Execute vehicle search using extracted information"""
    try:
        logger.info("Executing vehicle search")
        
        # Extract search parameters from state
        pickup = state.get("pickup_location") or state.get("pickup") or ""
        destination = state.get("destination") or ""
        passengers = state.get("passengers", 1)
        vehicle_type = state.get("vehicle_type")
        budget_max = state.get("budget_max")
        ac_required = state.get("ac_required")
        min_rating = state.get("min_rating")
        seat_capacity = state.get("seats_required")

        user_message = state["conversation_history"][-1]["content"] if state.get("conversation_history") else ""
        if state.get("search_results") and not re.search(
            r'\b(?:search|find|show|available|need|want|car chahiye|vehicle chahiye)\b', user_message.lower()
        ):
            state["last_response"] = "I still have the vehicles from your search. Tell me which one you want, or ask for its details."
            state["awaiting_user_input"] = False
            state["requires_clarification"] = False
            return state

        if not pickup or not destination:
            state["last_response"] = "Please tell me your pickup location and destination, for example: Jaipur to Delhi."
            state["requires_clarification"] = True
            state["awaiting_user_input"] = True
            return state

        # Execute search
        result = await search_vehicles(
            pickup=pickup,
            destination=destination,
            passengers=passengers,
            vehicle_type=vehicle_type,
            ac_only=bool(ac_required) if ac_required is not None else False,
            min_rating=min_rating,
            max_price=budget_max,
            seat_capacity=seat_capacity,
            verified_only=False,
            sort="nearest"
        )
        
        if result.get("success"):
            vehicles = result.get("vehicles", [])
            state["search_results"] = vehicles
            state["search_performed"] = True
            state["search_filters"] = {
                "pickup": pickup,
                "destination": destination,
                "passengers": passengers,
                "vehicle_type": vehicle_type,
                "budget_max": budget_max
            }
            
            # Generate response
            if vehicles:
                response = _format_vehicle_search_response(pickup, destination, vehicles)
            else:
                response = _format_vehicle_search_response(pickup, destination, [])
            
            state["last_response"] = response
            state["awaiting_user_input"] = False
            state["requires_clarification"] = False
        else:
            error = result.get("error", "Search failed")
            state["last_response"] = f"I'm sorry, but I couldn't search for vehicles right now: {error}"
            state["error_occurred"] = True
            state["error_message"] = error
        
        return state
        
    except Exception as e:
        logger.error(f"Error in execute_search_node: {e}")
        state["last_response"] = "I encountered an error while searching for vehicles. Please try again."
        state["error_occurred"] = True
        state["error_message"] = str(e)
        return state


async def execute_availability_check_node(state: AgentState) -> AgentState:
    """Execute availability check for a specific vehicle"""
    try:
        logger.info("Executing availability check")
        
        vehicle_id = state.get("selected_vehicle", {}).get("_id")
        start_date = state.get("start_date")
        end_date = state.get("end_date")
        
        if not vehicle_id:
            state["last_response"] = "I need the vehicle ID and pickup date to check availability."
            return state
        if not start_date:
            state["last_response"] = "What pickup date should I check for this vehicle?"
            return state
        
        result = await check_vehicle_availability(
            vehicle_id=vehicle_id,
            pickup_date=start_date,
            return_date=end_date
        )
        
        if result.get("success"):
            available = result.get("available")
            state["availability_status"] = available
            state["availability_checked"] = True
            
            if available:
                state["last_response"] = f"Yes, this vehicle is available for your requested dates."
            else:
                state["last_response"] = f"Sorry, this vehicle is not available for your requested dates."
                state["unavailable_reason"] = "Already booked"
        else:
            error = result.get("error", "Availability check failed")
            state["last_response"] = f"I couldn't check availability: {error}"
            state["error_occurred"] = True
            state["error_message"] = error
        
        return state
        
    except Exception as e:
        logger.error(f"Error in execute_availability_check_node: {e}")
        state["last_response"] = "I encountered an error checking availability. Please try again."
        state["error_occurred"] = True
        state["error_message"] = str(e)
        return state


async def execute_booking_node(state: AgentState) -> AgentState:
    """Execute booking request creation"""
    try:
        logger.info("Executing booking request creation")
        
        # Check authentication
        auth_token = state.get("auth_token")
        if not auth_token:
            state["needs_confirmation"] = True
            state["last_response"] = "You need to be logged in to create a booking request. Please log in first."
            return state

        # Booking creation is a side effect and always requires an explicit
        # confirmation after a vehicle has been selected.
        if not state.get("booking_confirmed"):
            state["needs_confirmation"] = True
            state["last_response"] = "I have the booking details. Please reply 'confirm' to send the booking request."
            return state
        
        # Get required parameters
        vehicle_id = state.get("selected_vehicle", {}).get("_id")
        pickup_location = state.get("pickup_location")
        destination = state.get("destination")
        start_date = state.get("start_date")
        pickup_time = state.get("pickup_time")
        passengers = state.get("passengers")
        
        if not all([vehicle_id, pickup_location, destination, start_date, pickup_time, passengers]):
            state["last_response"] = "I'm missing some required information for the booking. Please provide all details."
            return state
        
        # Re-check availability before booking
        availability_result = await check_vehicle_availability(
            vehicle_id=vehicle_id,
            pickup_date=start_date,
            return_date=state.get("end_date")
        )
        
        if not availability_result.get("available"):
            state["last_response"] = "This vehicle is no longer available for your requested dates. Would you like me to show you other available vehicles?"
            state["availability_status"] = False
            return state
        
        # Create booking request
        result = await create_booking_request(
            vehicle_id=vehicle_id,
            auth_token=auth_token,
            pickup_location=pickup_location,
            destination=destination,
            pickup_date=start_date,
            pickup_time=pickup_time,
            passengers=passengers,
            trip_type=state.get("trip_type", "local")
        )
        
        if result.get("success"):
            booking_id = result.get("booking_id")
            state["booking_id"] = booking_id
            state["booking_created"] = True
            state["booking_status"] = "PENDING"
            state["needs_confirmation"] = False
            
            state["last_response"] = f"Your booking request has been sent to the vehicle owner! Booking ID: {booking_id}. The owner has 10 minutes to respond. You'll receive a notification once they accept or decline the request."
        else:
            error = result.get("error", "Booking request failed")
            state["last_response"] = f"I couldn't create the booking request: {error}"
            state["error_occurred"] = True
            state["error_message"] = error
        
        return state
        
    except ValueError as e:
        logger.error(f"Authentication error in execute_booking_node: {e}")
        state["last_response"] = "You need to be logged in to create a booking. Please log in and try again."
        return state
    except Exception as e:
        logger.error(f"Error in execute_booking_node: {e}")
        state["last_response"] = "I encountered an error creating your booking request. Please try again."
        state["error_occurred"] = True
        state["error_message"] = str(e)
        return state


async def execute_user_bookings_node(state: AgentState) -> AgentState:
    """Execute retrieval of user's bookings"""
    try:
        logger.info("Executing user bookings retrieval")
        
        auth_token = state.get("auth_token")
        if not auth_token:
            state["last_response"] = "You need to be logged in to view your bookings. Please log in first."
            return state
        
        result = await get_user_bookings(auth_token=auth_token)
        
        if result.get("success"):
            bookings = result.get("bookings", [])
            
            if bookings:
                response = f"You have {len(bookings)} booking(s):\n\n"
                for booking in bookings:
                    booking_id = booking.get("bookingId", booking.get("_id", "Unknown"))
                    status = booking.get("bookingStatus", "Unknown")
                    vehicle = booking.get("vehicleId", {})
                    vehicle_name = vehicle.get("title", vehicle.get("vehicleName", "Vehicle"))
                    pickup_date = booking.get("pickupDate")
                    
                    response += f"• {vehicle_name} - {status} - {pickup_date}\n"
                
                state["last_response"] = response
            else:
                state["last_response"] = "You don't have any bookings yet. Would you like to search for vehicles to book?"
        else:
            error = result.get("error", "Failed to retrieve bookings")
            state["last_response"] = f"I couldn't retrieve your bookings: {error}"
            state["error_occurred"] = True
            state["error_message"] = error
        
        return state
        
    except ValueError as e:
        logger.error(f"Authentication error in execute_user_bookings_node: {e}")
        state["last_response"] = "You need to be logged in to view your bookings. Please log in first."
        return state
    except Exception as e:
        logger.error(f"Error in execute_user_bookings_node: {e}")
        state["last_response"] = "I encountered an error retrieving your bookings. Please try again."
        state["error_occurred"] = True
        state["error_message"] = str(e)
        return state


def _fallback_response(state: AgentState) -> str:
    """Rule-based responses when the LLM is unavailable or fails."""
    intent = state.get("current_intent")
    selected = state.get("selected_vehicle")
    results = state.get("search_results", [])

    if intent == "vehicle_details" and results:
        if selected:
            name = selected.get("vehicleName", selected.get("title", "this vehicle"))
            return f"{name} is selected. It is suitable when its seating and fare match your trip. You can ask me to check availability or book it."
        return f"I found {len(results)} vehicles in this conversation. Please select one by saying, for example, 'select option 2'."
    if intent == "availability_check" and not selected:
        return "Please select a vehicle from the search results first, for example 'select option 1', then I can check its availability."
    if intent == "greeting":
        return "Hey! Welcome to RideLocal. I can help you find a vehicle, compare options, check availability, or start a booking."
    if intent == "general_chat":
        return "I am here to help with your RideLocal trip. I can search vehicles, explain their details, compare fares, check availability, and guide you through booking."
    if intent == "general_question":
        return "I can help with routes, vehicle details, availability, bookings, and your existing trips. What would you like to do?"
    return "I need a little more information to continue."


async def generate_response_node(state: AgentState) -> AgentState:
    """Generate final response using LLM"""
    try:
        # If we already have a response from a tool, use it
        if state.get("last_response"):
            return state

        selected = state.get("selected_vehicle")
        results = state.get("search_results", [])
        intent = state.get("current_intent")

        if intent == "vehicle_details":
            if not selected and results:
                state["last_response"] = "Which vehicle should I describe? You can say 'second one', 'Innova', or 'the cheapest one'."
                return state
            if selected:
                vehicle_id = selected.get("_id")
                if vehicle_id:
                    detail_result = await get_vehicle_details(str(vehicle_id))
                    if detail_result.get("success") and detail_result.get("vehicle"):
                        selected = detail_result["vehicle"]
                        state["selected_vehicle"] = selected
                name = selected.get("vehicleName") or selected.get("title") or "This vehicle"
                details = [
                    f"Seats: {selected.get('seats')}" if selected.get("seats") is not None else None,
                    f"Type: {selected.get('vehicleType')}" if selected.get("vehicleType") else None,
                    f"AC: {'Yes' if selected.get('acAvailable') else 'No'}" if selected.get("acAvailable") is not None else None,
                    f"Estimated fare: ₹{selected.get('estimatedFare')}" if selected.get("estimatedFare") is not None else None,
                    f"Rating: {selected.get('rating')}" if selected.get("rating") is not None else None,
                ]
                state["last_response"] = f"{name} details:\n" + "\n".join(item for item in details if item)
                return state

        if intent == "vehicle_comparison" and results:
            cheapest = min(results, key=lambda vehicle: float(vehicle.get("estimatedFare") or vehicle.get("baseFare") or 0))
            most_seats = max(results, key=lambda vehicle: int(vehicle.get("seats") or 0))
            state["last_response"] = (
                f"Among the vehicles I found, {cheapest.get('vehicleName') or cheapest.get('title', 'one option')} "
                f"has the lowest fare at ₹{cheapest.get('estimatedFare') or cheapest.get('baseFare')}, while "
                f"{most_seats.get('vehicleName') or most_seats.get('title', 'another option')} has the most seats ({most_seats.get('seats')})."
            )
            return state
        
        conversation_history = state.get("conversation_history", [])

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

        for msg in conversation_history:
            if msg.get("role") == "user":
                messages.append({"role": "user", "content": msg.get("content", "")})
            elif msg.get("role") == "assistant":
                messages.append({"role": "assistant", "content": msg.get("content", "")})

        if llm is None:
            state["last_response"] = _fallback_response(state)
            return state

        active_model = settings.GEMINI_MODEL if settings.LLM_PROVIDER.lower() == "gemini" else settings.LLM_MODEL
        logger.info(f"Calling LLM provider={settings.LLM_PROVIDER}, model={active_model}, messages={len(messages)}")
        try:
            response = llm.invoke(messages)
            state["last_response"] = response.content
        except Exception as llm_error:
            logger.warning(f"LLM call failed, using fallback response: {llm_error}")
            state["last_response"] = _fallback_response(state)

        return state
        
    except Exception as e:
        logger.error(f"Error in generate_response_node: {e}")
        state["last_response"] = _fallback_response(state)
        return state
