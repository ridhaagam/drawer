import { parseMathRuns } from "./parse";

export type RenderedMath = {
  svg: string;
  width: number;
  height: number;
  // distance from the top of the box down to the text baseline, in px
  baseline: number;
  // canvas cannot draw an SVG string, so the same output is also kept as a
  // decoded raster. Null when decoding is unavailable, as in jsdom, which
  // leaves SVG export working regardless.
  image: HTMLImageElement | null;
};

type Converter = (latex: string) => {
  svg: string;
  widthEx: number;
  heightEx: number;
  depthEx: number;
};

let converterPromise: Promise<Converter> | null = null;

// MathJax is large, so it is only fetched once a label actually contains a
// formula. Everything downstream treats "not loaded yet" the way the image
// pipeline treats an unloaded file: draw something now, invalidate and repaint
// when it resolves.
const loadConverter = async (): Promise<Converter> => {
  const [
    { mathjax },
    { TeX },
    { SVG },
    { liteAdaptor },
    { RegisterHTMLHandler },
    { AllPackages },
  ] = await Promise.all([
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/output/svg.js"),
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
    import("mathjax-full/js/input/tex/AllPackages.js"),
  ]);

  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);

  const document = mathjax.document("", {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: "local" }),
  });

  return (latex: string) => {
    const node = document.convert(latex, { display: false });
    const html = adaptor.innerHTML(node);
    const svg = html.slice(
      html.indexOf("<svg"),
      html.lastIndexOf("</svg>") + 6,
    );

    const attribute = (name: string) => {
      const match = svg.match(new RegExp(`${name}="([-\\d.]+)ex"`));
      return match ? parseFloat(match[1]) : 0;
    };

    // depth arrives as a negative vertical-align inside the style attribute
    // rather than as an attribute of its own
    const verticalAlign = svg.match(/vertical-align:\s*([-\d.]+)ex/);

    return {
      svg,
      widthEx: attribute("width"),
      heightEx: attribute("height"),
      depthEx: verticalAlign ? parseFloat(verticalAlign[1]) : 0,
    };
  };
};

export const loadMath = () => {
  if (!converterPromise) {
    converterPromise = loadConverter().catch((error) => {
      console.error("[math] failed to load MathJax", error);
      converterPromise = null;
      throw error;
    });
  }
  return converterPromise;
};

// MathJax reports in `ex`. Treating one ex as half the font size keeps
// measurement independent of which font happens to be loaded, which matters
// because the glyphs come from MathJax's own fonts either way.
const EX_PER_EM = 0.5;

// MathJax emits `currentColor`, so a single render serves every stroke colour
// and colour stays out of the cache key.
const cache = new Map<string, RenderedMath>();
const pending = new Set<string>();

const cacheKey = (latex: string, fontSize: number) => `${fontSize}|${latex}`;

// Rasterised at a multiple of the layout size so the glyphs stay sharp when
// the canvas is zoomed in.
const RASTER_SCALE = 4;

const rasterize = async (
  svg: string,
  width: number,
  height: number,
): Promise<HTMLImageElement | null> => {
  if (typeof Image === "undefined" || width <= 0 || height <= 0) {
    return null;
  }

  const sized = svg
    .replace(/width="[^"]*"/, `width="${width * RASTER_SCALE}"`)
    .replace(/height="[^"]*"/, `height="${height * RASTER_SCALE}"`);

  try {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
    await image.decode();
    return image;
  } catch (error: any) {
    return null;
  }
};

const build = async (
  raw: ReturnType<Converter>,
  fontSize: number,
): Promise<RenderedMath> => {
  const scale = fontSize * EX_PER_EM;
  const height = raw.heightEx * scale;
  const depth = Math.abs(raw.depthEx) * scale;
  const width = raw.widthEx * scale;

  return {
    svg: raw.svg,
    width,
    height,
    baseline: height - depth,
    image: await rasterize(raw.svg, width, height),
  };
};

export const getRenderedMath = (
  latex: string,
  fontSize: number,
): RenderedMath | null => cache.get(cacheKey(latex, fontSize)) ?? null;

export const renderMath = async (
  latex: string,
  fontSize: number,
): Promise<RenderedMath> => {
  const key = cacheKey(latex, fontSize);
  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  const convert = await loadMath();
  const rendered = await build(convert(latex), fontSize);
  cache.set(key, rendered);

  return rendered;
};

// Fire-and-forget warm-up for the renderers, which cannot await. Returns true
// when something was newly scheduled, so the caller knows a repaint is coming.
export const ensureMath = (
  latex: string,
  fontSize: number,
  onReady: () => void,
): boolean => {
  const key = cacheKey(latex, fontSize);

  if (cache.has(key) || pending.has(key)) {
    return false;
  }

  pending.add(key);

  renderMath(latex, fontSize)
    .catch(() => undefined)
    .finally(() => {
      pending.delete(key);
      onReady();
    });

  return true;
};

// Export cannot repaint later, so every formula in the scene has to be resolved
// before rendering starts. Failures are swallowed: a formula that will not
// compile falls back to its source text rather than aborting the export.
export const preloadSceneMath = async (
  elements: readonly { type: string; text?: string; fontSize?: number }[],
) => {
  const wanted = new Map<string, { latex: string; fontSize: number }>();

  for (const element of elements) {
    if (element.type !== "text" || !element.text || !element.fontSize) {
      continue;
    }
    for (const line of element.text.split("\n")) {
      for (const run of parseMathRuns(line)) {
        if (run.type === "math") {
          wanted.set(cacheKey(run.value, element.fontSize), {
            latex: run.value,
            fontSize: element.fontSize,
          });
        }
      }
    }
  }

  await Promise.all(
    [...wanted.values()].map(({ latex, fontSize }) =>
      renderMath(latex, fontSize).catch(() => undefined),
    ),
  );
};
