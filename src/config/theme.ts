// src/config/theme.ts
import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';

// --- Paleta Kolorów (Monochrome) ---
export const Colors = {
  background: '#f8f9fa', card: '#ffffff', textPrimary: '#2d3748', textSecondary: '#718096',
  textPlaceholder: '#a0aec0', border: '#e2e8f0', accent: '#5c7ba9', accentLight: '#eef2ff',
  disabledBg: '#e2e8f0', disabledText: '#a0aec0', danger: '#e53e3e', success: '#48bb78',
  warning: '#ecc94b', info: '#5c7ba9', grayLight: '#f1f5f9', grayMedium: '#cbd5e0',
};

// --- Typografia ---
// Używamy Record<string, TextStyle> dla lepszego typowania
export const Typography: Record<string, TextStyle> = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 16 },
  h2: { fontSize: 22, fontWeight: '600', color: Colors.textPrimary, marginBottom: 12 },
  h3: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  body: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  caption: { fontSize: 13, color: Colors.textSecondary },
  link: { fontSize: 15, color: Colors.accent, fontWeight: '500' },
  buttonTextBase: { fontSize: 16, fontWeight: '600', }, // Baza dla tekstu przycisku
  buttonTextWhite: { color: '#ffffff' },
  buttonTextSecondary: { color: Colors.textSecondary, fontWeight: '500', fontSize: 15 },
  buttonTextDisabled: { color: Colors.disabledText },
});

// --- Style Przycisków ---

// Jawne typowanie dla baseButton
const baseButton: ViewStyle = {
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 6,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  minHeight: 44,
  borderWidth: 1,
  borderColor: 'transparent',
};

// Typowanie dla stylów przycisków
interface ButtonNamedStyles {
    // Style kontenera (ViewStyle)
    activeContainer: ViewStyle;
    disabledContainer: ViewStyle;
    loadingContainer: ViewStyle;
    secondaryContainer: ViewStyle;
    iconOnlyContainer: ViewStyle;
    iconOnlyActiveContainer: ViewStyle; // Opcjonalnie dla aktywnej ikonki

    // Style tekstu (TextStyle)
    activeText: TextStyle;
    disabledText: TextStyle;
    secondaryText: TextStyle;

    // Style ikon (TextStyle, bo ikony to komponenty tekstowe)
    activeIcon: TextStyle;
    disabledIcon: TextStyle;
    secondaryIcon: TextStyle;
    iconOnlyIcon: TextStyle;
    iconOnlyActiveIcon: TextStyle; // Opcjonalnie
}

export const ButtonStyles: ButtonNamedStyles = StyleSheet.create({
    // --- Style Kontenera ---
    activeContainer: { ...baseButton, backgroundColor: Colors.accent, borderColor: Colors.accent, },
    disabledContainer: { ...baseButton, backgroundColor: Colors.disabledBg, borderColor: Colors.disabledBg, },
    loadingContainer: { ...baseButton, backgroundColor: Colors.disabledBg, borderColor: Colors.disabledBg, opacity: 0.8, },
    secondaryContainer: { ...baseButton, backgroundColor: Colors.card, borderColor: Colors.border, },
    iconOnlyContainer: { ...baseButton, paddingHorizontal: 12, minWidth: 44, borderWidth: 0, backgroundColor: 'transparent', },
    iconOnlyActiveContainer: { backgroundColor: Colors.accentLight }, // Tło dla aktywnego przycisku tylko z ikoną

    // --- Style Tekstu ---
    activeText: { ...Typography.buttonTextBase, ...Typography.buttonTextWhite },
    disabledText: { ...Typography.buttonTextBase, ...Typography.buttonTextDisabled },
    secondaryText: { ...Typography.buttonTextSecondary }, // Używa zdefiniowanego stylu

    // --- Style Ikon ---
    activeIcon: { color: '#ffffff', marginRight: 8, },
    disabledIcon: { color: Colors.disabledText, marginRight: 8, },
    secondaryIcon: { color: Colors.textSecondary, marginRight: 8, },
    iconOnlyIcon: { color: Colors.textSecondary, /* Brak marginRight */ },
    iconOnlyActiveIcon: { color: Colors.accent }, // Kolor dla aktywnej ikony
});

// --- Domyślny Eksport ---
export default { Colors, Typography, ButtonStyles, };