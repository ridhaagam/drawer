import { simplify } from "points-on-curve";

import {
  type GeometricShape,
  getClosedCurveShape,
  getCurveShape,
  getEllipseShape,
  getFreedrawShape,
  getPolygonShape,
} from "@excalidraw/utils/shape";

import {
  pointFrom,
  pointDistance,
  type LocalPoint,
  pointRotateRads,
  getBoxVertices,
  getBoxEdges,
  transformPoint,
  createRotationMatrix,
  projectTo2D,
  type Point3D,
} from "@excalidraw/math";
import {
  ROUGHNESS,
  isTransparent,
  assertNever,
  COLOR_PALETTE,
  LINE_POLYGON_POINT_MERGE_DISTANCE,
} from "@excalidraw/common";

import { RoughGenerator } from "roughjs/bin/generator";

import type { GlobalPoint } from "@excalidraw/math";

import type { Mutable } from "@excalidraw/common/utility-types";

import type {
  AppState,
  EmbedsValidationStatus,
} from "@excalidraw/excalidraw/types";
import type {
  ElementShape,
  ElementShapes,
} from "@excalidraw/excalidraw/scene/types";

import { elementWithCanvasCache } from "./renderElement";

import {
  canBecomePolygon,
  isElbowArrow,
  isEmbeddableElement,
  isIframeElement,
  isIframeLikeElement,
  isLinearElement,
} from "./typeChecks";
import { getCornerRadius, isPathALoop } from "./utils";
import { headingForPointIsHorizontal } from "./heading";

import { canChangeRoundness } from "./comparisons";
import { generateFreeDrawShape } from "./renderElement";
import {
  getArrowheadPoints,
  getCenterForBounds,
  getDiamondPoints,
  getElementAbsoluteCoords,
} from "./bounds";
import { shouldTestInside } from "./collision";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  ExcalidrawSelectionElement,
  ExcalidrawLinearElement,
  Arrowhead,
  ExcalidrawFreeDrawElement,
  ElementsMap,
  ExcalidrawLineElement,
} from "./types";

import type { Drawable, Options } from "roughjs/bin/core";
import type { Point as RoughPoint } from "roughjs/bin/geometry";

export class ShapeCache {
  private static rg = new RoughGenerator();
  private static cache = new WeakMap<ExcalidrawElement, ElementShape>();

  /**
   * Retrieves shape from cache if available. Use this only if shape
   * is optional and you have a fallback in case it's not cached.
   */
  public static get = <T extends ExcalidrawElement>(element: T) => {
    return ShapeCache.cache.get(
      element,
    ) as T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]] | undefined
      : ElementShape | undefined;
  };

  public static set = <T extends ExcalidrawElement>(
    element: T,
    shape: T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]]
      : Drawable,
  ) => ShapeCache.cache.set(element, shape);

  public static delete = (element: ExcalidrawElement) =>
    ShapeCache.cache.delete(element);

  public static destroy = () => {
    ShapeCache.cache = new WeakMap();
  };

  /**
   * Generates & caches shape for element if not already cached, otherwise
   * returns cached shape.
   */
  public static generateElementShape = <
    T extends Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
  >(
    element: T,
    renderConfig: {
      isExporting: boolean;
      canvasBackgroundColor: AppState["viewBackgroundColor"];
      embedsValidationStatus: EmbedsValidationStatus;
    } | null,
  ) => {
    // when exporting, always regenerated to guarantee the latest shape
    const cachedShape = renderConfig?.isExporting
      ? undefined
      : ShapeCache.get(element);

    // `null` indicates no rc shape applicable for this element type,
    // but it's considered a valid cache value (= do not regenerate)
    if (cachedShape !== undefined) {
      return cachedShape;
    }

    elementWithCanvasCache.delete(element);

    const shape = generateElementShape(
      element,
      ShapeCache.rg,
      renderConfig || {
        isExporting: false,
        canvasBackgroundColor: COLOR_PALETTE.white,
        embedsValidationStatus: null,
      },
    ) as T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]]
      : Drawable | null;

    ShapeCache.cache.set(element, shape);

    return shape;
  };
}

const getDashArrayDashed = (strokeWidth: number) => [8, 8 + strokeWidth];

const getDashArrayDotted = (strokeWidth: number) => [1.5, 6 + strokeWidth];

function adjustRoughness(element: ExcalidrawElement): number {
  const roughness = element.roughness;

  const maxSize = Math.max(element.width, element.height);
  const minSize = Math.min(element.width, element.height);

  // don't reduce roughness if
  if (
    // both sides relatively big
    (minSize >= 20 && maxSize >= 50) ||
    // is round & both sides above 15px
    (minSize >= 15 &&
      !!element.roundness &&
      canChangeRoundness(element.type)) ||
    // relatively long linear element
    (isLinearElement(element) && maxSize >= 50)
  ) {
    return roughness;
  }

  return Math.min(roughness / (maxSize < 10 ? 3 : 2), 2.5);
}

export const generateRoughOptions = (
  element: ExcalidrawElement,
  continuousPath = false,
): Options => {
  const options: Options = {
    seed: element.seed,
    strokeLineDash:
      element.strokeStyle === "dashed"
        ? getDashArrayDashed(element.strokeWidth)
        : element.strokeStyle === "dotted"
        ? getDashArrayDotted(element.strokeWidth)
        : undefined,
    // for non-solid strokes, disable multiStroke because it tends to make
    // dashes/dots overlay each other
    disableMultiStroke: element.strokeStyle !== "solid",
    // for non-solid strokes, increase the width a bit to make it visually
    // similar to solid strokes, because we're also disabling multiStroke
    strokeWidth:
      element.strokeStyle !== "solid"
        ? element.strokeWidth + 0.5
        : element.strokeWidth,
    // when increasing strokeWidth, we must explicitly set fillWeight and
    // hachureGap because if not specified, roughjs uses strokeWidth to
    // calculate them (and we don't want the fills to be modified)
    fillWeight: element.strokeWidth / 2,
    hachureGap: element.strokeWidth * 4,
    roughness: adjustRoughness(element),
    stroke: element.strokeColor,
    preserveVertices:
      continuousPath || element.roughness < ROUGHNESS.cartoonist,
  };

  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "ellipse": {
      options.fillStyle = element.fillStyle;
      options.fill = isTransparent(element.backgroundColor)
        ? undefined
        : element.backgroundColor;
      if (element.type === "ellipse") {
        options.curveFitting = 1;
      }
      return options;
    }
    case "cube":
    case "rectangularPrism": {
      // 3D shapes support both wireframe (transparent) and filled rendering
      if (!isTransparent(element.backgroundColor)) {
        options.fillStyle = element.fillStyle;
        options.fill = element.backgroundColor;
      }
      return options;
    }
    case "line":
    case "freedraw": {
      if (isPathALoop(element.points)) {
        options.fillStyle = element.fillStyle;
        options.fill =
          element.backgroundColor === "transparent"
            ? undefined
            : element.backgroundColor;
      }
      return options;
    }
    case "arrow":
      return options;
    default: {
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }
};

const modifyIframeLikeForRoughOptions = (
  element: NonDeletedExcalidrawElement,
  isExporting: boolean,
  embedsValidationStatus: EmbedsValidationStatus | null,
) => {
  if (
    isIframeLikeElement(element) &&
    (isExporting ||
      (isEmbeddableElement(element) &&
        embedsValidationStatus?.get(element.id) !== true)) &&
    isTransparent(element.backgroundColor) &&
    isTransparent(element.strokeColor)
  ) {
    return {
      ...element,
      roughness: 0,
      backgroundColor: "#d3d3d3",
      fillStyle: "solid",
    } as const;
  } else if (isIframeElement(element)) {
    return {
      ...element,
      strokeColor: isTransparent(element.strokeColor)
        ? "#000000"
        : element.strokeColor,
      backgroundColor: isTransparent(element.backgroundColor)
        ? "#f4f4f6"
        : element.backgroundColor,
    };
  }
  return element;
};

const getArrowheadShapes = (
  element: ExcalidrawLinearElement,
  shape: Drawable[],
  position: "start" | "end",
  arrowhead: Arrowhead,
  generator: RoughGenerator,
  options: Options,
  canvasBackgroundColor: string,
) => {
  const arrowheadPoints = getArrowheadPoints(
    element,
    shape,
    position,
    arrowhead,
  );

  if (arrowheadPoints === null) {
    return [];
  }

  const generateCrowfootOne = (
    arrowheadPoints: number[] | null,
    options: Options,
  ) => {
    if (arrowheadPoints === null) {
      return [];
    }

    const [, , x3, y3, x4, y4] = arrowheadPoints;

    return [generator.line(x3, y3, x4, y4, options)];
  };

  switch (arrowhead) {
    case "dot":
    case "circle":
    case "circle_outline": {
      const [x, y, diameter] = arrowheadPoints;

      // always use solid stroke for arrowhead
      delete options.strokeLineDash;

      return [
        generator.circle(x, y, diameter, {
          ...options,
          fill:
            arrowhead === "circle_outline"
              ? canvasBackgroundColor
              : element.strokeColor,

          fillStyle: "solid",
          stroke: element.strokeColor,
          roughness: Math.min(0.5, options.roughness || 0),
        }),
      ];
    }
    case "triangle":
    case "triangle_outline": {
      const [x, y, x2, y2, x3, y3] = arrowheadPoints;

      // always use solid stroke for arrowhead
      delete options.strokeLineDash;

      return [
        generator.polygon(
          [
            [x, y],
            [x2, y2],
            [x3, y3],
            [x, y],
          ],
          {
            ...options,
            fill:
              arrowhead === "triangle_outline"
                ? canvasBackgroundColor
                : element.strokeColor,
            fillStyle: "solid",
            roughness: Math.min(1, options.roughness || 0),
          },
        ),
      ];
    }
    case "diamond":
    case "diamond_outline": {
      const [x, y, x2, y2, x3, y3, x4, y4] = arrowheadPoints;

      // always use solid stroke for arrowhead
      delete options.strokeLineDash;

      return [
        generator.polygon(
          [
            [x, y],
            [x2, y2],
            [x3, y3],
            [x4, y4],
            [x, y],
          ],
          {
            ...options,
            fill:
              arrowhead === "diamond_outline"
                ? canvasBackgroundColor
                : element.strokeColor,
            fillStyle: "solid",
            roughness: Math.min(1, options.roughness || 0),
          },
        ),
      ];
    }
    case "crowfoot_one":
      return generateCrowfootOne(arrowheadPoints, options);
    case "bar":
    case "arrow":
    case "crowfoot_many":
    case "crowfoot_one_or_many":
    default: {
      const [x2, y2, x3, y3, x4, y4] = arrowheadPoints;

      if (element.strokeStyle === "dotted") {
        // for dotted arrows caps, reduce gap to make it more legible
        const dash = getDashArrayDotted(element.strokeWidth - 1);
        options.strokeLineDash = [dash[0], dash[1] - 1];
      } else {
        // for solid/dashed, keep solid arrow cap
        delete options.strokeLineDash;
      }
      options.roughness = Math.min(1, options.roughness || 0);
      return [
        generator.line(x3, y3, x2, y2, options),
        generator.line(x4, y4, x2, y2, options),
        ...(arrowhead === "crowfoot_one_or_many"
          ? generateCrowfootOne(
              getArrowheadPoints(element, shape, position, "crowfoot_one"),
              options,
            )
          : []),
      ];
    }
  }
};

export const generateLinearCollisionShape = (
  element: ExcalidrawLinearElement | ExcalidrawFreeDrawElement,
) => {
  const generator = new RoughGenerator();
  const options: Options = {
    seed: element.seed,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    roughness: 0,
    preserveVertices: true,
  };
  const center = getCenterForBounds(
    // Need a non-rotated center point
    element.points.reduce(
      (acc, point) => {
        return [
          Math.min(element.x + point[0], acc[0]),
          Math.min(element.y + point[1], acc[1]),
          Math.max(element.x + point[0], acc[2]),
          Math.max(element.y + point[1], acc[3]),
        ];
      },
      [Infinity, Infinity, -Infinity, -Infinity],
    ),
  );

  switch (element.type) {
    case "line":
    case "arrow": {
      // points array can be empty in the beginning, so it is important to add
      // initial position to it
      const points = element.points.length
        ? element.points
        : [pointFrom<LocalPoint>(0, 0)];

      if (isElbowArrow(element)) {
        return generator.path(generateElbowArrowShape(points, 16), options)
          .sets[0].ops;
      } else if (!element.roundness) {
        return points.map((point, idx) => {
          const p = pointRotateRads(
            pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
            center,
            element.angle,
          );

          return {
            op: idx === 0 ? "move" : "lineTo",
            data: pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
          };
        });
      }

      return generator
        .curve(points as unknown as RoughPoint[], options)
        .sets[0].ops.slice(0, element.points.length)
        .map((op, i) => {
          if (i === 0) {
            const p = pointRotateRads<GlobalPoint>(
              pointFrom<GlobalPoint>(
                element.x + op.data[0],
                element.y + op.data[1],
              ),
              center,
              element.angle,
            );

            return {
              op: "move",
              data: pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
            };
          }

          return {
            op: "bcurveTo",
            data: [
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[0],
                  element.y + op.data[1],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[2],
                  element.y + op.data[3],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[4],
                  element.y + op.data[5],
                ),
                center,
                element.angle,
              ),
            ]
              .map((p) =>
                pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
              )
              .flat(),
          };
        });
    }
    case "freedraw": {
      if (element.points.length < 2) {
        return [];
      }

      const simplifiedPoints = simplify(
        element.points as Mutable<LocalPoint[]>,
        0.75,
      );

      return generator
        .curve(simplifiedPoints as [number, number][], options)
        .sets[0].ops.slice(0, element.points.length)
        .map((op, i) => {
          if (i === 0) {
            const p = pointRotateRads<GlobalPoint>(
              pointFrom<GlobalPoint>(
                element.x + op.data[0],
                element.y + op.data[1],
              ),
              center,
              element.angle,
            );

            return {
              op: "move",
              data: pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
            };
          }

          return {
            op: "bcurveTo",
            data: [
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[0],
                  element.y + op.data[1],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[2],
                  element.y + op.data[3],
                ),
                center,
                element.angle,
              ),
              pointRotateRads(
                pointFrom<GlobalPoint>(
                  element.x + op.data[4],
                  element.y + op.data[5],
                ),
                center,
                element.angle,
              ),
            ]
              .map((p) =>
                pointFrom<LocalPoint>(p[0] - element.x, p[1] - element.y),
              )
              .flat(),
          };
        });
    }
  }
};

/**
 * Generates 3D rectangular shapes (cube or rectangular prism) as an array of line drawables
 * Uses proper isometric projection like Visio with exact 30-degree angles
 */
const generate3DRectangularShapes = (
  element: { width: number; height: number; customData?: any },
  generator: RoughGenerator,
  isCube: boolean = false,
): any[] => {
  const shape3d = element.customData?.shape3d || {};
  const rotX = shape3d.rotationX !== undefined ? shape3d.rotationX : 0;
  const rotY = shape3d.rotationY !== undefined ? shape3d.rotationY : 0;
  const rotZ = shape3d.rotationZ !== undefined ? shape3d.rotationZ : 0;
  const depth = shape3d.depth || (isCube ? element.width : element.width * 0.6);

  const w = element.width;
  const h = element.height;
  const d = depth;

  // Perfect isometric projection: 30 degree angles
  // Standard isometric uses exact mathematical ratios
  const cos30 = Math.sqrt(3) / 2; // 0.866025...
  const sin30 = 0.5;

  // Isometric projection scale factors
  const xScale = cos30;
  const yScale = sin30;

  // ISOMETRIC CUBE ALGORITHM - FIT PERFECTLY WITHIN BOUNDS
  // The shape must fit entirely within [0, w] x [0, h]

  // Strategy: Work backwards from element bounds to calculate box dimensions
  // Total projected size MUST equal (w, h)

  // For isometric projection:
  // projectedWidth = faceWidth + |depth| * cos30
  // projectedHeight = faceHeight + |depth| * sin30

  // Depth can be POSITIVE (forward) or NEGATIVE (backward):
  // - Positive depth: back face is up-right from front face
  // - Negative depth: back face is down-left from front face

  // Calculate maximum possible depth based on element size
  const maxPossibleDepthFromWidth = w / xScale;
  const maxPossibleDepthFromHeight = h / yScale;
  const maxPossibleDepth = Math.min(
    maxPossibleDepthFromWidth,
    maxPossibleDepthFromHeight,
  );

  // Clamp depth to reasonable range (can be positive or negative)
  const maxAllowedDepth = maxPossibleDepth * 0.8;
  const effectiveDepth = Math.max(
    -maxAllowedDepth,
    Math.min(maxAllowedDepth, d),
  );

  // Calculate isometric depth offsets (use absolute value for sizing)
  const depthOffsetX = Math.abs(effectiveDepth) * xScale;
  const depthOffsetY = Math.abs(effectiveDepth) * yScale;

  // Calculate face dimensions to fill remaining space
  const faceWidth = w - depthOffsetX;
  const faceHeight = h - depthOffsetY;

  // Both cube and rectangular prism use full available space
  // This ensures the shape fills the entire bounding box
  const totalWidth = faceWidth + depthOffsetX;
  const totalHeight = faceHeight + depthOffsetY;

  // Center in the element bounds
  const offsetX = (w - totalWidth) / 2;
  const offsetY = (h - totalHeight) / 2;

  // Define 8 vertices - all MUST be within [0, w] x [0, h]
  // Position depends on whether depth is positive (forward) or negative (backward)

  let v0;
  let v1;
  let v2;
  let v3;
  let v4;
  let v5;
  let v6;
  let v7;

  if (effectiveDepth >= 0) {
    // POSITIVE DEPTH (forward): back face is up-right from front face
    // Front face at bottom-left, back face at top-right

    // Front face (bottom of cube in 3D)
    v0 = { x: offsetX, y: offsetY + faceHeight + depthOffsetY }; // Front-left-bottom
    v1 = { x: offsetX + faceWidth, y: offsetY + faceHeight + depthOffsetY }; // Front-right-bottom
    v4 = { x: offsetX, y: offsetY + depthOffsetY }; // Front-left-top
    v5 = { x: offsetX + faceWidth, y: offsetY + depthOffsetY }; // Front-right-top

    // Back face (top of cube in 3D, shifted right and up)
    v3 = { x: offsetX + depthOffsetX, y: offsetY + faceHeight }; // Back-left-bottom
    v2 = { x: offsetX + faceWidth + depthOffsetX, y: offsetY + faceHeight }; // Back-right-bottom
    v7 = { x: offsetX + depthOffsetX, y: offsetY }; // Back-left-top
    v6 = { x: offsetX + faceWidth + depthOffsetX, y: offsetY }; // Back-right-top
  } else {
    // NEGATIVE DEPTH (backward): back face is down-left from front face
    // Front face at top-right, back face at bottom-left

    // Back face (now at bottom-left)
    v3 = { x: offsetX, y: offsetY + faceHeight + depthOffsetY }; // Back-left-bottom
    v2 = { x: offsetX + faceWidth, y: offsetY + faceHeight + depthOffsetY }; // Back-right-bottom
    v7 = { x: offsetX, y: offsetY + depthOffsetY }; // Back-left-top
    v6 = { x: offsetX + faceWidth, y: offsetY + depthOffsetY }; // Back-right-top

    // Front face (now at top-right)
    v0 = { x: offsetX + depthOffsetX, y: offsetY + faceHeight }; // Front-left-bottom
    v1 = { x: offsetX + faceWidth + depthOffsetX, y: offsetY + faceHeight }; // Front-right-bottom
    v4 = { x: offsetX + depthOffsetX, y: offsetY }; // Front-left-top
    v5 = { x: offsetX + faceWidth + depthOffsetX, y: offsetY }; // Front-right-top
  }

  const centeredVertices = [v0, v1, v2, v3, v4, v5, v6, v7];

  // Verify all vertices are within bounds (for debugging)
  const allWithinBounds = centeredVertices.every(
    (v) => v.x >= 0 && v.x <= w && v.y >= 0 && v.y <= h,
  );
  if (!allWithinBounds) {
    console.warn("⚠️ Some vertices outside bounds!", {
      w,
      h,
      effectiveDepth,
      vertices: centeredVertices,
      bounds: {
        minX: Math.min(...centeredVertices.map((v) => v.x)),
        maxX: Math.max(...centeredVertices.map((v) => v.x)),
        minY: Math.min(...centeredVertices.map((v) => v.y)),
        maxY: Math.max(...centeredVertices.map((v) => v.y)),
      },
    });
  }

  // Define all 12 edges
  const edges: [number, number][] = [
    // Bottom face
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    // Top face
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    // Vertical edges
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];

  // Get styling from element
  const el = element as any;
  const strokeWidth = el.strokeWidth || 2;
  const options = {
    seed: el.seed,
    strokeWidth: el.strokeStyle !== "solid" ? strokeWidth + 0.5 : strokeWidth,
    stroke: el.strokeColor || "#000000",
    roughness: adjustRoughness(el),
    strokeLineDash:
      el.strokeStyle === "dashed"
        ? getDashArrayDashed(strokeWidth)
        : el.strokeStyle === "dotted"
        ? getDashArrayDotted(strokeWidth)
        : undefined,
    disableMultiStroke: el.strokeStyle !== "solid",
  };

  // Create line shapes for each edge
  const shapes: any[] = [];

  // Check if element has roundness and calculate corner radius
  // If roundness.value is explicitly set, use it directly as the radius (clamped to reasonable limits)
  // Otherwise, fall back to the adaptive radius calculation
  const maxPossibleRadius =
    Math.min(faceWidth, faceHeight, Math.abs(effectiveDepth) * 0.5) / 2;
  const cornerRadius = el.roundness
    ? el.roundness.value !== undefined
      ? Math.min(el.roundness.value, maxPossibleRadius)
      : getCornerRadius(
          Math.min(faceWidth, faceHeight, Math.abs(effectiveDepth) * 0.5),
          el,
        )
    : 0;

  if (cornerRadius > 0) {
    // Draw faces with rounded corners using paths
    // Helper function to create a rounded face path
    const createRoundedFacePath = (
      v0: { x: number; y: number },
      v1: { x: number; y: number },
      v2: { x: number; y: number },
      v3: { x: number; y: number },
    ) => {
      const r = Math.min(
        cornerRadius,
        Math.hypot(v1.x - v0.x, v1.y - v0.y) / 3,
        Math.hypot(v2.x - v1.x, v2.y - v1.y) / 3,
        Math.hypot(v3.x - v2.x, v3.y - v2.y) / 3,
        Math.hypot(v0.x - v3.x, v0.y - v3.y) / 3,
      );

      // Calculate direction vectors for each edge
      const dir01 = {
        x: (v1.x - v0.x) / Math.hypot(v1.x - v0.x, v1.y - v0.y),
        y: (v1.y - v0.y) / Math.hypot(v1.x - v0.x, v1.y - v0.y),
      };
      const dir12 = {
        x: (v2.x - v1.x) / Math.hypot(v2.x - v1.x, v2.y - v1.y),
        y: (v2.y - v1.y) / Math.hypot(v2.x - v1.x, v2.y - v1.y),
      };
      const dir23 = {
        x: (v3.x - v2.x) / Math.hypot(v3.x - v2.x, v3.y - v2.y),
        y: (v3.y - v2.y) / Math.hypot(v3.x - v2.x, v3.y - v2.y),
      };
      const dir30 = {
        x: (v0.x - v3.x) / Math.hypot(v0.x - v3.x, v0.y - v3.y),
        y: (v0.y - v3.y) / Math.hypot(v0.x - v3.x, v0.y - v3.y),
      };

      return `
        M ${v0.x + dir01.x * r} ${v0.y + dir01.y * r}
        L ${v1.x - dir01.x * r} ${v1.y - dir01.y * r}
        Q ${v1.x} ${v1.y} ${v1.x + dir12.x * r} ${v1.y + dir12.y * r}
        L ${v2.x - dir12.x * r} ${v2.y - dir12.y * r}
        Q ${v2.x} ${v2.y} ${v2.x + dir23.x * r} ${v2.y + dir23.y * r}
        L ${v3.x - dir23.x * r} ${v3.y - dir23.y * r}
        Q ${v3.x} ${v3.y} ${v3.x + dir30.x * r} ${v3.y + dir30.y * r}
        L ${v0.x - dir30.x * r} ${v0.y - dir30.y * r}
        Q ${v0.x} ${v0.y} ${v0.x + dir01.x * r} ${v0.y + dir01.y * r}
        Z
      `;
    };

    // Draw rounded edges for visible faces
    const v = centeredVertices;

    // Front face outline (0-1-5-4)
    shapes.push(
      generator.path(createRoundedFacePath(v[0], v[1], v[5], v[4]), options),
    );

    // Top face outline (4-5-6-7)
    shapes.push(
      generator.path(createRoundedFacePath(v[4], v[5], v[6], v[7]), options),
    );

    // Right face outline (1-2-6-5)
    shapes.push(
      generator.path(createRoundedFacePath(v[1], v[2], v[6], v[5]), options),
    );
  } else {
    // Draw straight edges (original code)
    edges.forEach(([startIdx, endIdx]) => {
      const start = centeredVertices[startIdx];
      const end = centeredVertices[endIdx];

      const lineShape = generator.line(start.x, start.y, end.x, end.y, options);
      shapes.push(lineShape);
    });
  }

  // Optionally add filled faces if backgroundColor is set
  if (el.backgroundColor && !isTransparent(el.backgroundColor)) {
    // Create proper fill options for rough.js
    const faceFillOptions = {
      seed: el.seed,
      roughness: adjustRoughness(el),
      fill: el.backgroundColor,
      fillStyle: el.fillStyle || "solid",
      fillWeight: strokeWidth / 2,
      hachureGap: strokeWidth * 4,
      stroke: "none", // No stroke on faces - edges are drawn separately
      strokeWidth: 0,
    };

    // Draw ALL 6 faces of the cube for complete fill coverage
    // Vertices order: counter-clockwise when looking at each face

    // 1. Front face (0-1-5-4)
    const frontFacePoints: [number, number][] = [
      [centeredVertices[0].x, centeredVertices[0].y],
      [centeredVertices[1].x, centeredVertices[1].y],
      [centeredVertices[5].x, centeredVertices[5].y],
      [centeredVertices[4].x, centeredVertices[4].y],
    ];
    const frontFace = generator.polygon(frontFacePoints, faceFillOptions);

    // 2. Back face (3-7-6-2)
    const backFacePoints: [number, number][] = [
      [centeredVertices[3].x, centeredVertices[3].y],
      [centeredVertices[7].x, centeredVertices[7].y],
      [centeredVertices[6].x, centeredVertices[6].y],
      [centeredVertices[2].x, centeredVertices[2].y],
    ];
    const backFace = generator.polygon(backFacePoints, faceFillOptions);

    // 3. Left face (0-4-7-3)
    const leftFacePoints: [number, number][] = [
      [centeredVertices[0].x, centeredVertices[0].y],
      [centeredVertices[4].x, centeredVertices[4].y],
      [centeredVertices[7].x, centeredVertices[7].y],
      [centeredVertices[3].x, centeredVertices[3].y],
    ];
    const leftFace = generator.polygon(leftFacePoints, faceFillOptions);

    // 4. Right face (1-2-6-5)
    const rightFacePoints: [number, number][] = [
      [centeredVertices[1].x, centeredVertices[1].y],
      [centeredVertices[2].x, centeredVertices[2].y],
      [centeredVertices[6].x, centeredVertices[6].y],
      [centeredVertices[5].x, centeredVertices[5].y],
    ];
    const rightFace = generator.polygon(rightFacePoints, faceFillOptions);

    // 5. Top face (4-5-6-7)
    const topFacePoints: [number, number][] = [
      [centeredVertices[4].x, centeredVertices[4].y],
      [centeredVertices[5].x, centeredVertices[5].y],
      [centeredVertices[6].x, centeredVertices[6].y],
      [centeredVertices[7].x, centeredVertices[7].y],
    ];
    const topFace = generator.polygon(topFacePoints, faceFillOptions);

    // 6. Bottom face (0-3-2-1)
    const bottomFacePoints: [number, number][] = [
      [centeredVertices[0].x, centeredVertices[0].y],
      [centeredVertices[3].x, centeredVertices[3].y],
      [centeredVertices[2].x, centeredVertices[2].y],
      [centeredVertices[1].x, centeredVertices[1].y],
    ];
    const bottomFace = generator.polygon(bottomFacePoints, faceFillOptions);

    // Add all 6 faces at the beginning so they render behind the edges
    // Order: back to front (painter's algorithm)
    shapes.unshift(backFace);
    shapes.unshift(bottomFace);
    shapes.unshift(leftFace);
    shapes.unshift(rightFace);
    shapes.unshift(frontFace);
    shapes.unshift(topFace);
  }

  return shapes;
};

/**
 * Generates the roughjs shape for given element.
 *
 * Low-level. Use `ShapeCache.generateElementShape` instead.
 *
 * @private
 */
const generateElementShape = (
  element: Exclude<NonDeletedExcalidrawElement, ExcalidrawSelectionElement>,
  generator: RoughGenerator,
  {
    isExporting,
    canvasBackgroundColor,
    embedsValidationStatus,
  }: {
    isExporting: boolean;
    canvasBackgroundColor: string;
    embedsValidationStatus: EmbedsValidationStatus | null;
  },
): Drawable | Drawable[] | null => {
  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable": {
      let shape: ElementShapes[typeof element.type];
      // this is for rendering the stroke/bg of the embeddable, especially
      // when the src url is not set

      if (element.roundness) {
        const w = element.width;
        const h = element.height;
        const r = getCornerRadius(Math.min(w, h), element);
        shape = generator.path(
          `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${
            h - r
          } Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${
            h - r
          } L 0 ${r} Q 0 0, ${r} 0`,
          generateRoughOptions(
            modifyIframeLikeForRoughOptions(
              element,
              isExporting,
              embedsValidationStatus,
            ),
            true,
          ),
        );
      } else {
        shape = generator.rectangle(
          0,
          0,
          element.width,
          element.height,
          generateRoughOptions(
            modifyIframeLikeForRoughOptions(
              element,
              isExporting,
              embedsValidationStatus,
            ),
            false,
          ),
        );
      }
      return shape;
    }
    case "diamond": {
      let shape: ElementShapes[typeof element.type];

      const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] =
        getDiamondPoints(element);
      if (element.roundness) {
        const verticalRadius = getCornerRadius(Math.abs(topX - leftX), element);

        const horizontalRadius = getCornerRadius(
          Math.abs(rightY - topY),
          element,
        );

        shape = generator.path(
          `M ${topX + verticalRadius} ${topY + horizontalRadius} L ${
            rightX - verticalRadius
          } ${rightY - horizontalRadius}
            C ${rightX} ${rightY}, ${rightX} ${rightY}, ${
            rightX - verticalRadius
          } ${rightY + horizontalRadius}
            L ${bottomX + verticalRadius} ${bottomY - horizontalRadius}
            C ${bottomX} ${bottomY}, ${bottomX} ${bottomY}, ${
            bottomX - verticalRadius
          } ${bottomY - horizontalRadius}
            L ${leftX + verticalRadius} ${leftY + horizontalRadius}
            C ${leftX} ${leftY}, ${leftX} ${leftY}, ${leftX + verticalRadius} ${
            leftY - horizontalRadius
          }
            L ${topX - verticalRadius} ${topY + horizontalRadius}
            C ${topX} ${topY}, ${topX} ${topY}, ${topX + verticalRadius} ${
            topY + horizontalRadius
          }`,
          generateRoughOptions(element, true),
        );
      } else {
        shape = generator.polygon(
          [
            [topX, topY],
            [rightX, rightY],
            [bottomX, bottomY],
            [leftX, leftY],
          ],
          generateRoughOptions(element),
        );
      }
      return shape;
    }
    case "ellipse": {
      const shape: ElementShapes[typeof element.type] = generator.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        generateRoughOptions(element),
      );
      return shape;
    }
    case "line":
    case "arrow": {
      let shape: ElementShapes[typeof element.type];
      const options = generateRoughOptions(element);

      // points array can be empty in the beginning, so it is important to add
      // initial position to it
      const points = element.points.length
        ? element.points
        : [pointFrom<LocalPoint>(0, 0)];

      if (isElbowArrow(element)) {
        // NOTE (mtolmacs): Temporary fix for extremely big arrow shapes
        if (
          !points.every(
            (point) => Math.abs(point[0]) <= 1e6 && Math.abs(point[1]) <= 1e6,
          )
        ) {
          console.error(
            `Elbow arrow with extreme point positions detected. Arrow not rendered.`,
            element.id,
            JSON.stringify(points),
          );
          shape = [];
        } else {
          shape = [
            generator.path(
              generateElbowArrowShape(points, 16),
              generateRoughOptions(element, true),
            ),
          ];
        }
      } else if (!element.roundness) {
        // curve is always the first element
        // this simplifies finding the curve for an element
        if (options.fill) {
          shape = [
            generator.polygon(points as unknown as RoughPoint[], options),
          ];
        } else {
          shape = [
            generator.linearPath(points as unknown as RoughPoint[], options),
          ];
        }
      } else {
        shape = [generator.curve(points as unknown as RoughPoint[], options)];
      }

      // add lines only in arrow
      if (element.type === "arrow") {
        const { startArrowhead = null, endArrowhead = "arrow" } = element;

        if (startArrowhead !== null) {
          const shapes = getArrowheadShapes(
            element,
            shape,
            "start",
            startArrowhead,
            generator,
            options,
            canvasBackgroundColor,
          );
          shape.push(...shapes);
        }

        if (endArrowhead !== null) {
          if (endArrowhead === undefined) {
            // Hey, we have an old arrow here!
          }

          const shapes = getArrowheadShapes(
            element,
            shape,
            "end",
            endArrowhead,
            generator,
            options,
            canvasBackgroundColor,
          );
          shape.push(...shapes);
        }
      }
      return shape;
    }
    case "freedraw": {
      let shape: ElementShapes[typeof element.type];
      generateFreeDrawShape(element);

      if (isPathALoop(element.points)) {
        // generate rough polygon to fill freedraw shape
        const simplifiedPoints = simplify(
          element.points as Mutable<LocalPoint[]>,
          0.75,
        );
        shape = generator.curve(simplifiedPoints as [number, number][], {
          ...generateRoughOptions(element),
          stroke: "none",
        });
      } else {
        shape = null;
      }
      return shape;
    }
    case "frame":
    case "magicframe":
    case "text":
    case "image": {
      const shape: ElementShapes[typeof element.type] = null;
      // we return (and cache) `null` to make sure we don't regenerate
      // `element.canvas` on rerenders
      return shape;
    }
    case "cube": {
      const shapes = generate3DRectangularShapes(element, generator, true);
      return shapes;
    }
    case "rectangularPrism": {
      const shapes = generate3DRectangularShapes(element, generator, false);
      return shapes;
    }
    default: {
      assertNever(
        element,
        `generateElementShape(): Unimplemented type ${(element as any)?.type}`,
      );
      return null;
    }
  }
};

const generateElbowArrowShape = (
  points: readonly LocalPoint[],
  radius: number,
) => {
  const subpoints = [] as [number, number][];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const next = points[i + 1];
    const point = points[i];
    const prevIsHorizontal = headingForPointIsHorizontal(point, prev);
    const nextIsHorizontal = headingForPointIsHorizontal(next, point);
    const corner = Math.min(
      radius,
      pointDistance(points[i], next) / 2,
      pointDistance(points[i], prev) / 2,
    );

    if (prevIsHorizontal) {
      if (prev[0] < point[0]) {
        // LEFT
        subpoints.push([points[i][0] - corner, points[i][1]]);
      } else {
        // RIGHT
        subpoints.push([points[i][0] + corner, points[i][1]]);
      }
    } else if (prev[1] < point[1]) {
      // UP
      subpoints.push([points[i][0], points[i][1] - corner]);
    } else {
      subpoints.push([points[i][0], points[i][1] + corner]);
    }

    subpoints.push(points[i] as [number, number]);

    if (nextIsHorizontal) {
      if (next[0] < point[0]) {
        // LEFT
        subpoints.push([points[i][0] - corner, points[i][1]]);
      } else {
        // RIGHT
        subpoints.push([points[i][0] + corner, points[i][1]]);
      }
    } else if (next[1] < point[1]) {
      // UP
      subpoints.push([points[i][0], points[i][1] - corner]);
    } else {
      // DOWN
      subpoints.push([points[i][0], points[i][1] + corner]);
    }
  }

  const d = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < subpoints.length; i += 3) {
    d.push(`L ${subpoints[i][0]} ${subpoints[i][1]}`);
    d.push(
      `Q ${subpoints[i + 1][0]} ${subpoints[i + 1][1]}, ${
        subpoints[i + 2][0]
      } ${subpoints[i + 2][1]}`,
    );
  }
  d.push(`L ${points[points.length - 1][0]} ${points[points.length - 1][1]}`);

  return d.join(" ");
};

/**
 * get the pure geometric shape of an excalidraw elementw
 * which is then used for hit detection
 */
export const getElementShape = <Point extends GlobalPoint | LocalPoint>(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): GeometricShape<Point> => {
  switch (element.type) {
    case "rectangle":
    case "diamond":
    case "frame":
    case "magicframe":
    case "embeddable":
    case "image":
    case "iframe":
    case "text":
    case "selection":
      return getPolygonShape(element);
    case "cube":
    case "rectangularPrism":
      // 3D shapes use bounding box for hit detection
      return getPolygonShape(element as any);
    case "arrow":
    case "line": {
      const roughShape =
        ShapeCache.get(element)?.[0] ??
        ShapeCache.generateElementShape(element, null)[0];
      const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);

      return shouldTestInside(element)
        ? getClosedCurveShape<Point>(
            element,
            roughShape,
            pointFrom<Point>(element.x, element.y),
            element.angle,
            pointFrom(cx, cy),
          )
        : getCurveShape<Point>(
            roughShape,
            pointFrom<Point>(element.x, element.y),
            element.angle,
            pointFrom(cx, cy),
          );
    }

    case "ellipse":
      return getEllipseShape(element);

    case "freedraw": {
      const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);
      return getFreedrawShape(
        element,
        pointFrom(cx, cy),
        shouldTestInside(element),
      );
    }
  }
};

export const toggleLinePolygonState = (
  element: ExcalidrawLineElement,
  nextPolygonState: boolean,
): {
  polygon: ExcalidrawLineElement["polygon"];
  points: ExcalidrawLineElement["points"];
} | null => {
  const updatedPoints = [...element.points];

  if (nextPolygonState) {
    if (!canBecomePolygon(element.points)) {
      return null;
    }

    const firstPoint = updatedPoints[0];
    const lastPoint = updatedPoints[updatedPoints.length - 1];

    const distance = Math.hypot(
      firstPoint[0] - lastPoint[0],
      firstPoint[1] - lastPoint[1],
    );

    if (
      distance > LINE_POLYGON_POINT_MERGE_DISTANCE ||
      updatedPoints.length < 4
    ) {
      updatedPoints.push(pointFrom(firstPoint[0], firstPoint[1]));
    } else {
      updatedPoints[updatedPoints.length - 1] = pointFrom(
        firstPoint[0],
        firstPoint[1],
      );
    }
  }

  // TODO: satisfies ElementUpdate<ExcalidrawLineElement>
  const ret = {
    polygon: nextPolygonState,
    points: updatedPoints,
  };

  return ret;
};
