// src/features/recipes/types.ts
import Tag from '../../database/models/Tag'; // Import modelu Tag

// Typ dla opcji sortowania
export type MaterialIconName = keyof typeof import('@expo/vector-icons').MaterialIcons.glyphMap; // Poprawiony typ dla ikon MaterialIcons

export type SortOption = {
  key: 'name' | 'rating' | 'totalTime' | 'prepTime' | 'createdAt'; // Dodano createdAt
  label: string;
  icon: MaterialIconName; // Używamy MaterialIconName
};

// Typ dla stanu filtrów
export interface FilterState {
  selectedTags: Tag[];
  minRating: number | null;
  maxPrepTime: number | null;
  maxTotalTime: number | null;
  searchPhrase: string;
}

// Domyślny eksport dla kompatybilności (jeśli potrzebny przez inne narzędzia)
export default {};