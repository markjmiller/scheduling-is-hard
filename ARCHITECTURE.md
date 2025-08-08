# Scheduling Is Hard Architecture

## Event

- Identified by a unique, 8 character alphanumeric ID, is a new Durable Object instance.
- Has a reference to all guest Durable Object instances.
- Durable Object Alarms are used to poll guest state from each guest Durable Object instance and update an object that is used to keep an aggregated view of availability.

## Guest

- Identified by a unique, 8 character alphanumeric ID, is a new Durable Object instance.
- When a guest changes state, it goes through the API to directly update the guest Durable Object instance. It shouldn't have to change any state in the event Durable Object instance.
- Availability should be represented as a simple array of dates.

## Frontend

- Live poll the API for updates to the event availability so that the heatmap can be updated in real-time.

### Routes

- `/` - Main page
- `/event/{event-id}` - Host page
- `/event/{event-id}/guest/{guest-id}` - Guest page
