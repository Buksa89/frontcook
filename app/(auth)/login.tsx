// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { Link, Href } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { showToast } from '../../src/components/Toast';
// ZMIANA: Importuj komponent Button
import { Button } from '../../src/components/Button'; // Upewnij się, że ścieżka jest poprawna

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const validateForm = () => { /* ... (logika bez zmian, używa showToast) ... */ if (!username.trim()) { showToast({ type: 'warning', text1: 'Brak nazwy użytkownika', text2: 'Wprowadź nazwę użytkownika lub email.', }); return false; } if (!password) { showToast({ type: 'warning', text1: 'Brak hasła', text2: 'Wprowadź hasło.', }); return false; } return true; };

  const handleLogin = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      await login(username, password);
    } catch (error: any) {
      console.error('[LoginScreen] Login failed (error already handled in context):', error.message);
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
          <TextInput style={styles.input} placeholder="Nazwa użytkownika" /*...*/ value={username} onChangeText={setUsername} editable={!isLoading} />
        </View>
        <View style={styles.inputContainer}>
           <MaterialIcons name="lock-outline" size={24} color="#888" style={styles.icon} />
           <TextInput style={styles.input} placeholder="Hasło" /*...*/ value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} />
           <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}><MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={24} color="#888" /></TouchableOpacity>
        </View>

        {/* ZMIANA: Użycie komponentu Button */}
        <Button
            title="Zaloguj się"
            onPress={handleLogin}
            isLoading={isLoading}
            disabled={isLoading}
            variant="active" // Domyślny wariant, ale można jawnie ustawić
            style={styles.loginButtonContainer} // Dodaj styl dla kontenera, jeśli potrzebny margines itp.
            // Możesz dodać inne propsy jak iconName, jeśli chcesz
        />
        {/* KONIEC ZMIANY */}

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

// ZMIANA: Usunięto style specyficzne dla TouchableOpacity, dodano styl dla kontenera Button
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 30, },
    title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 40, textAlign: 'center', },
    inputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: '#f7f7f7', borderRadius: 10, marginBottom: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#eee', },
    icon: { marginRight: 10, },
    input: { flex: 1, height: 50, fontSize: 16, color: '#333', },
    eyeIcon: { padding: 5, },
    loginButtonContainer: { // Styl dla kontenera przycisku Button
        width: '100%', // Zachowaj pełną szerokość
        marginTop: 10, // Zachowaj margines górny
    },
    // Usunięto: button, loginButton, buttonDisabled, buttonText
    linkContainer: { marginTop: 25, flexDirection: 'row', justifyContent: 'center', },
    linkText: { color: '#666', fontSize: 14, },
    link: { color: '#5c7ba9', fontWeight: 'bold', fontSize: 14, },
});