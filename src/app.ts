import { downloadZipBuffer } from "./export/zip";
import type { ExportStage, ExportWorkerMessage } from "./export/workerTypes";

const ACCEPT = ".rbxlx,.rbxmx";

function mapStageProgress(stage: ExportStage, stagePercent: number): number {
  const p = Math.max(0, Math.min(100, stagePercent));
  if (stage === "parse") {
    return p * 0.7;
  }
  if (stage === "build") {
    return 70 + p * 0.2;
  }
  return 90 + p * 0.1;
}

export function initApp(container: HTMLElement): void {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "app";

  const heading = document.createElement("h1");
  heading.className = "app__title";
  heading.textContent = "RBXLX Script Export";
  root.appendChild(heading);

  const dropZone = document.createElement("div");
  dropZone.className = "drop-zone";
  dropZone.setAttribute("role", "button");
  dropZone.setAttribute("tabindex", "0");
  dropZone.innerHTML = `
    <span class="drop-zone__label">Drop a .rbxlx or .rbxmx file here</span>
    <span class="drop-zone__or">or</span>
    <label class="drop-zone__browse">
      <input type="file" accept="${ACCEPT}" class="drop-zone__input" />
      Browse
    </label>
  `;

  const status = document.createElement("div");
  status.className = "app__status";
  status.setAttribute("aria-live", "polite");

  const progressWrap = document.createElement("div");
  progressWrap.className = "progress";
  progressWrap.innerHTML = `
    <div class="progress__meta">
      <span class="progress__label">Idle</span>
      <span class="progress__percent">0%</span>
    </div>
    <div class="progress__bar"><div class="progress__fill"></div></div>
  `;

  const errorPanel = document.createElement("div");
  errorPanel.className = "app__error";
  errorPanel.setAttribute("aria-live", "assertive");
  errorPanel.hidden = true;

  root.appendChild(dropZone);
  root.appendChild(status);
  root.appendChild(progressWrap);
  root.appendChild(errorPanel);
  container.appendChild(root);

  const fileInput = dropZone.querySelector<HTMLInputElement>(".drop-zone__input")!;
  const progressFill = progressWrap.querySelector<HTMLElement>(".progress__fill")!;
  const progressLabel = progressWrap.querySelector<HTMLElement>(".progress__label")!;
  const progressPercent = progressWrap.querySelector<HTMLElement>(".progress__percent")!;
  let lastProgressUiUpdate = 0;
  let activeWorker: Worker | null = null;

  function setStatus(msg: string, isError = false): void {
    status.textContent = msg;
    status.classList.toggle("app__status--error", isError);
  }

  function setError(msg: string): void {
    errorPanel.textContent = msg;
    errorPanel.hidden = !msg;
  }

  function setOverallProgress(percent: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    progressFill.style.width = `${clamped}%`;
    progressPercent.textContent = `${clamped}%`;
  }

  function setProgress(stage: ExportStage, stagePercent: number, detail: string, force = false): void {
    const now = performance.now();
    if (!force && stagePercent < 100 && now - lastProgressUiUpdate < 24) {
      return;
    }
    lastProgressUiUpdate = now;
    setOverallProgress(mapStageProgress(stage, stagePercent));
    progressLabel.textContent = detail;
  }

  function resetProgress(): void {
    setOverallProgress(0);
    progressLabel.textContent = "Idle";
    lastProgressUiUpdate = 0;
  }

  function cleanupWorker(): void {
    activeWorker?.terminate();
    activeWorker = null;
  }

  function handleWorkerMessage(worker: Worker, message: ExportWorkerMessage): void {
    if (worker !== activeWorker) {
      return;
    }

    if (message.type === "progress") {
      setProgress(message.stage, message.percent, message.detail);
      if (message.stage === "parse") {
        setStatus("Parsing XML tree...");
      } else if (message.stage === "build") {
        setStatus("Building export payload...");
      } else {
        setStatus("Compressing ZIP...");
      }
      return;
    }

    cleanupWorker();

    if (message.type === "empty") {
      setStatus("No scripts found in this file.", true);
      return;
    }

    if (message.type === "error") {
      setError(message.error);
      setStatus("Export failed.", true);
      return;
    }

    downloadZipBuffer(message.buffer, message.filename);
    setProgress("zip", 100, `ZIP complete: ${message.filename}`, true);
    setStatus(`Downloaded ZIP with ${message.fileCount} script(s).`);
  }

  function processFile(file: File): void {
    cleanupWorker();
    resetProgress();
    setError("");
    setStatus(`Preparing ${file.name}...`);
    setProgress("parse", 0, `Queued ${file.name}`, true);

    const worker = new Worker(new URL("./export/exportWorker.ts", import.meta.url), {
      type: "module",
    });
    activeWorker = worker;
    worker.addEventListener("message", (event: MessageEvent<ExportWorkerMessage>) => {
      handleWorkerMessage(worker, event.data);
    });
    worker.addEventListener("error", (event) => {
      if (worker !== activeWorker) {
        return;
      }
      cleanupWorker();
      setError(event.message || "Worker execution failed.");
      setStatus("Export failed.", true);
    });
    worker.postMessage({
      type: "process",
      file,
    });
  }

  function onFile(files: FileList | null): void {
    if (!files?.length) {
      return;
    }
    const file = files[0];
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (ext !== "rbxlx" && ext !== "rbxmx") {
      setError("Please choose a .rbxlx or .rbxmx file.");
      setStatus("", true);
      return;
    }
    processFile(file);
  }

  fileInput.addEventListener("change", () => {
    onFile(fileInput.files);
    fileInput.value = "";
  });

  dropZone.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("label")) {
      return;
    }
    fileInput.click();
  });

  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drop-zone--over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drop-zone--over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drop-zone--over");
    onFile(e.dataTransfer?.files ?? null);
  });
}
