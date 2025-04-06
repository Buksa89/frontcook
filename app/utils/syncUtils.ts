// Utility functions for handling sync operations

// Helper method to convert snake_case to camelCase
export function snakeToCamel(snakeCase: string): string {
  return snakeCase.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Helper method to convert camelCase to snake_case
export function camelToSnake(camelCase: string): string {
  return camelCase.replace(/([A-Z])/g, '_$1').toLowerCase();
} 