import type { ParsedInstance } from "./types";

const LUA_CLASSES = new Set(["Script", "LocalScript", "ModuleScript"]);

export interface ParseProgress {
  percent: number;
  detail: string;
}

function makePath(node: ParsedInstance): string {
  const parts: string[] = [node.name];
  let p = node.parent;
  while (p && p.parent) {
    parts.unshift(p.name);
    p = p.parent;
  }
  return `game.${parts.join(".")}`;
}

function getPropText(properties: Element, propName: string): string {
  for (const child of properties.children) {
    if (child.getAttribute("name") === propName) {
      const text = child.textContent ?? "";
      return text;
    }
  }
  return "";
}

function parseItem(
  itemEl: Element,
  parent: ParsedInstance | null,
  ctx?: {
    totalItems: number;
    parsedItems: number;
    onProgress?: (progress: ParseProgress) => void;
  }
): ParsedInstance {
  const className = itemEl.getAttribute("class") ?? "Unknown";
  const referent = itemEl.getAttribute("referent") ?? undefined;

  let propertiesEl: Element | null = null;
  const childItems: Element[] = [];
  for (const el of itemEl.children) {
    if (el.tagName === "Properties") {
      propertiesEl = el;
    } else if (el.tagName === "Item") {
      childItems.push(el);
    }
  }

  const name = propertiesEl ? getPropText(propertiesEl, "Name") : "";
  let source = "";
  if (LUA_CLASSES.has(className) && propertiesEl) {
    source = getPropText(propertiesEl, "Source");
  }

  const instance: ParsedInstance = {
    className,
    name: name || "(unnamed)",
    source,
    parent,
    children: [],
    referent,
  };
  if (ctx) {
    ctx.parsedItems += 1;
    ctx.onProgress?.({
      percent: (ctx.parsedItems / ctx.totalItems) * 100,
      detail: `Parsing ${ctx.parsedItems}/${ctx.totalItems}: ${instance.className} ${makePath(instance)}`,
    });
  }

  for (const childEl of childItems) {
    instance.children.push(parseItem(childEl, instance, ctx));
  }

  return instance;
}

/** Collect all instances that are Script, LocalScript, or ModuleScript (depth-first). */
function collectScripts(root: ParsedInstance): ParsedInstance[] {
  const out: ParsedInstance[] = [];
  function visit(node: ParsedInstance) {
    if (LUA_CLASSES.has(node.className)) {
      out.push(node);
    }
    for (const c of node.children) {
      visit(c);
    }
  }
  visit(root);
  return out;
}

/**
 * Parse rbxlx (or rbxmx) XML string and return the root instance plus list of all script instances.
 * Root is a synthetic "game" node that parents all top-level Item elements.
 */
export function parseRbxmx(
  xml: string,
  onProgress?: (progress: ParseProgress) => void
): { root: ParsedInstance; scripts: ParsedInstance[] } {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const roblox = doc.querySelector("roblox");
  if (!roblox) {
    throw new Error("Invalid rbxlx: no roblox root element");
  }

  const itemEls = Array.from(roblox.children).filter((el) => el.tagName === "Item");
  if (itemEls.length === 0) {
    throw new Error("Invalid rbxlx: no Item elements");
  }

  const totalItems = Math.max(1, roblox.getElementsByTagName("Item").length);
  const ctx = { totalItems, parsedItems: 0, onProgress };

  // Synthetic game root so we can preserve all top-level services/items.
  const root: ParsedInstance = {
    className: "DataModel",
    name: "game",
    source: "",
    parent: null,
    children: [],
  };
  for (const itemEl of itemEls) {
    root.children.push(parseItem(itemEl, root, ctx));
  }
  onProgress?.({
    percent: 100,
    detail: `Parsing complete: ${ctx.parsedItems} items`,
  });

  const scripts = collectScripts(root);
  return { root, scripts };
}
