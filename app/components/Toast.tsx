import React from 'react';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { StyleSheet } from 'react-native';

/**
 * Typy dostępnych notyfikacji
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Interfejs dla parametrów notyfikacji
 */
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

/* Konfiguracja toastów */
const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ 
        backgroundColor: '#28a745', 
        borderLeftWidth: 0, 
        borderRadius: 8,
        width: '90%',
        height: 'auto',
        minHeight: 70,
        paddingVertical: 15,
        paddingHorizontal: 15,
        alignItems: 'center'
      }}
      contentContainerStyle={{ 
        paddingHorizontal: 15,
        justifyContent: 'center',
        flex: 1
      }}
      text1Style={{ 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: 'white',
        textAlign: 'center'
      }}
      text2Style={{ 
        fontSize: 16, 
        color: 'white', 
        lineHeight: 22,
        textAlign: 'center'
      }}
      text1NumberOfLines={3}
      text2NumberOfLines={10}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ 
        backgroundColor: '#dc3545', 
        borderLeftWidth: 0, 
        borderRadius: 8,
        width: '90%',
        height: 'auto',
        minHeight: 70,
        paddingVertical: 15,
        paddingHorizontal: 15,
        alignItems: 'center'
      }}
      contentContainerStyle={{ 
        paddingHorizontal: 15,
        justifyContent: 'center',
        flex: 1
      }}
      text1Style={{ 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: 'white',
        textAlign: 'center'
      }}
      text2Style={{ 
        fontSize: 16, 
        color: 'white', 
        lineHeight: 22,
        textAlign: 'center'
      }}
      text1NumberOfLines={3}
      text2NumberOfLines={10}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{ 
        backgroundColor: '#17a2b8', 
        borderLeftWidth: 0, 
        borderRadius: 8,
        width: '90%',
        height: 'auto',
        minHeight: 70,
        paddingVertical: 15,
        paddingHorizontal: 15,
        alignItems: 'center'
      }}
      contentContainerStyle={{ 
        paddingHorizontal: 15,
        justifyContent: 'center',
        flex: 1
      }}
      text1Style={{ 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: 'white',
        textAlign: 'center'
      }}
      text2Style={{ 
        fontSize: 16, 
        color: 'white', 
        lineHeight: 22,
        textAlign: 'center'
      }}
      text1NumberOfLines={3}
      text2NumberOfLines={10}
    />
  ),
  warning: (props) => (
    <BaseToast
      {...props}
      style={{ 
        backgroundColor: '#ffc107', 
        borderLeftWidth: 0, 
        borderRadius: 8,
        width: '90%',
        height: 'auto',
        minHeight: 70,
        paddingVertical: 15,
        paddingHorizontal: 15,
        alignItems: 'center'
      }}
      contentContainerStyle={{ 
        paddingHorizontal: 15,
        justifyContent: 'center',
        flex: 1
      }}
      text1Style={{ 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: 'white',
        textAlign: 'center'
      }}
      text2Style={{ 
        fontSize: 16, 
        color: 'white', 
        lineHeight: 22,
        textAlign: 'center'
      }}
      text1NumberOfLines={3}
      text2NumberOfLines={10}
    />
  )
};

/**
 * Komponent do wyświetlania notyfikacji
 */
export const ToastComponent = () => (
  <Toast 
    config={toastConfig} 
    position="bottom" 
    bottomOffset={120}
  />
);

/**
 * Funkcja pomocnicza do wyświetlania notyfikacji
 */
export const showToast = ({ 
  type = 'info', 
  text1 = '', 
  text2 = '', 
  position = 'bottom',
  visibilityTime = 8000,
  autoHide = true,
  topOffset = 40,
  bottomOffset = 120
}: ToastMessage) => {
  setTimeout(() => {
    Toast.show({
      type,
      text1,
      text2,
      position,
      visibilityTime,
      autoHide,
      topOffset,
      bottomOffset,
    });
  }, 100);
};

const styles = StyleSheet.create({});

export default ToastComponent; 