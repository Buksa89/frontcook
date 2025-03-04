import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
      const tableNames = ['recipes', 'ingredients', 'tags', 'recipe_tags', 'shopping_items'];
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
      <Text style={styles.recordId}>ID: {record.id}</Text>
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
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  tableButtonSelected: {
    backgroundColor: '#2196F3',
  },
  tableButtonText: {
    fontSize: 14,
    color: '#666',
  },
  tableButtonTextSelected: {
    color: '#fff',
  },
  recordsContainer: {
    flex: 1,
    padding: 16,
  },
  recordContainer: {
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  recordId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 8,
  },
  recordField: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 32,
  },
  refreshButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 