import { isTauri, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
export async function initialProject() {
  return isTauri()
    ? invoke<[string, number[]] | null>("initial_project")
    : null;
}
export async function chooseFile(
  extensions: string[],
): Promise<{ name: string; bytes: Uint8Array; path?: string } | null> {
  if (isTauri()) {
    const path = await open({
      filters: [{ name: extensions.join(", "), extensions }],
      multiple: false,
    });
    if (!path) return null;
    return {
      name: path.split(/[\\/]/).pop()!,
      bytes: await readFile(path),
      path,
    };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = extensions.map((e) => "." + e).join(",");
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(
        file
          ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
          : null,
      );
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
export async function saveBytes(
  bytes: Uint8Array,
  name: string,
  path?: string,
): Promise<string | null> {
  if (isTauri()) {
    const destination = path ?? (await save({ defaultPath: name }));
    if (!destination) return null;
    await invoke("atomic_write", {
      path: destination,
      data: Array.from(bytes),
    });
    return destination;
  }
  const blob = new Blob([new Uint8Array(bytes)]),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
export async function saveRecovery(bytes: Uint8Array) {
  if (isTauri()) await invoke("save_recovery", { data: Array.from(bytes) });
  else await dbPut(bytes);
}
export async function loadRecovery(): Promise<Uint8Array | null> {
  if (isTauri()) {
    const data = await invoke<number[] | null>("load_recovery");
    return data ? Uint8Array.from(data) : null;
  }
  return dbGet();
}
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("snes-graph", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("recovery");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbPut(bytes: Uint8Array) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = d.transaction("recovery", "readwrite");
    tx.objectStore("recovery").put(bytes, "latest");
    tx.oncomplete = () => {
      d.close();
      resolve();
    };
    tx.onerror = () => {
      d.close();
      reject(tx.error);
    };
  });
}
async function dbGet() {
  const d = await db();
  return new Promise<Uint8Array | null>((resolve, reject) => {
    const r = d.transaction("recovery").objectStore("recovery").get("latest");
    r.onsuccess = () => {
      d.close();
      resolve(r.result ?? null);
    };
    r.onerror = () => {
      d.close();
      reject(r.error);
    };
  });
}
