import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useAuth } from '../../context';

interface ResetPasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ResetPasswordModal({ visible, onClose }: ResetPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const { resetPassword } = useAuth();

  const validateEmail = () => {
    if (!email.trim()) {
      setEmailError('Wprowadź adres email');
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Wprowadź poprawny adres email');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSendResetLink = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    setEmailError('');

    try {
      await resetPassword(email);
      setIsSent(true);
    } catch (error: any) {
      console.error("Reset password error:", error);
      
      // Obsługa błędów walidacji z API
      if (error.response?.data) {
        const apiErrors = error.response.data;
        
        if (apiErrors.email) {
          const errorMessage = Array.isArray(apiErrors.email) 
            ? apiErrors.email.join(', ') 
            : apiErrors.email;
          setEmailError(errorMessage);
          Alert.alert(
            "Błąd resetowania hasła",
            errorMessage,
            [{ text: "OK" }]
          );
        } else if (apiErrors.non_field_errors) {
          const errorMessage = Array.isArray(apiErrors.non_field_errors)
            ? apiErrors.non_field_errors.join(', ')
            : apiErrors.non_field_errors;
          setEmailError(errorMessage);
          Alert.alert(
            "Błąd resetowania hasła",
            errorMessage,
            [{ text: "OK" }]
          );
        } else {
          setEmailError('Nie udało się wysłać linku resetującego. Spróbuj ponownie.');
          Alert.alert(
            "Błąd resetowania hasła",
            'Nie udało się wysłać linku resetującego. Spróbuj ponownie.',
            [{ text: "OK" }]
          );
        }
      } else {
        const errorMessage = error.message || 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.';
        setEmailError(errorMessage);
        Alert.alert(
          "Błąd resetowania hasła",
          errorMessage,
          [{ text: "OK" }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Resetujemy stan przy zamknięciu
    setIsSent(false);
    setEmail('');
    setEmailError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={handleClose}
        >
          <Pressable style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Resetowanie hasła</Text>
              <TouchableOpacity onPress={handleClose}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              {!isSent ? (
                <>
                  <Text style={styles.instructionText}>
                    Podaj adres email powiązany z Twoim kontem, a my wyślemy Ci link do zresetowania hasła.
                  </Text>
                  
                  {/* Pole email */}
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="email" size={24} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (emailError) validateEmail();
                      }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                  
                  {/* Przycisk wysyłania */}
                  <TouchableOpacity 
                    style={[styles.sendButton, (isLoading || !email.trim()) && styles.sendButtonDisabled]}
                    onPress={handleSendResetLink}
                    disabled={isLoading || !email.trim()}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Feather name="send" size={20} color="#fff" />
                        <Text style={styles.sendButtonText}>Wyślij link resetujący</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.successContainer}>
                  <Feather name="check-circle" size={60} color="#4CAF50" style={styles.successIcon} />
                  <Text style={styles.successTitle}>Link wysłany!</Text>
                  <Text style={styles.successText}>
                    Sprawdź swoją skrzynkę email. Wysłaliśmy link do resetowania hasła na adres {email}.
                  </Text>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={handleClose}
                  >
                    <Text style={styles.closeButtonText}>Zamknij</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
    maxHeight: '70%',
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
  instructionText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 24,
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
  sendButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  sendButtonDisabled: {
    backgroundColor: '#a8d1f7',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  successContainer: {
    alignItems: 'center',
    padding: 16,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  closeButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  closeButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 16,
    marginLeft: 4,
  },
}); 