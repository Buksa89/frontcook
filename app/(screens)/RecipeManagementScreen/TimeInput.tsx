import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';

interface TimeInputProps {
  label: string;
  value: number; // Wartość zawsze w minutach
  onChange: (value: number) => void;
  required?: boolean;
  style?: object;
}

// Predefiniowane opcje czasu pogrupowane według kategorii
const timeCategories = [
  {
    name: 'Minuty',
    icon: 'timer',
    options: [
      { label: 'Brak', value: 0 },
      { label: '5 min', value: 5 },
      { label: '10 min', value: 10 },
      { label: '15 min', value: 15 },
      { label: '20 min', value: 20 },
      { label: '25 min', value: 25 },
      { label: '30 min', value: 30 },
      { label: '35 min', value: 35 },
      { label: '40 min', value: 40 },
      { label: '45 min', value: 45 },
      { label: '50 min', value: 50 },
      { label: '55 min', value: 55 },
    ]
  },
  {
    name: 'Godziny',
    icon: 'schedule',
    options: [
      { label: '1 godz', value: 60 },
      { label: '1,5 godz', value: 90 },
      { label: '2 godz', value: 120 },
      { label: '2,5 godz', value: 150 },
      { label: '3 godz', value: 180 },
      { label: '4 godz', value: 240 },
      { label: '5 godz', value: 300 },
      { label: '6 godz', value: 360 },
      { label: '8 godz', value: 480 },
      { label: '12 godz', value: 720 },
    ]
  },
  {
    name: 'Dni',
    icon: 'today',
    options: [
      { label: '1 dzień', value: 1440 },
      { label: '1,5 dnia', value: 2160 },
      { label: '2 dni', value: 2880 },
      { label: '3 dni', value: 4320 },
      { label: '4 dni', value: 5760 },
      { label: '5 dni', value: 7200 },
      { label: '7 dni', value: 10080 },
    ]
  }
];

// Spłaszczona lista wszystkich opcji do wyszukiwania
const allTimeOptions = timeCategories.flatMap(category => category.options);

export const TimeInput = ({
  label,
  value,
  onChange,
  required = false,
  style
}: TimeInputProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  
  // Określ aktywną kategorię na podstawie aktualnej wartości
  const getActiveCategory = (minutes: number) => {
    if (minutes >= 1440) return 'Dni';
    if (minutes >= 60) return 'Godziny';
    return 'Minuty';
  };
  
  const [activeCategory, setActiveCategory] = useState(() => getActiveCategory(value));
  
  // Formatuj wyświetlaną wartość
  const formatDisplayValue = (minutes: number) => {
    if (minutes === 0) return '0 min';
    
    // Znajdź predefiniowaną opcję
    const option = allTimeOptions.find(opt => opt.value === minutes);
    if (option) return option.label;
    
    // Jeśli nie ma predefiniowanej opcji, sformatuj ręcznie
    const days = Math.floor(minutes / 1440);
    const remainingMinutes = minutes % 1440;
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    
    let result = '';
    
    if (days > 0) {
      result += `${days} ${days === 1 ? 'dzień' : 'dni'} `;
    }
    
    if (hours > 0) {
      result += `${hours} ${getHourLabel(hours)} `;
    }
    
    if (mins > 0 || (days === 0 && hours === 0)) {
      result += mins > 0 ? `${mins} min` : '0 min';
    }
    
    return result.trim();
  };
  
  // Pomocnicza funkcja do określenia formy słowa "godzina"
  const getHourLabel = (hours: number) => {
    if (hours === 1) return 'godzina';
    if (hours >= 2 && hours <= 4) return 'godziny';
    return 'godz';
  };

  const handleSelectTime = (minutes: number) => {
    onChange(minutes);
    setModalVisible(false);
  };

  const handleOpenModal = () => {
    setActiveCategory(getActiveCategory(value));
    setModalVisible(true);
  };

  const showRequiredIndicator = required && value === 0;

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.requiredStar}>*</Text>}
      </Text>
      
      <TouchableOpacity
        style={[
          styles.container,
          showRequiredIndicator && styles.requiredInput
        ]}
        onPress={handleOpenModal}
      >
        <Text style={styles.displayValue}>
          {formatDisplayValue(value)}
        </Text>
        <AntDesign name="clockcircleo" size={20} color="#666" />
      </TouchableOpacity>
      
      {showRequiredIndicator && (
        <View style={styles.requiredIndicator}>
          <Text style={styles.requiredIndicatorText}>Pole wymagane</Text>
        </View>
      )}
      
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <AntDesign name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Tabs dla kategorii */}
            <View style={styles.categoryTabs}>
              {timeCategories.map(category => (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryTab,
                    activeCategory === category.name && styles.activeTab
                  ]}
                  onPress={() => setActiveCategory(category.name)}
                >
                  <MaterialIcons 
                    name={category.icon} 
                    size={20} 
                    color={activeCategory === category.name ? '#2196F3' : '#666'} 
                  />
                  <Text style={[
                    styles.categoryTabText,
                    activeCategory === category.name && styles.activeTabText
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Zawsze pokazuj opcję "Brak" */}
            {value !== 0 && (
              <TouchableOpacity
                style={styles.noneOption}
                onPress={() => handleSelectTime(0)}
              >
                <Text style={styles.noneOptionText}>Brak (0 min)</Text>
              </TouchableOpacity>
            )}
            
            {/* Lista opcji dla wybranej kategorii */}
            <ScrollView style={styles.optionsContainer}>
              {timeCategories
                .find(category => category.name === activeCategory)?.options
                .filter(option => option.value > 0) // Filtruj "Brak", bo już jest wyżej
                .map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionItem,
                      value === option.value && styles.selectedOption
                    ]}
                    onPress={() => handleSelectTime(option.value)}
                  >
                    <Text style={[
                      styles.optionText,
                      value === option.value && styles.selectedOptionText
                    ]}>
                      {option.label}
                    </Text>
                    {value === option.value && (
                      <MaterialIcons name="check" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  requiredStar: {
    color: '#2196F3',
    marginLeft: 2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 12,
  },
  displayValue: {
    fontSize: 16,
    color: '#333',
  },
  requiredInput: {
    borderColor: '#2196F3',
    backgroundColor: '#f8f9ff',
  },
  requiredIndicator: {
    marginTop: 4,
    paddingHorizontal: 8,
  },
  requiredIndicatorText: {
    fontSize: 12,
    color: '#2196F3',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  categoryTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  categoryTabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '500',
  },
  noneOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  noneOptionText: {
    fontSize: 16,
    color: '#666',
  },
  optionsContainer: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#2196F3',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedOptionText: {
    color: '#fff',
    fontWeight: '500',
  },
}); 