// src/components/MainMenu.tsx
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { router, Href } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
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
  href?: Href<any>; // Użycie Href<any> dla zgodności
  onPress?: () => Promise<void> | void;
  disabled?: boolean;
  requiresAuth?: boolean; // Czy wymaga ważnej sesji (isAuthenticated)
  requiresLogin?: boolean; // Czy wymaga tylko bycia zalogowanym (isLoggedIn)
  hideWhenLoggedIn?: boolean; // Ukryj gdy isLoggedIn jest true
  hideWhenLoggedOut?: boolean; // Ukryj gdy isLoggedIn jest false
}


export const MainMenu: React.FC<MainMenuProps> = ({ visible, onClose }) => {
  // Pobierz potrzebne stany i funkcje z kontekstu
  const { isAuthenticated, isLoggedIn, logout, userId, sessionExpired, resetSessionExpired } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      resetSessionExpired();
      // Nawigacja po wylogowaniu jest zarządzana w AuthContext lub przez router
    } catch (error) {
      console.error("[MainMenu] Logout error (handled in context):", error);
    } finally {
        onClose();
    }
  };

  const handleMenuItemPress = async (item: MenuItem) => {
    if (item.disabled) return;

    // 1. Sprawdź, czy sesja wygasła dla akcji wymagających WAŻNEJ sesji
    if (item.requiresAuth && sessionExpired) {
       showToast({
          type: 'error',
          text1: 'Sesja wygasła',
          text2: 'Zaloguj się ponownie, aby użyć tej funkcji.',
          visibilityTime: 4000,
          position: 'bottom'
        });
       onClose();
       router.push('/login'); // Skieruj do logowania
       return;
    }

    // 2. Sprawdź, czy użytkownik jest w ogóle zalogowany dla akcji wymagających bycia zalogowanym
    if (item.requiresLogin && !isLoggedIn) {
       showToast({
          type: 'warning',
          text1: 'Wymagane logowanie',
          text2: 'Zaloguj się, aby uzyskać dostęp do tej funkcji.',
          visibilityTime: 3000,
          position: 'bottom'
        });
       router.push('/login');
       onClose();
       return;
    }

    // 3. Jeśli wymaga ważnej sesji, a nie jest isAuthenticated (ale sesja nie wygasła)
    //    To może się zdarzyć w rzadkich przypadkach niespójności stanu
    if (item.requiresAuth && !isAuthenticated && !sessionExpired) {
         showToast({ type: 'warning', text1: 'Wymagane logowanie', text2: 'Zaloguj się ponownie.' });
         router.push('/login');
         onClose();
         return;
    }


    // Wykonaj akcję
    if (item.href) {
      router.push(item.href);
    } else if (item.onPress) {
      await item.onPress();
    }
    onClose();
  };


  const menuItems: MenuItem[] = [
    // Social section
    {
      id: 'friends',
      label: 'Znajomi',
      icon: <FontAwesome5 name="user-friends" size={22} color="#666" />,
      section: 'social',
      requiresLogin: true, // Wymaga bycia zalogowanym (nawet z wygasłą sesją)
      requiresAuth: true, // Ale do działania wymaga ważnej sesji
      disabled: true,
    },
    {
      id: 'stalking',
      label: 'Obserwowane przepisy',
      icon: <FontAwesome5 name="user-secret" size={22} color="#666" />,
      section: 'social',
      disabled: true,
      requiresLogin: true,
      requiresAuth: true,
    },

    // Account section
    {
      id: 'account-settings',
      label: 'Ustawienia',
      icon: <Ionicons name="settings-outline" size={24} color="#666" />,
      section: 'account',
      href: '/(tabs)/settings', // Poprawiona ścieżka, jeśli settings jest w tabs
      requiresLogin: true, // Wymaga bycia zalogowanym
      // Nie wymaga 'requiresAuth', bo może działać offline? Jeśli wymaga API, dodać requiresAuth: true
    },
    {
      id: 'login',
      label: 'Zaloguj',
      icon: <AntDesign name="login" size={24} color="#666" />,
      section: 'account',
      hideWhenLoggedIn: true, // Ukryj, gdy isLoggedIn jest true
      href: '/login'
    },
    {
      id: 'logout',
      label: 'Wyloguj',
      icon: <AntDesign name="logout" size={24} color="#666" />,
      section: 'account',
      hideWhenLoggedOut: true, // Ukryj, gdy isLoggedIn jest false
      onPress: handleLogout
    },
    // Debug
    ...(process.env.NODE_ENV === 'development' || (typeof __DEV__ !== 'undefined' && __DEV__))
     ? [{ id: 'debug', label: 'Debug', icon: <MaterialIcons name="developer-mode" size={24} color="#666" />, section: 'account' as const, href: '/debug' as Href<any> }] : [],
  ];

  const renderSection = (section: 'main' | 'social' | 'account') => {
    const sectionItems = menuItems.filter(item => item.section === section);
    if (sectionItems.length === 0) return null;

    return (
      <View style={styles.section}>
        {sectionItems.map((item) => {
          const isDisabled = item.disabled;
          // Logika ukrywania oparta na stanie isLoggedIn
          const shouldHide = (item.hideWhenLoggedIn && isLoggedIn) ||
                             (item.hideWhenLoggedOut && !isLoggedIn);

          if (shouldHide) return null;

          // Sprawdź, czy przycisk powinien być wyszarzony z powodu braku logowania LUB wygaśnięcia sesji
          const isVisuallyDisabled = isDisabled ||
                                     (item.requiresLogin && !isLoggedIn) ||
                                     (item.requiresAuth && !isAuthenticated); // Sprawdza oba warunki: brak logowania LUB wygasła sesja

          return (
            <TouchableOpacity
              key={item.id}
              style={[ styles.menuItem, isVisuallyDisabled && styles.menuItemDisabled ]}
              onPress={() => handleMenuItemPress(item)}
              // Logika `disabled` w TouchableOpacity powinna odzwierciedlać tylko faktyczną nieaktywność (item.disabled)
              // Logikę blokowania akcji z powodu braku auth/sesji obsługuje `handleMenuItemPress`
              disabled={isDisabled}
            >
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, isVisuallyDisabled && styles.iconContainerDisabled]}>
                  {item.icon}
                </View>
                <Text style={[styles.menuItemText, isVisuallyDisabled && styles.menuItemTextDisabled]}>
                  {item.label}
                </Text>
              </View>
              {/* Wskaźnik wygaśnięcia sesji przy wylogowaniu */}
              {item.id === 'logout' && sessionExpired && (
                 <MaterialIcons name="warning-amber" size={20} color="#FFA000" style={styles.warningIcon} />
              )}
              {/* Informacja "Wkrótce" */}
              {item.disabled && !sessionExpired && ( <Text style={styles.comingSoonText}>Wkrótce</Text> )}
               {/* Informacja o wygaśnięciu dla zablokowanych opcji */}
              {sessionExpired && (item.requiresAuth || item.requiresLogin) && item.id !== 'logout' && (
                  <MaterialIcons name="lock-clock" size={20} color="#FFA000" style={styles.warningIcon} />
              )}

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
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color="#666" /></TouchableOpacity>
          </View>
          <ScrollView>
            {sessionExpired && (
                <View style={styles.sessionExpiredWarning}>
                    <MaterialIcons name="warning-amber" size={20} color="#FFA000" />
                    <Text style={styles.sessionExpiredText}>Sesja wygasła. Zaloguj się ponownie.</Text>
                </View>
            )}
            {renderSection('social')}
            {renderSection('account')}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end', },
    menuContainer: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 20, paddingTop: 8, },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', },
    menuTitle: { fontSize: 18, fontWeight: '600', color: '#333', },
    section: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 8, },
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, },
    menuItemContent: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 }, // Zmniejszono flexShrink
    iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f3f5', alignItems: 'center', justifyContent: 'center', marginRight: 16, },
    iconContainerDisabled: { backgroundColor: '#e9ecef', opacity: 0.6 },
    menuItemDisabled: { opacity: 0.6, },
    menuItemText: { fontSize: 16, color: '#333', flexShrink: 1, },
    menuItemTextDisabled: { color: '#adb5bd', },
    comingSoonText: { fontSize: 12, color: '#adb5bd', fontStyle: 'italic', marginLeft: 'auto', paddingLeft: 8 }, // Przesunięto na prawo
    sessionExpiredWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEA', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FEF3C7', },
    sessionExpiredText: { marginLeft: 10, color: '#B45309', fontSize: 14, flexShrink: 1, },
    warningIcon: { marginLeft: 'auto', paddingLeft: 8 }, // Wspólny styl dla ikon ostrzeżeń po prawej
});

export default MainMenu;