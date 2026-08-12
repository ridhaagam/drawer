# Making figures for papers

## Inline math

Write LaTeX between single dollars inside any ordinary text label:

```
Reconstruction loss $\mathcal{L}_{rec} = \frac{1}{N}\sum_i \|x_i - \hat{x}_i\|^2$
```

The formula renders as real glyph geometry, sits on the same baseline as the surrounding words, and takes the label's stroke colour. Nothing new to insert: it is a normal text element, so it edits, moves, groups, exports and syncs over collaboration like any other.

The full TeX package set is available. MathJax is fetched the first time a formula appears, so the very first one may show its source for a moment before snapping into place.

**Dollars that are not math.** The contents may not begin or end with a space. That is what keeps `$5 and $10` from parsing as the formula `5 and `. Write `$x^2$`, not `$ x^2 $`. A lone unmatched `$` is left alone, and `\$` is always a literal dollar.

## Exporting at the right size

`Scale` multiplies raster resolution and is the right control for PNG. It does nothing useful for SVG, where it only changes the declared display size.

Use **Width on the page** instead. Set a real width in `pt`, `mm` or `in` and the height follows the aspect ratio, so the figure lands at exactly that size in the document. Presets cover the IEEE/CVPR column and full text width, and A4.

```latex
\usepackage{svg}
...
\includesvg[width=\columnwidth]{figures/architecture}
```

Because the width is already correct, `\includesvg` needs no scaling factor and the text in the figure comes out at the size you designed it at.

There is no PDF export. `svg2pdf` needs TTF to embed text and this repo ships woff2, and every route out of that needs glyph outlines from woff2, so they all fail the same way. SVG carries real `<text>` nodes with the fonts subsetted and embedded, and math is already vector paths, so the SVG path is the supported one. If a venue insists on PDF, `inkscape --export-type=pdf figure.svg` converts losslessly.

## Precision

- Object snapping is on by default; hold Ctrl/Cmd to suspend it while dragging.
- The stats panel takes typed values: exact x, y, width, height and angle, committed on Enter or blur.
- Grid mode and object snapping are mutually exclusive, by design.
- `Padding` in the export dialog controls the margin around the drawing, which matters when a figure sits tight against a column edge.

## Architecture kit

`Menu → Architecture kit` installs a set of ML-paper building blocks into the library: conv/linear/transformer/attention blocks, encoder and decoder stacks, a tensor cube, input and loss nodes, and data-flow and skip-connection arrows.

Every item spells out its own stroke, fill, roughness and font rather than inheriting the defaults, so the kit keeps looking the same even if the editor defaults change later. The colours come from the same colourblind-safe set as the quick picks, so items dropped from the kit match shapes drawn by hand.

Cubes extrude to 0.3 of their width. The solid is fitted inside the element's box, so a cube whose depth equalled its width -- the old default -- projected to a flat plate seen edge-on rather than to a cube. Adjust any individual shape with the depth handle, or with 3D depth in the properties panel; a saved drawing keeps whatever depth it was stored with.
