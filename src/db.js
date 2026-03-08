const DB_NAME = "InventarioDB";

function openDatabase(version) {
  return new Promise((resolve, reject) => {
    const req = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (event) => reject(event.target.error);
  });
}

export async function ensureStores() {
  const db = await openDatabase();
  const hasLotes = db.objectStoreNames.contains("lotes");
  const hasContagens = db.objectStoreNames.contains("contagens");

  if (hasLotes && hasContagens) {
    db.close();
    return;
  }

  const nextVersion = db.version + 1;
  db.close();

  await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, nextVersion);
    req.onupgradeneeded = (event) => {
      const upgradeDb = event.target.result;
      if (!upgradeDb.objectStoreNames.contains("lotes")) {
        upgradeDb.createObjectStore("lotes", { keyPath: "nome" });
      }
      if (!upgradeDb.objectStoreNames.contains("contagens")) {
        upgradeDb.createObjectStore("contagens", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = (event) => reject(event.target.error);
  });
}

export async function withStore(storeName, mode, task) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], mode);
    const store = tx.objectStore(storeName);
    const out = task(store);

    tx.oncomplete = () => {
      db.close();
      resolve(out);
    };
    tx.onerror = (event) => {
      db.close();
      reject(event.target.error);
    };
  });
}

export async function getAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      resolve([]);
      return;
    }

    const tx = db.transaction([storeName], "readonly");
    const req = tx.objectStore(storeName).getAll();

    req.onsuccess = () => {
      const result = req.result || [];
      db.close();
      resolve(result);
    };
    req.onerror = (event) => {
      db.close();
      reject(event.target.error);
    };
  });
}

export async function clearAllDatabases() {
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs.map(
      (dbInfo) =>
        new Promise((resolve) => {
          const req = indexedDB.deleteDatabase(dbInfo.name);
          req.onsuccess = resolve;
          req.onerror = resolve;
          req.onblocked = resolve;
        })
    )
  );
}

export async function saveLote(lote) {
  await ensureStores();
  await withStore("lotes", "readwrite", (store) => store.put(lote));
}

export async function addContagem(record) {
  await ensureStores();
  await withStore("contagens", "readwrite", (store) => store.add(record));
}