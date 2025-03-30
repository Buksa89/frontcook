export const formatTime = (minutes: number): string => {
  if (!minutes || minutes === 0) return '';

  if (minutes >= 24 * 60) { // More than 24 hours
    const days = Math.round(minutes / (24 * 60));
    return `${days} ${days === 1 ? 'dzień' : 'dni'}`;
  }

  if (minutes >= 100) { // 100 minutes or more
    const hours = Math.round(minutes / 60);
    return `${hours} ${hours === 1 ? 'godz.' : 'godz.'}`;
  }

  return `${minutes} min`;
};

// Add default export for Expo Router compatibility
export default {
  formatTime
}; 