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
import { Observable, of } from 'rxjs'; // Usunięto 'from' i 'switchMap' z tego miejsca
import { map, switchMap } from 'rxjs/operators'; // map może być nadal potrzebne gdzie indziej
// Usunięto import getCurrentUserId
import type RecipeTag from './RecipeTag'; // Upewnij się, że ścieżka jest poprawna, jeśli RecipeTag jest w tym samym folderze

export class Tag extends Model {
  static table = 'tags'; // W nowym schemacie tabela Tagów nazywa się 'tags'

  static associations = {
    recipe_tags_through: { type: 'has_many', foreignKey: 'tag_id' }, // Relacja przez tabelę pośredniczącą
  } as const;

  // --- Pola (zgodne z nowym schematem) ---
  @field('user_id') userId?: string | null; // Może być null dla tagów systemowych
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number; // Nowe pole
  @text('name') name!: string;
  @field('order') order!: number;

  // --- Relacje (przez tabelę pośredniczącą) ---
  @lazy @children('recipe_tags_through') recipeTags!: Query<RecipeTag>;

  // --- Metody Statyczne ---

  /** Obserwuje wszystkie tagi dla podanego użytkownika LUB tagi systemowe (userId=null). */
  static observeAll(database: Database, activeUserId: string | null): Observable<Tag[]> { // <<< ZMIANA: Dodano argument activeUserId
    // --- ZMIANA: Usunięto from(getCurrentUserId()).pipe(switchMap(...)) ---
    const userClause = activeUserId
      ? Q.where('user_id', activeUserId)
      : Q.where('user_id', null); // Jeśli niezalogowany, pokaż tylko systemowe

    const systemClause = Q.where('user_id', null);

    // Zwracamy bezpośrednio Observable z zapytania
    return database.get<Tag>(this.table)
      .query(
        // Pobierz tagi użytkownika LUB tagi systemowe
        Q.or(userClause, systemClause),
        Q.sortBy('order', Q.asc),
        Q.sortBy('name', Q.asc) // Dodatkowe sortowanie dla spójności
      )
      .observe();
  }

  /** Obserwuje tagi przypisane do konkretnego przepisu. */
  static observeForRecipe(database: Database, recipeId: string): Observable<Tag[]> {
     // Używamy tabeli pośredniczącej 'recipe_tags_through'
     return database.get<RecipeTag>('recipe_tags_through')
       .query(Q.where('recipe_id', recipeId))
       .observe()
       .pipe(
         map(recipeTags => recipeTags.map(rt => rt.tagId)),
         switchMap(tagIds => {
           if (tagIds.length === 0) return of([]);
           // Pobieramy tagi z tabeli 'tags'
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
        // last_modified i createdAt zostaną ustawione automatycznie przez WDB/sync
      });
      console.log(`[DB Tag] Utworzono tag lokalnie: ${newTag.id} (Name: ${trimmedName}, Order: ${orderToSet}, User: ${data.userId})`);
      return newTag;
    });
  }

  // --- Metody Instancji ---
  @writer async deleteTag() {
    console.log(`[DB Tag] Oznaczanie tagu ${this.id} ('${this.name}') i powiązań jako usunięte.`);
    const relatedRecipeTags = await this.recipeTags.fetch();
    await this.database.batch(
        ...(relatedRecipeTags.map(rt => rt.prepareMarkAsDeleted()) as WDBModel[]), // Rzutowanie dla pewności
        this.prepareMarkAsDeleted()
    );
    console.log(`[DB Tag] Zakończono oznaczanie jako usunięte dla tagu ${this.id}.`);
  }

  @writer async updateTag(updates: { name?: string, order?: number }) {
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
  prepareDeleteTag(): WDBModel[] {
    console.warn("prepareDeleteTag nie jest zaimplementowane dla batch - użyj pełnej metody deleteTag w transakcji.");
    return [];
  }

  prepareUpdateTag(updates: { name?: string, order?: number }): Tag | null {
    const trimmedName = updates.name?.trim();
     if (updates.name !== undefined && !trimmedName) { return null; }
    return this.prepareUpdate(tag => {
        if (trimmedName) tag.name = trimmedName;
        if (updates.order !== undefined) tag.order = updates.order;
    });
  }
}

export default Tag; // Upewnij się, że eksport jest zgodny z innymi modelami