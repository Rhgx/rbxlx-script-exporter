import JSZip from "jszip";
import type { ExportPayload } from "./types";

/**
 * Build a ZIP blob from export payload and trigger browser download.
 * Files are placed under basePath inside the ZIP (e.g. RobloxExports/PlaceName/...).
 */
export async function downloadExportZip(
  payload: ExportPayload,
  filename: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = payload.basePath ? zip.folder(payload.basePath) : zip;
  if (!folder) {
    throw new Error("Failed to create ZIP output container");
  }
  for (const f of payload.files) {
    folder.file(f.path, f.content, { unixPermissions: 0o644 });
  }
  const blob = await zip.generateAsync(
    { type: "blob" },
    (metadata) => {
      onProgress?.(metadata.percent);
    }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
