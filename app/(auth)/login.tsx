// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
// ZMIANA: Usunięto import router, bo nie jest już używany
import { Link, Href } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Błąd', 'Wprowadź nazwę użytkownika i hasło.');
      return;
    }
    setIsLoading(true);
    try {
      await login(username, password);
      // --- USUNIĘTO NAWIGACJĘ IMPERATYWNĄ ---
      // router.replace('/'); // <--- Ta linia została usunięta
      // --- KONIEC USUNIĘCIA ---
      // Nawigacja zostanie obsłużona przez app/(auth)/index.tsx po zmianie stanu isAuthenticated
    } catch (error: any) {
      // Błąd jest już logowany w AuthContext i pokazywany Toastem
      console.error('[LoginScreen] Login failed (error already handled in context):', error.message);
      // Nie pokazuj dodatkowego alertu, AuthContext już to robi Toastem
    } finally {
      setIsLoading(false);
    }
  };

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
            {/* Poprawiono: użycie `href` jako string */}
            <Link href={"/forgot-password"} style={styles.link}>Zapomniałeś hasła?</Link>
         </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Style (bez zmian)
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContainer: {
      flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 40,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        backgroundColor: '#f7f7f7',
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#eee',
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 16,
        color: '#333',
    },
    eyeIcon: {
        padding: 5,
    },
    button: {
        width: '100%',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    loginButton: {
        backgroundColor: '#5c7ba9',
    },
    buttonDisabled: {
        backgroundColor: '#a0b8d8',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    linkContainer: {
        marginTop: 25,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    linkText: {
        color: '#666',
        fontSize: 14,
    },
    link: {
        color: '#5c7ba9',
        fontWeight: 'bold',
        fontSize: 14,
    },
});