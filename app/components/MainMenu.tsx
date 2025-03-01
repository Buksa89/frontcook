import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../context';

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
}

export const MainMenu: React.FC<MainMenuProps> = ({ visible, onClose }) => {
  const { isAuthenticated, logout } = useAuth();

  const handleMenuItemPress = async (id: string) => {
    switch (id) {
      case 'tags':
        router.push({
          pathname: '/(screens)/TagManagementScreen/TagManagementScreen'
        });
        break;
      case 'notifications':
        router.push({
          pathname: '/(screens)/NotificationScreen/NotificationScreen'
        });
        break;
      case 'friends':
        router.push({
          pathname: '/(screens)/FriendsScreen/FriendsScreen'
        });
        break;
      case 'account-settings':
        router.push({
          pathname: '/(screens)/SettingsScreen/SettingsScreen'
        });
        break;
      case 'login':
        router.push({
          pathname: '/(screens)/AuthScreen/AuthScreen'
        });
        break;
      case 'logout':
        try {
          const result = await logout();
          if (result.success) {
            Alert.alert("Wylogowano", "Zostałeś pomyślnie wylogowany");
          } else {
            Alert.alert("Błąd", result.message || "Wystąpił błąd podczas wylogowywania");
          }
        } catch (error) {
          Alert.alert("Błąd", "Wystąpił nieoczekiwany błąd podczas wylogowywania");
          console.error("Logout error:", error);
        }
        break;
      // Add other cases here when implementing other menu items
    }
    onClose();
  };

  const menuItems: MenuItem[] = [
    // Main section
    {
      id: 'tags',
      label: 'Zarządzanie tagami',
      icon: <MaterialIcons name="local-offer" size={24} color="#666" />,
      section: 'main'
    },
    {
      id: 'notifications',
      label: 'Powiadomienia',
      icon: <Ionicons name="notifications-outline" size={24} color="#666" />,
      section: 'main',
      requiresAuth: true
    },
    {
      id: 'pending-recipes',
      label: 'Przepisy do akceptacji',
      icon: <MaterialIcons name="pending-actions" size={24} color="#666" />,
      section: 'main',
      disabled: true,
      requiresAuth: true
    },
    
    // Social section
    {
      id: 'friends',
      label: 'Znajomi',
      icon: <FontAwesome5 name="user-friends" size={22} color="#666" />,
      section: 'social',
      requiresAuth: true
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
      section: 'account',
      requiresAuth: true
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
      requiresAuth: true
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
          const shouldHide = item.hideWhenAuth && isAuthenticated;
          
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
                  Alert.alert("Wymagane logowanie", "Zaloguj się, aby uzyskać dostęp do tej funkcji");
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