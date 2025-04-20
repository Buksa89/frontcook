// src/components/Toast.tsx
import React from 'react';
import { View, Text } from 'react-native';
// Później zaimportujemy i skonfigurujemy react-native-toast-message
// import Toast from 'react-native-toast-message';

// Na razie pusty komponent, żeby rozwiązać błąd importu
const ToastComponent = () => {
  // W przyszłości tutaj będzie <Toast config={...} />
  return null; // Na razie nic nie renderujemy
};

// Funkcja do pokazywania toastów (placeholder)
export const showToast = (options: any) => {
  console.log('Show Toast:', options);
  // Później: Toast.show(options);
};

export default ToastComponent;

// Interfejsy (można przenieść do pliku types później)
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
}