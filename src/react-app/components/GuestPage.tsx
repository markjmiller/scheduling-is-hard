import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Calendar from './Calendar.tsx';
import { ApiService } from '../services/api';
import '../css/GuestPage.css';
import type { components } from '../../../types/api';

type Event = components["schemas"]["Event"];
type Guest = components["schemas"]["Guest"];

export default function GuestPage() {
  const { eventId, guestId } = useParams<{ eventId: string; guestId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [guestName, setGuestName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  // TODO: Add hasSubmittedName state to track if guest has already submitted their name
  // TODO: Once a guest submits a name, they cannot change it (only host can edit guest names)
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [availabilityHeatmap, setAvailabilityHeatmap] = useState<Map<string, number>>(new Map());
  const [totalGuests, setTotalGuests] = useState(0);
  const [respondedGuests, setRespondedGuests] = useState(0);
  const [isNotAvailable, setIsNotAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuestData();
  }, [eventId, guestId]);

  const loadGuestData = async () => {
    if (!eventId || !guestId) return;

    try {
      setLoading(true);
      // Load event and guest data in parallel
      const [eventData, guestData] = await Promise.all([
        ApiService.getEvent(eventId),
        ApiService.getGuest(eventId, guestId)
      ]);

      setEvent(eventData);
      setGuest(guestData);
      setGuestName(guestData.name || '');
      setIsEditingName(!guestData.name); // Edit name if not provided
      
      // Set initial selected dates from guest availability
      if (guestData.availability) {
        setSelectedDates(guestData.availability);
      }

      // Load availability heatmap
      const heatmapData = await ApiService.getEventAvailability(eventId);
      setAvailabilityHeatmap(new Map(Object.entries(heatmapData.heatmap)));
      setTotalGuests(heatmapData.totalGuests);
      setRespondedGuests(heatmapData.respondedGuests);

    } catch (err) {
      setError('Failed to load event data');
      console.error('Error loading guest data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    if (!guestName.trim() || !eventId || !guestId) return;

    try {
      await ApiService.updateGuestName(eventId, guestId, guestName.trim());
      setIsEditingName(false);
    } catch (error) {
      console.error('Error toggling date:', error);
    }
  };

  const handleNotAvailable = async () => {
    if (!eventId || !guestId) return;
    
    try {
      setIsNotAvailable(!isNotAvailable);
      
      if (!isNotAvailable) {
        // User is indicating they're not available - clear all selected dates
        setSelectedDates([]);
        await ApiService.updateGuestAvailability(eventId, guestId, []);
        
        // Record this as a response (even though no dates selected)
        console.log('Guest indicated not available - response recorded');
      }
    } catch (error) {
      console.error('Error updating not available status:', error);
      setIsNotAvailable(false);
    }
  };

  const handleDateToggle = async (date: string) => {
    if (!eventId || !guestId) return;

    const newSelectedDates = selectedDates.includes(date)
      ? selectedDates.filter(d => d !== date)
      : [...selectedDates, date];

    setSelectedDates(newSelectedDates);

    // Live update to server
    try {
      await ApiService.updateGuestAvailability(eventId, guestId, newSelectedDates);
      // Refresh heatmap data after update
      const heatmapData = await ApiService.getEventAvailability(eventId);
      setAvailabilityHeatmap(new Map(Object.entries(heatmapData.heatmap)));
      setRespondedGuests(heatmapData.respondedGuests);
    } catch (err) {
      console.error('Error updating availability:', err);
      // Revert the change on error
      setSelectedDates(selectedDates);
    }
  };

  if (loading) {
    return (
      <div className="guest-page">
        <div className="loading">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading event...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="guest-page">
        <div className="error">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="guest-page">
        <div className="error">
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
        <div className="event-info">
          <h1>{event.name}</h1>
          <p>{event.description}</p>
        </div>

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
            <p className="name-help">Please enter your name to continue</p>
          </form>
        ) : (
          <div className="guest-info">
            <p className="guest-name">
              Welcome, <strong>{guestName}</strong>!
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
      </header>

      <main className="guest-main">
        <div className="availability-section">
          <h2>Select Your Available Days</h2>
          <p className="calendar-instructions">
            Click or tap on the days you're available. Your selections are automatically saved.
          </p>
          
          <Calendar
            selectedDates={selectedDates}
            availabilityHeatmap={availabilityHeatmap}
            onDateToggle={handleDateToggle}
            respondedGuests={respondedGuests}
            totalGuests={totalGuests}
            isNotAvailable={isNotAvailable}
            onNotAvailableToggle={handleNotAvailable}
          />
          

        </div>


      </main>
    </div>
  );
}
