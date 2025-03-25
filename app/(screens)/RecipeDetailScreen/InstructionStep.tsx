import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';

interface InstructionStepProps {
  step: string;
  stepNumber: number;
}

export const InstructionStep: React.FC<InstructionStepProps> = ({ step, stepNumber }) => {
  const [isChecked, setIsChecked] = useState(false);
  
  // Parse the step text to find and format text in square brackets
  const renderFormattedText = () => {
    // If there are no square brackets, return the text as is
    if (!step.includes('[') || !step.includes(']')) {
      return <Text>{step}</Text>;
    }

    // Split the text by square brackets pattern
    const regex = /(\[[^\]]*\])|([^\[\]]+)/g;
    const parts = step.match(regex) || [];
    
    return parts.map((part, index) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        // Text inside square brackets - make it bold and remove the brackets
        const innerText = part.substring(1, part.length - 1);
        return (
          <Text key={index} style={styles.boldText}>
            {innerText}
          </Text>
        );
      } else {
        // Regular text
        return <Text key={index}>{part}</Text>;
      }
    });
  };
  
  return (
    <TouchableOpacity 
      style={[styles.instructionRow, isChecked && styles.instructionRowChecked]}
      onPress={() => setIsChecked(!isChecked)}
      activeOpacity={0.7}
    >
      <Text style={[styles.instructionContent, isChecked && styles.textChecked]}>
        <Text style={[styles.stepNumber, isChecked && styles.textChecked]}>Krok {stepNumber}</Text>
        {'\n'}
      </Text>
      <Text style={[styles.instructionContent, isChecked && styles.textChecked]}>
        {renderFormattedText()}
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
  boldText: {
    fontWeight: 'bold',
  }
}); 