import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { FormField } from './FormField';
import { TagsSelector } from './TagsSelector';
import Tag from '../../../database/models/Tag';

interface RecipeFormData {
  name: string;
  description: string;
  prepTime: string;
  totalTime: string;
  servings: string;
  ingredients: string;
  instructions: string;
  notes: string;
  selectedTags: Tag[];
}

interface RecipeFormProps {
  data: RecipeFormData;
  onDataChange: (field: keyof RecipeFormData, value: string | Tag[]) => void;
  availableTags: Tag[];
  onSubmit: () => void;
  isEditing: boolean;
}

export const RecipeForm = ({ 
  data, 
  onDataChange, 
  availableTags, 
  onSubmit,
  isEditing 
}: RecipeFormProps) => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <FormField
          label="Nazwa"
          value={data.name}
          onChangeText={(value) => onDataChange('name', value)}
          placeholder="Nazwa przepisu"
          required
        />

        <TagsSelector
          label="Tagi"
          availableTags={availableTags}
          selectedTags={data.selectedTags}
          onTagsChange={(tags) => onDataChange('selectedTags', tags)}
        />

        <FormField
          label="Opis"
          value={data.description}
          onChangeText={(value) => onDataChange('description', value)}
          placeholder="Krótki opis przepisu"
          multiline
        />

        <View style={styles.row}>
          <FormField
            label="Czas przygotowania (min)"
            value={data.prepTime}
            onChangeText={(value) => onDataChange('prepTime', value)}
            placeholder="np. 15"
            keyboardType="numeric"
            style={{ flex: 1, marginRight: 8 }}
          />

          <FormField
            label="Całkowity czas (min)"
            value={data.totalTime}
            onChangeText={(value) => onDataChange('totalTime', value)}
            placeholder="np. 45"
            keyboardType="numeric"
            style={{ flex: 1, marginLeft: 8 }}
          />
        </View>

        <FormField
          label="Liczba porcji"
          value={data.servings}
          onChangeText={(value) => onDataChange('servings', value)}
          placeholder="np. 4"
          keyboardType="numeric"
        />

        <FormField
          label="Składniki"
          value={data.ingredients}
          onChangeText={(value) => onDataChange('ingredients', value)}
          placeholder="Lista składników"
          multiline
          required
        />

        <FormField
          label="Instrukcje"
          value={data.instructions}
          onChangeText={(value) => onDataChange('instructions', value)}
          placeholder="Sposób przygotowania"
          multiline
          required
        />

        <FormField
          label="Notatki"
          value={data.notes}
          onChangeText={(value) => onDataChange('notes', value)}
          placeholder="Dodatkowe uwagi"
          multiline
        />

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={onSubmit}
        >
          <Text style={styles.submitButtonText}>
            {isEditing ? 'Zapisz zmiany' : 'Dodaj przepis'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  form: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 