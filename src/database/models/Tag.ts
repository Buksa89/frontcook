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
import type { Database, Relation, Query, Collection, associations, Model as WDBModel } from '@nozbe/watermelondb';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import type RecipeTag from './RecipeTag';
// --- DODAJ IMPORT UUID ---
import { v4 as uuidv4 } from 'uuid';
// -----------------------

export class Tag extends Model {
  static table = 'tags'; // Poprawna nazwa tabeli

  static associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'tag_id' }, // Poprawiono na 'recipe_tags'
  } as const;

  // --- Pola (zgodne ze schematem) ---
  @field('user_id') userId?: string | null; // string | null
  @date('last_modified') lastModified!: number; // number (timestamp)
  @date('created_at') createdAt!: number;     // number (timestamp)
  @text('name') name!: string;
  @field('order') order!: number;

  // --- Relacje (przez tabelę pośredniczącą) ---
  @lazy @children('recipe_tags') recipeTags!: Query<RecipeTag>; // Poprawiono na recipe_tags

  // --- Metody Statyczne ---

  /** Obserwuje wszystkie tagi dla podanego użytkownika LUB tagi systemowe (userId=null). */
  static observeAll(database: Database, activeUserId: string | null): Observable<Tag[]> {
    const userClause = activeUserId ? Q.where('user_id', activeUserId) : Q.where('user_id', null);
    const systemClause = Q.where('user_id', null);

    return database.get<Tag>(this.table)
      .query(
        Q.or(userClause, systemClause),
        Q.sortBy('order', Q.asc),
        Q.sortBy('name', Q.asc)
      )
      .observe();
  }

  /** Obserwuje tagi przypisane do konkretnego przepisu. */
  static observeForRecipe(database: Database, recipeId: string): Observable<Tag[]> {
     return database.get<RecipeTag>('recipe_tags') // Poprawiono nazwę tabeli M2M
       .query(Q.where('recipe_id', recipeId))
       .observe()
       .pipe(
         map(recipeTags => recipeTags.map(rt => rt.tagId)),
         switchMap(tagIds => {
           if (tagIds.length === 0) return of([]);
           return database.get<Tag>(Tag.table)
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
    const userClause = userId === null ? Q.where('user_id', null) : Q.where('user_id', userId);
    try {
      const lastTag = await database.get<Tag>(this.table)
        .query(userClause, Q.sortBy('order', Q.desc), Q.take(1)).fetch();
      return (lastTag.length > 0 ? lastTag[0].order : -1) + 1;
    } catch (error) {
      console.error(`[DB Tag] Błąd getNextOrder dla userId=${userId ?? 'null'}:`, error);
      return Date.now();
    }
  }

  /**
   * Tworzy nowy tag z UUID, sprawdzając czy już nie istnieje (dla danego usera/systemu).
   */
  static async createTag(
      database: Database,
      data: { userId: string | null; name: string; order?: number; }
  ): Promise<Tag> {
    const collection = database.get<Tag>(this.table);
    const trimmedName = data.name.trim();
    if (!trimmedName) {
        throw new Error("Nazwa tagu nie może być pusta.");
    }
    const userClause = data.userId === null ? Q.where('user_id', null) : Q.where('user_id', data.userId);
    const existing = await collection.query(userClause, Q.where('name', trimmedName)).fetch();
    if (existing.length > 0) {
        console.warn(`[DB Tag] Tag "${trimmedName}" już istnieje dla userId=${data.userId ?? 'null'}. Zwracanie istniejącego.`);
        return existing[0];
    }
    const orderToSet = data.order ?? await this.getNextOrder(database, data.userId);

    // --- GENERUJ UUID ---
    const newId = uuidv4();
    // -------------------

    return database.write(async () => {
      const newTag = await collection.create(tag => {
        // --- PRZYPISZ UUID ---
        tag._raw.id = newId;
        // -------------------
        tag.userId = data.userId; // string | null
        tag.name = trimmedName;
        tag.order = orderToSet;
        // last_modified i created_at zarządzane przez WDB/sync
      });
      console.log(`[DB Tag] Utworzono tag lokalnie z UUID: ${newTag.id} (Name: ${trimmedName}, Order: ${orderToSet}, User: ${data.userId ?? 'null'})`);
      return newTag;
    });
  }

  // --- Metody Instancji ---
  @writer async deleteTag() {
    console.log(`[DB Tag] Oznaczanie tagu ${this.id} ('${this.name}') i powiązań jako usunięte.`);
    const relatedRecipeTags = await this.recipeTags.fetch();
    await this.database.batch(
        ...(relatedRecipeTags.map(rt => rt.prepareMarkAsDeleted()) as WDBModel[]),
        this.prepareMarkAsDeleted()
    );
    console.log(`[DB Tag] Zakończono oznaczanie jako usunięte dla tagu ${this.id}.`);
  }

  @writer async updateTag(updates: { name?: string, order?: number }) {
    const trimmedName = updates.name?.trim();
    const validUpdates: Partial<Tag> = {}; // Użyj Partial<Tag>

    if (trimmedName) {
        validUpdates.name = trimmedName;
    } else if (updates.name !== undefined) {
        // Jeśli podano pustą nazwę po trim, ignorujemy zmianę nazwy
        console.warn(`[DB Tag updateTag] Pusta nazwa tagu po trim dla ${this.id}, ignorowanie zmiany nazwy.`);
    }

    if (updates.order !== undefined && typeof updates.order === 'number') {
        validUpdates.order = updates.order;
    }

    if (Object.keys(validUpdates).length === 0) {
        console.log(`[DB Tag updateTag] Brak prawidłowych zmian do zastosowania dla ${this.id}.`);
        return; // Zakończ, jeśli nie ma zmian
    }

    await this.update(tag => {
        Object.assign(tag, validUpdates);
    });
    console.log(`[DB Tag] Zaktualizowano tag ${this.id}. Zmiany:`, validUpdates);
  }


  // --- Przygotowanie do batch ---
  prepareDeleteTag(): WDBModel[] {
    console.warn("prepareDeleteTag nie jest w pełni zaimplementowane dla batch - użyj pełnej metody deleteTag w transakcji, aby usunąć powiązania.");
    // Zwraca tylko operację na samym tagu
    return [this.prepareMarkAsDeleted()];
  }

  prepareUpdateTag(updates: { name?: string, order?: number }): Tag | null {
    const trimmedName = updates.name?.trim();
    const validUpdates: Partial<Tag> = {};

    if (trimmedName) {
        validUpdates.name = trimmedName;
    }
    if (updates.order !== undefined && typeof updates.order === 'number') {
        validUpdates.order = updates.order;
    }

    if (Object.keys(validUpdates).length === 0) {
        return null; // Brak zmian do przygotowania
    }

    return this.prepareUpdate(tag => {
        Object.assign(tag, validUpdates);
    });
  }
}

export default Tag; // Zduplikowany export, zostawiamy tylko pierwszy