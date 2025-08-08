import { useState } from 'react';
import '../css/Calendar.css';

interface CalendarProps {
  selectedDates: string[];
  availabilityHeatmap: Map<string, number>;
  onDateToggle: (date: string) => void;
}

export default function Calendar({ selectedDates, availabilityHeatmap, onDateToggle }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get the first day of the month and how many days it has
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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  function goToPreviousMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  }

  function goToToday() {
    setCurrentMonth(new Date());
  }

  function getAvailabilityLevel(date: string): number {
    return availabilityHeatmap.get(date) || 0;
  }

  function getAvailabilityClass(availabilityLevel: number): string {
    if (availabilityLevel === 0) return 'availability-none';
    if (availabilityLevel <= 0.25) return 'availability-low';
    if (availabilityLevel <= 0.5) return 'availability-medium';
    if (availabilityLevel <= 0.75) return 'availability-high';
    return 'availability-very-high';
  }

  function isPastDate(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObj = new Date(date);
    return dateObj < today;
  }

  return (
    <div className="calendar">
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

        {/* Calendar days */}
        {dates.map((date, index) => {
          const dayOfMonth = index + 1;
          const isSelected = selectedDates.includes(date);
          const availabilityLevel = getAvailabilityLevel(date);
          const availabilityClass = getAvailabilityClass(availabilityLevel);
          const isPast = isPastDate(date);
          const isToday = date === formatDate(new Date());

          return (
            <button
              key={date}
              className={`calendar-day ${isSelected ? 'selected' : ''} ${availabilityClass} ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => !isPast && onDateToggle(date)}
              disabled={isPast}
              title={
                isPast 
                  ? 'Past date' 
                  : `${isSelected ? 'Remove from' : 'Add to'} your availability (${Math.round(availabilityLevel * 100)}% available)`
              }
            >
              <span className="day-number">{dayOfMonth}</span>
              {isSelected && (
                <i className="fas fa-check selected-icon"></i>
              )}
              {availabilityLevel > 0 && (
                <div 
                  className="availability-indicator"
                  style={{ opacity: availabilityLevel }}
                ></div>
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
  );
}
