import {
  DEFAULT_ELEMENT_PROPS,
  DEFAULT_FONT_FAMILY,
  FONT_FAMILY,
  ROUGHNESS,
} from "@excalidraw/common";

import { STORAGE_KEYS } from "../app_constants";
import { importFromLocalStorage } from "../data/localStorage";

const HAND_DRAWN_STATE = {
  currentItemFontFamily: FONT_FAMILY.Excalifont,
  currentItemRoughness: ROUGHNESS.artist,
  currentItemStrokeWidth: 4,
};

describe("freeform style migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("rewrites the hand-drawn defaults of an existing profile", () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(HAND_DRAWN_STATE),
    );

    const { appState } = importFromLocalStorage();

    expect(appState?.currentItemFontFamily).toBe(DEFAULT_FONT_FAMILY);
    expect(appState?.currentItemRoughness).toBe(
      DEFAULT_ELEMENT_PROPS.roughness,
    );
  });

  it("leaves unrelated persisted settings alone", () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(HAND_DRAWN_STATE),
    );

    const { appState } = importFromLocalStorage();

    expect(appState?.currentItemStrokeWidth).toBe(4);
  });

  it("runs once, so a later deliberate choice survives", () => {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(HAND_DRAWN_STATE),
    );
    importFromLocalStorage();

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify({
        ...HAND_DRAWN_STATE,
        currentItemFontFamily: FONT_FAMILY.Excalifont,
        currentItemRoughness: ROUGHNESS.cartoonist,
      }),
    );

    const { appState } = importFromLocalStorage();

    expect(appState?.currentItemFontFamily).toBe(FONT_FAMILY.Excalifont);
    expect(appState?.currentItemRoughness).toBe(ROUGHNESS.cartoonist);
  });

  it("does not touch storage when there is no saved state", () => {
    const { appState } = importFromLocalStorage();

    expect(appState).toBeNull();
    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_STYLE_MIGRATION),
    ).toBeNull();
  });
});
