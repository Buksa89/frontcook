import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';

interface InstructionStepProps {
  step: string;
  stepNumber: number;
}

export const InstructionStep: React.FC<InstructionStepProps> = ({ step, stepNumber }) => {
  const [isChecked, setIsChecked] = useState(false);
  
  return (
    <TouchableOpacity 
      style={[styles.instructionRow, isChecked && styles.instructionRowChecked]}
      onPress={() => setIsChecked(!isChecked)}
      activeOpacity={0.7}
    >
      <Text style={[styles.instructionContent, isChecked && styles.textChecked]}>
        <Text style={[styles.stepNumber, isChecked && styles.textChecked]}>Krok {stepNumber}</Text>
        {'\n'}{step}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  instructionRow: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  instructionRowChecked: {
    backgroundColor: '#CCCCCC',
  },
  instructionContent: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  stepNumber: {
    fontWeight: '700',
    color: '#444',
  },
  textChecked: {
    color: '#fff',
  },
}); 