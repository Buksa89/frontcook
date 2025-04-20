// src/utils/timeFormat.ts

/**
 * Formatuje czas podany w minutach do czytelnego formatu (np. "15 min", "1 godz.", "2 dni").
 * @param minutes Liczba minut.
 * @returns Sformatowany czas jako string lub pusty string, jeśli minuty są 0 lub null/undefined.
 */
export const formatTime = (minutes: number | null | undefined): string => {
    if (!minutes || minutes <= 0) {
      return ''; // Zwróć pusty string dla 0 lub null/undefined
    }
  
    const minutesInHour = 60;
    const minutesInDay = 24 * minutesInHour;
  
    if (minutes >= minutesInDay) { // Dni
      const days = Math.round(minutes / minutesInDay); // Zaokrąglamy do najbliższego dnia
      if (days === 1) return '1 dzień';
      // Prosta forma dla wielu dni, można by dodać "dni" vs "dnia" itp.
      return `${days} dni`;
    } else if (minutes >= minutesInHour) { // Godziny
      const hours = Math.floor(minutes / minutesInHour);
      const remainingMinutes = minutes % minutesInHour;
  
      // Zaokrąglij remainingMinutes do najbliższych 5 lub 10 dla uproszczenia? Np.
      // const roundedMinutes = Math.round(remainingMinutes / 5) * 5;
      const roundedMinutes = remainingMinutes; // Na razie bez zaokrąglania
  
      let hourLabel = 'godz.'; // Domyślnie
      if (hours === 1) hourLabel = 'godz.'; // godz. zamiast godzina dla zwięzłości
      // if (hours >= 2 && hours <= 4) hourLabel = 'godziny';
  
      let result = `${hours} ${hourLabel}`;
      if (roundedMinutes > 0) {
        result += ` ${roundedMinutes} min`;
      }
      return result;
    } else { // Tylko minuty
      return `${minutes} min`;
    }
  };
  
  // Default export dla kompatybilności
  export default {
    formatTime
  };