// Persistance de la session dans IndexedDB (API native, sans dépendance).
// Ce module ne connaît pas React : il stocke et relit un instantané structuré.
// Les Blob sont acceptés tels quels (clonage structuré d'IndexedDB).

export const DB_NAME = 'mugshot-studio';
export const DB_VERSION = 1;
export const STORE_NAME = 'session';
export const SESSION_KEY = 'current';
export const SCHEMA_VERSION = 1;

export class PersistenceError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code; // unavailable | open | read | write | clear | invalid | unsupported-version
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

const openDatabase = (idb) =>
  new Promise((resolve, reject) => {
    let request;
    try {
      request = getFactory(idb).open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(
        error instanceof PersistenceError
          ? error
          : new PersistenceError('open', "Ouverture de la base impossible.", error),
      );
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new PersistenceError('open', "Ouverture de la base impossible.", request.error));
    request.onblocked = () =>
      reject(new PersistenceError('open', "Ouverture de la base bloquée par un autre onglet."));
  });

// Exécute une opération dans une transaction et attend sa fin réelle (complete),
// pas seulement le succès de la requête. La base est toujours refermée.
const runTransaction = async (idb, mode, errorCode, operation) => {
  const db = await openDatabase(idb);
  try {
    return await new Promise((resolve, reject) => {
      let result;
      let tx;
      const fail = (cause) =>
        reject(
          cause instanceof PersistenceError
            ? cause
            : new PersistenceError(errorCode, 'Opération de stockage échouée.', cause),
        );
      try {
        tx = db.transaction(STORE_NAME, mode);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => fail(tx.error);
        tx.onabort = () => fail(tx.error ?? new Error('Transaction annulée.'));
        const request = operation(tx.objectStore(STORE_NAME));
        request.onsuccess = () => {
          result = request.result;
        };
      } catch (error) {
        if (tx) {
          try {
            tx.abort();
          } catch {
            // transaction déjà terminée
          }
        }
        fail(error);
      }
    });
  } finally {
    db.close();
  }
};

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const checkEnvelope = (envelope) => {
  if (
    !isPlainObject(envelope) ||
    typeof envelope.schemaVersion !== 'number' ||
    typeof envelope.savedAt !== 'number' ||
    !isPlainObject(envelope.data)
  ) {
    return new PersistenceError('invalid', 'Sauvegarde illisible : structure inattendue.');
  }
  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    return new PersistenceError(
      'unsupported-version',
      `Version de sauvegarde non prise en charge : ${envelope.schemaVersion}.`,
    );
  }
  return null;
};

/**
 * Enregistre l'instantané (remplace l'ancien en une seule transaction).
 * Retourne { ok: true, savedAt } ou { ok: false, error }.
 */
export const writeSession = async (data, { idb, now = Date.now } = {}) => {
  if (!isPlainObject(data)) {
    return {
      ok: false,
      error: new PersistenceError('write', "L'instantané doit être un objet."),
    };
  }
  const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: now(), data };
  try {
    await runTransaction(idb, 'readwrite', 'write', (store) => store.put(envelope, SESSION_KEY));
    return { ok: true, savedAt: envelope.savedAt };
  } catch (error) {
    return { ok: false, error };
  }
};

/**
 * Relit l'instantané.
 *  - { status: 'empty' }               : aucune session sauvegardée
 *  - { status: 'ok', snapshot }        : snapshot = { schemaVersion, savedAt, data }
 *  - { status: 'error', error }        : stockage indisponible, illisible ou version inconnue
 * Ne supprime jamais rien : une sauvegarde douteuse reste en place.
 */
export const readSession = async ({ idb } = {}) => {
  try {
    const envelope = await runTransaction(idb, 'readonly', 'read', (store) =>
      store.get(SESSION_KEY),
    );
    if (envelope === undefined) return { status: 'empty' };
    const problem = checkEnvelope(envelope);
    if (problem) return { status: 'error', error: problem };
    return { status: 'ok', snapshot: envelope };
  } catch (error) {
    return { status: 'error', error };
  }
};

/**
 * Efface explicitement la session sauvegardée.
 * Retourne { ok: true } ou { ok: false, error }.
 */
export const clearSession = async ({ idb } = {}) => {
  try {
    await runTransaction(idb, 'readwrite', 'clear', (store) => store.delete(SESSION_KEY));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
};