import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import RegisterModal from './RegisterModal';
import ResetPasswordModal from './ResetPasswordModal';
import { useAuth } from '../../context';

export default function AuthScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);

  const { login } = useAuth();

  const validateForm = () => {
    let isValid = true;

    // Walidacja identyfikatora (username lub email)
    if (!identifier.trim()) {
      setIdentifierError('Wprowadź nazwę użytkownika lub email');
      isValid = false;
    } else {
      setIdentifierError('');
    }

    // Walidacja hasła
    if (!password) {
      setPasswordError('Wprowadź hasło');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Hasło musi mieć co najmniej 6 znaków');
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const result = await login(identifier, password);
      
      if (result.success) {
        Alert.alert(
          "Logowanie pomyślne",
          "Zostałeś pomyślnie zalogowany",
          [
            { 
              text: "OK", 
              onPress: () => router.back() 
            }
          ]
        );
      } else {
        Alert.alert(
          "Błąd logowania",
          result.message || "Nie udało się zalogować. Sprawdź dane logowania i spróbuj ponownie."
        );
      }
    } catch (error) {
      Alert.alert(
        "Błąd",
        "Wystąpił nieoczekiwany błąd podczas logowania. Spróbuj ponownie później."
      );
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const openRegisterModal = () => {
    setRegisterModalVisible(true);
  };

  const closeRegisterModal = () => {
    setRegisterModalVisible(false);
  };

  const openResetPasswordModal = () => {
    setResetPasswordModalVisible(true);
  };

  const closeResetPasswordModal = () => {
    setResetPasswordModalVisible(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <AntDesign name="login" size={80} color="#2196F3" style={styles.icon} />
          <Text style={styles.title}>Logowanie</Text>
          
          <View style={styles.formContainer}>
            {/* Pole identyfikatora (username lub email) */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="person" size={24} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nazwa użytkownika lub email"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>
            {identifierError ? <Text style={styles.errorText}>{identifierError}</Text> : null}

            {/* Pole hasła */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={24} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Hasło"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={toggleShowPassword} style={styles.eyeIcon}>
                <MaterialIcons 
                  name={showPassword ? "visibility" : "visibility-off"} 
                  size={24} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

            {/* Przycisk logowania */}
            <TouchableOpacity 
              style={[styles.loginButton, (!identifier || !password) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading || !identifier || !password}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <AntDesign name="login" size={20} color="#fff" />
                  <Text style={styles.loginButtonText}>Zaloguj się</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Link do rejestracji */}
            <TouchableOpacity 
              style={styles.registerLink}
              onPress={openRegisterModal}
            >
              <Text style={styles.registerLinkText}>
                Nie masz konta? <Text style={styles.registerLinkTextBold}>Zarejestruj się</Text>
              </Text>
            </TouchableOpacity>

            {/* Link do resetowania hasła */}
            <TouchableOpacity 
              style={styles.forgotPasswordLink}
              onPress={openResetPasswordModal}
            >
              <Text style={styles.forgotPasswordText}>Zapomniałeś hasła?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modalne okna */}
      <RegisterModal 
        visible={registerModalVisible} 
        onClose={closeRegisterModal} 
      />
      
      <ResetPasswordModal 
        visible={resetPasswordModalVisible} 
        onClose={closeResetPasswordModal} 
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
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
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
    marginBottom: 32,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  passwordInput: {
    paddingRight: 40, // Miejsce na ikonę oka
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 12,
    marginLeft: 4,
  },
  loginButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
  },
  loginButtonDisabled: {
    backgroundColor: '#a8d1f7',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  registerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 15,
    color: '#666',
  },
  registerLinkTextBold: {
    fontWeight: '600',
    color: '#2196F3',
  },
  forgotPasswordLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 15,
    color: '#2196F3',
  },
}); 