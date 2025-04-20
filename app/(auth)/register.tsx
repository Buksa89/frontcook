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
  Alert
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext'; // Import useAuth z src
import { MaterialIcons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const { register } = useAuth(); // Pobierz funkcję register

  const handleRegister = async () => {
    if (!username || !email || !password || !password2) {
      Alert.alert('Błąd', 'Wypełnij wszystkie pola.');
      return;
    }
    if (password !== password2) {
      Alert.alert('Błąd', 'Hasła nie są identyczne.');
      return;
    }
    // TODO: Dodać walidację email/hasła po stronie klienta

    setIsLoading(true);
    try {
      await register(username, email, password, password2);
      // Rejestracja udana - AuthContext pokazał już toast
      Alert.alert(
        'Rejestracja zakończona',
        'Sprawdź swój email, aby aktywować konto, a następnie zaloguj się.',
        [{ text: 'OK', onPress: () => router.replace('/login') }] // Przekieruj do logowania
      );
    } catch (error: any) {
      // Błąd został już obsłużony (pokazany toast) w AuthContext
      console.error('[RegisterScreen] Register failed:', error);
      // Alert.alert('Błąd rejestracji', error?.message || 'Nie udało się zarejestrować.'); // Toast jest już w AuthContext
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
        <Text style={styles.title}>Zarejestruj się</Text>

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

         {/* Pole Email */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="mail-outline" size={24} color="#888" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Adres email"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
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

        {/* Pole Potwierdź Hasło */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="lock-outline" size={24} color="#888" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Potwierdź hasło"
            placeholderTextColor="#aaa"
            value={password2}
            onChangeText={setPassword2}
            secureTextEntry={!showPassword2}
            editable={!isLoading}
          />
           <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword2(!showPassword2)}>
               <MaterialIcons name={showPassword2 ? "visibility" : "visibility-off"} size={24} color="#888" />
           </TouchableOpacity>
        </View>

        {/* Przycisk Rejestracji */}
        <TouchableOpacity
          style={[styles.button, styles.registerButton, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Zarejestruj się</Text>
          )}
        </TouchableOpacity>

         {/* Link do Logowania */}
        <View style={styles.linkContainer}>
           <Text style={styles.linkText}>Masz już konto? </Text>
           <Link href="/login" style={styles.link}>
             Zaloguj się
           </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Użyj tych samych stylów co LoginScreen (można je później wynieść)
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
    registerButton: { // Zmień kolor dla odróżnienia
        backgroundColor: '#6c757d', // Szary przycisk
    },
    buttonDisabled: {
        backgroundColor: '#adb5bd', // Jaśniejszy szary
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