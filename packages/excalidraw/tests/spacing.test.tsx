import { distributeElements } from "@excalidraw/element";
import { arrayToMap } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { API } from "./helpers/api";

const box = (x: number, width: number) =>
  API.createElement({ type: "rectangle", x, y: 0, width, height: 50 });

describe("distribute equalises the gaps, not just the positions", () => {
  it("gives differently-sized elements identical gaps", () => {
    // widths 20 / 100 / 20: equal *positions* would leave unequal gaps, so
    // this only passes if the gap accounts for each element's own width
    const elements = [box(0, 20), box(200, 100), box(400, 20)];
    const map = arrayToMap(elements as ExcalidrawElement[]);

    const result = distributeElements(
      elements as ExcalidrawElement[],
      map,
      { space: "between", axis: "x" },
      { selectedGroupIds: {}, editingGroupId: null } as any,
    ).sort((a, b) => a.x - b.x);

    const gapOne = result[1].x - (result[0].x + result[0].width);
    const gapTwo = result[2].x - (result[1].x + result[1].width);

    expect(gapOne).toBeCloseTo(gapTwo, 5);
  });

  it("leaves the outermost elements where they were", () => {
    const elements = [box(0, 20), box(130, 100), box(400, 20)];
    const map = arrayToMap(elements as ExcalidrawElement[]);

    const result = distributeElements(
      elements as ExcalidrawElement[],
      map,
      { space: "between", axis: "x" },
      { selectedGroupIds: {}, editingGroupId: null } as any,
    ).sort((a, b) => a.x - b.x);

    expect(result[0].x).toBeCloseTo(0, 5);
    expect(result[2].x + result[2].width).toBeCloseTo(420, 5);
  });
});
