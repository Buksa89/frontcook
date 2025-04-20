// src/screens/SettingsScreen.tsx (lub inna odpowiednia ścieżka)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert
} from 'react-native';
import { Ionicons, MaterialIcons, AntDesign } from '@expo/vector-icons'; // Upewnij się, że masz zainstalowane
import database from '../../../database'; // Import instancji bazy WDB
// Importuj NOWY model ClientUserSettings i jego typ (jeśli istnieje)
import ClientUserSettings from '../../../database/models/ClientUserSettings';
import { useAuth } from '../../context/authContext'; // Zakładając, że ta ścieżka jest poprawna
import { LoginPrompt } from './LoginPrompt'; // Zakładając, że ta ścieżka jest poprawna
import { PasswordChange } from './PasswordChange'; // Zakładając, że ta ścieżka jest poprawna
import { ClientUserSettingsApi, type ClientUserSettingsApiResponse } from '../../api/userSettings'; // Poprawiona ścieżka
import AuthService from '../../services/auth/authService'; // Potrzebne do pobrania ID użytkownika

type LanguageCode = 'pl' | 'en'; // Typ dla kodów języków

function SettingsScreen() {
  // Usunięto stan 'settings', bo nie przechowujemy całej instancji modelu
  const [apiSettings, setApiSettings] = useState<ClientUserSettingsApiResponse | null>(null);
  const [loading, setLoading] = useState(true); // Loading dla ustawień lokalnych
  const [apiLoading, setApiLoading] = useState(false); // Loading dla ustawień API
  const [language, setLanguage] = useState<LanguageCode>('pl'); // Stan dla języka
  const [autoTranslate, setAutoTranslate] = useState(false); // Stan dla tłumaczenia z API
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const [activeUserId, setActiveUserId] = useState<string | null>(null); // Potrzebujemy ID użytkownika

  // Pobierz ID użytkownika przy montowaniu
  useEffect(() => {
      AuthService.getActiveUser()
          .then((id: string | null) => setActiveUserId(id))
          .catch((err: Error) => console.error("Nie można pobrać ID użytkownika:", err));
  }, []);

  // Ładowanie ustawień API (bez zmian w logice API, ale używa activeUserId ze stanu)
  const loadApiSettings = useCallback(async () => {
    if (!isAuthenticated || !activeUserId) return; // Sprawdź oba warunki

    setApiLoading(true);
    try {
      const response = await ClientUserSettingsApi.getClientUserSettings();
      setApiSettings(response);
      setAutoTranslate(response.auto_translate_recipes);
      console.log("[SettingsScreen] Załadowano ustawienia API.");
    } catch (error) {
      handleError(error, 'ładowania ustawień z API');
    } finally {
      setApiLoading(false);
    }
  }, [isAuthenticated, activeUserId]);

  // Funkcja do ładowania ustawień lokalnych i API
  const loadSettings = useCallback(async () => {
    if (!activeUserId) {
      console.log("[SettingsScreen] Brak ID użytkownika, czekam...");
      // Jeśli użytkownik nie jest zalogowany, ustaw domyślne i zakończ ładowanie lokalne
      if (!isAuthenticated) {
          setLanguage('pl');
          setAutoTranslate(false);
          setLoading(false);
      }
      return; // Poczekaj na ID użytkownika, jeśli jest zalogowany
    }

    setLoading(true); // Rozpocznij ładowanie lokalnych ustawień
    try {
      // Użyj NOWEJ metody statycznej do pobrania języka
      const currentLanguage = await ClientUserSettings.getLanguage(database, activeUserId);
      setLanguage(currentLanguage as LanguageCode);
      console.log("[SettingsScreen] Załadowano język lokalny:", currentLanguage);

      // Ładuj ustawienia API tylko jeśli zalogowany
      if (isAuthenticated) {
        await loadApiSettings(); // loadApiSettings teraz nie potrzebuje argumentu userId
      } else {
        setAutoTranslate(false); // Domyślne dla niezalogowanego
      }
    } catch (error) {
      handleError(error, 'ładowania ustawień');
    } finally {
      setLoading(false); // Zakończ ładowanie lokalnych ustawień
    }
  }, [activeUserId, isAuthenticated, loadApiSettings]); // Zależność od ID użytkownika, statusu logowania i loadApiSettings

  // Załaduj ustawienia, gdy ID użytkownika lub status logowania się zmienią
  useEffect(() => {
    loadSettings();
  }, [loadSettings]); // Użyj loadSettings jako zależności

  // Obsługa błędów (bez zmian)
  const handleError = (error: unknown, action: string) => {
    const message = error instanceof Error ? error.message : `Nie udało się ${action}`;
    console.error(`Błąd podczas ${action}:`, error);
    Alert.alert('Błąd', message);
  };

  // Aktualizacja języka (NOWA IMPLEMENTACJA)
  const updateLanguage = useCallback(async (newLanguage: LanguageCode) => {
    if (!activeUserId) return; // Potrzebujemy ID użytkownika

    const previousLanguage = language; // Zapisz poprzedni język na wypadek błędu
    setLanguage(newLanguage); // Optymistyczna aktualizacja UI
    setLanguageDropdownOpen(false);

    try {
      // Użyj NOWEJ metody statycznej do aktualizacji języka
      await ClientUserSettings.updateLanguage(database, activeUserId, newLanguage);
      console.log("[SettingsScreen] Zaktualizowano język lokalnie na:", newLanguage);
      // Synchronizacja (`synchronize`) zajmie się wysłaniem tej zmiany do serwera
    } catch (error) {
      handleError(error, 'zmiany języka');
      setLanguage(previousLanguage); // Przywróć poprzedni język w UI w razie błędu
    }
  }, [activeUserId, language]); // Zależności

  // Aktualizacja tłumaczenia (bez zmian w logice API)
  const updateAutoTranslate = async (value: boolean) => {
    if (!isAuthenticated || !activeUserId) return; // Sprawdź oba

    const previousValue = autoTranslate; // Zapisz poprzednią wartość
    setAutoTranslate(value); // Optymistyczna aktualizacja UI
    setApiLoading(true);

    try {
      const response = await ClientUserSettingsApi.updateSetting('auto_translate_recipes', value);
      // Aktualizuj stan na podstawie odpowiedzi API dla pewności
      setAutoTranslate(response.auto_translate_recipes);
      setApiSettings(response);
      console.log("[SettingsScreen] Zaktualizowano ustawienie tłumaczenia przez API.");
    } catch (error) {
      handleError(error, 'aktualizacji ustawień tłumaczenia');
      setAutoTranslate(previousValue); // Przywróć w razie błędu
    } finally {
      setApiLoading(false);
    }
  };

  // Wyświetlanie nazwy języka (bez zmian)
  const getLanguageDisplayName = (lang: LanguageCode) => {
    return lang === 'pl' ? 'Polski' : 'English';
  };

  // --- Renderowanie ---

  if (loading && !activeUserId && isAuthenticated) {
    // Pokaż loader tylko jeśli user jest zalogowany, ale jeszcze nie mamy jego ID lub ustawień
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5c7ba9" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Sekcja logowania/zmiany hasła (bez zmian) */}
      {isAuthenticated ? <PasswordChange /> : <LoginPrompt />}

      {/* Sekcja Języka */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Język aplikacji</Text>

        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setLanguageDropdownOpen(!languageDropdownOpen)}
        >
          <View style={styles.languageInfo}>
            <MaterialIcons name="language" size={24} color="#555" />
            <Text style={styles.languageText}>{getLanguageDisplayName(language)}</Text>
          </View>
          <AntDesign
            name={languageDropdownOpen ? "up" : "down"}
            size={18}
            color="#555"
          />
        </TouchableOpacity>

        {languageDropdownOpen && (
          <View style={styles.dropdownContent}>
            <TouchableOpacity
              style={[styles.languageItem, language === 'pl' && styles.selectedLanguageItem]}
              onPress={() => updateLanguage('pl')} // Używa nowej funkcji
            >
              <Text style={[styles.languageOptionText, language === 'pl' && styles.selectedLanguageText]}>Polski</Text>
              {language === 'pl' && <MaterialIcons name="check" size={20} color="#5c7ba9" />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.languageItem, styles.disabledLanguageItem]} // Usuń language === 'en' && styles.selectedLanguageItem
              // onPress={() => updateLanguage('en')} // Odkomentuj, gdy będzie gotowe
              disabled={true} // Zostaw disabled na razie
            >
              <Text style={styles.disabledLanguageText}>English (wkrótce)</Text>
              {/* {language === 'en' && <MaterialIcons name="check" size={20} color="#5c7ba9" />} */}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Sekcja Ustawień Przepisów (tylko dla zalogowanych) */}
      {isAuthenticated && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ustawienia przepisów</Text>

          {/* Loader dla ustawień API */}
          {apiLoading && (
            <View style={styles.apiLoadingContainer}>
              <ActivityIndicator size="small" color="#5c7ba9" />
              <Text style={styles.apiLoadingText}>Zapisywanie...</Text>
            </View>
          )}

          <View style={[styles.settingItem, apiLoading && styles.disabledSettingItem]}>
            <View style={styles.settingInfo}>
              <MaterialIcons name="translate" size={24} color="#555" />
              <View style={styles.settingTextContainer}>
                  <Text style={styles.settingText}>Automatyczne tłumaczenie</Text>
                  <Text style={styles.settingSubText}>Tłumacz przepisy z innych języków</Text>
              </View>

            </View>
            <Switch
              value={autoTranslate}
              onValueChange={updateAutoTranslate} // Bez zmian
              trackColor={{ false: '#d3d3d3', true: '#bbd6fb' }}
              thumbColor={autoTranslate ? '#5c7ba9' : '#f4f3f4'}
              ios_backgroundColor="#d3d3d3"
              disabled={apiLoading} // Wyłącz podczas ładowania API
            />
          </View>
          {/* Tutaj można dodać więcej ustawień pobieranych z API */}
        </View>
      )}

      {/* Możesz dodać inne sekcje ustawień */}

    </ScrollView>
  );
}

// --- Style (poprawione błędy składniowe) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa', // Jaśniejsze tło
  },
  scrollContent: {
      paddingBottom: 30, // Dodaj padding na dole
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  apiLoadingContainer: {
    flexDirection: 'row', // Loader i tekst obok siebie
    alignItems: 'center',
    justifyContent: 'center', // Wyśrodkuj w poziomie
    paddingVertical: 10, // Odstęp
    // Usunięto alignSelf: 'center'
  },
   apiLoadingText: { // Dodano styl dla tekstu loadera API
      marginLeft: 8,
      fontSize: 14,
      color: '#5c7ba9',
  },
  section: {
    backgroundColor: '#ffffff', // Białe tło sekcji
    marginHorizontal: 12, // Marginesy po bokach
    marginTop: 16, // Odstęp między sekcjami
    borderRadius: 10, // Zaokrąglenie rogów
    padding: 16,
    // Lekki cień
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 18, // Trochę mniejszy tytuł
    fontWeight: '600',
    color: '#343a40', // Ciemniejszy kolor
    marginBottom: 16,
    // borderBottomWidth: 1, // Usunięto podkreślenie
    // borderBottomColor: '#e9ecef',
    // paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14, // Większy padding pionowy
    // borderBottomWidth: 1, // Usunięto dolną linię między itemami
    // borderBottomColor: '#f1f3f5',
  },
   disabledSettingItem: { // Styl dla wyłączonego itemu podczas ładowania API
      opacity: 0.6,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Zajmij dostępną przestrzeń
    marginRight: 10, // Odstęp od przełącznika
  },
   settingTextContainer: { // Dodatkowy kontener na tekst
      marginLeft: 12,
      flex: 1, // Pozwól tekstowi się rozciągnąć
  },
  settingText: {
    fontSize: 16,
    color: '#495057', // Ciemniejszy szary
  },
   settingSubText: { // Styl dla podtytułu ustawienia
      fontSize: 13,
      color: '#6c757d', // Szary
      marginTop: 2,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ced4da', // Ciemniejsza ramka
    borderRadius: 8,
    backgroundColor: '#f8f9fa', // Lekkie tło
  },
  dropdownContent: {
    marginTop: 6, // Mniejszy odstęp
    borderWidth: 1,
    borderColor: '#ced4da', // Ta sama ramka co header
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
    paddingVertical: 14, // Większy padding
    paddingHorizontal: 16,
    borderBottomWidth: 1, // Separator
    borderBottomColor: '#f1f3f5',
  },
  selectedLanguageItem: {
    backgroundColor: '#e7f5ff', // Bardzo jasny niebieski dla zaznaczenia
  },
  disabledLanguageItem: {
    backgroundColor: '#f8f9fa', // Szare tło dla nieaktywnego
    opacity: 0.6,
  },
  languageText: { // Główny tekst w headerze
    fontSize: 16,
    color: '#495057',
    marginLeft: 12,
  },
  languageOptionText: { // Tekst opcji w dropdownie
    fontSize: 16,
    color: '#495057',
    flex: 1, // Pozwól tekstowi zająć dostępną przestrzeń
  },
  selectedLanguageText: { // Pogrubienie dla wybranego języka
    fontWeight: '600',
    color: '#0056b3', // Ciemniejszy niebieski
  },
  disabledLanguageText: {
    fontSize: 16,
    color: '#adb5bd', // Jasny szary
    marginLeft: 0, // Bez marginesu, bo ikona języka nie jest tu potrzebna
    fontStyle: 'italic',
    flex: 1,
  },
  // Usunięto infoSection
  activeSubscription: {
    backgroundColor: '#e6ffed', // Jaśniejsza zieleń
    borderColor: '#b7ebc0',
  },
  inactiveSubscription: {
    backgroundColor: '#fff0f0', // Jaśniejsza czerwień
    borderColor: '#ffd6d6',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center', // Wyśrodkowanie w pionie
    marginBottom: 6,
    backgroundColor: '#eef2ff', // Jaśniejsze niebieskie tło
    paddingVertical: 6, // Mniejszy padding
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d6e4ff',
  },
  userInfoLabel: {
    fontSize: 14,
    fontWeight: '600', // Pogrubiony label
    marginRight: 6,
    color: '#444',
  },
  userInfoValue: {
    fontSize: 14,
    color: '#0056b3', // Ciemniejszy niebieski
    fontWeight: '500',
    flexShrink: 1, // Pozwól tekstowi ID się zmniejszyć, jeśli jest długie
  },
  headerContainer: {
    padding: 12, // Mniejszy padding
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20, // Trochę mniejszy
    fontWeight: '600', // Mniej pogrubiony
    marginBottom: 10, // Większy odstęp
    color: '#333',
    textAlign: 'center',
  },
  subscriptionDate: {
    fontSize: 13, // Mniejszy tekst daty
    color: '#555',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  tablesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 12, // Padding po bokach
    backgroundColor: '#ffffff', // Tło dla paska tabel
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5, // Trochę większy obszar klikalny
  },
  closeButtonText: {
    color: '#007AFF', // Kolor linku
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SettingsScreen;