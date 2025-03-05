import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ingredient from '../../../database/models/Ingredient';
import { useServings } from './ServingsContext';
import { isIngredientScalable, scaleValue, formatScaledValue } from '../../../app/utils/scaling';

interface ScaledIngredientProps {
  ingredient: Ingredient;
}

export const ScaledIngredient: React.FC<ScaledIngredientProps> = ({ ingredient }) => {
  const { scaleFactor } = useServings();
  const [isChecked, setIsChecked] = useState(false);
  
  // Sprawdzamy, czy składnik powinien być skalowany
  const scalable = isIngredientScalable(ingredient.amount);
  
  // Obliczamy przeskalowaną ilość
  const scaledAmount = scalable 
    ? scaleValue(ingredient.amount, scaleFactor)
    : ingredient.amount;
  
  // Formatujemy wartość do wyświetlenia
  const displayAmount = formatScaledValue(scaledAmount);
  
  return (
    <TouchableOpacity 
      style={[styles.ingredientLine, isChecked && styles.ingredientLineChecked]}
      onPress={() => setIsChecked(!isChecked)}
      activeOpacity={0.7}
    >
      <Text style={styles.ingredientContent}>
        {scaledAmount !== null && displayAmount !== '' && (
          <Text style={[styles.amount, isChecked && styles.textChecked]}>{displayAmount} </Text>
        )}
        {ingredient.unit && (
          <Text style={[styles.unit, isChecked && styles.textChecked]}>{ingredient.unit} </Text>
        )}
        <Text style={[styles.ingredientName, isChecked && styles.textChecked]}>
          {ingredient.name || ingredient.originalStr}
        </Text>
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  ingredientLine: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 1,
  },
  ingredientLineChecked: {
    backgroundColor: '#CCCCCC',
  },
  ingredientContent: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
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
  textChecked: {
    color: '#fff',
  },
}); 