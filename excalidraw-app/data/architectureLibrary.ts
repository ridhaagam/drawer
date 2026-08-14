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

const SMALL = { ...LABEL, fontSize: 13 } as const;

const TINT = {
  blue: COLOR_PALETTE.blue[1],
  orange: COLOR_PALETTE.orange[1],
  teal: COLOR_PALETTE.teal[1],
  violet: COLOR_PALETTE.violet[1],
  green: COLOR_PALETTE.green[1],
  yellow: COLOR_PALETTE.yellow[1],
  pink: COLOR_PALETTE.pink[1],
  gray: COLOR_PALETTE.gray[1],
} as const;

type Shape = "rectangle" | "ellipse" | "diamond";

type Node = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Cell = {
  text: string;
  fill: string;
  h?: number;
  w?: number;
  shape?: Shape;
  fontSize?: number;
};

const node = (
  n: Node & { text: string; fill: string; shape?: Shape; fontSize?: number },
  group?: string,
): ExcalidrawElementSkeleton =>
  ({
    type: n.shape ?? "rectangle",
    id: n.id,
    x: n.x,
    y: n.y,
    width: n.w,
    height: n.h,
    backgroundColor: n.fill,
    roundness: n.shape === "rectangle" || !n.shape ? { type: 3 } : null,
    label: { text: n.text, ...LABEL, fontSize: n.fontSize ?? LABEL.fontSize },
    ...BASE,
    ...(group ? { groupIds: [group] } : {}),
  } as ExcalidrawElementSkeleton);

// Layout is computed rather than hand-placed. Every diagram below is a few
// stacks plus connections between named nodes, so a misplaced box is a wrong
// number in one row instead of a coordinate that drifted out of step with its
// neighbours.
const vstack = (
  prefix: string,
  x: number,
  topY: number,
  width: number,
  cells: Cell[],
  gap = 44,
): Node[] => {
  const out: Node[] = [];
  let y = topY;
  cells.forEach((c, i) => {
    const h = c.h ?? 52;
    const w = c.w ?? width;
    out.push({ id: `${prefix}${i}`, x: x + (width - w) / 2, y, w, h });
    y += h + gap;
  });
  return out;
};

const hstack = (
  prefix: string,
  leftX: number,
  y: number,
  height: number,
  cells: Cell[],
  gap = 46,
): Node[] => {
  const out: Node[] = [];
  let x = leftX;
  cells.forEach((c, i) => {
    const w = c.w ?? 130;
    const h = c.h ?? height;
    out.push({ id: `${prefix}${i}`, x, y: y + (height - h) / 2, w, h });
    x += w + gap;
  });
  return out;
};

const nodes = (
  ns: Node[],
  cells: Cell[],
  group?: string,
): ExcalidrawElementSkeleton[] =>
  ns.map((n, i) =>
    node(
      {
        ...n,
        text: cells[i].text,
        fill: cells[i].fill,
        shape: cells[i].shape,
        fontSize: cells[i].fontSize,
      },
      group,
    ),
  );

const GAP = 6;

// Arrow geometry is computed as well as bound. Binding alone leaves the arrow
// wherever its skeleton put it until something nudges it, so the drawn points
// have to be right on their own; the binding is what keeps them right after the
// user drags a box.
const arrowBetween = (
  a: Node,
  b: Node,
  group?: string,
  extra: Record<string, unknown> = {},
  // Fraction along the shared edge. Two arrows converging on one box both
  // aim at its centre by default, so their heads land on top of each other.
  ports: { from?: number; to?: number } = {},
): ExcalidrawElementSkeleton => {
  // Which way the arrow leaves is decided by the gap between the two boxes,
  // not by the distance between their centres. Centres put a box that sits
  // just below but slightly offset on the horizontal branch, and the arrow
  // then leaves sideways and cuts back across its own source.
  const yGap = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const xGap = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const vertical = yGap > xGap;
  let x1;
  let y1;
  let x2;
  let y2;

  if (vertical) {
    x1 = a.x + a.w * (ports.from ?? 0.5);
    x2 = b.x + b.w * (ports.to ?? 0.5);
    const down = b.y > a.y;
    y1 = down ? a.y + a.h + GAP : a.y - GAP;
    y2 = down ? b.y - GAP : b.y + b.h + GAP;
  } else {
    y1 = a.y + a.h * (ports.from ?? 0.5);
    y2 = b.y + b.h * (ports.to ?? 0.5);
    const right = b.x > a.x;
    x1 = right ? a.x + a.w + GAP : a.x - GAP;
    x2 = right ? b.x - GAP : b.x + b.w + GAP;
  }

  return {
    type: "arrow",
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
    points: [
      [0, 0],
      [x2 - x1, y2 - y1],
    ],
    start: { id: a.id },
    end: { id: b.id },
    endArrowhead: DEFAULT_ARROWHEAD,
    ...BASE,
    ...(group ? { groupIds: [group] } : {}),
    ...extra,
  } as unknown as ExcalidrawElementSkeleton;
};

const chain = (
  ns: Node[],
  group?: string,
  extra: Record<string, unknown> = {},
): ExcalidrawElementSkeleton[] =>
  ns.slice(0, -1).map((n, i) => arrowBetween(n, ns[i + 1], group, extra));

const caption = (
  x: number,
  y: number,
  text: string,
  group?: string,
  opts: Record<string, unknown> = {},
): ExcalidrawElementSkeleton =>
  ({
    type: "text",
    x,
    y,
    text,
    ...SMALL,
    strokeColor: COLOR_PALETTE.gray[4],
    ...(group ? { groupIds: [group] } : {}),
    ...opts,
  } as ExcalidrawElementSkeleton);

const title = (
  x: number,
  y: number,
  text: string,
  group?: string,
): ExcalidrawElementSkeleton =>
  ({
    type: "text",
    x,
    y,
    text,
    ...LABEL,
    fontSize: 20,
    ...(group ? { groupIds: [group] } : {}),
  } as ExcalidrawElementSkeleton);

// A dashed frame drawn behind a run of blocks, for the "repeated N times"
// convention. It is a plain rectangle, so the user can drag or delete it.
const frame = (
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  group?: string,
): ExcalidrawElementSkeleton[] => [
  {
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    backgroundColor: "transparent",
    roundness: { type: 3 },
    ...BASE,
    strokeStyle: "dashed",
    strokeColor: COLOR_PALETTE.gray[4],
    ...(group ? { groupIds: [group] } : {}),
  } as ExcalidrawElementSkeleton,
  caption(x + w + 10, y + h / 2 - 9, text, group),
];

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

const block = (
  text: string,
  fill: string,
  w = 150,
  h = 60,
): ExcalidrawElementSkeleton[] => [
  node({ id: "b", x: 0, y: 0, w, h, text, fill }),
];

const shaped = (
  text: string,
  fill: string,
  shape: Shape,
  w = 140,
  h = 70,
): ExcalidrawElementSkeleton[] => [
  node({ id: "s", x: 0, y: 0, w, h, text, fill, shape }),
];

// Three offset copies read as "repeated N times" without needing a caption for
// it; the label sits on the frontmost layer.
const deck = (text: string, fill: string): ExcalidrawElementSkeleton[] => [
  {
    type: "rectangle",
    x: 16,
    y: -16,
    width: 140,
    height: 52,
    backgroundColor: fill,
    roundness: { type: 3 },
    ...BASE,
  },
  {
    type: "rectangle",
    x: 8,
    y: -8,
    width: 140,
    height: 52,
    backgroundColor: fill,
    roundness: { type: 3 },
    ...BASE,
  },
  node({ id: "d", x: 0, y: 0, w: 140, h: 52, text, fill }),
];

const tensorCube = (
  size: number,
  fill: string,
  label: string,
): ExcalidrawElementSkeleton[] => [
  {
    type: "cube",
    x: 0,
    y: 0,
    width: size,
    height: size,
    backgroundColor: fill,
    depth: size * CUBE_DEPTH_RATIO,
    ...BASE,
  } as ExcalidrawElementSkeleton,
  { type: "text", x: 0, y: size + 12, text: label, ...LABEL },
];

const featureMaps = (): ExcalidrawElementSkeleton[] => {
  const out: ExcalidrawElementSkeleton[] = [];
  for (let i = 0; i < 4; i++) {
    out.push({
      type: "rectangle",
      x: i * 14,
      y: -i * 10,
      width: 70,
      height: 70,
      backgroundColor: TINT.teal,
      roundness: null,
      ...BASE,
    } as ExcalidrawElementSkeleton);
  }
  out.push({ type: "text", x: 0, y: 92, text: "feature maps", ...SMALL });
  return out;
};

/* ------------------------------------------------------------------ *
 * Architectures
 * ------------------------------------------------------------------ */

const transformer = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-transformer";
  const W = 240;
  const encX = 0;
  const decX = 400;

  const encCells: Cell[] = [
    { text: "Inputs", fill: TINT.gray, shape: "ellipse", h: 64 },
    { text: "Input Embedding", fill: TINT.gray },
    { text: "+ Positional Encoding", fill: TINT.gray, fontSize: 14 },
    { text: "Multi-Head Attention", fill: TINT.orange, fontSize: 14 },
    { text: "Add & Norm", fill: TINT.blue, h: 44 },
    { text: "Feed Forward", fill: TINT.teal },
    { text: "Add & Norm", fill: TINT.blue, h: 44 },
  ];
  const decCells: Cell[] = [
    { text: "Outputs (shifted)", fill: TINT.gray, shape: "ellipse", h: 64 },
    { text: "Output Embedding", fill: TINT.gray },
    { text: "+ Positional Encoding", fill: TINT.gray, fontSize: 14 },
    { text: "Masked Multi-Head Attn", fill: TINT.orange, fontSize: 13 },
    { text: "Add & Norm", fill: TINT.blue, h: 44 },
    { text: "Multi-Head Attention", fill: TINT.orange, fontSize: 14 },
    { text: "Add & Norm", fill: TINT.blue, h: 44 },
    { text: "Feed Forward", fill: TINT.teal },
    { text: "Add & Norm", fill: TINT.blue, h: 44 },
    { text: "Linear", fill: TINT.violet, h: 44 },
    { text: "Softmax", fill: TINT.violet, h: 44 },
    { text: "Output Probabilities", fill: TINT.green, shape: "ellipse", h: 72 },
  ];

  const enc = vstack("te", encX, 60, W, encCells);
  const dec = vstack("td", decX, 60, W, decCells);

  const encBottom = enc[enc.length - 1];
  const cross = dec[5];

  return [
    title(encX, 10, "Transformer", g),
    ...nodes(enc, encCells, g),
    ...nodes(dec, decCells, g),
    ...chain(enc, g),
    ...chain(dec, g),
    arrowBetween(encBottom, cross, g, { strokeStyle: "dashed" }),
    ...frame(
      encX - 16,
      enc[3].y - 14,
      W + 32,
      encBottom.y + encBottom.h - enc[3].y + 28,
      "N×",
      g,
    ),
    ...frame(
      decX - 16,
      dec[3].y - 14,
      W + 32,
      dec[8].y + dec[8].h - dec[3].y + 28,
      "N×",
      g,
    ),
  ];
};

const seq2seq = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-seq2seq";
  const cells: Cell[] = [
    { text: "Source tokens", fill: TINT.gray, w: 140 },
    { text: "Encoder RNN", fill: TINT.blue, w: 140 },
    {
      text: "Attention",
      fill: TINT.orange,
      w: 250,
      shape: "diamond",
      h: 116,
      fontSize: 15,
    },
    { text: "Decoder RNN", fill: TINT.teal, w: 140 },
    { text: "Target tokens", fill: TINT.green, w: 140 },
  ];
  const row = hstack("s2s", 0, 80, 68, cells);

  // A dashed encoder-to-decoder arrow would run straight through the attention
  // diamond and strike out its label. The path through attention already says
  // the same thing, so the caption carries it instead.
  return [
    title(0, 20, "Seq2seq with attention", g),
    ...nodes(row, cells, g),
    ...chain(row, g),
    caption(row[2].x + 30, row[2].y + row[2].h + 12, "context vector", g),
  ];
};

const cnnPipeline = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-cnn";
  const cells: Cell[] = [
    { text: "Image", fill: TINT.gray, w: 110 },
    { text: "Conv 3×3", fill: TINT.blue, w: 120 },
    { text: "Pool", fill: TINT.teal, w: 90 },
    { text: "Conv 3×3", fill: TINT.blue, w: 120 },
    { text: "Pool", fill: TINT.teal, w: 90 },
    { text: "FC", fill: TINT.violet, w: 90 },
    { text: "Softmax", fill: TINT.green, w: 110 },
  ];
  const row = hstack("cnn", 0, 60, 60, cells, 34);
  return [
    title(0, 10, "CNN classifier", g),
    ...nodes(row, cells, g),
    ...chain(row, g),
  ];
};

const residualBlock = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-resnet";
  const cells: Cell[] = [
    { text: "x", fill: TINT.gray, w: 90, shape: "ellipse", h: 42 },
    { text: "Conv 3×3", fill: TINT.blue, w: 160 },
    { text: "BatchNorm + ReLU", fill: TINT.teal, w: 160, fontSize: 14 },
    { text: "Conv 3×3", fill: TINT.blue, w: 160 },
    { text: "⊕", fill: TINT.orange, w: 54, shape: "ellipse", h: 54 },
    { text: "ReLU", fill: TINT.teal, w: 120 },
  ];
  const col = vstack("res", 0, 60, 160, cells);
  const add = col[4];
  // The skip leaves x at its right edge rather than its centre, so the dashed
  // line does not run back across the label inside the node.
  const startX = col[0].x + col[0].w + GAP;
  const startY = col[0].y + col[0].h / 2;
  const laneX = col[0].x + 160 + 80;
  const endX = add.x + add.w + GAP;
  const endY = add.y + add.h / 2;

  return [
    title(0, 10, "Residual block", g),
    ...nodes(col, cells, g),
    ...chain(col, g),
    {
      type: "arrow",
      x: startX,
      y: startY,
      width: laneX - startX,
      height: endY - startY,
      points: [
        [0, 0],
        [laneX - startX, 0],
        [laneX - startX, endY - startY],
        [endX - startX, endY - startY],
      ],
      endArrowhead: DEFAULT_ARROWHEAD,
      roundness: { type: 2 },
      ...BASE,
      strokeStyle: "dashed",
      groupIds: [g],
    } as unknown as ExcalidrawElementSkeleton,
    caption(laneX + 30, col[2].y - 10, "identity", g),
  ];
};

const uNet = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-unet";
  const down: Cell[] = [
    { text: "Enc 1", fill: TINT.blue, w: 120, h: 44 },
    { text: "Enc 2", fill: TINT.blue, w: 120, h: 44 },
    { text: "Enc 3", fill: TINT.blue, w: 120, h: 44 },
  ];
  // The decoder is laid out top-down like the encoder so that a skip runs
  // straight across at its own depth. Ordering it by flow instead makes every
  // skip cross its neighbours, which reads as a mistake rather than a U.
  const up: Cell[] = [
    { text: "Dec 1", fill: TINT.orange, w: 120, h: 44 },
    { text: "Dec 2", fill: TINT.orange, w: 120, h: 44 },
    { text: "Dec 3", fill: TINT.orange, w: 120, h: 44 },
  ];
  const bottleneck: Cell[] = [
    { text: "Bottleneck", fill: TINT.violet, w: 150, h: 44 },
  ];

  const l = vstack("un-d", 0, 80, 120, down, 56);
  const r = vstack("un-u", 400, 80, 120, up, 56);
  const b = vstack("un-b", 185, l[2].y + 120, 150, bottleneck);

  const skips = l.map((from, i) =>
    arrowBetween(from, r[i], g, { strokeStyle: "dashed" }),
  );

  return [
    title(0, 20, "U-Net", g),
    ...nodes(l, down, g),
    ...nodes(r, up, g),
    ...nodes(b, bottleneck, g),
    ...chain(l, g),
    arrowBetween(l[2], b[0], g),
    arrowBetween(b[0], r[2], g, {}, { to: 0.78 }),
    arrowBetween(r[2], r[1], g),
    arrowBetween(r[1], r[0], g),
    ...skips,
    caption(228, l[0].y - 26, "skip connections", g),
  ];
};

const autoencoder = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-ae";
  const cells: Cell[] = [
    { text: "Input x", fill: TINT.gray, w: 110 },
    { text: "Encoder", fill: TINT.blue, w: 130 },
    { text: "z", fill: TINT.violet, w: 66, shape: "ellipse", h: 66 },
    { text: "Decoder", fill: TINT.orange, w: 130 },
    { text: "x̂", fill: TINT.green, w: 110 },
  ];
  const row = hstack("ae", 0, 60, 64, cells, 40);
  return [
    title(0, 10, "Autoencoder", g),
    ...nodes(row, cells, g),
    ...chain(row, g),
    caption(row[2].x - 10, row[2].y + 78, "latent", g),
  ];
};

const gan = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-gan";
  const top: Cell[] = [
    { text: "z ~ N(0, I)", fill: TINT.gray, w: 120, fontSize: 14 },
    { text: "Generator", fill: TINT.blue, w: 130 },
    { text: "Fake x̂", fill: TINT.orange, w: 110 },
  ];
  const bottom: Cell[] = [{ text: "Real x", fill: TINT.green, w: 110 }];
  const disc: Cell[] = [
    { text: "Discriminator", fill: TINT.violet, w: 150, fontSize: 14 },
    { text: "real / fake", fill: TINT.gray, w: 120, shape: "ellipse", h: 50 },
  ];

  const t = hstack("gan-t", 0, 60, 60, top, 44);
  const b = hstack("gan-b", t[2].x, 190, 60, bottom, 44);
  const d = hstack("gan-d", 520, 125, 60, disc, 44);

  return [
    title(0, 10, "GAN", g),
    ...nodes(t, top, g),
    ...nodes(b, bottom, g),
    ...nodes(d, disc, g),
    ...chain(t, g),
    arrowBetween(t[2], d[0], g, {}, { to: 0.28 }),
    arrowBetween(b[0], d[0], g, {}, { to: 0.72 }),
    arrowBetween(d[0], d[1], g),
  ];
};

const diffusion = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-diffusion";
  const cells: Cell[] = [
    { text: "x₀", fill: TINT.green, w: 80, h: 62 },
    { text: "xₜ₋₁", fill: TINT.teal, w: 80, h: 62 },
    { text: "xₜ", fill: TINT.blue, w: 80, h: 62 },
    { text: "x_T ~ N(0,I)", fill: TINT.gray, w: 120, h: 62, fontSize: 13 },
  ];
  const row = hstack("dif", 0, 80, 96, cells, 92);

  // Forward and reverse share every gap, so they are drawn in two lanes at
  // fixed heights inside the boxes rather than between their centres, where
  // they would land exactly on top of each other.
  const lane = (
    a: Node,
    b: Node,
    dy: number,
    extra: Record<string, unknown>,
  ) => {
    const right = b.x > a.x;
    const x1 = right ? a.x + a.w + GAP : a.x - GAP;
    const x2 = right ? b.x - GAP : b.x + b.w + GAP;
    return {
      type: "arrow",
      x: x1,
      y: a.y + dy,
      width: x2 - x1,
      height: 0,
      points: [
        [0, 0],
        [x2 - x1, 0],
      ],
      endArrowhead: DEFAULT_ARROWHEAD,
      ...BASE,
      groupIds: [g],
      ...extra,
    } as unknown as ExcalidrawElementSkeleton;
  };

  const forward = row
    .slice(0, -1)
    .map((n, i) => lane(n, row[i + 1], n.h * 0.3, {}));
  const back = row.slice(0, -1).map((n, i) =>
    lane(row[i + 1], n, row[i + 1].h * 0.72, {
      strokeStyle: "dashed",
      strokeColor: COLOR_PALETTE.violet[3],
    }),
  );

  return [
    title(0, 20, "Diffusion", g),
    ...nodes(row, cells, g),
    ...forward,
    ...back,
    caption(row[0].x, row[0].y - 26, "forward q (add noise)", g),
    caption(row[0].x, row[0].y + row[0].h + 12, "reverse pθ (denoise)", g),
  ];
};

const vit = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-vit";
  const cells: Cell[] = [
    { text: "Image", fill: TINT.gray, w: 110 },
    { text: "Patch + Pos Embed", fill: TINT.teal, w: 170, fontSize: 14 },
    { text: "Transformer Encoder", fill: TINT.orange, w: 190, fontSize: 14 },
    { text: "MLP Head", fill: TINT.violet, w: 130 },
    { text: "Class", fill: TINT.green, w: 100, shape: "ellipse", h: 50 },
  ];
  const row = hstack("vit", 0, 70, 62, cells, 38);
  return [
    title(0, 20, "Vision Transformer", g),
    ...nodes(row, cells, g),
    ...chain(row, g),
    caption(row[1].x, row[1].y + 78, "[CLS] token prepended", g),
  ];
};

const attentionDetail = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-attn";
  const qkv: Cell[] = [
    { text: "Q", fill: TINT.blue, w: 76, h: 44 },
    { text: "K", fill: TINT.teal, w: 76, h: 44 },
    { text: "V", fill: TINT.orange, w: 76, h: 44 },
  ];
  // V is parked to the right of the column and routed down its own lane. A
  // straight arrow from V to MatMul ·V would cut through Scale and Softmax.
  const q = hstack("attn-q", 0, 70, 44, qkv.slice(0, 2), 34);
  const v = hstack("attn-v", 300, 70, 44, [qkv[2]], 0);
  const pipeline: Cell[] = [
    { text: "MatMul QKᵀ", fill: TINT.gray, w: 190, fontSize: 14 },
    { text: "Scale 1/√dₖ", fill: TINT.gray, w: 190, fontSize: 14 },
    { text: "Softmax", fill: TINT.violet, w: 190 },
    { text: "MatMul ·V", fill: TINT.gray, w: 190 },
    { text: "Output", fill: TINT.green, w: 190 },
  ];
  const col = vstack("attn-p", 0, 170, 190, pipeline, 34);
  const target = col[3];
  const laneX = v[0].x + v[0].w / 2;
  const vy = v[0].y + v[0].h + GAP;
  const ty = target.y + target.h / 2;

  return [
    title(0, 20, "Scaled dot-product attention", g),
    ...nodes(q, qkv.slice(0, 2), g),
    ...nodes(v, [qkv[2]], g),
    ...nodes(col, pipeline, g),
    arrowBetween(q[0], col[0], g, { start: null, end: null }, { to: 0.3 }),
    arrowBetween(q[1], col[0], g, { start: null, end: null }, { to: 0.7 }),
    {
      type: "arrow",
      x: laneX,
      y: vy,
      width: target.x + target.w + GAP - laneX,
      height: ty - vy,
      points: [
        [0, 0],
        [0, ty - vy],
        [target.x + target.w + GAP - laneX, ty - vy],
      ],
      endArrowhead: DEFAULT_ARROWHEAD,
      roundness: { type: 2 },
      ...BASE,
      groupIds: [g],
    } as unknown as ExcalidrawElementSkeleton,
    ...chain(col, g),
  ];
};

const trainingLoop = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-training";
  const cells: Cell[] = [
    { text: "Dataset", fill: TINT.gray, w: 120 },
    { text: "Model", fill: TINT.blue, w: 120 },
    { text: "Loss", fill: TINT.orange, w: 110, shape: "diamond", h: 76 },
    { text: "Optimizer", fill: TINT.violet, w: 130 },
  ];
  const row = hstack("tr", 0, 70, 62, cells, 46);
  const backY = row[1].y + row[1].h + 74;
  return [
    title(0, 20, "Training loop", g),
    ...nodes(row, cells, g),
    ...chain(row, g),
    {
      type: "arrow",
      x: row[3].x + row[3].w / 2,
      y: row[3].y + row[3].h + GAP,
      width: row[1].x + row[1].w / 2 - (row[3].x + row[3].w / 2),
      height: 0,
      points: [
        [0, 0],
        [0, backY - (row[3].y + row[3].h + GAP)],
        [
          row[1].x + row[1].w / 2 - (row[3].x + row[3].w / 2),
          backY - (row[3].y + row[3].h + GAP),
        ],
        [
          row[1].x + row[1].w / 2 - (row[3].x + row[3].w / 2),
          row[1].y + row[1].h + GAP - (row[3].y + row[3].h + GAP),
        ],
      ],
      endArrowhead: DEFAULT_ARROWHEAD,
      roundness: { type: 2 },
      ...BASE,
      strokeStyle: "dashed",
      groupIds: [g],
    } as unknown as ExcalidrawElementSkeleton,
    caption(row[1].x + 24, backY + 20, "gradient update", g),
  ];
};

const multimodal = (): ExcalidrawElementSkeleton[] => {
  const g = "arch-multimodal";
  const image: Cell[] = [
    { text: "Image", fill: TINT.gray, w: 110, h: 50 },
    { text: "Vision Encoder", fill: TINT.blue, w: 160, h: 50, fontSize: 14 },
  ];
  const text: Cell[] = [
    { text: "Text", fill: TINT.gray, w: 110, h: 50 },
    { text: "Text Encoder", fill: TINT.teal, w: 160, h: 50, fontSize: 14 },
  ];
  const head: Cell[] = [
    { text: "Fusion", fill: TINT.orange, w: 130, h: 56 },
    { text: "Prediction", fill: TINT.green, w: 140, h: 50 },
  ];

  const i = hstack("mm-i", 0, 40, 50, image, 40);
  const t = hstack("mm-t", 0, 180, 50, text, 40);
  const h = hstack("mm-h", 400, 108, 56, head, 44);

  return [
    title(0, 0, "Multimodal fusion", g),
    ...nodes(i, image, g),
    ...nodes(t, text, g),
    ...nodes(h, head, g),
    ...chain(i, g),
    ...chain(t, g),
    arrowBetween(i[1], h[0], g, {}, { to: 0.28 }),
    arrowBetween(t[1], h[0], g, {}, { to: 0.72 }),
    arrowBetween(h[0], h[1], g),
  ];
};

/* ------------------------------------------------------------------ *
 * Kit
 * ------------------------------------------------------------------ */

const ITEMS: { name: string; skeleton: ExcalidrawElementSkeleton[] }[] = [
  { name: "Conv block", skeleton: block("Conv 3×3", TINT.blue) },
  { name: "Deconv block", skeleton: block("ConvT 3×3", TINT.blue) },
  { name: "Pooling", skeleton: block("Max Pool", TINT.teal, 130, 50) },
  { name: "Linear / MLP", skeleton: block("Linear", TINT.teal) },
  { name: "Transformer block", skeleton: block("Transformer", TINT.violet) },
  { name: "Attention head", skeleton: block("Self-Attention", TINT.orange) },
  {
    name: "Cross attention",
    skeleton: block("Cross-Attention", TINT.orange, 190, 60),
  },
  { name: "Normalisation", skeleton: block("LayerNorm", TINT.gray, 150, 44) },
  { name: "Activation", skeleton: block("GELU", TINT.gray, 110, 44) },
  { name: "Dropout", skeleton: block("Dropout", TINT.gray, 120, 44) },
  { name: "Embedding", skeleton: block("Embedding", TINT.teal) },
  { name: "Positional encoding", skeleton: block("Pos. Encoding", TINT.gray) },
  { name: "Softmax", skeleton: block("Softmax", TINT.violet, 130, 46) },
  { name: "Recurrent cell", skeleton: block("LSTM", TINT.blue, 120, 60) },
  { name: "Encoder stack", skeleton: deck("Encoder ×N", TINT.blue) },
  { name: "Decoder stack", skeleton: deck("Decoder ×N", TINT.orange) },
  {
    name: "Add / residual",
    skeleton: shaped("⊕", TINT.orange, "ellipse", 60, 60),
  },
  { name: "Concat", skeleton: shaped("concat", TINT.gray, "ellipse", 150, 78) },
  { name: "Input", skeleton: shaped("Input", TINT.gray, "ellipse", 120, 56) },
  {
    name: "Output",
    skeleton: shaped("Output", TINT.green, "ellipse", 120, 56),
  },
  {
    name: "Loss",
    skeleton: shaped("$\\mathcal{L}$", TINT.orange, "diamond", 240, 140),
  },
  { name: "Tensor", skeleton: tensorCube(90, TINT.violet, "B × C × H × W") },
  { name: "Feature maps", skeleton: featureMaps() },
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
  {
    name: "Gradient flow",
    skeleton: [
      {
        type: "arrow",
        x: 0,
        y: 0,
        width: 120,
        height: 0,
        endArrowhead: DEFAULT_ARROWHEAD,
        ...BASE,
        strokeColor: COLOR_PALETTE.violet[3],
        strokeStyle: "dashed",
      } as ExcalidrawElementSkeleton,
    ],
  },
  { name: "Transformer", skeleton: transformer() },
  { name: "Seq2seq + attention", skeleton: seq2seq() },
  { name: "Attention detail", skeleton: attentionDetail() },
  { name: "CNN classifier", skeleton: cnnPipeline() },
  { name: "Residual block", skeleton: residualBlock() },
  { name: "U-Net", skeleton: uNet() },
  { name: "Autoencoder", skeleton: autoencoder() },
  { name: "GAN", skeleton: gan() },
  { name: "Diffusion", skeleton: diffusion() },
  { name: "Vision Transformer", skeleton: vit() },
  { name: "Multimodal fusion", skeleton: multimodal() },
  { name: "Training loop", skeleton: trainingLoop() },
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
