import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Ionicons, MaterialIcons, AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import database from '../../../database';
import { UserSettings } from '../../../database';
import { useAuth } from '../../../app/context/authContext';
import { LoginPrompt } from './LoginPrompt';
import { PasswordChange } from './PasswordChange';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'pl' | 'en'>('pl');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [allowFriendsViews, setAllowFriendsViews] = useState(true);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const { activeUser } = useAuth();

  // Load settings when component mounts
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const userSettings = await UserSettings.getOrCreate(database);
        setSettings(userSettings);
        setLanguage(userSettings.language as 'pl' | 'en');
        setAutoTranslate(userSettings.autoTranslateRecipes);
        setAllowFriendsViews(userSettings.allowFriendsViewsRecipes);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nie udało się załadować ustawień';
        console.error('Błąd podczas ładowania ustawień:', error);
        Alert.alert('Błąd', message);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleError = (error: any, action: string) => {
    const message = error instanceof Error ? error.message : `Nie udało się ${action}`;
    console.error(`Błąd podczas ${action}:`, error);
    Alert.alert('Błąd', message);
  };

  const updateLanguage = async (newLanguage: 'pl' | 'en') => {
    if (!settings) return;
    
    try {
      await settings.updateLanguage(newLanguage);
      setLanguage(newLanguage);
      setLanguageDropdownOpen(false);
    } catch (error) {
      handleError(error, 'zmiany języka');
      // Przywróć poprzednią wartość w przypadku błędu
      setLanguage(settings.language as 'pl' | 'en');
    }
  };

  const updateAutoTranslate = async (value: boolean) => {
    if (!settings) return;

    try {
      await settings.updateAutoTranslate(value);
      setAutoTranslate(value);
    } catch (error) {
      handleError(error, 'zmiany auto-tłumaczenia');
      // Przywróć poprzednią wartość w przypadku błędu
      setAutoTranslate(settings.autoTranslateRecipes);
    }
  };

  const updateAllowFriendsViews = async (value: boolean) => {
    if (!settings) return;

    try {
      await settings.updateAllowFriendsViews(value);
      setAllowFriendsViews(value);
    } catch (error) {
      handleError(error, 'zmiany widoczności dla znajomych');
      // Przywróć poprzednią wartość w przypadku błędu
      setAllowFriendsViews(settings.allowFriendsViewsRecipes);
    }
  };

  const getLanguageDisplayName = (lang: 'pl' | 'en') => {
    return lang === 'pl' ? 'Polski' : 'English';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Język</Text>
        
        {/* Language dropdown header */}
        <TouchableOpacity 
          style={styles.dropdownHeader}
          onPress={() => setLanguageDropdownOpen(!languageDropdownOpen)}
        >
          <View style={styles.languageInfo}>
            <MaterialIcons name="language" size={24} color="#666" />
            <Text style={styles.languageText}>{getLanguageDisplayName(language)}</Text>
          </View>
          <AntDesign 
            name={languageDropdownOpen ? "up" : "down"} 
            size={18} 
            color="#666" 
          />
        </TouchableOpacity>
        
        {/* Dropdown content */}
        {languageDropdownOpen && (
          <View style={styles.dropdownContent}>
            <TouchableOpacity
              style={[
                styles.languageItem,
                language === 'pl' && styles.selectedLanguageItem
              ]}
              onPress={() => updateLanguage('pl')}
            >
              <Text style={styles.languageText}>Polski</Text>
              {language === 'pl' && (
                <MaterialIcons name="check" size={20} color="#2196F3" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.languageItem,
                styles.disabledLanguageItem
              ]}
              disabled={true}
            >
              <Text style={styles.disabledLanguageText}>English (wkrótce)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {activeUser ? <PasswordChange /> : <LoginPrompt />}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Przepisy</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <MaterialIcons name="translate" size={24} color="#666" />
            <Text style={styles.settingText}>Automatycznie tłumacz przepisy</Text>
          </View>
          <Switch
            value={autoTranslate}
            onValueChange={updateAutoTranslate}
            trackColor={{ false: '#d3d3d3', true: '#bbd6fb' }}
            thumbColor={autoTranslate ? '#2196F3' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <MaterialIcons name="people" size={24} color="#666" />
            <Text style={styles.settingText}>Pozwól znajomym przeglądać moje przepisy</Text>
          </View>
          <Switch
            value={allowFriendsViews}
            onValueChange={updateAllowFriendsViews}
            trackColor={{ false: '#d3d3d3', true: '#bbd6fb' }}
            thumbColor={allowFriendsViews ? '#2196F3' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          Zmiany są zapisywane automatycznie po każdej modyfikacji.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  dropdownContent: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedLanguageItem: {
    backgroundColor: '#f5f9ff',
  },
  disabledLanguageItem: {
    backgroundColor: '#f5f5f5',
    opacity: 0.7,
  },
  languageText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  disabledLanguageText: {
    fontSize: 16,
    color: '#999',
    marginLeft: 12,
    fontStyle: 'italic',
  },
  infoSection: {
    padding: 16,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
}); 