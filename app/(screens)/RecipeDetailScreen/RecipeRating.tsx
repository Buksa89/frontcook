import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';

interface RecipeRatingProps {
  rating: number | null;
  onRatingChange: (rating: number) => void;
}

export const RecipeRating = ({ rating, onRatingChange }: RecipeRatingProps) => {
  return (
    <View style={styles.ratingContainer}>
      <View style={styles.rating}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity 
            key={star}
            onPress={() => onRatingChange(star)}
            style={styles.starButton}
          >
            <Ionicons 
              name={star <= (rating || 0) ? "star" : "star-outline"}
              size={24} 
              color={star <= (rating || 0) ? "#FFA41C" : "#D4D4D4"}
            />
          </TouchableOpacity>
        ))}
      </View>
      {rating ? (
        <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    padding: 6,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starButton: {
    padding: 2,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
}); 