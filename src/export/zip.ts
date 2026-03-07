import JSZip from "jszip";
import type { ExportPayload } from "./types";

/**
 * Build a ZIP buffer from export payload.
 */
export async function buildExportZipBuffer(
  payload: ExportPayload,
  onProgress?: (percent: number) => void
): Promise<Uint8Array> {
  const zip = new JSZip();
  const folder = payload.basePath ? zip.folder(payload.basePath) : zip;
  if (!folder) {
    throw new Error("Failed to create ZIP output container");
  }
  for (const f of payload.files) {
    folder.file(f.path, f.content, { unixPermissions: 0o644 });
  }
  return zip.generateAsync(
    { type: "uint8array" },
    (metadata) => {
      onProgress?.(metadata.percent);
    }
  );
}

/**
 * Trigger a browser download for an already-generated ZIP buffer.
 */
export function downloadZipBuffer(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
