import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

export const LoginPrompt: React.FC = () => {
  return (
    <View style={styles.loginPromptSection}>
      <View style={styles.loginPromptCard}>
        <View style={styles.loginPromptHeader}>
          <MaterialIcons name="account-circle" size={32} color="#5c7ba9" />
          <Text style={styles.loginPromptTitle}>Zyskaj więcej możliwości</Text>
        </View>
        <View style={styles.loginPromptFeatures}>
          <View style={styles.loginPromptFeature}>
            <MaterialIcons name="sync" size={20} color="#5c7ba9" />
            <Text style={styles.loginPromptFeatureText}>Synchronizacja między urządzeniami</Text>
          </View>
          <View style={styles.loginPromptFeature}>
            <MaterialIcons name="people" size={20} color="#5c7ba9" />
            <Text style={styles.loginPromptFeatureText}>Funkcje społecznościowe</Text>
          </View>
          <View style={styles.loginPromptFeature}>
            <MaterialIcons name="camera-alt" size={20} color="#5c7ba9" />
            <Text style={styles.loginPromptFeatureText}>Dodawanie przepisów ze zdjęć i stron internetowych</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={() => router.push({
            pathname: '/(screens)/AuthScreen/AuthScreen'
          })}
        >
          <Text style={styles.loginButtonText}>Zaloguj się</Text>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Add default export for Expo Router compatibility
export default LoginPrompt;

const styles = StyleSheet.create({
  loginPromptSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  loginPromptCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loginPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  loginPromptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  loginPromptFeatures: {
    marginBottom: 16,
    gap: 12,
  },
  loginPromptFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loginPromptFeatureText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  loginButton: {
    backgroundColor: '#5c7ba9',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 