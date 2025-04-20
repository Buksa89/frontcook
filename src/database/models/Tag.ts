// src/database/models/Tag.ts
import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  children,
  lazy,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Relation, Query, Collection, associations } from '@nozbe/watermelondb'; // Poprawiono Associations -> associations
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider'; // ZMIANA IMPORTU
import type RecipeTag from './RecipeTag';

export default class Tag extends Model {
  static table = 'tags';

  static associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'tag_id' },
  } as const;

  // --- Pola ---
  @field('user_id') userId?: string | null;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('name') name!: string;
  @field('order') order!: number;

  // --- Relacje ---
  @lazy @children('recipe_tags') recipeTags!: Query<RecipeTag>;

  // --- Metody Statyczne ---

  /** Obserwuje wszystkie tagi dla zalogowanego użytkownika LUB tagi systemowe (userId=null). */
  static observeAll(database: Database): Observable<Tag[]> {
    // Używamy nowej funkcji zamiast AuthService.getActiveUserId()
    return from(getCurrentUserId()).pipe( // ZMIANA WYWOŁANIA
      switchMap(activeUserId => {
        const userOrSystemClause = activeUserId
          ? Q.or(Q.where('user_id', activeUserId), Q.where('user_id', null))
          : Q.where('user_id', null);

        return database.get<Tag>(this.table)
          .query(
            userOrSystemClause,
            Q.sortBy('order', Q.asc),
            Q.sortBy('name', Q.asc)
          )
          .observe();
      })
    );
  }

  /** Obserwuje tagi przypisane do konkretnego przepisu. */
  static observeForRecipe(database: Database, recipeId: string): Observable<Tag[]> {
     // Ta metoda nie używała AuthService, więc bez zmian
     return database.get<RecipeTag>('recipe_tags')
       .query(Q.where('recipe_id', recipeId))
       .observe()
       .pipe(
         map(recipeTags => recipeTags.map(rt => rt.tagId)),
         switchMap(tagIds => {
           if (tagIds.length === 0) return of([]);
           return database.get<Tag>(this.table)
             .query(
                 Q.where('id', Q.oneOf(tagIds)),
                 Q.sortBy('order', Q.asc),
                 Q.sortBy('name', Q.asc)
             )
             .observe();
         })
       );
  }

  /** Pobiera następną dostępną wartość 'order' dla danego użytkownika (lub null dla systemowych). */
  static async getNextOrder(database: Database, userId: string | null): Promise<number> {
    // Logika bez zmian
    const userClause = userId ? Q.where('user_id', userId) : Q.where('user_id', null);
    try {
      const lastTag = await database.get<Tag>(this.table)
        .query(userClause, Q.sortBy('order', Q.desc), Q.take(1)).fetch();
      return (lastTag.length > 0 ? lastTag[0].order : -1) + 1;
    } catch (error) {
      console.error(`[DB Tag] Błąd getNextOrder dla userId=${userId}:`, error);
      return Date.now();
    }
  }

  /** Tworzy nowy tag, sprawdzając czy już nie istnieje (dla danego usera/systemu). */
  static async createTag(database: Database, data: { userId: string | null; name: string; order?: number; }): Promise<Tag> {
    // Logika bez zmian
      const collection = database.get<Tag>(this.table);
      const trimmedName = data.name.trim();
      if (!trimmedName) {
          throw new Error("Nazwa tagu nie może być pusta.");
      }
      const userClause = data.userId ? Q.where('user_id', data.userId) : Q.where('user_id', null);
      const existing = await collection.query(userClause, Q.where('name', trimmedName)).fetch();
      if (existing.length > 0) {
          console.warn(`[DB Tag] Tag "${trimmedName}" już istnieje dla userId=${data.userId}. Zwracanie istniejącego.`);
          return existing[0];
      }
      const orderToSet = data.order ?? await this.getNextOrder(database, data.userId);
      return database.write(async () => {
        const newTag = await collection.create(tag => {
          tag.userId = data.userId;
          tag.name = trimmedName;
          tag.order = orderToSet;
        });
        console.log(`[DB Tag] Utworzono tag lokalnie: ${newTag.id} (Name: ${trimmedName}, Order: ${orderToSet}, User: ${data.userId})`);
        return newTag;
      });
  }

  // --- Metody Instancji ---
  @writer async deleteTag() {
    // Logika bez zmian
    console.log(`[DB Tag] Rozpoczynanie usuwania tagu ${this.id} ('${this.name}') i powiązań.`);
    const relatedRecipeTags = await this.recipeTags.fetch();
    const batchOperations: Model[] = relatedRecipeTags.map(rt => rt.prepareMarkAsDeleted());
    batchOperations.push(this.prepareMarkAsDeleted());
    await this.database.batch(...batchOperations);
    console.log(`[DB Tag] Zakończono oznaczanie jako usunięte dla tagu ${this.id} i ${relatedRecipeTags.length} powiązań.`);
  }

  @writer async updateTag(updates: { name?: string, order?: number }) {
    // Logika bez zmian
     const trimmedName = updates.name?.trim();
     if (updates.name !== undefined && !trimmedName) { delete updates.name; }
     else if (trimmedName) { updates.name = trimmedName; }
     if (Object.keys(updates).length === 0) { return; }
     await this.update(tag => {
         if (updates.name !== undefined) tag.name = updates.name;
         if (updates.order !== undefined) tag.order = updates.order;
     });
     console.log(`[DB Tag] Zaktualizowano tag ${this.id}. Zmiany:`, updates);
  }

   // --- Przygotowanie do batch ---
   prepareDeleteTag(): Model[] {
       // Logika bez zmian
       return [this.prepareMarkAsDeleted()];
   }

   prepareUpdateTag(updates: { name?: string, order?: number }): Tag | null {
       // Logika bez zmian
       const trimmedName = updates.name?.trim();
        if (updates.name !== undefined && !trimmedName) { return null; }
       return this.prepareUpdate(tag => {
           if (trimmedName) tag.name = trimmedName;
           if (updates.order !== undefined) tag.order = updates.order;
       });
   }
}