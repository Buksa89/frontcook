import { useAuth } from '../../context/authContext';
import database from '../../../database';
import { Q } from '@nozbe/watermelondb';

class LocalSyncService {
  private readonly tables = ['recipes', 'ingredients', 'tags', 'shopping_items', 'user_settings'];

  /**
   * Sprawdza czy istnieją lokalne dane bez właściciela
   */
  public async isLocalDataToSync(): Promise<boolean> {
    try {
      for (const table of this.tables) {
        const localData = await database.get(table).query(
          Q.where('owner', null),
          Q.where('is_deleted', false)
        ).fetch();

        if (localData.length > 0) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Błąd podczas sprawdzania lokalnych danych:', error);
      return false;
    }
  }

  /**
   * Przypisuje lokalne dane do użytkownika
   */
  public async assignLocalDataToUser(username: string): Promise<boolean> {
    try {
      await database.write(async () => {
        for (const table of this.tables) {
          const localData = await database.get(table).query(
            Q.where('owner', null),
            Q.where('is_deleted', false)
          ).fetch();

          for (const record of localData) {
            await record.update((item: any) => {
              item.owner = username;
            });
          }
        }
      });
      return true;
    } catch (error) {
      console.error('Błąd podczas przypisywania lokalnych danych:', error);
      return false;
    }
  }
}

export default new LocalSyncService(); 