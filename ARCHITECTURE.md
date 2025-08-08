# Scheduling Is Hard Architecture

## Overview

Real-time scheduling application with React frontend and Cloudflare Durable Objects backend.

## Backend Architecture

### Event Durable Objects

- Each event gets its own Event DO instance, identified by 8-character alphanumeric ID
- Stores event metadata (name, description, expected attendees, host guest ID)
- Maintains registry of guest IDs for the event
- Uses Durable Object Alarms to poll Guest DOs every 5 seconds
- Caches aggregated availability heatmap data with normalized 0-1 values

### Guest Durable Objects

- Each guest gets its own Guest DO instance, identified by 8-character alphanumeric ID
- Stores guest name, availability array, timestamps, and event ID reference
- Availability updates go directly to Guest DO, not through Event DO
- Event ID is internal - never exposed to guests in URLs or API calls

### Real-Time Polling

**Backend (Durable Object Alarms):**
- Event DO alarms trigger every 5 seconds
- Polls all Guest DOs for availability data
- Calculates normalized heatmap and caches results
- 60-second retry on errors

**Frontend:**
- Polls availability data every 10 seconds
- Polls individual guest data to sync user's own selections
- Local state updates happen immediately, sync to server in background

### API Endpoints

**Event endpoints (host access):**
- `POST /api/events` - Create event
- `GET /api/events/{eventId}` - Get event details
- `POST /api/events/{eventId}/guests` - Generate guest link
- `GET /api/events/{eventId}/availability` - Get availability heatmap

**Guest endpoints (isolated from event IDs):**
- `GET /api/guests/{guestId}` - Get guest details
- `PUT /api/guests/{guestId}/name` - Update guest name
- `PUT /api/guests/{guestId}/availability` - Update availability

### Communication

- Event DO ↔ Guest DO: Direct RPC method calls
- Frontend ↔ Backend: HTTP REST API with JSON
- OpenAPI spec for type generation

## Frontend Architecture

### Components

- `HostPage.tsx` - Event management and host availability
- `GuestPage.tsx` - Guest availability input
- `Calendar.tsx` - Shared calendar component for both input and heatmap display

### State Management

- React useState for component state
- `ApiService.ts` for centralized HTTP calls with generated TypeScript types
- Optimistic local updates with background server sync

### Real-Time Sync

- Both availability calendar and heatmap sync across browser windows
- 10-second polling for availability data
- Immediate UI updates, async server sync

## Security

- Guest URLs use `/guest/{guestId}` - no event ID exposure
- Guest API endpoints never require event ID parameters
- Guest DOs store event ID internally, not visible to frontend
- Hosts access event data via `/api/events/*` endpoints
- Guests only access their own data via `/api/guests/*` endpoints

## Performance

- Event DOs cache aggregated availability data
- Background alarm-based aggregation reduces API response times
- Frontend uses optimistic updates for immediate UI response
- 5-second backend polling, 10-second frontend polling intervals

## Routes

**Frontend:**
- `/` - Event creation
- `/event/{eventId}` - Host page
- `/guest/{guestId}` - Guest page

**API:**
- `POST /api/events` - Create event
- `GET /api/events/{eventId}` - Get event details
- `POST /api/events/{eventId}/guests` - Generate guest link
- `GET /api/events/{eventId}/availability` - Get availability heatmap
- `GET /api/guests/{guestId}` - Get guest details
- `PUT /api/guests/{guestId}/name` - Update guest name
- `PUT /api/guests/{guestId}/availability` - Update availability
