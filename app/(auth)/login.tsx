// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
// ZMIANA: Importuj router
import { Link, router } from 'expo-router'; // Dodaj router do importów
import { useAuth } from '../../src/contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { showToast } from '../../src/components/Toast';
import { Button } from '../../src/components/Button';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const validateForm = () => { /* ... (bez zmian) ... */ if (!username.trim()) { showToast({ type: 'warning', text1: 'Brak nazwy użytkownika', text2: 'Wprowadź nazwę użytkownika lub email.', }); return false; } if (!password) { showToast({ type: 'warning', text1: 'Brak hasła', text2: 'Wprowadź hasło.', }); return false; } return true; };

  const handleLogin = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      await login(username, password);
      // --- DODANA LOGIKA PRZEKIEROWANIA ---
      // Jeśli login() nie rzucił błędu, to znaczy, że się powiódł.
      // Stan w AuthContext został zaktualizowany. Teraz nawigujemy.
      console.log("[LoginScreen] Login successful, navigating to /recipes");
      // Używamy replace, aby użytkownik nie mógł wrócić do ekranu logowania przyciskiem "wstecz"
      router.replace('/(tabs)/recipes');
      // ------------------------------------
    } catch (error: any) {
      // Błąd jest już obsłużony (toast) w AuthContext
      console.error('[LoginScreen] Login failed (error already handled in context):', error.message);
      // Nie nawigujemy w przypadku błędu
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Zaloguj się</Text>

        {/* Pola Username i Hasło (bez zmian) */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="person-outline" size={24} color="#888" style={styles.icon} />
          <TextInput
             style={styles.input}
             placeholder="Nazwa użytkownika lub email" // ZMIANA: Podpowiedź sugeruje login lub email
             placeholderTextColor="#aaa"
             value={username}
             onChangeText={setUsername}
             autoCapitalize="none" // Ważne dla loginu/emaila
             // keyboardType="email-address" // Może być problematyczne, jeśli login to nie email
             editable={!isLoading}
          />
        </View>
        <View style={styles.inputContainer}>
           <MaterialIcons name="lock-outline" size={24} color="#888" style={styles.icon} />
           <TextInput
             style={styles.input}
             placeholder="Hasło"
             placeholderTextColor="#aaa"
             value={password}
             onChangeText={setPassword}
             secureTextEntry={!showPassword}
             editable={!isLoading}
          />
           <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
             <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={24} color="#888" />
           </TouchableOpacity>
        </View>

        {/* Użycie komponentu Button (bez zmian) */}
        <Button
            title="Zaloguj się"
            onPress={handleLogin}
            isLoading={isLoading}
            disabled={isLoading}
            variant="active"
            style={styles.loginButtonContainer}
        />

        {/* Linki (bez zmian) */}
        <View style={styles.linkContainer}>
           <Text style={styles.linkText}>Nie masz konta? </Text>
           <Link href="/register" style={styles.link}>Zarejestruj się</Link>
        </View>
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
    loginButtonContainer: {
        width: '100%',
        marginTop: 10,
    },
    linkContainer: { marginTop: 25, flexDirection: 'row', justifyContent: 'center', },
    linkText: { color: '#666', fontSize: 14, },
    link: { color: '#5c7ba9', fontWeight: 'bold', fontSize: 14, },
});