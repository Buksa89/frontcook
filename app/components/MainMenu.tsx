import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../context';
import Toast, { showToast } from '../components/Toast';

interface MainMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: JSX.Element;
  section: 'main' | 'social' | 'account';
  disabled?: boolean;
  requiresAuth?: boolean;
  hideWhenAuth?: boolean;
  hideWhenNotAuth?: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({ visible, onClose }) => {
  const { isAuthenticated, logout } = useAuth();

  const handleMenuItemPress = async (id: string) => {
    const navigate = (screen: string) => {
      router.push({
        pathname: screen
      } as any); // Tymczasowe obejście problemu z typami
    };

    switch (id) {
      case 'friends':
        navigate('/(screens)/FriendsScreen/FriendsScreen');
        break;
      case 'account-settings':
        navigate('/(screens)/SettingsScreen/SettingsScreen');
        break;
      case 'login':
        navigate('/(screens)/AuthScreen/AuthScreen');
        break;
      case 'logout':
        try {
          await logout();
          showToast({
            type: 'success',
            text1: 'Wylogowano',
            text2: 'Zostałeś pomyślnie wylogowany',
            visibilityTime: 3000,
            position: 'bottom'
          });
          // Najpierw przekieruj do ekranu logowania
          navigate('/(screens)/AuthScreen/AuthScreen');
          // A następnie po krótkim opóźnieniu wróć do listy przepisów
          setTimeout(() => {
            navigate('/(screens)/RecipeListScreen/RecipeListScreen');
          }, 100);
        } catch (error) {
          showToast({
            type: 'error',
            text1: 'Błąd',
            text2: 'Wystąpił nieoczekiwany błąd podczas wylogowywania',
            visibilityTime: 4000,
            position: 'bottom'
          });
          console.error("Logout error:", error);
        }
        break;
    }
    onClose();
  };

  const menuItems: MenuItem[] = [
    // Main section
    // Removed Notifications item
    
    // Social section
    {
      id: 'friends',
      label: 'Znajomi',
      icon: <FontAwesome5 name="user-friends" size={22} color="#666" />,
      section: 'social',
      requiresAuth: true,
      disabled: true
    },
    {
      id: 'stalking',
      label: 'Stalking',
      icon: <FontAwesome5 name="user-secret" size={22} color="#666" />,
      section: 'social',
      disabled: true,
      requiresAuth: true
    },
    
    // Account section
    {
      id: 'account-settings',
      label: 'Ustawienia konta',
      icon: <Ionicons name="settings-outline" size={24} color="#666" />,
      section: 'account'
    },
    {
      id: 'login',
      label: 'Zaloguj',
      icon: <AntDesign name="login" size={24} color="#666" />,
      section: 'account',
      hideWhenAuth: true
    },
    {
      id: 'logout',
      label: 'Wyloguj',
      icon: <AntDesign name="logout" size={24} color="#666" />,
      section: 'account',
      hideWhenAuth: false,
      requiresAuth: true,
      hideWhenNotAuth: true
    },
  ];

  const renderSection = (section: 'main' | 'social' | 'account') => {
    const sectionItems = menuItems.filter(item => item.section === section);
    
    if (sectionItems.length === 0) return null;

    return (
      <View style={styles.section}>
        {sectionItems.map((item, index) => {
          // Określ, czy element powinien być wyłączony
          const isDisabled = item.disabled || (item.requiresAuth && !isAuthenticated);
          // Określ, czy element powinien być ukryty
          const shouldHide = (item.hideWhenAuth && isAuthenticated) || (item.hideWhenNotAuth && !isAuthenticated);
          
          if (shouldHide) return null;
          
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                isDisabled && styles.menuItemDisabled,
                index === sectionItems.length - 1 && styles.menuItemLast
              ]}
              onPress={() => {
                if (!isDisabled) {
                  handleMenuItemPress(item.id);
                } else if (item.requiresAuth && !isAuthenticated) {
                  showToast({
                    type: 'warning',
                    text1: 'Wymagane logowanie',
                    text2: 'Zaloguj się, aby uzyskać dostęp do tej funkcji',
                    visibilityTime: 3000,
                    position: 'bottom'
                  });
                }
              }}
              disabled={isDisabled}
            >
              <View style={styles.menuItemContent}>
                <View style={[
                  styles.iconContainer,
                  isDisabled && styles.iconContainerDisabled
                ]}>
                  {item.icon}
                </View>
                <Text style={[
                  styles.menuItemText,
                  isDisabled && styles.menuItemTextDisabled
                ]}>
                  {item.label}
                </Text>
              </View>
              {item.disabled && (
                <Text style={styles.comingSoonText}>Wkrótce</Text>
              )}
              {item.requiresAuth && !isAuthenticated && !item.disabled && (
                <Text style={styles.comingSoonText}>Wymaga logowania</Text>
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
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Menu</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {renderSection('main')}
            {renderSection('social')}
            {renderSection('account')}
          </ScrollView>
        </View>
      </Pressable>
      <Toast />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuTitle: {
    fontSize: 20,
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
    padding: 16,
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
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconContainerDisabled: {
    backgroundColor: '#f0f0f0',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemDisabled: {
    opacity: 0.7,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  menuItemTextDisabled: {
    color: '#666',
  },
  comingSoonText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default MainMenu; 