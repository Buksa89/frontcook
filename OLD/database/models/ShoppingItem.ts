// src/database/models/ShoppingItem.ts

import { Model, Q } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  writer
} from '@nozbe/watermelondb/decorators';
import type { Database, Collection } from '@nozbe/watermelondb';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import AuthService from '../../app/services/auth/authService';
import { parseIngredient } from '../../app/utils/ingredientParser'; // Używamy teraz tego parsera

// --- NOWA IMPLEMENTACJA ---

export class ShoppingItem extends Model {
  static table = 'shopping_items'; // Standardowa definicja

  // --- Pola ---
  @field('user_id') userId!: string;
  @date('last_modified') lastModified!: number;
  // @date('created_at') createdAt!: number; // Opcjonalne
  @field('amount') amount?: number | null;
  @text('unit') unit?: string | null;
  @text('name') name!: string;
  @text('type') type?: string | null;
  @field('order') order!: number;
  @field('is_checked') isChecked!: boolean; // Poprawiony dekorator

  // --- Metody Statyczne ---
  static observeUnchecked(database: Database): Observable<ShoppingItem[]> {
      // Użyj getActiveUserId
      return from(AuthService.getActiveUserId()).pipe(
        switchMap(activeUserId => {
          if (!activeUserId) return of([]);
          return database.get<ShoppingItem>(this.table)
            .query(Q.where('user_id', activeUserId), Q.where('is_checked', false), Q.sortBy('order', Q.asc)) // Sort asc
            .observe();
        })
      );
  }

  static observeChecked(database: Database): Observable<ShoppingItem[]> {
     // Użyj getActiveUserId
      return from(AuthService.getActiveUserId()).pipe(
        switchMap(activeUserId => {
          if (!activeUserId) return of([]);
          return database.get<ShoppingItem>(this.table)
            .query(Q.where('user_id', activeUserId), Q.where('is_checked', true), Q.sortBy('order', Q.asc)) // Sort asc
            .observe();
        })
      );
  }

  static async getNextOrder(database: Database, userId: string): Promise<number> {
      // ... (bez zmian)
      if (!userId) { console.error("[DB ShoppingItem] Brak userId..."); return Date.now(); }
      try {
        const lastItem = await database.get<ShoppingItem>(this.table)
          .query(Q.where('user_id', userId), Q.sortBy('order', Q.desc), Q.take(1)).fetch();
        return (lastItem.length > 0 ? lastItem[0].order : -1) + 1;
      } catch (error) { console.error(`[DB ShoppingItem] Błąd getNextOrder dla ${userId}: ${error}`); return Date.now(); }
  }

  static async findExisting(database: Database, userId: string, name: string, unit: string | null, isChecked: boolean): Promise<ShoppingItem | null> {
      // ... (bez zmian)
      if (!userId) return null;
      try {
        const items = await database.get<ShoppingItem>(this.table)
          .query( Q.where('user_id', userId), Q.where('name', Q.eq(name)), Q.where('unit', Q.eq(unit ?? null)), Q.where('is_checked', isChecked) ).fetch();
        return items.length > 0 ? items[0] : null;
      } catch (error) { console.error(`[DB ShoppingItem] Błąd findExisting: ${error}`); return null; }
  }

  static async createItem(database: Database, data: { userId: string; name: string; amount?: number | null; unit?: string | null; isChecked?: boolean; type?: string | null; order?: number; }): Promise<ShoppingItem> {
      // ... (bez zmian)
      const collection = database.get<ShoppingItem>(this.table);
      let orderToSet = data.order ?? await this.getNextOrder(database, data.userId);
      const newItem = await database.write(async () => {
        return await collection.create(item => { /* ... przypisanie pól ... */
            item.userId = data.userId; item.name = data.name; item.amount = data.amount ?? null;
            item.unit = data.unit ?? null; item.type = data.type ?? null;
            item.order = orderToSet; item.isChecked = data.isChecked ?? false;
         });
      });
      console.log(`[DB ShoppingItem] Utworzono lokalnie: ${newItem.id}`);
      return newItem;
  }

  static async addItemFromText(database: Database, userId: string, text: string): Promise<ShoppingItem> {
     // Zmieniono nazwę parsera
      const parsed = parseIngredient(text); // Używamy teraz parseIngredient
      if (!parsed.name) throw new Error("Nie można sparsować nazwy: " + text);
      const existingItem = await this.findExisting(database, userId, parsed.name, parsed.unit ?? null, false);
      if (existingItem) {
        console.log(`[DB ShoppingItem] Aktualizacja ilości dla ${existingItem.id}`);
        await database.write(async () => { await existingItem.update(item => { item.amount = (item.amount ?? 0) + (parsed.amount ?? 0); }); });
        return existingItem;
      } else {
        console.log(`[DB ShoppingItem] Tworzenie nowego elementu z tekstu.`);
        return await this.createItem(database, { userId: userId, name: parsed.name, amount: parsed.amount ?? 1.0, unit: parsed.unit ?? null });
      }
  }

  // --- Metody Instancji ---
  @writer async toggleChecked() {
      // ... (logika bez zmian, używa findExisting i WDB update/markAsDeleted)
      const targetCheckedState = !this.isChecked;
      const existingItem = await ShoppingItem.findExisting(this.database, this.userId, this.name, this.unit ?? null, targetCheckedState);
      if (existingItem) {
        console.log(`[DB ShoppingItem] Łączenie ${this.id} z ${existingItem.id}`);
        await existingItem.update(item => { item.amount = (item.amount ?? 0) + (this.amount ?? 0); });
        await this.markAsDeleted();
      } else {
        await this.update(item => { item.isChecked = targetCheckedState; });
        console.log(`[DB ShoppingItem] Zmieniono status dla ${this.id} na ${targetCheckedState}.`);
      }
  }

  @writer async updateFromText(text: string) {
      // ... (logika bez zmian, używa findExisting i WDB update/markAsDeleted)
      const parsed = parseIngredient(text); // Używamy parseIngredient
      if (!parsed.name) { console.warn(`[DB ShoppingItem] Nie można sparsować nazwy: "${text}"`); return; }
      const existingItem = await ShoppingItem.findExisting(this.database, this.userId, parsed.name, parsed.unit ?? null, this.isChecked);
      if (existingItem && existingItem.id !== this.id) {
        console.log(`[DB ShoppingItem] Łączenie ${this.id} z ${existingItem.id}`);
        await existingItem.update(item => { item.amount = (item.amount ?? 0) + (parsed.amount ?? 0); });
        await this.markAsDeleted();
      } else {
        await this.update(item => { item.name = parsed.name; item.amount = parsed.amount ?? null; item.unit = parsed.unit ?? null; });
        console.log(`[DB ShoppingItem] Zaktualizowano ${this.id} z tekstu.`);
      }
  }

  @writer async deleteItem() {
      // ... (bez zmian)
      console.log(`[DB ShoppingItem] Oznaczanie ${this.id} jako usunięte.`);
      await this.markAsDeleted();
  }

   // --- Przygotowanie do batch (dodane) ---
   prepareToggleChecked(): ShoppingItem | null { // Może zwrócić null, jeśli element jest usuwany
       // Logika toggleChecked jest złożona (znajdowanie, update, delete),
       // trudna do bezpośredniego przełożenia na prepareUpdate/prepareMarkAsDeleted.
       // W przypadku batch, bezpieczniej jest wykonać pełną logikę toggleChecked
       // wewnątrz `database.write` zamiast próbować optymalizować z `prepare`.
       console.warn("prepareToggleChecked nie jest zaimplementowane dla batch - użyj pełnej metody toggleChecked w transakcji.");
       return null; // Wskazuje, że nie można przygotować tej operacji dla batch
   }

   prepareUpdateFromText(text: string): ShoppingItem | null {
       // Podobnie jak toggleChecked, logika jest złożona. Lepiej użyć pełnej metody.
        console.warn("prepareUpdateFromText nie jest zaimplementowane dla batch - użyj pełnej metody updateFromText w transakcji.");
       return null;
   }

   prepareDeleteItem(): ShoppingItem {
       return this.prepareMarkAsDeleted();
   }

}

export default ShoppingItem;