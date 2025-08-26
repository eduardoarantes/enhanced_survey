# Survey Backend Service

A Node.js/Express backend service that provides LLM validation proxy with session-based throttling for the Enhanced Survey Tool.

## Features

- **LLM Proxy**: Proxies OpenAI API calls to prevent exposing API keys in the frontend
- **Session-based Throttling**: Limits requests per session to prevent abuse (10 requests per minute per session)
- **Global Rate Limiting**: Additional IP-based rate limiting as a backup (100 requests per 15 minutes per IP)
- **Session Management**: Automatic session ID generation and tracking
- **Health Monitoring**: Health check endpoint and session cleanup
- **Error Handling**: Proper error responses for different failure scenarios

## API Endpoints

### Health Check
```
GET /health
```
Returns service status and active session count.

### Session Management
```
POST /api/session
```
Generates a new session ID for tracking.

```
GET /api/session/:sessionId/status
```
Returns throttling status for a specific session.

### LLM Validation
```
POST /api/validate
```
Headers: `X-Session-Id: <session-id>`
Body:
```json
{
  "question": "Survey question",
  "answer": "User's answer", 
  "prompt": "LLM validation prompt",
  "apiKey": "OpenAI API key"
}
```

## Throttling Rules

- **Session Limit**: 10 requests per minute per session
- **Global Limit**: 100 requests per 15 minutes per IP
- **Window Reset**: Rolling 1-minute window for session throttling
- **Session Cleanup**: Inactive sessions are cleaned up every 5 minutes

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Start the service:
```bash
# Development
npm run dev

# Production  
npm start
```

The service will run on `http://localhost:3001` by default.

## Testing Throttling

Use the included test script to verify throttling behavior:
```bash
node test-throttling.js
```

This script will:
1. Create a session
2. Make 12 rapid requests (exceeding the limit of 10)
3. Show throttling kicks in for requests 11+
4. Display session status

## Architecture

### Session-Based Throttling
- Each frontend instance gets a unique session ID
- Requests are tracked per session in a time window
- Memory-based storage (use Redis for production scaling)

### Error Handling
- **401**: Invalid OpenAI API key
- **429**: Throttling limit exceeded (session or global)
- **400**: Missing required fields
- **500**: Internal server errors

### Security Features
- CORS enabled for frontend integration
- API keys are validated server-side
- No API keys stored or logged
- Rate limiting prevents abuse

## Production Considerations

For production deployment:
1. Use Redis for session storage instead of in-memory Map
2. Add authentication/authorization
3. Use HTTPS
4. Configure proper CORS origins
5. Add comprehensive logging
6. Monitor API usage and costs
7. Consider API key management service

## Integration

The frontend automatically:
- Generates session IDs
- Shows throttling status in UI
- Displays backend connectivity status
- Handles throttling errors gracefully

Frontend shows:
- "AI validation is enabled with throttling protection" when connected
- Request usage progress bar
- "Backend Service Offline" warning when disconnected