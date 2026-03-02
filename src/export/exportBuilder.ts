import type { ParsedInstance } from "./types";
import type { ExportFile, ExportPayload } from "./types";

export interface BuildProgress {
  percent: number;
  detail: string;
}

const RESERVED_WIN_NAMES = new Set<string>([
  "CON", "PRN", "AUX", "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
]);

function isReservedWindowsName(name: string): boolean {
  return RESERVED_WIN_NAMES.has(name.toUpperCase());
}

export function sanitizePart(name: string): string {
  let s = name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+$/, "")
    .replace(/\.+$/, "");
  if (/^\./.test(s)) {
    s = "_" + s;
  }
  if (s === "") {
    s = "(unnamed)";
  }
  if (isReservedWindowsName(s)) {
    s = "_" + s + "_";
  }
  return s;
}

function getScriptSuffix(className: string): string {
  if (className === "Script") return ".server.lua";
  if (className === "LocalScript") return ".client.lua";
  return ".module.lua";
}

function isoTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function getFullPath(inst: ParsedInstance, root: ParsedInstance): string {
  const parts: string[] = [inst.name];
  let p: ParsedInstance | null = inst.parent;
  while (p && p !== root) {
    parts.unshift(p.name);
    p = p.parent;
  }
  parts.unshift("game");
  return parts.join(".");
}

/** Set of instances that appear on paths from any script to root (including script parents that are scripts). */
function collectPathRelevantSet(
  scripts: ParsedInstance[],
  root: ParsedInstance
): Set<ParsedInstance> {
  const relevant = new Set<ParsedInstance>();
  for (const s of scripts) {
    let p: ParsedInstance | null = s.parent;
    while (p && p !== root) {
      relevant.add(p);
      p = p.parent;
    }
  }
  return relevant;
}

/** Unique segment name per sibling (e.g. MyScript, MyScript (2)). */
function buildSegmentMap(
  relevant: Set<ParsedInstance>,
  root: ParsedInstance
): Map<ParsedInstance, string> {
  const segByInst = new Map<ParsedInstance, string>();

  function assignUnder(parent: ParsedInstance) {
    const relevantChildren = parent.children.filter((c) => relevant.has(c));
    const counts: Record<string, number> = {};
    for (const ch of relevantChildren) {
      const base = sanitizePart(ch.name);
      const idx = (counts[base] ?? 0) + 1;
      counts[base] = idx;
      const seg = idx === 1 ? base : `${base} (${idx})`;
      segByInst.set(ch, seg);
    }
    for (const ch of relevantChildren) {
      assignUnder(ch);
    }
  }

  const roots = root.children.filter((r) => relevant.has(r));
  roots.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of roots) {
    assignUnder(r);
  }

  return segByInst;
}

function getFolderPathForScript(
  inst: ParsedInstance,
  segByInst: Map<ParsedInstance, string>,
  root: ParsedInstance
): string {
  const parts: string[] = [];
  let p: ParsedInstance | null = inst.parent;
  while (p && p !== root) {
    parts.unshift(segByInst.get(p) ?? sanitizePart(p.name));
    p = p.parent;
  }
  return parts.join("/");
}

function makeUniqueNameResolver(): (folderPath: string, baseName: string, suffix: string) => string {
  const perFolder: Record<string, Record<string, number>> = {};
  return (folderPath: string, baseName: string, suffix: string) => {
    const key = folderPath ?? "";
    if (!perFolder[key]) {
      perFolder[key] = {};
    }
    const folderMap = perFolder[key];
    const fileKey = (baseName + suffix).toLowerCase();
    const count = folderMap[fileKey];
    if (count == null) {
      folderMap[fileKey] = 1;
      return baseName + suffix;
    }
    const next = count + 1;
    folderMap[fileKey] = next;
    return `${baseName} (${next})${suffix}`;
  };
}

/**
 * Build export payload from parsed root and script list (mirrors reference ScriptExporter logic).
 */
export function buildExportPayload(
  root: ParsedInstance,
  scripts: ParsedInstance[],
  _placeName?: string,
  onProgress?: (progress: BuildProgress) => void
): ExportPayload {
  if (scripts.length === 0) {
    const basePath = "";
    return { basePath, files: [] };
  }

  const relevant = collectPathRelevantSet(scripts, root);
  const segByInst = buildSegmentMap(relevant, root);
  const resolveUnique = makeUniqueNameResolver();
  const basePath = "";
  const files: ExportFile[] = [];
  const totalScripts = scripts.length;

  for (let i = 0; i < scripts.length; i += 1) {
    const inst = scripts[i];
    const suffix = getScriptSuffix(inst.className);
    const folderPath = getFolderPathForScript(inst, segByInst, root);
    const baseName = segByInst.get(inst) ?? sanitizePart(inst.name);
    const fileName = resolveUnique(folderPath, baseName, suffix);
    const header = `-- Exported: ${isoTimestamp()}\n-- Source: ${getFullPath(inst, root)} [${inst.className}]\n\n`;
    const content = header + (inst.source || "-- No source\n");
    const relPath = folderPath ? `${folderPath}/${fileName}` : fileName;
    files.push({ path: relPath, content });
    onProgress?.({
      percent: ((i + 1) / totalScripts) * 100,
      detail: `Building ${i + 1}/${totalScripts}: ${relPath}`,
    });
  }

  onProgress?.({
    percent: 100,
    detail: `Build complete: ${files.length} script files`,
  });
  return { basePath, files };
}
