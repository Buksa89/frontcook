import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import database from '../../../database';
import { Q } from '@nozbe/watermelondb';
import AuthService from '../../services/auth/authService';
import AppData from '../../../database/models/AppData';

export default function DebugScreen() {
  const [tables, setTables] = useState<{ [key: string]: any[] }>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
    loadUserAndLastSyncTime();
  }, []);

  const loadUserAndLastSyncTime = async () => {
    try {
      const user = await AuthService.getActiveUser();
      setActiveUser(user);
      console.log('[DEBUG] Active user:', user);
      
      if (user) {
        const time = await AppData.getLastSync(database);
        setLastSyncTime(time.toISOString());
      } else {
        setLastSyncTime(null);
      }
    } catch (error) {
      console.error('Error loading user or last sync time:', error);
    }
  };

  const resetLastSyncTime = async () => {
    if (!activeUser) {
      Alert.alert('Błąd', 'Brak aktywnego użytkownika');
      return;
    }

    try {
      await AppData.updateLastSync(database, new Date(0));
      await loadUserAndLastSyncTime();
    } catch (error) {
      console.error('Error resetting last sync time:', error);
      Alert.alert('Błąd', 'Nie udało się zresetować czasu ostatniej synchronizacji');
    }
  };

  const loadAllData = async () => {
    try {
      const tableNames = ['recipes', 'ingredients', 'tags', 'recipe_tags', 'shopping_items', 'user_settings', 'notifications', 'app_data'];
      const tablesData: { [key: string]: any[] } = {};

      for (const tableName of tableNames) {
        const collection = database.get(tableName);
        const records = await collection.query().fetch();
        tablesData[tableName] = records.map(record => ({
          ...record._raw
        }));
      }

      setTables(tablesData);
    } catch (error) {
      console.error('Error loading database data:', error);
    }
  };

  const deleteRecord = async (tableName: string, recordId: string) => {
    try {
      const collection = database.get(tableName);
      const record = await collection.find(recordId);
      
      Alert.alert(
        'Potwierdzenie',
        `Czy na pewno chcesz usunąć ten rekord z tabeli ${tableName}?`,
        [
          {
            text: 'Anuluj',
            style: 'cancel'
          },
          {
            text: 'Usuń',
            style: 'destructive',
            onPress: async () => {
              await database.write(async () => {
                await record.destroyPermanently();
              });
              await loadAllData(); // Odśwież dane po usunięciu
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting record:', error);
      Alert.alert('Błąd', 'Nie udało się usunąć rekordu');
    }
  };

  const renderTableButton = (tableName: string) => (
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
        {tableName} ({tables[tableName]?.length || 0})
      </Text>
    </TouchableOpacity>
  );

  const renderRecordDetails = (record: any) => (
    <View key={record.id} style={styles.recordContainer}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordId}>ID: {record.id}</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => selectedTable && deleteRecord(selectedTable, record.id)}
        >
          <Text style={styles.deleteButtonText}>Usuń</Text>
        </TouchableOpacity>
      </View>
      {Object.entries(record)
        .filter(([key]) => key !== 'id')
        .map(([key, value]) => (
          <Text key={key} style={styles.recordField}>
            {key}: {JSON.stringify(value)}
          </Text>
        ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Debug Panel</Text>
        <View style={styles.userInfoContainer}>
          <Text style={styles.userInfoLabel}>Active User:</Text>
          <Text style={styles.userInfoValue}>{activeUser || 'None'}</Text>
        </View>
        <Text style={styles.syncTimeText}>
          Ostatnia synchronizacja: {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Brak'}
        </Text>
        <TouchableOpacity
          style={styles.resetSyncButton}
          onPress={resetLastSyncTime}
        >
          <Text style={styles.resetSyncButtonText}>Resetuj czas synchronizacji</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal style={styles.tablesContainer}>
        {Object.keys(tables).map(renderTableButton)}
      </ScrollView>

      <ScrollView style={styles.recordsContainer}>
        {selectedTable && tables[selectedTable]?.map(renderRecordDetails)}
        {selectedTable && tables[selectedTable]?.length === 0 && (
          <Text style={styles.emptyText}>Brak rekordów w tabeli</Text>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => {
          loadAllData();
          loadUserAndLastSyncTime();
        }}
      >
        <Text style={styles.refreshButtonText}>Odśwież</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  userInfoContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    backgroundColor: '#e6f7ff',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#91d5ff',
  },
  userInfoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  userInfoValue: {
    fontSize: 14,
    color: '#0066cc',
    fontWeight: '500',
  },
  syncTimeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resetSyncButton: {
    backgroundColor: '#ff9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  resetSyncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tablesContainer: {
    flexGrow: 0,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginRight: 8,
  },
  tableButtonSelected: {
    backgroundColor: '#007AFF',
  },
  tableButtonText: {
    color: '#333',
    fontSize: 14,
  },
  tableButtonTextSelected: {
    color: '#fff',
  },
  recordsContainer: {
    flex: 1,
    padding: 16,
  },
  recordContainer: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordId: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  recordField: {
    fontSize: 14,
    marginBottom: 4,
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 32,
  },
  refreshButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
}); 