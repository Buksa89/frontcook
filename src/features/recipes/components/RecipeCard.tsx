// src/features/recipes/components/RecipeCard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, Alert, Platform, ActivityIndicator } from 'react-native'; // Dodano ActivityIndicator
import { withObservables } from '@nozbe/watermelondb/react';
import { AntDesign, MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { map, switchMap, distinctUntilChanged } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import database from '../../../database'; // Usunięto - nie potrzebujemy tu bezpośrednio
import Tag from '../../../database/models/Tag';
import Recipe from '../../../database/models/Recipe';
import RecipeImageLocal from '../../../database/models/RecipeImageLocal';
import Ingredient from '../../../database/models/Ingredient';
import { Q } from '@nozbe/watermelondb';
import { formatTime } from '../../../utils/timeFormat';
import * as FileSystem from 'expo-file-system';

// Interfejsy i reszta importów bez zmian...

interface RecipeCardProps {
  recipe: Recipe;
  tags: Tag[];
  recipeImageLocal: RecipeImageLocal | null;
}

// Komponent wewnętrzny z logiką
const RecipeCardComponent: React.FC<RecipeCardProps> = ({ recipe, tags, recipeImageLocal }) => {
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false); // Dodano stan usuwania

  useEffect(() => {
    let isMounted = true;
    const checkAndSetImage = async () => {
      setIsImageLoading(true); const localPath = recipeImageLocal?.localThumbnailPath;
      if (localPath) { try { const fileInfo = await FileSystem.getInfoAsync(localPath); if (isMounted) setThumbnailUri(fileInfo.exists ? localPath : null); } catch (error) { if (isMounted) setThumbnailUri(null); } }
      else { if (isMounted) setThumbnailUri(null); }
      if (isMounted) setIsImageLoading(false);
    };
    checkAndSetImage(); return () => { isMounted = false; };
  }, [recipeImageLocal?.localThumbnailPath]);

  // --- Obsługa Akcji ---
  const openShoppingListMenu = () => {
    console.log('TODO: Otwórz AddShopingItemMenu dla przepisu:', recipe.id);
  };

  const handleEdit = () => {
    setContextMenuVisible(false);
    router.push({
       // --- POPRAWKA ŚCIEŻKI ---
       pathname: "/(screens)/RecipeManagementScreen/RecipeManagementScreen", // Upewnij się, że pasuje do nazwy pliku/katalogu w `app/(screens)`
       params: { recipeId: recipe.id }
     });
  };

  const handleDelete = () => {
    if (isDeleting) return; // Zapobiegaj wielokrotnemu kliknięciu
    setContextMenuVisible(false);
    Alert.alert(
      "Usuń przepis",
      `Czy na pewno chcesz usunąć "${recipe.name}"? Tej operacji nie można cofnąć.`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          onPress: async () => {
            setIsDeleting(true); // Ustaw stan usuwania
            try {
              // --- ZMIANA: Bezpośrednie wywołanie metody @writer ---
              await recipe.markAsDeletedCascade();
              // --- KONIEC ZMIANY ---
            } catch (error) {
              console.error("Błąd podczas usuwania przepisu:", error);
              Alert.alert("Błąd", "Nie udało się usunąć przepisu.");
              setIsDeleting(false); // Zresetuj stan w razie błędu
            }
            // Reset stanu isDeleting nie jest tu konieczny, bo komponent zniknie
          },
          style: "destructive"
        }
      ]
    );
  };

  const showContextMenu = () => setContextMenuVisible(true);

  // --- Renderowanie ---
  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({
          // --- POPRAWKA ŚCIEŻKI ---
          pathname: '/(screens)/RecipeDetailScreen/RecipeDetailScreen', // Upewnij się, że pasuje do nazwy pliku/katalogu w `app/(screens)`
          params: { recipeId: recipe.id }
        })}
        onLongPress={showContextMenu}
        delayLongPress={500}
      >
        {/* ... reszta renderowania karty (bez zmian) ... */}
         <View style={styles.imageContainer}>
            {isImageLoading ? (
              <View style={[styles.imagePlaceholder, styles.imageLoading]}>
                <ActivityIndicator size="small" color="#ccc" />
              </View>
            ) : thumbnailUri ? (
              <Image source={{ uri: thumbnailUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="image-not-supported" size={30} color="#bbb" />
              </View>
            )}
          </View>
          <View style={styles.cardContent}>
             <Text style={styles.title} numberOfLines={2}>{recipe.name}</Text>
             {tags && tags.length > 0 && (
               <View style={styles.tagsContainer}>
                 {tags.slice(0, 3).map(tag => (
                   <View key={tag.id} style={styles.tag}>
                     <Text style={styles.tagText}>{tag.name}</Text>
                   </View>
                 ))}
               </View>
             )}
             <View style={styles.infoContainer}>
               {recipe.rating > 0 && (
                 <View style={styles.rating}>
                   <Ionicons name="star" size={14} color="#FFA41C" />
                   <Text style={styles.ratingText}>{recipe.rating.toFixed(1)}</Text>
                 </View>
               )}
               {recipe.prepTime !== null && recipe.prepTime > 0 && (
                 <View style={styles.timeInfo}>
                   <MaterialIcons name="timer" size={14} color="#666" />
                   <Text style={styles.timeText}>{formatTime(recipe.prepTime)}</Text>
                 </View>
               )}
               {recipe.totalTime !== null && recipe.totalTime > 0 && (
                 <View style={styles.timeInfo}>
                   <MaterialIcons name="schedule" size={14} color="#666" />
                   <Text style={styles.timeText}>{formatTime(recipe.totalTime)}</Text>
                 </View>
               )}
             </View>
           </View>
           <TouchableOpacity style={styles.shoppingCartButton} onPress={openShoppingListMenu}>
             <AntDesign name="shoppingcart" size={24} color="#5c7ba9" />
           </TouchableOpacity>
      </TouchableOpacity>

      {/* Menu kontekstowe */}
      <Modal
        visible={contextMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setContextMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setContextMenuVisible(false)}
        >
          <View style={styles.contextMenu} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.contextMenuItem} onPress={handleEdit}>
              <Feather name="edit" size={20} color="#333" />
              <Text style={styles.contextMenuItemText}>Edytuj</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contextMenuItem, styles.contextMenuItemDelete]}
              onPress={handleDelete}
              disabled={isDeleting} // Wyłącz przycisk podczas usuwania
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#ff4444" style={styles.deleteIconSpacing} />
              ) : (
                <Feather name="trash-2" size={20} color="#ff4444" />
              )}
              <Text style={[styles.contextMenuItemText, styles.contextMenuItemTextDelete]}>Usuń</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// HOC bez zmian
const enhance = withObservables(['recipe'], ({ recipe }: { recipe: Recipe }) => ({
  recipe,
  tags: Tag.observeForRecipe(database, recipe.id),
  recipeImageLocal: database.get<RecipeImageLocal>('recipe_images_local')
                           .query(Q.where('recipe_id', recipe.id), Q.take(1))
                           .observe()
                           .pipe(map(results => results[0] ?? null))
}));

export const EnhancedRecipeCard = enhance(RecipeCardComponent);

// Style - dodano styl dla odstępu ikony usuwania
const styles = StyleSheet.create({
  // ... (reszta stylów bez zmian) ...
    card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginVertical: 6, marginHorizontal: 10, padding: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, alignItems: 'center', },
    imageContainer: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#f0f0f0', marginRight: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', },
    image: { width: '100%', height: '100%', },
    imagePlaceholder: { },
    imageLoading: { },
    cardContent: { flex: 1, justifyContent: 'center', },
    title: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4, },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6, },
    tag: { backgroundColor: '#eef2ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: 4, marginBottom: 4, },
    tagText: { color: '#5c7ba9', fontSize: 11, fontWeight: '500', },
    infoContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', },
    rating: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 4, },
    ratingText: { marginLeft: 4, fontSize: 13, color: '#555', fontWeight: '500', },
    timeInfo: { flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 4, },
    timeText: { marginLeft: 4, fontSize: 13, color: '#555', },
    shoppingCartButton: { padding: 8, marginLeft: 8, },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', },
    contextMenu: { backgroundColor: 'white', borderRadius: 8, paddingVertical: 8, minWidth: 200, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, },
    contextMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, },
    contextMenuItemDelete: { },
    contextMenuItemText: { fontSize: 16, marginLeft: 12, color: '#333', },
    contextMenuItemTextDelete: { color: '#ff4444', },
    deleteIconSpacing: { marginRight: 0 }, // Styl dla ActivityIndicator w miejscu ikony
});