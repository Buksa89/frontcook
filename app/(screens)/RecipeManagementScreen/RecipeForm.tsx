import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, SafeAreaView, Image } from 'react-native';
import { FormField } from './FormField';
import { TagsSelector } from './TagsSelector';
import { TimeInput } from './TimeInput';
import { ServingsInput } from './ServingsInput';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import Tag from '../../../database/models/Tag';
import * as ImagePicker from 'expo-image-picker';
import { showToast } from '../../components/Toast';

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
  image?: string | null;
}

interface RecipeFormProps {
  data: RecipeFormData;
  onDataChange: (field: keyof RecipeFormData, value: string | Tag[] | null) => void;
  availableTags: Tag[];
  onSubmit: () => void;
  isEditing: boolean;
  isApproved?: boolean;
}

export const RecipeForm = ({ 
  data, 
  onDataChange, 
  availableTags, 
  onSubmit,
  isEditing,
  isApproved = true
}: RecipeFormProps) => {
  const handleTimeChange = (field: 'prepTime' | 'totalTime', minutes: number) => {
    onDataChange(field, minutes.toString());
  };

  const handleServingsChange = (servings: number) => {
    onDataChange('servings', servings.toString());
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showToast({
        type: 'error',
        text1: 'Brak uprawnień',
        text2: 'Potrzebujemy uprawnień do galerii aby kontynuować!',
        visibilityTime: 4000,
        position: 'bottom'
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
      aspect: [16, 9],
    });

    if (!result.canceled) {
      onDataChange('image', result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      showToast({
        type: 'error',
        text1: 'Brak uprawnień',
        text2: 'Potrzebujemy uprawnień do kamery aby kontynuować!',
        visibilityTime: 4000,
        position: 'bottom'
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      aspect: [16, 9],
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      onDataChange('image', result.assets[0].uri);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
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
            {data.image ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: data.image }} style={styles.imagePreview} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => onDataChange('image', null)}
                >
                  <MaterialIcons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imagePicker}>
                <TouchableOpacity 
                  style={styles.imagePickerButton}
                  onPress={takePhoto}
                >
                  <MaterialIcons name="camera-alt" size={24} color="#5c7ba9" />
                  <Text style={styles.imagePickerText}>Zrób zdjęcie</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.imagePickerButton}
                  onPress={pickImage}
                >
                  <MaterialIcons name="photo-library" size={24} color="#5c7ba9" />
                  <Text style={styles.imagePickerText}>Wybierz z galerii</Text>
                </TouchableOpacity>
              </View>
            )}
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

// Add default export for Expo Router compatibility
export default RecipeForm;

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
  imagePicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  imagePickerButton: {
    flex: 1,
    height: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    color: '#5c7ba9',
    fontSize: 14,
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 6,
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
    backgroundColor: '#5c7ba9',
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
  bottomSpace: {
    height: 80,
  },
}); 