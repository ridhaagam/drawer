export type MathRun =
  | { type: "text"; value: string }
  | { type: "math"; value: string };

// A single `$` opens a span and the next unescaped `$` closes it. `\$` is a
// literal dollar, and an unclosed `$` is just text.
//
// The contents may not begin or end with whitespace, which is the usual
// convention and the only thing separating a formula from prices: "$5 and $10"
// would otherwise parse as the formula "5 and ". Write `$x^2$`, not `$ x^2 $`.
const MATH_SPAN = /(?<!\\)\$(\S(?:[^$\\]|\\.)*?\S|\S)(?<!\\)\$/g;

export const hasMath = (text: string) => {
  MATH_SPAN.lastIndex = 0;
  return MATH_SPAN.test(text);
};

export const parseMathRuns = (line: string): MathRun[] => {
  const runs: MathRun[] = [];
  let index = 0;

  MATH_SPAN.lastIndex = 0;

  for (
    let match = MATH_SPAN.exec(line);
    match !== null;
    match = MATH_SPAN.exec(line)
  ) {
    if (match.index > index) {
      runs.push({ type: "text", value: line.slice(index, match.index) });
    }
    runs.push({ type: "math", value: match[1] });
    index = match.index + match[0].length;
  }

  if (index < line.length) {
    runs.push({ type: "text", value: line.slice(index) });
  }

  return runs.length > 0 ? runs : [{ type: "text", value: line }];
};

// Wrapping breaks a too-long token down to individual characters, which would
// slice a formula in half and leave the renderer with a span it can no longer
// parse. Math spans are handed to the wrapper as single indivisible tokens
// instead, so an over-wide formula overflows rather than shattering.
export const splitPreservingMath = (line: string): string[] => {
  const parts: string[] = [];
  let index = 0;

  MATH_SPAN.lastIndex = 0;

  for (
    let match = MATH_SPAN.exec(line);
    match !== null;
    match = MATH_SPAN.exec(line)
  ) {
    if (match.index > index) {
      parts.push(line.slice(index, match.index));
    }
    parts.push(match[0]);
    index = match.index + match[0].length;
  }

  if (index < line.length) {
    parts.push(line.slice(index));
  }

  return parts;
};

// A segment produced by splitPreservingMath is a formula when it is exactly one
// math span and nothing else.
export const isMathSpan = (segment: string) => {
  MATH_SPAN.lastIndex = 0;
  const match = MATH_SPAN.exec(segment);
  return match !== null && match[0] === segment;
};
