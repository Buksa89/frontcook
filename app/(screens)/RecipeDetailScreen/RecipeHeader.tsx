import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Share, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Recipe from '../../../database/models/Recipe';

interface RecipeHeaderProps {
  recipe: Recipe;
}

export const RecipeHeader = ({ recipe }: RecipeHeaderProps) => {
  const handleRejectRecipe = () => {
    Alert.alert(
      'Usuń przepis',
      'Czy na pewno chcesz usunąć ten przepis?',
      [
        {
          text: 'Anuluj',
          style: 'cancel'
        },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            try {
              await recipe.markAsDeleted();
              router.back();
            } catch (error) {
              console.error('Błąd podczas usuwania przepisu:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.header}>
      {recipe.image ? (
        <Image
          source={{ uri: recipe.image }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <MaterialIcons name="restaurant" size={48} color="#ccc" />
        </View>
      )}

      {recipe.isApproved ? (
        <View style={styles.shareButton}>
          <MaterialIcons name="share" size={24} color="#ccc" />
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.rejectButton}
          onPress={handleRejectRecipe}
        >
          <MaterialIcons name="delete" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        style={styles.editButton}
        onPress={() => router.push({
          pathname: '/(screens)/RecipeManagementScreen/RecipeManagementScreen',
          params: { recipeId: recipe.id }
        })}
      >
        <MaterialIcons name="edit" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 250,
  },
  imagePlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    position: 'absolute',
    right: 84,
    bottom: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    opacity: 0.6,
  },
  rejectButton: {
    position: 'absolute',
    right: 84,
    bottom: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editButton: {
    position: 'absolute',
    right: 16,
    bottom: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
}); 