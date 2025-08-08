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
    hostName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim() || !formData.hostName.trim()) return;

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

  const isFormValid = formData.name.trim() && formData.description.trim() && formData.hostName.trim();

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
          <label htmlFor="hostName" className="form-label">
            <i className="fas fa-user"></i>
            Your Name *
          </label>
          <input
            type="text"
            id="hostName"
            name="hostName"
            value={formData.hostName}
            onChange={handleInputChange}
            placeholder="John Smith"
            maxLength={100}
            required
            className="form-input"
            disabled={isSubmitting}
          />
        </div>

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
