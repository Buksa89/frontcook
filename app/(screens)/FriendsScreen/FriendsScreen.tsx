import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

export default function FriendsScreen() {
  return (
    <View style={styles.container}>
      <FontAwesome5 name="user-friends" size={80} color="#ccc" style={styles.icon} />
      <Text style={styles.title}>Znajomi</Text>
      <Text style={styles.subtitle}>Ta funkcja będzie dostępna wkrótce</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
}); 