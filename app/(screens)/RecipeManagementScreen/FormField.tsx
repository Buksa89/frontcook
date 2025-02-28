import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  required?: boolean;
  style?: object;
}

export const FormField = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  multiline = false,
  keyboardType = 'default',
  required = false,
  style
}: FormFieldProps) => {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}{required && '*'}
      </Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.textArea
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
      />
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
}); 