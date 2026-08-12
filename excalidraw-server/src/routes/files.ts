import fs from "fs";
import path from "path";

import express from "express";

import { MAX_FILE_BYTES } from "../config";
import { resolveFilePath } from "../validate";

export const filesRouter = express.Router();

const IMMUTABLE = "public, max-age=31536000, immutable";

const splatOf = (req: express.Request) =>
  (req.params as Record<string, string>)["0"] ?? "";

filesRouter.put(
  "/files/*",
  express.raw({ type: "*/*", limit: MAX_FILE_BYTES }),
  (req, res) => {
    const target = resolveFilePath(splatOf(req));

    if (!target) {
      res.status(400).json({ error: "invalid_path" });
      return;
    }

    const payload = req.body as Buffer;

    if (!Buffer.isBuffer(payload) || payload.length === 0) {
      res.status(400).json({ error: "empty_body" });
      return;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });

    // file ids are content hashes, so an existing file is already this file.
    // Writing via a temp file keeps a concurrent reader from seeing a partial
    // one.
    if (!fs.existsSync(target)) {
      const temp = `${target}.${process.pid}.tmp`;
      fs.writeFileSync(temp, payload);
      fs.renameSync(temp, target);
    }

    res.json({ saved: true });
  },
);

filesRouter.get("/files/*", (req, res) => {
  const target = resolveFilePath(splatOf(req));

  if (!target) {
    res.status(400).json({ error: "invalid_path" });
    return;
  }

  if (!fs.existsSync(target)) {
    res.status(404).end();
    return;
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", IMMUTABLE);
  res.sendFile(target);
});
