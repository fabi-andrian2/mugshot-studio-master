const DOWNLOAD_URL_LIFETIME_MS = 10000;

const pad = (value) => String(value).padStart(2, '0');

export const buildPngFileName = (date = new Date()) => {
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `Mugshot_Studio_${day}_${time}.png`;
};

export const isTauriRuntime = (scope = globalThis) => Boolean(scope.__TAURI_INTERNALS__);

export const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
  return { status: 'downloaded' };
};

const loadDialogPlugin = () => import('@tauri-apps/plugin-dialog');
const loadFsPlugin = () => import('@tauri-apps/plugin-fs');

export const saveBlobWithTauri = async (
  blob,
  fileName,
  { loadDialog = loadDialogPlugin, loadFs = loadFsPlugin } = {},
) => {
  const { save } = await loadDialog();
  const path = await save({
    title: 'Enregistrer la planche',
    defaultPath: fileName,
    filters: [{ name: 'Image PNG', extensions: ['png'] }],
  });
  if (!path) return { status: 'cancelled' };

  try {
    const { writeFile } = await loadFs();
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  } catch (error) {
    throw new Error(`Écriture impossible dans « ${path} » : ${error?.message ?? error}`, { cause: error });
  }
  return { status: 'saved', path };
};

export const savePngBlob = async (
  blob,
  {
    fileName = buildPngFileName(),
    isNative = isTauriRuntime(),
    nativeSave = saveBlobWithTauri,
    browserSave = downloadBlob,
  } = {},
) => (isNative ? nativeSave(blob, fileName) : browserSave(blob, fileName));
