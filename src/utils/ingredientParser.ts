// src/utils/ingredientParser.ts

// Zakładamy, że plik z jednostkami istnieje i jest poprawny
import { UNIT_MAPPING, Unit } from '../constants/units'; // Upewnij się, że ścieżka jest poprawna

export interface ParsedIngredient {
  amount: number | null; // Zmieniono na number | null
  unit: Unit | null;
  name: string;
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

  // Spróbuj sparsować pierwszą część
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

  // Jeśli pierwsza była liczbą całkowitą, a jest druga część będąca ułamkiem
  if (
    numberParsed &&
    parts.length > 1 &&
    Number.isInteger(parseFloat(parts[0])) && // Upewnij się, że pierwsza była całkowita
    parts[1].includes('/')
  ) {
    const fractionVal = fractionToFloat(parts[1]);
    if (!isNaN(fractionVal)) {
      totalAmount += fractionVal;
    } else {
         // Jeśli druga część wygląda jak ułamek, ale jest niepoprawna, cała ilość jest nieważna
         return NaN;
    }
  }
   // Jeśli po pierwszej części jest coś jeszcze, co nie jest poprawnym ułamkiem, uznaj ilość za nieważną
   else if (numberParsed && parts.length > 1 && !parts[1].includes('/')) {
       return NaN;
   }

  return numberParsed ? totalAmount : NaN;
};


/**
 * Parsuje tekst składnika na ilość, jednostkę i nazwę.
 */
export const parseIngredient = (originalStr: string): ParsedIngredient => {
  let textToParse = originalStr.trim();
  let amount: number | null = null; // Zmieniono domyślną wartość na null
  let unit: Unit | null = null;
  let name = '';

  // Wzorzec do znalezienia liczby na początku (z obsługą spacji w ułamkach)
  // Obejmuje: 1, 1.5, 1,5, 1/2, 1 1/2
  const amountRegex = /^(\d+(?:[.,]\d+)?(?:\s+\d+\/\d+)?|\d+\s*\/\s*\d+|\d+[.,]\d*)\s+/;
  const amountMatch = textToParse.match(amountRegex);

  if (amountMatch) {
    const parsed = parseAmount(amountMatch[1]); // Parsuj dopasowaną część
    if (!isNaN(parsed)) {
      amount = parsed;
      textToParse = textToParse.slice(amountMatch[0].length).trim(); // Usuń liczbę i spację
    }
  }

  // Sprawdź, czy następne słowo to znana jednostka
  const words = textToParse.split(' ');
  if (words.length > 0) {
    const possibleUnit = words[0].toLowerCase();
    // Usuń potencjalną kropkę na końcu jednostki (np. "łyż.")
    const cleanPossibleUnit = possibleUnit.endsWith('.') ? possibleUnit.slice(0, -1) : possibleUnit;

    if (cleanPossibleUnit in UNIT_MAPPING) {
      unit = UNIT_MAPPING[cleanPossibleUnit as keyof typeof UNIT_MAPPING];
      textToParse = words.slice(1).join(' ').trim(); // Usuń jednostkę
    }
  }

  // Reszta to nazwa produktu
  name = textToParse.trim();

  // Jeśli nie znaleziono ilości, ale tekst jest tylko liczbą, ustaw ją jako ilość, a nazwę wyczyść.
   if (amount === null && name === '' && words.length === 1) {
       const parsedAsNumber = parseAmount(words[0]);
       if (!isNaN(parsedAsNumber)) {
           amount = parsedAsNumber;
           textToParse = ''; // Nazwa jest pusta
       }
   }


  // Jeśli po wszystkim nazwa jest pusta, a JEST ilość lub jednostka,
  // to oryginalny string był prawdopodobnie tylko ilością/jednostką - uznajmy to za błąd parsowania nazwy.
  // Ale jeśli NIE ma ilości ANI jednostki, to cały string jest nazwą.
  if (name === '' && (amount !== null || unit !== null)) {
      // console.warn(`Nie udało się wyodrębnić nazwy z: "${originalStr}". Zwracanie oryginalnego tekstu jako nazwy.`);
      name = originalStr.trim(); // Użyj całego oryginalnego stringu jako nazwy
      amount = null; // Zresetuj ilość
      unit = null; // Zresetuj jednostkę
  } else if (name === '' && amount === null && unit === null) {
      // Jeśli nic nie znaleziono, cały string jest nazwą, ilość to 1
      name = originalStr.trim();
      amount = 1.0; // Domyślna ilość 1, jeśli nic innego nie pasuje
  }

  // Ostateczne przypisanie ilości, jeśli nadal jest null
  if (amount === null) {
      amount = 1.0; // Domyślna ilość to 1
  }


  return {
    amount: amount, // Zwracaj number | null
    unit,
    name: name || 'Nieznany składnik', // Fallback, gdyby nazwa była nadal pusta
  };
};

// Default export dla kompatybilności
export default {
  parseIngredient
};