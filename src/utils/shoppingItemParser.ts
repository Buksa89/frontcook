// src/utils/shoppingItemParser.ts

import { UNIT_MAPPING, Unit } from '../constants/units'; // Upewnij się, że ścieżka jest poprawna

export interface ParsedShoppingItem {
  amount: number | null; // Używamy number | null
  unit: Unit | null;
  name: string;
  // Można dodać 'type' jeśli parser miałby go rozpoznawać
}

/**
 * Konwertuje ułamek w formie tekstu na liczbę (np. "1/2" -> 0.5).
 * Zwraca NaN w przypadku niepowodzenia.
 */
const fractionToFloat = (fraction: string): number => {
  const parts = fraction.split('/');
  if (parts.length !== 2) return NaN;
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  if (isNaN(num) || isNaN(den) || den === 0) return NaN;
  return num / den;
};

/**
 * Parsuje tekst reprezentujący liczbę (może zawierać ułamki, liczby dziesiętne).
 * Np. "1 1/2" -> 1.5, "2,5" -> 2.5.
 * Zwraca NaN w przypadku niepowodzenia.
 */
const parseAmount = (amountStr: string): number => {
  const cleanedAmountStr = amountStr.replace(',', '.').trim();
  const parts = cleanedAmountStr.split(' ').filter(part => part !== '');

  if (parts.length === 0) return NaN;

  let totalAmount = 0;
  let numberParsed = false;

  let firstPartVal = parseFloat(parts[0]);
  if (!isNaN(firstPartVal)) {
    totalAmount = firstPartVal;
    numberParsed = true;
  } else if (parts[0].includes('/')) {
    firstPartVal = fractionToFloat(parts[0]);
    if (!isNaN(firstPartVal)) {
      totalAmount = firstPartVal;
      numberParsed = true;
    }
  }

  if (
    numberParsed &&
    parts.length > 1 &&
    Number.isInteger(parseFloat(parts[0])) &&
    parts[1].includes('/')
  ) {
    const fractionVal = fractionToFloat(parts[1]);
    if (!isNaN(fractionVal)) {
      totalAmount += fractionVal;
    } else {
      return NaN;
    }
  } else if (numberParsed && parts.length > 1 && !parts[1].includes('/')) {
      return NaN; // Jeśli po liczbie jest coś, co nie jest ułamkiem
  }

  return numberParsed ? totalAmount : NaN;
};


/**
 * Parsuje tekst elementu listy zakupów na ilość, jednostkę i nazwę.
 * Obsługuje liczby/jednostki na początku lub na końcu.
 */
export const parseShoppingItem = (originalStr: string): ParsedShoppingItem => {
  let textToParse = originalStr.trim();
  let amount: number | null = null;
  let unit: Unit | null = null;
  let name = '';
  let amountFound = false;
  let unitFound = false;

  // 1. Spróbuj znaleźć liczbę i jednostkę na początku
  const amountRegexStart = /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\s*\/\s*\d+|\d+[.,]\d*)\s*/;
  const amountMatchStart = textToParse.match(amountRegexStart);

  if (amountMatchStart) {
    const parsedAmount = parseAmount(amountMatchStart[1]);
    if (!isNaN(parsedAmount)) {
      amount = parsedAmount;
      amountFound = true;
      textToParse = textToParse.slice(amountMatchStart[0].length).trim();

      // Sprawdź jednostkę zaraz po ilości
      const firstWordAfterAmount = textToParse.split(' ')[0]?.toLowerCase();
      if (firstWordAfterAmount) {
          const cleanUnit = firstWordAfterAmount.endsWith('.') ? firstWordAfterAmount.slice(0, -1) : firstWordAfterAmount;
          if (cleanUnit in UNIT_MAPPING) {
              unit = UNIT_MAPPING[cleanUnit as keyof typeof UNIT_MAPPING];
              unitFound = true;
              textToParse = textToParse.slice(firstWordAfterAmount.length).trim();
          }
      }
    }
  }

  // 2. Jeśli nie znaleziono ilości/jednostki na początku, spróbuj na końcu
  if (!amountFound || !unitFound) {
      const words = textToParse.split(' ').filter(w => w); // Podziel na słowa, usuń puste
      if (words.length >= 1) {
          const lastWord = words[words.length - 1].toLowerCase();
          const cleanLastWord = lastWord.endsWith('.') ? lastWord.slice(0, -1) : lastWord;

          // Czy ostatnie słowo to jednostka?
          if (!unitFound && cleanLastWord in UNIT_MAPPING) {
              unit = UNIT_MAPPING[cleanLastWord as keyof typeof UNIT_MAPPING];
              unitFound = true;
              words.pop(); // Usuń jednostkę z tablicy słów
              textToParse = words.join(' ').trim(); // Zaktualizuj tekst do sparsowania (bez jednostki)

              // Czy przed jednostką była liczba?
              if (!amountFound && words.length >= 1) {
                  const potentialAmountStr = words[words.length - 1];
                  const parsedAmountEnd = parseAmount(potentialAmountStr);
                  if (!isNaN(parsedAmountEnd)) {
                      amount = parsedAmountEnd;
                      amountFound = true;
                      words.pop(); // Usuń liczbę z tablicy słów
                      textToParse = words.join(' ').trim(); // Zaktualizuj tekst (bez liczby i jednostki)
                  }
              }
          }
          // Czy ostatnie słowo to liczba (bez jednostki)?
          else if (!amountFound && !unitFound) {
               const parsedAmountEnd = parseAmount(lastWord); // Sprawdź ostatnie słowo
               if (!isNaN(parsedAmountEnd)) {
                   amount = parsedAmountEnd;
                   amountFound = true;
                   words.pop(); // Usuń liczbę
                   textToParse = words.join(' ').trim();
               }
          }
      }
  }


  // 3. Reszta tekstu to nazwa produktu
  name = textToParse.trim();

  // 4. Logika Fallback
  if (!name) {
    // Jeśli nazwa jest pusta, ale znaleźliśmy ilość lub jednostkę, użyj oryginalnego stringu
    if (amountFound || unitFound) {
      name = originalStr.trim();
      amount = null; // Zresetuj, bo nie udało się wyizolować nazwy
      unit = null;
    } else {
      // Jeśli nic nie znaleziono, cały string to nazwa
      name = originalStr.trim();
      amount = 1.0; // Domyślna ilość
    }
  }

  // Ustaw domyślną ilość, jeśli nadal jest null
  if (amount === null) {
    amount = 1.0;
  }

  return {
    amount: amount,
    unit,
    name: name || 'Nieznany produkt', // Ostateczny fallback
  };
};

// Default export dla kompatybilności
export default {
  parseShoppingItem
};