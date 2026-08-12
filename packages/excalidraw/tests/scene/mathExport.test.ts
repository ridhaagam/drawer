import {
  parseMathRuns,
  hasMath,
  splitPreservingMath,
} from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import * as exportUtils from "../../scene/export";
import { API } from "../helpers/api";

const BASE = {
  exportBackground: false,
  viewBackgroundColor: "#ffffff",
  files: {},
  exportPadding: 0,
};

const textElement = (text: string) =>
  API.createElement({
    type: "text",
    x: 0,
    y: 0,
    width: 300,
    height: 30,
    text,
    fontSize: 20,
    strokeColor: "#1e1e1e",
    index: "a0" as any,
  }) as NonDeletedExcalidrawElement;

describe("math parsing", () => {
  it("splits a label into text and math runs", () => {
    expect(parseMathRuns("minimize $x^2$ now")).toEqual([
      { type: "text", value: "minimize " },
      { type: "math", value: "x^2" },
      { type: "text", value: " now" },
    ]);
  });

  it("treats an escaped dollar as literal text", () => {
    expect(hasMath("costs \\$5 today")).toBe(false);
  });

  it("leaves an unclosed dollar as text", () => {
    expect(hasMath("costs $5 today")).toBe(false);
  });

  it("does not read two prices as one formula", () => {
    expect(hasMath("$5 and $10")).toBe(false);
  });

  it("still accepts a formula that is a single character", () => {
    expect(parseMathRuns("$x$")).toEqual([{ type: "math", value: "x" }]);
  });

  it("requires the formula not to be padded with spaces", () => {
    expect(hasMath("$ x^2 $")).toBe(false);
    expect(hasMath("$x^2$")).toBe(true);
  });

  it("keeps a formula as one indivisible token for wrapping", () => {
    expect(splitPreservingMath("a $\\frac{1}{N}\\sum_i x_i$ b")).toEqual([
      "a ",
      "$\\frac{1}{N}\\sum_i x_i$",
      " b",
    ]);
  });
});

describe("math in SVG export", () => {
  it("renders a formula as vector glyph paths, not as its source", async () => {
    const svg = await exportUtils.exportToSvg(
      [textElement("minimize $\\mathcal{L}_{rec}$")],
      BASE,
      null,
    );
    const markup = svg.outerHTML;

    expect(markup).toContain("<path");
    expect(markup).not.toContain("mathcal");
    expect(markup).toContain("minimize");
  });

  it("colours the formula with the element stroke", async () => {
    const svg = await exportUtils.exportToSvg(
      [
        API.createElement({
          type: "text",
          x: 0,
          y: 0,
          width: 300,
          height: 30,
          text: "$x^2$",
          fontSize: 20,
          strokeColor: "#e03131",
          index: "a0" as any,
        }) as NonDeletedExcalidrawElement,
      ],
      BASE,
      null,
    );

    expect(svg.outerHTML).toContain('color="#e03131"');
  });

  it("leaves plain text untouched", async () => {
    const svg = await exportUtils.exportToSvg(
      [textElement("no math here")],
      BASE,
      null,
    );

    expect(svg.querySelectorAll("text").length).toBe(1);
    expect(svg.querySelector("text")?.textContent).toBe("no math here");
  });
});
