import React, { useState, useEffect } from 'react';
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
  const isEmpty = value.trim() === '';
  const showRequiredIndicator = required && isEmpty;
  const [inputHeight, setInputHeight] = useState<number | undefined>(multiline ? 100 : undefined);
  
  // Reset height when value is cleared
  useEffect(() => {
    if (multiline && value === '') {
      setInputHeight(100);
    }
  }, [value, multiline]);
  
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.requiredStar}>*</Text>}
      </Text>
      <View>
        <TextInput
          style={[
            styles.input,
            multiline && {...styles.textArea, height: inputHeight},
            showRequiredIndicator && styles.requiredInput
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          multiline={multiline}
          keyboardType={keyboardType}
          onContentSizeChange={multiline ? (event) => {
            setInputHeight(Math.max(100, event.nativeEvent.contentSize.height + 20));
          } : undefined}
        />
        {showRequiredIndicator && (
          <View style={styles.requiredIndicator}>
            <Text style={styles.requiredIndicatorText}>Pole wymagane</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// Add default export for Expo Router compatibility
export default FormField;

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
    color: '#5c7ba9',
    marginLeft: 2,
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  requiredInput: {
    borderColor: '#5c7ba9',
    backgroundColor: '#f8f9ff',
  },
  requiredIndicator: {
    marginTop: 4,
    paddingHorizontal: 8,
  },
  requiredIndicatorText: {
    fontSize: 12,
    color: '#5c7ba9',
    fontStyle: 'italic',
  }
}); 