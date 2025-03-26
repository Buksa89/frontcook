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
  ActivityIndicator
} from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import RegisterModal from './RegisterModal';
import ResetPasswordModal from './ResetPasswordModal';
import { useAuth } from '../../context';
import Toast, { showToast } from '../../components/Toast';

export default function AuthScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [identifierError, setIdentifierError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();

  const validateForm = () => {
    let isValid = true;

    // Walidacja identyfikatora (username lub email)
    if (!identifier.trim()) {
      showToast({
        type: 'warning',
        text1: 'Brak danych',
        text2: 'Wprowadź nazwę użytkownika lub email',
        visibilityTime: 2000,
        position: 'bottom'
      });
      isValid = false;
    } else {
      setIdentifierError('');
    }

    // Walidacja hasła
    if (!password) {
      if (isValid) { // Show only if no previous toast is shown
        showToast({
          type: 'warning',
          text1: 'Brak hasła',
          text2: 'Wprowadź hasło',
          visibilityTime: 2000,
          position: 'bottom'
        });
      }
      isValid = false;
    } else if (password.length < 6) {
      if (isValid) { // Show only if no previous toast is shown
        showToast({
          type: 'warning',
          text1: 'Zbyt krótkie hasło',
          text2: 'Hasło musi mieć co najmniej 6 znaków',
          visibilityTime: 2000,
          position: 'bottom'
        });
      }
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      await login(identifier, password);
      
      // Show success toast
      showToast({
        type: 'success',
        text1: 'Zalogowano pomyślnie',
        text2: 'Witamy w aplikacji!',
        visibilityTime: 2000,
        position: 'bottom'
      });
      
      // Jeśli login nie rzucił błędu, znaczy że się udało
      router.push({
        pathname: "/(screens)/RecipeListScreen/RecipeListScreen"
      });
    } catch (error: any) {
      // Don't log expected auth errors as errors in the console
      // Only show them to the user via toast
      showToast({
        type: 'error',
        text1: 'Błąd logowania',
        text2: error?.message || 'Nieprawidłowa nazwa użytkownika lub hasło',
        visibilityTime: 4000,
        position: 'bottom'
      });
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
          <AntDesign name="login" size={80} color="#5c7ba9" style={styles.icon} />
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
      <Toast />
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
    backgroundColor: '#5c7ba9',
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
    color: '#5c7ba9',
  },
  forgotPasswordLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 15,
    color: '#5c7ba9',
  },
}); 