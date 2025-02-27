import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import database from '../database';

export default function AddRecipeScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [totalTime, setTotalTime] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!name || !ingredients || !instructions) {
      Alert.alert('Błąd', 'Wypełnij wymagane pola (nazwa, składniki, instrukcje)');
      return;
    }

    try {
      await database.write(async () => {
        await database.get('recipes').create(recipe => {
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
      });

      Alert.alert('Sukces', 'Przepis został dodany', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Błąd', 'Nie udało się dodać przepisu');
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
          <Text style={styles.submitButtonText}>Dodaj przepis</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
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