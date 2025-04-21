// src/components/MainMenu.tsx
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { router, Href } from 'expo-router';
import { useAuth } from '../contexts/AuthContext'; // Poprawny import
import ToastComponent, { showToast } from './Toast'; // Poprawny import

interface MainMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: JSX.Element;
  section: 'main' | 'social' | 'account';
  href?: Href;
  onPress?: () => Promise<void> | void; // Może być async
  disabled?: boolean;
  requiresAuth?: boolean;
  hideWhenAuth?: boolean;
  hideWhenNotAuth?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({ visible, onClose }) => {
  const { isAuthenticated, logout } = useAuth(); // Pobierz funkcję logout z kontekstu

  // --- ZMIANA: Implementacja handleLogout ---
  const handleLogout = async () => {
    try {
      await logout(); // Wywołaj funkcję logout z AuthContext
      // AuthContext pokaże toast sukcesu i obsłuży zmianę stanu/przekierowanie
      // Nie ma potrzeby pokazywać drugiego toasta tutaj
      // showToast({ type: 'success', text1: 'Wylogowano', /* ... */ });
    } catch (error) {
      // Błąd został już obsłużony i pokazany jako toast przez AuthContext
      console.error("[MainMenu] Logout error (already handled in context):", error);
      // Nie pokazuj drugiego toasta błędu
      // showToast({ type: 'error', text1: 'Błąd', /* ... */ });
    }
  };
  // --- KONIEC ZMIANY ---

  const handleMenuItemPress = async (item: MenuItem) => {
    if (item.disabled) return;

    if (item.requiresAuth && !isAuthenticated) {
      showToast({
        type: 'warning',
        text1: 'Wymagane logowanie',
        text2: 'Zaloguj się, aby uzyskać dostęp do tej funkcji',
        visibilityTime: 3000,
        position: 'bottom'
      });
      router.push('/login');
      onClose();
      return;
    }

    if (item.href) {
      router.push(item.href);
    } else if (item.onPress) {
      await item.onPress(); // Użyj await, bo onPress może być async (np. logout)
    }
    onClose(); // Zamknij menu po akcji
  };


  const menuItems: MenuItem[] = [
    // Main section (brak)

    // Social section
    {
      id: 'friends',
      label: 'Znajomi',
      icon: <FontAwesome5 name="user-friends" size={22} color="#666" />,
      section: 'social',
      requiresAuth: true,
      disabled: true,
    },
    {
      id: 'stalking',
      label: 'Obserwowane przepisy',
      icon: <FontAwesome5 name="user-secret" size={22} color="#666" />,
      section: 'social',
      disabled: true,
      requiresAuth: true
    },

    // Account section
    {
      id: 'account-settings',
      label: 'Ustawienia',
      icon: <Ionicons name="settings-outline" size={24} color="#666" />,
      section: 'account',
      href: '/settings' // Zakładając, że masz app/settings.tsx
    },
    {
      id: 'login',
      label: 'Zaloguj',
      icon: <AntDesign name="login" size={24} color="#666" />,
      section: 'account',
      hideWhenAuth: true,
      href: '/login'
    },
    {
      id: 'logout',
      label: 'Wyloguj',
      icon: <AntDesign name="logout" size={24} color="#666" />,
      section: 'account',
      hideWhenNotAuth: true,
      onPress: handleLogout // <<< ZMIANA: Przypisanie funkcji handleLogout
    },
    // Debug (warunkowo)
    ...(process.env.NODE_ENV === 'development' || (typeof __DEV__ !== 'undefined' && __DEV__)) // Sprawdź też globalną __DEV__
     ? [{
        id: 'debug',
        label: 'Debug',
        icon: <MaterialIcons name="developer-mode" size={24} color="#666" />,
        section: 'account' as const,
        href: '/debug' as Href
      }] : [],
  ];

  const renderSection = (section: 'main' | 'social' | 'account') => {
    const sectionItems = menuItems.filter(item => item.section === section);
    if (sectionItems.length === 0) return null;

    return (
      <View style={styles.section}>
        {sectionItems.map((item, index) => {
          const isDisabled = item.disabled; // Usunięto sprawdzanie auth, bo handleMenuItemPress to robi
          const shouldHide = (item.hideWhenAuth && isAuthenticated) || (item.hideWhenNotAuth && !isAuthenticated);

          if (shouldHide) return null;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                isDisabled && styles.menuItemDisabled,
                // Usunięto index === sectionItems.length - 1 && styles.menuItemLast
              ]}
              onPress={() => handleMenuItemPress(item)} // Wywołaj wspólną funkcję obsługi
              disabled={isDisabled}
            >
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, isDisabled && styles.iconContainerDisabled]}>
                  {item.icon}
                </View>
                <Text style={[styles.menuItemText, isDisabled && styles.menuItemTextDisabled]}>
                  {item.label}
                </Text>
              </View>
              {item.disabled && (
                <Text style={styles.comingSoonText}>Wkrótce</Text>
              )}
               {/* Usunięto tekst "Wymaga logowania" - obsłużone w handleMenuItemPress */}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <Pressable style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {renderSection('social')}
            {renderSection('account')}
          </ScrollView>
        </Pressable>
      </Pressable>
      {/* ToastComponent jest renderowany globalnie w AppRoot, nie potrzebujemy go tutaj */}
      {/* <ToastComponent /> */}
    </Modal>
  );
};

// Style (bez zmian)
const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'flex-end',
    },
    menuContainer: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '75%',
      paddingBottom: 20,
    },
    menuHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
    },
    menuTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
    },
    section: {
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
      paddingVertical: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    menuItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#f1f3f5',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    iconContainerDisabled: {
      backgroundColor: '#e9ecef',
    },
    menuItemLast: { // Styl usunięty, bo section ma border
       // borderBottomWidth: 0,
    },
    menuItemDisabled: {
      opacity: 0.6,
    },
    menuItemText: {
      fontSize: 16,
      color: '#333',
      flexShrink: 1,
    },
    menuItemTextDisabled: {
      color: '#adb5bd',
    },
    comingSoonText: {
      fontSize: 12,
      color: '#adb5bd',
      fontStyle: 'italic',
      marginLeft: 8,
    },
});

export default MainMenu;