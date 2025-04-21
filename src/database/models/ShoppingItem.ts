// src/database/models/ShoppingItem.ts
import { Model, Q } from '@nozbe/watermelondb';
import { field, text, date, writer } from '@nozbe/watermelondb/decorators';
import type { Database, Collection, Model as WDBModel } from '@nozbe/watermelondb';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider';
import { parseShoppingItem } from '../../utils/shoppingItemParser';
import { v4 as uuidv4 } from 'uuid';

export default class ShoppingItem extends Model {
  static table = 'shopping_items';

  // --- Pola ---
  @field('user_id') userId?: string | null;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('amount') amount?: string | null; // Float na serwerze, ale trzymamy string w WDB dla elastyczności
  @text('unit') unit!: string;             // --- ZMIANA: Usunięto ?, teraz string (nie null)
  @text('name') name!: string;
  @text('type') type!: string;             // --- ZMIANA: Usunięto ?, teraz string (nie null)
  @field('order') order!: number;
  @field('is_checked') isChecked!: boolean;

  // --- Metody Statyczne ---

  static observeUnchecked(database: Database): Observable<ShoppingItem[]> {
    return from(getCurrentUserId()).pipe(
      switchMap(activeUserId => {
        const userClause = activeUserId === null ? Q.where('user_id', null) : Q.where('user_id', activeUserId);
        return database.get<ShoppingItem>(this.table)
          .query( userClause, Q.where('is_checked', false), Q.sortBy('order', Q.asc) )
          .observe();
      })
    );
  }

  static observeChecked(database: Database): Observable<ShoppingItem[]> {
    return from(getCurrentUserId()).pipe(
      switchMap(activeUserId => {
        const userClause = activeUserId === null ? Q.where('user_id', null) : Q.where('user_id', activeUserId);
        return database.get<ShoppingItem>(this.table)
          .query( userClause, Q.where('is_checked', true), Q.sortBy('order', Q.asc) )
          .observe();
      })
    );
  }

  static async getNextOrder(database: Database, userId: string | null): Promise<number> {
    const userClause = userId === null ? Q.where('user_id', null) : Q.where('user_id', userId);
    try {
      const lastItem = await database.get<ShoppingItem>(this.table)
        .query(userClause, Q.sortBy('order', Q.desc), Q.take(1)).fetch();
      return (lastItem.length > 0 ? lastItem[0].order : -1) + 1;
    } catch (error) {
      console.error(`[DB SI] Błąd getNextOrder dla ${userId ?? 'null'}:`, error);
      return Date.now();
    }
  }

  static async findExisting(
    database: Database,
    userId: string | null,
    name: string,
    unit: string, // --- ZMIANA: Oczekuje string (pusty, nie null)
    isChecked: boolean
  ): Promise<ShoppingItem | null> {
    if (!name) return null;
    const normalizedName = name.trim().toLowerCase();
    const normalizedUnit = unit.trim().toLowerCase(); // Używamy bezpośrednio stringa
    const userClause = userId === null ? Q.where('user_id', null) : Q.where('user_id', userId);

    try {
      const items = await database.get<ShoppingItem>(this.table)
        .query( userClause, Q.where('name', Q.eq(normalizedName)), Q.where('unit', Q.eq(normalizedUnit)), Q.where('is_checked', isChecked) )
        .fetch();
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      console.error(`[DB SI] Błąd findExisting dla "${normalizedName}", userId=${userId ?? 'null'}:`, error);
      return null;
    }
  }

  /**
   * Tworzy nowy element listy zakupów z UUID jako ID, używając '' zamiast null.
   */
  static async createItem(
    database: Database,
    data: { userId: string | null; name: string; amount?: string | null; unit?: string; type?: string; isChecked?: boolean; order?: number; } // Zmieniono typy unit i type
  ): Promise<ShoppingItem> {
    const collection = database.get<ShoppingItem>(this.table);
    const orderToSet = data.order ?? await this.getNextOrder(database, data.userId);
    const normalizedName = data.name.trim().toLowerCase();
    // --- ZMIANA: Użyj '' jako default dla unit i type ---
    const normalizedUnit = (data.unit ?? '').trim().toLowerCase();
    const itemType = data.type ?? '';
    // -------------------------------------------------
    if (!normalizedName) { throw new Error("Nazwa produktu nie może być pusta."); }

    const newId = uuidv4();

    return database.write(async () => {
      const newItem = await collection.create(item => {
        item._raw.id = newId;
        item.userId = data.userId;
        item.name = normalizedName;
        item.amount = data.amount ?? null;
        // --- ZMIANA: Przypisz string (może być pusty) ---
        item.unit = normalizedUnit;
        item.type = itemType;
        // -------------------------------------------------
        item.order = orderToSet;
        item.isChecked = data.isChecked ?? false;
      });
      console.log(`[DB SI] Utworzono lokalnie z UUID: ${newItem.id} (User: ${data.userId ?? 'null'})`);
      return newItem;
    });
  }

  /**
   * Dodaje element z tekstu, łącząc z istniejącym lub tworząc nowy (z UUID), używając '' zamiast null.
   */
  static async addItemFromText(database: Database, userId: string | null, text: string): Promise<ShoppingItem> {
    const parsed = parseShoppingItem(text); // parseShoppingItem zwraca teraz unit: string | null
    const normalizedName = parsed.name.trim().toLowerCase();
    // --- ZMIANA: Użyj '' jeśli unit jest null ---
    const normalizedUnit = (parsed.unit ?? '').trim().toLowerCase();
    // -------------------------------------------
    if (!normalizedName) { throw new Error(`Nie można sparsować nazwy: "${text}"`); }

    // --- ZMIANA: Przekaż normalizedUnit (string) do findExisting ---
    const existingItem = await this.findExisting(database, userId, normalizedName, normalizedUnit, false);
    // ------------------------------------------------------------

    if (existingItem) {
      console.log(`[DB SI] Łączenie z ${existingItem.id}`);
      let mergedAmount: string | null = null;
      try {
          const currentAmountNum = existingItem.amount ? parseFloat(existingItem.amount.replace(',','.')) : 0;
          const newAmountNum = parsed.amount;
          if (!isNaN(currentAmountNum) && newAmountNum !== null && !isNaN(newAmountNum)) {
              mergedAmount = (currentAmountNum + newAmountNum).toString();
          } else {
              mergedAmount = newAmountNum !== null ? String(newAmountNum) : (existingItem.amount ?? '1');
          }
      } catch(e) {
          mergedAmount = parsed.amount !== null ? String(parsed.amount) : '1';
      }
      await database.write(async () => {
          await existingItem.update(item => {
              item.amount = mergedAmount;
              // --- ZMIANA: Upewnij się, że unit i type nie są null ---
              item.unit = normalizedUnit; // Użyj stringa
              item.type = item.type ?? ''; // Zachowaj istniejący type lub ustaw ''
              // -------------------------------------------------
          });
      });
      return existingItem;
    } else {
      console.log(`[DB SI] Tworzenie nowego z UUID: "${text}"`);
      const amountStr = parsed.amount !== null ? String(parsed.amount) : '1';
      // --- ZMIANA: Przekaż normalizedUnit i pusty string dla type ---
      return await this.createItem(database, {
          userId: userId,
          name: normalizedName,
          amount: amountStr,
          unit: normalizedUnit, // Przekaż string (może być pusty)
          type: '', // Domyślnie pusty string dla nowych
      });
      // ----------------------------------------------------------
    }
  }

  /**
   * Przygotowuje operacje aktualizacji kolejności dla listy elementów.
   */
  static async bulkUpdateOrder(database: Database, orderedItems: ShoppingItem[]): Promise<WDBModel[]> {
    console.log(`[DB ShoppingItem bulkUpdateOrder] Przygotowanie aktualizacji kolejności dla ${orderedItems.length} elementów.`);
    const batchOps: WDBModel[] = [];
    for (let i = 0; i < orderedItems.length; i++) {
      const item = orderedItems[i];
      const newOrder = i;
      if (item.order !== newOrder) {
        batchOps.push(
          item.prepareUpdate(record => {
            record.order = newOrder;
          })
        );
      }
    }
    if (batchOps.length > 0) {
      console.log(`[DB ShoppingItem bulkUpdateOrder] Przygotowano ${batchOps.length} operacji.`);
    } else {
      console.log(`[DB ShoppingItem bulkUpdateOrder] Brak zmian w kolejności.`);
    }
    return batchOps;
  }


  // --- Metody Instancji ---

  @writer async toggleChecked() {
    const targetCheckedState = !this.isChecked;
    const normalizedName = this.name.trim().toLowerCase();
    // --- ZMIANA: Użyj '' zamiast null ---
    const normalizedUnit = (this.unit ?? '').trim().toLowerCase();
    // -----------------------------------

    // --- ZMIANA: Przekaż normalizedUnit (string) ---
    const existingItemInTargetState = await ShoppingItem.findExisting(
      this.database, this.userId ?? null, normalizedName, normalizedUnit, targetCheckedState
    );
    // --------------------------------------------

    if (existingItemInTargetState) {
      console.log(`[DB SI @writer toggleChecked] Łączenie ${this.id} z ${existingItemInTargetState.id}`);
      let mergedAmount : string | null = null;
      try {
          const existingAmountNum = existingItemInTargetState.amount ? parseFloat(existingItemInTargetState.amount.replace(',','.')) : 0;
          const thisAmountNum = this.amount ? parseFloat(this.amount.replace(',','.')) : 0;
          if (!isNaN(existingAmountNum) && !isNaN(thisAmountNum)) {
              mergedAmount = (existingAmountNum + thisAmountNum).toString();
          } else {
              mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1';
          }
      } catch(e) { mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1'; }
      // Aktualizuj istniejący, upewniając się, że unit/type nie są null
      await existingItemInTargetState.update(item => {
          item.amount = mergedAmount;
          item.unit = item.unit ?? ''; // Upewnij się
          item.type = item.type ?? ''; // Upewnij się
      });
      await this.markAsDeleted();
      console.log(`[DB SI @writer toggleChecked] Zakończono łączenie.`);
    } else {
      // --- ZMIANA: Upewnij się, że unit i type nie są null przy zmianie statusu ---
      await this.update(item => {
          item.isChecked = targetCheckedState;
          item.unit = item.unit ?? '';
          item.type = item.type ?? '';
      });
      // -----------------------------------------------------------------------
      console.log(`[DB SI @writer toggleChecked] Zmieniono status dla ${this.id} na ${targetCheckedState}.`);
    }
  }

  @writer async updateFromText(text: string) {
    const parsed = parseShoppingItem(text);
    const normalizedName = parsed.name.trim().toLowerCase();
    // --- ZMIANA: Użyj '' zamiast null ---
    const normalizedUnit = (parsed.unit ?? '').trim().toLowerCase();
    // -----------------------------------
    if (!normalizedName) { console.warn(`[DB SI @writer updateFromText] Nie można sparsować nazwy: "${text}"`); return; }

    // --- ZMIANA: Przekaż normalizedUnit (string) ---
    const existingItem = await ShoppingItem.findExisting( this.database, this.userId ?? null, normalizedName, normalizedUnit, this.isChecked );
    // --------------------------------------------

    if (existingItem && existingItem.id !== this.id) {
      console.log(`[DB SI @writer updateFromText] Łączenie ${this.id} z ${existingItem.id}.`);
      let mergedAmount : string | null = null;
      try {
          const existingAmountNum = existingItem.amount ? parseFloat(existingItem.amount.replace(',','.')) : 0;
          const newAmountNum = parsed.amount;
          if (!isNaN(existingAmountNum) && newAmountNum !== null && !isNaN(newAmountNum)) {
              mergedAmount = (existingAmountNum + newAmountNum).toString();
          } else {
               mergedAmount = newAmountNum !== null ? String(newAmountNum) : existingItem.amount ?? '1';
          }
      } catch(e) { mergedAmount = parsed.amount !== null ? String(parsed.amount) : '1'; }
      // Aktualizuj istniejący, upewnij się że unit/type nie są null
      await this.database.batch(
          existingItem.prepareUpdate(item => {
              item.amount = mergedAmount;
              item.unit = item.unit ?? '';
              item.type = item.type ?? '';
          }),
          this.prepareMarkAsDeleted()
      );
      console.log(`[DB SI @writer updateFromText] Zakończono łączenie po edycji.`);
    } else {
      // --- ZMIANA: Przypisz string (może być pusty) do unit i type ---
      const amountStr = parsed.amount !== null ? String(parsed.amount) : null;
      await this.update(item => {
          item.name = normalizedName;
          item.amount = amountStr;
          item.unit = normalizedUnit; // Przypisz string
          item.type = item.type ?? ''; // Zachowaj istniejący type lub ustaw ''
      });
      // -------------------------------------------------------------
      console.log(`[DB SI @writer updateFromText] Zaktualizowano ${this.id}.`);
    }
  }

  @writer async deleteItem() {
    await this.markAsDeleted();
    console.log(`[DB SI @writer deleteItem] Oznaczono ${this.id} jako usunięty.`);
  }

   // --- Przygotowanie do batch ---
   prepareToggleChecked(): WDBModel | null {
       console.warn("toggleChecked nie jest bezpieczne dla prepare - użyj pełnej metody @writer w transakcji.");
       return null;
   }
   prepareUpdateFromText(text: string): WDBModel | null {
       console.warn("updateFromText nie jest bezpieczne dla prepare - użyj pełnej metody @writer w transakcji.");
       return null;
   }
   prepareDeleteItem(): ShoppingItem {
       return this.prepareMarkAsDeleted();
   }
}