import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Button, RefreshControl, Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext'; // Import kontekstu Auth
import database from '../src/database'; // Import instancji bazy danych
import { Model } from '@nozbe/watermelondb'; // Import Model

// Typ dla danych tabeli w stanie
type TableData = { [tableName: string]: Model[] };

export default function DebugScreen() {
  const { userId, accessToken, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [dbData, setDbData] = useState<TableData>({});
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Pobierz nazwy tabel bezpośrednio z instancji bazy danych
  const [tableNames, setTableNames] = useState<string[]>([]);

  useEffect(() => {
    if (database) {
      // Użyj Object.keys on database.collections.map
      const names = Object.keys(database.collections.map).sort();
      setTableNames(names);
    } else {
      console.warn('[DebugScreen] Database not initialized when trying to get table names.');
      setTableNames([]);
    }
  }, []); // Uruchom tylko raz po zamontowaniu

  // Funkcja ładowania danych z bazy
  const loadDatabaseData = useCallback(async () => {
    if (!database) {
      Alert.alert('Błąd', 'Baza danych nie jest zainicjalizowana.');
      return;
    }
    // Ensure we only loop if tableNames has been populated
    if (tableNames.length === 0) {
        console.log('[DebugScreen] loadDatabaseData called with empty tableNames, skipping.');
        setDbData({}); // Clear data if no tables
        return;
    }
    console.log('[DebugScreen] loadDatabaseData executing for tables:', tableNames);
    setIsLoadingDb(true);
    const allData: TableData = {};
    try {
      for (const tableName of tableNames) {
        try {
          // Sprawdź czy kolekcja istnieje przed zapytaniem
          const collectionExists = database.collections.get(tableName);
          if (collectionExists) {
              const records = await collectionExists.query().fetch();
              allData[tableName] = records;
          } else {
              console.warn(`[DebugScreen] Kolekcja ${tableName} nie znaleziona.`);
              allData[tableName] = [];
          }
        } catch (tableError) {
          console.error(`[DebugScreen] Błąd ładowania tabeli ${tableName}:`, tableError);
          allData[tableName] = []; // Zwróć pustą tablicę w razie błędu
        }
      }
      setDbData(allData);
    } catch (error) {
      console.error('[DebugScreen] Błąd ładowania danych z bazy:', error);
      Alert.alert('Błąd', 'Nie udało się załadować danych z bazy.');
    } finally {
      setIsLoadingDb(false);
    }
  }, [tableNames]);

  // Funkcja odświeżania
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDatabaseData();
    setRefreshing(false);
  }, [loadDatabaseData]);

  // Załaduj dane TYLKO gdy zmienią się nazwy tabel (i są > 0)
  useEffect(() => {
    if (tableNames.length > 0) {
        // console.log('[DebugScreen] tableNames updated, loading data:', tableNames);
        loadDatabaseData();
    } else {
        // console.log('[DebugScreen] tableNames empty, skipping data load.');
        // Optionally clear data if table names become empty after initial load
        setDbData({});
    }
  }, [tableNames]);

  // Funkcja usuwania rekordu
  const handleDeleteRecord = useCallback(async (tableName: string, recordId: string) => {
    if (!database) return;
    Alert.alert(
      'Potwierdzenie Usunięcia',
      `Czy na pewno chcesz TRWALE usunąć rekord ID: ${recordId} z tabeli ${tableName}?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń Trwale',
          style: 'destructive',
          onPress: async () => {
            try {
              await database.write(async () => {
                const record = await database.get(tableName).find(recordId);
                await record.destroyPermanently();
              });
              Alert.alert('Sukces', 'Rekord został trwale usunięty.');
              await loadDatabaseData(); // Odśwież dane
            } catch (error) {
              console.error(`[DebugScreen] Błąd usuwania rekordu ${recordId} z ${tableName}:`, error);
              Alert.alert('Błąd', 'Nie udało się usunąć rekordu.');
            }
          },
        },
      ]
    );
  }, [loadDatabaseData]);

  // Funkcja renderująca szczegóły rekordu
  const renderRecordDetails = (record: Model) => {
    // Sprawdź, czy rekord jest prawidłowy
    if (!record || typeof record !== 'object' || !record.id) {
        return <Text style={styles.errorText}>Nieprawidłowy rekord</Text>;
    }
    // Bezpieczne pobieranie pól z _raw, jeśli istnieje
    const rawData = record._raw ?? {};

    return (
      <View key={record.id} style={styles.recordContainer}>
        <View style={styles.recordHeader}>
          <Text style={styles.recordIdText} selectable>ID: {record.id}</Text>
          {selectedTable && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteRecord(selectedTable, record.id)}
            >
              <MaterialIcons name="delete-forever" size={18} color="#e53935" />
            </TouchableOpacity>
          )}
        </View>
        {Object.entries(rawData)
          // Wyklucz pola systemowe WDB zaczynające się od '_' (oprócz _raw)
          // oraz samo ID, bo jest w nagłówku
          .filter(([key]) => key !== 'id' && !key.startsWith('_changed') && !key.startsWith('_status'))
          .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sortuj alfabetycznie
          .map(([key, value]) => (
          <View key={key} style={styles.fieldContainer}>
            <Text style={styles.fieldKey}>{key}:</Text>
            <Text style={styles.fieldValue} selectable>{JSON.stringify(value, null, 2)}</Text>
          </View>
        ))}
      </View>
    );
  };


  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sectionTitle}>Stan Autentykacji</Text>
      {isAuthLoading ? (
        <ActivityIndicator style={styles.authInfo} />
      ) : (
        <View style={styles.authInfo}>
          <Text>Zalogowany: {isAuthenticated ? 'Tak' : 'Nie'}</Text>
          <Text selectable>User ID: {userId ?? 'Brak'}</Text>
          <Text selectable>Access Token: {accessToken ? '*** (obecny)' : 'Brak'}</Text>
          {/* Można dodać wyświetlanie refresh tokena (w DEBUG) */}
        </View>
      )}

      <Text style={styles.sectionTitle}>Dane WatermelonDB</Text>

      <View style={styles.tableButtonsContainer}>
        {tableNames.map(tableName => (
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
                {tableName} ({dbData[tableName]?.length ?? '...'})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Wrap the conditional data display section in a View */}
      <View>
        {isLoadingDb && !refreshing ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : selectedTable ? (
          dbData[selectedTable]?.length > 0 ? (
            // Wrap the mapped result in a View
            <View>{dbData[selectedTable].map(renderRecordDetails)}</View>
          ) : (
              <Text style={styles.noRecordsText}>Brak rekordów w tabeli '{selectedTable}'.</Text>
          )
        ) : (
          <Text style={styles.noRecordsText}>Wybierz tabelę, aby zobaczyć dane.</Text>
        )}
      </View>

      <View style={{ height: 50 }} /> {/* Dodatkowy margines na dole */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: '#f8f8f8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingBottom: 5,
  },
  authInfo: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
   tableButtonsContainer: {
       flexDirection: 'row',
       flexWrap: 'wrap', // Pozwala przyciskom zawijać się do nowej linii
       gap: 8, // Odstęp między przyciskami
       marginBottom: 15,
   },
   tableButton: {
       paddingHorizontal: 12,
       paddingVertical: 8,
       backgroundColor: '#e9ecef',
       borderRadius: 16,
   },
   tableButtonSelected: {
       backgroundColor: '#5c7ba9',
   },
   tableButtonText: {
       color: '#495057',
       fontSize: 13,
       fontWeight: '500',
   },
   tableButtonTextSelected: {
       color: '#fff',
   },
  recordContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee'
  },
   recordHeader: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       alignItems: 'center',
       marginBottom: 8,
       paddingBottom: 6,
       borderBottomWidth: 1,
       borderBottomColor: '#f0f0f0',
   },
   recordIdText: {
       fontSize: 12,
       color: '#666',
       fontWeight: 'bold',
       flexShrink: 1, // Pozwala ID się zmniejszyć
   },
   deleteButton: {
       padding: 4, // Mały padding dla klikalności
   },
  fieldContainer: {
    flexDirection: 'row',
    marginBottom: 4,
    flexWrap: 'wrap', // Zawijaj długie wartości
  },
  fieldKey: {
    fontWeight: '600',
    marginRight: 5,
    color: '#333',
    fontSize: 13,
  },
  fieldValue: {
    flexShrink: 1, // Pozwala wartości się zmniejszyć
    color: '#555',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', // Lepsze dla JSON
  },
  noRecordsText: {
      textAlign: 'center',
      color: '#777',
      marginTop: 20,
      fontSize: 14,
  },
  errorText: {
    color: 'red',
    fontStyle: 'italic',
  },
});