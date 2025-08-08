import { useState } from 'react';
import '../css/Calendar.css';

interface CalendarProps {
  selectedDates: string[];
  availabilityHeatmap: Map<string, number>;
  onDateToggle: (date: string) => void;
  respondedGuests?: number;
  totalGuests?: number;
  isNotAvailable?: boolean;
  onNotAvailableToggle?: () => void;
  showHostLegend?: boolean;
}

export default function Calendar({ selectedDates, availabilityHeatmap, onDateToggle, respondedGuests, totalGuests, isNotAvailable, onNotAvailableToggle, showHostLegend = true }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Constants
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Utility functions (defined early to avoid hoisting issues)
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const isPastDate = (date: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObj = new Date(date);
    return dateObj < today;
  };

  // Calendar date calculations
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

  // Generate array of dates for the current month
  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return formatDate(date);
  });

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };



  // Availability calculation functions
  const getAvailabilityLevel = (date: string): number => {
    return availabilityHeatmap.get(date) || 0;
  };

  const getGuestCountForDate = (date: string): number => {
    const level = availabilityHeatmap.get(date) || 0;
    const actualResponders = respondedGuests || 1;
    return Math.round(level * actualResponders);
  };

  const getAvailabilityClass = (availabilityLevel: number): string => {
    if (availabilityLevel === 0) return 'availability-none';
    if (availabilityLevel <= 0.25) return 'availability-low';
    if (availabilityLevel <= 0.5) return 'availability-medium';
    if (availabilityLevel <= 0.75) return 'availability-high';
    return 'availability-very-high';
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="dual-calendar-container">
      {/* Availability Calendar */}
      <div className="calendar availability-calendar">
        <div className="calendar-title">
          <h4 style={{ marginBottom: 0 }}><i className="fas fa-user-check"></i> Your Availability</h4>
        </div>
        <div className="calendar-header">
          <button 
            className="nav-btn" 
            onClick={goToPreviousMonth}
            title="Previous month"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          
          <h3 className="month-year">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          
          <button 
            className="nav-btn" 
            onClick={goToNextMonth}
            title="Next month"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>

        <div className="calendar-controls">
          <button 
            className="today-btn" 
            onClick={goToToday}
          >
            Today
          </button>
        </div>
        <div className="calendar-grid">
          {/* Day headers */}
          {dayNames.map(day => (
            <div key={day} className="day-header">
              {day}
            </div>
          ))}

          {/* Empty cells for days before the first day of the month */}
          {Array.from({ length: startingDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty"></div>
          ))}

          {/* Calendar days - simplified for selection only */}
          {dates.map((date, index) => {
            const dayOfMonth = index + 1;
            const isSelected = selectedDates.includes(date);
            const isPast = isPastDate(date);
            const isToday = date === formatDate(new Date());

            return (
              <button
                key={date}
                className={`calendar-day ${isSelected ? 'selected' : ''} ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => !isPast && onDateToggle(date)}
                disabled={isPast}
                title={
                  isPast 
                    ? 'Past date' 
                    : `${isSelected ? 'Remove from' : 'Add to'} your availability`
                }
              >
                <span className="day-number">{dayOfMonth}</span>
                {isSelected && (
                  <i className="fas fa-check selected-icon"></i>
                )}
              </button>
            );
          })}
        </div>

        <div className="calendar-footer">
          <div className="selection-summary">
            <i className="fas fa-calendar-check"></i>
            <span>
              {selectedDates.length} day{selectedDates.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
      </div>

      {/* Not Available Section */}
      {onNotAvailableToggle && (
        <div className="not-available-section">
          <button 
            className={`not-available-btn ${isNotAvailable ? 'active' : ''}`}
            onClick={onNotAvailableToggle}
            disabled={isNotAvailable}
          >
            <i className="fas fa-times-circle"></i>
            I am not available for any dates
          </button>
        </div>
      )}

      {/* Mutual Calendar */}
      <div className="calendar mutual-calendar">
        <div className="calendar-title">
          <h4><i className="fas fa-chart-bar"></i> Mutual Calendar</h4>
          {respondedGuests !== undefined && (
            <div className="response-stats-inline">
              <div className="stat-inline">
                <i className="fas fa-users"></i>
                <span className="stat-text">
                  {totalGuests !== undefined && totalGuests >= 0 
                    ? `${respondedGuests} of ${totalGuests} (expected) responded`
                    : `${respondedGuests} responded`
                  }
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="calendar-grid">
          {/* Day headers */}
          {dayNames.map(day => (
            <div key={day} className="day-header">
              {day}
            </div>
          ))}

          {/* Empty cells for days before the first day of the month */}
          {Array.from({ length: startingDayOfWeek }, (_, i) => (
            <div key={`empty-heatmap-${i}`} className="calendar-day empty"></div>
          ))}

          {/* Calendar days - heatmap style */}
          {dates.map((date, index) => {
            const dayOfMonth = index + 1;
            const availabilityLevel = getAvailabilityLevel(date);
            const availabilityClass = getAvailabilityClass(availabilityLevel);
            const isPast = isPastDate(date);
            const isToday = date === formatDate(new Date());
            const isHostAvailable = selectedDates.includes(date);
            const is100Percent = availabilityLevel === 1.0;

            return (
              <div
                key={`heatmap-${date}`}
                className={`calendar-day heatmap-day ${availabilityClass} ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}`}
                title={
                  isPast 
                    ? 'Past date' 
                    : `${getGuestCountForDate(date)} of ${respondedGuests || 'unknown'} guests available${isHostAvailable ? ' (Host available)' : ''}${is100Percent ? ' - 100% available!' : ''}`
                }
              >
                <span className="day-number">{dayOfMonth}</span>
                {availabilityLevel > 0 && (
                  <span className="availability-fraction">
                    {getGuestCountForDate(date)}/{respondedGuests || '?'}
                  </span>
                )}
                
                {/* Host availability and 100% indicators */}
                <div className="date-indicators">
                  {isHostAvailable && !isPast && !is100Percent && (
                    <i className="fas fa-user host-available-icon" title="Host is available"></i>
                  )}
                  {is100Percent && availabilityLevel > 0 && !isPast && (
                    <i className="fas fa-star perfect-availability-icon" title="100% availability!"></i>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Icons Legend */}
        <div className="mutual-calendar-legend">
          <div className="legend-items">
            {showHostLegend && (
              <div className="legend-item">
                <div className="legend-icon-demo">
                  <i className="fas fa-user host-available-icon"></i>
                </div>
                <span className="legend-text">Host is available</span>
              </div>
            )}
            <div className="legend-item">
              <div className="legend-icon-demo">
                <i className="fas fa-star perfect-availability-icon"></i>
              </div>
              <span className="legend-text">100% availability</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
