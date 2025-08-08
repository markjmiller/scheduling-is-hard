# Scheduling Is Hard TODO

- [ ] Clean up any unnecessary debug logging and comments that are self-evident
- [ ] There should be a way to filter guests by name on the mutual calendar
- [ ] The "Edit event" save doesn't save the event. If not already, make sure this is represented as a PATCH request to the API and update the OpenAPI spec accordingly, please.
- [ ] The Create New Event page should have an input for host name. Please make sure that's recognized in the OpenAPI spec and that works with the guest ID creation for the host.
- [ ] You should be able to select today's date in the availability calendar
- [ ] Mobile view is cutting off the major components. I wonder if this is because they have min width and the media queries don't have the right values
- [ ] Double check there's parity between the OpenAPI spec and routes. Please update and clean up anything as necessary. Especially check if there's anything unused.
