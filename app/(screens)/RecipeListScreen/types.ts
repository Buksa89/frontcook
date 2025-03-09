import Tag from '../../../database/models/Tag';

export type MaterialIconName = 'sort-by-alpha' | 'grade' | 'schedule' | 'timer';

export type SortOption = {
  key: 'name' | 'rating' | 'totalTime' | 'prepTime';
  label: string;
  icon: MaterialIconName;
};

export interface FilterState {
  selectedTags: Tag[];
  minRating: number | null;
  maxPrepTime: number | null;
  maxTotalTime: number | null;
  searchPhrase: string;
} 