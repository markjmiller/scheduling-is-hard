/**
 * Generate random 8-character alphanumeric ID with optional prefix
 * Used for creating unique identifiers for events and guests
 */
export function generateId(prefix?: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix ? prefix + result : result;
}

/**
 * Generate event ID with "e" prefix
 */
export function generateEventId(): string {
  return generateId('e');
}

/**
 * Generate guest ID with "g" prefix  
 */
export function generateGuestId(): string {
  return generateId('g');
}
