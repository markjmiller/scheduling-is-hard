# Scheduling Is Hard Requirements

Scheduling with friends is hard. This app is designed to get mutual availability for any number of people, quickly. A host can create an event, and then create as many unique links as they want to send out to guests. Guests will be invited to an event and can submit their availability, and a calendar heatmap of availability will be displayed to everyone.

## Terminology

- **Event**: An event that a host creates and guests will be invited to.
- **Host**: The person who creates an event and sends out unique links to guests.
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
- There is a "generate unique link" button that will create a unique link (also identified by a unique, 8 character alphanumeric ID) intended for a guest in the form `/guest/{guest-id}`. There is an optional field for the host to enter a name for the guest.
- All unique links (i.e. guests) that have been generated show up in a table with buttons to edit or delete the guest.
- A host also gets the guests capabilities below, but without _needing_ a link.

## Guests

- When a guest receives a link, they have two very simple actions:
  1. Enter their name (if the host did not provide a name for the guest)
  2. Presented with a calendar, just click the days they are available. Each click is live updated to the server.
  3. Presented with a "I am not available" button, click it if they are not available for any dates.
- All guests will see a heatmap of availability from everyone else on the calendar. A component shows how many guests have responded, which is what will drive the heatmap intensity.

## Mutual Calendar

- The mutual calendar is a heatmap of availability from everyone else on the calendar. A component shows how many guests have responded, which is what will drive the heatmap intensity.

## Other requirements

- For the most part, there are no save or refresh buttons. Everything is live saved and updated.

## Non-requirements

- For now, there is only day availability, not time availability.
