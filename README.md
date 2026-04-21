# RBXLX Script Export

[![License](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/built%20with-Vite-646CFF.svg)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg)](https://www.typescriptlang.org/)
[![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-222.svg)](https://pages.github.com/)

Static web app that extracts `Script`, `LocalScript`, and `ModuleScript` source from a Roblox `.rbxlx` / `.rbxmx` file entirely in your browser, then downloads the results as a ZIP.

---

## Features

- Client-side parsing of Roblox XML place/model files
- Streaming XML parser — no full DOM built for large files
- Worker-based parse / build / ZIP pipeline keeps the UI responsive
- Roblox-style script suffixes:
  - `Script` -> `.server.lua`
  - `LocalScript` -> `.client.lua`
  - `ModuleScript` -> `.module.lua`
- Path sanitization and collision-safe naming
- In-browser ZIP generation
- Live progress bar with detailed status
- Minimal flat dark UI

## Getting Started

```bash
npm install
npm run dev
```

Open the Vite dev URL, upload a `.rbxlx` or `.rbxmx` file, and the ZIP will download when processing completes.

## Build

```bash
npm run build
npm run preview
```

Production output is written to `dist/`.

## GitHub Pages

The `base` path is set in `vite.config.ts`:

```ts
base: "/rbxlx-script-exporter/";
```

- For a project page, change this to match your repository name.
- For a root site (`username.github.io`), set `base: "/"`.

## Notes

- Exported files are placed at the ZIP root.
- Performance is still bounded by browser memory and CPU, but the heavy work runs off the main thread.

## License

Licensed under **GPL-3.0-only**. See [`LICENSE`](LICENSE) for details.
