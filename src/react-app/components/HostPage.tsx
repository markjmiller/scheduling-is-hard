import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Calendar from './Calendar.tsx';
import { ApiService } from '../services/api';
import '../css/HostPage.css';
import type { components } from '../../../types/api';

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
    name: '',
    description: '',
    expectedAttendees: 1 as number | 'unknown'
  });

  // Guest management state
  const [guests, setGuests] = useState<ExtendedGuest[]>([]);
  const [newGuestName, setNewGuestName] = useState('');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Host availability state (host is also a participant)
  const [hostSelectedDates, setHostSelectedDates] = useState<string[]>([]);
  const [isHostNotAvailable, setIsHostNotAvailable] = useState(false);
  const [hostGuestId, setHostGuestId] = useState<string | null>(null);

  // Mutual calendar state
  const [availabilityHeatmap, setAvailabilityHeatmap] = useState<Map<string, number>>(new Map());
  const [totalGuests, setTotalGuests] = useState(0);
  const [respondedGuests, setRespondedGuests] = useState(0);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEventData();
  }, [eventId]);

  // Real-time polling for availability updates
  useEffect(() => {
    if (!eventId) return;

    const pollAvailability = async () => {
      try {
        // Only poll availability data, not the full event
        const heatmapData = await ApiService.getEventAvailability(eventId);
        setAvailabilityHeatmap(new Map(Object.entries(heatmapData.heatmap)));
        setTotalGuests(heatmapData.totalGuests);
        setRespondedGuests(heatmapData.respondedGuests);
      } catch (err) {
        // Silently fail to avoid disrupting UX with polling errors
        console.warn('Failed to poll availability updates:', err);
      }
    };

    // Start polling every 10 seconds for real-time updates
    const pollInterval = setInterval(pollAvailability, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [eventId]);

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
        expectedAttendees: eventData.expectedAttendees || 1
      });
      
      // Set host guest ID for availability participation
      if (eventData.hostGuestId) {
        setHostGuestId(eventData.hostGuestId);
      }

      // Load availability heatmap
      const heatmapData = await ApiService.getEventAvailability(eventId);
      setAvailabilityHeatmap(new Map(Object.entries(heatmapData.heatmap)));
      setRespondedGuests(heatmapData.respondedGuests);
      setTotalGuests(heatmapData.totalGuests);
      
      // Load host's existing availability if hostGuestId is available
      if (eventData.hostGuestId) {
        try {
          const hostGuestData = await ApiService.getGuest(eventId, eventData.hostGuestId);
          if (hostGuestData?.availability) {
            setHostSelectedDates(hostGuestData.availability);
          }
        } catch (error) {
          console.error('Error loading host availability:', error);
        }
      }
      
      setLoading(false);

    } catch (err) {
      setError('Failed to load event data');
      console.error('Error loading event data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEventFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEventForm(prev => ({
      ...prev,
      [name]: name === 'expectedAttendees' ? parseInt(value) || 1 : value
    }));
  };

  const handleEventFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !eventForm.name.trim() || !eventForm.description.trim()) return;

    try {
      // TODO: Update event via API when implemented
      setIsEditingEvent(false);
      console.log('Event updated:', eventForm);
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const handleGenerateGuestLink = async () => {
    if (!eventId || isGeneratingLink) return;

    try {
      setIsGeneratingLink(true);
      const guestLink = await ApiService.generateGuestLink(eventId, newGuestName.trim() || undefined);
      
      // Add to guests list
      const newGuest: ExtendedGuest = {
        id: guestLink.guestId,
        eventId: eventId,
        name: newGuestName.trim() || undefined,
        hasResponded: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      setGuests(prev => [...prev, newGuest]);
      setNewGuestName('');

      // Show success message with link
      const fullLink = `${window.location.origin}/event/${eventId}/guest/${guestLink.guestId}`;
      navigator.clipboard.writeText(fullLink).then(() => {
        console.log('Guest link copied to clipboard:', fullLink);
      });

    } catch (error) {
      console.error('Error generating guest link:', error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleHostDateToggle = async (date: string) => {
    if (!eventId || !hostGuestId) return;

    const newSelectedDates = hostSelectedDates.includes(date)
      ? hostSelectedDates.filter(d => d !== date)
      : [...hostSelectedDates, date];

    setHostSelectedDates(newSelectedDates);

    try {
      await ApiService.updateGuestAvailability(eventId, hostGuestId, newSelectedDates);
      
      // Refresh heatmap data
      const heatmapData = await ApiService.getEventAvailability(eventId);
      setAvailabilityHeatmap(new Map(Object.entries(heatmapData.heatmap)));
      setRespondedGuests(heatmapData.respondedGuests);
    } catch (error) {
      console.error('Error updating host availability:', error);
      // Revert on error
      setHostSelectedDates(hostSelectedDates);
    }
  };

  const handleHostNotAvailable = async () => {
    if (!eventId) return;
    
    try {
      setIsHostNotAvailable(!isHostNotAvailable);
      
      if (!isHostNotAvailable) {
        // Host indicating not available - clear all selected dates
        setHostSelectedDates([]);
        console.log('Host indicated not available - response recorded');
      }
    } catch (error) {
      console.error('Error updating host not available status:', error);
      setIsHostNotAvailable(false);
    }
  };

  if (loading) {
    return (
      <div className="host-page">
        <div className="loading">
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
        <div className="error">
          <i className="fas fa-calendar-times"></i>
          <h2>Event Not Found</h2>
          <p>The event you're looking for doesn't exist or you don't have permission to access it.</p>
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
            <div className="form-group">
              <label htmlFor="expectedAttendees">Expected Attendees:</label>
              <input
                type="number"
                name="expectedAttendees"
                value={eventForm.expectedAttendees}
                onChange={handleEventFormChange}
                min="1"
                className="expected-attendees-input"
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
          <div className="event-info">
            <div className="event-details">
              <h1>{event.name}</h1>
              <p>{event.description}</p>
              <div className="event-meta">
                <span>Expected Attendees: {event.expectedAttendees || 'Unknown'}</span>
                <span>Event ID: {event.id}</span>
              </div>
            </div>
            <button 
              className="edit-event-btn"
              onClick={() => setIsEditingEvent(true)}
              title="Edit event details"
            >
              <i className="fas fa-edit"></i>
              Edit Event
            </button>
          </div>
        )}
      </header>

      {/* Guest Management Section */}
      <section className="guest-management">
        <h2>
          <i className="fas fa-users"></i>
          Guest Management
        </h2>
        
        {/* Host Guest ID Display */}
        {hostGuestId && (
          <div className="host-guest-info">
            <div className="host-guest-id">
              <strong>Your Guest ID:</strong> 
              <code className="guest-id-code">{hostGuestId}</code>
              <a 
                href={`/event/${eventId}/guest/${hostGuestId}`} 
                className="guest-link-btn"
                target="_blank" 
                rel="noopener noreferrer"
              >
                View as Guest →
              </a>
            </div>
            <div className="host-guest-note">
              Use this link to access your availability as a regular participant
            </div>
          </div>
        )}

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
                  Generate Guest Link
                </>
              )}
            </button>
          </div>
          <p className="helper-text">
            Generate a unique link for each guest. The link will be automatically copied to your clipboard.
          </p>
        </div>

        {/* Guests Table */}
        <div className="guests-table">
          <h3>Invited Guests ({guests.length})</h3>
          {guests.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-user-plus"></i>
              <p>No guests invited yet. Generate a guest link to get started!</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Guest Link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id}>
                    <td>{guest.name || 'Unnamed Guest'}</td>
                    <td>
                      <span className={`status ${guest.hasResponded ? 'responded' : 'pending'}`}>
                        {guest.hasResponded ? 'Responded' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="copy-link-btn"
                        onClick={() => {
                          const link = `${window.location.origin}/event/${eventId}/guest/${guest.id}`;
                          navigator.clipboard.writeText(link);
                        }}
                        title="Copy guest link"
                      >
                        <i className="fas fa-copy"></i>
                        Copy Link
                      </button>
                    </td>
                    <td>
                      <div className="guest-actions">
                        <button className="edit-guest-btn" title="Edit guest">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="delete-guest-btn" title="Delete guest">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Host Availability Section */}
      <section className="host-availability">
        <h2>
          <i className="fas fa-calendar-check"></i>
          Your Availability
        </h2>
        <p>As the host, you can also indicate your availability for the event.</p>
        
        <Calendar
          selectedDates={hostSelectedDates}
          availabilityHeatmap={availabilityHeatmap}
          onDateToggle={handleHostDateToggle}
          respondedGuests={respondedGuests}
          totalGuests={totalGuests}
          isNotAvailable={isHostNotAvailable}
          onNotAvailableToggle={handleHostNotAvailable}
        />
      </section>
    </div>
  );
}
