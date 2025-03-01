/**
 * Funkcje pomocnicze do skalowania składników i innych wartości przepisu
 */

/**
 * Oblicza współczynnik skalowania na podstawie oryginalnej i aktualnej liczby porcji
 * @param originalServings Oryginalna liczba porcji
 * @param currentServings Aktualna liczba porcji
 * @returns Współczynnik skalowania
 */
export const calculateScaleFactor = (
  originalServings: number | null, 
  currentServings: number
): number => {
  if (originalServings === null || originalServings <= 0) {
    return 1;
  }
  return currentServings / originalServings;
};

/**
 * Skaluje wartość liczbową zgodnie z współczynnikiem skalowania
 * @param value Wartość do przeskalowania
 * @param scaleFactor Współczynnik skalowania
 * @param precision Liczba miejsc po przecinku (domyślnie 2)
 * @returns Przeskalowana wartość
 */
export const scaleValue = (
  value: number | null, 
  scaleFactor: number,
  precision: number = 2
): number | null => {
  if (value === null || value <= 0) {
    return value;
  }
  
  // Zaokrąglamy do określonej liczby miejsc po przecinku
  return Math.round(value * scaleFactor * Math.pow(10, precision)) / Math.pow(10, precision);
};

/**
 * Sprawdza, czy składnik powinien być skalowany
 * @param amount Ilość składnika
 * @returns Czy składnik powinien być skalowany
 */
export const isIngredientScalable = (amount: number | null): boolean => {
  return amount !== null && amount > 0;
};

/**
 * Formatuje przeskalowaną wartość do wyświetlenia
 * @param value Przeskalowana wartość
 * @returns Sformatowana wartość jako string
 */
export const formatScaledValue = (value: number | null): string => {
  if (value === null) {
    return '';
  }
  
  // Jeśli wartość jest liczbą całkowitą, nie pokazujemy części dziesiętnej
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  // W przeciwnym razie formatujemy z maksymalnie 2 miejscami po przecinku
  return value.toFixed(2).replace(/\.?0+$/, '');
}; 