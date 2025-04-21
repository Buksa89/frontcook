// app/index.tsx (tymczasowo do testów)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>OmNomNom App - Test Index</Text>
      <Link href="/login" style={styles.link}>Przejdź do Logowania</Link>
      <Link href="/register" style={styles.link}>Przejdź do Rejestracji</Link>
      <Link href="/debug" style={styles.link}>Przejdź do Debug</Link>
       {/* Link do głównego ekranu po zalogowaniu (zakładając Tabs) */}
       <Link href="/(tabs)/shoppingList" style={styles.link}>Przejdź do Listy Zakupów (Tabs)</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  link: { marginVertical: 10, fontSize: 16, color: 'blue' },
});