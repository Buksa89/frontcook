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
import type { Database, Relation, Query, Collection, Associations } from '@nozbe/watermelondb'; // Dodano Associations
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import AuthService from '../../app/services/auth/authService';
import type RecipeTag from './RecipeTag';

// --- NOWA IMPLEMENTACJA ---

export class Tag extends Model {
  static table = 'recipe_tags'; // Standardowa definicja
  static associations: Associations = {
    recipe_tags_through: { type: 'has_many', foreignKey: 'tag_id' },
  };

  // --- Pola ---
  // Używamy user_id nullable (isOptional: true w schemacie)
  @field('user_id') userId?: string | null;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @text('name') name!: string;
  @field('order') order!: number;

  @lazy @children('recipe_tags_through') recipeTags!: Query<RecipeTag>;

  // --- Metody Statyczne ---
  static observeAll(database: Database): Observable<Tag[]> {
      // Użyj getActiveUserId
      return from(AuthService.getActiveUserId()).pipe(
        switchMap(activeUserId => {
          // Obserwuj tagi użytkownika LUB tagi systemowe (userId=null)
          const userClause = activeUserId ? Q.where('user_id', activeUserId) : Q.where('user_id', null);
          const systemClause = Q.where('user_id', null);
          return database.get<Tag>(this.table)
            .query(Q.or(userClause, systemClause), Q.sortBy('order', Q.asc)) // Pobierz tagi użytkownika LUB systemowe
            .observe();
            // Usunięto sortowanie w map
        })
      );
  }

  static observeForRecipe(database: Database, recipeId: string): Observable<Tag[]> {
      // ... (logika bez zmian, używa poprawnych tabel)
      return database.get<RecipeTag>('recipe_tags_through')
        .query(Q.where('recipe_id', recipeId))
        .observe()
        .pipe(
          map(recipeTags => recipeTags.map(rt => rt.tagId)),
          switchMap(tagIds => {
            if (tagIds.length === 0) return of([]);
            return database.get<Tag>(this.table)
              .query(Q.where('id', Q.oneOf(tagIds)), Q.sortBy('order', Q.asc)) // Dodano sortowanie
              .observe();
          })
          // Usunięto sortowanie w map
        );
  }

  static async getNextOrder(database: Database, userId: string | null): Promise<number> { // Akceptuj null dla userId
      // ... (dostosowane do userId lub null)
      const userClause = userId ? Q.where('user_id', userId) : Q.where('user_id', null);
      try {
        const lastTag = await database.get<Tag>(this.table)
          .query(userClause, Q.sortBy('order', Q.desc), Q.take(1)).fetch();
        return (lastTag.length > 0 ? lastTag[0].order : -1) + 1;
      } catch (error) { console.error(`[DB Tag] Błąd getNextOrder dla ${userId}: ${error}`); return Date.now(); }
  }

  static async createTag(database: Database, data: { userId: string | null; name: string; order?: number; }): Promise<Tag> {
     // ... (logika bez zmian, używa userId | null)
     const collection = database.get<Tag>(this.table);
     let orderToSet = data.order ?? await this.getNextOrder(database, data.userId);
     const userClause = data.userId ? Q.where('user_id', data.userId) : Q.where('user_id', null);
     const existing = await collection.query(userClause, Q.where('name', data.name.trim())).fetch();
     if (existing.length > 0) {
         console.warn(`[DB Tag] Tag "${data.name.trim()}" już istnieje dla userId ${data.userId}. Zwracanie istniejącego.`);
         return existing[0];
     }
     const newTag = await database.write(async () => {
       return await collection.create(tag => { tag.userId = data.userId; tag.name = data.name.trim(); tag.order = orderToSet; });
     });
     console.log(`[DB Tag] Utworzono tag lokalnie: ${newTag.id}`);
     return newTag;
  }

  // --- Metody Instancji ---
  @writer async deleteTag() {
      // ... (logika bez zmian, używa batch)
      console.log(`[DB Tag] Oznaczanie tagu ${this.id} ('${this.name}') i powiązań jako usunięte.`);
      const relatedRecipeTags = await this.recipeTags.fetch();
      await this.database.batch(
          ...relatedRecipeTags.map(rt => rt.prepareMarkAsDeleted()),
          this.prepareMarkAsDeleted()
      );
      console.log(`[DB Tag] Zakończono oznaczanie jako usunięte dla tagu ${this.id}.`);
  }

  @writer async updateTag(updates: { name?: string, order?: number }) {
       // ... (bez zmian)
       await this.update(tag => {
           if (updates.name !== undefined) tag.name = updates.name.trim();
           if (updates.order !== undefined) tag.order = updates.order;
       });
       console.log(`[DB Tag] Zaktualizowano tag ${this.id}.`);
  }

   // --- Przygotowanie do batch (dodane) ---
   prepareDeleteTag(): Model[] { // Zwraca tablicę, bo usuwa też powiązania
       // Ta operacja jest złożona (fetch + delete). Nie można jej łatwo
       // przygotować jako pojedynczą operację `prepare`.
       // Należy ją wykonać wewnątrz `database.write` dla batchowania.
       console.warn("prepareDeleteTag nie jest zaimplementowane dla batch - użyj pełnej metody deleteTag w transakcji.");
       return []; // Zwróć pustą tablicę
       // Alternatywnie, jeśli _NIE_ usuwasz kaskadowo RecipeTags tutaj:
       // return [this.prepareMarkAsDeleted()];
   }

    prepareUpdateTag(updates: { name?: string, order?: number }): Tag {
        return this.prepareUpdate(tag => {
            if (updates.name !== undefined) tag.name = updates.name.trim();
            if (updates.order !== undefined) tag.order = updates.order;
        });
    }
}

export default Tag;