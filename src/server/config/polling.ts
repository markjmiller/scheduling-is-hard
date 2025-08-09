/**
 * Backend Polling Configuration
 *
 * This file contains all polling intervals used by the backend services.
 * Adjust these values to control how frequently the backend polls for updates.
 */

export const BACKEND_POLLING_INTERVALS = {
  /**
   * Event Durable Object Alarm Intervals
   */
  EVENT_DO: {
    // How often the Event DO alarm triggers to poll all Guest DOs
    // and update the aggregate availability heatmap
    AGGREGATE_AVAILABILITY_UPDATE: 1000, // 1 second

    // How often to retry when an alarm encounters an error
    ALARM_ERROR_RETRY: 10000, // 10 seconds (changed from 10s for better error handling)
  },

  /**
   * Event Creation Intervals
   */
  EVENT_CREATION: {
    // Initial alarm setup delay after creating an event
    INITIAL_ALARM_DELAY: 1000, // 1 second
  },
} as const;

/**
 * Backend Polling Configuration Descriptions
 */
export const BACKEND_POLLING_DESCRIPTIONS = {
  EVENT_DO: {
    AGGREGATE_AVAILABILITY_UPDATE:
      "Event DO alarm that polls all Guest DOs to update aggregate availability heatmap",
    ALARM_ERROR_RETRY: "Retry interval when Event DO alarm encounters errors",
  },
  EVENT_CREATION: {
    INITIAL_ALARM_DELAY:
      "Delay before starting the first alarm after event creation",
  },
} as const;

/**
 * Helper function to get backend polling config with description for debugging
 */
export const getBackendPollingConfig = (
  category: keyof typeof BACKEND_POLLING_INTERVALS,
  key: string,
) => {
  const interval = (BACKEND_POLLING_INTERVALS[category] as any)[key];
  const description = (BACKEND_POLLING_DESCRIPTIONS[category] as any)[key];

  return {
    interval,
    description,
    humanReadable: `${interval / 1000}s`,
  };
};
