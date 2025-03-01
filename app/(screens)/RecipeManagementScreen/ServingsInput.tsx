import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AntDesign } from '@expo/vector-icons';

interface ServingsInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  style?: object;
  min?: number;
  max?: number;
}

export const ServingsInput = ({
  label,
  value,
  onChange,
  required = false,
  style,
  min = 1,
  max = 20
}: ServingsInputProps) => {
  const handleDecrease = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrease = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  const showRequiredIndicator = required && value < min;

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.requiredStar}>*</Text>}
      </Text>
      
      <View style={[
        styles.container,
        showRequiredIndicator && styles.requiredInput
      ]}>
        <TouchableOpacity
          style={[styles.button, value <= min && styles.buttonDisabled]}
          onPress={handleDecrease}
          disabled={value <= min}
        >
          <AntDesign name="minus" size={20} color={value <= min ? '#ccc' : '#2196F3'} />
        </TouchableOpacity>
        
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.unit}>porcji</Text>
        </View>
        
        <TouchableOpacity
          style={[styles.button, value >= max && styles.buttonDisabled]}
          onPress={handleIncrease}
          disabled={value >= max}
        >
          <AntDesign name="plus" size={20} color={value >= max ? '#ccc' : '#2196F3'} />
        </TouchableOpacity>
      </View>
      
      {showRequiredIndicator && (
        <View style={styles.requiredIndicator}>
          <Text style={styles.requiredIndicatorText}>Pole wymagane</Text>
        </View>
      )}
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 8,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#f0f0f0',
  },
  valueContainer: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  unit: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
}); 