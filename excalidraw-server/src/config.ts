import path from "path";

import dotenv from "dotenv";

dotenv.config();

const int = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const PORT = int(process.env.PORT, 3010);

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");

export const FILES_DIR = path.join(DATA_DIR, "files");

export const DB_PATH = path.join(DATA_DIR, "excalidraw.db");

export const MAX_FILE_BYTES = int(process.env.MAX_FILE_BYTES, 6 * 1024 * 1024);

export const MAX_SCENE_BYTES = int(
  process.env.MAX_SCENE_BYTES,
  24 * 1024 * 1024,
);

export const MAX_SHARE_LINK_BYTES = int(
  process.env.MAX_SHARE_LINK_BYTES,
  25 * 1024 * 1024,
);

export const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
