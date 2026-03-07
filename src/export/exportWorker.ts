/// <reference lib="webworker" />

import { buildExportPayload } from "./exportBuilder";
import { parseRbxmxFile } from "./rbxmxParser";
import { buildExportZipBuffer } from "./zip";
import type { ExportStage, ExportWorkerMessage, ExportWorkerRequest } from "./workerTypes";

declare const self: DedicatedWorkerGlobalScope;

function postProgress(
  stage: ExportStage,
  percent: number,
  detail: string,
  force = false,
  state = { lastSentAt: 0 }
): void {
  const now = performance.now();
  if (!force && percent < 100 && now - state.lastSentAt < 24) {
    return;
  }
  state.lastSentAt = now;
  const message: ExportWorkerMessage = {
    type: "progress",
    stage,
    percent,
    detail,
  };
  self.postMessage(message);
}

self.addEventListener("message", async (event: MessageEvent<ExportWorkerRequest>) => {
  if (event.data.type !== "process") {
    return;
  }

  const progressState = { lastSentAt: 0 };
  const { file } = event.data;

  try {
    const { root, scripts } = await parseRbxmxFile(file, (progress) => {
      postProgress("parse", progress.percent, progress.detail, false, progressState);
    });
    postProgress("parse", 100, `Parse complete: ${scripts.length} script containers`, true, progressState);

    const placeName = file.name.replace(/\.(rbxlx|rbxmx)$/i, "") || "Place";
    const payload = buildExportPayload(root, scripts, placeName, (progress) => {
      postProgress("build", progress.percent, progress.detail, false, progressState);
    });
    postProgress("build", 100, `Build complete: ${payload.files.length} output files`, true, progressState);

    if (payload.files.length === 0) {
      const emptyMessage: ExportWorkerMessage = { type: "empty" };
      self.postMessage(emptyMessage);
      return;
    }

    const zipName = `${placeName}-scripts.zip`;
    const zipBuffer = await buildExportZipBuffer(payload, (percent) => {
      postProgress("zip", percent, `Compressing ZIP: ${Math.round(percent)}%`, false, progressState);
    });
    postProgress("zip", 100, `ZIP complete: ${zipName}`, true, progressState);

    const completeMessage: ExportWorkerMessage = {
      type: "complete",
      fileCount: payload.files.length,
      filename: zipName,
      buffer: zipBuffer.buffer.slice(
        zipBuffer.byteOffset,
        zipBuffer.byteOffset + zipBuffer.byteLength
      ),
    };
    self.postMessage(completeMessage, [completeMessage.buffer]);
  } catch (err) {
    const errorMessage: ExportWorkerMessage = {
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errorMessage);
  }
});

export {};
