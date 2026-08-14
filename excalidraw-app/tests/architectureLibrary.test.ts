import { FONT_FAMILY, ROUGHNESS } from "@excalidraw/common";

import { buildArchitectureLibrary } from "../data/architectureLibrary";

const lib = buildArchitectureLibrary();

describe("architecture kit", () => {
  it("builds every item", () => {
    expect(lib.length).toBeGreaterThan(30);
    for (const item of lib) {
      expect(item.elements.length).toBeGreaterThan(0);
    }
  });

  it("has unique item ids and names", () => {
    expect(new Set(lib.map((i) => i.id)).size).toBe(lib.length);
    expect(new Set(lib.map((i) => i.name)).size).toBe(lib.length);
  });

  // Layout is arithmetic over stacks, so a bad offset shows up as NaN long
  // before anyone notices the picture is wrong.
  it("places every element at a finite coordinate", () => {
    for (const item of lib) {
      for (const el of item.elements) {
        expect([el.x, el.y, el.width, el.height].every(Number.isFinite)).toBe(
          true,
        );
        expect(el.width).toBeGreaterThanOrEqual(0);
        expect(el.height).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("draws in the freeform style rather than inheriting defaults", () => {
    for (const item of lib) {
      for (const el of item.elements) {
        expect(el.roughness).toBe(ROUGHNESS.architect);
        if (el.type === "text") {
          expect(el.fontFamily).toBe(FONT_FAMILY.Nunito);
        }
      }
    }
  });

  it("gives every shape in an assembled diagram the same group", () => {
    for (const item of lib) {
      const groups = new Set(
        item.elements.flatMap((el) => el.groupIds).filter(Boolean),
      );
      expect(groups.size).toBeLessThanOrEqual(1);
    }
  });

  it("binds each arrow's label-bearing shapes so text stays inside", () => {
    for (const item of lib) {
      const containers = item.elements.filter((el) =>
        el.boundElements?.some((b) => b.type === "text"),
      );
      for (const c of containers) {
        const textId = c.boundElements!.find((b) => b.type === "text")!.id;
        const text = item.elements.find((el) => el.id === textId);
        expect(text).toBeDefined();
        expect((text as any).containerId).toBe(c.id);
      }
    }
  });
});
