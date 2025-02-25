import React from 'react';
import { StatusBar } from 'expo-status-bar';
import RecipeListScreen from './screens/RecipeListScreen';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <RecipeListScreen />
    </>
  );
} 