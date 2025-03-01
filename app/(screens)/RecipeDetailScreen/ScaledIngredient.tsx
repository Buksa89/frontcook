import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Ingredient from '../../../database/models/Ingredient';
import { useServings } from './ServingsContext';
import { isIngredientScalable, scaleValue, formatScaledValue } from '../../../app/utils/scaling';

interface ScaledIngredientProps {
  ingredient: Ingredient;
}

export const ScaledIngredient: React.FC<ScaledIngredientProps> = ({ ingredient }) => {
  const { scaleFactor } = useServings();
  
  // Sprawdzamy, czy składnik powinien być skalowany
  const scalable = isIngredientScalable(ingredient.amount);
  
  // Obliczamy przeskalowaną ilość
  const scaledAmount = scalable 
    ? scaleValue(ingredient.amount, scaleFactor)
    : ingredient.amount;
  
  // Formatujemy wartość do wyświetlenia
  const displayAmount = formatScaledValue(scaledAmount);
  
  return (
    <Text style={styles.ingredientLine}>
      {scaledAmount !== null && displayAmount !== '' && (
        <Text style={styles.amount}>{displayAmount} </Text>
      )}
      {ingredient.unit && (
        <Text style={styles.unit}>{ingredient.unit} </Text>
      )}
      <Text style={styles.ingredientName}>{ingredient.name || ingredient.originalStr}</Text>
    </Text>
  );
};

const styles = StyleSheet.create({
  ingredientLine: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
    marginBottom: 4,
  },
  amount: {
    fontWeight: '500',
  },
  unit: {
    color: '#666',
  },
  ingredientName: {
    color: '#444',
  },
}); 