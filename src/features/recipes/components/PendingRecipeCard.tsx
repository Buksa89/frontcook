// src/features/recipes/components/PendingRecipeCard.tsx
import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Alert, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons, AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import { withObservables } from '@nozbe/watermelondb/react';
import Recipe from '../../../database/models/Recipe';
import Tag from '../../../database/models/Tag';
import RecipeImageLocal from '../../../database/models/RecipeImageLocal';
import database from '../../../database';
import { formatTime } from '../../../utils/timeFormat';
import * as FileSystem from 'expo-file-system';
import { Q } from '@nozbe/watermelondb';
import { map } from 'rxjs/operators';

interface PendingRecipeCardProps {
  recipe: Recipe;
  tags: Tag[];
  recipeImageLocal: RecipeImageLocal | null;
}

const PendingRecipeCardComponent: React.FC<PendingRecipeCardProps> = ({ recipe, tags, recipeImageLocal }) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);

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

  const handleApprove = async () => {
    if (isApproving || isDeleting) return; setIsApproving(true);
    try { await database.write(() => recipe.toggleApproval()); }
    catch (error) { console.error('Błąd akceptowania:', error); Alert.alert("Błąd", "Nie udało się zatwierdzić."); }
    finally { setIsApproving(false); }
  };

  const handleDelete = async () => {
    if (isApproving || isDeleting) return;
    Alert.alert( "Usuń przepis", `Czy na pewno chcesz usunąć "${recipe.name}"?`,
      [ { text: "Anuluj", style: "cancel" }, { text: "Usuń", style: "destructive", onPress: async () => {
            setIsDeleting(true); try { await database.write(() => recipe.markAsDeletedCascade()); }
            catch (error) { console.error("Błąd usuwania:", error); Alert.alert("Błąd", "Nie udało się usunąć."); }
          }, }, ]
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        // --- POPRAWKA ŚCIEŻKI ---
        router.push({
            pathname: '/(screens)/RecipeDetailScreen', // Używamy ścieżki do katalogu
            params: { recipeId: recipe.id }
        });
        // Alternatywnie, jeśli masz dynamiczny route w `app/(screens)/RecipeDetailScreen/[recipeId].tsx`:
        // router.push(`/(screens)/RecipeDetailScreen/${recipe.id}`);
      }}
    >
      <View style={styles.imageContainer}>
        {isImageLoading ? <View style={styles.imagePlaceholder}><ActivityIndicator size="small" color="#ccc" /></View> : thumbnailUri ? <Image source={{ uri: thumbnailUri }} style={styles.image} resizeMode="cover" /> : <View style={styles.imagePlaceholder}><MaterialIcons name="image-not-supported" size={30} color="#bbb" /></View>}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.title} numberOfLines={2}>{recipe.name}</Text>
        <View style={styles.pendingLabel}><MaterialIcons name="pending" size={14} color="#ffa000" /><Text style={styles.pendingText}>Oczekuje na zatwierdzenie</Text></View>
      </View>
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete} disabled={isApproving || isDeleting}>
          {isDeleting ? <ActivityIndicator size="small" color="#e53935" /> : <MaterialIcons name="close" size={24} color="#e53935" />}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={handleApprove} disabled={isApproving || isDeleting}>
          {isApproving ? <ActivityIndicator size="small" color="#4CAF50" /> : <MaterialIcons name="check" size={24} color="#4CAF50" />}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const enhance = withObservables(['recipe'], ({ recipe }: { recipe: Recipe }) => ({
  recipe,
  tags: Tag.observeForRecipe(database, recipe.id),
  recipeImageLocal: database.get<RecipeImageLocal>('recipe_images_local').query(Q.where('recipe_id', recipe.id), Q.take(1)).observe().pipe(map(results => results[0] ?? null))
}));

export const EnhancedPendingRecipeCard = enhance(PendingRecipeCardComponent);

// --- Style ---
const styles = StyleSheet.create({
    // ... (style bez zmian) ...
    card: { flexDirection: 'row', backgroundColor: '#fff8e1', borderRadius: 12, marginVertical: 6, marginHorizontal: 10, padding: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#ffa000', },
    imageContainer: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#f0f0f0', marginRight: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', },
    image: { width: '100%', height: '100%', },
    imagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0', },
    imageLoading: {},
    cardContent: { flex: 1, justifyContent: 'center', marginRight: 8, },
    title: { fontSize: 15, fontWeight: '600', color: '#444', marginBottom: 4, },
    pendingLabel: { flexDirection: 'row', alignItems: 'center', marginTop: 4, },
    pendingText: { marginLeft: 4, fontSize: 12, color: '#ffa000', fontStyle: 'italic', fontWeight: '500', },
    actionsContainer: { flexDirection: 'row', },
    actionButton: { padding: 8, marginLeft: 4, justifyContent: 'center', alignItems: 'center', width: 40, height: 40, borderRadius: 20, },
    deleteButton: { backgroundColor: '#ffeeee', },
    approveButton: { backgroundColor: '#e8f5e9', },
});