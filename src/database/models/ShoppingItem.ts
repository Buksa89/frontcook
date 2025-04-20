// src/database/models/ShoppingItem.ts
import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection, Model as WDBModel } from '@nozbe/watermelondb'; // Dodano WDBModel
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { getCurrentUserId } from '../../services/auth/authUserIdProvider'; // ZMIANA IMPORTU
import { parseShoppingItem } from '../../utils/shoppingItemParser';

export default class ShoppingItem extends Model {
  static table = 'shopping_items';

  // --- Pola ---
  @field('user_id') userId!: string;
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
    // Używamy nowej funkcji
    return from(getCurrentUserId()).pipe( // ZMIANA WYWOŁANIA
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<ShoppingItem>(this.table)
          .query( Q.where('user_id', activeUserId), Q.where('is_checked', false), Q.sortBy('order', Q.asc) )
          .observe();
      })
    );
  }

  static observeChecked(database: Database): Observable<ShoppingItem[]> {
    // Używamy nowej funkcji
    return from(getCurrentUserId()).pipe( // ZMIANA WYWOŁANIA
      switchMap(activeUserId => {
        if (!activeUserId) return of([]);
        return database.get<ShoppingItem>(this.table)
          .query( Q.where('user_id', activeUserId), Q.where('is_checked', true), Q.sortBy('order', Q.asc) )
          .observe();
      })
    );
  }

  static async getNextOrder(database: Database, userId: string): Promise<number> {
    // Logika bez zmian
    if (!userId) { console.error("[DB ShoppingItem] Brak userId..."); return Date.now(); }
    try { const lastItem = await database.get<ShoppingItem>(this.table).query(Q.where('user_id', userId), Q.sortBy('order', Q.desc), Q.take(1)).fetch(); return (lastItem.length > 0 ? lastItem[0].order : -1) + 1; }
    catch (error) { console.error(`[DB ShoppingItem] Błąd getNextOrder dla ${userId}:`, error); return Date.now(); }
  }

  static async findExisting( database: Database, userId: string, name: string, unit: string | null, isChecked: boolean ): Promise<ShoppingItem | null> {
    // Logika bez zmian
    if (!userId || !name) return null;
    const normalizedName = name.trim().toLowerCase(); const normalizedUnit = unit?.trim().toLowerCase() ?? null;
    try { const items = await database.get<ShoppingItem>(this.table).query( Q.where('user_id', userId), Q.where('name', Q.eq(normalizedName)), Q.where('unit', Q.eq(normalizedUnit)), Q.where('is_checked', isChecked) ).fetch(); return items.length > 0 ? items[0] : null; }
    catch (error) { console.error(`[DB ShoppingItem] Błąd findExisting dla "${normalizedName}":`, error); return null; }
  }

  static async createItem( database: Database, data: { userId: string; name: string; amount?: string | null; unit?: string | null; isChecked?: boolean; type?: string | null; order?: number; }): Promise<ShoppingItem> {
    // Logika bez zmian
    const collection = database.get<ShoppingItem>(this.table); const orderToSet = data.order ?? await this.getNextOrder(database, data.userId);
    const normalizedName = data.name.trim().toLowerCase(); const normalizedUnit = data.unit?.trim().toLowerCase() ?? null;
    if (!normalizedName) { throw new Error("Nazwa produktu nie może być pusta."); }
    return database.write(async () => { const newItem = await collection.create(item => { /* ... przypisanie pól ... */
        item.userId = data.userId; item.name = normalizedName; item.amount = data.amount ?? null; item.unit = normalizedUnit;
        item.type = data.type ?? null; item.order = orderToSet; item.isChecked = data.isChecked ?? false; });
        console.log(`[DB ShoppingItem] Utworzono lokalnie: ${newItem.id} (Name: ${normalizedName})`); return newItem; });
  }

  static async addItemFromText(database: Database, userId: string, text: string): Promise<ShoppingItem> {
    // Logika bez zmian
    const parsed = parseShoppingItem(text); const normalizedName = parsed.name.trim().toLowerCase(); const normalizedUnit = parsed.unit?.trim().toLowerCase() ?? null;
    if (!normalizedName) { throw new Error(`Nie można sparsować nazwy produktu z tekstu: "${text}"`); }
    const existingItem = await this.findExisting(database, userId, normalizedName, normalizedUnit, false);
    if (existingItem) { console.log(`[DB ShoppingItem] Łączenie z istniejącym: ${existingItem.id}`); let mergedAmount: string | null = null; try { /* ... logika łączenia amount ... */
        const ca = existingItem.amount ? parseFloat(existingItem.amount.replace(',','.')) : 0; const na = parsed.amount; if(!isNaN(ca) && na !== null && !isNaN(na)){mergedAmount = (ca + na).toString();} else { mergedAmount = parsed.amount !== null ? String(parsed.amount) : (existingItem.amount ?? null); } } catch(e) { mergedAmount = parsed.amount !== null ? String(parsed.amount) : '1'; }
        await database.write(async () => { await existingItem.update(item => { item.amount = mergedAmount; }); }); return existingItem;
    } else { console.log(`[DB ShoppingItem] Tworzenie nowego elementu z tekstu: "${text}"`); return await this.createItem(database, { userId: userId, name: normalizedName, amount: parsed.amount !== null ? String(parsed.amount) : '1', unit: normalizedUnit }); }
  }

  // --- Metody Instancji ---
  @writer async toggleChecked() {
    // Logika bez zmian
      const targetCheckedState = !this.isChecked; const normalizedName = this.name.trim().toLowerCase(); const normalizedUnit = this.unit?.trim().toLowerCase() ?? null;
      const existingItemInTargetState = await ShoppingItem.findExisting( this.database, this.userId, normalizedName, normalizedUnit, targetCheckedState );
      if (existingItemInTargetState) { console.log(`[DB ShoppingItem] Łączenie ${this.id} z ${existingItemInTargetState.id}`); let mergedAmount : string | null = null; try { /* ... logika łączenia amount ... */
          const ca = existingItemInTargetState.amount ? parseFloat(existingItemInTargetState.amount.replace(',','.')) : 0; const ta = this.amount ? parseFloat(this.amount.replace(',','.')) : 0; if(!isNaN(ca) && !isNaN(ta)){mergedAmount = (ca + ta).toString();} else { mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1'; } } catch(e){ mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1'; }
          await this.database.batch( existingItemInTargetState.prepareUpdate(item => { item.amount = mergedAmount; }), this.prepareMarkAsDeleted() ); console.log(`[DB ShoppingItem] Zakończono łączenie.`);
      } else { await this.update(item => { item.isChecked = targetCheckedState; }); console.log(`[DB ShoppingItem] Zmieniono status isChecked dla ${this.id} na ${targetCheckedState}.`); }
  }

  @writer async updateFromText(text: string) {
    // Logika bez zmian
      const parsed = parseShoppingItem(text); const normalizedName = parsed.name.trim().toLowerCase(); const normalizedUnit = parsed.unit?.trim().toLowerCase() ?? null;
      if (!normalizedName) { console.warn(`[DB ShoppingItem] Nie można sparsować nazwy z tekstu: "${text}"`); return; }
      const existingItem = await ShoppingItem.findExisting( this.database, this.userId, normalizedName, normalizedUnit, this.isChecked );
      if (existingItem && existingItem.id !== this.id) { console.log(`[DB ShoppingItem] Łączenie edytowanego ${this.id} z istniejącym ${existingItem.id}.`); let mergedAmount : string | null = null; try { /* ... logika łączenia amount ... */
          const ca = existingItem.amount ? parseFloat(existingItem.amount.replace(',','.')) : 0; const na = parsed.amount; if(!isNaN(ca) && na !== null && !isNaN(na)){mergedAmount = (ca + na).toString();} else { mergedAmount = parsed.amount !== null ? String(parsed.amount) : existingItem.amount ?? '1'; } } catch(e) { mergedAmount = parsed.amount !== null ? String(parsed.amount) : '1'; }
          await this.database.batch( existingItem.prepareUpdate(item => { item.amount = mergedAmount; }), this.prepareMarkAsDeleted() ); console.log(`[DB ShoppingItem] Zakończono łączenie po edycji.`);
      } else { await this.update(item => { item.name = normalizedName; item.amount = parsed.amount !== null ? String(parsed.amount) : null; item.unit = normalizedUnit; }); console.log(`[DB ShoppingItem] Zaktualizowano element ${this.id} z tekstu.`); }
  }

  @writer async deleteItem() {
    // Logika bez zmian
      console.log(`[DB ShoppingItem] Oznaczanie elementu ${this.id} jako usunięte.`);
      await this.markAsDeleted();
  }

   // --- Przygotowanie do batch ---
   prepareToggleChecked(): WDBModel | null { // Poprawiony typ
       console.warn("prepareToggleChecked nie jest optymalne dla batch - użyj pełnej metody toggleChecked w transakcji."); return null;
   }
   prepareUpdateFromText(text: string): WDBModel | null { // Poprawiony typ
       console.warn("prepareUpdateFromText nie jest optymalne dla batch - użyj pełnej metody updateFromText w transakcji."); return null;
   }
   prepareDeleteItem(): ShoppingItem {
       return this.prepareMarkAsDeleted();
   }
}