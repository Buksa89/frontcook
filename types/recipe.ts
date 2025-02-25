export interface Recipe {
  id: number;
  name: string;
  description: string;
  cookTime: string;
  image: string;
  tags?: string[];
  rating?: number;
} 