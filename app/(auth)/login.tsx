import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert // Użyjemy Alert do pokazywania błędów na razie
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext'; // Import useAuth z src
import { MaterialIcons } from '@expo/vector-icons'; // Dla ikon

export default function LoginScreen() {
  const [loginValue, setLoginValue] = useState(''); // Może być email lub username
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth(); // Pobierz funkcję login z kontekstu

  const handleLogin = async () => {
    if (!loginValue || !password) {
      Alert.alert('Błąd', 'Wprowadź nazwę użytkownika/email i hasło.');
      return;
    }
    setIsLoading(true);
    try {
      await login(loginValue, password);
      // Logowanie udane - AuthContext pokazał już toast
      // Przekieruj do głównego ekranu aplikacji (zakładając, że to '/')
      // Użyj 'replace', aby usunąć ekran logowania ze stosu nawigacji
      router.replace('/');
    } catch (error: any) {
      // Błąd został już obsłużony (pokazany toast) w AuthContext
      // Można dodać dodatkowe logowanie lub specyficzną obsługę UI tutaj
      console.error('[LoginScreen] Login failed:', error);
      // Alert.alert('Błąd logowania', error?.message || 'Nie udało się zalogować.'); // Toast jest już w AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Zaloguj się</Text>

        {/* Pole Login (Email/Username) */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="person-outline" size={24} color="#888" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Nazwa użytkownika lub email"
            placeholderTextColor="#aaa"
            value={loginValue}
            onChangeText={setLoginValue}
            autoCapitalize="none"
            keyboardType="email-address" // Dobry kompromis
            editable={!isLoading}
          />
        </View>

        {/* Pole Hasło */}
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

        {/* Przycisk Logowania */}
        <TouchableOpacity
          style={[styles.button, styles.loginButton, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Zaloguj się</Text>
          )}
        </TouchableOpacity>

        {/* Link do Rejestracji */}
        <View style={styles.linkContainer}>
           <Text style={styles.linkText}>Nie masz konta? </Text>
           <Link href="/register" style={styles.link}>
             Zarejestruj się
           </Link>
        </View>

         {/* Link do Resetu Hasła (TODO) */}
         <View style={styles.linkContainer}>
            <Link href="/forgot-password" style={styles.link}>
                 Zapomniałeś hasła?
            </Link>
         </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Style (proste, można je później przenieść i ulepszyć)
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