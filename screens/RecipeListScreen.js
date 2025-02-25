import React from 'react';
import { View, FlatList, StyleSheet, Text, Image, TouchableOpacity } from 'react-native';
import { recipes } from '../data/recipes';

const RecipeCard = ({ recipe }) => (
  <TouchableOpacity style={styles.card}>
    <Image
      source={{ uri: recipe.image }}
      style={styles.image}
      defaultSource={require('../assets/default-recipe.png')}
    />
    <View style={styles.cardContent}>
      <Text style={styles.title}>{recipe.name}</Text>
      <Text style={styles.description}>{recipe.description}</Text>
      <Text style={styles.cookTime}>🕒 {recipe.cookTime}</Text>
    </View>
  </TouchableOpacity>
);

export default function RecipeListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Recipes</Text>
      <FlatList
        data={recipes}
        renderItem={({ item }) => <RecipeCard recipe={item} />}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardContent: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  cookTime: {
    fontSize: 14,
    color: '#888',
  },
}); 