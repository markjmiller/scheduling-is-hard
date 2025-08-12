import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import Calendar from "./Calendar.tsx";
import { ApiService } from "../services/api";
import { POLLING_INTERVALS } from "../config/polling";
import "../css/GuestPage.css";
import type { components } from "../../../types/api";

type Event = components["schemas"]["Event"];
type Guest = components["schemas"]["Guest"];

export default function GuestPage() {
  const { guestId } = useParams<{ guestId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [, setGuest] = useState<Guest | null>(null);
  const [guestName, setGuestName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [availabilityHeatmap, setAvailabilityHeatmap] = useState<
    Map<string, number>
  >(new Map());
  const [totalGuests, setTotalGuests] = useState(0);
  const [respondedGuests, setRespondedGuests] = useState(0);
  const [isNotAvailable, setIsNotAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hostAvailability, setHostAvailability] = useState<string[]>([]);

  // Guest filter state
  const [allGuestData, setAllGuestData] = useState<any[]>([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  
  // Shared month state for synchronized calendar navigation
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [hasInitializedMonth, setHasInitializedMonth] = useState<boolean>(false);
  
  // Debouncing for API calls
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDatesRef = useRef<string[]>([]);

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
    if (!hasInitializedMonth && hostAvailability.length > 0) {
      // Find the earliest date from host availability
      const sortedDates = [...hostAvailability].sort();
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
  }, [hostAvailability, hasInitializedMonth]);



  // Helper function to extract host availability
  const extractHostAvailability = (guests: any[]) => {
    const host = guests.find((guest) => guest.isHost);
    return host?.availability || [];
  };

  useEffect(() => {
    loadGuestData();
  }, [guestId]);

  // Real-time  // Poll interval ref for resetting when user interacts with calendar
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset polling interval when user changes availability
  const resetPollInterval = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    const pollAvailability = async () => {
      try {
        // Poll event details and mutual calendar updates
        const eventData = await ApiService.getEventForGuest(guestId!);

        if (!eventData) {
          setError("EVENT_NOT_FOUND");
          return;
        }

        // Update event information
        setEvent({
          id: "", // We don't have eventId in the response, which is intentional for security
          name: eventData.name,
          description: eventData.description,
          hostGuestId: "",
          createdAt: "",
          updatedAt: "",
        });

        // Store all guest data for filtering and update heatmap
        setAllGuestData(eventData.guests);
        // Initialize with all guests selected ONLY if no selection exists yet
        const allGuestIds = eventData.guests.map((guest: any) => guest.id);
        setSelectedGuestIds(prev => {
          const guestIds = prev.length === 0 ? allGuestIds : prev;
          setAvailabilityHeatmap(createHeatmapFromGuests(eventData.guests, guestIds));
          return guestIds;
        });
        setTotalGuests(eventData.totalGuests);
        setRespondedGuests(eventData.respondedGuests);

        // Extract and set host availability
        setHostAvailability(extractHostAvailability(eventData.guests));

        // Poll user's own availability calendar to sync across sessions
        if (guestId) {
          const guestData = await ApiService.getGuest(guestId);
          if (guestData?.availability) {
            setSelectedDates(guestData.availability);
          }
        }
      } catch (err) {
        // Silently fail to avoid disrupting UX with polling errors
        console.warn("Failed to poll updates:", err);
      }
    };

    // Start polling for real-time mutual calendar updates
    pollIntervalRef.current = setInterval(
      pollAvailability,
      POLLING_INTERVALS.GUEST_PAGE.EVENT_AND_AVAILABILITY,
    );
  }, [guestId]);

  // Poll for real-time availability updates
  useEffect(() => {
    if (!guestId) return;

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
  }, [guestId, resetPollInterval]);

  const loadGuestData = async () => {
    if (!guestId) return;

    try {
      setLoading(true);

      const guestData = await ApiService.getGuest(guestId);
      if (!guestData) {
        setError("GUEST_NOT_FOUND");
        return;
      }

      setGuest(guestData);
      setGuestName(guestData.name || "");
      setIsEditingName(!guestData.name); // Edit name if not provided

      // Set initial selected dates from guest availability
      if (guestData.availability) {
        setSelectedDates(guestData.availability);
      }

      // Now load event and availability data
      const eventData = await ApiService.getEventForGuest(guestId);

      if (!eventData) {
        setError("EVENT_NOT_FOUND");
        return;
      }

      // Set event information
      setEvent({
        id: "", // We don't have eventId in the response, which is intentional for security
        name: eventData.name,
        description: eventData.description,
        hostGuestId: "",
        createdAt: "",
        updatedAt: "",
      });

      // Store all guest data for filtering and preserve existing selections
      setAllGuestData(eventData.guests);
      setSelectedGuestIds(prev => {
        const guestIds = prev.length === 0 ? eventData.guests.map((guest: any) => guest.id) : prev;
        setAvailabilityHeatmap(createHeatmapFromGuests(eventData.guests, guestIds));
        return guestIds;
      });
      setTotalGuests(eventData.totalGuests);
      setRespondedGuests(eventData.respondedGuests);

      // Extract and set host availability
      setHostAvailability(extractHostAvailability(eventData.guests));
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message.includes("404") || err.message.includes("Not Found"))
      ) {
        setError("GUEST_NOT_FOUND");
      } else {
        setError("FAILED_TO_LOAD");
      }
      console.error("Error loading guest data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestId) return;

    try {
      await ApiService.updateGuestName(guestId, guestName.trim());
      setIsEditingName(false);
    } catch (error) {
      console.error("Error updating guest name:", error);
    }
  };

  const handleNotAvailable = async () => {
    if (!guestId) return;

    try {
      const newNotAvailableState = !isNotAvailable;
      setIsNotAvailable(newNotAvailableState);

      if (newNotAvailableState) {
        // User is indicating they're not available - clear all selected dates
        setSelectedDates([]);

        // Reset poll interval to prevent server from overwriting user input
        resetPollInterval();

        await ApiService.updateGuestAvailability(guestId, []);
      }
    } catch (error) {
      console.error("Error updating not available status:", error);
      setIsNotAvailable(false);
    }
  };

  // Debounced API update function
  const performDebouncedUpdate = useCallback(async (targetDates: string[]) => {
    if (!guestId) return;

    try {
      await ApiService.updateGuestAvailability(guestId, targetDates);
      // Refresh heatmap data after update
      const heatmapData = await ApiService.getEventForGuest(guestId);
      setAllGuestData(heatmapData.guests);
      setSelectedGuestIds(prev => {
        const guestIds = prev.length === 0 ? heatmapData.guests.map((guest: any) => guest.id) : prev;
        setAvailabilityHeatmap(createHeatmapFromGuests(heatmapData.guests, guestIds));
        return guestIds;
      });
      setRespondedGuests(heatmapData.respondedGuests);

      // Update host availability
      setHostAvailability(extractHostAvailability(heatmapData.guests));
    } catch (err) {
      console.error("Error updating availability:", err);
      // Revert to previous state on error
      setSelectedDates(pendingDatesRef.current);
    }
  }, [guestId, setAllGuestData, setSelectedGuestIds, setAvailabilityHeatmap, setRespondedGuests, setHostAvailability, extractHostAvailability, createHeatmapFromGuests]);

  const handleDateToggle = useCallback((date: string) => {
    if (!guestId) return;

    const newSelectedDates = selectedDates.includes(date)
      ? selectedDates.filter((d) => d !== date)
      : [...selectedDates, date];

    // Immediate UI update for responsiveness
    setSelectedDates(newSelectedDates);
    pendingDatesRef.current = selectedDates; // Store previous state for potential rollback

    // Reset poll interval to prevent server from overwriting user input
    resetPollInterval();

    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounced API call
    debounceTimeoutRef.current = setTimeout(() => {
      performDebouncedUpdate(newSelectedDates);
    }, 300); // 300ms debounce delay
  }, [guestId, selectedDates, resetPollInterval, performDebouncedUpdate]);

  if (loading) {
    return (
      <div className="guest-page">
        <div className="guest-loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading event...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guest-page">
        <div className="guest-error">
          {error === "GUEST_NOT_FOUND" ? (
            <>
              <i className="fas fa-user-slash"></i>
              <h2>Guest Link Not Found</h2>
              <p style={{ textWrap: "wrap" }}>
                This guest invitation link is invalid or may have been deleted.
                Please check the link or contact the event organizer for a new
                invitation.
              </p>
            </>
          ) : (
            <>
              <i className="fas fa-exclamation-triangle"></i>
              <h2>Failed to Load Event</h2>
              <p>
                We encountered an error loading the event data. Please try
                refreshing the page or contact support if the issue persists.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="guest-page">
        <div className="guest-error">
          <i className="fas fa-calendar-times"></i>
          <h2>Event Not Found</h2>
          <p>The event you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-page">
      <header className="guest-header">
        {isEditingName ? (
          <form className="name-form" onSubmit={handleNameSubmit}>
            <div className="name-input-group">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your name"
                className="name-input"
                required
                autoFocus
              />
              <button type="submit" className="name-submit-btn">
                <i className="fas fa-check"></i>
              </button>
            </div>
            <p className="name-help">Guest Id: {guestId}</p>
          </form>
        ) : (
          <div className="guest-info">
            <p className="guest-name">
              Welcome, <strong>{guestName}</strong>
              <button
                className="edit-name-btn"
                onClick={() => setIsEditingName(true)}
                title="Edit name"
              >
                <i className="fas fa-edit"></i>
              </button>
            </p>
          </div>
        )}
        <div className="event-info">
          <h1>{event.name}</h1>
          <p>{event.description}</p>
        </div>
        <div className="event-link-warning">
          <i className="fas fa-exclamation-triangle"></i>
          <span>
            Your guest link can be edited by anyone with access. Treat it as a
            secret!
          </span>
        </div>
      </header>

      <main className="guest-main">
        <div className="availability-section">
          <h2>Select Your Available Days</h2>
          <p className="calendar-instructions">
            Click or tap on the days you're available. Your selections are
            automatically saved.
          </p>

          <Calendar
            selectedDates={selectedDates}
            availabilityHeatmap={availabilityHeatmap}
            onDateToggle={handleDateToggle}
            respondedGuests={respondedGuests}
            totalGuests={totalGuests}
            isNotAvailable={isNotAvailable}
            onNotAvailableToggle={handleNotAvailable}
            hasSubmittedAvailability={
              selectedDates.length > 0 || isNotAvailable
            }
            hostAvailability={hostAvailability}
            isHostView={false}
            guests={allGuestData.map(guest => ({
              id: guest.id,
              name: guest.name,
              isHost: Boolean(guest.isHost),
              hasResponded: Boolean(guest.hasResponded && guest.availability?.length > 0)
            }))}
            selectedGuestIds={selectedGuestIds}
            onGuestSelectionChange={setSelectedGuestIds}
            activeUserId={guestId || undefined}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
          />
        </div>
      </main>
    </div>
  );
}
