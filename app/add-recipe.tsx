import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import database from '../database';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../database/models/Recipe';
import { Q } from '@nozbe/watermelondb';
import { map } from 'rxjs/operators';

interface EditRecipeScreenProps {
  existingRecipe?: Recipe | null;
}

const EditRecipeScreen = ({ existingRecipe }: EditRecipeScreenProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [totalTime, setTotalTime] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');

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
        } else {
          const recipesCollection = database.get<Recipe>('recipes');
          await recipesCollection.create(recipe => {
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
    </ScrollView>
  );
};

const enhance = withObservables(['recipeId'], ({ recipeId }: { recipeId?: string }) => ({
  existingRecipe: database.get<Recipe>('recipes')
    .query(Q.where('id', Q.eq(recipeId || '')))
    .observeWithColumns(['id'])
    .pipe(
      map(recipes => recipes[0] || null)
    )
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
}); 