import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  children,
  lazy,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Relation, Query, Collection, Associations } from '@nozbe/watermelondb';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import AuthService from '../../services/auth/authService'; // Poprawiono ścieżkę
import type RecipeTag from './RecipeTag';

export default class Tag extends Model {
  static table = 'tags'; // Zgodnie ze schematem

  static associations: Associations = {
    recipe_tags: { type: 'has_many', foreignKey: 'tag_id' },
  };

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
    return from(AuthService.getActiveUserId()).pipe(
      switchMap(activeUserId => {
        // Klauzula dla tagów użytkownika LUB tagów systemowych
        const userOrSystemClause = activeUserId
          ? Q.or(Q.where('user_id', activeUserId), Q.where('user_id', null))
          : Q.where('user_id', null); // Jeśli nie ma ID, pokaż tylko systemowe

        return database.get<Tag>(this.table)
          .query(
            userOrSystemClause,
            Q.sortBy('order', Q.asc), // Sortuj po kolejności
            Q.sortBy('name', Q.asc)   // Dodatkowe sortowanie po nazwie dla stabilności
          )
          .observe();
      })
    );
  }

  /** Obserwuje tagi przypisane do konkretnego przepisu. */
  static observeForRecipe(database: Database, recipeId: string): Observable<Tag[]> {
    return database.get<RecipeTag>('recipe_tags') // Używamy nazwy tabeli pośredniczącej
      .query(Q.where('recipe_id', recipeId))
      .observe()
      .pipe(
        // Pobierz tylko ID tagów z tabeli pośredniczącej
        map(recipeTags => recipeTags.map(rt => rt.tagId)),
        // Jeśli nie ma powiązanych tagów, zwróć pustą tablicę
        switchMap(tagIds => {
          if (tagIds.length === 0) return of([]);
          // Pobierz pełne obiekty Tag na podstawie ich ID
          return database.get<Tag>(this.table)
            .query(
                Q.where('id', Q.oneOf(tagIds)), // Znajdź tagi o tych ID
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
      // Zwróć 0 jeśli brak tagów, w przeciwnym razie order+1
      return (lastTag.length > 0 ? lastTag[0].order : -1) + 1;
    } catch (error) {
      console.error(`[DB Tag] Błąd getNextOrder dla userId=${userId}:`, error);
      return Date.now(); // Fallback na timestamp w razie błędu
    }
  }

  /** Tworzy nowy tag, sprawdzając czy już nie istnieje (dla danego usera/systemu). */
  static async createTag(database: Database, data: { userId: string | null; name: string; order?: number; }): Promise<Tag> {
    const collection = database.get<Tag>(this.table);
    const trimmedName = data.name.trim();
    if (!trimmedName) {
        throw new Error("Nazwa tagu nie może być pusta.");
    }

    // Sprawdź istnienie
    const userClause = data.userId ? Q.where('user_id', data.userId) : Q.where('user_id', null);
    const existing = await collection.query(userClause, Q.where('name', trimmedName)).fetch();
    if (existing.length > 0) {
        console.warn(`[DB Tag] Tag "${trimmedName}" już istnieje dla userId=${data.userId}. Zwracanie istniejącego.`);
        return existing[0];
    }

    // Przygotuj i utwórz
    const orderToSet = data.order ?? await this.getNextOrder(database, data.userId);
    let newTag: Tag | null = null; // Zadeklaruj poza transakcją

    await database.write(async () => {
      newTag = await collection.create(tag => {
        tag.userId = data.userId;
        tag.name = trimmedName;
        tag.order = orderToSet;
        // last_modified i created_at zostaną ustawione automatycznie przez pola @date
      });
    });

    if (!newTag) {
        throw new Error("Nie udało się utworzyć tagu."); // Dodatkowe zabezpieczenie
    }

    console.log(`[DB Tag] Utworzono tag lokalnie: ${newTag.id} (Name: ${trimmedName}, Order: ${orderToSet}, User: ${data.userId})`);
    return newTag;
  }

  // --- Metody Instancji ---

  /** Oznacza tag i wszystkie jego powiązania z przepisami jako usunięte. */
  @writer async deleteTag() {
    console.log(`[DB Tag] Rozpoczynanie usuwania tagu ${this.id} ('${this.name}') i powiązań.`);
    // Pobierz powiązane rekordy RecipeTag
    const relatedRecipeTags = await this.recipeTags.fetch();
    const batchOperations: Model[] = [];

    // Przygotuj operacje usunięcia powiązań
    relatedRecipeTags.forEach(rt => batchOperations.push(rt.prepareMarkAsDeleted()));

    // Przygotuj operację usunięcia samego tagu
    batchOperations.push(this.prepareMarkAsDeleted());

    // Wykonaj wszystkie operacje w jednej transakcji batch
    await this.database.batch(...batchOperations);
    console.log(`[DB Tag] Zakończono oznaczanie jako usunięte dla tagu ${this.id} i ${relatedRecipeTags.length} powiązań.`);
  }

  /** Aktualizuje nazwę lub kolejność tagu. */
  @writer async updateTag(updates: { name?: string, order?: number }) {
     const trimmedName = updates.name?.trim();
     if (updates.name !== undefined && !trimmedName) {
         console.warn("[DB Tag] Próba ustawienia pustej nazwy tagu - ignorowanie.");
         delete updates.name; // Nie aktualizuj pustej nazwy
     } else if (trimmedName) {
         updates.name = trimmedName; // Użyj przyciętej nazwy
     }

     if (Object.keys(updates).length === 0) {
         console.log(`[DB Tag] Brak zmian do zastosowania dla tagu ${this.id}.`);
         return; // Nic do zrobienia
     }

     await this.update(tag => {
         if (updates.name !== undefined) tag.name = updates.name;
         if (updates.order !== undefined) tag.order = updates.order;
     });
     console.log(`[DB Tag] Zaktualizowano tag ${this.id}. Zmiany:`, updates);
  }

   // --- Przygotowanie do batch ---
   prepareDeleteTag(): Model[] {
       // Zwracamy tylko prepareMarkAsDeleted dla samego tagu.
       // Usunięcie powiązań RecipeTag powinno być obsłużone osobno
       // przez logikę wywołującą, która najpierw pobierze te powiązania.
       // To upraszcza logikę tutaj. Alternatywnie, metoda deleteTag wykonuje to w transakcji.
       return [this.prepareMarkAsDeleted()];
   }

   prepareUpdateTag(updates: { name?: string, order?: number }): Tag | null {
       const trimmedName = updates.name?.trim();
        if (updates.name !== undefined && !trimmedName) {
            return null; // Nie przygotowuj operacji dla pustej nazwy
        }
       return this.prepareUpdate(tag => {
           if (trimmedName) tag.name = trimmedName; // Użyj przyciętej nazwy
           if (updates.order !== undefined) tag.order = updates.order;
       });
   }
}