import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { clearElementsForLocalStorage } from "@excalidraw/element";
import { DEFAULT_ELEMENT_PROPS, DEFAULT_FONT_FAMILY } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

export const saveUsernameToLocalStorage = (username: string) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_COLLAB,
      JSON.stringify({ username }),
    );
  } catch (error: any) {
    // Unable to access window.localStorage
    console.error(error);
  }
};

export const importUsernameFromLocalStorage = (): string | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);
    if (data) {
      return JSON.parse(data).username;
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  return null;
};

const FREEFORM_STYLE_MIGRATION = "freeform-1";

// The freeform restyle changed DEFAULT_FONT_FAMILY and
// DEFAULT_ELEMENT_PROPS.roughness, but currentItem* values are persisted per
// browser, so anyone who has already used the app keeps drawing in the old
// hand-drawn style. Rewrite those two once, then get out of the way so the
// picker still works.
const migrateStoredStyleDefaults = (savedState: string): string => {
  try {
    if (
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_STYLE_MIGRATION) ===
      FREEFORM_STYLE_MIGRATION
    ) {
      return savedState;
    }

    const parsed = JSON.parse(savedState) as Partial<AppState>;
    const migrated = JSON.stringify({
      ...parsed,
      currentItemFontFamily: DEFAULT_FONT_FAMILY,
      currentItemRoughness: DEFAULT_ELEMENT_PROPS.roughness,
    });

    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE, migrated);
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_STYLE_MIGRATION,
      FREEFORM_STYLE_MIGRATION,
    );

    return migrated;
  } catch (error: any) {
    console.error(error);
    return savedState;
  }
};

export const importFromLocalStorage = () => {
  let savedElements = null;
  let savedState = null;

  try {
    savedElements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    savedState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
    if (savedState) {
      savedState = migrateStoredStyleDefaults(savedState);
    }
  } catch (error: any) {
    // Unable to access localStorage
    console.error(error);
  }

  let elements: ExcalidrawElement[] = [];
  if (savedElements) {
    try {
      elements = clearElementsForLocalStorage(JSON.parse(savedElements));
    } catch (error: any) {
      console.error(error);
      // Do nothing because elements array is already empty
    }
  }

  let appState = null;
  if (savedState) {
    try {
      appState = {
        ...getDefaultAppState(),
        ...clearAppStateForLocalStorage(
          JSON.parse(savedState) as Partial<AppState>,
        ),
      };
    } catch (error: any) {
      console.error(error);
      // Do nothing because appState is already null
    }
  }
  return { elements, appState };
};

export const getElementsStorageSize = () => {
  try {
    const elements = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS);
    const elementsSize = elements?.length || 0;
    return elementsSize;
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};

export const getTotalStorageSize = () => {
  try {
    const appState = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE);
    const collab = localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_COLLAB);

    const appStateSize = appState?.length || 0;
    const collabSize = collab?.length || 0;

    return appStateSize + collabSize + getElementsStorageSize();
  } catch (error: any) {
    console.error(error);
    return 0;
  }
};
