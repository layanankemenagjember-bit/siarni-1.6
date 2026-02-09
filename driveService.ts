/**
 * SIARNI DRIVE SERVICE
 * Mengelola Google Drive sebagai database teringan.
 */

const FOLDER_NAME = "SIARNI_JEMBER_DATA";
const DB_FILENAME = "siarni_db.json";

interface DriveState {
  accessToken: string;
  folderId: string | null;
  dbFileId: string | null;
}

let state: DriveState = {
  accessToken: '',
  folderId: null,
  dbFileId: null
};

export const initDrive = (token: string) => {
  state.accessToken = token;
};

const driveFetch = async (url: string, options: any = {}) => {
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${state.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};

export const setupStorage = async () => {
  // 1. Cari Folder
  const q = `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`);
  const data = await res.json();

  if (data.files.length > 0) {
    state.folderId = data.files[0].id;
  } else {
    // Buat Folder jika belum ada
    const createRes = await driveFetch(`https://www.googleapis.com/drive/v3/files`, {
      method: 'POST',
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const folder = await createRes.json();
    state.folderId = folder.id;
  }

  // 2. Cari Database File
  const dq = `name = '${DB_FILENAME}' and '${state.folderId}' in parents and trashed = false`;
  const dres = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(dq)}`);
  const ddata = await dres.json();

  if (ddata.files.length > 0) {
    state.dbFileId = ddata.files[0].id;
  } else {
    // Inisialisasi DB kosong
    await saveDatabase({ archives: [], users: [] });
  }
};

export const loadDatabase = async () => {
  if (!state.dbFileId) await setupStorage();
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${state.dbFileId}?alt=media`);
  return await res.json();
};

export const saveDatabase = async (data: any) => {
  if (!state.dbFileId) {
    // Create new file
    const metadata = {
      name: DB_FILENAME,
      parents: [state.folderId]
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.accessToken}` },
      body: form
    });
    const file = await res.json();
    state.dbFileId = file.id;
  } else {
    // Update existing
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${state.dbFileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${state.accessToken}` },
      body: JSON.stringify(data)
    });
  }
};

export const uploadFile = async (file: File) => {
  const metadata = {
    name: `${Date.now()}_${file.name}`,
    parents: [state.folderId]
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${state.accessToken}` },
    body: form
  });
  const data = await res.json();
  return data.id; // Kembalikan ID file Drive
};

export const getFileUrl = (fileId: string) => {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${state.accessToken}`;
};
