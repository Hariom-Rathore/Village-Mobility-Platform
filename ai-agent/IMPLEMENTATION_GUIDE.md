# RideLocal AI Agent - Implementation Guide

## Overview

This document provides comprehensive information about the AI Vehicle Booking Agent implementation for RideLocal.

## Architecture

### System Architecture

```
User → Frontend (EJS/Bootstrap)
        ↓
RideLocal Backend (Node.js/Express)
        ↓
Python AI Service (FastAPI)
        ↓
LangGraph Agent
        ↓
Tools → RideLocal APIs
        ↓
MongoDB Database
```

### Component Breakdown

#### 1. Python AI Service (`ai-agent/`)

**Main Components:**
- `app/main.py` - FastAPI application and API endpoints
- `app/config.py` - Configuration management
- `app/graph/` - LangGraph workflow components
  - `state.py` - Agent state definition
  - `nodes.py` - Workflow nodes (intent classification, info extraction, tool execution)
  - `edges.py` - Conditional routing logic
  - `workflow.py` - Complete LangGraph workflow
- `app/tools/` - AI agent tools
  - `search_vehicles.py` - Vehicle search tool
  - `vehicle_details.py` - Vehicle details tool
  - `availability.py` - Availability checking tool
  - `booking.py` - Booking operations tool
  - `user_bookings.py` - User bookings management tool
- `app/services/` - External service clients
  - `ridelocal_client.py` - RideLocal backend API client
- `app/prompts/` - System prompts for LLM
  - `system_prompt.py` - System prompts and templates

#### 2. Frontend Integration

**Files Added:**
- `public/js/ai-chat.js` - AI chat widget JavaScript client
- `public/css/ai-chat.css` - AI chat widget styles
- `views/partials/ai-chat-widget.ejs` - Chat widget EJS template
- `views/includes/navbar.ejs` - Updated to include chat widget

## Environment Setup

### 1. Python Environment

```bash
cd ai-agent
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Environment Variables

Create `.env` file in `ai-agent/` directory:

```env
AI_SERVICE_NAME=ridelocal-ai-agent
AI_SERVICE_VERSION=1.0.0
AI_SERVICE_PORT=8000

# LLM Configuration
LLM_PROVIDER=openai
LLM_API_KEY=your_openai_api_key_here
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=1000

# RideLocal Backend
RIDELocal_BACKEND_URL=http://localhost:8081
RIDELocal_API_TIMEOUT=30

# Authentication (share with RideLocal backend)
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Logging
LOG_LEVEL=INFO
```

### 3. Start the AI Service

```bash
cd ai-agent
python -m app.main
```

The service will start on `http://localhost:8000`

## API Documentation

### POST /ai/chat

Main chat endpoint for AI agent interactions.

**Request:**
```json
{
  "message": "I need an SUV in Jaipur from 28 August to 30 August for 5 people",
  "conversation_id": "optional-conversation-id",
  "user_id": "user-id-from-session",
  "auth_token": "session-token-or-jwt"
}
```

**Response:**
```json
{
  "message": "I found 3 SUVs available for your trip...",
  "conversation_id": "generated-or-provided-id",
  "state": {
    "conversation_id": "id",
    "current_intent": "vehicle_search",
    "search_performed": true,
    "booking_created": false,
    "error_occurred": false
  },
  "vehicles": [
    {
      "_id": "vehicle-id",
      "vehicleName": "Toyota Innova",
      "seats": 7,
      "estimatedFare": 2500,
      "distanceFromPickup": 2.5
    }
  ],
  "actions": [
    {
      "type": "select_vehicle",
      "prompt": "Select a vehicle to book"
    }
  ],
  "error": null
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "llm_provider": "openai",
  "backend_url": "http://localhost:8081"
}
```

## LangGraph Workflow

### Workflow Stages

1. **Intent Classification** - Classify user intent (search, booking, availability, etc.)
2. **Information Extraction** - Extract structured data from natural language
3. **Missing Information Check** - Identify required but missing information
4. **Clarification** - Ask user for missing information (if needed)
5. **Tool Execution** - Execute appropriate tool based on intent
6. **Response Generation** - Generate natural language response

### State Management

The agent maintains conversation state including:
- User information (ID, auth token)
- Search parameters (location, dates, passengers, vehicle type)
- Search results and selected vehicle
- Booking details and status
- Conversation history and context

## Tools Implementation

### 1. search_vehicles

**Purpose:** Search for available vehicles using RideLocal backend API

**API Used:** `POST /customers/api/search`

**Parameters:**
- pickup: Pickup location
- destination: Destination
- passengers: Number of passengers
- vehicle_type: Vehicle type filter
- ac_only: AC vehicles only
- min_rating: Minimum rating
- max_price: Maximum price
- sort: Sort order

**Returns:** Vehicle list with pricing and availability

### 2. get_vehicle_details

**Purpose:** Get detailed vehicle information

**API Used:** `GET /cars/:id`

**Parameters:**
- vehicle_id: Vehicle ID

**Returns:** Complete vehicle details

### 3. check_vehicle_availability

**Purpose:** Check if vehicle is available for specific dates

**API Used:** `GET /bookings/check/:id`

**Parameters:**
- vehicle_id: Vehicle ID
- pickup_date: Pickup date
- return_date: Return date (optional)

**Returns:** Availability status and vehicle info

### 4. create_booking_request

**Purpose:** Create booking request through RideLocal backend

**API Used:** `POST /bookings/request/:id`

**Parameters:**
- vehicle_id: Vehicle ID
- auth_token: User authentication token
- pickup_location: Pickup address
- destination: Destination
- pickup_date: Pickup date
- pickup_time: Pickup time
- passengers: Number of passengers
- trip_type: Trip type

**Returns:** Booking ID and status

### 5. get_user_bookings

**Purpose:** Get user's booking history

**API Used:** `GET /bookings/user`

**Parameters:**
- auth_token: User authentication token
- status: Optional status filter

**Returns:** User's bookings

### 6. cancel_booking

**Purpose:** Cancel existing booking

**API Used:** `DELETE /bookings/:bookingId`

**Parameters:**
- booking_id: Booking ID
- auth_token: User authentication token
- reason: Cancellation reason

**Returns:** Cancellation result

## Frontend Integration

### Chat Widget

The AI chat widget is integrated into the RideLocal frontend:

1. **Toggle Button:** Floating button in bottom-right corner
2. **Chat Interface:** Full chat interface with message history
3. **Vehicle Cards:** Structured display of search results
4. **Action Buttons:** Interactive buttons for vehicle selection and booking confirmation

### Integration Points

- **Navbar:** Chat widget included in navbar for all pages
- **User Context:** Passes user ID and auth token from session
- **Vehicle Pages:** Can be enhanced with AI assistance
- **Booking Pages:** AI can guide users through booking process

## Testing

### Run Tests

```bash
cd ai-agent
pytest tests/ -v
```

### Test Coverage

Current tests cover:
- Intent classification
- Information extraction
- Missing information detection
- Workflow execution
- Tool functionality

### Manual Testing Scenarios

1. **Vehicle Search:**
   - "I need an SUV in Jaipur"
   - "Find cars for 5 people from Delhi to Agra"

2. **Missing Information:**
   - "I need a car" (should ask for details)
   - "Book a car for tomorrow" (should ask for pickup/destination)

3. **Vehicle Selection:**
   - "Show me the second option"
   - "I want the Toyota Innova"

4. **Booking Flow:**
   - Complete booking conversation
   - Authentication check

5. **Error Handling:**
   - Invalid dates
   - No vehicles found
   - Backend unavailable

## Security Considerations

### Authentication

- AI service requires valid authentication tokens for protected operations
- Never bypasses existing RideLocal authentication
- User ID and auth token passed from session context

### Data Privacy

- Never exposes another user's booking information
- No direct database write access
- All operations go through existing APIs

### Business Rules

- Always re-checks availability before booking
- Never fabricates booking IDs or payment information
- Respects existing booking status flow
- Requires explicit confirmation before booking

## Troubleshooting

### Common Issues

1. **AI Service Not Starting:**
   - Check Python version (3.8+)
   - Verify dependencies installed
   - Check environment variables

2. **RideLocal Backend Connection:**
   - Verify backend URL in .env
   - Check if backend is running
   - Test backend health endpoint

3. **LLM API Errors:**
   - Verify API key is valid
   - Check API quota/limits
   - Test LLM provider connectivity

4. **Frontend Chat Widget Not Showing:**
   - Check if AI service health check passes
   - Verify JavaScript console for errors
   - Check CSS/JS file paths

## Performance Considerations

- **Caching:** Consider caching search results for repeated queries
- **Rate Limiting:** Implement rate limiting for AI service
- **Async Operations:** All I/O operations are async
- **Connection Pooling:** HTTP client uses connection pooling

## Future Enhancements

### Phase 2 Features

1. **Advanced Date Parsing:** Better natural language date understanding
2. **Location Autocomplete:** Integration with geocoding
3. **Multi-turn Conversations:** Enhanced context management
4. **Voice Support:** Speech-to-text integration
5. **Recommendation Engine:** AI-powered vehicle recommendations

### Integration Improvements

1. **WebSocket Support:** Real-time bidirectional communication
2. **Session Persistence:** Long-term conversation memory
3. **Analytics:** User interaction analytics
4. **A/B Testing:** Compare AI vs traditional booking flow

## Monitoring and Logging

### Log Levels

- `INFO`: Normal operations, user interactions
- `ERROR`: Errors and exceptions
- `DEBUG`: Detailed debugging information

### Key Metrics to Monitor

- API response times
- Tool execution success rates
- User satisfaction (if implemented)
- Error rates by type

## Deployment

### Development

```bash
cd ai-agent
python -m app.main
```

### Production

1. Use environment-specific configuration
2. Enable HTTPS/WSS
3. Implement proper logging
4. Set up monitoring
5. Configure load balancing if needed

### Docker Deployment (Optional)

```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "-m", "app.main"]
```

## Support and Maintenance

### Code Structure

The codebase is organized for maintainability:
- Clear separation of concerns
- Modular tool architecture
- Comprehensive error handling
- Extensive logging

### Adding New Features

1. Add new tool in `app/tools/`
2. Add corresponding node in `app/graph/nodes.py`
3. Update routing in `app/graph/edges.py`
4. Add tests in `tests/`
5. Update documentation

## Conclusion

The AI Agent provides a natural language interface over the existing RideLocal system, enhancing user experience while maintaining all existing business logic, security, and data integrity.