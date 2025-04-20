// src/screens/DebugScreen.tsx (lub podobna ścieżka)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Image, Modal
} from 'react-native';
import database from '../../../database'; // Import instancji bazy
import { Q } from '@nozbe/watermelondb';
import AuthService from '../../services/auth/authService'; // Popraw ścieżkę, jeśli trzeba
import UserProfile from '../../../database/models/UserProfile'; // Przywrócono import UserProfile
import type { Subscription } from 'rxjs'; // Importuj typ Subscription
import { Model } from '@nozbe/watermelondb'; // Potrzebne do ogólnego typu rekordu

// Importuj wszystkie NOWE modele, aby mieć dostęp do ich nazw tabel
import { Tag } from '../../../database/models/Tag';
import { Recipe } from '../../../database/models/Recipe';
import { RecipeTag } from '../../../database/models/RecipeTag';
import { Ingredient } from '../../../database/models/Ingredient';
import { ShoppingItem } from '../../../database/models/ShoppingItem';
import ClientUserSettings from '../../../database/models/ClientUserSettings'; // Przywrócono import ClientUserSettings
import { Notification } from '../../../database/models/Notification';
import { RecipeImage } from '../../../database/models/RecipeImage';

// --- Funkcje Pomocnicze (bez zmian) ---

const formatTimestamp = (timestamp: any): string => {
  if (timestamp === null || timestamp === undefined) return 'null';
  try {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp);
    if (isNaN(date.getTime())) return String(timestamp);
    // Formatuj bez milisekund dla czytelności w debug
    return date.toISOString().replace('T', ' ').split('.')[0];
  } catch (error) {
    return String(timestamp);
  }
};

const isLikelyTimestamp = (key: string, value: any): boolean => {
  if (value === null || value === undefined) return false;
  const dateFieldNames = ['date', 'time', 'sync', 'update', 'created', 'modified', 'end', 'start', 'lock', 'at', 'modified']; // Dodano 'at' i 'modified'
  const keyContainsDateHint = dateFieldNames.some(hint => key.toLowerCase().includes(hint));
  // WDB przechowuje timestampy jako number (ms)
  const isNumericTimestamp = typeof value === 'number' && value > 1000000000000; // Timestampy WDB
  return keyContainsDateHint && isNumericTimestamp;
};

const isImagePath = (key: string, value: any): boolean => {
    if (typeof value !== 'string' || !value) return false;
    // Szukaj kluczy zawierających 'url' lub 'image'/'thumbnail'
    const isImageKey = key.toLowerCase().includes('url') || key === 'image' || key === 'thumbnail';
    // Proste sprawdzenie, czy URL zawiera typowe rozszerzenia lub ścieżki
    const isImagePathPattern = /\.(jpg|jpeg|png|gif|webp)$/i.test(value) || value.includes('http') || value.startsWith('file:');
    return isImageKey && isImagePathPattern;
};


// --- Komponent Główny ---

export default function DebugScreen() {
  // Stan przechowujący dane jako { tableName: RawRecord[] }
  const [tables, setTables] = useState<{ [key: string]: any[] }>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  // Usunięto lastSyncTime - WDB zarządza tym wewnętrznie
  const [activeUserId, setActiveUserId] = useState<string | null>(null); // Zmieniono nazwę
  const [activeSubscription, setActiveSubscription] = useState<boolean | null>(null);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<Date | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Nazwy tabel do wyświetlenia (pobierz z modeli)
  const tableNames = [
    Recipe.table,
    Ingredient.table,
    Tag.table,
    RecipeTag.table, // Tabela pośrednicząca
    ShoppingItem.table,
    ClientUserSettings.table, // Przywrócono odwołanie do tabeli
    Notification.table,
    UserProfile.table, // Przywrócono odwołanie do tabeli
    RecipeImage.table,
  ].sort(); // Sortuj alfabetycznie dla porządku

  // --- Efekty ---

  // Efekt do ładowania danych przy starcie i obserwacji UserProfile
  useEffect(() => {
    loadInitialData(); // Połączone ładowanie danych i użytkownika

    // Przywrócono subskrypcję UserProfile
    const userProfileObservable = UserProfile.observeSubscriptionStatus(database);
    const profileSubscription: Subscription = userProfileObservable.subscribe({
      next: ({ isActive, endDate }: { isActive: boolean, endDate: Date | null }) => {
        // console.log('[DEBUG] Subscription status updated:', isActive, 'End date:', endDate);
        setActiveSubscription(isActive);
        setSubscriptionEndDate(endDate);
      },
      error: (error: Error) => {
        console.error('[DEBUG] Subscription status observation error:', error);
        setActiveSubscription(null);
        setSubscriptionEndDate(null);
      }
    });

    // Czyszczenie subskrypcji
    return () => {
      profileSubscription.unsubscribe();
    };
  }, []); // Uruchom tylko raz przy montowaniu

  // --- Funkcje Ładowania Danych ---

  // Ładuje dane użytkownika i wszystkie tabele
  const loadInitialData = useCallback(async () => {
    console.log('[DEBUG] Ładowanie danych początkowych...');
    try {
      const userId = await AuthService.getActiveUser(); // Zmieniono z getActiveUserId na getActiveUser
      setActiveUserId(userId);
      console.log('[DEBUG] Aktywny użytkownik ID:', userId);
      await loadAllTableData(); // Załaduj dane tabel
    } catch (error) {
      console.error('[DEBUG] Błąd podczas ładowania danych początkowych:', error);
      setActiveUserId(null); // Resetuj użytkownika w razie błędu
      setTables({}); // Wyczyść tabele w razie błędu
    }
  }, []); // Brak zależności, funkcja sama pobiera potrzebne dane

  // Ładuje dane ze wszystkich zdefiniowanych tabel
  const loadAllTableData = useCallback(async () => {
    try {
      console.log('[DEBUG] Ładowanie danych ze wszystkich tabel...');
      const tablesData: { [key: string]: any[] } = {};
      for (const tableName of tableNames) {
        try {
          const collection = database.get(tableName);
          // Pobierz WSZYSTKIE rekordy, włączając te potencjalnie usunięte przez soft delete API
          // ale jeszcze nie usunięte lokalnie przez WDB (choć synchronize powinno je usuwać)
          // Użyj .query() bez filtrów, aby zobaczyć "surowy" stan lokalny
          const records = await collection.query().fetch();
          // Mapuj na _raw, aby zobaczyć wszystkie pola, w tym _status WDB
          tablesData[tableName] = records.map(record => ({ ...record._raw }));
        } catch (tableError) {
            console.error(`[DEBUG] Błąd ładowania tabeli ${tableName}:`, tableError);
            tablesData[tableName] = []; // Pusta tablica w razie błędu dla tej tabeli
        }
      }
      setTables(tablesData);
      console.log('[DEBUG] Zakończono ładowanie danych tabel.');
    } catch (error) {
      console.error('[DEBUG] Błąd podczas ładowania danych wszystkich tabel:', error);
      setTables({}); // Wyczyść stan tabel w razie ogólnego błędu
    }
  }, [tableNames]); // Zależność od listy nazw tabel

  // --- Funkcje Obsługi Akcji ---

  // Usunięto resetLastSyncTime - nie ma już potrzeby ręcznego zarządzania czasem synchronizacji

  // Usuwanie rekordu (używa destroyPermanently dla celów debugowania)
  const deleteRecord = useCallback(async (tableName: string, recordId: string) => {
    try {
      const collection = database.get(tableName);
      // Użyj generycznego typu Model, bo nie wiemy z góry, jaki to model
      const record = await collection.find(recordId) as Model;

      Alert.alert(
        'Potwierdzenie Usunięcia (Debug)',
        `Czy na pewno chcesz TRWALE usunąć ten rekord (ID: ${recordId}) z tabeli ${tableName}? Tej akcji nie można cofnąć.`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Usuń Trwale',
            style: 'destructive',
            onPress: async () => {
              try {
                  await database.write(async () => {
                    await record.destroyPermanently(); // Trwałe usunięcie
                  });
                  console.log(`[DEBUG] Trwale usunięto rekord ${recordId} z ${tableName}.`);
                  await loadAllTableData(); // Odśwież dane po usunięciu
              } catch (deleteError) {
                   console.error(`[DEBUG] Błąd podczas trwałego usuwania rekordu ${recordId}:`, deleteError);
                   Alert.alert('Błąd', 'Nie udało się trwale usunąć rekordu.');
              }
            }
          }
        ]
      );
    } catch (error) {
      // Błąd find()
      console.error(`[DEBUG] Nie można znaleźć rekordu ${recordId} w ${tableName} do usunięcia:`, error);
      Alert.alert('Błąd', 'Nie znaleziono rekordu do usunięcia.');
    }
  }, [loadAllTableData]); // Zależność od funkcji odświeżającej

  // --- Funkcje Renderujące ---

  const renderTableButton = useCallback((tableName: string) => (
    <TouchableOpacity
      key={tableName}
      style={[
        styles.tableButton,
        selectedTable === tableName && styles.tableButtonSelected
      ]}
      onPress={() => setSelectedTable(tableName)}
    >
      <Text style={[
        styles.tableButtonText,
        selectedTable === tableName && styles.tableButtonTextSelected
      ]}>
        {tableName} ({tables[tableName]?.length ?? 0})
      </Text>
    </TouchableOpacity>
  ),[selectedTable, tables]); // Zależności

  const renderRecordDetails = useCallback((record: any) => {
      // Sprawdź czy rekord jest poprawnym obiektem z ID
      if (!record || typeof record !== 'object' || !record.id) {
          return <Text key={`invalid-${Math.random()}`} style={styles.errorText}>Nieprawidłowy rekord</Text>;
      }

      return (
          <View key={record.id} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordId}>ID: {record.id}</Text>
              {/* Umożliwiaj usuwanie tylko jeśli tabela jest wybrana */}
              {selectedTable && (
                 <TouchableOpacity
                   style={styles.deleteButton}
                   onPress={() => deleteRecord(selectedTable, record.id)}
                 >
                   <Text style={styles.deleteButtonText}>Usuń Trwale</Text>
                 </TouchableOpacity>
              )}
            </View>
            {/* Filtruj pola techniczne WDB i 'id' */}
            {Object.entries(record)
              .filter(([key]) => key !== 'id' && key !== '__proto__' && key !== '_raw')
              .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sortuj alfabetycznie dla porządku
              .map(([key, value]) => {
                if (isLikelyTimestamp(key, value) && value !== null) {
                  return (
                    <View key={key} style={styles.recordFieldContainer}>
                        <Text style={styles.recordFieldKey}>{key}:</Text>
                        <Text style={styles.recordFieldValue}>{formatTimestamp(value)}</Text>
                        {/* Opcjonalnie pokaż surowy timestamp */}
                        {/* <Text style={styles.rawTimestamp}> ({value})</Text> */}
                    </View>
                  );
                }

                // Poprawione sprawdzanie obrazka - używamy isImagePath i sprawdzamy istnienie wartości
                 if (isImagePath(key, value) && value) {
                   return (
                     <TouchableOpacity
                       key={key}
                       onPress={() => setPreviewImage(value as string)}
                       style={[styles.recordFieldContainer, styles.imagePathContainer]}
                     >
                       <Text style={styles.recordFieldKey}>{key}:</Text>
                       <Text style={[styles.recordFieldValue, styles.imagePathValue]} numberOfLines={1} ellipsizeMode="middle">
                         {String(value)}
                       </Text>
                       <Text style={styles.viewImageText}>Pokaż</Text>
                     </TouchableOpacity>
                   );
                 }

                // Standardowe wyświetlanie
                return (
                   <View key={key} style={styles.recordFieldContainer}>
                       <Text style={styles.recordFieldKey}>{key}:</Text>
                       <Text style={styles.recordFieldValue}>{JSON.stringify(value)}</Text>
                   </View>
                );
              })}
          </View>
      );
  }, [selectedTable, deleteRecord]); // Zależności


  // Modal Podglądu Obrazu (bez zmian w logice)
  const ImagePreviewModal = useCallback(() => (
    <Modal
      visible={!!previewImage}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setPreviewImage(null)}
    >
       <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPreviewImage(null)}>
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Podgląd obrazu</Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => setPreviewImage(null)}>
                  <Text style={styles.closeButtonText}>Zamknij</Text>
                </TouchableOpacity>
              </View>
              {previewImage ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" />
                  <Text style={styles.imagePath} numberOfLines={1} ellipsizeMode="middle">{previewImage}</Text>
                </View>
              ) : (
                <Text style={styles.errorText}>Brak ścieżki do obrazu</Text>
              )}
            </View>
       </TouchableOpacity>
    </Modal>
  ), [previewImage]); // Zależność od previewImage


  // --- Główny JSX ---
  return (
    <View style={styles.container}>
      <ImagePreviewModal />

      {/* Nagłówek z informacjami */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Panel Debugowania Bazy Danych</Text>
        <View style={styles.userInfoContainer}>
          <Text style={styles.userInfoLabel}>Aktywny User ID:</Text>
          <Text style={styles.userInfoValue}>{activeUserId || 'Brak (niezalogowany)'}</Text>
        </View>

        {/* Status subskrypcji */}
        <View style={[styles.userInfoContainer, activeSubscription ? styles.activeSubscription : styles.inactiveSubscription]}>
          <Text style={styles.userInfoLabel}>Subskrypcja:</Text>
          <Text style={styles.userInfoValue}>
            {activeSubscription === null ? 'Ładowanie...' : (activeSubscription ? 'Aktywna' : 'Nieaktywna')}
          </Text>
          {subscriptionEndDate && (
            <Text style={styles.subscriptionDate}> (do: {formatTimestamp(subscriptionEndDate)})</Text>
          )}
        </View>
         {/* Usunięto wyświetlanie i resetowanie lastSyncTime */}
      </View>

      {/* Wybór Tabeli */}
      <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tablesContainer}>
            {tableNames.map(renderTableButton)}
          </ScrollView>
      </View>


      {/* Wyświetlanie Rekordów */}
      <ScrollView style={styles.recordsContainer}>
        {selectedTable && tables[selectedTable]?.length > 0 ? (
            tables[selectedTable].map(renderRecordDetails)
        ) : selectedTable ? (
            <Text style={styles.emptyText}>Brak rekordów w tabeli '{selectedTable}'</Text>
        ) : (
            <Text style={styles.emptyText}>Wybierz tabelę, aby zobaczyć rekordy</Text>
        )}
      </ScrollView>

      {/* Przycisk Odśwież */}
      <TouchableOpacity style={styles.refreshButton} onPress={loadInitialData}>
        <Text style={styles.refreshButtonText}>Odśwież Dane</Text>
      </TouchableOpacity>
    </View>
  );
}


// --- Style (dodano drobne poprawki, np. zawijanie tekstu) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Jaśniejsze tło całego ekranu
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
  activeSubscription: {
    backgroundColor: '#e6ffed', // Jaśniejsza zieleń
    borderColor: '#b7ebc0',
  },
  inactiveSubscription: {
    backgroundColor: '#fff0f0', // Jaśniejsza czerwień
    borderColor: '#ffd6d6',
  },
  subscriptionDate: {
    fontSize: 13, // Mniejszy tekst daty
    color: '#555',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  // Usunięto syncTimeText i resetSyncButton
  tablesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 12, // Padding po bokach
    backgroundColor: '#ffffff', // Tło dla paska tabel
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableButton: {
    paddingHorizontal: 14, // Więcej miejsca po bokach
    paddingVertical: 8,
    backgroundColor: '#e9ecef', // Jasnoszary
    borderRadius: 16, // Bardziej zaokrąglone
    marginRight: 8,
  },
  tableButtonSelected: {
    backgroundColor: '#007AFF',
    color: '#fff', // Dodaj biały kolor tekstu dla zaznaczonego
  },
  tableButtonText: {
    color: '#495057', // Ciemnoszary tekst
    fontSize: 14,
    fontWeight: '500',
  },
  tableButtonTextSelected: {
    color: '#fff',
  },
  recordsContainer: {
    flex: 1,
    // Usunięto padding, bo jest w listContent w FlatList/ScrollView
  },
  recordContainer: {
    backgroundColor: '#ffffff',
    padding: 12, // Mniejszy padding
    borderRadius: 8,
    marginBottom: 12, // Większy odstęp
    marginHorizontal: 12, // Marginesy po bokach
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 6,
  },
  recordId: {
    fontSize: 12, // Mniejszy ID
    fontWeight: '600',
    color: '#555',
    flexShrink: 1, // Pozwól ID się zmniejszyć
  },
  recordFieldContainer: { // Kontener dla klucza i wartości
      flexDirection: 'row',
      marginBottom: 5,
      flexWrap: 'wrap', // Pozwól zawijać, jeśli wartość jest długa
  },
  recordFieldKey: { // Styl dla klucza
      fontSize: 14,
      fontWeight: '500',
      color: '#333',
      marginRight: 5,
  },
  recordFieldValue: { // Styl dla wartości
      fontSize: 14,
      color: '#555',
      flexShrink: 1, // Pozwól wartości się zmniejszyć/zawinąć
  },
  deleteButton: {
    backgroundColor: '#ffe0e0', // Jaśniejszy czerwony
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: '#d90000', // Ciemniejszy czerwony
    fontSize: 12, // Mniejszy tekst
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 40, // Większy odstęp od góry
    paddingHorizontal: 20,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 18, // Trochę szerszy
    paddingVertical: 10, // Trochę niższy
    borderRadius: 20, // Okrągły
    position: 'absolute',
    right: 16,
    bottom: 16, // Trochę wyżej
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 15, // Trochę mniejszy
    fontWeight: '600',
  },
  // Style dla podglądu obrazka
  imagePathContainer: {
    backgroundColor: '#f0f8ff', // Lekkie tło dla ścieżek obrazków
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center', // Wyśrodkuj elementy w poziomie
  },
  imagePathValue: {
    color: '#0066cc',
    // Usunięto textDecorationLine
    fontSize: 13, // Mniejsza czcionka ścieżki
  },
  viewImageText: {
    color: '#0056b3',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    // Usunięto tło i padding - niepotrzebne
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)', // Ciemniejsze tło modala
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10, // Mniejsze zaokrąglenie
    padding: 15,
    width: '100%', // Pełna szerokość (z paddingiem overlay)
    maxHeight: '90%', // Ogranicz wysokość
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600', // Mniej pogrubiony
    color: '#333',
  },
  closeButton: {
    padding: 5, // Trochę większy obszar klikalny
  },
  closeButtonText: {
    color: '#007AFF', // Kolor linku
    fontSize: 16,
    fontWeight: '500',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 10, // Odstęp na dole
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1, // Zachowaj proporcje kwadratowe lub dostosuj
    marginBottom: 10,
    borderRadius: 8,
    backgroundColor: '#e0e0e0', // Tło podczas ładowania
  },
  imagePath: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    padding: 20,
    fontSize: 16,
  },
});