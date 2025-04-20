// src/constants/units.ts

// Jednostki masy
export const MASS_UNITS = [
    'g',
    'kg',
    'dag', // dekagram
    'dkg', // dekagram (alternatywnie)
    'mg',
    'oz', // uncja
    'lb', // funt
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
    'cup', // szklanka (ang.)
    'cups',
    'fl oz', // uncja płynu (ang.)
    'fluid ounce',
    'fluid ounces',
    'pint', // pinta (ang.)
    'pints',
    'pt',
    'quart', // kwarta (ang.)
    'quarts',
    'qt',
    'gallon', // galon (ang.)
    'gallons',
    'gal',
  ] as const;
  
  // Jednostki kuchenne (niemetryczne)
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
    'szczypt', // Czasem używane
    'ząbek', // np. czosnku
    'ząbki',
    'plaster', // np. sera
    'plastry',
    'plasterki',
    'gałązka', // np. ziół
    'gałązki',
    'listek', // np. laurowy
    'listki',
    'ziarno', // np. pieprzu
    'ziarna',
    'kostka', // np. bulionu, masła
    'kostki',
    'opakowanie', // np. proszku do pieczenia
    'opakowania',
    'opakowań',
    'puszka', // np. kukurydzy
    'puszki',
    'puszek',
    'słoik', // np. dżemu
    'słoiki',
    'słoików',
    // Angielskie odpowiedniki
    'tablespoon',
    'tablespoons',
    'tbsp',
    'tbsp.',
    'tbs',
    'tbs.',
    'T', // Często używane jako skrót tbsp
    'T.',
    'teaspoon',
    'teaspoons',
    'tsp',
    'tsp.',
    't', // Często używane jako skrót tsp
    't.',
    'pinch',
    'pinches',
    'clove', // ząbek (ang.)
    'cloves',
    'slice', // plaster (ang.)
    'slices',
    'sprig', // gałązka (ang.)
    'sprigs',
    'leaf', // listek (ang.)
    'leaves',
    'grain', // ziarno (ang.)
    'grains',
    'cube', // kostka (ang.)
    'cubes',
    'package', // opakowanie (ang.)
    'packages',
    'can', // puszka (ang.)
    'cans',
    'jar', // słoik (ang.)
    'jars',
  ] as const;
  
  // Jednostki liczby/sztuk
  export const COUNT_UNITS = [
    'sztuka',
    'sztuki',
    'sztuk',
    'szt',
    'szt.',
    'ząbek', // Zduplikowane z KITCHEN_UNITS dla pewności
    'ząbki',
    'plaster',
    'plastry',
    'plasterki',
    'gałązka',
    'gałązki',
    'listek',
    'listki',
    'ziarno',
    'ziarna',
    'kostka',
    'kostki',
    // Angielskie
    'piece',
    'pieces',
    'pc',
    'pc.',
    'pcs',
    'pcs.',
    'clove',
    'cloves',
    'slice',
    'slices',
    'sprig',
    'sprigs',
    'leaf',
    'leaves',
    'grain',
    'grains',
    'cube',
    'cubes',
    'unit', // Generyczne
    'units',
    'item',
    'items',
  ] as const;
  
  // Wszystkie możliwe jednostki do rozpoznania
  export const ALL_UNITS = [
      ...MASS_UNITS,
      ...VOLUME_UNITS,
      ...KITCHEN_UNITS,
      ...COUNT_UNITS
  ] as const;
  
  // Typ dla pojedynczej jednostki
  export type Unit = typeof ALL_UNITS[number];
  
  // Mapowanie rozpoznanych wariantów na standardową formę jednostki
  // Klucze powinny być małymi literami dla łatwiejszego dopasowania
  export const UNIT_MAPPING: Record<string, Unit> = {
    // Masa
    'g': 'g', 'gram': 'g', 'gramy': 'g', 'gramów': 'g', 'grams': 'g',
    'kg': 'kg', 'kilogram': 'kg', 'kilogramy': 'kg', 'kilogramów': 'kg', 'kilograms': 'kg',
    'dag': 'dag', 'dekagram': 'dag', 'dekagramy': 'dag', 'dekagramów': 'dag',
    'dkg': 'dag', // Popularny polski skrót
    'mg': 'mg', 'miligram': 'mg', 'miligramy': 'mg', 'miligramów': 'mg', 'milligrams': 'mg',
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz', 'uncja': 'oz', 'uncje': 'oz', 'uncji': 'oz',
    'lb': 'lb', 'funt': 'lb', 'funty': 'lb', 'funtów': 'lb', 'pound': 'lb', 'pounds': 'lb',
  
    // Objętość
    'ml': 'ml', 'mililitr': 'ml', 'mililitry': 'ml', 'mililitrów': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
    'l': 'l', 'litr': 'l', 'litry': 'l', 'litrów': 'l', 'liter': 'l', 'liters': 'l',
    'cup': 'cup', 'cups': 'cup', 'c': 'cup', 'c.': 'cup',
    'fl oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl. oz.': 'fl oz',
    'pint': 'pint', 'pints': 'pint', 'pt': 'pint', 'pt.': 'pint',
    'quart': 'quart', 'quarts': 'quart', 'qt': 'quart', 'qt.': 'quart', 'kwarta': 'quart', 'kwarty': 'quart',
    'gallon': 'gallon', 'gallons': 'gallon', 'gal': 'gallon', 'gal.': 'gallon', 'galon': 'gallon', 'galony': 'gallon',
  
    // Jednostki kuchenne
    'szklanka': 'szklanka', 'szklanki': 'szklanka', 'szklanek': 'szklanka', 'szkl.': 'szklanka', 'szkl': 'szklanka',
    'łyżka': 'łyżka', 'łyżki': 'łyżka', 'łyżek': 'łyżka', 'łyż.': 'łyżka', 'łyż': 'łyżka', 'ł': 'łyżka', 'ł.': 'łyżka',
    'łyżeczka': 'łyżeczka', 'łyżeczki': 'łyżeczka', 'łyżeczek': 'łyżeczka', 'łyżecz.': 'łyżeczka', 'łyżecz': 'łyżeczka',
    'szczypta': 'szczypta', 'szczypty': 'szczypta', 'szczypt': 'szczypta', 'szcz.': 'szczypta', 'szcz': 'szczypta',
    'ząbek': 'ząbek', 'ząbki': 'ząbek', 'zabki': 'ząbek', 'zabek': 'ząbek', // Dodano warianty bez polskich znaków
    'plaster': 'plaster', 'plastry': 'plaster', 'plasterki': 'plaster',
    'gałązka': 'gałązka', 'gałązki': 'gałązka', 'galazka': 'gałązka', 'galazki': 'gałązka',
    'listek': 'listek', 'listki': 'listek',
    'ziarno': 'ziarno', 'ziarna': 'ziarno',
    'kostka': 'kostka', 'kostki': 'kostka',
    'opakowanie': 'opakowanie', 'opakowania': 'opakowanie', 'opakowań': 'opakowanie', 'op.': 'opakowanie', 'opak': 'opakowanie',
    'puszka': 'puszka', 'puszki': 'puszka', 'puszek': 'puszka',
    'słoik': 'słoik', 'słoiki': 'słoik', 'słoików': 'słoik',
  
    // Angielskie jednostki kuchenne
    'tablespoon': 'tablespoon', 'tablespoons': 'tablespoon', 'tbsp': 'tablespoon', 'tbsp.': 'tablespoon', 'tbs': 'tablespoon', 'tbs.': 'tablespoon', 'T': 'tablespoon', 'T.': 'tablespoon',
    'teaspoon': 'teaspoon', 'teaspoons': 'teaspoon', 'tsp': 'teaspoon', 'tsp.': 'teaspoon', 't': 'teaspoon', 't.': 'teaspoon',
    'pinch': 'pinch', 'pinches': 'pinch',
    'clove': 'clove', 'cloves': 'clove',
    'slice': 'slice', 'slices': 'slice',
    'sprig': 'sprig', 'sprigs': 'sprig',
    'leaf': 'leaf', 'leaves': 'leaf',
    'grain': 'grain', 'grains': 'grain',
    'cube': 'cube', 'cubes': 'cube',
    'package': 'package', 'packages': 'package', 'pkg': 'package', 'pkg.': 'package',
    'can': 'can', 'cans': 'can',
    'jar': 'jar', 'jars': 'jar',
  
    // Jednostki liczby/sztuk
    'sztuka': 'sztuka', 'sztuki': 'sztuka', 'sztuk': 'sztuka', 'szt': 'sztuka', 'szt.': 'sztuka',
    'piece': 'piece', 'pieces': 'piece', 'pc': 'piece', 'pc.': 'piece', 'pcs': 'piece', 'pcs.': 'piece',
    'unit': 'unit', 'units': 'unit',
    'item': 'item', 'items': 'item',
  };
  
  // Domyślny eksport dla kompatybilności
  export default {
    MASS_UNITS,
    VOLUME_UNITS,
    KITCHEN_UNITS,
    COUNT_UNITS,
    ALL_UNITS,
    UNIT_MAPPING,
  };