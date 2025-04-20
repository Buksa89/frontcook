// src/utils/shoppingListParser.ts

// Zaimportuj typy jednostek, jeśli są potrzebne
import { UNIT_MAPPING, Unit } from '../constants/units'; // Upewnij się, że ta ścieżka jest poprawna

export interface ParsedShoppingItem {
  amount: number; // Używajmy number, może być zmiennoprzecinkowa
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
  const num = parseFloat(parts[0]);
  const den = parseFloat(parts[1]);
  // Sprawdź NaN i dzielenie przez zero
  if (isNaN(num) || isNaN(den) || den === 0) return NaN;
  return num / den;
};

/**
 * Parsuje tekst reprezentujący liczbę (może zawierać ułamki, liczby dziesiętne)
 * Np. "1 1/2" -> 1.5, "2,5" -> 2.5
 */
const parseAmount = (amountStr: string): number => {
  const cleanedAmountStr = amountStr.replace(',', '.').trim(); // Zamień przecinki, usuń białe znaki
  const parts = cleanedAmountStr.split(' ').filter(part => part !== ''); // Rozdziel spacjami, usuń puste

  if (parts.length === 0) return NaN;

  let totalAmount = 0;
  let numberParsed = false;

  // Spróbuj sparsować pierwszą część jako liczbę (całkowitą lub dziesiętną)
  let firstPartVal = parseFloat(parts[0]);
  if (!isNaN(firstPartVal)) {
    totalAmount = firstPartVal;
    numberParsed = true;
  } else if (parts[0].includes('/')) { // Pierwsza część może być ułamkiem
    firstPartVal = fractionToFloat(parts[0]);
    if (!isNaN(firstPartVal)) {
      totalAmount = firstPartVal;
      numberParsed = true;
    }
  }

  // Jeśli pierwsza część była liczbą całkowitą i jest druga część, spróbuj sparsować ją jako ułamek
  if (numberParsed && parts.length > 1 && Number.isInteger(parseFloat(parts[0])) && parts[1].includes('/')) {
    const fractionVal = fractionToFloat(parts[1]);
    if (!isNaN(fractionVal)) {
      totalAmount += fractionVal; // Dodaj wartość ułamka
    }
  }

  return numberParsed ? totalAmount : NaN; // Zwróć NaN, jeśli nie udało się sparsować liczby
};


/**
 * Parsuje tekst elementu listy zakupów na jego komponenty
 * Przykłady:
 * "2 kg mąki" -> { amount: 2, unit: "kg", name: "mąki" }
 * "Chleb" -> { amount: 1, unit: null, name: "Chleb" }
 * "1.5 l mleka" -> { amount: 1.5, unit: "l", name: "mleka" }
 * "1/2 szklanki cukru" -> { amount: 0.5, unit: "szklanka", name: "cukru"}
 * "Jajka 3 szt." -> { amount: 3, unit: "szt", name: "jajka" } - Uwaga: kolejność może być różna
 */
export const parseShoppingItem = (originalStr: string): ParsedShoppingItem => {
  let textToParse = originalStr.trim();
  let amount = 1.0; // Domyślna ilość
  let unit: Unit | null = null;
  let name = '';
  let amountFound = false;

  // 1. Spróbuj znaleźć liczbę na początku
  // Regex obsługujący: 1 | 1.5 | 1,5 | 1/2 | 1 1/2
  const amountMatchStart = textToParse.match(/^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\s*\/\s*\d+|\d+[.,]\d*)\s+/);
  if (amountMatchStart) {
    const parsed = parseAmount(amountMatchStart[1]);
    if (!isNaN(parsed)) {
      amount = parsed;
      amountFound = true;
      textToParse = textToParse.slice(amountMatchStart[0].length).trim(); // Usuń liczbę i spację
    }
  }

  // 2. Spróbuj znaleźć jednostkę (jako pierwsze słowo pozostałego tekstu)
  const words = textToParse.split(' ');
  if (words.length > 0) {
    const possibleUnit = words[0].toLowerCase();
    const cleanPossibleUnit = possibleUnit.endsWith('.') ? possibleUnit.slice(0, -1) : possibleUnit; // Usuń kropkę np. z "szt."

    if (cleanPossibleUnit in UNIT_MAPPING) {
      unit = UNIT_MAPPING[cleanPossibleUnit as keyof typeof UNIT_MAPPING];
      textToParse = words.slice(1).join(' ').trim(); // Usuń jednostkę
    }
  }

  // 3. Spróbuj znaleźć liczbę i jednostkę na końcu (np. "Jajka 3 szt") - jeśli nie znaleziono ilości na początku
   if (!amountFound && words.length >= 2) {
      const lastWord = words[words.length - 1].toLowerCase();
      const secondLastWord = words[words.length - 2];
      const cleanLastWord = lastWord.endsWith('.') ? lastWord.slice(0, -1) : lastWord;

      const parsedAmountEnd = parseAmount(secondLastWord);

      // Sprawdź czy przedostatnie słowo to liczba, a ostatnie to jednostka
      if (!isNaN(parsedAmountEnd) && (cleanLastWord in UNIT_MAPPING)) {
          amount = parsedAmountEnd;
          amountFound = true; // Znaleziono ilość
          unit = UNIT_MAPPING[cleanLastWord as keyof typeof UNIT_MAPPING];
          textToParse = words.slice(0, -2).join(' ').trim(); // Usuń ilość i jednostkę z końca
      }
      // Sprawdź czy tylko przedostatnie słowo to liczba (np. "Jabłka 5")
      else if (!isNaN(parsedAmountEnd) && !(cleanLastWord in UNIT_MAPPING)) {
           amount = parsedAmountEnd;
           amountFound = true;
           textToParse = words.slice(0, -1).join(' ').trim(); // Usuń tylko liczbę z końca
      }
   }


  // 4. Reszta tekstu to nazwa produktu
  name = textToParse.trim();

  // Jeśli po wszystkich operacjach nazwa jest pusta, wróć do oryginalnego stringu
  if (!name) {
    name = originalStr.trim();
    // Jeśli oryginalny string był tylko liczbą/jednostką, które zostały usunięte,
    // to oryginalny string staje się nazwą, a ilość/jednostka są resetowane.
    if (amountFound || unit) {
        amount = 1.0; // Reset do domyślnej ilości
        unit = null; // Reset jednostki
    }
  }

  // Ostateczne sprawdzenie - jeśli nazwa nadal jest pusta
  name = name || 'Nieznany produkt';

  return {
    amount: amount, // Zawsze zwracaj liczbę
    unit,
    name: name.toLowerCase(), // Znormalizuj nazwę
  };
};

// Default export dla kompatybilności (jeśli potrzebne)
export default {
  parseShoppingItem
};