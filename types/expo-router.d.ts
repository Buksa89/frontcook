declare module "expo-router" {
  import type { ComponentType } from 'react';

  export type RelativePathString = `/${string}`;
  export type ExternalPathString = `http${string}`;

  export type AppRoutes =
    | "/(screens)/RecipeDetailScreen/RecipeDetailScreen"
    | "/(screens)/RecipeListScreen/RecipeListScreen"
    | "/(screens)/RecipeManagementScreen/RecipeManagementScreen"
    | "/shopping-list"
    | "/"
    | "/_sitemap";

  export type SearchParams = Record<string, string | string[]>;

  export type RouteParams = {
    recipeId?: string;
  };

  export interface Router {
    push: (route: { pathname: AppRoutes; params?: RouteParams }) => void;
  }

  interface StackScreenProps {
    name: string;
    options?: any;
  }

  interface StackType extends ComponentType<any> {
    Screen: ComponentType<StackScreenProps>;
  }

  export const router: Router;
  export const useLocalSearchParams: () => RouteParams;
  export const Redirect: ComponentType<{ href: AppRoutes }>;
  export const Stack: StackType;

  const DefaultExport: ComponentType;
  export default DefaultExport;
} 