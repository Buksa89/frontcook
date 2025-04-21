// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
  // Usunięto Alert
} from 'react-native';
import { Link, Href } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
// ZMIANA: Importuj showToast
import { showToast } from '../../src/components/Toast'; // Upewnij się, że ścieżka jest poprawna

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  // --- ZMIANA: Użycie showToast zamiast Alert.alert ---
  const validateForm = () => {
      if (!username.trim()) {
          showToast({
              type: 'warning', // Lub 'error', jeśli wolisz
              text1: 'Brak nazwy użytkownika',
              text2: 'Wprowadź nazwę użytkownika lub email.',
          });
          return false;
      }
      if (!password) {
           showToast({
              type: 'warning',
              text1: 'Brak hasła',
              text2: 'Wprowadź hasło.',
          });
          return false;
      }
       // Opcjonalnie: Możesz dodać walidację długości hasła, jeśli chcesz
      // if (password.length < 6) {
      //   showToast({
      //       type: 'warning',
      //       text1: 'Zbyt krótkie hasło',
      //       text2: 'Hasło musi mieć co najmniej 6 znaków.',
      //   });
      //   return false;
      // }
      return true;
  };

  const handleLogin = async () => {
    // Wywołaj walidację, która teraz używa Toast
    if (!validateForm()) {
      return; // Przerwij, jeśli walidacja nie przeszła (Toast już się pokazał)
    }

    setIsLoading(true);
    try {
      await login(username, password);
      // Nawigacja obsłużona deklaratywnie przez app/(auth)/index.tsx
    } catch (error: any) {
      console.error('[LoginScreen] Login failed (error already handled in context):', error.message);
      // Toast błędu API jest już pokazywany przez AuthContext
    } finally {
      setIsLoading(false);
    }
  };
  // --- KONIEC ZMIANY ---

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Zaloguj się</Text>

        {/* Pole Username */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="person-outline" size={24} color="#888" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Nazwa użytkownika"
            placeholderTextColor="#aaa"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            editable={!isLoading}
          />
        </View>

        {/* Pole Hasło */}
        <View style={styles.inputContainer}>
           <MaterialIcons name="lock-outline" size={24} color="#888" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Hasło" placeholderTextColor="#aaa" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} />
           <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}><MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={24} color="#888" /></TouchableOpacity>
        </View>

        {/* Przycisk Logowania */}
        <TouchableOpacity style={[styles.button, styles.loginButton, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? (<ActivityIndicator color="#fff" />) : (<Text style={styles.buttonText}>Zaloguj się</Text>)}
        </TouchableOpacity>

        {/* Link do Rejestracji */}
        <View style={styles.linkContainer}>
           <Text style={styles.linkText}>Nie masz konta? </Text>
           <Link href="/register" style={styles.link}>Zarejestruj się</Link>
        </View>

         {/* Link do Resetu Hasła */}
         <View style={styles.linkContainer}>
            <Link href={"/forgot-password"} style={styles.link}>Zapomniałeś hasła?</Link>
         </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Style (bez zmian)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 30, },
    title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 40, textAlign: 'center', },
    inputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: '#f7f7f7', borderRadius: 10, marginBottom: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#eee', },
    icon: { marginRight: 10, },
    input: { flex: 1, height: 50, fontSize: 16, color: '#333', },
    eyeIcon: { padding: 5, },
    button: { width: '100%', paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, },
    loginButton: { backgroundColor: '#5c7ba9', },
    buttonDisabled: { backgroundColor: '#a0b8d8', },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', },
    linkContainer: { marginTop: 25, flexDirection: 'row', justifyContent: 'center', },
    linkText: { color: '#666', fontSize: 14, },
    link: { color: '#5c7ba9', fontWeight: 'bold', fontSize: 14, },
});