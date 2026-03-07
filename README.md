# RBXLX Script Export

Static Vite web app that reads a Roblox `.rbxlx` / `.rbxmx` file in the browser, extracts `Script`, `LocalScript`, and `ModuleScript` source, and downloads a ZIP of exported `.lua` files.

## Features

- Client-side parsing of Roblox XML place/model files
- Streaming XML parsing to avoid building a browser DOM for large files
- Worker-based parse/build/ZIP pipeline so the UI stays responsive
- Script extraction with Roblox-style suffixes:
  - `Script` -> `.server.lua`
  - `LocalScript` -> `.client.lua`
  - `ModuleScript` -> `.module.lua`
- Path sanitization and collision-safe naming
- ZIP download generated entirely in-browser
- Single progress bar with detailed live status text
- Minimal flat dark UI

## Getting Started

```bash
npm install
npm run dev
```

Then open the local Vite URL, upload a `.rbxlx` or `.rbxmx` file, and wait for the ZIP download.

## Build

```bash
npm run build
npm run preview
```

Production output is generated in `dist/`.

## GitHub Pages

This project currently uses:

- `vite.config.ts` -> `base: "/rbxlx-script-exporter/"`

If your repository name is different, update the `base` path to match your repo.
For `username.github.io` root-site hosting, set `base: "/"`.

## Notes

- Exported files are written directly at ZIP root.
- Large files are still bounded by browser memory/CPU, but parsing and ZIP work now run off the main thread.

## License

GPL-3.0-only. See `LICENSE`.
