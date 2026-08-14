import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import {
  COLOR_PALETTE,
  CUBE_DEPTH_RATIO,
  DEFAULT_ARROWHEAD,
  FONT_FAMILY,
  ROUGHNESS,
} from "@excalidraw/common";

import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { LibraryItems } from "@excalidraw/excalidraw/types";

// Every property is written out rather than left to the defaults. Library items
// have to look the same in a year, and restore.ts fills anything missing from
// DEFAULT_ELEMENT_PROPS at load time, so an omitted property silently tracks
// whatever the default has become.
const BASE = {
  strokeColor: COLOR_PALETTE.black,
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: ROUGHNESS.architect,
  opacity: 100,
} as const;

const LABEL = {
  fontSize: 16,
  fontFamily: FONT_FAMILY.Nunito,
  strokeColor: COLOR_PALETTE.black,
} as const;

const TINT = {
  blue: COLOR_PALETTE.blue[1],
  orange: COLOR_PALETTE.orange[1],
  teal: COLOR_PALETTE.teal[1],
  violet: COLOR_PALETTE.violet[1],
  gray: COLOR_PALETTE.gray[1],
} as const;

const block = (
  text: string,
  backgroundColor: string,
  width = 150,
  height = 60,
): ExcalidrawElementSkeleton[] => [
  {
    type: "rectangle",
    x: 0,
    y: 0,
    width,
    height,
    backgroundColor,
    roundness: { type: 3 },
    label: { text, ...LABEL },
    ...BASE,
  },
];

// Three offset copies read as "repeated N times" without needing a caption for
// it; the label sits on the frontmost layer.
const stack = (
  text: string,
  backgroundColor: string,
): ExcalidrawElementSkeleton[] => [
  {
    type: "rectangle",
    x: 16,
    y: -16,
    width: 140,
    height: 52,
    backgroundColor,
    roundness: { type: 3 },
    ...BASE,
  },
  {
    type: "rectangle",
    x: 8,
    y: -8,
    width: 140,
    height: 52,
    backgroundColor,
    roundness: { type: 3 },
    ...BASE,
  },
  {
    type: "rectangle",
    x: 0,
    y: 0,
    width: 140,
    height: 52,
    backgroundColor,
    roundness: { type: 3 },
    label: { text, ...LABEL },
    ...BASE,
  },
];

const ITEMS: { name: string; skeleton: ExcalidrawElementSkeleton[] }[] = [
  { name: "Conv block", skeleton: block("Conv 3×3", TINT.blue) },
  { name: "Linear / MLP", skeleton: block("Linear", TINT.teal) },
  { name: "Transformer block", skeleton: block("Transformer", TINT.violet) },
  { name: "Attention head", skeleton: block("Self-Attention", TINT.orange) },
  {
    name: "Normalisation",
    skeleton: block("LayerNorm", TINT.gray, 150, 44),
  },
  { name: "Encoder stack", skeleton: stack("Encoder ×N", TINT.blue) },
  { name: "Decoder stack", skeleton: stack("Decoder ×N", TINT.orange) },
  {
    name: "Tensor",
    skeleton: [
      {
        type: "cube",
        x: 0,
        y: 0,
        width: 90,
        height: 90,
        backgroundColor: TINT.violet,
        depth: 90 * CUBE_DEPTH_RATIO,
        ...BASE,
      } as ExcalidrawElementSkeleton,
      {
        type: "text",
        x: 0,
        y: 100,
        text: "B × C × H × W",
        ...LABEL,
      },
    ],
  },
  {
    name: "Input",
    skeleton: [
      {
        type: "ellipse",
        x: 0,
        y: 0,
        width: 120,
        height: 56,
        backgroundColor: TINT.gray,
        label: { text: "Input", ...LABEL },
        ...BASE,
      },
    ],
  },
  {
    name: "Loss",
    skeleton: [
      {
        type: "diamond",
        x: 0,
        y: 0,
        width: 130,
        height: 76,
        backgroundColor: TINT.orange,
        label: { text: "$\\mathcal{L}$", ...LABEL },
        ...BASE,
      },
    ],
  },
  {
    name: "Data flow",
    skeleton: [
      {
        type: "arrow",
        x: 0,
        y: 0,
        width: 100,
        height: 0,
        endArrowhead: DEFAULT_ARROWHEAD,
        ...BASE,
      },
    ],
  },
  {
    name: "Skip connection",
    skeleton: [
      {
        type: "arrow",
        x: 0,
        y: 0,
        points: [
          [0, 0],
          [60, -56],
          [130, 0],
        ] as any,
        endArrowhead: DEFAULT_ARROWHEAD,
        ...BASE,
        strokeStyle: "dashed",
      } as ExcalidrawElementSkeleton,
    ],
  },
];

export const buildArchitectureLibrary = (): LibraryItems =>
  ITEMS.map((item, index) => ({
    id: `architecture-kit-${index}`,
    status: "unpublished" as const,
    created: 0,
    name: item.name,
    elements: convertToExcalidrawElements(
      item.skeleton,
    ) as LibraryItems[number]["elements"],
  }));
