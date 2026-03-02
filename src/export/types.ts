/** In-memory instance from parsed rbxlx/rbxmx (tree node). */
export interface ParsedInstance {
  className: string;
  name: string;
  source: string;
  parent: ParsedInstance | null;
  children: ParsedInstance[];
  /** XML referent for debugging; not used for export. */
  referent?: string;
}

/** Single file in the export payload. */
export interface ExportFile {
  path: string;
  content: string;
}

/** Same shape as reference server payload. */
export interface ExportPayload {
  basePath: string;
  files: ExportFile[];
}
