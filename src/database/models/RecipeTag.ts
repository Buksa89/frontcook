// src/database/models/RecipeTag.ts
import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  relation,
  immutableRelation,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Relation, associations, Database, Model as WDBModel } from '@nozbe/watermelondb';
import type Recipe from './Recipe';
import type Tag from './Tag';
import { Q } from '@nozbe/watermelondb';
// --- DODAJ IMPORT UUID ---
import { v4 as uuidv4 } from 'uuid';
// -----------------------


export default class RecipeTag extends Model {
  static table = 'recipe_tags'; // Używamy poprawnej nazwy tabeli pośredniczącej
  static associations = {
    recipes: { type: 'belongs_to', key: 'recipe_id' },
    tags: { type: 'belongs_to', key: 'tag_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId!: string | null; // Oczekuje string | null
  @date('last_modified') lastModified!: number; // Oczekuje number (timestamp)
  @date('created_at') createdAt!: number;     // Oczekuje number (timestamp)
  @field('recipe_id') recipeId!: string;     // UUID przepisu
  @field('tag_id') tagId!: string;           // UUID tagu

  // --- Relacje ---
  @immutableRelation('recipes', 'recipe_id') recipe!: Relation<Recipe>;
  @immutableRelation('tags', 'tag_id') tag!: Relation<Tag>;

  // --- Metody Statyczne ---

  /**
   * Tworzy nowe powiązanie między przepisem a tagiem (z UUID), jeśli jeszcze nie istnieje.
   */
  static async createLink(database: Database, userId: string | null, recipeId: string, tagId: string): Promise<RecipeTag> {
    const collection = database.get<RecipeTag>(this.table);
    try {
        // Sprawdź, czy powiązanie już istnieje DLA TEGO UŻYTKOWNIKA
        const userClause = userId === null ? Q.where('user_id', null) : Q.where('user_id', userId);
        const existing = await collection.query(
            Q.where('recipe_id', recipeId),
            Q.where('tag_id', tagId),
            userClause
        ).fetch();

        if (existing.length > 0) {
            console.warn(`[DB RecipeTag] Powiązanie Recipe ${recipeId} - Tag ${tagId} już istnieje dla userId ${userId ?? 'null'}. Zwracanie istniejącego.`);
            return existing[0];
        }

        // --- GENERUJ UUID DLA POWIĄZANIA ---
        const newId = uuidv4();
        // ------------------------------------

        // Utwórz nowe powiązanie
        return database.write(async () => {
            const newLink = await collection.create(link => {
                // --- PRZYPISZ UUID ---
                link._raw.id = newId;
                // -------------------
                link.userId = userId;
                link.recipeId = recipeId;
                link.tagId = tagId;
                // last_modified i created_at zarządzane przez WDB/sync
            });

            console.log(`[DB RecipeTag] Utworzono nowe powiązanie lokalnie z UUID: ${newLink.id} (Recipe: ${recipeId}, Tag: ${tagId}, User: ${userId ?? 'null'})`);
            return newLink;
        });

    } catch (error) {
         console.error(`[DB RecipeTag] Błąd podczas tworzenia powiązania dla Recipe ${recipeId}, Tag ${tagId}, User ${userId ?? 'null'}:`, error);
         throw error;
    }
  }

  /**
   * Przygotowuje operację tworzenia powiązania dla batch (z UUID).
   * UWAGA: Ta metoda NIE sprawdza, czy powiązanie już istnieje. Należy to zrobić przed jej wywołaniem!
   */
  static prepareCreateLink(database: Database, userId: string | null, recipeId: string, tagId: string): RecipeTag {
    const collection = database.get<RecipeTag>(this.table);
    // --- GENERUJ UUID ---
    const newId = uuidv4();
    // -------------------
    return collection.prepareCreate(link => {
      // --- PRZYPISZ UUID ---
      link._raw.id = newId;
      // -------------------
      link.userId = userId;
      link.recipeId = recipeId;
      link.tagId = tagId;
    });
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