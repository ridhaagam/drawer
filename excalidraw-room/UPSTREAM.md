# excalidraw-room

Vendored from https://github.com/excalidraw/excalidraw-room at commit
`03ff435860b508d7cd9e005cfc90f7977ae2a593` ("Barnabasmolnar/follow mode (#361)").

It was previously a bare gitlink with no `.gitmodules`, so a fresh clone of this
repo got an empty directory and `git submodule update --init` failed. It also
carried local modifications that existed in no repository's history. Vendoring
makes both the code and those changes ordinary, reviewable files.

Local changes against upstream:

- `src/index.ts` binds `0.0.0.0` rather than the default. Required in Docker,
  where the default bind only serves the container's loopback.
- `Dockerfile` moves to `node:20-alpine`, uses npm instead of yarn, and exposes
  3005.
- `tsconfig.json` targets es2020/commonjs, sets `rootDir`, and excludes the
  parent `node_modules` so the monorepo's types do not leak in.
- `yarn.lock` is replaced by `package-lock.json`; this service builds standalone
  with npm rather than through the monorepo's yarn workspaces.

To diff against upstream later, clone it separately at that commit and compare.
