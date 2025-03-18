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
      // Zbierz wszystkie rekordy do aktualizacji przed zapisem
      const recordsToUpdate = [];
      
      // Najpierw pobierz wszystkie rekordy do aktualizacji (operacja odczytu)
      for (const table of this.tables) {
        try {
          const localData = await database.get(table).query(
            Q.where('owner', null),
            Q.where('is_deleted', false)
          ).fetch();
          
          if (localData.length > 0) {
            console.log(`Znaleziono ${localData.length} rekordów do aktualizacji w tabeli ${table}`);
            recordsToUpdate.push(...localData);
          }
        } catch (readError) {
          console.error(`Błąd podczas odczytu danych z tabeli ${table}:`, readError);
          // Kontynuuj z następną tabelą
        }
      }
      
      if (recordsToUpdate.length === 0) {
        console.log('Brak lokalnych danych do zaktualizowania');
        return true;
      }
      
      // Przygotuj operacje aktualizacji
      const updateOperations = recordsToUpdate.map(record => 
        record.prepareUpdate(item => {
          item.owner = username;
        })
      );
      
      // Wykonaj wszystkie aktualizacje w jednej transakcji
      if (updateOperations.length > 0) {
        await database.write(async () => {
          await database.batch(...updateOperations);
        });
        
        console.log(`Zaktualizowano ${updateOperations.length} rekordów, przypisując właściciela: ${username}`);
      }
      
      return true;
    } catch (error) {
      console.error('Błąd podczas przypisywania lokalnych danych:', error);
      return false;
    }
  }
}

export default new LocalSyncService(); 