// app/(auth)/register.tsx
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
import { useAuth } from '../../src/contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { showToast } from '../../src/components/Toast';
import { Button } from '../../src/components/Button';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const { register } = useAuth();

  const validateForm = () => { /* ... (bez zmian) ... */ if (!username.trim() || !email.trim() || !password || !password2) { showToast({ type: 'warning', text1: 'Wszystkie pola wymagane', text2: 'Proszę wypełnić wszystkie pola formularza.', }); return false; } if (!/\S+@\S+\.\S+/.test(email)) { showToast({ type: 'warning', text1: 'Niepoprawny email', text2: 'Proszę wprowadzić poprawny adres email.', }); return false; } if (password.length < 6) { showToast({ type: 'warning', text1: 'Zbyt krótkie hasło', text2: 'Hasło musi mieć co najmniej 6 znaków.', }); return false; } if (password !== password2) { showToast({ type: 'warning', text1: 'Hasła nie pasują', text2: 'Wprowadzone hasła różnią się od siebie.', }); return false; } return true; };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      await register(username, email, password, password2);
      Alert.alert( 'Rejestracja zakończona', 'Sprawdź swój email, aby aktywować konto, a następnie zaloguj się.', [{ text: 'OK', onPress: () => router.replace('/login') }] );
    } catch (error: any) {
      console.error('[RegisterScreen] Register failed (error already handled in context):', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Zarejestruj się</Text>

        {/* Pola formularza (bez zmian) */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="person-outline" size={24} color="#888" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Nazwa użytkownika" /*...*/ value={username} onChangeText={setUsername} editable={!isLoading} />
        </View>
        <View style={styles.inputContainer}>
          <MaterialIcons name="mail-outline" size={24} color="#888" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Adres email" /*...*/ value={email} onChangeText={setEmail} editable={!isLoading} />
        </View>
        <View style={styles.inputContainer}>
          <MaterialIcons name="lock-outline" size={24} color="#888" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Hasło" /*...*/ value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} />
           <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}><MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={24} color="#888" /></TouchableOpacity>
        </View>
        <View style={styles.inputContainer}>
          <MaterialIcons name="lock-outline" size={24} color="#888" style={styles.icon} />
          <TextInput style={styles.input} placeholder="Potwierdź hasło" /*...*/ value={password2} onChangeText={setPassword2} secureTextEntry={!showPassword2} editable={!isLoading} />
           <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword2(!showPassword2)}><MaterialIcons name={showPassword2 ? "visibility" : "visibility-off"} size={24} color="#888" /></TouchableOpacity>
        </View>

        <Button
            title="Zarejestruj się"
            onPress={handleRegister}
            isLoading={isLoading}
            disabled={isLoading}
            // ZMIANA: Użycie wariantu "active"
            variant="active"
            style={styles.registerButtonContainer}
        />

         {/* Link do Logowania (bez zmian) */}
        <View style={styles.linkContainer}>
           <Text style={styles.linkText}>Masz już konto? </Text>
           <Link href="/login" style={styles.link}>Zaloguj się</Link>
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
  registerButtonContainer: { width: '100%', marginTop: 10, },
  linkContainer: { marginTop: 25, flexDirection: 'row', justifyContent: 'center', },
  linkText: { color: '#666', fontSize: 14, },
  link: { color: '#5c7ba9', fontWeight: 'bold', fontSize: 14, },
});