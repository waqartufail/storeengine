export function createWorkspace(databaseName, seed) {
  let connection;
  function open() {
    if (!connection)
      connection = new Promise((resolve, reject) => {
        const req = indexedDB.open(databaseName, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore("workspace").add(seed(), "data");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          connection = null;
          reject(
            Error(
              "Browser storage is unavailable. Open this file in a regular Chrome or Edge window.",
            ),
          );
        };
      });
    return connection;
  }
  async function transaction(write, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", write ? "readwrite" : "readonly");
      const box = tx.objectStore("workspace"),
        req = box.get("data");
      let result, failure;
      req.onsuccess = () => {
        try {
          result = fn(req.result);
          if (write) box.put(req.result, "data");
        } catch (e) {
          failure = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          failure ||
            Error(
              "Changes could not be saved. Check browser storage space and try again.",
            ),
        );
    });
  }

  return transaction;
}
