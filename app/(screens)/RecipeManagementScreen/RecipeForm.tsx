import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { FormField } from './FormField';
import { TagsSelector } from './TagsSelector';
import { TimeInput } from './TimeInput';
import { ServingsInput } from './ServingsInput';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
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
  nutrition?: string;
  video?: string;
  source?: string;
}

interface RecipeFormProps {
  data: RecipeFormData;
  onDataChange: (field: keyof RecipeFormData, value: string | Tag[]) => void;
  availableTags: Tag[];
  onSubmit: () => void;
  onDelete?: () => void;
  isEditing: boolean;
  isApproved?: boolean;
}

export const RecipeForm = ({ 
  data, 
  onDataChange, 
  availableTags, 
  onSubmit,
  onDelete,
  isEditing,
  isApproved = true
}: RecipeFormProps) => {
  const handleDelete = () => {
    Alert.alert(
      'Usuń przepis',
      'Czy na pewno chcesz usunąć ten przepis? Tej operacji nie można cofnąć.',
      [
        {
          text: 'Anuluj',
          style: 'cancel'
        },
        {
          text: 'Usuń',
          onPress: onDelete,
          style: 'destructive'
        }
      ]
    );
  };

  const handleTimeChange = (field: 'prepTime' | 'totalTime', minutes: number) => {
    onDataChange(field, minutes.toString());
  };

  const handleServingsChange = (servings: number) => {
    onDataChange('servings', servings.toString());
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          {onDelete && (
            <View style={styles.headerContainer}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <MaterialIcons name="delete" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <FormField
            label="Nazwa"
            value={data.name}
            onChangeText={(value) => onDataChange('name', value)}
            placeholder="Nazwa przepisu"
            required
          />

          <FormField
            label="Opis"
            value={data.description}
            onChangeText={(value) => onDataChange('description', value)}
            placeholder="Krótki opis przepisu"
            multiline
          />

          <TagsSelector
            label="Tagi"
            availableTags={availableTags}
            selectedTags={data.selectedTags}
            onTagsChange={(tags) => onDataChange('selectedTags', tags)}
          />

          <View style={styles.imageSection}>
            <Text style={styles.label}>Obrazek</Text>
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>Funkcja dodawania obrazków będzie dostępna wkrótce</Text>
            </View>
          </View>

          <View style={styles.row}>
            <TimeInput
              label="Czas przygotowania"
              value={parseInt(data.prepTime) || 0}
              onChange={(minutes) => handleTimeChange('prepTime', minutes)}
              style={{ flex: 1, marginRight: 8 }}
            />

            <TimeInput
              label="Całkowity czas"
              value={parseInt(data.totalTime) || 0}
              onChange={(minutes) => handleTimeChange('totalTime', minutes)}
              style={{ flex: 1, marginLeft: 8 }}
            />
          </View>

          <ServingsInput
            label="Liczba porcji"
            value={parseInt(data.servings) || 1}
            onChange={handleServingsChange}
            required
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

          <FormField
            label="Wartości odżywcze"
            value={data.nutrition || ''}
            onChangeText={(value) => onDataChange('nutrition', value)}
            placeholder="Informacje o wartościach odżywczych"
            multiline
          />

          <FormField
            label="Video"
            value={data.video || ''}
            onChangeText={(value) => onDataChange('video', value)}
            placeholder="Link do video"
          />

          <FormField
            label="Źródło"
            value={data.source || ''}
            onChangeText={(value) => onDataChange('source', value)}
            placeholder="Źródło przepisu"
          />
          
          <View style={styles.bottomSpace} />
        </View>
      </ScrollView>
      
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity 
          style={styles.submitButton}
          onPress={onSubmit}
        >
          {isEditing && !isApproved ? (
            <>
              <MaterialIcons name="check-circle" size={20} color="#fff" style={styles.saveIcon} />
              <Text style={styles.approveButtonText}>
                Zaakceptuj i zapisz
              </Text>
            </>
          ) : (
            <>
              <AntDesign name="save" size={20} color="#fff" style={styles.saveIcon} />
              <Text style={styles.submitButtonText}>
                {isEditing ? 'Zapisz zmiany' : 'Dodaj przepis'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  imageSection: {
    marginBottom: 16,
  },
  imagePlaceholder: {
    height: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    color: '#999',
    fontSize: 14,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveIcon: {
    marginRight: 8,
  },
  deleteButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  bottomSpace: {
    height: 80,
  },
}); 