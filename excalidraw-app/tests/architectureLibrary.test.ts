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

  // A label that breaks at a space is a two-line caption; one that breaks
  // inside a word means the shape is too small for it. Rejoining the wrapped
  // lines has to reproduce the source, which "conca" + "t" does not.
  it("never splits a label mid-word", () => {
    for (const item of lib) {
      for (const el of item.elements) {
        if (el.type !== "text" || !el.containerId) {
          continue;
        }
        const source: string = ((el as any).originalText ?? "")
          .replace(/\s+/g, " ")
          .trim();
        const rejoined = el.text
          .split("\n")
          .map((l) => l.trim())
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        expect(`${item.name}: ${rejoined}`).toBe(`${item.name}: ${source}`);
      }
    }
  });

  // A connector runs in the gap between two shapes, so it never overlaps one
  // horizontally -- but its lane must still sit within some shape's span, or
  // it floats free of everything it is meant to join.
  it("keeps every straight connector in line with a shape", () => {
    for (const item of lib) {
      const shapes = item.elements.filter(
        (el) => el.type !== "arrow" && el.type !== "line" && el.type !== "text",
      );
      if (!shapes.length) {
        continue;
      }
      for (const el of item.elements) {
        if (el.type !== "arrow") {
          continue;
        }
        const horizontal = Math.abs(el.height) < 2 && Math.abs(el.width) > 2;
        if (!horizontal) {
          continue;
        }
        const inLine = shapes.some(
          (s) => el.y >= s.y - 1 && el.y <= s.y + s.height + 1,
        );
        expect(`${item.name} arrow y=${Math.round(el.y)}: ${inLine}`).toBe(
          `${item.name} arrow y=${Math.round(el.y)}: true`,
        );
      }
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
