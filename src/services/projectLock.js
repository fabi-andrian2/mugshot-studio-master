const lockName = (projectId) => `mugshot-project:${projectId}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tryOnce = (locks, name) =>
  new Promise((resolve, reject) => {
    locks
      .request(name, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return undefined;
        }
        return new Promise((release) => resolve({ release }));
      })
      .catch(reject);
  });

/**
 * Verrou exclusif (Web Locks) par projet : un projet ne s'ouvre que dans une fenêtre à la fois.
 * Sans API Web Locks, on dégrade proprement : le contrôle de révision protège toujours l'écriture.
 */
export const acquireProjectLock = async (
  projectId,
  { locks = globalThis.navigator?.locks, retries = 3, retryDelayMs = 150, wait = sleep } = {},
) => {
  if (!locks?.request) return { ok: true, supported: false, release: () => {} };
  const name = lockName(projectId);
  for (let i = 0; i <= retries; i += 1) {
    let handle;
    try {
      handle = await tryOnce(locks, name);
    } catch {
      return { ok: true, supported: false, release: () => {} };
    }
    if (handle) {
      let released = false;
      return {
        ok: true,
        supported: true,
        release: () => {
          if (released) return;
          released = true;
          handle.release();
        },
      };
    }
    if (i < retries) await wait(retryDelayMs);
  }
  return { ok: false, reason: 'held' };
};
