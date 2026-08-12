import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import * as exportUtils from "../../scene/export";
import { API } from "../helpers/api";

const ELEMENTS = [
  API.createElement({
    type: "rectangle",
    x: 0,
    y: 0,
    width: 400,
    height: 200,
    index: "a0" as any,
  }),
] as NonDeletedExcalidrawElement[];

const BASE = {
  exportBackground: false,
  viewBackgroundColor: "#ffffff",
  files: {},
  exportPadding: 0,
};

describe("exportToSvg physical sizing", () => {
  it("defaults to unitless dimensions scaled by exportScale", async () => {
    const svg = await exportUtils.exportToSvg(
      ELEMENTS,
      { ...BASE, exportScale: 2 },
      null,
    );

    expect(svg.getAttribute("width")).toBe("800");
    expect(svg.getAttribute("height")).toBe("400");
    expect(svg.getAttribute("viewBox")).toBe("0 0 400 200");
  });

  it("emits a real physical width and derives height from the aspect ratio", async () => {
    const svg = await exportUtils.exportToSvg(
      ELEMENTS,
      { ...BASE, exportPhysicalWidth: { value: 3.25, unit: "in" } },
      null,
    );

    expect(svg.getAttribute("width")).toBe("3.25in");
    expect(svg.getAttribute("height")).toBe("1.625in");
  });

  it("leaves the viewBox alone so geometry is unchanged", async () => {
    const svg = await exportUtils.exportToSvg(
      ELEMENTS,
      { ...BASE, exportPhysicalWidth: { value: 160, unit: "mm" } },
      null,
    );

    expect(svg.getAttribute("viewBox")).toBe("0 0 400 200");
    expect(svg.getAttribute("width")).toBe("160mm");
    expect(svg.getAttribute("height")).toBe("80mm");
  });

  it("ignores a physical width of zero and falls back to exportScale", async () => {
    const svg = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...BASE,
        exportScale: 1,
        exportPhysicalWidth: { value: 0, unit: "mm" },
      },
      null,
    );

    expect(svg.getAttribute("width")).toBe("400");
  });

  it("honours export padding in the viewBox", async () => {
    const svg = await exportUtils.exportToSvg(
      ELEMENTS,
      {
        ...BASE,
        exportPadding: 20,
        exportPhysicalWidth: { value: 440, unit: "pt" },
      },
      null,
    );

    expect(svg.getAttribute("viewBox")).toBe("0 0 440 240");
    expect(svg.getAttribute("height")).toBe("240pt");
  });
});
