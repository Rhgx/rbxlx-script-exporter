import { SaxesParser, type SaxesTagPlain } from "saxes";
import type { ParsedInstance } from "./types";

const LUA_CLASSES = new Set(["Script", "LocalScript", "ModuleScript"]);

export interface ParseProgress {
  percent: number;
  detail: string;
}

interface PropertyCapture {
  field: "name" | "source";
  tagName: string;
  target: ParsedInstance;
  chunks: string[];
}

function getTagAttribute(tag: SaxesTagPlain, name: string): string {
  const value = tag.attributes[name];
  return typeof value === "string" ? value : "";
}

function isLuaClass(className: string): boolean {
  return LUA_CLASSES.has(className);
}

function reportChunkProgress(
  onProgress: ((progress: ParseProgress) => void) | undefined,
  loadedBytes: number,
  totalBytes: number,
  parsedItems: number,
  scriptCount: number,
  force = false
): void {
  if (!onProgress) {
    return;
  }
  const percent = totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : 100;
  const detail = `Parsing ${parsedItems} items, found ${scriptCount} scripts`;
  onProgress({
    percent: force ? 100 : Math.min(99.9, percent),
    detail,
  });
}

/**
 * Stream-parse rbxlx/rbxmx XML and return the exporter tree plus the discovered scripts.
 * This avoids constructing a browser DOM before building the exporter tree.
 */
export async function parseRbxmxFile(
  file: Blob,
  onProgress?: (progress: ParseProgress) => void
): Promise<{ root: ParsedInstance; scripts: ParsedInstance[] }> {
  const root: ParsedInstance = {
    className: "DataModel",
    name: "game",
    source: "",
    parent: null,
    children: [],
  };
  const scripts: ParsedInstance[] = [];
  const itemStack: ParsedInstance[] = [];
  let currentPropertiesItem: ParsedInstance | null = null;
  let propertyCapture: PropertyCapture | null = null;
  let hasRobloxRoot = false;
  let parsedItems = 0;

  const parser = new SaxesParser({ xmlns: false, position: false });
  parser.on("opentag", (tag) => {
    if (tag.name === "roblox") {
      hasRobloxRoot = true;
      return;
    }

    if (tag.name === "Item") {
      const parent = itemStack[itemStack.length - 1] ?? root;
      const instance: ParsedInstance = {
        className: getTagAttribute(tag, "class") || "Unknown",
        name: "(unnamed)",
        source: "",
        parent,
        children: [],
        referent: getTagAttribute(tag, "referent") || undefined,
      };
      parent.children.push(instance);
      itemStack.push(instance);
      parsedItems += 1;
      if (isLuaClass(instance.className)) {
        scripts.push(instance);
      }
      return;
    }

    if (tag.name === "Properties") {
      currentPropertiesItem = itemStack[itemStack.length - 1] ?? null;
      return;
    }

    if (!currentPropertiesItem) {
      return;
    }

    const propertyName = getTagAttribute(tag, "name");
    if (propertyName === "Name") {
      propertyCapture = {
        field: "name",
        tagName: tag.name,
        target: currentPropertiesItem,
        chunks: [],
      };
      return;
    }

    if (propertyName === "Source" && isLuaClass(currentPropertiesItem.className)) {
      propertyCapture = {
        field: "source",
        tagName: tag.name,
        target: currentPropertiesItem,
        chunks: [],
      };
    }
  });

  parser.on("text", (text) => {
    propertyCapture?.chunks.push(text);
  });

  parser.on("cdata", (text) => {
    propertyCapture?.chunks.push(text);
  });

  parser.on("closetag", (tag) => {
    if (propertyCapture && propertyCapture.tagName === tag.name) {
      const value = propertyCapture.chunks.join("");
      if (propertyCapture.field === "name") {
        propertyCapture.target.name = value || "(unnamed)";
      } else {
        propertyCapture.target.source = value;
      }
      propertyCapture = null;
      return;
    }

    if (tag.name === "Properties") {
      currentPropertiesItem = null;
      return;
    }

    if (tag.name === "Item") {
      itemStack.pop();
    }
  });

  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8");
  let loadedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      loadedBytes += value.byteLength;
      parser.write(decoder.decode(value, { stream: true }));
      reportChunkProgress(onProgress, loadedBytes, file.size, parsedItems, scripts.length);
    }

    const finalChunk = decoder.decode();
    if (finalChunk) {
      parser.write(finalChunk);
    }
    parser.close();
  } catch (err) {
    await reader.cancel();
    throw err;
  }

  if (!hasRobloxRoot) {
    throw new Error("Invalid rbxlx: no roblox root element");
  }
  if (root.children.length === 0) {
    throw new Error("Invalid rbxlx: no Item elements");
  }

  reportChunkProgress(onProgress, file.size, file.size, parsedItems, scripts.length, true);
  return { root, scripts };
}
