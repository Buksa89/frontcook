// src/services/image/imageService.ts
import { Database, Q, Model } from '@nozbe/watermelondb'; // Dodano Model
import database from '../../database';
import Recipe from '../../database/models/Recipe';
import RecipeImageLocal from '../../database/models/RecipeImageLocal';
import { downloadAndProcessImage, safeDeleteFile, IMAGES_DIRECTORY } from '../../utils/imageProcessor';
import { Subscription, Subject, from, of } from 'rxjs'; // Usunięto 'observe' z importu WDB
import { switchMap, filter, mergeMap, bufferTime, catchError, tap, finalize, map } from 'rxjs/operators'; // Dodano map
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system'; // Dodano import FileSystem

const MAX_CONCURRENT_IMAGE_PROCESSING = 2;
const CHANGE_BUFFER_TIME = 1500;
// Dodano opóźnienie inicjalizacji pipeline'u RxJS
const PIPELINE_INIT_DELAY = 50; // 50ms

class ImageService {
  private db: Database;
  private recipeSubscription: Subscription | null = null;
  private changeSubject = new Subject<Recipe>();
  private processingQueue = new Set<string>();
  private isOnline = true;
  private pipelineSubscription: Subscription | null = null; // Do zarządzania subskrypcją pipeline

  constructor(db: Database) {
    this.db = db;
    this.subscribeToNetInfo();
    // Nie wywołujemy setupChangeProcessingPipeline od razu w konstruktorze
    // Zamiast tego, wywołamy go w startObservingRecipes
    console.log('[ImageService] Konstruktor zakończony.');
  }

  public startObservingRecipes(): void {
    if (this.recipeSubscription) {
      console.log('[ImageService] Obserwacja przepisów jest już aktywna.');
      return;
    }
    console.log('[ImageService] Rozpoczynanie obserwacji zmian w przepisach...');

    // Inicjalizuj pipeline RxJS, jeśli jeszcze nie został zainicjalizowany
    if (!this.pipelineSubscription || this.pipelineSubscription.closed) {
        this.setupChangeProcessingPipeline();
    }

    // Rozpocznij obserwację bazy danych
    this.recipeSubscription = this.db.get<Recipe>(Recipe.table)
      .query()
      .observeWithColumns(['image_url', 'last_modified'])
      .subscribe({
        next: (recipes) => {
          recipes.forEach(recipe => this.changeSubject.next(recipe));
        },
        error: (error) => {
          console.error('[ImageService] Błąd podczas obserwacji przepisów:', error);
          this.stopObservingRecipes(); // Zatrzymaj w razie błędu
        }
      });
  }

  public stopObservingRecipes(): void {
    if (this.recipeSubscription) {
      console.log('[ImageService] Zatrzymywanie obserwacji przepisów.');
      this.recipeSubscription.unsubscribe();
      this.recipeSubscription = null;
    }
    // Zatrzymaj również pipeline RxJS
    if (this.pipelineSubscription && !this.pipelineSubscription.closed) {
        console.log('[ImageService] Zatrzymywanie pipeline RxJS.');
        this.pipelineSubscription.unsubscribe();
    }
  }

  private setupChangeProcessingPipeline(): void {
    // Opóźnienie subskrypcji, aby dać czas na inicjalizację
    // Używamy setTimeout, aby pozwolić na zakończenie bieżącego cyklu zdarzeń
    console.log(`[ImageService] Planowanie inicjalizacji pipeline RxJS za ${PIPELINE_INIT_DELAY}ms...`);
    setTimeout(() => {
        if (this.pipelineSubscription && !this.pipelineSubscription.closed) {
            console.log("[ImageService] Pipeline RxJS już działa.");
            return; // Już zainicjalizowany i działa
        }
        console.log("[ImageService] Inicjalizacja pipeline RxJS...");
        this.pipelineSubscription = this.changeSubject
          .pipe(
            bufferTime(CHANGE_BUFFER_TIME),
            filter(recipeBatch => recipeBatch.length > 0),
            map(recipeBatch => {
                // Dodano sprawdzanie typu recipeBatch
                if (!Array.isArray(recipeBatch)) {
                    console.error("[ImageService Pipeline] recipeBatch nie jest tablicą!", recipeBatch);
                    return []; // Zwróć pustą tablicę
                }
                const uniqueRecipes = new Map<string, Recipe>();
                recipeBatch.forEach(recipe => {
                    // Dodano sprawdzanie poprawności obiektu recipe
                    if (recipe && typeof recipe.id === 'string') {
                        uniqueRecipes.set(recipe.id, recipe);
                    } else {
                        console.warn("[ImageService Pipeline] Napotkano nieprawidłowy obiekt Recipe w batchu:", recipe);
                    }
                });
                return Array.from(uniqueRecipes.values());
            }),
            filter(uniqueRecipes => uniqueRecipes.length > 0), // Dodano filtr po mapowaniu
            tap(uniqueRecipes => console.log(`[ImageService Pipeline] Przetwarzanie ${uniqueRecipes.length} unikalnych zmian przepisów...`)),
            mergeMap(uniqueRecipes => from(uniqueRecipes)),
            filter(recipe => !this.processingQueue.has(recipe.id)),
            filter(() => this.isOnline),
            mergeMap(recipe => {
              this.processingQueue.add(recipe.id);
              console.log(`[ImageService Pipeline] Rozpoczęcie przetwarzania obrazka dla Recipe ID: ${recipe.id}`);
              return of(recipe).pipe(
                mergeMap(r => this.processRecipeImage(r)),
                catchError((error) => { console.error(`[ImageService Pipeline] Błąd przetwarzania dla ${recipe.id}:`, error); return of(null); }),
                finalize(() => { this.processingQueue.delete(recipe.id); })
              );
            }, MAX_CONCURRENT_IMAGE_PROCESSING)
          )
          .subscribe({
              next: (result) => { /* Można logować sukces */ },
              error: (pipelineError) => { console.error('[ImageService Pipeline] Błąd w pipeline RxJS:', pipelineError); }
          });
       console.log('[ImageService] Pipeline RxJS zainicjalizowany i zasubskrybowany.');
    }, PIPELINE_INIT_DELAY); // Opóźnienie
  }


  private async processRecipeImage(recipe: Recipe): Promise<boolean> {
    // Logika bez zmian
    const recipeId = recipe.id; const remoteUrl = recipe.imageUrl;
    try {
      const localImageCollection = this.db.get<RecipeImageLocal>('recipe_images_local');
      const existingLocalImages = await localImageCollection.query(Q.where('recipe_id', recipeId)).fetch();
      const existingLocalImage = existingLocalImages.length > 0 ? existingLocalImages[0] : null;
      if (remoteUrl) {
        if (existingLocalImage && existingLocalImage.originalRemoteUrl === remoteUrl) { return false; }
        console.log(`[ImageService] Pobieranie/Przetwarzanie dla ${recipeId}...`);
        const processedPaths = await downloadAndProcessImage(remoteUrl, recipeId);
        if (processedPaths) {
          if (existingLocalImage) { await safeDeleteFile(existingLocalImage.localPath); await safeDeleteFile(existingLocalImage.localThumbnailPath); }
          await this.db.write(async () => { if (existingLocalImage) { await existingLocalImage.update(r => { r.localPath = processedPaths.mainPath; r.localThumbnailPath = processedPaths.thumbPath; r.originalRemoteUrl = remoteUrl; r.lastProcessedTimestamp = Date.now(); }); }
            else { await localImageCollection.create(r => { r.recipeId = recipeId; r.localPath = processedPaths.mainPath; r.localThumbnailPath = processedPaths.thumbPath; r.originalRemoteUrl = remoteUrl; r.lastProcessedTimestamp = Date.now(); }); } });
          return true;
        } else { console.error(`[ImageService] Błąd przetwarzania ${recipeId} z ${remoteUrl}`); if (existingLocalImage) { await this.deleteLocalImageData(existingLocalImage); } return false; }
      } else {
        if (existingLocalImage) { console.log(`[ImageService] Usuwanie lokalnych danych dla ${recipeId}`); await this.deleteLocalImageData(existingLocalImage); return true; }
        else { return false; }
      }
    } catch (error) { console.error(`[ImageService] Błąd processRecipeImage dla ${recipeId}:`, error); return false; }
  }

  private async deleteLocalImageData(localImageRecord: RecipeImageLocal): Promise<void> {
    // Logika bez zmian
      console.log(`[ImageService] Usuwanie lokalnych danych obrazka dla Recipe ID: ${localImageRecord.recipeId}`);
      const mainPath = localImageRecord.localPath; const thumbPath = localImageRecord.localThumbnailPath;
      await this.db.write(async () => { await localImageRecord.destroyPermanently(); });
      await safeDeleteFile(mainPath); await safeDeleteFile(thumbPath);
      console.log(`[ImageService] Usunięto rekord i pliki dla Recipe ID: ${localImageRecord.recipeId}`);
  }

  private subscribeToNetInfo(): void {
    // Logika bez zmian
      NetInfo.addEventListener(state => { const isNowOnline = !!state.isConnected && !!state.isInternetReachable; if (this.isOnline !== isNowOnline) { console.log(`[ImageService] Zmiana statusu sieci: ${this.isOnline ? 'Online' : 'Offline'} -> ${isNowOnline ? 'Online' : 'Offline'}`); this.isOnline = isNowOnline; if (isNowOnline) { console.log('[ImageService] Powrót online, wyzwalam przetwarzanie...'); this.changeSubject.next(null as any); } } });
      NetInfo.fetch().then(state => { this.isOnline = !!state.isConnected && !!state.isInternetReachable; console.log(`[ImageService] Początkowy stan sieci: ${this.isOnline ? 'Online' : 'Offline'}`); });
  }

  public async cleanupOrphanedImageFiles(): Promise<void> {
    // Logika bez zmian
    console.log('[ImageService] Czyszczenie osieroconych plików...');
    try {
      /* ... logika ... */
      await ensureImagesDirectoryExists();
      const fileList = await FileSystem.readDirectoryAsync(IMAGES_DIRECTORY);
      const imageFiles = fileList.filter((f: string) => f.startsWith('recipe_') || f.startsWith('thumb_'));
      if (imageFiles.length === 0) {
        return;
      }
      const localImages = await this.db.get<RecipeImageLocal>('recipe_images_local').query().fetch();
      const existingPaths = new Set<string>();
      localImages.forEach(img => {
        if (img.localPath) existingPaths.add(img.localPath);
        if (img.localThumbnailPath) existingPaths.add(img.localThumbnailPath);
      });
      let deletedCount = 0;
      for (const fileName of imageFiles) {
        const filePath = `${IMAGES_DIRECTORY}${fileName}`;
        if (!existingPaths.has(filePath)) {
          await safeDeleteFile(filePath);
          deletedCount++;
        }
      }
      console.log(`[ImageService] Usunięto ${deletedCount} osieroconych plików.`);
    } catch (error) {
      console.error('[ImageService] Błąd czyszczenia osieroconych plików:', error);
    }
  }
}

// Eksport singletona (bez zmian)
let imageServiceInstance: ImageService | null = null;
export const initializeImageService = (): ImageService => { if (imageServiceInstance) { return imageServiceInstance; } if (!database) { throw new Error("[ImageService Init] Baza danych nie zainicjalizowana."); } imageServiceInstance = new ImageService(database); console.log('[ImageService] Instancja utworzona.'); imageServiceInstance.startObservingRecipes(); return imageServiceInstance; };
export const getImageService = (): ImageService => { if (!imageServiceInstance) { console.warn("[ImageService Get] Inicjowanie..."); return initializeImageService(); } return imageServiceInstance; };

// Definicja ensureImagesDirectoryExists, jeśli nie jest w imageProcessor
const ensureImagesDirectoryExists = async (): Promise<void> => {
   const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIRECTORY);
   if (!dirInfo.exists) {
     console.log(`[ImageService] Tworzenie katalogu: ${IMAGES_DIRECTORY}`);
     await FileSystem.makeDirectoryAsync(IMAGES_DIRECTORY, { intermediates: true });
   }
 };