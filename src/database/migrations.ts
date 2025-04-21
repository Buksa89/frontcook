// src/database/migrations.ts
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
import type { Migration } from '@nozbe/watermelondb/Schema/migrations';

// Dodajemy krok migracji z wersji 1 do wersji 2
const migrations: Migration[] = [
  {
    toVersion: 2, // Wersja schematu, do której migrujemy
    steps: [
      // Tutaj nie dodajemy żadnych kroków (np. addColumns, createTable),
      // ponieważ zmiana w schemacie (version: 2) dotyczyła tylko
      // opcjonalności pola user_id w definicji modelu Watermelon,
      // co niekoniecznie wymaga zmiany struktury tabeli SQL.
      // Jeśli w przyszłości faktycznie zmienisz strukturę tabeli
      // (np. dodasz kolumnę), odpowiednie kroki umieścisz tutaj.
    ],
  },
  // W przyszłości kolejne migracje dodasz tutaj, np.:
  // {
  //   toVersion: 3,
  //   steps: [ /* ... kroki migracji do v3 ... */ ]
  // }
];

// Eksportujemy obiekt schemaMigrations (bez zmian)
export default schemaMigrations({
  migrations,
});