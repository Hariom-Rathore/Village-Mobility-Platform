# RideLocal AI Agent

AI-powered vehicle rental assistant built with LangGraph and FastAPI.

## Architecture

```
RideLocal Frontend
        ↓
RideLocal Backend (Node.js/Express)
        ↓
Python AI Service (FastAPI)
        ↓
LangGraph Agent
        ↓
Tools → RideLocal APIs
```

## Setup

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the service:
```bash
python -m app.main
```

## API Endpoints

### POST /ai/chat
Main chat endpoint for AI agent interactions.

**Request:**
```json
{
  "message": "I need an SUV in Jaipur",
  "conversation_id": "optional-conversation-id",
  "user_id": "user-id",
  "auth_token": "authentication-token"
}
```

**Response:**
```json
{
  "message": "I can help you find an SUV in Jaipur...",
  "conversation_id": "conversation-id",
  "state": {},
  "vehicles": [],
  "actions": []
}
```

## Environment Variables

- `LLM_PROVIDER`: LLM provider (openai, etc.)
- `LLM_API_KEY`: API key for LLM provider
- `LLM_MODEL`: Model name
- `RIDELocal_BACKEND_URL`: URL of RideLocal backend
- `JWT_SECRET`: JWT secret for authentication
- `SESSION_SECRET`: Session secret

## Development

The service is structured as follows:

- `app/main.py`: FastAPI application
- `app/graph/`: LangGraph workflow components
- `app/tools/`: AI agent tools
- `app/services/`: External service clients
- `app/config.py`: Configuration management

## Integration with RideLocal

The AI agent communicates with the existing RideLocal backend through:

1. **Vehicle Search**: `/customers/api/search`
2. **Vehicle Details**: `/cars/:id`
3. **Availability**: `/bookings/check/:id`
4. **Booking Request**: `/bookings/request/:id`
5. **User Bookings**: `/bookings/user`
6. **Booking Details**: `/bookings/:bookingId/details`
7. **Cancellation**: `/bookings/:bookingId`

All write operations go through existing RideLocal APIs and business logic.