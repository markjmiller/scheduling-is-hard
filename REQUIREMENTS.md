# Scheduling Is Hard Requirements

Scheduling with friends is hard. This app is designed to get mutual availability for any number of people, quickly. A host can create an event and then create as many unique links as they want to send out to guests. Invited guests submit their availability and a calendar heatmap of availability is displayed to everyone.

## Terminology

- **Event**: An event that a host creates and guests will be invited to.
- **Host**: The person who creates an event and sends out links to guests.
- **Unique Link**: A unique link a host sends to a guest that allows them to submit their availability.
- **Guest**: A person who is invited to an event.
- **Availability Calendar**: A calendar that guests interact with to submit their availability.
- **Mutual Calendar**: A calendar that shows a heatmap of availability of all guests for an event.

## Main Page

The main page is a simple "create event" form.

## Host

- A host can create an event and update any info about it later.
- The event will be defined by:
  1. A name.
  2. A long-form description.
- The event is identified by a unique, 8 character alphanumeric ID. Managing an event means going to `/event/{event-id}`.
- There is a "generate unique link" button that creates a unique link (identified by a unique, 8-character alphanumeric ID) intended for a guest in the form `/guest/{guest-id}`. There is an optional field for the host to enter a name for the guest.
- All unique links (i.e. guests) that have been generated show up in a table with buttons to edit or delete the guest.
- A host also gets the guest capabilities below, but without needing a link.

## Guests

- When a guest receives a link, they have these simple actions:
  1. Enter their name (if the host did not provide a name for the guest)
  2. Use the calendar to click the days they are available. Each click is live updated to the server.
  3. Use the "I am not available" button if they are not available for any dates.
- All guests will see a heatmap of availability from all participants on the calendar. A component shows how many guests have responded, which drives the heatmap intensity.

## Mutual Calendar

- The mutual calendar displays a heatmap of availability from all participants. The intensity of the heatmap corresponds to how many guests are available on each date.

## Other requirements

- For the most part, there are no save or refresh buttons. Everything is live saved and updated.

## Non-requirements

- For now, there is only day availability, not time availability.
