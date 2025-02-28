import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AntDesign } from '@expo/vector-icons';

interface RecipeRatingProps {
  rating: number | null;
  onRatingChange: (rating: number) => void;
}

export const RecipeRating = ({ rating, onRatingChange }: RecipeRatingProps) => {
  return (
    <View style={styles.rating}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity 
          key={star}
          onPress={() => onRatingChange(star)}
        >
          <AntDesign 
            name={star <= (rating || 0) ? "star" : "staro"}
            size={32} 
            color="#FFD700"
            style={styles.star}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  rating: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    padding: 8,
  },
  star: {
    marginHorizontal: 2,
  },
}); 