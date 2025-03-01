// Jednostki masy
export const MASS_UNITS = [
  'g',
  'kg',
  'dag',
  'dkg',
  'mg',
  'oz',
  'lb',
  'pound',
  'pounds',
  'ounce',
  'ounces',
] as const;

// Jednostki objętości
export const VOLUME_UNITS = [
  'ml',
  'l',
  'litr',
  'litry',
  'litrów',
  'cup',
  'cups',
  'fl oz',
  'fluid ounce',
  'fluid ounces',
  'pint',
  'pints',
  'pt',
  'quart',
  'quarts',
  'qt',
  'gallon',
  'gallons',
  'gal',
] as const;

// Jednostki kuchenne
export const KITCHEN_UNITS = [
  'szklanka',
  'szklanki',
  'szklanek',
  'łyżka',
  'łyżki',
  'łyżek',
  'łyżeczka',
  'łyżeczki',
  'łyżeczek',
  'szczypta',
  'szczypty',
  'szczypt',
  'tablespoon',
  'tablespoons',
  'tbsp',
  'tbsp.',
  'tbs',
  'tbs.',
  'teaspoon',
  'teaspoons',
  'tsp',
  'tsp.',
  'pinch',
  'pinches',
] as const;

// Jednostki liczby/sztuk
export const COUNT_UNITS = [
  'sztuka',
  'sztuki',
  'sztuk',
  'szt',
  'szt.',
  'piece',
  'pieces',
  'pc',
  'pc.',
  'pcs',
  'pcs.',
] as const;

// Wszystkie jednostki
export const ALL_UNITS = [...MASS_UNITS, ...VOLUME_UNITS, ...KITCHEN_UNITS, ...COUNT_UNITS] as const;

// Typ dla jednostek
export type Unit = typeof ALL_UNITS[number];

// Mapowanie jednostek na ich standardową formę
export const UNIT_MAPPING: Record<string, Unit> = {
  // Masa
  'g': 'g',
  'gram': 'g',
  'gramy': 'g',
  'gramów': 'g',
  'grams': 'g',
  'kg': 'kg',
  'kilogram': 'kg',
  'kilogramy': 'kg',
  'kilogramów': 'kg',
  'kilograms': 'kg',
  'dag': 'dag',
  'dekagram': 'dag',
  'dekagramy': 'dag',
  'dekagramów': 'dag',
  'dkg': 'dag',
  'mg': 'mg',
  'miligram': 'mg',
  'miligramy': 'mg',
  'miligramów': 'mg',
  'milligrams': 'mg',
  'oz': 'oz',
  'ounce': 'oz',
  'ounces': 'oz',
  'lb': 'lb',
  'pound': 'lb',
  'pounds': 'lb',

  // Objętość
  'ml': 'ml',
  'mililitr': 'ml',
  'mililitry': 'ml',
  'mililitrów': 'ml',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'l': 'l',
  'litr': 'l',
  'litry': 'l',
  'litrów': 'l',
  'liter': 'l',
  'liters': 'l',
  'cup': 'cup',
  'cups': 'cup',
  'c.': 'cup',
  'fl oz': 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  'fl. oz.': 'fl oz',
  'pint': 'pint',
  'pints': 'pint',
  'pt': 'pint',
  'pt.': 'pint',
  'quart': 'quart',
  'quarts': 'quart',
  'qt': 'quart',
  'qt.': 'quart',
  'gallon': 'gallon',
  'gallons': 'gallon',
  'gal': 'gallon',
  'gal.': 'gallon',

  // Jednostki kuchenne
  'szklanka': 'szklanka',
  'szklanki': 'szklanka',
  'szklanek': 'szklanka',
  'łyżka': 'łyżka',
  'łyżki': 'łyżka',
  'łyżek': 'łyżka',
  'łyżeczka': 'łyżeczka',
  'łyżeczki': 'łyżeczka',
  'łyżeczek': 'łyżeczka',
  'szczypta': 'szczypta',
  'szczypty': 'szczypta',
  'szczypt': 'szczypta',
  'tablespoon': 'tablespoon',
  'tablespoons': 'tablespoon',
  'tbsp': 'tablespoon',
  'tbsp.': 'tablespoon',
  'tbs': 'tablespoon',
  'tbs.': 'tablespoon',
  'T': 'tablespoon',
  'T.': 'tablespoon',
  'teaspoon': 'teaspoon',
  'teaspoons': 'teaspoon',
  'tsp': 'teaspoon',
  'tsp.': 'teaspoon',
  't': 'teaspoon',
  't.': 'teaspoon',
  'pinch': 'pinch',
  'pinches': 'pinch',
  
  // Skróty
  'szkl': 'szklanka',
  'szkl.': 'szklanka',
  'łyż': 'łyżka',
  'łyż.': 'łyżka',
  'ł': 'łyżka',
  'ł.': 'łyżka',
  'łyżecz': 'łyżeczka',
  'łyżecz.': 'łyżeczka',
  'szcz': 'szczypta',
  'szcz.': 'szczypta',

  // Jednostki liczby/sztuk
  'sztuka': 'sztuka',
  'sztuki': 'sztuka',
  'sztuk': 'sztuka',
  'szt': 'sztuka',
  'szt.': 'sztuka',
  'piece': 'piece',
  'pieces': 'piece',
  'pc': 'piece',
  'pc.': 'piece',
  'pcs': 'piece',
  'pcs.': 'piece',
}; 

export default {
  MASS_UNITS,
  VOLUME_UNITS,
  KITCHEN_UNITS,
  COUNT_UNITS,
  ALL_UNITS,
  UNIT_MAPPING,
}; 