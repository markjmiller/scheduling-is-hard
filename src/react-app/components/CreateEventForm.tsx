import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService } from '../services/api';
import type { components } from '../../../types/api';

type CreateEventRequest = components["schemas"]["CreateEventRequest"];

export default function CreateEventForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CreateEventRequest>({
    name: '',
    description: '',
    expectedAttendees: 1,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnknownAttendees, setIsUnknownAttendees] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'expectedAttendees' && !isUnknownAttendees ? parseInt(value) || 1 : value,
    }));
  };

  const handleAttendeesToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsUnknownAttendees(checked);
    setFormData(prev => ({
      ...prev,
      expectedAttendees: checked ? 'unknown' : 1,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) return;

    setIsSubmitting(true);
    try {
      const event = await ApiService.createEvent(formData);
      // Navigate directly to the host screen for the created event
      navigate(`/event/${event.id}`);
    } catch (error) {
      console.error('Failed to create event:', error);
      // In a real app, show error notification
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.name.trim() && formData.description.trim();

  return (
    <div className="create-event-form">
      <div className="form-header">
        <h2>Create New Event</h2>
        <p className="form-description">
          Get started by creating an event to coordinate availability with your guests.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="event-form">
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            <i className="fas fa-calendar-alt"></i>
            Event Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Team Planning Meeting"
            maxLength={200}
            required
            className="form-input"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            <i className="fas fa-align-left"></i>
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Let's coordinate our availability for the quarterly planning session..."
            maxLength={2000}
            rows={4}
            required
            className="form-textarea"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            <i className="fas fa-users"></i>
            Expected Attendees
          </label>
          
          <div className="attendees-control">
            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                id="unknown-attendees"
                checked={isUnknownAttendees}
                onChange={handleAttendeesToggle}
                disabled={isSubmitting}
              />
              <label htmlFor="unknown-attendees">
                Unknown number of attendees
              </label>
            </div>
            
            {!isUnknownAttendees && (
              <div className="number-input-wrapper">
                <input
                  type="number"
                  name="expectedAttendees"
                  value={formData.expectedAttendees as number}
                  onChange={handleInputChange}
                  min={1}
                  max={100}
                  className="form-input number-input"
                  disabled={isSubmitting}
                />
                <span className="input-hint">Including yourself as the host</span>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="create-button"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Creating Event...
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i>
                Create Event
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
