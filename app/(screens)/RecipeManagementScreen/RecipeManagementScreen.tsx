import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import database from '../../../database';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import { MaterialIcons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import RecipeTag from '../../../database/models/RecipeTag';

interface EditRecipeScreenProps {
  existingRecipe: Recipe | null;
  availableTags: Tag[];
  selectedTags: Tag[];
}

const EditRecipeScreen = ({ existingRecipe, availableTags, selectedTags: initialSelectedTags }: EditRecipeScreenProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [totalTime, setTotalTime] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialSelectedTags);

  useEffect(() => {
    if (existingRecipe) {
      setName(existingRecipe.name);
      setDescription(existingRecipe.description || '');
      setPrepTime(existingRecipe.prepTime?.toString() || '');
      setTotalTime(existingRecipe.totalTime?.toString() || '');
      setServings(existingRecipe.servings?.toString() || '');
      setIngredients(existingRecipe.ingredients);
      setInstructions(existingRecipe.instructions);
      setNotes(existingRecipe.notes || '');
    }
  }, [existingRecipe]);

  const handleSubmit = async () => {
    if (!name || !ingredients || !instructions) {
      Alert.alert('Błąd', 'Wypełnij wymagane pola (nazwa, składniki, instrukcje)');
      return;
    }

    try {
      await database.write(async () => {
        if (existingRecipe) {
          await existingRecipe.update(recipe => {
            recipe.name = name;
            recipe.description = description;
            recipe.prepTime = parseInt(prepTime) || 0;
            recipe.totalTime = parseInt(totalTime) || 0;
            recipe.servings = parseInt(servings) || 1;
            recipe.ingredients = ingredients;
            recipe.instructions = instructions;
            recipe.notes = notes;
          });

          // Update recipe tags
          const recipeTagsCollection = database.get<RecipeTag>('recipe_tags');
          const existingTags = await recipeTagsCollection
            .query(Q.where('recipe_id', existingRecipe.id))
            .fetch();

          // Prepare all operations for the batch
          const operations = [
            ...existingTags.map(tag => tag.prepareDestroyPermanently()),
            ...selectedTags.map(tag => 
              recipeTagsCollection.prepareCreate(rt => {
                rt.recipeId = existingRecipe.id;
                rt.tagId = tag.id;
              })
            )
          ];

          // Execute all operations in a single batch
          await database.batch(...operations);
        } else {
          const recipesCollection = database.get<Recipe>('recipes');
          const newRecipe = await recipesCollection.create(recipe => {
            recipe.name = name;
            recipe.description = description;
            recipe.prepTime = parseInt(prepTime) || 0;
            recipe.totalTime = parseInt(totalTime) || 0;
            recipe.servings = parseInt(servings) || 1;
            recipe.ingredients = ingredients;
            recipe.instructions = instructions;
            recipe.notes = notes;
            recipe.rating = 0;
            recipe.isApproved = true;
          });

          // Add tags to new recipe
          const recipeTagsCollection = database.get<RecipeTag>('recipe_tags');
          const operations = selectedTags.map(tag =>
            recipeTagsCollection.prepareCreate(rt => {
              rt.recipeId = newRecipe.id;
              rt.tagId = tag.id;
            })
          );

          // Execute all operations in a single batch
          if (operations.length > 0) {
            await database.batch(...operations);
          }
        }
      });

      Alert.alert(
        'Sukces', 
        existingRecipe ? 'Przepis został zaktualizowany' : 'Przepis został dodany', 
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Błąd', existingRecipe ? 'Nie udało się zaktualizować przepisu' : 'Nie udało się dodać przepisu');
      console.error(error);
    }
  };

  const TagsModal = () => (
    <Modal
      visible={showTagsModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowTagsModal(false)}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={() => setShowTagsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Wybierz tagi</Text>
            <TouchableOpacity onPress={() => setShowTagsModal(false)}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.tagsList}>
            {availableTags.map(tag => {
              const isSelected = selectedTags.some(t => t.id === tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagItem,
                    isSelected && styles.tagItemSelected
                  ]}
                  onPress={() => {
                    if (isSelected) {
                      setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
                    } else {
                      setSelectedTags([...selectedTags, tag]);
                    }
                  }}
                >
                  <Text style={[
                    styles.tagItemText,
                    isSelected && styles.tagItemTextSelected
                  ]}>
                    {tag.name}
                  </Text>
                  {isSelected && (
                    <MaterialIcons name="check" size={20} color="#2196F3" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Nazwa*</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nazwa przepisu"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tagi</Text>
          <TouchableOpacity
            style={styles.tagsButton}
            onPress={() => setShowTagsModal(true)}
          >
            <View style={styles.selectedTags}>
              {selectedTags.length > 0 ? (
                selectedTags.map(tag => (
                  <View key={tag.id} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag.name}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.tagsPlaceholder}>Wybierz tagi</Text>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Opis</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Krótki opis przepisu"
            multiline
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Czas przygotowania (min)</Text>
            <TextInput
              style={styles.input}
              value={prepTime}
              onChangeText={setPrepTime}
              placeholder="np. 15"
              keyboardType="numeric"
            />
          </View>

          <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Całkowity czas (min)</Text>
            <TextInput
              style={styles.input}
              value={totalTime}
              onChangeText={setTotalTime}
              placeholder="np. 45"
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Liczba porcji</Text>
          <TextInput
            style={styles.input}
            value={servings}
            onChangeText={setServings}
            placeholder="np. 4"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Składniki*</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Lista składników"
            multiline
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Instrukcje*</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Sposób przygotowania"
            multiline
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Notatki</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Dodatkowe uwagi"
            multiline
          />
        </View>

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={handleSubmit}
        >
          <Text style={styles.submitButtonText}>
            {existingRecipe ? 'Zapisz zmiany' : 'Dodaj przepis'}
          </Text>
        </TouchableOpacity>
      </View>

      <TagsModal />
    </ScrollView>
  );
};

const enhance = withObservables(['recipeId'], ({ recipeId }: { recipeId?: string }) => ({
  existingRecipe: recipeId 
    ? database.get<Recipe>('recipes').findAndObserve(recipeId)
    : of(null),
  availableTags: database.get<Tag>('tags')
    .query()
    .observe(),
  selectedTags: recipeId
    ? database.get<Recipe>('recipes')
        .findAndObserve(recipeId)
        .pipe(
          switchMap(recipe => {
            if (!recipe) return of([]);
            return database
              .get<RecipeTag>('recipe_tags')
              .query(Q.where('recipe_id', recipe.id))
              .observe()
              .pipe(
                switchMap(async recipeTags => {
                  const tags = await Promise.all(
                    recipeTags.map(rt => 
                      database.get<Tag>('tags').find(rt.tagId)
                    )
                  );
                  return tags.filter((tag): tag is Tag => tag !== null);
                })
              );
          })
        )
    : of([]),
}));

const EnhancedEditRecipeScreen = enhance(EditRecipeScreen);

export default function AddRecipe() {
  const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
  return <EnhancedEditRecipeScreen recipeId={recipeId} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  form: {
    padding: 16,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  tagsList: {
    padding: 16,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tagItemSelected: {
    backgroundColor: '#f5f5f5',
  },
  tagItemText: {
    fontSize: 16,
    color: '#333',
  },
  tagItemTextSelected: {
    color: '#2196F3',
    fontWeight: '500',
  },
  tagsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  selectedTags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipText: {
    color: '#2196F3',
    fontSize: 14,
  },
  tagsPlaceholder: {
    color: '#999',
    fontSize: 16,
  },
}); 