import { getTextWidth, hasMath, renderMath } from "@excalidraw/element";
import { getFontString } from "@excalidraw/common";

const FONT_SIZE = 20;
const font = getFontString({ fontSize: FONT_SIZE, fontFamily: 6 });
const SOURCE = "$\\frac{1}{N}\\sum_i x_i$";

describe("editing a label that contains math", () => {
  beforeAll(async () => {
    // without this the formula is unrendered and both paths would fall back to
    // measuring the source, which would make the assertions below vacuous
    await renderMath("\\frac{1}{N}\\sum_i x_i", FONT_SIZE);
  });

  it("measures the rendered formula for the element", () => {
    expect(hasMath(SOURCE)).toBe(true);
  });

  it("gives the editor a different width than the element once rendered", () => {
    const elementWidth = getTextWidth(SOURCE, font);
    const editorWidth = getTextWidth(SOURCE, font, true);

    expect(elementWidth).toBeGreaterThan(0);
    expect(editorWidth).toBeGreaterThan(0);
    // the whole point: the editor shows `$...$` and must be sized to those
    // characters, not to the formula they render into
    expect(editorWidth).not.toBeCloseTo(elementWidth, 1);
  });

  it("leaves text without math measuring identically either way", () => {
    expect(getTextWidth("no math here", font, true)).toBe(
      getTextWidth("no math here", font, false),
    );
  });
});
