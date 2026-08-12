import express from "express";

import { MAX_SCENE_BYTES } from "../config";
import { db, insertScene, selectScene, updateScene } from "../db";
import { isValidId } from "../validate";

import type { SceneRow } from "../db";

export const roomsRouter = express.Router();

const toPayload = (row: SceneRow) => ({
  revision: row.revision,
  sceneVersion: row.scene_version,
  iv: row.iv.toString("base64"),
  ciphertext: row.ciphertext.toString("base64"),
});

const sendConflict = (res: express.Response, row: SceneRow) => {
  res.setHeader("ETag", `"${row.revision}"`);
  res.status(409).json({ error: "revision_mismatch", ...toPayload(row) });
};

roomsRouter.get("/rooms/:roomId", (req, res) => {
  const { roomId } = req.params;

  if (!isValidId(roomId)) {
    res.status(400).json({ error: "invalid_room_id" });
    return;
  }

  const row = selectScene.get(roomId);

  if (!row) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.setHeader("ETag", `"${row.revision}"`);
  res.json(toPayload(row));
});

// Firestore ran its transaction body on the client, because only the client
// holds the key and can decrypt far enough to reconcile. This server never
// sees anything but ciphertext, so concurrency is a compare-and-swap on a
// revision counter the server owns and the client echoes back. A 409 carries
// the current state so the client can reconcile and retry in one round trip.
//
// `revision` deliberately is not sceneVersion: that is a sum of element
// versions, so it is neither monotonic nor collision-free.
roomsRouter.put(
  "/rooms/:roomId",
  express.json({ limit: MAX_SCENE_BYTES }),
  (req, res) => {
    const { roomId } = req.params;

    if (!isValidId(roomId)) {
      res.status(400).json({ error: "invalid_room_id" });
      return;
    }

    const { sceneVersion, iv, ciphertext } = req.body ?? {};

    if (
      typeof sceneVersion !== "number" ||
      typeof iv !== "string" ||
      typeof ciphertext !== "string"
    ) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }

    const ifMatch = req.header("if-match");
    const ifNoneMatch = req.header("if-none-match");

    if (!ifMatch && ifNoneMatch !== "*") {
      res.status(428).json({ error: "precondition_required" });
      return;
    }

    const ivBuffer = Buffer.from(iv, "base64");
    const ciphertextBuffer = Buffer.from(ciphertext, "base64");
    const now = Date.now();

    if (ifNoneMatch === "*") {
      const created = db.transaction(() => {
        const info = insertScene.run(
          roomId,
          sceneVersion,
          ivBuffer,
          ciphertextBuffer,
          now,
          now,
        );
        return info.changes > 0 ? null : selectScene.get(roomId)!;
      })();

      if (created) {
        sendConflict(res, created);
        return;
      }

      res.setHeader("ETag", '"1"');
      res.status(201).json({ revision: 1, sceneVersion });
      return;
    }

    const expected = Number(ifMatch!.replace(/"/g, ""));

    if (!Number.isInteger(expected)) {
      res.status(400).json({ error: "invalid_if_match" });
      return;
    }

    const outcome = db.transaction(() => {
      const info = updateScene.run(
        sceneVersion,
        ivBuffer,
        ciphertextBuffer,
        now,
        roomId,
        expected,
      );
      return info.changes > 0 ? "ok" : selectScene.get(roomId);
    })();

    if (outcome === "ok") {
      const revision = expected + 1;
      res.setHeader("ETag", `"${revision}"`);
      res.json({ revision, sceneVersion });
      return;
    }

    if (!outcome) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    sendConflict(res, outcome);
  },
);
