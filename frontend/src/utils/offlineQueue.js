const DB_NAME = "inspecciones_offline_db";

// Store existente (evidencias)
const UPLOADS_STORE = "uploads_queue";

// Nuevos stores (offline real)
const MUTATIONS_STORE = "mutations_queue"; // crear OBS/ACC
const IDMAP_STORE = "id_map"; // tempId -> realId
const INSPECCION_CACHE = "inspeccion_cache";

function openDB() {
  return new Promise((resolve, reject) => {
    // ⬅️ subimos a versión 2 para crear stores nuevos
    const req = indexedDB.open(DB_NAME, 3);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
        db.createObjectStore(UPLOADS_STORE, { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
        db.createObjectStore(MUTATIONS_STORE, { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains(IDMAP_STORE)) {
        // keyPath = tempId (string)
        db.createObjectStore(IDMAP_STORE, { keyPath: "tempId" });
      }
      // ✅ cache por inspección
      if (!db.objectStoreNames.contains(INSPECCION_CACHE)) {
        db.createObjectStore(INSPECCION_CACHE, { keyPath: "idInspeccion" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* -------------------- UPLOADS (COMPAT con tu código actual) -------------------- */
// Mantengo estos nombres porque tu InspeccionDetail los usa:
// addToQueue / getAllQueue / removeFromQueue

export async function addToQueue(data) {
  const payload = { ...data };
  if (typeof File !== "undefined" && payload.file instanceof File) {
    // Guardamos Blob + metadata para evitar fallas de structured clone en algunos navegadores
    payload.blob = payload.file;
    payload.fileMeta = {
      name: payload.file.name,
      type: payload.file.type,
      lastModified: payload.file.lastModified,
    };
    delete payload.file;
  }

  const db = await openDB();
  const tx = db.transaction(UPLOADS_STORE, "readwrite");
  tx.objectStore(UPLOADS_STORE).add(payload);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllQueue() {
  const db = await openDB();
  const tx = db.transaction(UPLOADS_STORE, "readonly");
  const store = tx.objectStore(UPLOADS_STORE);
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const rows = (req.result || []).map((row) => {
        if (row?.file) return row;
        if (row?.blob && row?.fileMeta) {
          try {
            const { name, type, lastModified } = row.fileMeta;
            if (typeof File !== "undefined") {
              const file = new File([row.blob], name, { type, lastModified });
              return { ...row, file };
            }
            const blob = row.blob;
            blob.name = name;
            blob.lastModified = lastModified;
            return { ...row, file: blob };
          } catch {
            // fallback: usar Blob si File falla (poco probable)
            const blob = row.blob;
            blob.name = row.fileMeta?.name;
            blob.lastModified = row.fileMeta?.lastModified;
            return { ...row, file: blob };
          }
        }
        return row;
      });
      resolve(rows);
    };
    req.onerror = () => resolve([]);
  });
}

export async function removeFromQueue(id) {
  const db = await openDB();
  const tx = db.transaction(UPLOADS_STORE, "readwrite");
  tx.objectStore(UPLOADS_STORE).delete(id);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

/* -------------------- MUTATIONS (nuevo: OBS/ACC offline) -------------------- */

export async function addMutationToQueue(data) {
  const db = await openDB();
  const tx = db.transaction(MUTATIONS_STORE, "readwrite");
  tx.objectStore(MUTATIONS_STORE).add(data);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getAllMutationsQueue() {
  const db = await openDB();
  const tx = db.transaction(MUTATIONS_STORE, "readonly");
  const store = tx.objectStore(MUTATIONS_STORE);
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function removeMutationFromQueue(id) {
  const db = await openDB();
  const tx = db.transaction(MUTATIONS_STORE, "readwrite");
  tx.objectStore(MUTATIONS_STORE).delete(id);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

/* -------------------- ID MAP (temp -> real) -------------------- */

export async function setIdMap(tempId, realId) {
  const db = await openDB();
  const tx = db.transaction(IDMAP_STORE, "readwrite");
  tx.objectStore(IDMAP_STORE).put({ tempId, realId });
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getIdMap(tempId) {
  const db = await openDB();
  const tx = db.transaction(IDMAP_STORE, "readonly");
  const store = tx.objectStore(IDMAP_STORE);

  return new Promise((resolve) => {
    const req = store.get(tempId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

/* -------------------- Helpers -------------------- */

export async function getPendingCounts() {
  const [u, m] = await Promise.all([getAllQueue(), getAllMutationsQueue()]);
  return { uploads: u.length, mutations: m.length, total: u.length + m.length };
}

export async function setInspeccionCache(idInspeccion, data) {
  const db = await openDB();
  const tx = db.transaction(INSPECCION_CACHE, "readwrite");
  tx.objectStore(INSPECCION_CACHE).put({
    idInspeccion: Number(idInspeccion),
    data,
    savedAt: new Date().toISOString(),
  });
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function getInspeccionCache(idInspeccion) {
  const db = await openDB();
  const tx = db.transaction(INSPECCION_CACHE, "readonly");
  const store = tx.objectStore(INSPECCION_CACHE);
  return new Promise((resolve) => {
    const req = store.get(Number(idInspeccion));
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => resolve(null);
  });
}
