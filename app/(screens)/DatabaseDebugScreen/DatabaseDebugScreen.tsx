import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import database from '../../../database';
import { Q } from '@nozbe/watermelondb';

export default function DatabaseDebugScreen() {
  const [tables, setTables] = useState<{ [key: string]: any[] }>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const tableNames = ['recipes', 'ingredients', 'tags', 'recipe_tags', 'shopping_items', 'user_settings'];
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
        onPress={loadAllData}
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