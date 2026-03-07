/// <reference lib="webworker" />

import { buildExportPayload } from "./exportBuilder";
import { parseRbxmxFile } from "./rbxmxParser";
import { buildExportZipBuffer } from "./zip";
import type { ExportStage, ExportWorkerMessage, ExportWorkerRequest } from "./workerTypes";

declare const self: DedicatedWorkerGlobalScope;

function postDebug(detail: string, data?: unknown): void {
  const message: ExportWorkerMessage = {
    type: "debug",
    detail,
    data,
  };
  self.postMessage(message);
}

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

self.addEventListener("error", (event) => {
  postDebug("Worker global error event", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

self.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error
    ? { name: event.reason.name, message: event.reason.message, stack: event.reason.stack }
    : String(event.reason);
  postDebug("Worker unhandled rejection", reason);
});

self.addEventListener("message", async (event: MessageEvent<ExportWorkerRequest>) => {
  if (event.data.type !== "process") {
    return;
  }

  const progressState = { lastSentAt: 0 };
  const { file } = event.data;
  postDebug("Worker received process request", {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    supportsBlobStream: typeof file.stream === "function",
    workerHref: self.location.href,
    userAgent: navigator.userAgent,
  });

  try {
    postDebug("Worker starting parse stage");
    const { root, scripts } = await parseRbxmxFile(file, (progress) => {
      postProgress("parse", progress.percent, progress.detail, false, progressState);
    });
    postProgress("parse", 100, `Parse complete: ${scripts.length} script containers`, true, progressState);
    postDebug("Worker finished parse stage", {
      rootChildren: root.children.length,
      scriptCount: scripts.length,
    });

    const placeName = file.name.replace(/\.(rbxlx|rbxmx)$/i, "") || "Place";
    postDebug("Worker starting build stage", { placeName });
    const payload = buildExportPayload(root, scripts, placeName, (progress) => {
      postProgress("build", progress.percent, progress.detail, false, progressState);
    });
    postProgress("build", 100, `Build complete: ${payload.files.length} output files`, true, progressState);
    postDebug("Worker finished build stage", {
      fileCount: payload.files.length,
    });

    if (payload.files.length === 0) {
      const emptyMessage: ExportWorkerMessage = { type: "empty" };
      postDebug("Worker found no scripts to export");
      self.postMessage(emptyMessage);
      return;
    }

    const zipName = `${placeName}-scripts.zip`;
    postDebug("Worker starting zip stage", { zipName });
    const zipBuffer = await buildExportZipBuffer(payload, (percent) => {
      postProgress("zip", percent, `Compressing ZIP: ${Math.round(percent)}%`, false, progressState);
    });
    postProgress("zip", 100, `ZIP complete: ${zipName}`, true, progressState);
    postDebug("Worker finished zip stage", {
      zipName,
      zipBytes: zipBuffer.byteLength,
    });

    const completeMessage: ExportWorkerMessage = {
      type: "complete",
      fileCount: payload.files.length,
      filename: zipName,
      buffer: zipBuffer.buffer.slice(
        zipBuffer.byteOffset,
        zipBuffer.byteOffset + zipBuffer.byteLength
      ),
    };
    postDebug("Worker posting complete message");
    self.postMessage(completeMessage, [completeMessage.buffer]);
  } catch (err) {
    const normalizedError = err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { message: String(err) };
    postDebug("Worker caught error", normalizedError);
    const errorMessage: ExportWorkerMessage = {
      type: "error",
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errorMessage);
  }
});

export {};
