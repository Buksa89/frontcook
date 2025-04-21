// src/components/MainMenu.tsx
import React, { useState } from 'react'; // Dodano useState
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native'; // Dodano ActivityIndicator
import { MaterialIcons, Ionicons, FontAwesome5, AntDesign, Feather } from '@expo/vector-icons'; // Dodano Feather
import { router, Href } from 'expo-router';
import { useAuth } from '../contexts/AuthContext'; // Importujemy kontekst auth
import { showToast } from './Toast'; // Importujemy showToast

interface MainMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: JSX.Element;
  section: 'main' | 'social' | 'account';
  href?: Href<any>;
  onPress?: () => Promise<void> | void;
  disabled?: boolean;       // Czy opcja jest technicznie wyłączona (np. 'Wkrótce')
  requiresAuth?: boolean;   // Czy wymaga WAŻNEJ sesji (token + user_id + !sessionExpired)
  requiresLogin?: boolean;  // Czy wymaga tylko bycia zalogowanym (user_id)
  hideWhenLoggedIn?: boolean; // Ukryj, gdy isLoggedIn jest true
  hideWhenLoggedOut?: boolean; // Ukryj, gdy isLoggedIn jest false
}


export const MainMenu: React.FC<MainMenuProps> = ({ visible, onClose }) => {
  // Pobierz potrzebne stany i funkcje z kontekstu
  const {
    isAuthenticated, // Ma ważny token i ID, sesja NIE wygasła
    isLoggedIn,     // Ma ID użytkownika (nawet jeśli sesja wygasła)
    sessionExpired, // Czy sesja wygasła (refresh token nie działa)
    logout,
    resetSessionExpired, // Do użycia w handleLogout
    userId // Potrzebne? Może do debugowania
   } = useAuth();

  const [isLoggingOut, setIsLoggingOut] = useState(false); // Stan dla wskaźnika ładowania

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout(); // logout w AuthContext już resetuje sessionExpired
      // Nawigacja jest zarządzana w AuthContext.logout
    } catch (error) {
      console.error("[MainMenu] Logout error (handled in context):", error);
      // Toast jest pokazywany w AuthContext
    } finally {
        // Resetuj stan ładowania i zamknij menu TYLKO jeśli logout się zakończył
        // Jeśli logout powoduje nawigację, menu może zniknąć samo
        setIsLoggingOut(false);
        onClose();
    }
  };

  // Akcja dla przycisku "Zaloguj" (gdy sesja wygasła)
  const handleLoginAgain = () => {
    onClose();
    router.push('/login'); // Skieruj do logowania
  };

  // Logika kliknięcia elementu menu
  const handleMenuItemPress = async (item: MenuItem) => {
    // 1. Sprawdź, czy opcja jest technicznie wyłączona
    if (item.disabled) {
        showToast({ type: 'info', text1: 'Funkcja wkrótce dostępna', visibilityTime: 2000 });
        return;
    }

    // 2. Sprawdź, czy wymaga bycia zalogowanym (isLoggedIn)
    if (item.requiresLogin && !isLoggedIn) {
       showToast({ type: 'warning', text1: 'Wymagane logowanie', text2: 'Zaloguj się, aby użyć tej funkcji.', position: 'bottom' });
       onClose();
       router.push('/login');
       return;
    }

    // 3. Sprawdź, czy wymaga WAŻNEJ sesji (isAuthenticated)
    if (item.requiresAuth && !isAuthenticated) {
        // Jeśli sesja wygasła, pokaż dedykowany komunikat
        if (sessionExpired) {
            showToast({ type: 'error', text1: 'Sesja wygasła', text2: 'Zaloguj się ponownie, aby użyć tej funkcji.', position: 'bottom', visibilityTime: 4000 });
        } else {
            // Jeśli nie jest authenticated z innego powodu (powinno być rzadkie)
            showToast({ type: 'warning', text1: 'Wymagane logowanie', text2: 'Zaloguj się, aby użyć tej funkcji.', position: 'bottom' });
        }
        onClose();
        router.push('/login');
        return;
    }

    // Wykonaj akcję
    if (item.href) {
      router.push(item.href);
    } else if (item.onPress) {
      await item.onPress(); // Poczekaj na zakończenie onPress (np. logout)
    }
    // Zamknij menu, jeśli onPress nie zamknęło go samo (np. przez nawigację)
     if (item.id !== 'logout' || !isLoggingOut) { // Nie zamykaj, jeśli logout trwa
        onClose();
    }
  };


  const menuItems: MenuItem[] = [
    // Social section
    {
      id: 'friends', label: 'Znajomi',
      icon: <FontAwesome5 name="user-friends" size={22} color="#666" />, section: 'social',
      requiresLogin: true, requiresAuth: true, disabled: true,
    },
    {
      id: 'stalking', label: 'Obserwowane przepisy',
      icon: <FontAwesome5 name="user-secret" size={22} color="#666" />, section: 'social',
      requiresLogin: true, requiresAuth: true, disabled: true,
    },

    // Account section
    {
      id: 'account-settings', label: 'Ustawienia',
      icon: <Ionicons name="settings-outline" size={24} color="#666" />, section: 'account',
      href: '/(tabs)/settings',
      requiresLogin: true, // Można edytować offline, ale wymaga bycia zalogowanym
      // Nie wymaga 'requiresAuth', chyba że jakaś opcja w ustawieniach wymaga API
    },
    {
      id: 'login', label: 'Zaloguj', // Widoczne tylko gdy użytkownik jest wylogowany LUB sesja wygasła
      icon: <AntDesign name="login" size={24} color="#666" />, section: 'account',
      // --- NOWA LOGIKA WIDOCZNOŚCI ---
      // Pokaż jeśli: !isLoggedIn LUB (isLoggedIn ORAZ sessionExpired)
      // Ukryj jeśli: isLoggedIn ORAZ !sessionExpired (czyli sesja jest ważna)
      hideWhenLoggedIn: !sessionExpired, // Ukryj tylko, gdy zalogowany i sesja WAŻNA
      hideWhenLoggedOut: false, // Nigdy nie ukrywaj, gdy wylogowany
      onPress: handleLoginAgain, // Akcja dla tego przycisku
    },
    {
      id: 'logout', label: 'Wyloguj', // Widoczne tylko gdy sesja jest ważna
      icon: <AntDesign name="logout" size={24} color="#666" />, section: 'account',
      // --- NOWA LOGIKA WIDOCZNOŚCI ---
      // Pokaż tylko jeśli: isLoggedIn ORAZ !sessionExpired
      // Ukryj jeśli: !isLoggedIn LUB sessionExpired
      hideWhenLoggedIn: sessionExpired, // Ukryj, gdy zalogowany, ALE sesja wygasła
      hideWhenLoggedOut: true, // Ukryj, gdy wylogowany
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
          // Logika ukrywania elementu
          const shouldHide = (item.hideWhenLoggedIn && isLoggedIn) ||
                             (item.hideWhenLoggedOut && !isLoggedIn);
          if (shouldHide) return null;

          // Sprawdź, czy przycisk powinien być wizualnie wyszarzony
          // Wyszarzaj, jeśli:
          // 1. Opcja jest technicznie wyłączona (disabled: true)
          // 2. Wymaga logowania, a użytkownik nie jest zalogowany
          // 3. Wymaga ważnej sesji, a sesja wygasła (lub nie jest zalogowany)
          const isVisuallyDisabled = item.disabled ||
                                     (item.requiresLogin && !isLoggedIn) ||
                                     (item.requiresAuth && (!isLoggedIn || sessionExpired));

          // Czy przycisk jest faktycznie klikalny?
          // Nieklikalny, jeśli:
          // 1. Technicznie wyłączony
          // 2. Wymaga logowania, a nie jest zalogowany
          // 3. Wymaga ważnej sesji, a nie jest zalogowany LUB sesja wygasła
          const isActuallyDisabled = item.disabled ||
                                     (item.requiresLogin && !isLoggedIn) ||
                                     (item.requiresAuth && (!isLoggedIn || sessionExpired));

          return (
            <TouchableOpacity
              key={item.id}
              style={[ styles.menuItem, isVisuallyDisabled && styles.menuItemDisabled ]}
              onPress={() => handleMenuItemPress(item)}
              disabled={isActuallyDisabled || (item.id === 'logout' && isLoggingOut)} // Wyłącz też logout podczas procesu
            >
              <View style={styles.menuItemContent}>
                <View style={[styles.iconContainer, isVisuallyDisabled && styles.iconContainerDisabled]}>
                  {item.icon}
                </View>
                <Text style={[styles.menuItemText, isVisuallyDisabled && styles.menuItemTextDisabled]}>
                  {item.label}
                </Text>
              </View>

              {/* Ikona ładowania dla wylogowania */}
              {item.id === 'logout' && isLoggingOut && (
                  <ActivityIndicator size="small" color="#666" style={styles.activityIndicator} />
              )}

              {/* Ikona ostrzeżenia przy "Zaloguj", jeśli sesja wygasła */}
              {item.id === 'login' && isLoggedIn && sessionExpired && (
                 <MaterialIcons name="warning-amber" size={20} color="#FFA000" style={styles.warningIcon} />
              )}

              {/* Informacja "Wkrótce" */}
              {item.disabled && (<Text style={styles.comingSoonText}>Wkrótce</Text>)}

               {/* Ikona blokady dla opcji wymagających ważnej sesji, gdy sesja wygasła */}
               {sessionExpired && (item.requiresAuth) && item.id !== 'login' && (
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
            {/* Ostrzeżenie o wygaśnięciu sesji na górze */}
            {isLoggedIn && sessionExpired && (
                <View style={styles.sessionExpiredWarning}>
                    <MaterialIcons name="warning-amber" size={20} color="#B45309" />
                    <Text style={styles.sessionExpiredText}>Sesja wygasła. Zaloguj się ponownie, aby synchronizować dane.</Text>
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

// Style (dodano styl activityIndicator)
const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end', },
    menuContainer: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 20, paddingTop: 8, },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', },
    menuTitle: { fontSize: 18, fontWeight: '600', color: '#333', },
    section: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 8, },
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20, },
    menuItemContent: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 },
    iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f3f5', alignItems: 'center', justifyContent: 'center', marginRight: 16, },
    iconContainerDisabled: { backgroundColor: '#e9ecef', opacity: 0.6 },
    menuItemDisabled: { opacity: 0.6, },
    menuItemText: { fontSize: 16, color: '#333', flexShrink: 1, },
    menuItemTextDisabled: { color: '#adb5bd', },
    comingSoonText: { fontSize: 12, color: '#adb5bd', fontStyle: 'italic', marginLeft: 'auto', paddingLeft: 8 },
    sessionExpiredWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEA', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FEF3C7', },
    sessionExpiredText: { marginLeft: 10, color: '#B45309', fontSize: 14, flexShrink: 1, },
    warningIcon: { marginLeft: 'auto', paddingLeft: 8 },
    activityIndicator: { marginLeft: 'auto', paddingLeft: 8 }, // Styl dla ActivityIndicator
});

export default MainMenu;