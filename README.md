# RBXLX Script Export

Static Vite web app that reads a Roblox `.rbxlx` / `.rbxmx` file in the browser, extracts `Script`, `LocalScript`, and `ModuleScript` source, and downloads a ZIP of exported `.lua` files.

No backend is required; this is intended for static hosting (including GitHub Pages).

## Features

- Client-side parsing of Roblox XML place/model files
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

- `vite.config.ts` -> `base: "/rbxmx-export/"`

If your repository name is different, update the `base` path to match your repo.
For `username.github.io` root-site hosting, set `base: "/"`.

## Notes

- Exported files are written directly at ZIP root.
- Large files are supported but may take time depending on browser memory/CPU.

## License

GPL-3.0-only. See `LICENSE`.
