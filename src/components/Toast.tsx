// src/components/Toast.tsx
import React from 'react';
import Toast, { BaseToast, ErrorToast, InfoToast, ToastConfig } from 'react-native-toast-message';
import { ViewStyle, TextStyle } from 'react-native'; // Dodano importy stylów
import { StyleSheet } from 'react-native';

// --- Definicja konfiguracji Toastów (można dostosować style) ---
const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={styles.toastBaseStyle} // Wspólny styl bazowy
      contentContainerStyle={styles.toastContentContainer}
      text1Style={styles.text1Success} // Styl dla sukcesu
      text2Style={styles.text2Style}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={styles.toastErrorStyle} // Styl dla błędu
      contentContainerStyle={styles.toastContentContainer}
      text1Style={styles.text1Style}
      text2Style={styles.text2Style}
    />
  ),
  info: (props) => (
    <InfoToast // Można użyć InfoToast dla odróżnienia
      {...props}
      style={styles.toastInfoStyle} // Styl dla info
      contentContainerStyle={styles.toastContentContainer}
      text1Style={styles.text1Style}
      text2Style={styles.text2Style}
    />
  ),
  warning: (props) => ( // Dodajmy typ 'warning' jeśli go używasz
      <BaseToast
          {...props}
          style={styles.toastWarningStyle} // Styl dla ostrzeżenia
          contentContainerStyle={styles.toastContentContainer}
          text1Style={styles.text1Style}
          text2Style={styles.text2Style}
       />
   ),
};

// --- Style dla Toastów ---
// Użyj StyleSheet do definicji stylów
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
  } as ViewStyle,
  text1Style: {
    fontSize: 15,
    fontWeight: '600',
    color: '#343a40', // Ciemny tekst
  } as TextStyle,
  text1Success: { // Można dostosować styl dla sukcesu
    fontSize: 15,
    fontWeight: '600',
    color: '#0056b3', // Ciemniejszy niebieski
  } as TextStyle,
  text2Style: {
    fontSize: 14,
    color: '#6c757d', // Szary tekst
  } as TextStyle,
});


// --- Komponent Toast ---
// Teraz renderuje faktyczny komponent Toast z konfiguracją
const ToastComponent = () => {
  return <Toast config={toastConfig} />;
};

// --- Funkcja showToast ---
// Teraz faktycznie wywołuje Toast.show
export type ToastType = 'success' | 'error' | 'info' | 'warning'; // Dodano 'warning'
export interface ToastMessage {
  type: ToastType;
  text1?: string;
  text2?: string;
  position?: 'top' | 'bottom';
  visibilityTime?: number;
  autoHide?: boolean;
  topOffset?: number;
  bottomOffset?: number;
  // Możesz dodać inne propsy z react-native-toast-message
}

export const showToast = (options: ToastMessage) => {
  // console.log('Show Toast (Actual):', options); // Możesz zostawić log dla debugowania
  Toast.show({
    ...options, // Przekaż wszystkie opcje
    visibilityTime: options.visibilityTime || 4000, // Domyślny czas
    position: options.position || 'bottom', // Domyślna pozycja
  });
};

export default ToastComponent; // Eksportuj domyślnie komponent