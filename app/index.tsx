import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router'; // Do testowania nawigacji

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SmartCook App</Text>
      <Text>Nowy start!</Text>
      {/* Dodaj link do testowania, np. do przyszłego ekranu logowania */}
      {/* <Link href="/auth/login">Go to Login (Test)</Link> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});