// src/screens/DebugScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Image, Modal
} from 'react-native';
import database from '../../../database'; // Import instancji bazy
import { Q } from '@nozbe/watermelondb';
// Importuj INSTANCJĘ authService
import authService from '../../services/auth/authService'; // Upewnij się, że ścieżka jest poprawna
import UserProfile from '../../../database/models/UserProfile'; // Import NOWEGO modelu UserProfile
import type { Subscription } from 'rxjs'; // Importuj typ Subscription
import { Model } from '@nozbe/watermelondb'; // Potrzebne do ogólnego typu rekordu

// Importuj wszystkie NOWE modele, aby mieć dostęp do ich nazw tabel
import { Tag } from '../../../database/models/Tag';
import { Recipe } from '../../../database/models/Recipe';
import { RecipeTag } from '../../../database/models/RecipeTag';
import { Ingredient } from '../../../database/models/Ingredient';
import { ShoppingItem } from '../../../database/models/ShoppingItem';
import ClientUserSettings from '../../../database/models/ClientUserSettings'; // Poprawiony import
import { Notification } from '../../../database/models/Notification';
import { RecipeImage } from '../../../database/models/RecipeImage';
// Usunięto import Source

// --- Funkcje Pomocnicze ---

const formatTimestamp = (timestamp: any): string => {
  if (timestamp === null || timestamp === undefined) return 'null';
  try {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp);
    if (isNaN(date.getTime())) return String(timestamp);
    return date.toISOString().replace('T', ' ').split('.')[0];
  } catch (error) { return String(timestamp); }
};

const isLikelyTimestamp = (key: string, value: any): boolean => {
   if (value === null || value === undefined) return false;
   const dateFieldNames = ['date', 'time', 'sync', 'update', 'created', 'modified', 'end', 'start', 'lock', 'at', 'modified'];
   const keyContainsDateHint = dateFieldNames.some(hint => key.toLowerCase().includes(hint));
   const isNumericTimestamp = typeof value === 'number' && value > 1000000000000;
   return keyContainsDateHint && isNumericTimestamp;
};

const isImagePath = (key: string, value: any): boolean => {
    if (typeof value !== 'string' || !value) return false;
    const isImageKey = key.toLowerCase().includes('url') || key === 'image' || key === 'thumbnail';
    const isImagePathPattern = /\.(jpg|jpeg|png|gif|webp)$/i.test(value) || value.includes('http') || value.startsWith('file:');
    return isImageKey && isImagePathPattern;
};


// --- Komponent Główny ---

export default function DebugScreen() {
  const [tables, setTables] = useState<{ [key: string]: any[] }>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<boolean | null>(null);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<Date | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Nazwy tabel do wyświetlenia
  const tableNames = [
    Recipe.table, Ingredient.table, Tag.table, RecipeTag.table,
    ShoppingItem.table, ClientUserSettings.table, Notification.table,
    UserProfile.table, RecipeImage.table,
    // Usunięto Source.table
  ].sort();

  // --- Efekty ---

  useEffect(() => {
    loadInitialData();

    // Subskrypcja UserProfile z obsługą błędów
    const userProfileObservable = UserProfile.observeSubscriptionStatus(database);
    const profileSubscription: Subscription = userProfileObservable.subscribe({
      next: ({ isActive, endDate }) => {
        setActiveSubscription(isActive);
        setSubscriptionEndDate(endDate);
      },
      error: (error: Error) => { // *** POPRAWKA: Obsługa błędu ***
        console.error('[DEBUG] Błąd obserwacji statusu subskrypcji:', error);
        setActiveSubscription(false); // Ustaw na false w razie błędu
        setSubscriptionEndDate(null); // Wyczyść datę
        // Opcjonalnie: Pokaż alert użytkownikowi
        // Alert.alert('Błąd', 'Nie można załadować aktualnego statusu subskrypcji.');
      }
    });

    return () => {
      profileSubscription.unsubscribe();
    };
  }, []); // Uruchom tylko raz

  // --- Funkcje Ładowania Danych ---

  const loadInitialData = useCallback(async () => {
    console.log('[DEBUG] Ładowanie danych początkowych...');
    try {
      // *** POPRAWKA: Użyj getActiveUserId() ***
      const userId = await authService.getActiveUserId();
      setActiveUserId(userId);
      console.log('[DEBUG] Aktywny User ID:', userId);
      await loadAllTableData();
    } catch (error) {
      console.error('[DEBUG] Błąd podczas ładowania danych początkowych:', error);
      setActiveUserId(null);
      setTables({});
    }
  }, []); // Zależność usunięta, bo loadAllTableData jest wywoływana wewnątrz

  const loadAllTableData = useCallback(async () => {
    try {
      console.log('[DEBUG] Ładowanie danych ze wszystkich tabel...');
      const tablesData: { [key: string]: any[] } = {};
      for (const tableName of tableNames) {
        try {
          const collection = database.get(tableName);
          const records = await collection.query().fetch();
          tablesData[tableName] = records.map(record => ({ ...record._raw }));
        } catch (tableError) {
            console.error(`[DEBUG] Błąd ładowania tabeli ${tableName}:`, tableError);
            tablesData[tableName] = [];
        }
      }
      setTables(tablesData);
      console.log('[DEBUG] Zakończono ładowanie danych tabel.');
    } catch (error) {
      console.error('[DEBUG] Błąd podczas ładowania danych wszystkich tabel:', error);
      setTables({});
    }
  }, [tableNames]);

  // --- Funkcje Obsługi Akcji ---

  const deleteRecord = useCallback(async (tableName: string, recordId: string) => {
    try {
      const collection = database.get(tableName);
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
                    await record.destroyPermanently();
                  });
                  console.log(`[DEBUG] Trwale usunięto rekord ${recordId} z ${tableName}.`);
                  await loadAllTableData(); // Odśwież
              } catch (deleteError) {
                   console.error(`[DEBUG] Błąd podczas trwałego usuwania rekordu ${recordId}:`, deleteError);
                   Alert.alert('Błąd', 'Nie udało się trwale usunąć rekordu.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error(`[DEBUG] Nie można znaleźć rekordu ${recordId} w ${tableName} do usunięcia:`, error);
      Alert.alert('Błąd', 'Nie znaleziono rekordu do usunięcia.');
    }
  }, [loadAllTableData]);

  // --- Funkcje Renderujące ---

  const renderTableButton = useCallback((tableName: string) => (
    <TouchableOpacity
      key={tableName}
      style={[styles.tableButton, selectedTable === tableName && styles.tableButtonSelected]}
      onPress={() => setSelectedTable(tableName)}
    >
      <Text style={[styles.tableButtonText, selectedTable === tableName && styles.tableButtonTextSelected]}>
        {tableName} ({tables[tableName]?.length ?? 0})
      </Text>
    </TouchableOpacity>
  ),[selectedTable, tables]);

  const renderRecordDetails = useCallback((record: any) => {
      if (!record || typeof record !== 'object' || !record.id) return null;
      return (
          <View key={record.id} style={styles.recordContainer}>
            <View style={styles.recordHeader}>
              <Text style={styles.recordId}>ID: {record.id}</Text>
              {selectedTable && (
                 <TouchableOpacity style={styles.deleteButton} onPress={() => deleteRecord(selectedTable, record.id)}>
                   <Text style={styles.deleteButtonText}>Usuń Trwale</Text>
                 </TouchableOpacity>
              )}
            </View>
            {Object.entries(record)
              .filter(([key]) => key !== 'id' && key !== '__proto__' && key !== '_raw')
              .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
              .map(([key, value]) => {
                if (isLikelyTimestamp(key, value) && value !== null) {
                  return ( <View key={key} style={styles.recordFieldContainer}><Text style={styles.recordFieldKey}>{key}:</Text><Text style={styles.recordFieldValue}>{formatTimestamp(value)}</Text></View> );
                }
                 if (isImagePath(key, value) && value) {
                   return ( <TouchableOpacity key={key} onPress={() => setPreviewImage(value as string)} style={[styles.recordFieldContainer, styles.imagePathContainer]}><Text style={styles.recordFieldKey}>{key}:</Text><Text style={[styles.recordFieldValue, styles.imagePathValue]} numberOfLines={1} ellipsizeMode="middle">{String(value)}</Text><Text style={styles.viewImageText}>Pokaż</Text></TouchableOpacity> );
                 }
                return ( <View key={key} style={styles.recordFieldContainer}><Text style={styles.recordFieldKey}>{key}:</Text><Text style={styles.recordFieldValue}>{JSON.stringify(value)}</Text></View> );
              })}
          </View>
      );
  }, [selectedTable, deleteRecord]); // Dodano deleteRecord

  const ImagePreviewModal = useCallback(() => (
    <Modal visible={!!previewImage} transparent={true} animationType="fade" onRequestClose={() => setPreviewImage(null)}>
       <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPreviewImage(null)}>
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Podgląd obrazu</Text>
                <TouchableOpacity style={styles.closeButton} onPress={() => setPreviewImage(null)}>
                  <Text style={styles.closeButtonText}>Zamknij</Text>
                </TouchableOpacity>
              </View>
              {previewImage ? ( <View style={styles.imageContainer}><Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" /><Text style={styles.imagePath} numberOfLines={1} ellipsizeMode="middle">{previewImage}</Text></View> ) : ( <Text style={styles.errorText}>Brak ścieżki do obrazu</Text> )}
            </View>
       </TouchableOpacity>
    </Modal>
  ), [previewImage]);

  // --- Główny JSX ---
  return (
    <View style={styles.container}>
      <ImagePreviewModal />
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Panel Debugowania Bazy Danych</Text>
        <View style={styles.userInfoContainer}>
          <Text style={styles.userInfoLabel}>Aktywny User ID:</Text>
          {/* *** POPRAWKA: Wyświetlanie userId *** */}
          <Text style={styles.userInfoValue} numberOfLines={1} ellipsizeMode="middle">
              {activeUserId || 'Brak (niezalogowany)'}
          </Text>
        </View>
        <View style={[styles.userInfoContainer, activeSubscription ? styles.activeSubscription : styles.inactiveSubscription]}>
           <Text style={styles.userInfoLabel}>Subskrypcja:</Text>
            <Text style={styles.userInfoValue}>
                {activeSubscription === null ? 'Ładowanie...' : (activeSubscription ? 'Aktywna' : 'Nieaktywna')}
            </Text>
            {subscriptionEndDate && ( <Text style={styles.subscriptionDate}> (do: {formatTimestamp(subscriptionEndDate)})</Text> )}
        </View>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tablesContainer}>
          {tableNames.map(renderTableButton)}
        </ScrollView>
      </View>
      <ScrollView style={styles.recordsContainer}>
        {selectedTable && tables[selectedTable]?.length > 0 ? (
            tables[selectedTable].map(renderRecordDetails)
        ) : selectedTable ? (
            <Text style={styles.emptyText}>Brak rekordów w tabeli '{selectedTable}'</Text>
        ) : (
            <Text style={styles.emptyText}>Wybierz tabelę, aby zobaczyć rekordy</Text>
        )}
      </ScrollView>
      <TouchableOpacity style={styles.refreshButton} onPress={loadInitialData}>
        <Text style={styles.refreshButtonText}>Odśwież Dane</Text>
      </TouchableOpacity>
    </View>
  );
}


// --- Style ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerContainer: { padding: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  headerTitle: { fontSize: 20, fontWeight: '600', marginBottom: 10, color: '#333', textAlign: 'center' },
  userInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, backgroundColor: '#eef2ff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#d6e4ff' },
  userInfoLabel: { fontSize: 14, fontWeight: '600', marginRight: 6, color: '#444' },
  userInfoValue: { fontSize: 14, color: '#0056b3', fontWeight: '500', flexShrink: 1 },
  activeSubscription: { backgroundColor: '#e6ffed', borderColor: '#b7ebc0' },
  inactiveSubscription: { backgroundColor: '#fff0f0', borderColor: '#ffd6d6' },
  subscriptionDate: { fontSize: 13, color: '#555', marginLeft: 6, fontStyle: 'italic' },
  tablesContainer: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  tableButton: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#e9ecef', borderRadius: 16, marginRight: 8 },
  tableButtonSelected: { backgroundColor: '#007AFF' },
  tableButtonText: { color: '#495057', fontSize: 14, fontWeight: '500' },
  tableButtonTextSelected: { color: '#fff' },
  recordsContainer: { flex: 1 },
  recordContainer: { backgroundColor: '#ffffff', padding: 12, borderRadius: 8, marginBottom: 12, marginHorizontal: 12, borderWidth: 1, borderColor: '#e8e8e8' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 6 },
  recordId: { fontSize: 12, fontWeight: '600', color: '#555', flexShrink: 1 },
  recordFieldContainer: { flexDirection: 'row', marginBottom: 5, flexWrap: 'wrap' },
  recordFieldKey: { fontSize: 14, fontWeight: '500', color: '#333', marginRight: 5 },
  recordFieldValue: { fontSize: 14, color: '#555', flexShrink: 1 },
  deleteButton: { backgroundColor: '#ffe0e0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  deleteButtonText: { color: '#d90000', fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 16, marginTop: 40, paddingHorizontal: 20 },
  refreshButton: { backgroundColor: '#007AFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, position: 'absolute', right: 16, bottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  refreshButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  imagePathContainer: { backgroundColor: '#f0f8ff', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center' },
  imagePathValue: { color: '#0066cc', fontSize: 13 },
  viewImageText: { color: '#0056b3', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 15 },
  modalContent: { backgroundColor: 'white', borderRadius: 10, padding: 15, width: '100%', maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  closeButton: { padding: 5 },
  closeButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '500' },
  imageContainer: { alignItems: 'center', marginBottom: 10 },
  previewImage: { width: '100%', aspectRatio: 1, marginBottom: 10, borderRadius: 8, backgroundColor: '#e0e0e0' },
  imagePath: { fontSize: 12, color: '#666', textAlign: 'center' },
  errorText: { color: 'red', textAlign: 'center', padding: 20, fontSize: 16 },
});