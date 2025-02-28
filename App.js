import React from 'react';
import { StatusBar } from 'expo-status-bar';
import RecipeListScreen from './app/(screens)/RecipeListScreen/RecipeListScreen';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <RecipeListScreen />
    </>
  );
} 