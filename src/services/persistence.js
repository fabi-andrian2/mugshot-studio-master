// Lecture de l'ancienne session unique (store `session`, clé `current`).
// Depuis la gestion de projets, ce module ne sert plus qu'à relire cet héritage :
// il n'écrit ni n'efface jamais rien.
import {
  DB_NAME,
  DB_VERSION,
  STORE_SESSION,
  PersistenceError,
  runTransaction,
} from './idb.js';

export { DB_NAME, DB_VERSION, PersistenceError };
export const STORE_NAME = STORE_SESSION;
export const SESSION_KEY = 'current';
export const SCHEMA_VERSION = 1;

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
 * Relit l'instantané.
 *  - { status: 'empty' }               : aucune session sauvegardée
 *  - { status: 'ok', snapshot }        : snapshot = { schemaVersion, savedAt, data }
 *  - { status: 'error', error }        : stockage indisponible, illisible ou version inconnue
 * Ne supprime jamais rien : une sauvegarde douteuse reste en place.
 */
export const readSession = async ({ idb } = {}) => {
  try {
    const envelope = await runTransaction(idb, [STORE_SESSION], 'readonly', 'read', (stores) =>
      new Promise((resolve, reject) => {
        const request = stores[STORE_SESSION].get(SESSION_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
    );
    if (envelope === undefined) return { status: 'empty' };
    const problem = checkEnvelope(envelope);
    if (problem) return { status: 'error', error: problem };
    return { status: 'ok', snapshot: envelope };
  } catch (error) {
    return { status: 'error', error };
  }
};
