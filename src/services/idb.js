export const DB_NAME = 'mugshot-studio';
export const DB_VERSION = 2;
export const STORE_SESSION = 'session';
export const STORE_PROJECTS = 'projects';
export const STORE_PROJECT_DATA = 'projectData';
export const STORE_META = 'meta';
export const ALL_STORES = [STORE_SESSION, STORE_PROJECTS, STORE_PROJECT_DATA, STORE_META];

export class PersistenceError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

const getFactory = (idb) => {
  const factory = idb ?? globalThis.indexedDB;
  if (!factory) {
    throw new PersistenceError('unavailable', 'IndexedDB indisponible dans ce navigateur.');
  }
  return factory;
};

const isQuota = (cause) =>
  cause?.name === 'QuotaExceededError' || cause?.code === 22 || cause?.inner?.name === 'QuotaExceededError';

const toPersistenceError = (cause, code, message) => {
  if (cause instanceof PersistenceError) return cause;
  if (isQuota(cause)) {
    return new PersistenceError(
      'quota',
      "Espace de stockage insuffisant : libère de la place sur l'ordinateur puis réessaie.",
      cause,
    );
  }
  return new PersistenceError(code, message, cause);
};

export const openDatabase = (idb) =>
  new Promise((resolve, reject) => {
    let request;
    try {
      request = getFactory(idb).open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(toPersistenceError(error, 'open', 'Ouverture de la base impossible.'));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      ALL_STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () =>
      reject(toPersistenceError(request.error, 'open', 'Ouverture de la base impossible.'));
    request.onblocked = () =>
      reject(
        new PersistenceError(
          'blocked',
          'Mise à jour de la base bloquée : ferme les autres fenêtres de Mugshot Studio puis réessaie.',
        ),
      );
  });

export const wrapRequest = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const runTransaction = async (idb, storeNames, mode, errorCode, work) => {
  const db = await openDatabase(idb);
  try {
    return await new Promise((resolve, reject) => {
      let result;
      let tx;
      let settled = false;
      const fail = (cause) => {
        if (settled) return;
        settled = true;
        reject(toPersistenceError(cause, errorCode, 'Opération de stockage échouée.'));
      };
      try {
        tx = db.transaction(storeNames, mode);
      } catch (error) {
        fail(error);
        return;
      }
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error ?? new Error('Transaction annulée.'));
      const stores = Object.fromEntries(storeNames.map((name) => [name, tx.objectStore(name)]));
      const abortWith = (error) => {
        fail(error);
        try {
          tx.abort();
        } catch {
          // transaction déjà terminée
        }
      };
      try {
        Promise.resolve(work(stores)).then((value) => {
          result = value;
        }, abortWith);
      } catch (error) {
        abortWith(error);
      }
    });
  } finally {
    db.close();
  }
};
