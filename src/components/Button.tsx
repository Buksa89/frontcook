// src/components/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ButtonStyles, Colors } from '../config/theme'; // Importuj tylko ButtonStyles i Colors

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'active' | 'secondary' | 'iconOnly';
  disabled?: boolean;
  isLoading?: boolean;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  style?: ViewStyle; // Dodatkowe style dla *kontenera*
  textStyle?: TextStyle; // Dodatkowe style dla *tekstu*
  iconStyle?: TextStyle; // Dodatkowe style dla *ikony*
  // Dodano opcjonalny prop do oznaczania aktywności przycisku iconOnly
  isActive?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'active',
  disabled = false,
  isLoading = false,
  iconName,
  style,
  textStyle,
  iconStyle,
  isActive = false, // Domyślnie nieaktywny dla iconOnly
}) => {
  const isDisabled = disabled || isLoading;

  // Wybierz odpowiednie style na podstawie stanu i wariantu
  let containerStyle: ViewStyle = ButtonStyles.activeContainer;
  let contentTextStyle: TextStyle = ButtonStyles.activeText;
  let contentIconStyle: TextStyle = ButtonStyles.activeIcon;

  if (isDisabled) {
      containerStyle = isLoading ? ButtonStyles.loadingContainer : ButtonStyles.disabledContainer;
      // Jeśli wariant to nie iconOnly, użyj stylów disabled dla tekstu/ikony
      if (variant !== 'iconOnly') {
          contentTextStyle = ButtonStyles.disabledText;
          contentIconStyle = ButtonStyles.disabledIcon;
      } else {
          // Dla iconOnly disabled, użyj stylów iconOnly, ale z kolorem disabled
          containerStyle = ButtonStyles.iconOnlyContainer; // zachowaj bazowy styl kontenera
          contentIconStyle = { ...ButtonStyles.iconOnlyIcon, color: Colors.disabledText };
      }
  } else {
    switch (variant) {
      case 'secondary':
        containerStyle = ButtonStyles.secondaryContainer;
        contentTextStyle = ButtonStyles.secondaryText;
        contentIconStyle = ButtonStyles.secondaryIcon;
        break;
      case 'iconOnly':
        containerStyle = isActive
             ? { ...ButtonStyles.iconOnlyContainer, ...ButtonStyles.iconOnlyActiveContainer } // Połącz style dla aktywnego
             : ButtonStyles.iconOnlyContainer;
        contentIconStyle = isActive
             ? ButtonStyles.iconOnlyActiveIcon // Użyj stylu aktywnej ikony
             : ButtonStyles.iconOnlyIcon;
        break;
      case 'active':
      default:
        // Domyślne style są już ustawione
        break;
    }
  }

  return (
    <TouchableOpacity
      // Łączymy style bazowe z wariantem i przekazanymi dodatkowymi stylami
      style={[containerStyle, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {isLoading && variant !== 'iconOnly' ? (
        // --- Poprawka: Kolor ActivityIndicator ---
        <ActivityIndicator size="small" color={contentTextStyle.color} />
      ) : (
        <>
          {iconName && (
            <MaterialIcons
              name={iconName}
              size={variant === 'iconOnly' ? 24 : 20}
              // Łączymy styl wariantu ikony z dodatkowym stylem
              style={[contentIconStyle, iconStyle]}
            />
          )}
          {title && variant !== 'iconOnly' && (
             // Łączymy styl wariantu tekstu z dodatkowym stylem
            <Text style={[contentTextStyle, textStyle]}>{title}</Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;