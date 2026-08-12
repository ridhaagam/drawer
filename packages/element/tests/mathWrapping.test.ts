import { getFontString } from "@excalidraw/common";

import { wrapText } from "../src/textWrapping";

const font = getFontString({ fontSize: 20, fontFamily: 6 });

describe("wrapping text that contains math", () => {
  it("never splits a formula, even when it does not fit", () => {
    const wrapped = wrapText("$\\mathcal{L}_{recon}$", font, 30);

    // it may sit on its own line and overflow, but it must stay parseable
    expect(wrapped).toContain("$\\mathcal{L}_{recon}$");
    expect(wrapped.split("\n").some((line) => line.includes("$\\mat\n"))).toBe(
      false,
    );
  });

  it("keeps the formula whole while still wrapping the words around it", () => {
    const wrapped = wrapText(
      "minimize $\\mathcal{L}$ over the training set",
      font,
      120,
    );

    expect(wrapped).toContain("$\\mathcal{L}$");
    expect(wrapped.split("\n").length).toBeGreaterThan(1);
  });

  it("leaves ordinary long words wrapping as before", () => {
    const wrapped = wrapText("supercalifragilistic", font, 40);

    expect(wrapped.split("\n").length).toBeGreaterThan(1);
  });
});
