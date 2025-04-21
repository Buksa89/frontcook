// src/components/Toast.tsx
import React from 'react';
import Toast, { BaseToast, ErrorToast, InfoToast, ToastConfig } from 'react-native-toast-message';
import { ViewStyle, TextStyle, StyleSheet } from 'react-native';

// --- Definicja konfiguracji Toastów ---
const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={styles.toastBaseStyle}
      contentContainerStyle={styles.toastContentContainer}
      text1Style={styles.text1Success}
      text2Style={styles.text2Style}
      // Można dodać text1NumberOfLines i text2NumberOfLines, jeśli potrzeba
      // text1NumberOfLines={2}
      // text2NumberOfLines={4}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={styles.toastErrorStyle}
      contentContainerStyle={styles.toastContentContainer}
      text1Style={styles.text1Style} // Użyj standardowego dla error
      text2Style={styles.text2Style}
      // text1NumberOfLines={2}
      // text2NumberOfLines={4}
    />
  ),
  info: (props) => (
    <InfoToast
      {...props}
      style={styles.toastInfoStyle}
      contentContainerStyle={styles.toastContentContainer}
      text1Style={styles.text1Style}
      text2Style={styles.text2Style}
      // text1NumberOfLines={2}
      // text2NumberOfLines={4}
    />
  ),
  warning: (props) => (
      <BaseToast
          {...props}
          style={styles.toastWarningStyle}
          contentContainerStyle={styles.toastContentContainer}
          text1Style={styles.text1Style}
          text2Style={styles.text2Style}
          // text1NumberOfLines={2}
          // text2NumberOfLines={4}
       />
   ),
};

// --- Style dla Toastów ---
const styles = StyleSheet.create({
  toastBaseStyle: {
    borderLeftColor: '#5c7ba9', // Kolor akcentujący
    backgroundColor: '#f8f9fa', // Jasne tło
    height: 'auto', // Automatyczna wysokość
    minHeight: 60,
    width: '90%',
    borderRadius: 8,
  } as ViewStyle,
  toastErrorStyle: {
    borderLeftColor: '#e53e3e', // Czerwony
    backgroundColor: '#fff0f0', // Jasnoczerwone tło
    height: 'auto',
    minHeight: 60,
    width: '90%',
    borderRadius: 8,
  } as ViewStyle,
  toastInfoStyle: {
    borderLeftColor: '#6c757d', // Szary
    backgroundColor: '#f8f9fa',
    height: 'auto',
    minHeight: 60,
    width: '90%',
    borderRadius: 8,
  } as ViewStyle,
   toastWarningStyle: {
      borderLeftColor: '#ffc107', // Żółty
      backgroundColor: '#fff9e6', // Jasnożółte tło
      height: 'auto',
      minHeight: 60,
      width: '90%',
      borderRadius: 8,
  } as ViewStyle,
  toastContentContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10, // Dodaj pionowy padding
  } as ViewStyle,
  text1Style: {
    fontSize: 15,
    fontWeight: '600',
    color: '#343a40', // Ciemny tekst
  } as TextStyle,
  text1Success: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0056b3', // Ciemniejszy niebieski
  } as TextStyle,
  text2Style: {
    fontSize: 14,
    color: '#6c757d', // Szary tekst
    marginTop: 4, // Mały odstęp od tytułu
  } as TextStyle,
});


// --- Komponent Toast ---
const ToastComponent = () => {
  // Ustaw domyślne propsy globalnie
  return <Toast config={toastConfig} bottomOffset={40} />;
};

// --- Interfejs ToastMessage ---
export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastMessage {
  type: ToastType;
  text1?: string;
  text2?: string;
  position?: 'top' | 'bottom';
  visibilityTime?: number;
  autoHide?: boolean;
  topOffset?: number;
  bottomOffset?: number;
  // ZMIANA: Dodano opcjonalną właściwość onHide
  onHide?: () => void; // Funkcja wywoływana po ukryciu toasta
  onShow?: () => void; // Opcjonalnie: funkcja po pokazaniu
  onPress?: () => void; // Opcjonalnie: funkcja po kliknięciu
}

// --- Funkcja showToast ---
export const showToast = (options: ToastMessage) => {
  // console.log('Show Toast (Actual):', options); // Możesz zostawić log dla debugowania
  Toast.show({
    ...options, // Przekaż wszystkie opcje
    visibilityTime: options.visibilityTime || 4000, // Domyślny czas
    position: options.position || 'bottom', // Domyślna pozycja
  });
};

export default ToastComponent;