import { UNIT_MAPPING, Unit } from '../constants/units';

interface ParsedIngredient {
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
 * Parsuje tekst składnika na jego komponenty
 */
export const parseIngredient = (text: string): ParsedIngredient => {
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

  // Sprawdź czy następne słowo (lub tekst bez spacji) to jednostka
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
    name,
    originalStr
  };
}; 