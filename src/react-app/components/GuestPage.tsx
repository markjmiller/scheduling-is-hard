import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Calendar from './Calendar.tsx';
import { ApiService } from '../services/api';
import '../css/GuestPage.css';
import type { components } from '../../../types/api';

type Event = components["schemas"]["Event"];
type Guest = components["schemas"]["Guest"];

export default function GuestPage() {
  const { guestId } = useParams<{ guestId: string }>();
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [, setGuest] = useState<Guest | null>(null);
  const [guestName, setGuestName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [availabilityHeatmap, setAvailabilityHeatmap] = useState<Map<string, number>>(new Map());
  const [totalGuests, setTotalGuests] = useState(0);
  const [respondedGuests, setRespondedGuests] = useState(0);
  const [isNotAvailable, setIsNotAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuestData();
  }, [guestId]);

  // Real-time polling for mutual calendar updates
  useEffect(() => {
    if (!eventId) return;

    const pollAvailability = async () => {
      try {
        // Poll mutual calendar updates
        const heatmapData = await ApiService.getEventAvailability(eventId);
        setAvailabilityHeatmap(new Map(Object.entries(heatmapData.heatmap)));
        setTotalGuests(heatmapData.totalGuests);
        setRespondedGuests(heatmapData.respondedGuests);
        
        // Poll user's own availability calendar to sync across sessions
        if (guestId) {
          const guestData = await ApiService.getGuest(guestId);
          if (guestData?.availability) {
            setSelectedDates(guestData.availability);
          }
        }
      } catch (err) {
        // Silently fail to avoid disrupting UX with polling errors
        console.warn('Failed to poll availability updates:', err);
      }
    };

    // Start polling every 10 seconds for real-time mutual calendar updates
    const pollInterval = setInterval(pollAvailability, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [eventId, guestId]);

  const loadGuestData = async () => {
    if (!guestId) return;

    try {
      setLoading(true);
      
      // First, get guest data which contains the eventId
      const guestData = await ApiService.getGuest(guestId);
      if (!guestData || !guestData.eventId) {
        throw new Error('Guest not found or missing event information');
      }
      
      // Store eventId from guest data
      setEventId(guestData.eventId);
      setGuest(guestData);
      setGuestName(guestData.name || '');
      setIsEditingName(!guestData.name); // Edit name if not provided
      
      // Set initial selected dates from guest availability
      if (guestData.availability) {
        setSelectedDates(guestData.availability);
      }

      // Now load event data and heatmap using the eventId from guest data
      const [eventData, heatmapData] = await Promise.all([
        ApiService.getEvent(guestData.eventId),
        ApiService.getEventAvailability(guestData.eventId)
      ]);
      
      setEvent(eventData);
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
    e.preventDefault();
    if (!guestName.trim() || !eventId || !guestId) return;

    try {
      await ApiService.updateGuestName(guestId, guestName.trim());
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating guest name:', error);
    }
  };

  const handleNotAvailable = async () => {
    if (!eventId || !guestId) return;
    
    try {
      setIsNotAvailable(!isNotAvailable);
      
      if (!isNotAvailable) {
        // User is indicating they're not available - clear all selected dates
        setSelectedDates([]);
        await ApiService.updateGuestAvailability(guestId, []);
        
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
      await ApiService.updateGuestAvailability(guestId, newSelectedDates);
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
