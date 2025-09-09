import { useState } from "react";
import GuestFilter from "./GuestFilter.tsx";
import "../css/Calendar.css";

interface GuestInfo {
  id: string;
  name?: string;
  isHost?: boolean;
  hasResponded?: boolean;
}

interface CalendarProps {
  selectedDates: string[];
  availabilityHeatmap: Map<string, number>;
  onDateToggle: (date: string) => void;
  respondedGuests?: number;
  totalGuests?: number;
  isNotAvailable?: boolean;
  onNotAvailableToggle?: () => void;
  showHostLegend?: boolean;
  hasSubmittedAvailability?: boolean;
  hostAvailability?: string[]; // Host's available dates for guest view
  isHostView?: boolean; // Whether this is the host's own calendar
  // Guest filter props
  guests?: GuestInfo[];
  selectedGuestIds?: string[];
  onGuestSelectionChange?: (selectedIds: string[]) => void;
  activeUserId?: string; // ID of the current user viewing the page
  // External month control props
  currentMonth?: Date;
  onMonthChange?: (month: Date) => void;
}

export default function Calendar({
  selectedDates,
  availabilityHeatmap,
  onDateToggle,
  respondedGuests,
  totalGuests,
  isNotAvailable,
  onNotAvailableToggle,
  showHostLegend = true,
  hasSubmittedAvailability,
  hostAvailability = [],
  isHostView = false,
  guests = [],
  selectedGuestIds = [],
  onGuestSelectionChange,
  activeUserId,
  currentMonth: externalCurrentMonth,
  onMonthChange,
}: CalendarProps) {
  // Smart calendar month initialization based on host's earliest available date
  const getInitialMonth = (): Date => {
    // Get host availability data based on view type
    const hostDates = isHostView ? selectedDates : hostAvailability;

    if (hostDates.length === 0) {
      // No host availability set, default to current month
      return new Date();
    }

    // Find the earliest date from host availability
    const sortedDates = [...hostDates].sort();
    const earliestDate = sortedDates[0];

    // Parse the date string (YYYY-MM-DD format)
    const dateParts = earliestDate.split("-");
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed

    // Return the first day of that month
    return new Date(year, month, 1);
  };

  // Use external month control if provided, otherwise use internal state
  const [internalCurrentMonth, setInternalCurrentMonth] =
    useState(getInitialMonth());
  const currentMonth = externalCurrentMonth || internalCurrentMonth;
  const setCurrentMonth = onMonthChange || setInternalCurrentMonth;

  // Constants
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Utility functions (defined early to avoid hoisting issues)
  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const isPastDate = (date: string): boolean => {
    const today = new Date();
    const todayStr = formatDate(today);
    return date < todayStr;
  };

  // Calendar date calculations
  const firstDayOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1,
  );
  const lastDayOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  );
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday

  // Generate array of dates for the current month
  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return formatDate(date);
  });

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Check if there are guest selections in previous/next months
  const hasGuestSelectionsInMonth = (year: number, month: number): boolean => {
    // Create date strings for all days in the target month
    const daysInTargetMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInTargetMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const guestCount = availabilityHeatmap.get(dateString) || 0;
      if (guestCount > 0) {
        return true;
      }
    }
    return false;
  };

  const hasSelectionInPreviousMonth = (): boolean => {
    const prevMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1,
    );
    return hasGuestSelectionsInMonth(
      prevMonth.getFullYear(),
      prevMonth.getMonth(),
    );
  };

  const hasSelectionInNextMonth = (): boolean => {
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1,
    );
    return hasGuestSelectionsInMonth(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
    );
  };

  // Availability calculation functions
  const getAvailabilityLevel = (date: string): number => {
    const rawCount = availabilityHeatmap.get(date) || 0;
    const totalResponders = respondedGuests || 1;
    // Normalize raw guest count to 0-1 range for color calculation
    return rawCount / totalResponders;
  };

  const getGuestCountForDate = (date: string): number => {
    // After API redesign, heatmap now contains raw guest counts instead of normalized 0-1 values
    return availabilityHeatmap.get(date) || 0;
  };

  const getAvailabilityClass = (availabilityLevel: number): string => {
    if (availabilityLevel === 0) return "availability-none";
    if (availabilityLevel <= 0.25) return "availability-low";
    if (availabilityLevel <= 0.5) return "availability-medium";
    if (availabilityLevel <= 0.75) return "availability-high";
    return "availability-very-high";
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="dual-calendar-container">
      {/* Availability Calendar */}
      <div className="calendar availability-calendar">
        <div className="calendar-title">
          <h4 style={{ marginBottom: 0 }}>
            <i
              className={
                hasSubmittedAvailability === false
                  ? "fas fa-user-times"
                  : "fas fa-user-check"
              }
            ></i>{" "}
            Your Availability
            {hasSubmittedAvailability === false && (
              <span
                style={{
                  backgroundColor: "#fff3cd",
                  color: "#856404",
                  border: "1px solid #ffeaa7",
                  borderRadius: "12px",
                  padding: "2px 8px",
                  fontSize: "0.75rem",
                  fontWeight: "500",
                  marginLeft: "8px",
                  display: "inline-block",
                }}
              >
                Not Submitted
              </span>
            )}
          </h4>
        </div>
        <div className="calendar-header">
          <button
            className="nav-btn"
            onClick={goToPreviousMonth}
            title="Previous month"
          >
            <i className="fas fa-chevron-left"></i>
            {hasSelectionInPreviousMonth() && (
              <span
                className="month-indicator"
                title="Guest selections in previous month"
              >
                •
              </span>
            )}
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
            {hasSelectionInNextMonth() && (
              <span
                className="month-indicator"
                title="Guest selections in next month"
              >
                •
              </span>
            )}
          </button>
        </div>

        <div className="calendar-controls">
          <button className="today-btn" onClick={goToToday}>
            Today
          </button>
        </div>
        <div className="calendar-grid">
          {/* Day headers */}
          {dayNames.map((day) => (
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
                className={`calendar-day ${isSelected ? "selected" : ""} ${isPast ? "past" : ""} ${isToday ? "today" : ""}`}
                onClick={() => !isPast && onDateToggle(date)}
                disabled={isPast}
                title={
                  isPast
                    ? "Past date"
                    : `${isSelected ? "Remove from" : "Add to"} your availability`
                }
              >
                <span className="day-number">{dayOfMonth}</span>
                {isSelected && <i className="fas fa-check selected-icon"></i>}
              </button>
            );
          })}
        </div>

        <div className="calendar-footer">
          <div className="selection-summary">
            <i className="fas fa-calendar-check"></i>
            <span>
              {selectedDates.length} day{selectedDates.length !== 1 ? "s" : ""}{" "}
              selected
            </span>
          </div>
        </div>
      </div>

      {/* Not Available Section */}
      {onNotAvailableToggle && (
        <div className="not-available-section">
          <button
            className={`not-available-btn ${isNotAvailable ? "active" : ""}`}
            onClick={onNotAvailableToggle}
            disabled={isNotAvailable}
          >
            <i className="fas fa-times-circle"></i>I am not available for any
            dates
          </button>
        </div>
      )}

      {/* Mutual Calendar */}
      <div className="calendar mutual-calendar">
        <div className="calendar-title">
          <h4>
            <i className="fas fa-chart-bar"></i> Mutual Calendar
          </h4>
          {respondedGuests !== undefined && (
            <div className="response-stats-inline">
              <div className="stat-inline">
                <i className="fas fa-users"></i>
                <span className="stat-text">
                  {totalGuests !== undefined && totalGuests >= 0
                    ? `${respondedGuests} of ${totalGuests} responses`
                    : `${respondedGuests} responded`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Guest Filter Section */}
        {onGuestSelectionChange && (
          <GuestFilter
            guests={guests}
            selectedGuestIds={selectedGuestIds}
            onGuestSelectionChange={onGuestSelectionChange}
            activeUserId={activeUserId}
          />
        )}

        {/* Month selector for mutual calendar */}
        <div className="calendar-header">
          <button
            className="nav-btn"
            onClick={goToPreviousMonth}
            title="Previous month"
          >
            <i className="fas fa-chevron-left"></i>
            {hasSelectionInPreviousMonth() && (
              <span
                className="month-indicator"
                title="Guest selections in previous month"
              >
                •
              </span>
            )}
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
            {hasSelectionInNextMonth() && (
              <span
                className="month-indicator"
                title="Guest selections in next month"
              >
                •
              </span>
            )}
          </button>
        </div>

        <div className="calendar-controls">
          <button className="today-btn" onClick={goToToday}>
            Today
          </button>
        </div>

        <div className="calendar-grid">
          {/* Day headers */}
          {dayNames.map((day) => (
            <div key={day} className="day-header">
              {day}
            </div>
          ))}

          {/* Empty cells for days before the first day of the month */}
          {Array.from({ length: startingDayOfWeek }, (_, i) => (
            <div
              key={`empty-heatmap-${i}`}
              className="calendar-day empty"
            ></div>
          ))}

          {/* Calendar days - heatmap style */}
          {dates.map((date, index) => {
            const dayOfMonth = index + 1;
            const availabilityLevel = getAvailabilityLevel(date);
            const availabilityClass = getAvailabilityClass(availabilityLevel);
            const isPast = isPastDate(date);
            const isToday = date === formatDate(new Date());
            // For guest views, check host availability from the provided hostAvailability array
            // For host views, don't show host icons (since they're editing their own availability)
            const isHostAvailable = isHostView
              ? false
              : hostAvailability.includes(date);
            const is100Percent = availabilityLevel === 1.0;

            return (
              <div
                key={`heatmap-${date}`}
                className={`calendar-day heatmap-day ${availabilityClass} ${isPast ? "past" : ""} ${isToday ? "today" : ""}`}
                title={
                  isPast
                    ? "Past date"
                    : `${getGuestCountForDate(date)} of ${respondedGuests || "unknown"} guests available${isHostAvailable ? " (Host available)" : ""}${is100Percent ? " - 100% available!" : ""}`
                }
              >
                <span className="day-number">{dayOfMonth}</span>
                {availabilityLevel > 0 && (
                  <span className="availability-count">
                    {getGuestCountForDate(date)}
                  </span>
                )}

                {/* Host availability and 100% indicators */}
                <div className="date-indicators">
                  {isHostAvailable &&
                    !isPast &&
                    !is100Percent &&
                    !isHostView && (
                      <i
                        className="fas fa-user host-available-icon"
                        title="Host is available"
                      ></i>
                    )}
                  {is100Percent && availabilityLevel > 0 && !isPast && (
                    <i
                      className="fas fa-star perfect-availability-icon"
                      title="100% availability!"
                    ></i>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Icons Legend */}
        <div className="mutual-calendar-legend">
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-icon-demo">
                <span className="count-demo">3</span>
              </div>
              <span className="legend-text">Number of guests available</span>
            </div>
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
              <span className="legend-text">
                100% availability for responses
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
