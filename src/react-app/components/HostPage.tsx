import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import Calendar from "./Calendar.tsx";
import { ApiService } from "../services/api";
import { POLLING_INTERVALS } from "../config/polling";
import "../css/HostPage.css";
import type { components } from "../../../types/api";

type Event = components["schemas"]["Event"];
type Guest = components["schemas"]["Guest"];

interface ExtendedGuest extends Guest {
  availability?: string[];
  hasResponded: boolean;
}

export default function HostPage() {
  const { eventId } = useParams<{ eventId: string }>();

  // Event state
  const [event, setEvent] = useState<Event | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: "",
    description: "",
  });

  // Guest management state
  const [guests, setGuests] = useState<ExtendedGuest[]>([]);
  const [newGuestName, setNewGuestName] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Host availability state (host is also a participant)
  const [hostSelectedDates, setHostSelectedDates] = useState<string[]>([]);
  const [isHostNotAvailable, setIsHostNotAvailable] = useState(false);
  const [hostGuestId, setHostGuestId] = useState<string | null>(null);

  // Host name editing state
  const [hostName, setHostName] = useState("");
  const [isEditingHostName, setIsEditingHostName] = useState(false);

  // Guest editing state
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editingGuestName, setEditingGuestName] = useState("");

  // Mutual calendar state
  const [availabilityHeatmap, setAvailabilityHeatmap] = useState<
    Map<string, number>
  >(new Map());
  const [totalGuests, setTotalGuests] = useState(0);
  const [respondedGuests, setRespondedGuests] = useState(0);

  // Guest filter state
  const [allGuestData, setAllGuestData] = useState<any[]>([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  
  // Shared month state for synchronized calendar navigation
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [hasInitializedMonth, setHasInitializedMonth] = useState<boolean>(false);
  
  // Debouncing for API calls
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDatesRef = useRef<string[]>([]);

  // Guest search state
  const [guestSearchTerm, setGuestSearchTerm] = useState<string>("");

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to convert guest data to heatmap with optional filtering
  const createHeatmapFromGuests = (guests: any[], filterGuestIds?: string[]) => {
    const heatmap = new Map<string, number>();
    
    // If filterGuestIds is provided and empty, return empty heatmap
    if (filterGuestIds !== undefined && filterGuestIds.length === 0) {
      return heatmap;
    }
    
    const guestsToInclude = filterGuestIds && filterGuestIds.length > 0
      ? guests.filter(guest => filterGuestIds.includes(guest.id))
      : guests;

    guestsToInclude.forEach((guest) => {
      if (guest.hasResponded && guest.availability) {
        guest.availability.forEach((date: string) => {
          const currentCount = heatmap.get(date) || 0;
          heatmap.set(date, currentCount + 1);
        });
      }
    });

    return heatmap;
  };

  // Memoize heatmap creation to prevent blinking on API calls when data hasn't changed
  const availabilityHeatmapMemo = useMemo(() => {
    if (allGuestData.length > 0) {
      return createHeatmapFromGuests(allGuestData, selectedGuestIds);
    }
    return new Map<string, number>();
  }, [allGuestData, selectedGuestIds]);

  // Update heatmap state only when memoized value changes
  useEffect(() => {
    setAvailabilityHeatmap(availabilityHeatmapMemo);
  }, [availabilityHeatmapMemo]);

  // Smart calendar month initialization when host availability data loads
  useEffect(() => {
    if (!hasInitializedMonth && hostSelectedDates.length > 0) {
      // Find the earliest date from host availability
      const sortedDates = [...hostSelectedDates].sort();
      const earliestDate = sortedDates[0];
      
      // Parse the date string (YYYY-MM-DD format)
      const dateParts = earliestDate.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
      
      // Set calendar to the first day of that month
      const hostMonth = new Date(year, month, 1);
      setCurrentMonth(hostMonth);
      setHasInitializedMonth(true);
    }
  }, [hostSelectedDates, hasInitializedMonth]);



  useEffect(() => {
    loadEventData();
  }, [eventId]);

  // Real-time  // Poll interval ref for resetting when user interacts with calendar
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset polling interval when user changes availability
  const resetPollInterval = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    if (!eventId) return;

    const pollAvailability = async () => {
      try {
        // Poll mutual calendar updates and guest list updates
        const [heatmapData, guestList] = await Promise.all([
          ApiService.getEventAvailability(eventId),
          ApiService.getEventGuests(eventId),
        ]);

        // Store all guest data and update heatmap with current filter
        setAllGuestData(heatmapData.guests);
        setAvailabilityHeatmap(createHeatmapFromGuests(heatmapData.guests, selectedGuestIds));
        setTotalGuests(heatmapData.totalGuests);
        setRespondedGuests(heatmapData.respondedGuests);

        // Update guest list (filter out host from guest rows)
        const filteredGuests = guestList.filter(
          (guest) => guest.id !== hostGuestId,
        );
        const extendedGuests: ExtendedGuest[] = filteredGuests.map((guest) => ({
          ...guest,
          hasResponded: Boolean(
            guest.availability && guest.availability.length > 0,
          ),
        }));
        setGuests(extendedGuests);

        // Poll host's own availability calendar to sync across sessions
        if (hostGuestId) {
          const hostGuestData = await ApiService.getGuest(hostGuestId);
          if (hostGuestData?.availability) {
            setHostSelectedDates(hostGuestData.availability);
          }
        }
      } catch (err) {
        // Silently fail to avoid disrupting UX with polling errors
        console.warn("Failed to poll availability updates:", err);
      }
    };

    // Start polling for real-time updates
    pollIntervalRef.current = setInterval(
      pollAvailability,
      POLLING_INTERVALS.HOST_PAGE.AVAILABILITY_AND_GUESTS,
    );
  }, [eventId, hostGuestId]);

  // Poll for availability updates every 10 seconds for real-time sync
  useEffect(() => {
    if (!eventId || !hostGuestId) return;

    resetPollInterval();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Cleanup debounce timeout on unmount
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [eventId, hostGuestId, resetPollInterval]);

  const loadEventData = async () => {
    if (!eventId) return;

    try {
      setLoading(true);

      // Load event details
      const eventData = await ApiService.getEvent(eventId);
      setEvent(eventData);
      setEventForm({
        name: eventData.name,
        description: eventData.description,
      });

      // Set host guest ID for availability participation
      if (eventData.hostGuestId) {
        setHostGuestId(eventData.hostGuestId);
      }

      // Load availability heatmap and guest list
      const [heatmapData, guestList] = await Promise.all([
        ApiService.getEventAvailability(eventId),
        ApiService.getEventGuests(eventId),
      ]);

      // Store all guest data for filtering
      setAllGuestData(heatmapData.guests);
      
      // Initialize with all guests selected ONLY if no selection exists yet
      const allGuestIds = heatmapData.guests.map((guest: any) => guest.id);
      setSelectedGuestIds(prev => {
        const guestIds = prev.length === 0 ? allGuestIds : prev;
        setAvailabilityHeatmap(createHeatmapFromGuests(heatmapData.guests, guestIds));
        return guestIds;
      });
      setRespondedGuests(heatmapData.respondedGuests);
      setTotalGuests(heatmapData.totalGuests);

      // Filter out the host from the guest list (host shouldn't appear in "Invited Guests")
      const filteredGuests = guestList.filter(
        (guest) => guest.id !== eventData.hostGuestId,
      );
      const extendedGuests: ExtendedGuest[] = filteredGuests.map((guest) => ({
        ...guest,
        hasResponded: Boolean(
          guest.availability && guest.availability.length > 0,
        ),
      }));
      setGuests(extendedGuests);

      // Load host's existing availability and name if hostGuestId is available
      if (eventData.hostGuestId) {
        try {
          const hostGuestData = await ApiService.getGuest(
            eventData.hostGuestId,
          );
          if (hostGuestData?.availability) {
            setHostSelectedDates(hostGuestData.availability);
          }
          if (hostGuestData?.name) {
            setHostName(hostGuestData.name);
          }
        } catch (error) {
          console.error("Error loading host data:", error);
        }
      }

      setLoading(false);
    } catch (err) {
      setError("Failed to load event data");
      console.error("Error loading event data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setEventForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEventFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !eventForm.name.trim() || !eventForm.description.trim())
      return;

    try {
      const updatedEvent = await ApiService.updateEvent(eventId, {
        name: eventForm.name.trim(),
        description: eventForm.description.trim(),
      });

      // Update local state with the updated event
      setEvent(updatedEvent);
      setIsEditingEvent(false);
    } catch (error) {
      console.error("Error updating event:", error);
      alert("Failed to update event. Please try again.");
    }
  };

  const handleGenerateGuestLink = async () => {
    if (!eventId || isGeneratingLink) return;

    try {
      setIsGeneratingLink(true);
      const guestLink = await ApiService.generateGuestLink(
        eventId,
        newGuestName.trim() || undefined,
      );

      // Add to guests list
      const newGuest: ExtendedGuest = {
        id: guestLink.guestId,
        name: newGuestName.trim() || undefined,
        hasResponded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setGuests((prev) => [...prev, newGuest]);
    
    // Automatically select the new guest in the filter
    setSelectedGuestIds((prev) => [...prev, guestLink.guestId]);
    
    // Add the new guest to allGuestData for immediate heatmap inclusion
    setAllGuestData((prev) => [...prev, {
      id: guestLink.guestId,
      name: newGuestName.trim() || undefined,
      hasResponded: false,
      availability: [],
      isHost: false
    }]);
    
    setNewGuestName("");

    // Show success message with link
    const fullLink = `${window.location.origin}/guest/${guestLink.guestId}`;
    navigator.clipboard.writeText(fullLink);
    } catch (error) {
      console.error("Error generating guest link:", error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Debounced API update function for host dates
  const performDebouncedHostUpdate = useCallback(async (targetDates: string[]) => {
    if (!eventId || !hostGuestId) return;

    try {
      await ApiService.updateGuestAvailability(hostGuestId, targetDates);

      // Refresh heatmap data
      const heatmapData = await ApiService.getEventAvailability(eventId);
      setAllGuestData(heatmapData.guests);
      setAvailabilityHeatmap(createHeatmapFromGuests(heatmapData.guests, selectedGuestIds));
      setRespondedGuests(heatmapData.respondedGuests);
    } catch (error) {
      console.error("Error updating host availability:", error);
      // Revert to previous state on error
      setHostSelectedDates(pendingDatesRef.current);
    }
  }, [eventId, hostGuestId, setAllGuestData, selectedGuestIds, createHeatmapFromGuests]);

  const handleHostDateToggle = useCallback((date: string) => {
    if (!eventId || !hostGuestId) return;

    // If "not available" is toggled, turn it off when host clicks any date
    if (isHostNotAvailable) {
      setIsHostNotAvailable(false);
    }

    const newSelectedDates = hostSelectedDates.includes(date)
      ? hostSelectedDates.filter((d) => d !== date)
      : [...hostSelectedDates, date];

    // Immediate UI update for responsiveness
    setHostSelectedDates(newSelectedDates);
    pendingDatesRef.current = hostSelectedDates; // Store previous state for potential rollback

    // Reset poll interval to prevent server from overwriting user input
    resetPollInterval();

    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounced API call
    debounceTimeoutRef.current = setTimeout(() => {
      performDebouncedHostUpdate(newSelectedDates);
    }, 300); // 300ms debounce delay
  }, [eventId, hostGuestId, isHostNotAvailable, hostSelectedDates, resetPollInterval, performDebouncedHostUpdate]);

  const handleHostNotAvailable = async () => {
    if (!eventId || !hostGuestId) return;

    try {
      const newNotAvailableState = !isHostNotAvailable;
      setIsHostNotAvailable(newNotAvailableState);

      if (newNotAvailableState) {
        // Host indicating not available - clear all selected dates
        setHostSelectedDates([]);

        // Reset poll interval to prevent server from overwriting user input
        resetPollInterval();

        // CRITICAL: Send empty array to server
        await ApiService.updateGuestAvailability(hostGuestId, []);
      }
    } catch (error) {
      console.error("Error updating host not available status:", error);
      setIsHostNotAvailable(false);
    }
  };

  const handleHostNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim() || !hostGuestId) return;

    try {
      await ApiService.updateGuestName(hostGuestId, hostName.trim());
      setIsEditingHostName(false);
    } catch (error) {
      console.error("Error updating host name:", error);
    }
  };

  const handleEditGuest = (guest: ExtendedGuest) => {
    setEditingGuestId(guest.id);
    setEditingGuestName(guest.name || "");
  };

  const handleSaveGuestName = async (guestId: string) => {
    if (!editingGuestName.trim()) return;

    try {
      await ApiService.updateGuestName(guestId, editingGuestName.trim());

      // Update local state
      setGuests((prev) =>
        prev.map((guest) =>
          guest.id === guestId
            ? { ...guest, name: editingGuestName.trim() }
            : guest,
        ),
      );

      setEditingGuestId(null);
      setEditingGuestName("");
    } catch (error) {
      console.error("Error updating guest name:", error);
      alert("Failed to update guest name. Please try again.");
    }
  };

  const handleCancelGuestEdit = () => {
    setEditingGuestId(null);
    setEditingGuestName("");
  };

  const handleDeleteGuest = async (guest: ExtendedGuest) => {
    if (!guest.id || !eventId) {
      console.error("Missing guest ID or event ID");
      return;
    }

    try {
      await ApiService.deleteGuest(eventId, guest.id);

      // Remove from local state
      setGuests((prev) => prev.filter((g) => g.id !== guest.id));

      // Refresh availability heatmap since guest was removed
      if (eventId) {
        const eventAvailability =
          await ApiService.getEventAvailability(eventId);
        setAvailabilityHeatmap(
          createHeatmapFromGuests(eventAvailability.guests),
        );
        setTotalGuests(eventAvailability.totalGuests);
        setRespondedGuests(eventAvailability.respondedGuests);
      }
    } catch (error) {
      console.error("Error deleting guest:", error);
    }
  };

  if (loading) {
    return (
      <div className="host-page">
        <div className="host-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <h2>Loading Event...</h2>
          <p>Please wait while we load your event details.</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="host-page">
        <div className="host-error">
          <i className="fas fa-calendar-times"></i>
          <h2>Event Not Found</h2>
          <p>
            The event you're looking for doesn't exist or you don't have
            permission to access it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="host-page">
      {/* Event Header */}
      <header className="event-header">
        {isEditingEvent ? (
          <form className="event-form" onSubmit={handleEventFormSubmit}>
            <div className="form-group">
              <input
                type="text"
                name="name"
                value={eventForm.name}
                onChange={handleEventFormChange}
                className="event-title-input"
                placeholder="Event name"
                required
              />
            </div>
            <div className="form-group">
              <textarea
                name="description"
                value={eventForm.description}
                onChange={handleEventFormChange}
                className="event-description-input"
                placeholder="Event description"
                rows={2}
                required
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn">
                <i className="fas fa-check"></i>
                Save Changes
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setIsEditingEvent(false)}
              >
                <i className="fas fa-times"></i>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="host-event-info">
            <div className="event-details">
              <div style={{ padding: "1rem" }}>
                <h1>{event.name}</h1>
                <p>{event.description}</p>
                <div className="event-meta">
                  <span>Event ID: {event.id}</span>
                </div>
              </div>
            </div>
            <div className="event-actions">
              <button
                className="edit-event-btn"
                onClick={() => setIsEditingEvent(true)}
                title="Edit event details"
              >
                <i className="fas fa-edit"></i>
                Edit Event
              </button>
              <button
                className="copy-event-link-btn"
                onClick={() => {
                  const eventLink = `${window.location.origin}/event/${event.id}`;
                  navigator.clipboard.writeText(eventLink);
                }}
                title="Copy event management link"
              >
                <i className="fas fa-copy"></i>
                Copy Event Link
              </button>
            </div>
            <div className="event-link-warning">
              <i className="fas fa-exclamation-triangle"></i>
              <span style={{ textWrap: "wrap" }}>
                The event management link above is the only way to manage this
                event and anyone with it can edit it. Treat it like a secret!
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Guest Management Section */}
      <section className="guest-management">
        {/* Generate Guest Link */}
        <div className="guest-link-generator">
          <div className="input-group">
            <input
              type="text"
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              placeholder="Guest name (optional)"
              className="guest-name-input"
            />
            <button
              onClick={handleGenerateGuestLink}
              disabled={isGeneratingLink}
              className="generate-link-btn"
            >
              {isGeneratingLink ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Generating...
                </>
              ) : (
                <>
                  <i className="fas fa-link"></i>
                  Make Guest Link
                </>
              )}
            </button>
          </div>
          <p className="helper-text">
            Generate a unique link for each guest. The link will be
            automatically copied to your clipboard.
          </p>
        </div>

        {/* Guests Table */}
        <div className="guests-table">
          <div className="guests-table-header">
            <h3>
              Invited Guests ({guests.filter(guest => {
                const displayName = guest.name || guest.id;
                return displayName.toLowerCase().includes(guestSearchTerm.toLowerCase());
              }).length}{guests.length !== guests.filter(guest => {
                const displayName = guest.name || guest.id;
                return displayName.toLowerCase().includes(guestSearchTerm.toLowerCase());
              }).length ? ` of ${guests.length}` : ""})
            </h3>
            {guests.length > 0 && (
              <div className="guest-search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search"
                  value={guestSearchTerm}
                  onChange={(e) => setGuestSearchTerm(e.target.value)}
                  className="guest-search-input"
                />
                {guestSearchTerm && (
                  <button
                    onClick={() => setGuestSearchTerm("")}
                    className="clear-search-btn"
                    title="Clear search"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            )}
          </div>
          {guests.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-user-plus"></i>
              <p>
                No guests invited yet. Generate a guest link to get started!
              </p>
            </div>
          ) : (
            <div className="guests-table-container">
              <table style={{ borderRadius: "0px" }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Guest Link</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {guests
                    .filter(guest => {
                      const displayName = guest.name || guest.id;
                      return displayName.toLowerCase().includes(guestSearchTerm.toLowerCase());
                    })
                    .map((guest) => (
                  <tr key={guest.id}>
                    {editingGuestId === guest.id ? (
                      <td colSpan={4} className="guest-edit-row">
                        <div className="guest-name-edit-full-width">
                          <div className="guest-edit-info">
                            <span className="guest-id-label">ID {guest.id}</span>
                          </div>
                          <div className="guest-edit-input-section">
                            <input
                              type="text"
                              value={editingGuestName}
                              onChange={(e) =>
                                setEditingGuestName(e.target.value)
                              }
                              className="guest-name-input-full-width"
                              placeholder="Enter guest name"
                              autoFocus
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveGuestName(guest.id);
                                } else if (e.key === "Escape") {
                                  handleCancelGuestEdit();
                                }
                              }}
                            />
                            <div className="guest-edit-actions">
                              <button
                                onClick={() => handleSaveGuestName(guest.id)}
                                className="save-guest-name-btn"
                                title="Save name"
                              >
                                <i className="fas fa-check"></i>
                                Save
                              </button>
                              <button
                                onClick={handleCancelGuestEdit}
                                className="cancel-guest-name-btn"
                                title="Cancel"
                              >
                                <i className="fas fa-times"></i>
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td>
                          <div className="guest-name-display">
                            <div className="guest-name-row">
                              <button
                                className="edit-guest-btn-inline"
                                title="Edit guest name"
                                onClick={() => handleEditGuest(guest)}
                                disabled={editingGuestId !== null}
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <div className="guest-name">
                                {guest.name || `Name pending`}
                              </div>
                            </div>
                            <div className="guest-id-subtitle">
                              ID: {guest.id}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`status ${guest.hasResponded ? "responded" : "pending"}`}
                          >
                            {guest.hasResponded ? "Responded" : "Pending"}
                          </span>
                        </td>
                        <td>
                          <div className="guest-link-actions">
                            <button
                              className="copy-link-btn"
                              onClick={() => {
                                const link = `${window.location.origin}/guest/${guest.id}`;
                                navigator.clipboard.writeText(link);
                              }}
                              title="Copy guest link"
                            >
                              <i className="fas fa-copy"></i>
                              Copy Link
                            </button>
                            <button
                              className="open-guest-page-btn"
                              onClick={() => {
                                window.open(`/guest/${guest.id}`, "_blank");
                              }}
                              title={`Open guest ${guest.id} page`}
                            >
                              <i className="fas fa-external-link-alt"></i>
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            className="delete-guest-btn"
                            title="Delete guest"
                            onClick={() => handleDeleteGuest(guest)}
                            disabled={editingGuestId !== null}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Host Availability Section */}
      <section className="host-availability">
        {/* Host Name Display/Edit */}
        {hostGuestId && (
          <div className="host-info">
            {isEditingHostName ? (
              <form className="host-name-form" onSubmit={handleHostNameSubmit}>
                <div className="name-input-group">
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="Enter your name"
                    className="name-input"
                    required
                    autoFocus
                  />
                  <button type="submit" className="name-submit-btn">
                    <i className="fas fa-check"></i>
                  </button>
                  <button
                    type="button"
                    className="name-cancel-btn"
                    onClick={() => setIsEditingHostName(false)}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </form>
            ) : (
              <div className="host-name-display">
                <p className="host-name">
                  {hostName ? (
                    <>
                      Name: <strong>{hostName}</strong>
                      <button
                        className="edit-name-btn"
                        onClick={() => setIsEditingHostName(true)}
                        title="Edit your name"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="no-name">No name set</span>
                      <button
                        className="add-name-btn"
                        onClick={() => setIsEditingHostName(true)}
                        title="Add your name"
                      >
                        <i className="fas fa-plus"></i>
                        Add Name
                      </button>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="host-guest-info">
              <div className="host-guest-id">
                <strong>Your Guest ID:</strong>
                <code className="guest-id-code">{hostGuestId}</code>
                <a
                  href={`/guest/${hostGuestId}`}
                  className="guest-link-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View as Guest →
                </a>
              </div>
            </div>
          </div>
        )}
        <Calendar
          selectedDates={hostSelectedDates}
          availabilityHeatmap={availabilityHeatmap}
          onDateToggle={handleHostDateToggle}
          respondedGuests={respondedGuests}
          totalGuests={totalGuests}
          isNotAvailable={isHostNotAvailable}
          onNotAvailableToggle={handleHostNotAvailable}
          showHostLegend={false}
          hasSubmittedAvailability={
            hostSelectedDates.length > 0 || isHostNotAvailable
          }
          isHostView={true}
          guests={allGuestData.map(guest => ({
            id: guest.id,
            name: guest.name,
            isHost: guest.id === hostGuestId,
            hasResponded: Boolean(guest.hasResponded && guest.availability?.length > 0)
          }))}
          selectedGuestIds={selectedGuestIds}
          onGuestSelectionChange={setSelectedGuestIds}
          activeUserId={hostGuestId || undefined}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
        />
      </section>
    </div>
  );
}
