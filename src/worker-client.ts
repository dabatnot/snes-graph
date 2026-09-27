import type { ExportKind, GalleryLanguage } from "./core/gallery";
import type { Project, ExportSet } from "./core/model";
export function runExport(
  project: Project,
  options: ExportSet,
  signal?: AbortSignal,
  kind: ExportKind = "assets",
  ticks?: number,
  language: GalleryLanguage = "en",
): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./export.worker.ts", import.meta.url), {
      type: "module",
    });
    const stop = () => {
      worker.terminate();
      reject(new Error("Export cancelled"));
    };
    signal?.addEventListener("abort", stop, { once: true });
    worker.onmessage = (e) => {
      worker.terminate();
      signal?.removeEventListener("abort", stop);
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.files);
    };
    worker.onerror = (e) => {
      worker.terminate();
      signal?.removeEventListener("abort", stop);
      reject(new Error(e.message));
    };
    worker.postMessage({ project, options, kind, ticks, language });
  });
}
