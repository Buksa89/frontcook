Sync implementation details
If you're looking for a guide to implement Watermelon Sync in your app, see Synchronization.

If you want to contribute to Watermelon Sync, or implement your own synchronization engine from scratch, read this.

Implementing your own sync from scratch
For basic details about how changes tracking works, see: 📺 Digging deeper into WatermelonDB

Why you might want to implement a custom sync engine? If you have an existing remote server architecture that's difficult to adapt to Watermelon sync protocol, or you specifically want a different architecture (e.g. single HTTP request -- server resolves conflicts). Be warned, however, that implementing sync that works reliably is a hard problem, so we recommend sticking to Watermelon Sync and tweaking it as needed.

The rest of this document contains details about how Watermelon Sync works - you can use that as a blueprint for your own work.

If possible, please use sync implementation helpers from sync/*.js to keep your custom sync implementation have as much commonality as possible with the standard implementation. This is good both for you and for the rest of WatermelonDB community, as we get to share improvements and bug fixes. If the helpers are almost what you need, but not quite, please send pull requests with improvements!

Watermelon Sync -- Details
General design
master/replica - server is the source of truth, client has a full copy and syncs back to server (no peer-to-peer syncs)
two phase sync: first pull remote changes to local app, then push local changes to server
client resolves conflicts
content-based, not time-based conflict resolution
conflicts are resolved using per-column client-wins strategy: in conflict, server version is taken except for any column that was changed locally since last sync.
local app tracks its changes using a _status (synced/created/updated/deleted) field and _changes field (which specifies columns changed since last sync)
server only tracks timestamps (or version numbers) of every record, not specific changes
sync is performed for the entire database at once, not per-collection
eventual consistency (client and server are consistent at the moment of successful pull if no local changes need to be pushed)
non-blocking: local database writes (but not reads) are only momentarily locked when writing data but user can safely make new changes throughout the process
Sync procedure
Pull phase
get lastPulledAt timestamp locally (null if first sync)
call pullChanges function, passing lastPulledAt
server responds with all changes (create/update/delete) that occured since lastPulledAt
server serves us with its current timestamp
IN ACTION (lock local writes):
ensure no concurrent syncs
apply remote changes locally
insert new records
if already exists (error), update
if locally marked as deleted (error), un-delete and update
update records
if synced, just replace contents with server version
if locally updated, we have a conflict!
take remote version, apply local fields that have been changed locally since last sync (per-column client wins strategy)
record stays marked as updated, because local changes still need to be pushed
if locally marked as deleted, ignore (deletion will be pushed later)
if doesn't exist locally (error), create
destroy records
if alredy deleted, ignore
if locally changed, destroy anyway
ignore children (server ought to schedule children to be destroyed)
if successful, save server's timestamp as new lastPulledAt
Push phase
Fetch local changes
Find all locally changed records (created/updated record + deleted IDs) for all collections
Strip _status, _changed
Call pushChanges function, passing local changes object, and the new lastPulledAt timestamp
Server applies local changes to database, and sends OK
If one of the pushed records has changed on the server since lastPulledAt, push is aborted, all changes reverted, and server responds with an error
IN ACTION (lock local writes):
markLocalChangesAsSynced:
take local changes fetched in previous step, and:
permanently destroy records marked as deleted
mark created/updated records as synced and reset their _changed field
note: do not mark record as synced if it changed locally since fetch local changes step (user could have made new changes that need syncing)
Notes
This procedure is designed such that if sync fails at any moment, and even leaves local app in inconsistent (not fully synced) state, we should still achieve consistency with the next sync:
applyRemoteChanges is designed such that if all changes are applied, but lastPulledAt doesn't get saved — so during next pull server will serve us the same changes, second applyRemoteChanges will arrive at the same result
local changes before "fetch local changes" step don't matter at all - user can do anything
local changes between "fetch local changes" and "mark local changes as synced" will be ignored (won't be marked as synced) - will be pushed during next sync
if changes don't get marked as synced, and are pushed again, server should apply them the same way
remote changes between pull and push phase will be locally ignored (will be pulled next sync) unless there's a per-record conflict (then push fails, but next sync resolves both pull and push)
Migration Syncs
Schema versioning and migrations complicate sync, because a client might not be able to sync some tables and columns, but after upgrade to the newest version, it should be able to get consistent sync. To be able to do that, we need to know what's the schema version at which the last sync occured. Unfortunately, Watermelon Sync didn't track that from the first version, so backwards-compat is required.

synchronize({ migrationsEnabledAtVersion: XXX })

. . . .

LPA = last pulled at
MEA = migrationsEnabledAtVersion, schema version at which future migration support was introduced
LS = last synced schema version (may be null due to backwards compat)
CV = current schema version

LPA     MEA     LS      CV      migration   set LS=CV?   comment

null    X       X       10      null        YES          first sync. regardless of whether the app
                                                         is migration sync aware, we can note LS=CV
                                                         to fetch all migrations once available

100     null    X       X       null        NO           indicates app is not migration sync aware so
                                                         we're not setting LS to allow future migration sync

100     X       10      10      null        NO           up to date, no migration
100     9       9       10      {9-10}      YES          correct migration sync
100     9       null    10      {9-10}      YES          fallback migration. might not contain all
                                                         necessary migrations, since we can't know for sure
                                                         that user logged in at then-current-version==MEA

100     9       11      10      ERROR       NO           LS > CV indicates programmer error
100     11      X       10      ERROR       NO           MEA > CV indicates programmer error


Synchronization
WatermelonDB has been designed from scratch to be able to seamlessly synchronize with a remote database (and, therefore, keep multiple copies of data synced with each other).

Note that Watermelon is only a local database — you need to bring your own backend. What Watermelon provides are:

Synchronization primitives — information about which records were created, updated, or deleted locally since the last sync — and which columns exactly were modified. You can build your own custom sync engine using those primitives
Built-in sync adapter — You can use the sync engine Watermelon provides out of the box, and you only need to provide two API endpoints on your backend that conform to Watermelon sync protocol
To implement synchronization between your client side database (WatermelonDB) and your server, you need to implement synchronization in the frontend & the backend.

Implementing sync in frontend
Using synchronize() in your app
To synchronize, you need to pass pullChanges and pushChanges (optional) that talk to your backend and are compatible with Watermelon Sync Protocol. The frontend code will look something like this:

import { synchronize } from '@nozbe/watermelondb/sync'

async function mySync() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      const urlParams = `last_pulled_at=${lastPulledAt}&schema_version=${schemaVersion}&migration=${encodeURIComponent(
        JSON.stringify(migration),
      )}`
      const response = await fetch(`https://my.backend/sync?${urlParams}`)
      if (!response.ok) {
        throw new Error(await response.text())
      }

      const { changes, timestamp } = await response.json()
      return { changes, timestamp }
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(`https://my.backend/sync?last_pulled_at=${lastPulledAt}`, {
        method: 'POST',
        body: JSON.stringify(changes),
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
    },
    migrationsEnabledAtVersion: 1,
  })
}


Who calls synchronize()?
Upon looking at the example above, one question that may arise is who will call synchronize() -- or, in the example above mySync(). WatermelonDB does not manage the moment of invocation of the synchronize() function in any way. The database assumes every call of pullChanges will return all the changes that haven't yet been replicated (up to last_pulled_at). The application code is responsible for calling synchronize() in the frequency it deems necessary.

Implementing pullChanges()
Watermelon will call this function to ask for changes that happened on the server since the last pull.

Arguments:

lastPulledAt is a timestamp for the last time client pulled changes from server (or null if first sync)
schemaVersion is the current schema version of the local database
migration is an object representing schema changes since last sync (or null if up to date or not supported)
This function should fetch from the server the list of ALL changes in all collections since lastPulledAt.

You MUST pass an async function or return a Promise that eventually resolves or rejects
You MUST pass lastPulledAt, schemaVersion, and migration to an endpoint that conforms to Watermelon Sync Protocol
You MUST return a promise resolving to an object of this shape (your backend SHOULD return this shape already):
{
  changes: { ... }, // valid changes object
  timestamp: 100000, // integer with *server's* current time
}

You MUST NOT store the object returned in pullChanges(). If you need to do any processing on it, do it before returning the object. Watermelon treats this object as "consumable" and can mutate it (for performance reasons)
Implementing pushChanges()
Watermelon will call this function with a list of changes that happened locally since the last push so you can post it to your backend.

Arguments passed:

{
  changes: { ... }, // valid changes object
  lastPulledAt: 10000, // the timestamp of the last successful pull (timestamp returned in pullChanges)
}

You MUST pass changes and lastPulledAt to a push sync endpoint conforming to Watermelon Sync Protocol
You MUST pass an async function or return a Promise from pushChanges()
pushChanges() MUST resolve after and only after the backend confirms it successfully received local changes
pushChanges() MUST reject if backend failed to apply local changes
You MUST NOT resolve sync prematurely or in case of backend failure
You MUST NOT mutate or store arguments passed to pushChanges(). If you need to do any processing on it, do it before returning the object. Watermelon treats this object as "consumable" and can mutate it (for performance reasons)
Checking unsynced changes
WatermelonDB has a built in function to check whether there are any unsynced changes. The frontend code will look something like this

import { hasUnsyncedChanges } from '@nozbe/watermelondb/sync'

async function checkUnsyncedChanges() {
  const database = useDatabase()
  await hasUnsyncedChanges({ database })
}

General information and tips
You MUST NOT connect to backend endpoints you don't control using synchronize(). WatermelonDB assumes pullChanges/pushChanges are friendly and correct and does not guarantee secure behavior if data returned is malformed.
You SHOULD NOT call synchronize() while synchronization is already in progress (it will safely abort)
You MUST NOT reset local database while synchronization is in progress (push to server will be safely aborted, but consistency of the local database may be compromised)
You SHOULD wrap synchronize() in a "retry once" block - if sync fails, try again once. This will resolve push failures due to server-side conflicts by pulling once again before pushing.
You can use database.withChangesForTables to detect when local changes occured to call sync. If you do this, you should debounce (or throttle) this signal to avoid calling synchronize() too often.
Adopting Migration Syncs
For Watermelon Sync to maintain consistency after migrations, you must support Migration Syncs (introduced in WatermelonDB v0.17). This allows Watermelon to request from backend the tables and columns it needs to have all the data.

For new apps, pass {migrationsEnabledAtVersion: 1} to synchronize() (or the first schema version that shipped / the oldest schema version from which it's possible to migrate to the current version)
To enable migration syncs, the database MUST be configured with migrations spec (even if it's empty)
For existing apps, set migrationsEnabledAtVersion to the current schema version before making any schema changes. In other words, this version should be the last schema version BEFORE the first migration that should support migration syncs.
Note that for apps that shipped before WatermelonDB v0.17, it's not possible to determine what was the last schema version at which the sync happened. migrationsEnabledAtVersion is used as a placeholder in this case. It's not possible to guarantee that all necessary tables and columns will be requested. (If user logged in when schema version was lower than migrationsEnabledAtVersion, tables or columns were later added, and new records in those tables/changes in those columns occured on the server before user updated to an app version that has them, those records won't sync). To work around this, you may specify migrationsEnabledAtVersion to be the oldest schema version from which it's possible to migrate to the current version. However, this means that users, after updating to an app version that supports Migration Syncs, will request from the server all the records in new tables. This may be unacceptably inefficient.
WatermelonDB >=0.17 will note the schema version at which the user logged in, even if migrations are not enabled, so it's possible for app to request from backend changes from schema version lower than migrationsEnabledAtVersion
You MUST NOT delete old migrations, otherwise it's possible that the app is permanently unable to sync.
(Advanced) Adopting Turbo Login
WatermelonDB v0.23 introduced an advanced optimization called "Turbo Login". Syncing using Turbo is up to 5.3x faster than the traditional method and uses a lot less memory, so it's suitable for even very large syncs. Keep in mind:

This can only be used for the initial (login) sync, not for incremental syncs. It is a serious programmer error to run sync in Turbo mode if the database is not empty.
Syncs with deleted: [] fields not empty will fail.
Turbo only works with SQLiteAdapter with JSI enabled and running - it does not work on web, or if e.g. Chrome Remote Debugging is enabled
While Turbo Login is stable, it's marked as "unsafe", meaning that the exact API may change in a future version
Here's basic usage:

const isFirstSync = ...
const useTurbo = isFirstSync
await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    const response = await fetch(`https://my.backend/sync?${...}`)
    if (!response.ok) {
      throw new Error(await response.text())
    }

    if (useTurbo) {
      // NOTE: DO NOT parse JSON, we want raw text
      const json = await response.text()
      return { syncJson: json }
    } else {
      const { changes, timestamp } = await response.json()
      return { changes, timestamp }
    }
  },
  unsafeTurbo: useTurbo,
  // ...
})

Raw JSON text is required, so it is not expected that you need to do any processing in pullChanges() - doing that defeats much of the point of using Turbo Login!

If you're using pullChanges to send additional data to your app other than Watermelon Sync's changes and timestamp, you won't be able to process it in pullChanges. However, WatermelonDB can still pass extra keys in sync response back to the app - you can process them using onDidPullChanges. This works both with and without turbo mode:

await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    // ...
  },
  unsafeTurbo: useTurbo,
  onDidPullChanges: async ({ messages }) => {
    if (messages) {
      messages.forEach((message) => {
        alert(message)
      })
    }
  },
  // ...
})

There's a way to make Turbo Login even more turbo! However, it requires native development skills. You need to develop your own native networking code, so that raw JSON can go straight from your native code to WatermelonDB's native code - skipping JavaScript processing altogether.

await synchronize({
  database,
  pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
    // NOTE: You need the standard JS code path for incremental syncs

    // Create a unique id for this sync request
    const syncId = Math.floor(Math.random() * 1000000000)

    await NativeModules.MyNetworkingPlugin.pullSyncChanges(
      // Pass the id
      syncId,
      // Pass whatever information your plugin needs to make the request
      lastPulledAt,
      schemaVersion,
      migration,
    )

    // If successful, return the sync id
    return { syncJsonId: syncId }
  },
  unsafeTurbo: true,
  // ...
})

In native code, perform network request and if successful, extract raw response body data - NSData * on iOS, byte[] on Android. Avoid extracting the response as a string or parsing the JSON. Then pass it to WatermelonDB's native code:

// On Android (Java):
import com.nozbe.watermelondb.jsi.WatermelonJSI;

WatermelonJSI.provideSyncJson(/* id */ syncId, /* byte[] */ data);

// On iOS (Objective-C):
// (If using Swift, add the import to the bridging header)
#import <WatermelonDB/WatermelonDB.h>

watermelondbProvideSyncJson(syncId, data, &error)

Adding logging to your sync
You can add basic sync logs to the sync process by passing an empty object to synchronize(). Sync will then mutate the object, populating it with diagnostic information (start/finish time, resolved conflicts, number of remote/local changes, any errors that occured, and more):

// Using built-in SyncLogger
import SyncLogger from '@nozbe/watermelondb/sync/SyncLogger'
const logger = new SyncLogger(10 /* limit of sync logs to keep in memory */ )
await synchronize({ database, log: logger.newLog(), ... })

// this returns all logs (censored and safe to use in production code)
console.log(logger.logs)
// same, but pretty-formatted to a string (a user can easy copy this for diagnostic purposes)
console.log(logger.formattedLogs)


// You don't have to use SyncLogger, just pass a plain object to synchronize()
const log = {}
await synchronize({ database, log, ... })
console.log(log.startedAt)
console.log(log.finishedAt)

⚠️ Remember to act responsibly with logs, since they might contain your user's private information. Don't display, save, or send the log unless you censor the log.

Debugging changes
If you want to conveniently see incoming and outgoing changes in sync in the console, add these lines to your pullChanges/pushChanges:

⚠️ Leaving such logging committed and running in production is a huge security vulnerability and a performance hog.

// UNDER NO CIRCUMSTANCES SHOULD YOU COMMIT THESE LINES UNCOMMENTED!!!
require('@nozbe/watermelondb/sync/debugPrintChanges').default(changes, isPush)

Pass true for second parameter if you're checking outgoing changes (pushChanges), false otherwise. Make absolutely sure you don't commit this debug tool. For best experience, run this on web (Chrome) -- the React Native experience is not as good.

(Advanced) Replacement Sync
Added in WatermelonDB 0.25, there is an alternative way to synchronize changes with the server called "Replacement Sync". You should only use this as last resort for cases difficult to deal with in an incremental fashion, due to performance implications.

Normally, pullChanges is expected to only return changes to data that had occured since lastPulledAt. During Replacement Sync, server sends the full dataset - all records that user has access to, same as during initial (first/login) sync.

Instead of applying these changes normally, the app will replace its database with the data set received, except that local unpushed changes will be preserved. In other words:

App will create records that are new locally, and update the rest to the server state as per usual
Records that have unpushed changes locally will go through conflict resolution as per usual
HOWEVER, instead of server passing a list of records to delete, app will delete local records not present in the dataset received
Details on how unpushed changes are preserved:
Records marked as created are preserved so they have a chance to sync
Records marked as updated or deleted will be preserved if they're contained in dataset received. Otherwise, they're deleted (since they were remotely deleted/server no longer grants you accecss to them, these changes would be ignored anyway if pushed).
If there are no local (unpushed) changes before or during sync, replacement sync should yield the same state as clearing database and performing initial sync. In case replacement sync is performed with an empty dataset (and there are no local changes), the result should be equivalent to clearing database.

When should you use Replacement Sync?

You can use it as a way to fix a bad sync state (mismatch between local and remote state)
You can use it in case you have a very large state change and your server doesn't know how to correctly calculate incremental changes since last sync (e.g. accessible records changed in a very complex permissions system)
In such cases, you could alternatively relogin (clear the database, then perform initial sync again), however:

Replacement Sync preserves local changes to records (and other state such as Local Storage), so there's minimal risk for data loss
When clearing the database, you need to give up all references to Watermelon objects and stop all observation. Therefore, you need to unmount all UI that touches Watermelon, leading to poor UX. This is not required for Replacement Sync
On the other hand, Replacement Sync is much, much slower than Turbo Login (it's not possible to combine the two techniques), so this technique might not scale to very large datasets
Using Replacement Sync

In pullChanges, return an object with an extra strategy field

```js
{
  changes: { ... },
  timestamp: ...,
  experimentalStrategy: 'replacement',
}
```

Additional synchronize() flags
_unsafeBatchPerCollection: boolean - if true, changes will be saved to the database in multiple batches. This is unsafe and breaks transactionality, however may be required for very large syncs due to memory issues
sendCreatedAsUpdated: boolean - if your backend can't differentiate between created and updated records, set this to true to supress warnings. Sync will still work well, however error reporting, and some edge cases will not be handled as well.
conflictResolver: (TableName, local: DirtyRaw, remote: DirtyRaw, resolved: DirtyRaw) => DirtyRaw - can be passed to customize how records are updated when they change during sync. See src/sync/index.js for details.
onWillApplyRemoteChanges - called after pullChanges is done, but before these changes are applied. Some stats about the pulled changes are passed as arguments. An advanced user can use this for example to show some UI to the user when processing a very large sync (could be useful for replacement syncs). Note that remote change count is NaN in turbo mode.
Edit this page
Implementing your Sync backend
Understanding changes objects
Synchronized changes (received by the app in pullChanges and sent to the backend in pushChanges) are represented as an object with raw records. Those only use raw table and column names, and raw values (strings/numbers/booleans) — the same as in Schema.

Deleted objects are always only represented by their IDs.

Example:

{
  projects: {
    created: [
      { id: 'aaaa', name: 'Foo', is_favorite: true },
      { id: 'bbbb', name: 'Bar', is_favorite: false },
    ],
    updated: [
      { id: 'ccc', name: 'Baz', is_favorite: true },
    ],
    deleted: ['ddd'],
  },
  tasks: {
    created: [],
    updated: [
      { id: 'tttt', name: 'Buy eggs' },
    ],
    deleted: [],
  },
  ...
}

Again, notice the properties returned have the format defined in the Schema (e.g. is_favorite, not isFavorite).

Valid changes objects MUST conform to this shape:

Changes = {
  [table_name: string]: {
    created: RawRecord[],
    updated: RawRecord[],
    deleted: string[],
  }
}

Implementing pull endpoint
Expected parameters:

{
  lastPulledAt: Timestamp,
  schemaVersion: int,
  migration: null | { from: int, tables: string[], columns: { table: string, columns: string[] }[] }
}

Expected response:

{ changes: Changes, timestamp: Timestamp }

The pull endpoint SHOULD take parameters and return a response matching the shape specified above. This shape MAY be different if negotiated with the frontend (however, frontend-side pullChanges() MUST conform to this)
The pull endpoint MUST return all record changes in all collections since lastPulledAt, specifically:
all records that were created on the server since lastPulledAt
all records that were updated on the server since lastPulledAt
IDs of all records that were deleted on the server since lastPulledAt
record IDs MUST NOT be duplicated
If lastPulledAt is null or 0, you MUST return all accessible records (first sync)
The timestamp returned by the server MUST be a value that, if passed again to pullChanges() as lastPulledAt, will return all changes that happened since this moment.
The pull endpoint MUST provide a consistent view of changes since lastPulledAt
You should perform all queries synchronously or in a write lock to ensure that returned changes are consistent
You should also mark the current server time synchronously with the queries
This is to ensure that no changes are made to the database while you're fetching changes (otherwise some records would never be returned in a pull query)
If it's absolutely not possible to do so, and you have to query each collection separately, be sure to return a lastPulledAt timestamp marked BEFORE querying starts. You still risk inconsistent responses (that may break app's consistency assumptions), but the next pull will fetch whatever changes occured during previous pull.
An alternative solution is to check for the newest change before and after all queries are made, and if there's been a change during the pull, return an error code, or retry.
If migration is not null, you MUST include records needed to get a consistent view after a local database migration
Specifically, you MUST include all records in tables that were added to the local database between the last user sync and schemaVersion
For all columns that were added to the local app database between the last sync and schemaVersion, you MUST include all records for which the added column has a value other than the default value (0, '', false, or null depending on column type and nullability)
You can determine what schema changes were made to the local app in two ways:
You can compare migration.from (local schema version at the time of the last sync) and schemaVersion (current local schema version). This requires you to negotiate with the frontend what schema changes are made at which schema versions, but gives you more control
Or you can ignore migration.from and only look at migration.tables (which indicates which tables were added to the local database since the last sync) and migration.columns (which indicates which columns were added to the local database to which tables since last sync).
If you use migration.tables and migration.columns, you MUST whitelist values a client can request. Take care not to leak any internal fields to the client.
Returned raw records MUST match your app's Schema
Returned raw records MUST NOT not contain special _status, _changed fields.
Returned raw records MAY contain fields (columns) that are not yet present in the local app (at schemaVersion -- but added in a later version). They will be safely ignored.
Returned raw records MUST NOT contain arbitrary column names, as they may be unsafe (e.g. __proto__ or constructor). You should whitelist acceptable column names.
Returned record IDs MUST only contain safe characters
Default WatermelonDB IDs conform to /^[a-zA-Z0-9]{16}$/
_-. are also allowed if you override default ID generator, but '"\/$ are unsafe
Changes SHOULD NOT contain collections that are not yet present in the local app (at schemaVersion). They will, however, be safely ignored.
NOTE: This is true for WatermelonDB v0.17 and above. If you support clients using earlier versions, you MUST NOT return collections not known by them.
Changes MUST NOT contain collections with arbitrary names, as they may be unsafe. You should whitelist acceptable collection names.
Implementing push endpoint
The push endpoint MUST apply local changes (passed as a changes object) to the database. Specifically:
create new records as specified by the changes object
update existing records as specified by the changes object
delete records by the specified IDs
If the changes object contains a new record with an ID that already exists, you MUST update it, and MUST NOT return an error code.
(This happens if previous push succeeded on the backend, but not on frontend)
If the changes object contains an update to a record that does not exist, then:
If you can determine that this record no longer exists because it was deleted, you SHOULD return an error code (to force frontend to pull the information about this deleted ID)
Otherwise, you MUST create it, and MUST NOT return an error code. (This scenario should not happen, but in case of frontend or backend bugs, it would keep sync from ever succeeding.)
If the changes object contains a record to delete that doesn't exist, you MUST ignore it and MUST NOT return an error code
(This may happen if previous push succeeded on the backend, but not on frontend, or if another user deleted this record in between user's pull and push calls)
If the changes object contains a record that has been modified on the server after lastPulledAt, you MUST abort push and return an error code
This scenario means that there's a conflict, and record was updated remotely between user's pull and push calls. Returning an error forces frontend to call pull endpoint again to resolve the conflict
If application of all local changes succeeds, the endpoint MUST return a success status code.
The push endpoint MUST be fully transactional. If there is an error, all local changes MUST be reverted on the server, and en error code MUST be returned.
You MUST ignore _status and _changed fields contained in records in changes object
You SHOULD validate data passed to the endpoint. In particular, collection and column names ought to be whitelisted, as well as ID format — and of course any application-specific invariants, such as permissions to access and modify records
You SHOULD sanitize record fields passed to the endpoint. If there's something slightly wrong with the contents (but not shape) of the data (e.g. user.role should be owner, admin, or member, but user sent empty string or abcdef), you SHOULD NOT send an error code. Instead, prefer to "fix" errors (sanitize to correct format).
Rationale: Synchronization should be reliable, and should not fail other than transiently, or for serious programming errors. Otherwise, the user will have a permanently unsyncable app, and may have to log out/delete it and lose unsynced data. You don't want a bug 5 versions ago to create a persistently failing sync.
You SHOULD delete all descendants of deleted records
Frontend should ask the push endpoint to do so as well, but if it's buggy, you may end up with permanent orphans
Tips on implementing server-side changes tracking
If you're wondering how to actually implement consistent pulling of all changes since the last pull, or how to detect that a record being pushed by the user changed after lastPulledAt, here's what we recommend:

Add a last_modified field to all your server database tables, and bump it to NOW() every time you create or update a record.
This way, when you want to get all changes since lastPulledAt, you query records whose last_modified > lastPulledAt.
The timestamp should be at least millisecond resolution, and you should add (for extra safety) a MySQL/PostgreSQL procedure that will ensure last_modified uniqueness and monotonicity
Specificaly, check that there is no record with a last_modified equal to or greater than NOW(), and if there is, increment the new timestamp by 1 (or however much you need to ensure it's the greatest number)
An example of this for PostgreSQL can be found in Kinto
This protects against weird edge cases - such as records being lost due to server clock time changes (NTP time sync, leap seconds, etc.)
Of course, remember to ignore last_modified from the user if you do it this way.
An alternative to using timestamps is to use an auto-incrementing counter sequence, but you must ensure that this sequence is consistent across all collections. You also leak to users the amount of traffic to your sync server (number of changes in the sequence)
To distinguish between created and updated records, you can also store server-side server_created_at timestamp (if it's greater than last_pulled_at supplied to sync, then record is to be created on client, if less than — client already has it and it is to be updated on client). Note that this timestamp must be consistent with last_modified — and you must not use client-created created_at field, since you can never trust local timestamps.
Alternatively, you can send all non-deleted records as all updated and Watermelon will do the right thing in 99% of cases (you will be slightly less protected against weird edge cases — treatment of locally deleted records is different). If you do this, pass sendCreatedAsUpdated: true to synchronize() to supress warnings about records to be updated not existing locally.
You do need to implement a mechanism to track when records were deleted on the server, otherwise you wouldn't know to push them
One possible implementation is to not fully delete records, but mark them as DELETED=true
Or, you can have a deleted_xxx table with just the record ID and timestamp (consistent with last_modified)
Or, you can treat it the same way as "revoked permissions"
If you have a collaborative app with any sort of permissions, you also need to track granting and revoking of permissions the same way as changes to records
If permission to access records has been granted, the pull endpoint must add those records to created
If permission to access records has been revoked, the pull endpoint must add those records to deleted
Remember to also return all descendants of a record in those cases
Existing Backend Implementations
Note that those are not maintained by WatermelonDB, and we make no endorsements about quality of these projects:

How to Build WatermelonDB Sync Backend in Elixir
Firemelon
Laravel Watermelon
Did you make one? Please contribute a link!

Limitations
If a record being pushed changes remotely between pull and push, push will just fail. It would be better if it failed with a list of conflicts, so that synchronize() can automatically respond. Alternatively, sync could only send changed fields and server could automatically always just apply those changed fields to the server version (since that's what per-column client-wins resolver will do anyway)
During next sync pull, changes we've just pushed will be pulled again, which is unnecessary. It would be better if server, during push, also pulled local changes since lastPulledAt and responded with NEW timestamp to be treated as lastPulledAt.
It shouldn't be necessary to push the whole updated record — just changed fields + ID should be enough
Note: That might conflict with "If client wants to update a record that doesn’t exist, create it"


Don't like these limitations? Good, neither do we! Please contribute - we'll give you guidance.

Frequently Asked Questions
Sync primitives and implementing your own sync entirely from scratch
See: Sync implementation details

Local vs Remote IDs
WatermelonDB has been designed with the assumption that there is no difference between Local IDs (IDs of records and their relations in a WatermelonDB database) and Remote IDs (IDs on the backend server). So a local app can create new records, generating their IDs, and the backend server will use this ID as the true ID. This greatly simplifies synchronization, as you don't have to replace local with remote IDs on the record and all records that point to it.

We highly recommend that you adopt this practice.

Some people are skeptical about this approach due to conflicts, since backend can guarantee unique IDs, and the local app can't. However, in practice, a standard Watermelon ID has 8,000,000,000,000,000,000,000,000 possible combinations. That's enough entropy to make conflicts extremely unlikely. At Nozbe, we've done it this way at scale for more than 15 years, and not once did we encounter a genuine ID conflict or had other issues due to this approach.

Using the birthday problem, we can calculate that for 36^16 possible IDs, if your system grows to a billion records, the probability of a single conflict is 6e-8. At 100B records, the probability grows to 0.06%. But if you grow to that many records, you're probably a very rich company and can start worrying about things like this then.

If you absolutely can't adopt this practice, there's a number of production apps using WatermelonDB that keep local and remote IDs separate — however, more work is required this way. Search Issues to find discussions about this topic — and consider contributing to WatermelonDB to make managing separate local IDs easier for everyone!

Troubleshoot
⚠️ Note about a React Native / UglifyES bug. When you import Watermelon Sync, your app might fail to compile in release mode. To fix this, configure Metro bundler to use Terser instead of UglifyES. Run:

yarn add metro-minify-terser

Then, update metro.config.js:

module.exports = {
    // ...
    transformer: {
        // ...
        minifierPath: 'metro-minify-terser',
    },
}

You might also need to switch to Terser in Webpack if you use Watermelon for web.