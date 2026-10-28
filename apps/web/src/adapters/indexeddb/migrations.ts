import { DomainError } from '@unpermitted/contracts';
export const DATABASE_VERSION = 2;
// Upgrade transactions are browser-managed: an aborted upgrade leaves the old database intact.
// Never delete/recreate the database as an error-recovery shortcut. Export before a future data-shape migration.
export function upgradeDatabase(db: IDBDatabase, transaction: IDBTransaction, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore('snapshots');
    db.createObjectStore('blobs');
  }
  if (oldVersion < 2) {
    const meta = db.createObjectStore('meta');
    meta.put(
      { from: oldVersion, to: DATABASE_VERSION, policy: 'preserve-snapshots-and-blobs' },
      'migration',
    );
  }
  if (!transaction) throw new DomainError('STORAGE', 'Upgrade transaction unavailable');
}
export function openDatabase(name: string, factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = factory.open(name, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      try {
        upgradeDatabase(request.result, request.transaction!, event.oldVersion);
      } catch (error) {
        request.transaction?.abort();
        reject(error);
      }
    };
    request.onerror = () =>
      reject(
        new DomainError('STORAGE', 'Cannot open local database', {
          reason: request.error?.message,
        }),
      );
    request.onblocked = () => {
      blocked = true;
      reject(
        new DomainError('STORAGE', 'Database upgrade blocked; close older project tabs and retry'),
      );
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
