// src/database/models/ShoppingItem.ts
import { Model, Q } from '@nozbe/watermelondb';
import { field, text, date, writer } from '@nozbe/watermelondb/decorators';
import type { Database, Collection, Model as WDBModel } from '@nozbe/watermelondb'; // Dodano WDBModel
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider';
import { parseShoppingItem } from '../../utils/shoppingItemParser';

export default class ShoppingItem extends Model {
  static table = 'shopping_items';

  // --- Pola ---
  @field('user_id') userId?: string | null;
  @date('last_modified') lastModified!: number;
  @date('created_at') createdAt!: number;
  @text('amount') amount?: string | null;
  @text('unit') unit?: string | null;
  @text('name') name!: string;
  @text('type') type?: string | null;
  @field('order') order!: number;
  @field('is_checked') isChecked!: boolean;

  // --- Metody Statyczne ---

  static observeUnchecked(database: Database): Observable<ShoppingItem[]> {
    return from(getCurrentUserId()).pipe(
      switchMap(activeUserId => {
        const userClause = activeUserId ? Q.where('user_id', activeUserId) : Q.where('user_id', null);
        return database.get<ShoppingItem>(this.table)
          .query( userClause, Q.where('is_checked', false), Q.sortBy('order', Q.asc) )
          .observe();
      })
    );
  }

  static observeChecked(database: Database): Observable<ShoppingItem[]> {
    return from(getCurrentUserId()).pipe(
      switchMap(activeUserId => {
        const userClause = activeUserId ? Q.where('user_id', activeUserId) : Q.where('user_id', null);
        return database.get<ShoppingItem>(this.table)
          .query( userClause, Q.where('is_checked', true), Q.sortBy('order', Q.asc) )
          .observe();
      })
    );
  }

  static async getNextOrder(database: Database, userId: string | null): Promise<number> {
    const userClause = userId ? Q.where('user_id', userId) : Q.where('user_id', null);
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
    unit: string | null,
    isChecked: boolean
  ): Promise<ShoppingItem | null> {
    if (!name) return null;
    const normalizedName = name.trim().toLowerCase();
    const normalizedUnit = unit?.trim().toLowerCase() ?? null;
    const userClause = userId ? Q.where('user_id', userId) : Q.where('user_id', null);

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

  static async createItem(
    database: Database,
    data: { userId: string | null; name: string; amount?: string | null; unit?: string | null; isChecked?: boolean; type?: string | null; order?: number; }
  ): Promise<ShoppingItem> {
    const collection = database.get<ShoppingItem>(this.table);
    const orderToSet = data.order ?? await this.getNextOrder(database, data.userId);
    const normalizedName = data.name.trim().toLowerCase();
    const normalizedUnit = data.unit?.trim().toLowerCase() ?? null;
    if (!normalizedName) { throw new Error("Nazwa produktu nie może być pusta."); }

    return database.write(async () => {
      const newItem = await collection.create(item => {
        item.userId = data.userId;
        item.name = normalizedName;
        item.amount = data.amount ?? null;
        item.unit = normalizedUnit;
        item.type = data.type ?? null;
        item.order = orderToSet;
        item.isChecked = data.isChecked ?? false;
      });
      console.log(`[DB SI] Utworzono lokalnie: ${newItem.id} (User: ${data.userId ?? 'null'})`);
      return newItem;
    });
  }

  static async addItemFromText(database: Database, userId: string | null, text: string): Promise<ShoppingItem> {
    const parsed = parseShoppingItem(text);
    const normalizedName = parsed.name.trim().toLowerCase();
    const normalizedUnit = parsed.unit?.trim().toLowerCase() ?? null;
    if (!normalizedName) { throw new Error(`Nie można sparsować nazwy: "${text}"`); }

    const existingItem = await this.findExisting(database, userId, normalizedName, normalizedUnit, false);

    if (existingItem) {
      console.log(`[DB SI] Łączenie z ${existingItem.id}`);
      let mergedAmount: string | null = null;
      try {
          const ca = existingItem.amount ? parseFloat(existingItem.amount.replace(',','.')) : 0;
          const na = parsed.amount;
          if(!isNaN(ca) && na !== null && !isNaN(na)){ mergedAmount = (ca + na).toString(); }
          else { mergedAmount = parsed.amount !== null ? String(parsed.amount) : (existingItem.amount ?? null); }
      } catch(e) { mergedAmount = parsed.amount !== null ? String(parsed.amount) : '1'; }
      await database.write(async () => { await existingItem.update(item => { item.amount = mergedAmount; }); });
      return existingItem;
    } else {
      console.log(`[DB SI] Tworzenie nowego: "${text}"`);
      return await this.createItem(database, { userId: userId, name: normalizedName, amount: parsed.amount !== null ? String(parsed.amount) : '1', unit: normalizedUnit });
    }
  }

  /**
   * Aktualizuje pole 'order' dla listy elementów. Zwraca operacje batch do wykonania w transakcji.
   * @param database Instancja bazy danych. // <<< DODANO PARAMETR database
   * @param orderedItems Tablica elementów ShoppingItem w *nowej* kolejności.
   * @returns Tablica przygotowanych operacji do wykonania w `database.batch()`.
   */
  // Usunięto @writer - metoda przygotowuje operacje, nie zapisuje
  static async bulkUpdateOrder(database: Database, orderedItems: ShoppingItem[]): Promise<Model[]> { // ZMIANA: Przyjmuje database, zwraca Model[]
    console.log(`[DB ShoppingItem bulkUpdateOrder] Przygotowanie aktualizacji kolejności dla ${orderedItems.length} elementów.`);
    const batchOps: Model[] = [];
    for (let i = 0; i < orderedItems.length; i++) {
      const item = orderedItems[i];
      const newOrder = i;
      if (item.order != newOrder) {
        batchOps.push(
          item.prepareUpdate(record => {
            record.order = newOrder;
            // Nie ma potrzeby ręcznego ustawiania last_modified, prepareUpdate to zrobi
          })
        );
      }
    }

    if (batchOps.length > 0) {
      console.log(`[DB ShoppingItem bulkUpdateOrder] Przygotowano ${batchOps.length} operacji.`);
    } else {
      console.log(`[DB ShoppingItem bulkUpdateOrder] Brak zmian w kolejności.`);
    }
    return batchOps; // Zwróć przygotowane operacje
  }


  // --- Metody Instancji ---

  @writer async toggleChecked() {
    const targetCheckedState = !this.isChecked;
    const normalizedName = this.name.trim().toLowerCase();
    const normalizedUnit = this.unit?.trim().toLowerCase() ?? null;

    const existingItemInTargetState = await ShoppingItem.findExisting(
      this.database, this.userId ?? null, normalizedName, normalizedUnit, targetCheckedState
    );

    if (existingItemInTargetState) {
      console.log(`[DB SI @writer toggleChecked] Łączenie ${this.id} z ${existingItemInTargetState.id}`);
      let mergedAmount : string | null = null;
      try { const ca = existingItemInTargetState.amount ? parseFloat(existingItemInTargetState.amount.replace(',','.')) : 0; const ta = this.amount ? parseFloat(this.amount.replace(',','.')) : 0; if(!isNaN(ca) && !isNaN(ta)){mergedAmount = (ca + ta).toString();} else { mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1'; } }
      catch(e){ mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1'; }
      await existingItemInTargetState.update(item => { item.amount = mergedAmount; });
      await this.markAsDeleted();
      console.log(`[DB SI @writer toggleChecked] Zakończono łączenie.`);
    } else {
      await this.update(item => { item.isChecked = targetCheckedState; });
      console.log(`[DB SI @writer toggleChecked] Zmieniono status dla ${this.id} na ${targetCheckedState}.`);
    }
  }

  @writer async updateFromText(text: string) {
    const parsed = parseShoppingItem(text);
    const normalizedName = parsed.name.trim().toLowerCase();
    const normalizedUnit = parsed.unit?.trim().toLowerCase() ?? null;
    if (!normalizedName) { console.warn(`[DB SI @writer updateFromText] Nie można sparsować nazwy: "${text}"`); return; }

    const existingItem = await ShoppingItem.findExisting( this.database, this.userId ?? null, normalizedName, normalizedUnit, this.isChecked );

    if (existingItem && existingItem.id !== this.id) {
      console.log(`[DB SI @writer updateFromText] Łączenie ${this.id} z ${existingItem.id}.`);
      let mergedAmount : string | null = null;
      try { const ca = existingItem.amount ? parseFloat(existingItem.amount.replace(',','.')) : 0; const na = parsed.amount; if(!isNaN(ca) && na !== null && !isNaN(na)){mergedAmount = (ca + na).toString();} else { mergedAmount = parsed.amount !== null ? String(parsed.amount) : existingItem.amount ?? '1'; } }
      catch(e) { mergedAmount = parsed.amount !== null ? String(parsed.amount) : '1'; }
      // Używamy this.database.batch wewnątrz writera - to jest dozwolone
      await this.database.batch( existingItem.prepareUpdate(item => { item.amount = mergedAmount; }), this.prepareMarkAsDeleted() );
      console.log(`[DB SI @writer updateFromText] Zakończono łączenie po edycji.`);
    } else {
      await this.update(item => { item.name = normalizedName; item.amount = parsed.amount !== null ? String(parsed.amount) : null; item.unit = normalizedUnit; });
      console.log(`[DB SI @writer updateFromText] Zaktualizowano ${this.id}.`);
    }
  }

  @writer async deleteItem() { await this.markAsDeleted(); }

   // --- Przygotowanie do batch ---
   prepareToggleChecked(): WDBModel | null { console.warn("toggleChecked nie optymalne dla batch."); return null; }
   prepareUpdateFromText(text: string): WDBModel | null { console.warn("updateFromText nie optymalne dla batch."); return null; }
   prepareDeleteItem(): ShoppingItem { return this.prepareMarkAsDeleted(); }
}