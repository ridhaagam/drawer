# Known-failing tests

These five tests fail on a clean checkout and have done since `0a53f8d`, the first commit of this fork. They are inherited from however the fork was created, not caused by any feature work here. Verified by checking out `0a53f8d` with a clean working tree and running them in isolation.

```
excalidraw-app/tests/collab.test.tsx        > should allow to undo / redo even on force-deleted elements
excalidraw-app/tests/collab.test.tsx        > should emit two ephemeral increments even though updates get batched
excalidraw-app/tests/LanguageList.test.tsx  > rerenders UI on language change
excalidraw-app/tests/MobileMenu.test.tsx    > should initialize with welcome screen and hide once user interacts
excalidraw-app/tests/MobileMenu.test.tsx    > should set editor interface correctly
```

`LanguageList` fails with `Missing Provider from createIsolation` out of `jotai-scope`, preceded by `Cannot read properties of null (reading 'useState')`. That is a test-harness setup problem rather than product code, and it is the likely shared cause of the `MobileMenu` pair.

The pass gate for a change is therefore **exactly these five and no more**, not a green suite. Any sixth failure is a regression.

This matters most when replacing `excalidraw-app/data/firebase.ts`, since `collab.test.tsx` mocks that module by path and two of its tests are already red — "my change broke it" and "it was already broken" are otherwise indistinguishable there.
