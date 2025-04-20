import { UNIT_MAPPING, Unit } from '../constants/units';

interface ParsedIngredient {
  amount: number;
  unit: Unit | null;
  name: string;
}

/**
 * Konwertuje ułamek w formie tekstu na liczbę
 * Np. "1/2" -> 0.5
 */
const fractionToFloat = (fraction: string): number => {
  const parts = fraction.split('/');
  if (parts.length !== 2) return NaN;
  return parseFloat(parts[0]) / parseFloat(parts[1]);
};

/**
 * Parsuje tekst reprezentujący liczbę (może zawierać ułamki)
 * Np. "1 1/2" -> 1.5
 */
const parseAmount = (amount: string): number => {
  // Zamień przecinki na kropki
  amount = amount.replace(',', '.');

  // Jeśli zawiera spację, może to być "1 1/2"
  if (amount.includes(' ')) {
    const parts = amount.split(' ');
    const whole = parseFloat(parts[0]);
    const fraction = fractionToFloat(parts[1]);
    if (!isNaN(whole) && !isNaN(fraction)) {
      return whole + fraction;
    }
  }

  // Jeśli to ułamek
  if (amount.includes('/')) {
    return fractionToFloat(amount);
  }

  // Zwykła liczba
  return parseFloat(amount);
};

/**
 * Parsuje tekst elementu listy zakupów na jego komponenty
 * Przykłady:
 * "2 kg mąki" -> { amount: 2, unit: "kg", name: "mąki" }
 * "Chleb" -> { amount: 1, unit: null, name: "Chleb" }
 * "1.5 l mleka" -> { amount: 1.5, unit: "l", name: "mleka" }
 */
export const parseIngredient = (originalStr: string): ParsedIngredient => {
  let remainingText = originalStr.trim();
  let amount = 1; // Domyślna wartość to 1

  // Znajdź liczbę na początku (może być ułamek lub liczba z przecinkiem)
  const amountMatch = remainingText.match(/^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)/);
  if (amountMatch) {
    const parsedAmount = parseAmount(amountMatch[0]);
    if (!isNaN(parsedAmount)) {
      amount = parsedAmount;
    }
    remainingText = remainingText.slice(amountMatch[0].length).trim();
  }

  // Sprawdź czy następne słowo to jednostka
  let unit: Unit | null = null;
  const unitMatch = remainingText.match(/^(\S+)/);
  if (unitMatch) {
    const possibleUnit = unitMatch[1].toLowerCase();
    if (possibleUnit in UNIT_MAPPING) {
      unit = UNIT_MAPPING[possibleUnit];
      remainingText = remainingText.slice(unitMatch[0].length);
    }
  }

  // Reszta tekstu to nazwa
  const name = remainingText.trim().toLowerCase();

  return {
    amount,
    unit,
    name: name || originalStr.toLowerCase() // Jeśli nie ma nazwy, użyj całego tekstu
  };
};

// Add default export for Expo Router compatibility
export default {
  parseIngredient
}; 