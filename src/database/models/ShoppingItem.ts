// src/database/models/ShoppingItem.ts
import { Model, Q, Database, Collection, Model as WDBModel } from '@nozbe/watermelondb'; // Importuj Database, Collection, Model
import { field, text, date, writer } from '@nozbe/watermelondb/decorators';
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

  // --- Metody Statyczne (bez zmian) ---
  static observeUnchecked(database: Database): Observable<ShoppingItem[]> { /* ... jak poprzednio ... */
    return from(getCurrentUserId()).pipe(switchMap(activeUserId => { const u = activeUserId ? Q.where('user_id', activeUserId) : Q.where('user_id', null); return database.get<ShoppingItem>(this.table).query(u, Q.where('is_checked', false), Q.sortBy('order', Q.asc)).observe(); }));
   }
  static observeChecked(database: Database): Observable<ShoppingItem[]> { /* ... jak poprzednio ... */
    return from(getCurrentUserId()).pipe(switchMap(activeUserId => { const u = activeUserId ? Q.where('user_id', activeUserId) : Q.where('user_id', null); return database.get<ShoppingItem>(this.table).query(u, Q.where('is_checked', true), Q.sortBy('order', Q.asc)).observe(); }));
   }
  static async getNextOrder(database: Database, userId: string | null): Promise<number> { /* ... jak poprzednio ... */
    const u = userId ? Q.where('user_id', userId) : Q.where('user_id', null); try { const l = await database.get<ShoppingItem>(this.table).query(u, Q.sortBy('order', Q.desc), Q.take(1)).fetch(); return (l.length > 0 ? l[0].order : -1) + 1; } catch (e) { console.error(`[DB ShoppingItem] Err getNextOrder ${userId??'null'}`, e); return Date.now(); } }
  static async findExisting( database: Database, userId: string | null, name: string, unit: string | null, isChecked: boolean ): Promise<ShoppingItem | null> { /* ... jak poprzednio ... */
    if (!name) return null; const n = name.trim().toLowerCase(); const u = unit?.trim().toLowerCase() ?? null; const userClause = userId ? Q.where('user_id', userId) : Q.where('user_id', null); try { const i = await database.get<ShoppingItem>(this.table).query( userClause, Q.where('name', Q.eq(n)), Q.where('unit', Q.eq(u)), Q.where('is_checked', isChecked) ).fetch(); return i.length > 0 ? i[0] : null; } catch (e) { console.error(`[DB ShoppingItem] Err findExisting "${n}", user ${userId??'null'}`, e); return null; } }
  static async createItem( database: Database, data: { userId: string | null; name: string; amount?: string | null; unit?: string | null; isChecked?: boolean; type?: string | null; order?: number; }): Promise<ShoppingItem> { /* ... jak poprzednio ... */
    const c = database.get<ShoppingItem>(this.table); const o = data.order ?? await this.getNextOrder(database, data.userId); const n = data.name.trim().toLowerCase(); const u = data.unit?.trim().toLowerCase() ?? null; if (!n) { throw new Error("Nazwa produktu pusta."); } return database.write(async () => { const i = await c.create(item => { item.userId = data.userId; item.name = n; item.amount = data.amount ?? null; item.unit = u; item.type = data.type ?? null; item.order = o; item.isChecked = data.isChecked ?? false; }); console.log(`[DB SI] Utworzono: ${i.id} (User: ${data.userId??'null'})`); return i; }); }
  static async addItemFromText(database: Database, userId: string | null, text: string): Promise<ShoppingItem> { /* ... jak poprzednio ... */
    const p = parseShoppingItem(text); const n = p.name.trim().toLowerCase(); const u = p.unit?.trim().toLowerCase() ?? null; if (!n) { throw new Error(`Brak nazwy: "${text}"`); } const e = await this.findExisting(database, userId, n, u, false); if (e) { console.log(`[DB SI] Łączenie z ${e.id}`); let mA: string | null = null; try { const ca=e.amount?parseFloat(e.amount.replace(',','.')):0; const na=p.amount; if(!isNaN(ca)&&na!==null&&!isNaN(na)){mA=(ca+na).toString();} else {mA=p.amount!==null?String(p.amount):(e.amount??null);}} catch(err){mA=p.amount!==null?String(p.amount):'1';} await database.write(async () => { await e.update(item => { item.amount = mA; }); }); return e; } else { console.log(`[DB SI] Tworzenie z tekstu: "${text}"`); return await this.createItem(database, { userId: userId, name: n, amount: p.amount !== null ? String(p.amount) : '1', unit: u }); } }

  // --- ZREFAKTORYZOWANE Metody Instancji ---

  /**
   * Przełącza stan odznaczenia elementu.
   * Cała logika (znalezienie, update/delete) jest wewnątrz JEDNEGO writera.
   */
  @writer async toggleChecked() {
    const targetCheckedState = !this.isChecked;
    const normalizedName = this.name.trim().toLowerCase();
    const normalizedUnit = this.unit?.trim().toLowerCase() ?? null;

    // Używamy this.collections.get wewnątrz writera, aby uzyskać dostęp
    const collection = this.collections.get<ShoppingItem>(ShoppingItem.table);

    // Szukaj istniejącego elementu w stanie docelowym
    // Ważne: Zapytanie musi być wykonane wewnątrz writera, ale findExisting jest async,
    // więc musimy pobrać dane przed prepareUpdate/prepareMarkAsDeleted.
    // Zamiast `findExisting`, wykonamy zapytanie bezpośrednio tutaj.
    const userClause = this.userId ? Q.where('user_id', this.userId) : Q.where('user_id', null);
    const existingItemsInTargetState = await collection.query(
        userClause,
        Q.where('name', Q.eq(normalizedName)),
        Q.where('unit', Q.eq(normalizedUnit)),
        Q.where('is_checked', targetCheckedState)
    ).fetch();
    const existingItemInTargetState = existingItemsInTargetState.length > 0 ? existingItemsInTargetState[0] : null;


    const batchOperations: WDBModel[] = []; // Tablica operacji dla batch

    if (existingItemInTargetState) {
      console.log(`[DB ShoppingItem Writer] Łączenie ${this.id} z ${existingItemInTargetState.id} przy zmianie statusu.`);
      let mergedAmount: string | null = null;
      try {
          const ca = existingItemInTargetState.amount ? parseFloat(existingItemInTargetState.amount.replace(',','.')) : 0;
          const ta = this.amount ? parseFloat(this.amount.replace(',','.')) : 0;
          if(!isNaN(ca) && !isNaN(ta)) { mergedAmount = (ca + ta).toString(); }
          else { mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1'; }
      } catch(e) { mergedAmount = this.amount ?? existingItemInTargetState.amount ?? '1'; }

      // Przygotuj operacje: update istniejącego i usunięcie bieżącego
      batchOperations.push(existingItemInTargetState.prepareUpdate(item => { item.amount = mergedAmount; }));
      batchOperations.push(this.prepareMarkAsDeleted()); // Użyj prepareMarkAsDeleted
      console.log(`[DB ShoppingItem Writer] Przygotowano łączenie.`);

    } else {
      // Po prostu zmień stan bieżącego elementu
      batchOperations.push(this.prepareUpdate(item => { item.isChecked = targetCheckedState; })); // Użyj prepareUpdate
      console.log(`[DB ShoppingItem Writer] Przygotowano zmianę statusu dla ${this.id} na ${targetCheckedState}.`);
    }

    // Wykonaj przygotowane operacje w batch
    if (batchOperations.length > 0) {
        await this.database.batch(...batchOperations);
        console.log("[DB ShoppingItem Writer] Wykonano operacje batch dla toggleChecked.");
    }
  }

  /**
   * Aktualizuje element na podstawie tekstu.
   * Cała logika (parsowanie, znalezienie, update/delete) jest wewnątrz JEDNEGO writera.
   */
  @writer async updateFromText(text: string) {
    const parsed = parseShoppingItem(text);
    const normalizedName = parsed.name.trim().toLowerCase();
    const normalizedUnit = parsed.unit?.trim().toLowerCase() ?? null;

    if (!normalizedName) { console.warn(`[DB ShoppingItem Writer] Pusta nazwa po sparsowaniu: "${text}"`); return; }

    const collection = this.collections.get<ShoppingItem>(ShoppingItem.table);
    const userClause = this.userId ? Q.where('user_id', this.userId) : Q.where('user_id', null);

    // Sprawdź, czy istnieje INNY element o tej samej nazwie, jednostce i stanie
    const existingItems = await collection.query(
        userClause,
        Q.where('name', Q.eq(normalizedName)),
        Q.where('unit', Q.eq(normalizedUnit)),
        Q.where('is_checked', this.isChecked),
        Q.where('id', Q.notEq(this.id)) // Wyklucz bieżący element
    ).fetch();
    const existingItem = existingItems.length > 0 ? existingItems[0] : null;

    const batchOperations: WDBModel[] = [];

    if (existingItem) {
      console.log(`[DB ShoppingItem Writer] Łączenie edytowanego ${this.id} z istniejącym ${existingItem.id}.`);
      let mergedAmount : string | null = null;
      try {
          const ca = existingItem.amount ? parseFloat(existingItem.amount.replace(',','.')) : 0;
          const na = parsed.amount; // parsed.amount jest number | null
          if(!isNaN(ca) && na !== null && !isNaN(na)) { mergedAmount = (ca + na).toString(); }
          else { mergedAmount = parsed.amount !== null ? String(parsed.amount) : (existingItem.amount ?? '1'); }
      } catch(e) { mergedAmount = parsed.amount !== null ? String(parsed.amount) : '1'; }

      // Przygotuj update istniejącego i usunięcie bieżącego
      batchOperations.push(existingItem.prepareUpdate(item => { item.amount = mergedAmount; }));
      batchOperations.push(this.prepareMarkAsDeleted());
      console.log(`[DB ShoppingItem Writer] Przygotowano łączenie po edycji.`);

    } else {
      // Po prostu zaktualizuj bieżący element
      batchOperations.push(this.prepareUpdate(item => {
        item.name = normalizedName;
        item.amount = parsed.amount !== null ? String(parsed.amount) : null;
        item.unit = normalizedUnit;
      }));
      console.log(`[DB ShoppingItem Writer] Przygotowano aktualizację ${this.id} z tekstu.`);
    }

    // Wykonaj batch
    if (batchOperations.length > 0) {
        await this.database.batch(...batchOperations);
         console.log("[DB ShoppingItem Writer] Wykonano operacje batch dla updateFromText.");
    }
  }

  /** Oznacza element jako usunięty. */
  @writer async deleteItem() {
    console.log(`[DB ShoppingItem] Oznaczanie elementu ${this.id} jako usunięte.`);
    await this.markAsDeleted();
  }

   // --- Przygotowanie do batch (bez zmian) ---
   prepareToggleChecked(): WDBModel | null {
       console.warn("toggleChecked wymaga logiki w transakcji, użyj pełnej metody."); return null;
   }
   prepareUpdateFromText(text: string): WDBModel | null {
       console.warn("updateFromText wymaga logiki w transakcji, użyj pełnej metody."); return null;
   }
   prepareDeleteItem(): ShoppingItem {
       return this.prepareMarkAsDeleted();
   }
}