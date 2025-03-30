import React, { useState, } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const PasswordChange: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSecure, setIsSecure] = useState(true);

  const handleChangePassword = () => {
    // TODO: Implement password change functionality
    console.log('Password change not implemented yet');
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity 
        style={styles.header}
        onPress={toggleExpand}
      >
        <View style={styles.headerContent}>
          <MaterialIcons name="lock" size={24} color="#666" />
          <Text style={styles.title}>Zmiana hasła</Text>
        </View>
        <MaterialIcons 
          name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={24} 
          color="#666" 
        />
      </TouchableOpacity>

      <View style={[
        styles.formContainer,
        { maxHeight: isExpanded ? 500 : 0 }
      ]}>
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Obecne hasło"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={isSecure}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setIsSecure(!isSecure)}
            >
              <MaterialIcons 
                name={isSecure ? "visibility" : "visibility-off"} 
                size={24} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Nowe hasło"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={isSecure}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Potwierdź nowe hasło"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={isSecure}
            />
          </View>

          <TouchableOpacity 
            style={styles.changeButton}
            onPress={handleChangePassword}
          >
            <Text style={styles.changeButtonText}>Zmień hasło</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Hasło powinno zawierać minimum 8 znaków, w tym wielką literę, cyfrę i znak specjalny
          </Text>
        </View>
      </View>
    </View>
  );
};

// Add default export for Expo Router compatibility
export default PasswordChange;

const styles = StyleSheet.create({
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 16,
    color: '#333',
  },
  formContainer: {
    overflow: 'hidden',
  },
  form: {
    marginTop: 16,
    gap: 16,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  changeButton: {
    backgroundColor: '#5c7ba9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
}); 