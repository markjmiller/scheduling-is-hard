/**
 * Centralized Polling Configuration
 *
 * This file contains all polling intervals used throughout the application.
 * Adjust these values to control how frequently different parts of the app
 * poll for updates.
 */

export const POLLING_INTERVALS = {
  /**
   * Host Page Polling Intervals
   */
  HOST_PAGE: {
    // How often the host page polls for availability updates, guest list changes,
    // and host's own availability sync across sessions
    AVAILABILITY_AND_GUESTS: 5000, // 5 seconds
  },

  /**
   * Guest Page Polling Intervals
   */
  GUEST_PAGE: {
    // How often guest pages poll for event details and mutual calendar updates
    EVENT_AND_AVAILABILITY: 5000, // 5 seconds
  },
} as const;

/**
 * Polling Configuration Descriptions
 *
 * Use this for documentation and debugging to understand what each
 * polling interval controls.
 */
export const POLLING_DESCRIPTIONS = {
  HOST_PAGE: {
    AVAILABILITY_AND_GUESTS:
      "Polls for mutual calendar updates, guest list changes, and host availability sync",
  },
  GUEST_PAGE: {
    EVENT_AND_AVAILABILITY:
      "Polls for event detail updates and mutual calendar availability changes",
  },
} as const;

/**
 * Helper function to get polling interval with description for debugging
 */
export const getPollingConfig = (
  category: keyof typeof POLLING_INTERVALS,
  key: string,
) => {
  const interval = (POLLING_INTERVALS[category] as any)[key];
  const description = (POLLING_DESCRIPTIONS[category] as any)[key];

  return {
    interval,
    description,
    humanReadable: `${interval / 1000}s`,
  };
};
