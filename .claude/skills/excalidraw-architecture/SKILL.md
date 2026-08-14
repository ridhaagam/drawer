---
name: excalidraw-architecture
description: Use when the user wants an architecture, pipeline, or model diagram drawn for a paper, or asks to draw on their Excalidraw board. Draws directly onto their self-hosted board over MCP, using the bundled architecture kit and the Freeform visual style, and produces a shareable link.
---

# Drawing architecture figures on Agam's Excalidraw

The board is a self-hosted Excalidraw at **https://agam-linux.taile039d1.ts.net/**, reachable from any device on the tailnet. You can draw on it directly while the user watches.

Repo: `~/Documents/excalidraw`. MCP canvas server: `~/Documents/mcp_excalidraw`.

## Before you draw

Two things must be true, and both fail quietly:

1. **The canvas server must be running.** If nothing is on port 3003 the board's badge reads `MCP Disconnected` and your tool calls go nowhere.

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3003/api/elements   # 200 = up
   cd ~/Documents/mcp_excalidraw && PORT=3003 HOST=0.0.0.0 node dist/server.js &
   ```

2. **The board must be open in a browser.** `get_canvas_screenshot` renders through the page, so with no tab open it fails with _"No frontend client connected."_ Ask the user to open the URL, or drive your own headless tab (see Verifying).

`clear_canvas` before starting a fresh diagram — the server replays its whole store to every new tab, and stale shapes reappear.

## House style

Match what the editor already produces, or hand-drawn and generated shapes will not agree:

|                |              |
| -------------- | ------------ |
| `fontFamily`   | `6` (Nunito) |
| `roughness`    | `0`          |
| `endArrowhead` | `"triangle"` |
| `strokeWidth`  | `2`          |

Fills: blue `#a5d8ff`, orange `#ffd8a8`, teal `#b2f2bb`, violet `#d0bfff`, grey `#e9ecef`. These stay distinct in greyscale, which matters for print. Avoid pairing red with green.

## Drawing

`batch_create_elements` in one call per diagram. Give shapes explicit `id`s and bind arrows with `startElementId`/`endElementId` so they re-route when the user drags a box. Put a shape's caption in `text` — it becomes a bound label centred inside it.

```json
{
  "elements": [
    {
      "type": "rectangle",
      "id": "enc",
      "x": 200,
      "y": 200,
      "width": 200,
      "height": 90,
      "backgroundColor": "#a5d8ff",
      "strokeColor": "#1e1e1e",
      "roughness": 0,
      "strokeWidth": 2,
      "text": "Encoder",
      "fontSize": 20,
      "fontFamily": 6
    },
    {
      "type": "rectangle",
      "id": "dec",
      "x": 560,
      "y": 200,
      "width": 200,
      "height": 90,
      "backgroundColor": "#ffd8a8",
      "strokeColor": "#1e1e1e",
      "roughness": 0,
      "strokeWidth": 2,
      "text": "Decoder",
      "fontSize": 20,
      "fontFamily": 6
    },
    {
      "type": "arrow",
      "x": 410,
      "y": 245,
      "width": 140,
      "height": 0,
      "startElementId": "enc",
      "endElementId": "dec",
      "endArrowhead": "triangle",
      "strokeColor": "#1e1e1e",
      "roughness": 0,
      "strokeWidth": 2
    }
  ]
}
```

Available types are `rectangle`, `ellipse`, `diamond`, `arrow`, `line`, `text`, `freedraw`. There is no trapezoid: draw one as a closed `line` whose last point repeats the first, with `roundness: null` and a `backgroundColor`. With `roundness: {type:2}` a closed polygon curves into a blob.

## Start from the kit

The editor ships an architecture kit — `Menu → Architecture kit` installs or refreshes 38 items in the user's library. 26 primitives (conv, attention, norm, embedding, tensor cube, loss, flows) and 12 whole architectures: transformer, seq2seq with attention, scaled dot-product attention, CNN classifier, residual block, U-Net, autoencoder, GAN, diffusion, ViT, multimodal fusion, training loop.

Selecting it again **replaces** the items in place rather than duplicating them, so it is safe to re-run after any restyle.

Source of truth: `excalidraw-app/data/architectureLibrary.ts`. When a new architecture is worth keeping, add it there rather than redrawing it — layout is computed from `vstack`/`hstack` plus `arrowBetween`, so a diagram is a table of cells, not a page of coordinates. `excalidraw-app/tests/architectureLibrary.test.ts` guards it against NaN coordinates and style drift.

## Verifying — do not skip this

**Render the diagram and look at it before saying it is done.** Layout faults are invisible in the JSON and obvious in the picture: arrows that cut through boxes, skips that cross when they should run parallel, forward and reverse arrows drawn on top of each other, labels that wrap and burst their container. Every one of those has happened here.

```
mcp__excalidraw__get_canvas_screenshot
```

Then read the image. If a label wrapped, widen the box — a container grows to fit its text and swallows the arrow that was aimed at its old edge. Diamonds and ellipses have far less usable text width than their bounding box suggests.

To render without the user's tab, drive headless Chrome with `puppeteer-core` from `~/Documents/excalidraw/node_modules` (`NODE_PATH=~/Documents/excalidraw/node_modules`), seeding `localStorage` keys `excalidraw` (elements array) and `excalidraw-state` before reloading.

## Giving the user a link

Boards live per browser, so a diagram on your canvas is not something the user can open. To hand over a real URL, use the app's own share flow: click the share button, then the export-to-link button, and read the value out of `.ShareableLinkDialog input`. The result looks like:

```
https://agam-linux.taile039d1.ts.net/#json=<id>,<key>
```

**Pass on the whole URL including the fragment.** The part after `#` is the decryption key and never reaches the server, so a truncated link is unrecoverable ciphertext and nobody — including the server owner — can restore it.

## Exporting for a paper

SVG, not PNG. In the export dialog set **Width on the page** in `pt`/`mm`/`in` rather than touching Scale, which does nothing useful for SVG. Then `\includesvg[width=\columnwidth]{...}` needs no scaling factor.

Inline `$...$` LaTeX works in any text label and renders to real glyph paths, so the exported figure carries no font dependency. See `docs/PAPER_FIGURES.md`.
