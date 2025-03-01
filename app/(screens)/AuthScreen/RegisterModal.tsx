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
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { useAuth } from '../../context';

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
      newErrors.username = 'Wprowadź nazwę użytkownika';
      isValid = false;
    } else if (username.length < 3) {
      newErrors.username = 'Nazwa użytkownika musi mieć co najmniej 3 znaki';
      isValid = false;
    }

    // Walidacja email
    if (!email.trim()) {
      newErrors.email = 'Wprowadź adres email';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Wprowadź poprawny adres email';
      isValid = false;
    }

    // Walidacja hasła
    if (!password) {
      newErrors.password = 'Wprowadź hasło';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Hasło musi mieć co najmniej 6 znaków';
      isValid = false;
    }

    // Walidacja potwierdzenia hasła
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Potwierdź hasło';
      isValid = false;
    } else if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Hasła nie są identyczne';
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
      const result = await register(username, email, password);
      
      if (result.success) {
        Alert.alert(
          "Rejestracja pomyślna",
          "Twoje konto zostało utworzone. Możesz się teraz zalogować.",
          [{ text: "OK", onPress: () => onClose() }]
        );
      } else {
        // Obsługa błędów pól formularza
        if (result.fieldErrors) {
          const newErrors = { ...errors };
          const alertMessages: string[] = [];
          
          // Mapowanie błędów z API na pola formularza
          if (result.fieldErrors.username) {
            newErrors.username = result.fieldErrors.username.join(', ');
            alertMessages.push(`Nazwa użytkownika: ${result.fieldErrors.username.join(', ')}`);
          }
          
          if (result.fieldErrors.email) {
            newErrors.email = result.fieldErrors.email.join(', ');
            alertMessages.push(`Email: ${result.fieldErrors.email.join(', ')}`);
          }
          
          if (result.fieldErrors.password) {
            newErrors.password = result.fieldErrors.password.join(', ');
            alertMessages.push(`Hasło: ${result.fieldErrors.password.join(', ')}`);
          }
          
          if (result.fieldErrors.password2) {
            newErrors.confirmPassword = result.fieldErrors.password2.join(', ');
            alertMessages.push(`Potwierdzenie hasła: ${result.fieldErrors.password2.join(', ')}`);
          }
          
          // Błędy niezwiązane z konkretnym polem
          if (result.fieldErrors.non_field_errors) {
            setErrorMessage(result.fieldErrors.non_field_errors.join(', '));
            alertMessages.push(result.fieldErrors.non_field_errors.join(', '));
          } else if (result.message) {
            setErrorMessage(result.message);
            alertMessages.push(result.message);
          }
          
          setErrors(newErrors);
          
          // Wyświetl alert z błędami
          if (alertMessages.length > 0) {
            Alert.alert(
              "Błąd rejestracji",
              alertMessages.join('\n\n'),
              [{ text: "OK" }]
            );
          }
        } else if (result.message) {
          setErrorMessage(result.message);
          Alert.alert(
            "Błąd rejestracji",
            result.message,
            [{ text: "OK" }]
          );
        } else {
          setErrorMessage('Wystąpił błąd podczas rejestracji');
          Alert.alert(
            "Błąd rejestracji",
            'Wystąpił błąd podczas rejestracji',
            [{ text: "OK" }]
          );
        }
      }
    } catch (error) {
      console.error('Błąd rejestracji:', error);
      setErrorMessage('Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.');
      Alert.alert(
        "Błąd",
        'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.',
        [{ text: "OK" }]
      );
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
    backgroundColor: '#2196F3',
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