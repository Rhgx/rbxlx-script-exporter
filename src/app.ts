import { parseRbxmx } from "./export/rbxmxParser";
import { buildExportPayload } from "./export/exportBuilder";
import { downloadExportZip } from "./export/zip";

const ACCEPT = ".rbxlx,.rbxmx";

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type StageName = "read" | "parse" | "build" | "zip";

function toMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function mapStageProgress(stage: StageName, stagePercent: number): number {
  const p = Math.max(0, Math.min(100, stagePercent));
  if (stage === "read") {
    return p * 0.2;
  }
  if (stage === "parse") {
    return 20 + p * 0.5;
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

  function setProgress(
    stage: StageName,
    stagePercent: number,
    detail: string,
    force = false
  ): void {
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

  function processFile(file: File): void {
    resetProgress();
    setError("");
    setStatus(`Reading ${file.name}...`);
    setProgress("read", 0, `Opening ${file.name}`);
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const stagePercent = (event.loaded / event.total) * 100;
      setProgress(
        "read",
        stagePercent,
        `Reading bytes ${toMegabytes(event.loaded)} / ${toMegabytes(event.total)}`
      );
    };
    reader.onload = async () => {
      const text = reader.result as string;
      try {
        setProgress("read", 100, `Read complete: ${toMegabytes(file.size)}`, true);
        await tick();

        setStatus("Parsing XML tree...");
        const { root, scripts } = parseRbxmx(text, (progress) => {
          setProgress("parse", progress.percent, progress.detail);
        });
        setProgress("parse", 100, `Parse complete: ${scripts.length} script containers`, true);
        await tick();

        const placeName = file.name.replace(/\.(rbxlx|rbxmx)$/i, "") || "Place";
        setStatus("Building export payload...");
        const payload = buildExportPayload(root, scripts, placeName, (progress) => {
          setProgress("build", progress.percent, progress.detail);
        });
        setProgress("build", 100, `Build complete: ${payload.files.length} output files`, true);
        await tick();

        if (payload.files.length === 0) {
          setStatus("No scripts found in this file.", true);
          return;
        }

        setStatus("Compressing ZIP...");
        const zipName = `${placeName}-scripts`;
        setProgress("zip", 0, `Creating ${zipName}.zip`, true);
        downloadExportZip(payload, zipName, (percent) => {
          setProgress("zip", percent, `Compressing ZIP: ${Math.round(percent)}%`);
        })
          .then(() => {
            setProgress("zip", 100, `ZIP complete: ${zipName}.zip`, true);
            setStatus(`Downloaded ZIP with ${payload.files.length} script(s).`);
          })
          .catch((err) => {
            setError(String(err));
            setStatus("Export failed.", true);
          });
      } catch (err) {
        setError(String(err));
        setStatus("Parse failed.", true);
      }
    };
    reader.onerror = () => {
      resetProgress();
      setError("Failed to read file.");
      setStatus("", true);
    };
    reader.readAsText(file, "utf-8");
  }

  function onFile(files: FileList | null): void {
    if (!files?.length) return;
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
    if ((e.target as HTMLElement).closest("label")) return;
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
