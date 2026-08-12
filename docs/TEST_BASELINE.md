# Test baseline

The suite is fully green. `yarn test:app --watch=false` should report zero failures; any failure is a regression.

## The five tests that used to fail

Since `0a53f8d`, the fork's first commit, these five failed on a clean checkout:

```
excalidraw-app/tests/collab.test.tsx        > should allow to undo / redo even on force-deleted elements
excalidraw-app/tests/collab.test.tsx        > should emit two ephemeral increments even though updates get batched
excalidraw-app/tests/LanguageList.test.tsx  > rerenders UI on language change
excalidraw-app/tests/MobileMenu.test.tsx    > should initialize with welcome screen and hide once user interacts
excalidraw-app/tests/MobileMenu.test.tsx    > should set editor interface correctly
```

The cause was two copies of React. The root pinned `19.2.0` and `excalidraw-app` pinned `19.0.0`, so yarn hoisted the root copy and gave the app a nested one. Components from `packages/excalidraw` then resolved a different React instance than components from `excalidraw-app`, which leaves the hooks dispatcher null: `Cannot read properties of null (reading 'useState')`, followed by `Missing Provider from createIsolation` as jotai-scope fell over behind it.

Aligning `excalidraw-app` to `19.2.0` collapses it back to one hoisted copy and all five pass.

Worth remembering, because the symptom points nowhere near the cause: if hooks start throwing on null in a test that renders app-level components, check for a second React before anything else.

```bash
ls excalidraw-app/node_modules/react   # should not exist
```

## Tests that skip rather than fail

`excalidraw-app/tests/persistence.e2e.test.ts` drives the real HTTP contract against a running `excalidraw-server` and skips itself when none is reachable. To actually run it, start the stack first:

```bash
yarn dev:selfhost
```
