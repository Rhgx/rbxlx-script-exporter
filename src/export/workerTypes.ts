export type ExportStage = "parse" | "build" | "zip";

export interface ExportWorkerRequest {
  type: "process";
  file: File;
}

export interface ExportWorkerProgressMessage {
  type: "progress";
  stage: ExportStage;
  percent: number;
  detail: string;
}

export interface ExportWorkerCompleteMessage {
  type: "complete";
  fileCount: number;
  filename: string;
  buffer: ArrayBuffer;
}

export interface ExportWorkerEmptyMessage {
  type: "empty";
}

export interface ExportWorkerErrorMessage {
  type: "error";
  error: string;
}

export type ExportWorkerMessage =
  | ExportWorkerProgressMessage
  | ExportWorkerCompleteMessage
  | ExportWorkerEmptyMessage
  | ExportWorkerErrorMessage;
