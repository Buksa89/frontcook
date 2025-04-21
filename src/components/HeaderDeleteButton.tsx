// src/components/HeaderDeleteButton.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../config/theme'; // Importuj kolory z motywu

interface HeaderDeleteButtonProps {
  onPress: () => void;
  disabled?: boolean;
  isLoading?: boolean; // Opcjonalnie, jeśli usuwanie jest asynchroniczne
  color?: string; // Opcjonalnie, aby nadpisać domyślny kolor
}

export const HeaderDeleteButton: React.FC<HeaderDeleteButtonProps> = ({
  onPress,
  disabled = false,
  isLoading = false,
  color = Colors.danger, // Domyślnie czerwony kolor niebezpieczeństwa
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.disabled]}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Zwiększa obszar klikalny
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <MaterialIcons name="delete-sweep" size={24} color={isDisabled ? Colors.disabledText : color} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    marginRight: 16, // Standardowy margines w nagłówku
    padding: 4, // Niewielki padding wokół ikony
  },
  disabled: {
    opacity: 0.5,
  },
});

export default HeaderDeleteButton;