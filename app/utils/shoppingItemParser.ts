import { UNIT_MAPPING, Unit } from '../constants/units';

interface ParsedShoppingItem {
  amount: number | null;
  unit: Unit | null;
  name: string;
  originalStr: string;
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
 * "Chleb" -> { amount: null, unit: null, name: "Chleb" }
 * "1.5 l mleka" -> { amount: 1.5, unit: "l", name: "mleka" }
 */
export const parseShoppingItem = (text: string): ParsedShoppingItem => {
  const originalStr = text.trim();
  let remainingText = originalStr;
  let amount: number | null = null;
  let unit: Unit | null = null;

  // Znajdź liczbę na początku (może być ułamek lub liczba z przecinkiem)
  const amountMatch = remainingText.match(/^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)/);
  if (amountMatch) {
    amount = parseAmount(amountMatch[0]);
    remainingText = remainingText.slice(amountMatch[0].length).trim();
  }

  // Sprawdź czy następne słowo to jednostka
  const unitMatch = remainingText.match(/^(\S+)/);
  if (unitMatch) {
    const possibleUnit = unitMatch[1].toLowerCase();
    if (possibleUnit in UNIT_MAPPING) {
      unit = UNIT_MAPPING[possibleUnit];
      remainingText = remainingText.slice(unitMatch[0].length);
    }
  }

  // Reszta tekstu to nazwa
  const name = remainingText.trim();

  return {
    amount,
    unit,
    name: name || originalStr, // Jeśli nazwa jest pusta, użyj oryginalnego tekstu
    originalStr
  };
}; 