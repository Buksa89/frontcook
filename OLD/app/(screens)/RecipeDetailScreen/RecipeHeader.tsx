// src/components/RecipeHeader.tsx (lub podobna ścieżka)

import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Share, Alert, Text, ActivityIndicator } from 'react-native'; // Dodano ActivityIndicator
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import type Recipe from '../../../database/models/Recipe'; // Importuj NOWY typ Recipe
import type Ingredient from '../../../database/models/Ingredient'; // Importuj NOWY typ Ingredient
import { formatTime } from '../../../app/utils/timeFormat'; // Upewnij się, że ścieżka jest poprawna
// Usunięto import needsProcessing - nie jest już potrzebny tutaj

interface RecipeHeaderProps {
  recipe: Recipe; // Przyjmujemy NOWY model Recipe
  ingredients?: Ingredient[]; // Przyjmujemy NOWY model Ingredient
}

const RecipeHeader: React.FC<RecipeHeaderProps> = ({ recipe, ingredients = [] }) => {
  const [imageUrl, setImageUrl] = useState<string | null | undefined>(undefined); // undefined oznacza stan początkowy/ładowanie
  const [isFetchingImage, setIsFetchingImage] = useState(true); // Zachowujemy flagę ładowania

  // --- NOWA LOGIKA POBIERANIA OBRAZKA ---
  const fetchImage = useCallback(async () => {
    // Sprawdź, czy przepis istnieje i ma relację 'images'
    if (!recipe || typeof recipe.images?.fetch !== 'function') {
      console.log(`[RecipeHeader] Brak przepisu lub relacji 'images' dla ID: ${recipe?.id}`);
      setIsFetchingImage(false);
      setImageUrl(null); // Brak obrazka
      return;
    }

    setIsFetchingImage(true);
    try {
      console.log(`[RecipeHeader] Pobieranie obrazków dla przepisu ID: ${recipe.id}`);
      // Pobierz powiązane obiekty RecipeImage, posortowane wg 'order'
      const images = await recipe.images.query(Q.sortBy('order', Q.asc)).fetch();

      if (images.length > 0) {
        const primaryImage = images[0];
        // Pobierz URL z pola imageUrl (które musi istnieć w nowym modelu RecipeImage)
        const url = primaryImage.imageUrl; // Używamy pola imageUrl
        console.log(`[RecipeHeader] Znaleziono URL obrazka: ${url}`);
        setImageUrl(url); // Ustaw URL lub null, jeśli pole jest puste
      } else {
        console.log(`[RecipeHeader] Brak powiązanych obrazków dla przepisu ID: ${recipe.id}`);
        setImageUrl(null); // Brak obrazka
      }
    } catch (error) {
      console.error(`[RecipeHeader] Błąd podczas pobierania obrazków dla przepisu ID ${recipe.id}:`, error);
      setImageUrl(null); // Ustaw na null w razie błędu
    } finally {
      setIsFetchingImage(false); // Zakończ ładowanie
    }
  }, [recipe]); // Zależność od obiektu recipe

  // Użyj useFocusEffect, aby załadować obrazek, gdy ekran jest aktywny
  useFocusEffect(fetchImage);

  // --- Logika Udostępniania (bez zmian w samej logice formatowania tekstu) ---
  const handleShareRecipe = useCallback(async () => {
    // ... (cała logika formatowania shareText pozostaje taka sama) ...
     try {
        let shareText = `🍳 ${recipe.name} 🍳\n\n`;
        if (recipe.description) shareText += `${recipe.description}\n\n`;
        if (recipe.prepTime) shareText += `⏱️ Przygotowanie: ${formatTime(recipe.prepTime)}\n`;
        if (recipe.totalTime) shareText += `⏱️ Całkowity: ${formatTime(recipe.totalTime)}\n`;
        if (recipe.servings) shareText += `👥 Porcje: ${recipe.servings}\n`;
        if (recipe.rating > 0) { /* ... gwiazdki ... */ }
        shareText += '\n';
        if (ingredients && ingredients.length > 0) {
            shareText += '📋 SKŁADNIKI:\n';
            ingredients.forEach(ing => { /* ... formatowanie składnika ... */
                 let line = '';
                 if(ing.amount) line += `${ing.amount} `;
                 if(ing.unit) line += `${ing.unit} `;
                 line += ing.name;
                 shareText += `• ${line}\n`;
             });
            shareText += '\n';
        }
        if (recipe.instructions) {
            shareText += '📝 INSTRUKCJE:\n';
            recipe.instructions.split('\n').filter(s => s.trim()).forEach((step, i) => { shareText += `${i + 1}. ${step}\n`; });
            shareText += '\n';
        }
        if (recipe.notes) shareText += `📌 NOTATKI:\n${recipe.notes}\n\n`;
        // Zmieniono 'source' na 'sourceUrl'
        if (recipe.sourceUrl) shareText += `Źródło: ${recipe.sourceUrl}\n`;

        await Share.share({ message: shareText, title: recipe.name });
      } catch (error) {
        console.error('Błąd podczas udostępniania przepisu:', error);
        Alert.alert('Błąd', 'Nie udało się udostępnić przepisu.');
      }
  }, [recipe, ingredients]); // Zależności

  // --- Renderowanie ---
  return (
    <View style={styles.header}>
      {/* Stan ładowania obrazka */}
      {isFetchingImage ? (
        <View style={styles.imagePlaceholder}>
          <ActivityIndicator size="small" color="#ccc" />
        </View>
      ) : imageUrl ? ( // Sprawdź, czy imageUrl istnieje i nie jest pusty/null
        <Image
          key={imageUrl} // Użyj URL jako klucz do odświeżenia
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={(e) => {
              console.log(`[RecipeHeader] Błąd ładowania zdjęcia ${imageUrl}:`, e.nativeEvent.error);
              // Opcjonalnie: Ustaw imageUrl na null, aby pokazać placeholder w razie błędu ładowania
              // setImageUrl(null);
          }}
        />
      ) : (
        // Placeholder, jeśli brak obrazka lub błąd ładowania
        <View style={styles.imagePlaceholder}>
          <MaterialIcons name="restaurant" size={48} color="#ccc" />
        </View>
      )}

      {/* Przyciski (bez zmian w logice, ale używają danych z nowego modelu `recipe`) */}
      {recipe.isApproved && (
        <TouchableOpacity style={styles.shareButton} onPress={handleShareRecipe}>
          <MaterialIcons name="share" size={24} color="#5c7ba9" />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => router.push({
          pathname: '/(screens)/RecipeManagementScreen/RecipeManagementScreen',
          params: { recipeId: recipe.id } // Przekazujemy ID z nowego modelu
        })}
      >
        <MaterialIcons name="edit" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export { RecipeHeader };

// --- Style (bez zmian) ---
const styles = StyleSheet.create({
  header: { position: 'relative' },
  image: { width: '100%', height: undefined, aspectRatio: 1024 / 633 }, // Dostosuj proporcje
  imagePlaceholder: { width: '100%', height: undefined, aspectRatio: 1024 / 633, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  shareButton: { position: 'absolute', right: 84, bottom: -20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  editButton: { position: 'absolute', right: 16, bottom: -20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#5c7ba9', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
});