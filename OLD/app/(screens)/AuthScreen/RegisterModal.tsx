import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { useAuth } from '../../context';
import Toast, { showToast } from '../../components/Toast';

interface RegisterModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RegisterModal({ visible, onClose }: RegisterModalProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errorMessage, setErrorMessage] = useState('');

  const { register } = useAuth();

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const validateForm = () => {
    const newErrors = {
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    };
    let isValid = true;

    // Walidacja nazwy użytkownika
    if (!username.trim()) {
      showToast({
        type: 'warning',
        text1: 'Brak nazwy użytkownika',
        text2: 'Wprowadź nazwę użytkownika',
        visibilityTime: 2000,
        position: 'bottom'
      });
      isValid = false;
    } else if (username.length < 3) {
      showToast({
        type: 'warning',
        text1: 'Zbyt krótka nazwa',
        text2: 'Nazwa użytkownika musi mieć co najmniej 3 znaki',
        visibilityTime: 2000,
        position: 'bottom'
      });
      isValid = false;
    }

    // Walidacja email
    if (!email.trim()) {
      if (isValid) { // Show only if no previous toast is shown
        showToast({
          type: 'warning',
          text1: 'Brak adresu email',
          text2: 'Wprowadź adres email',
          visibilityTime: 2000,
          position: 'bottom'
        });
      }
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      if (isValid) { // Show only if no previous toast is shown
        showToast({
          type: 'warning',
          text1: 'Niepoprawny email',
          text2: 'Wprowadź poprawny adres email',
          visibilityTime: 2000,
          position: 'bottom'
        });
      }
      isValid = false;
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
    }

    // Walidacja potwierdzenia hasła
    if (!confirmPassword) {
      if (isValid) { // Show only if no previous toast is shown
        showToast({
          type: 'warning',
          text1: 'Brak potwierdzenia',
          text2: 'Potwierdź hasło',
          visibilityTime: 2000,
          position: 'bottom'
        });
      }
      isValid = false;
    } else if (confirmPassword !== password) {
      if (isValid) { // Show only if no previous toast is shown
        showToast({
          type: 'warning',
          text1: 'Hasła nie pasują',
          text2: 'Hasła nie są identyczne',
          visibilityTime: 2000,
          position: 'bottom'
        });
      }
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setErrorMessage('');
    
    // Resetuj błędy formularza
    setErrors({
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    });

    try {
      await register(username, email, password, confirmPassword);
      // Jeśli nie było błędu, rejestracja się powiodła
      showToast({
        type: 'success',
        text1: 'Rejestracja udana',
        text2: 'Możesz teraz zalogować się na swoje konto',
        visibilityTime: 3000,
        position: 'bottom'
      });
      onClose();
    } catch (error: any) {
      console.error('Błąd rejestracji:', error);
      
      // Obsługa błędów walidacji z API
      if (error.response?.data) {
        const apiErrors = error.response.data;
        const newErrors = { ...errors };
        const errorMessages: string[] = [];

        // Mapowanie błędów z API na pola formularza
        if (apiErrors.username) {
          newErrors.username = Array.isArray(apiErrors.username) 
            ? apiErrors.username.join(', ') 
            : apiErrors.username;
          errorMessages.push(`Nazwa użytkownika: ${newErrors.username}`);
        }

        if (apiErrors.email) {
          newErrors.email = Array.isArray(apiErrors.email) 
            ? apiErrors.email.join(', ') 
            : apiErrors.email;
          errorMessages.push(`Email: ${newErrors.email}`);
        }

        if (apiErrors.password) {
          newErrors.password = Array.isArray(apiErrors.password) 
            ? apiErrors.password.join(', ') 
            : apiErrors.password;
          errorMessages.push(`Hasło: ${newErrors.password}`);
        }

        if (apiErrors.password2) {
          newErrors.confirmPassword = Array.isArray(apiErrors.password2) 
            ? apiErrors.password2.join(', ') 
            : apiErrors.password2;
          errorMessages.push(`Potwierdzenie hasła: ${newErrors.confirmPassword}`);
        }

        // Błędy niezwiązane z konkretnym polem
        if (apiErrors.non_field_errors) {
          const nonFieldError = Array.isArray(apiErrors.non_field_errors) 
            ? apiErrors.non_field_errors.join(', ') 
            : apiErrors.non_field_errors;
          setErrorMessage(nonFieldError);
          errorMessages.push(nonFieldError);
        }

        setErrors(newErrors);

        // Wyświetl toast z błędami zamiast alert
        if (errorMessages.length > 0) {
          showToast({
            type: 'error',
            text1: 'Błąd rejestracji',
            text2: errorMessages.join(' | '),
            visibilityTime: 5000,
            position: 'bottom'
          });
        }
      } else {
        // Ogólny błąd
        const errorMessage = error.message || 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.';
        setErrorMessage(errorMessage);
        showToast({
          type: 'error',
          text1: 'Błąd rejestracji',
          text2: errorMessage,
          visibilityTime: 4000,
          position: 'bottom'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={onClose}
        >
          <Pressable style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rejestracja</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {/* Pole nazwy użytkownika */}
              <View style={styles.inputContainer}>
                <MaterialIcons name="person" size={24} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nazwa użytkownika"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
              {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
              
              {/* Pole email */}
              <View style={styles.inputContainer}>
                <MaterialIcons name="email" size={24} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              
              {/* Pole hasła */}
              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={24} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Hasło"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={toggleShowPassword} style={styles.eyeIcon}>
                  <MaterialIcons 
                    name={showPassword ? "visibility" : "visibility-off"} 
                    size={24} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              
              {/* Pole potwierdzenia hasła */}
              <View style={styles.inputContainer}>
                <MaterialIcons name="lock" size={24} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Potwierdź hasło"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
              
              {/* Wyświetlanie ogólnego błędu */}
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              
              {/* Przycisk rejestracji */}
              <TouchableOpacity 
                style={[
                  styles.registerButton, 
                  (isLoading || !username || !email || !password || !confirmPassword) && styles.registerButtonDisabled
                ]}
                onPress={handleRegister}
                disabled={isLoading || !username || !email || !password || !confirmPassword}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <AntDesign name="adduser" size={20} color="#fff" />
                    <Text style={styles.registerButtonText}>Zarejestruj się</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <Text style={styles.termsText}>
                Rejestrując się, akceptujesz nasze Warunki korzystania z usługi i Politykę prywatności.
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <Toast />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 16,
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
  registerButton: {
    backgroundColor: '#5c7ba9',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    flexDirection: 'row',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 12,
    marginLeft: 4,
  },
  registerButtonDisabled: {
    backgroundColor: '#a8d1f7',
  },
}); 