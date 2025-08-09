# Scheduling Is Hard Architecture

Real-time scheduling application with React frontend and [Cloudflare Workers](https://workers.cloudflare.com/) backend. The application enables hosts to create scheduling events and generate unique guest links for collecting availability data, with real-time heatmap visualization of mutual availability. All data is stored in [Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/).

## Event Durable Object

- Each event gets its own Event DO instance, identified by 8-character alphanumeric ID with 'e' prefix
- Stores event metadata (name, description, host name, host guest ID)
- Maintains registry of guest IDs for the event
- Handles guest link generation and guest management

## Guest Durable Object

- Each guest gets its own Guest DO instance, identified by 8-character alphanumeric ID with 'g' prefix
- Stores guest name, availability array, timestamps, and event ID reference
- Single source of truth for all guest data
- Event ID is internal - never exposed to guests in URLs or API calls

## API Endpoints

**Event endpoints (host access):**
- `POST /api/events` - Create event (requires host name)
- `GET /api/events/{eventId}` - Get event details
- `PUT /api/events/{eventId}` - Update event details
- `POST /api/events/{eventId}/guests` - Generate guest link
- `GET /api/events/{eventId}/guests` - Get all guests with availability data
- `DELETE /api/events/{eventId}/guests/{guestId}` - Delete guest

**Guest endpoints (isolated from event IDs):**
- `GET /api/guests/{guestId}` - Get guest details and event info
- `PUT /api/guests/{guestId}/name` - Update guest name
- `PUT /api/guests/{guestId}/availability` - Update availability
