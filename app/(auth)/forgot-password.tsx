// app/(auth)/forgot-password.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { showToast } from '../../src/components/Toast';
import { router } from 'expo-router'; // Import router do nawigacji

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false); // Stan do śledzenia, czy link został wysłany
  const { resetPassword } = useAuth(); // Pobierz funkcję resetPassword z kontekstu

  const validateEmail = () => {
    if (!email.trim()) {
      showToast({
        type: 'warning',
        text1: 'Brak adresu email',
        text2: 'Wprowadź adres email powiązany z kontem.',
      });
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
       showToast({
        type: 'warning',
        text1: 'Niepoprawny email',
        text2: 'Wprowadź poprawny adres email.',
      });
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    if (!validateEmail()) {
      return;
    }

    setIsLoading(true);
    setIsSent(false); // Zresetuj stan wysłania
    try {
      await resetPassword(email);
      // Sukces jest obsługiwany przez AuthContext (pokazuje toasta)
      setIsSent(true); // Ustaw flagę, aby pokazać wiadomość o sukcesie
      setEmail(''); // Wyczyść pole email po sukcesie
    } catch (error: any) {
      // Błąd API jest już obsłużony przez AuthContext (pokazuje toasta)
      console.error('[ForgotPasswordScreen] Reset password failed (error handled in context):', error.message);
      setIsSent(false); // Upewnij się, że flaga sukcesu nie jest ustawiona
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
        {/* Usunięto ikonę, zmieniono tytuł */}
        <Text style={styles.title}>Resetowanie Hasła</Text>

        {!isSent ? (
          <>
            <Text style={styles.instructionText}>
              Wprowadź adres email powiązany z Twoim kontem. Wyślemy na niego link do zresetowania hasła.
            </Text>

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

            {/* Przycisk Wyślij Link */}
            <Button
              title="Wyślij link resetujący"
              onPress={handleResetPassword}
              isLoading={isLoading}
              disabled={isLoading || !email.trim()}
              variant="active"
              style={styles.submitButtonContainer}
            />
          </>
        ) : (
          // Wiadomość o sukcesie
          <View style={styles.successContainer}>
             <MaterialIcons name="check-circle-outline" size={64} color="#4CAF50" style={styles.successIcon} />
             <Text style={styles.successTitle}>Link wysłany!</Text>
             <Text style={styles.successText}>
               Sprawdź swoją skrzynkę email. Jeśli konto istnieje, wysłaliśmy link do zresetowania hasła.
             </Text>
             <Button
               title="Wróć do logowania"
               onPress={() => router.back()} // Użyj router.back() do powrotu
               variant="secondary" // Przycisk drugorzędny
               style={styles.backButtonContainer}
             />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Style inspirowane LoginScreen, ale dostosowane
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center', // Wyśrodkuj zawartość, jeśli jest mało
    alignItems: 'center',
    padding: 30,
  },
  title: {
    fontSize: 24, // Mniejszy tytuł niż logowanie/rejestracja
    fontWeight: '600',
    color: '#333',
    marginBottom: 20, // Mniejszy margines
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30, // Odstęp od pola email
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#f7f7f7',
    borderRadius: 10,
    marginBottom: 20, // Odstęp od przycisku
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
  submitButtonContainer: {
    width: '100%',
    marginTop: 10,
  },
  // Style dla wiadomości o sukcesie
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
   successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  backButtonContainer: {
      width: '100%',
      marginTop: 15,
  }
});