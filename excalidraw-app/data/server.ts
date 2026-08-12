import { reconcileElements } from "@excalidraw/excalidraw";
import { MIME_TYPES } from "@excalidraw/common";
import {
  base64ToArrayBuffer,
  decompressData,
  stringToBase64,
  toByteString,
} from "@excalidraw/excalidraw/data/encode";
import {
  encryptData,
  decryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { getSceneVersion } from "@excalidraw/element";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import { API_BASE, FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import { getSyncableElements } from ".";

import type { SyncableExcalidrawElement } from ".";
import type Portal from "../collab/Portal";
import type { Socket } from "socket.io-client";

const MAX_SAVE_ATTEMPTS = 5;

type StoredScene = {
  revision: number;
  sceneVersion: number;
  iv: string;
  ciphertext: string;
};

const toBase64 = (bytes: Uint8Array) =>
  stringToBase64(toByteString(bytes), true);

const fromBase64 = (value: string) =>
  new Uint8Array(base64ToArrayBuffer(value));

// Collab.tsx passes `files/rooms/<id>` in one place and the prefix constant in
// another; normalising both ends means a file is read back from the path it
// was written to.
const normalizePrefix = (prefix: string) =>
  prefix.replace(/^\/+/, "").replace(/\/+$/, "");

const fileUrl = (prefix: string, id: FileId) =>
  `${API_BASE}/${normalizePrefix(prefix)}/${id}`;

const encryptElements = async (
  key: string,
  elements: readonly ExcalidrawElement[],
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
  const json = JSON.stringify(elements);
  const encoded = new TextEncoder().encode(json);
  const { encryptedBuffer, iv } = await encryptData(key, encoded);

  return { ciphertext: encryptedBuffer, iv };
};

const decryptElements = async (
  data: { iv: string; ciphertext: string },
  roomKey: string,
): Promise<readonly ExcalidrawElement[]> => {
  const decrypted = await decryptData(
    fromBase64(data.iv),
    fromBase64(data.ciphertext),
    roomKey,
  );
  const decodedData = new TextDecoder("utf-8").decode(
    new Uint8Array(decrypted),
  );
  return JSON.parse(decodedData);
};

class SceneVersionCache {
  private static cache = new WeakMap<Socket, number>();
  static get = (socket: Socket) => {
    return SceneVersionCache.cache.get(socket);
  };
  static set = (
    socket: Socket,
    elements: readonly SyncableExcalidrawElement[],
  ) => {
    SceneVersionCache.cache.set(socket, getSceneVersion(elements));
  };
}

const revisionCache = new Map<string, number>();

export const isSavedToServer = (
  portal: Portal,
  elements: readonly ExcalidrawElement[],
): boolean => {
  if (portal.socket && portal.roomId && portal.roomKey) {
    const sceneVersion = getSceneVersion(elements);

    return SceneVersionCache.get(portal.socket) === sceneVersion;
  }
  // if no room exists, consider the room saved so that we don't unnecessarily
  // prevent unload (there's nothing we could do at that point anyway)
  return true;
};

export const saveFilesToServer = async ({
  prefix,
  files,
}: {
  prefix: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const erroredFiles: FileId[] = [];
  const savedFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      try {
        const response = await fetch(fileUrl(prefix, id), {
          method: "PUT",
          headers: {
            "content-type": "application/octet-stream",
            "cache-control": `public, max-age=${FILE_CACHE_MAX_AGE_SEC}`,
          },
          body: buffer,
        });
        if (!response.ok) {
          throw new Error(`Failed to save file (${response.status})`);
        }
        savedFiles.push(id);
      } catch (error: any) {
        erroredFiles.push(id);
      }
    }),
  );

  return { savedFiles, erroredFiles };
};

export const saveToServer = async (
  portal: Portal,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  const { roomId, roomKey, socket } = portal;
  if (
    // bail if no room exists as there's nothing we can do at this point
    !roomId ||
    !roomKey ||
    !socket ||
    isSavedToServer(portal, elements)
  ) {
    return null;
  }

  let candidate = elements;

  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
    const { ciphertext, iv } = await encryptElements(roomKey, candidate);
    const revision = revisionCache.get(roomId);

    const response = await fetch(`${API_BASE}/rooms/${roomId}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(revision == null
          ? { "if-none-match": "*" }
          : { "if-match": `"${revision}"` }),
      },
      body: JSON.stringify({
        sceneVersion: getSceneVersion(candidate),
        iv: toBase64(iv),
        ciphertext: toBase64(new Uint8Array(ciphertext)),
      }),
    });

    if (response.ok) {
      const { revision: saved } = (await response.json()) as StoredScene;
      revisionCache.set(roomId, saved);

      // decrypt what we actually sent rather than reading back the in-memory
      // array, which could have mutated in the meantime
      const storedElements = getSyncableElements(
        restoreElements(
          await decryptElements(
            {
              iv: toBase64(iv),
              ciphertext: toBase64(new Uint8Array(ciphertext)),
            },
            roomKey,
          ),
          null,
        ),
      );

      SceneVersionCache.set(socket, storedElements);

      return storedElements;
    }

    if (response.status === 409) {
      const conflict = (await response.json()) as StoredScene;
      revisionCache.set(roomId, conflict.revision);

      const prevStoredElements = getSyncableElements(
        restoreElements(await decryptElements(conflict, roomKey), null),
      );

      candidate = getSyncableElements(
        reconcileElements(
          candidate,
          prevStoredElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
          appState,
        ),
      );

      continue;
    }

    // Collab.tsx regex-tests this message to pick the size-exceeded copy
    if (response.status === 413) {
      throw new Error(`Scene is longer than the allowed number of bytes`);
    }

    throw new Error(`Failed to save scene (${response.status})`);
  }

  throw new Error("Failed to save scene after repeated conflicts");
};

export const loadFromServer = async (
  roomId: string,
  roomKey: string,
  socket: Socket | null,
): Promise<readonly SyncableExcalidrawElement[] | null> => {
  const response = await fetch(`${API_BASE}/rooms/${roomId}`);

  if (!response.ok) {
    return null;
  }

  const storedScene = (await response.json()) as StoredScene;
  revisionCache.set(roomId, storedScene.revision);

  const elements = getSyncableElements(
    restoreElements(await decryptElements(storedScene, roomKey), null, {
      deleteInvisibleElements: true,
    }),
  );

  if (socket) {
    SceneVersionCache.set(socket, elements);
  }

  return elements;
};

export const loadFilesFromServer = async (
  prefix: string,
  decryptionKey: string,
  filesIds: readonly FileId[],
) => {
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(filesIds)].map(async (id) => {
      try {
        const response = await fetch(fileUrl(prefix, id));
        if (response.status < 400) {
          const arrayBuffer = await response.arrayBuffer();

          const { data, metadata } = await decompressData<BinaryFileMetadata>(
            new Uint8Array(arrayBuffer),
            {
              decryptionKey,
            },
          );

          const dataURL = new TextDecoder().decode(data) as DataURL;

          loadedFiles.push({
            mimeType: metadata.mimeType || MIME_TYPES.binary,
            id,
            dataURL,
            created: metadata?.created || Date.now(),
            lastRetrieved: metadata?.created || Date.now(),
          });
        } else {
          erroredFiles.set(id, true);
        }
      } catch (error: any) {
        erroredFiles.set(id, true);
        console.error(error);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
