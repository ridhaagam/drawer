import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";

const API = "http://localhost:3010/api";
const ROOM = `e2e${Date.now().toString(36)}`;
const KEY = "sTdLvMC_M3V8_vGa3UVRDg";

const b64 = (u8: Uint8Array) => Buffer.from(u8).toString("base64");
const un64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

const put = async (body: any, headers: Record<string, string>) =>
  fetch(`${API}/rooms/${ROOM}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const seal = async (elements: unknown) => {
  const { encryptedBuffer, iv } = await encryptData(
    KEY,
    new TextEncoder().encode(JSON.stringify(elements)),
  );
  return { iv: b64(iv), ciphertext: b64(new Uint8Array(encryptedBuffer)) };
};

const open = async (data: { iv: string; ciphertext: string }) =>
  JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(
        await decryptData(un64(data.iv), un64(data.ciphertext), KEY),
      ),
    ),
  );

// Exercises the real HTTP contract against a running excalidraw-server, so it
// is skipped unless one is up. Start the stack with `yarn dev:selfhost`, or
// just the server, then run this file.
const serverIsUp = await fetch(`${API}/health`)
  .then((response) => response.ok)
  .catch(() => false);

const suite = serverIsUp ? describe : describe.skip;

suite("persistence against a live server", () => {
  it("round-trips an encrypted scene the server cannot read", async () => {
    const scene = [{ id: "a", type: "rectangle", secret: "encoder block" }];

    const created = await put(
      { sceneVersion: 1, ...(await seal(scene)) },
      { "if-none-match": "*" },
    );
    expect(created.status).toBe(201);

    // everyone leaves; a fresh client with only the link comes back
    const reopened = await fetch(`${API}/rooms/${ROOM}`);
    expect(reopened.status).toBe(200);
    const stored = await reopened.json();

    expect(await open(stored)).toEqual(scene);

    // the server stored ciphertext, not the scene
    expect(Buffer.from(stored.ciphertext, "base64").toString()).not.toContain(
      "encoder block",
    );
  });

  it("rejects a stale write and hands back the current state to reconcile", async () => {
    const first = await put(
      { sceneVersion: 2, ...(await seal([{ id: "b" }])) },
      { "if-match": '"1"' },
    );
    expect(first.status).toBe(200);
    expect((await first.json()).revision).toBe(2);

    const stale = await put(
      { sceneVersion: 3, ...(await seal([{ id: "c" }])) },
      { "if-match": '"1"' },
    );
    expect(stale.status).toBe(409);
    const conflict = await stale.json();
    expect(conflict.revision).toBe(2);
    expect(await open(conflict)).toEqual([{ id: "b" }]);
  });

  it("round-trips an image blob at the prefix the app uses", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const url = `${API}/files/rooms/${ROOM}/img1`;

    const saved = await fetch(url, { method: "PUT", body: bytes });
    expect(saved.status).toBe(200);

    const loaded = await fetch(url);
    expect(loaded.status).toBe(200);
    expect(new Uint8Array(await loaded.arrayBuffer())).toEqual(bytes);
  });

  it("round-trips a share link blob", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const posted = await fetch(`${API}/v2/post/`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: payload,
    });
    expect(posted.status).toBe(200);
    const { id } = await posted.json();
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);

    const fetched = await fetch(`${API}/v2/${id}`);
    expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(payload);
  });
});
