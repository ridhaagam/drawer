import path from "path";

import { FILES_DIR } from "./config";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const SEGMENT = /^[A-Za-z0-9_-]{1,255}$/;
const PREFIXES = new Set(["rooms", "shareLinks", "migrations"]);

export const isValidId = (value: string) => ID.test(value);

// Every path the client asks for is built from a fixed prefix plus ids that are
// already constrained to base64url. Refusing anything else is what keeps `..`
// and absolute paths out; the resolve check below is the second lock.
export const resolveFilePath = (splat: string): string | null => {
  const segments = splat.split("/").filter((segment) => segment.length > 0);

  if (segments.length < 2 || segments.length > 4) {
    return null;
  }

  if (!PREFIXES.has(segments[0])) {
    return null;
  }

  if (!segments.every((segment) => SEGMENT.test(segment))) {
    return null;
  }

  const resolved = path.resolve(FILES_DIR, ...segments);

  if (resolved !== path.join(FILES_DIR, ...segments)) {
    return null;
  }

  return resolved;
};
