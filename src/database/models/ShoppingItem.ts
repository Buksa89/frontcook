import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection } from '@nozbe/watermelondb';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import AuthService from '../../services/auth/authService'; // Poprawiono ścieżkę
import { parseShoppingItem } from '../../utils/shoppingItemParser'; // Importuj parser listy zakupów

export default class ShoppingItem extends Model {
  static table = 'shopping_items';

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('amount') amount?: string | null; // Zgodnie ze schematem (string)
  @text('unit') unit?: string | null;
  @text('name') name!: string;
  @text('type') type?: string | null;
  @field('order') order!: number;
  @field('is_checked') isChecked!: boolean;

  // --- Metody Statyczne ---

  /** Obserwuje nieodznaczone elementy listy zakupów dla zalogowanego użytkownika. */
  static observeUnchecked(database: Database): Observable<ShoppingItem[]> {
    return from(AuthService.getActiveUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<ShoppingItem>(this.table)
          .query(
              Q.where('user_id', activeUserId),
              Q.where('is_checked', false),
              Q.sortBy('order', Q.asc) // Sortuj rosnąco po kolejności
            )
          .observe();
      })
    );
  }

  /** Obserwuje odznaczone elementy listy zakupów dla zalogowanego użytkownika. */
  static observeChecked(database: Database): Observable<ShoppingItem[]> {
    return from(AuthService.getActiveUserId()).pipe(
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<ShoppingItem>(this.table)
          .query(
              Q.where('user_id', activeUserId),
              Q.where('is_checked', true),
              Q.sortBy('order', Q.asc) // Sortuj rosnąco po kolejności
            )
          .observe();
      })
    );
  }

  /** Pobiera następną dostępną wartość 'order' dla danego użytkownika. */
  static async getNextOrder(database: Database, userId: string): Promise<number> {
    if (!userId) { console.error("[DB ShoppingItem] Brak userId..."); return Date.now(); }
    try {
      const lastItem = await database.get<ShoppingItem>(this.table)
        .query(Q.where('user_id', userId), Q.sortBy('order', Q.desc), Q.take(1)).fetch();
      return (lastItem.length > 0 ? lastItem[0].order : -1) + 1;
    } catch (error) {
      console.error(`[DB ShoppingItem] Błąd getNextOrder dla ${userId}:`, error);
      return Date.now(); // Fallback
    }
  }

  /**
   * Znajduje istniejący element listy zakupów o tej samej nazwie, jednostce i stanie odznaczenia.
   * Nazwa jest normalizowana do małych liter przed porównaniem.
  */
  static async findExisting(
    database: Database,
    userId: string,
    name: string,
    unit: string | null,
    isChecked: boolean
  ): Promise<ShoppingItem | null> {
    if (!userId || !name) return null;
    const normalizedName = name.trim().toLowerCase();
    const normalizedUnit = unit?.trim().toLowerCase() ?? null; // Normalizuj jednostkę lub null

    try {
      const items = await database.get<ShoppingItem>(this.table)
        .query(
            Q.where('user_id', userId),
            Q.where('name', Q.eq(normalizedName)), // Porównaj znormalizowaną nazwę
            Q.where('unit', Q.eq(normalizedUnit)), // Porównaj znormalizowaną jednostkę (lub null)
            Q.where('is_checked', isChecked)
        ).fetch();
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      console.error(`[DB ShoppingItem] Błąd findExisting dla "${normalizedName}":`, error);
      return null;
    }
  }

  /** Tworzy nowy element listy zakupów. */
  static async createItem(
    database: Database,
    data: {
        userId: string;
        name: string;
        amount?: string | null;
        unit?: string | null;
        isChecked?: boolean;
        type?: string | null;
        order?: number;
    }): Promise<ShoppingItem> {

    const collection = database.get<ShoppingItem>(this.table);
    const orderToSet = data.order ?? await this.getNextOrder(database, data.userId);
    const normalizedName = data.name.trim().toLowerCase();
    const normalizedUnit = data.unit?.trim().toLowerCase() ?? null;

    if (!normalizedName) {
        throw new Error("Nazwa produktu nie może być pusta.");
    }

    let newItem: ShoppingItem | null = null;
    await database.write(async () => {
      newItem = await collection.create(item => {
        item.userId = data.userId;
        item.name = normalizedName;
        item.amount = data.amount ?? null; // Zapisz jako string lub null
        item.unit = normalizedUnit;
        item.type = data.type ?? null;
        item.order = orderToSet;
        item.isChecked = data.isChecked ?? false;
      });
    });

    if (!newItem) throw new Error("Nie udało się utworzyć elementu listy zakupów.");

    console.log(`[DB ShoppingItem] Utworzono lokalnie: ${newItem.id} (Name: ${normalizedName})`);
    return newItem;
  }

  /**
   * Dodaje element na podstawie tekstu, łącząc z istniejącym, jeśli to możliwe.
   * Używa `parseShoppingItem`.
  */
  static async addItemFromText(database: Database, userId: string, text: string): Promise<ShoppingItem> {
    const parsed = parseShoppingItem(text); // Użyj dedykowanego parsera
    const normalizedName = parsed.name.trim().toLowerCase();
    const normalizedUnit = parsed.unit?.trim().toLowerCase() ?? null;

    if (!normalizedName) {
      throw new Error(`Nie można sparsować nazwy produktu z tekstu: "${text}"`);
    }

    const existingItem = await this.findExisting(database, userId, normalizedName, normalizedUnit, false); // Szukaj nieodznaczonego

    if (existingItem) {
      console.log(`[DB ShoppingItem] Łączenie z istniejącym: ${existingItem.id} (Name: ${normalizedName})`);
      let mergedAmount: string | null = null;
      try {
          const currentAmountNum = existingItem.amount ? parseFloat(existingItem.amount.replace(',', '.')) : 0;
          const newAmountNum = parsed.amount; // parsed.amount jest już number
          if (!isNaN(currentAmountNum) && !isNaN(newAmountNum)) {
              // Sumuj jako liczby, potem konwertuj z powrotem na string z kropką
              mergedAmount = (currentAmountNum + newAmountNum).toString();
          } else {
              // Jeśli któraś ilość jest niepoprawna, zachowaj istniejącą lub nową, jeśli istnieje
              mergedAmount = parsed.amount !== null ? String(parsed.amount) : existingItem.amount;
          }
      } catch(e) {
          console.warn("Błąd parsowania ilości przy łączeniu, używanie nowej ilości:", e);
          mergedAmount = parsed.amount !== null ? String(parsed.amount) : '1'; // Fallback na 1
      }


      await database.write(async () => {
        await existingItem.update(item => {
          item.amount = mergedAmount;
        });
      });
      return existingItem;
    } else {
      console.log(`[DB ShoppingItem] Tworzenie nowego elementu z tekstu: "${text}"`);
      return await this.createItem(database, {
        userId: userId,
        name: normalizedName,
        amount: parsed.amount !== null ? String(parsed.amount) : '1', // Domyślnie '1' jako string
        unit: normalizedUnit,
        // type: parsed.type ?? null, // Jeśli parser zwraca typ
      });
    }
  }

  // --- Metody Instancji ---

  /** Przełącza stan odznaczenia elementu, łącząc z istniejącym, jeśli to możliwe. */
  @writer async toggleChecked() {
    const targetCheckedState = !this.isChecked;
    const normalizedName = this.name.trim().toLowerCase();
    const normalizedUnit = this.unit?.trim().toLowerCase() ?? null;

    // Szukaj istniejącego elementu w stanie docelowym
    const existingItemInTargetState = await ShoppingItem.findExisting(
      this.database,
      this.userId,
      normalizedName,
      normalizedUnit,
      targetCheckedState
    );

    if (existingItemInTargetState) {
      console.log(`[DB ShoppingItem] Łączenie ${this.id} z ${existingItemInTargetState.id} przy zmianie statusu na ${targetCheckedState}.`);
      let mergedAmount : string | null = null;
       try {
          const currentAmountNum = existingItemInTargetState.amount ? parseFloat(existingItemInTargetState.amount.replace(',', '.')) : 0;
          const thisAmountNum = this.amount ? parseFloat(this.amount.replace(',', '.')) : 0;
          if (!isNaN(currentAmountNum) && !isNaN(thisAmountNum)) {
              mergedAmount = (currentAmountNum + thisAmountNum).toString();
          } else {
               mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1';
          }
      } catch(e){
           mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1';
      }

      // Przygotuj operacje w batch
      await this.database.batch(
        existingItemInTargetState.prepareUpdate(item => { item.amount = mergedAmount; }),
        this.prepareMarkAsDeleted() // Oznacz bieżący element jako usunięty
      );
      console.log(`[DB ShoppingItem] Zakończono łączenie.`);

    } else {
      // Po prostu zmień stan bieżącego elementu
      await this.update(item => {
        item.isChecked = targetCheckedState;
      });
      console.log(`[DB ShoppingItem] Zmieniono status isChecked dla ${this.id} na ${targetCheckedState}.`);
    }
  }

  /** Aktualizuje element na podstawie tekstu, łącząc z istniejącym, jeśli to możliwe. */
  @writer async updateFromText(text: string) {
    const parsed = parseShoppingItem(text); // Użyj parsera listy zakupów
    const normalizedName = parsed.name.trim().toLowerCase();
    const normalizedUnit = parsed.unit?.trim().toLowerCase() ?? null;

    if (!normalizedName) {
      console.warn(`[DB ShoppingItem] Nie można sparsować nazwy z tekstu: "${text}"`);
      return; // Nie rób nic, jeśli nie można sparsować nazwy
    }

    // Sprawdź, czy istnieje INNY element o tej samej nazwie, jednostce i stanie
    const existingItem = await ShoppingItem.findExisting(
        this.database,
        this.userId,
        normalizedName,
        normalizedUnit,
        this.isChecked // Sprawdź w tym samym stanie (checked/unchecked)
    );

    // Jeśli istnieje INNY pasujący element, połącz je
    if (existingItem && existingItem.id !== this.id) {
      console.log(`[DB ShoppingItem] Łączenie edytowanego ${this.id} z istniejącym ${existingItem.id}.`);
      let mergedAmount : string | null = null;
       try {
          const currentAmountNum = existingItem.amount ? parseFloat(existingItem.amount.replace(',', '.')) : 0;
          const newAmountNum = parsed.amount; // parsed.amount jest już number
          if (!isNaN(currentAmountNum) && !isNaN(newAmountNum)) {
               mergedAmount = (currentAmountNum + newAmountNum).toString();
          } else {
               mergedAmount = parsed.amount !== null ? String(parsed.amount) : existingItem.amount ?? '1';
          }
      } catch(e) {
           mergedAmount = parsed.amount !== null ? String(parsed.amount) : existingItem.amount ?? '1';
      }

      await this.database.batch(
        existingItem.prepareUpdate(item => { item.amount = mergedAmount; }),
        this.prepareMarkAsDeleted()
      );
       console.log(`[DB ShoppingItem] Zakończono łączenie po edycji.`);
    } else {
      // Jeśli nie ma innego pasującego elementu, lub edytujemy sam siebie, po prostu zaktualizuj
      await this.update(item => {
        item.name = normalizedName;
        item.amount = parsed.amount !== null ? String(parsed.amount) : null;
        item.unit = normalizedUnit;
        // Nie aktualizujemy typu i order przy edycji z tekstu, chyba że parser to wspiera
      });
      console.log(`[DB ShoppingItem] Zaktualizowano element ${this.id} z tekstu.`);
    }
  }

  /** Oznacza element jako usunięty. */
  @writer async deleteItem() {
    console.log(`[DB ShoppingItem] Oznaczanie elementu ${this.id} jako usunięte.`);
    await this.markAsDeleted();
  }

   // --- Przygotowanie do batch ---
   prepareToggleChecked(): Model | null {
       // Logika jest złożona, wymaga zapytania. Lepiej wykonać w transakcji.
       console.warn("prepareToggleChecked nie jest optymalne dla batch - użyj pełnej metody toggleChecked w transakcji.");
       return null;
   }

   prepareUpdateFromText(text: string): Model | null {
       // Logika jest złożona, wymaga zapytania. Lepiej wykonać w transakcji.
       console.warn("prepareUpdateFromText nie jest optymalne dla batch - użyj pełnej metody updateFromText w transakcji.");
       return null;
   }

   prepareDeleteItem(): ShoppingItem {
       return this.prepareMarkAsDeleted();
   }
}