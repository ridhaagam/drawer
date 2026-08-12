import fs from "fs";

import Database from "better-sqlite3";

import { DATA_DIR, DB_PATH, FILES_DIR } from "./config";

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(FILES_DIR, { recursive: true });

export const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS scenes (
    room_id       TEXT    PRIMARY KEY,
    revision      INTEGER NOT NULL,
    scene_version INTEGER NOT NULL,
    iv            BLOB    NOT NULL,
    ciphertext    BLOB    NOT NULL,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS share_links (
    id         TEXT PRIMARY KEY,
    payload    BLOB NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

export interface SceneRow {
  room_id: string;
  revision: number;
  scene_version: number;
  iv: Buffer;
  ciphertext: Buffer;
}

export const selectScene = db.prepare<[string], SceneRow>(
  "SELECT * FROM scenes WHERE room_id = ?",
);

export const insertScene = db.prepare(
  `INSERT INTO scenes
     (room_id, revision, scene_version, iv, ciphertext, created_at, updated_at)
   VALUES (?, 1, ?, ?, ?, ?, ?)
   ON CONFLICT(room_id) DO NOTHING`,
);

export const updateScene = db.prepare(
  `UPDATE scenes
      SET revision = revision + 1, scene_version = ?, iv = ?, ciphertext = ?,
          updated_at = ?
    WHERE room_id = ? AND revision = ?`,
);

export const selectShareLink = db.prepare<[string], { payload: Buffer }>(
  "SELECT payload FROM share_links WHERE id = ?",
);

export const insertShareLink = db.prepare(
  "INSERT INTO share_links (id, payload, created_at) VALUES (?, ?, ?)",
);
