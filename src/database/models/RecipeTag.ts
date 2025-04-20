import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  relation,
  immutableRelation,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Relation, associations, Database } from '@nozbe/watermelondb'; // Dodano Database, Zmieniono Associations na associations
import type Recipe from './Recipe';
import type Tag from './Tag';
import { Q } from '@nozbe/watermelondb'; // Dodano Q

export default class RecipeTag extends Model {
  static table = 'recipe_tags'; // Używamy nazwy tabeli pośredniczącej
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
    tags: { type: 'belongs_to', key: 'tag_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @field('recipe_id') recipeId!: string;
  @field('tag_id') tagId!: string;

  // --- Relacje ---
  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;
  @immutableRelation('tags', 'tag_id') tag!: Relation<Tag>;

  // --- Metody Statyczne ---

  /** Tworzy nowe powiązanie między przepisem a tagiem, jeśli jeszcze nie istnieje. */
  static async createLink(database: Database, userId: string, recipeId: string, tagId: string): Promise<RecipeTag> {
    const collection = database.get<RecipeTag>(this.table);
    try {
        // Sprawdź, czy powiązanie już istnieje DLA TEGO UŻYTKOWNIKA
        const existing = await collection.query(
            Q.where('recipe_id', recipeId),
            Q.where('tag_id', tagId),
            Q.where('user_id', userId) // Kluczowe sprawdzenie
        ).fetch();

        if (existing.length > 0) {
            console.warn(`[DB RecipeTag] Powiązanie Recipe ${recipeId} - Tag ${tagId} już istnieje dla userId ${userId}. Zwracanie istniejącego.`);
            return existing[0];
        }

        // Utwórz nowe powiązanie
        return database.write(async () => {
            const newLink = await collection.create(link => {
                link.userId = userId;
                link.recipeId = recipeId;
                link.tagId = tagId;
            });

            console.log(`[DB RecipeTag] Utworzono nowe powiązanie lokalnie: ${newLink.id} (Recipe: ${recipeId}, Tag: ${tagId}, User: ${userId})`);
            return newLink;
        });

    } catch (error) {
         console.error(`[DB RecipeTag] Błąd podczas tworzenia powiązania dla Recipe ${recipeId}, Tag ${tagId}, User ${userId}:`, error);
         throw error;
    }
  }


  // --- Metody Instancji ---

  /** Oznacza powiązanie jako usunięte. */
  @writer async deleteLink() {
    console.log(`[DB RecipeTag] Oznaczanie powiązania ${this.id} (Recipe: ${this.recipeId}, Tag: ${this.tagId}) jako usunięte (lokalnie).`);
    await this.markAsDeleted();
  }

  // --- Przygotowanie do batch ---
  prepareDeleteLink(): RecipeTag {
      return this.prepareMarkAsDeleted();
  }
}