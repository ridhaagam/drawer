import express from "express";
import { nanoid } from "nanoid";

import { ANY_CONTENT_TYPE, MAX_SHARE_LINK_BYTES } from "../config";
import { insertShareLink, selectShareLink } from "../db";
import { isValidId } from "../validate";

export const shareLinksRouter = express.Router();

const IMMUTABLE = "public, max-age=31536000, immutable";

shareLinksRouter.post(
  "/v2/post/",
  express.raw({ type: ANY_CONTENT_TYPE, limit: MAX_SHARE_LINK_BYTES }),
  (req, res) => {
    const payload = req.body as Buffer;

    if (!Buffer.isBuffer(payload) || payload.length === 0) {
      res.status(400).json({ error_class: "BadRequest" });
      return;
    }

    const id = nanoid(16);
    insertShareLink.run(id, payload, Date.now());

    res.json({ id });
  },
);

shareLinksRouter.get("/v2/:id", (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    res.status(400).end();
    return;
  }

  const row = selectShareLink.get(id);

  if (!row) {
    res.status(404).end();
    return;
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", IMMUTABLE);
  res.send(row.payload);
});
