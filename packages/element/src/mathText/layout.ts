import { getLineWidth } from "../textMeasurements";

import { parseMathRuns } from "./parse";
import { getRenderedMath } from "./render";

import type { FontString } from "../types";
import type { RenderedMath } from "./render";

export type PlacedRun =
  | { type: "text"; value: string; x: number; width: number }
  | {
      type: "math";
      value: string;
      x: number;
      width: number;
      math: RenderedMath;
    }
  // math that has been parsed but not yet rendered; drawn as its source so the
  // label stays readable during the one frame before MathJax resolves
  | { type: "pending"; value: string; x: number; width: number };

export type LineLayout = {
  runs: PlacedRun[];
  width: number;
};

// Shared by the canvas and SVG renderers so the two cannot drift. Positions are
// relative to the left edge of the line; the caller decides where that is.
export const layoutMathLine = (
  line: string,
  font: FontString,
  fontSize: number,
): LineLayout => {
  const runs: PlacedRun[] = [];
  let x = 0;

  for (const run of parseMathRuns(line)) {
    if (run.type === "text") {
      const width = getLineWidth(run.value, font);
      runs.push({ type: "text", value: run.value, x, width });
      x += width;
      continue;
    }

    const math = getRenderedMath(run.value, fontSize);

    if (math) {
      runs.push({ type: "math", value: run.value, x, width: math.width, math });
      x += math.width;
    } else {
      const width = getLineWidth(run.value, font);
      runs.push({ type: "pending", value: run.value, x, width });
      x += width;
    }
  }

  return { runs, width: x };
};

// textAlign positions the whole line, so runs need a concrete left edge to lay
// out from rather than an anchor.
export const getLineStartX = (
  textAlign: string,
  elementWidth: number,
  lineWidth: number,
) => {
  if (textAlign === "center") {
    return (elementWidth - lineWidth) / 2;
  }
  if (textAlign === "right") {
    return elementWidth - lineWidth;
  }
  return 0;
};
