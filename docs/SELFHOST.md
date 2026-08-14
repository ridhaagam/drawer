# Self-hosting over Tailscale

Three services behind one origin:

```
https://<host>.<tailnet>.ts.net        tailscale serve --bg 3002
        └── nginx  (app container :80, published on :3002)
              ├── /            the built editor
              ├── /socket.io/  → collab:3005       excalidraw-room, the relay
              └── /api/        → persistence:3010  excalidraw-server, storage
```

## Why one origin and not three ports

Not cosmetic. `packages/excalidraw/data/encryption.ts` uses `window.crypto.subtle`, which only exists in a **secure context**. Serving the app over plain HTTP on a LAN or tailnet IP makes `crypto.subtle` `undefined` and collaboration cannot encrypt at all. Serving it over HTTPS but pointing the websocket at `ws://` gets that connection blocked as mixed content instead.

One HTTPS origin fixes both, and removes CORS entirely as a side effect.

## Running it

```bash
yarn selfhost                 # docker compose up -d --build
tailscale serve --bg 3002     # once; survives reboots
tailscale serve status        # confirm
```

`tailscale serve`, never `tailscale funnel`. There is no auth here; the tailnet is the security boundary, and funnel would publish it to the open internet.

HTTPS certificates must be enabled for the tailnet (Admin console → DNS → HTTPS Certificates). `tailscale status --json` listing your host under `CertDomains` means it is already on.

Collaborators need to be on your tailnet, either as invited users or via node sharing. MagicDNS then resolves the hostname for them, and the URL you send is the entire setup.

`collab` and `persistence` publish no host ports. They are reachable only through nginx, which is what enforces the single origin structurally.

## Development

```bash
yarn dev:selfhost
```

Starts the persistence server and the relay in the background, then Vite, which proxies `/api` and `/socket.io` to them so dev matches production.

Use `http://localhost:3000`. The dev server also listens on `0.0.0.0`, but reaching it by IP is not a secure context, so collaboration will not encrypt there. Put `tailscale serve` in front if you need to reach dev from another machine.

## Boards

A board is a collab room. Its scene lives in SQLite and is never expired, so reopening the link brings it back even after everyone has left.

Two things to understand about the security model:

- **The key in the URL fragment is the only credential.** There are no accounts. Anyone with the link has full read and write access, and losing the link means the board is unrecoverable ciphertext — the server cannot help, it never had the key.
- **Once a scene is a room it lives only on the server.** `Collab.tsx` pauses local saving and resets the scene before fetching, so there is no local copy to fall back on. Back up `data/`.

The board list in the main menu is stored per browser in localStorage. It is deliberately not on the server: a board name there would leak metadata that the end-to-end encryption otherwise protects.

## Drawing from an assistant (MCP)

The board can be driven from an MCP client, so an assistant draws onto the same canvas you have open. nginx proxies `/mcp/` to port 3003 on the host, which is where the canvas server from `mcp_excalidraw` listens:

```bash
cd ../mcp_excalidraw && PORT=3003 HOST=0.0.0.0 node dist/server.js
```

It runs on the host rather than in this stack so a clone of this repo still comes up without it. When nothing is listening the badge reads `MCP Disconnected` and the editor is unaffected.

The bridge routes incoming shapes through the skeleton converter, so a shape sent with a `label` arrives with its caption bound inside it rather than dropped.

**This channel has no authentication.** Anyone on the tailnet who opens the board can be drawn to by anything that can reach port 3003. That is the same trust boundary as the boards themselves, but it is a write path rather than a read one. Set `VITE_APP_ENABLE_MCP=false` at build time to leave the bridge out entirely.

## Backup

Everything is one directory:

```bash
docker compose stop persistence
sqlite3 data/excalidraw.db ".backup 'backup/excalidraw.db'"
rsync -a data/files/ backup/files/
docker compose start persistence
```

`data/excalidraw.db` holds scenes and share-link blobs; `data/files/` holds image blobs. All of it is ciphertext.

## Cutover notes

- Existing `#json=` links pointing at `json.excalidraw.com` will 404 against the new backend. Re-export anything you care about before switching.
- Existing collab rooms lived in Excalidraw's own Firebase projects, which this fork cannot administer. Open those links on the old build and save to `.excalidraw` first if they matter.
- Local scenes in localStorage and images in IndexedDB are untouched.
