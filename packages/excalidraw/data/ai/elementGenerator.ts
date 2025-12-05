import { randomId, randomInteger, ROUNDNESS } from "@excalidraw/common";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { Radians } from "@excalidraw/math";

interface AIElementBase {
  id?: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  roughness?: number;
  roundness?: { type: number; value?: number } | null;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  boundElements?: Array<{ type: string; id: string }> | null;
  points?: number[][];
  startArrowhead?: string | null;
  endArrowhead?: string | null;
}

const getUpdatedTimestamp = () => Date.now();

const createBaseElement = (aiElement: AIElementBase) => {
  return {
    id: aiElement.id || randomId(),
    x: aiElement.x || 0,
    y: aiElement.y || 0,
    width: aiElement.width || 100,
    height: aiElement.height || 100,
    angle: 0 as Radians,
    strokeColor: aiElement.strokeColor || "#1e1e1e",
    backgroundColor: aiElement.backgroundColor || "transparent",
    fillStyle: "solid" as const,
    strokeWidth: aiElement.strokeWidth || 2,
    strokeStyle: "solid" as const,
    roughness: aiElement.roughness ?? 1,
    opacity: 100,
    groupIds: [] as string[],
    frameId: null,
    index: null,
    roundness: aiElement.roundness
      ? {
          type: aiElement.roundness
            .type as typeof ROUNDNESS[keyof typeof ROUNDNESS],
          value: aiElement.roundness.value,
        }
      : null,
    seed: randomInteger(),
    version: 1,
    versionNonce: randomInteger(),
    isDeleted: false as const,
    boundElements: aiElement.boundElements
      ? aiElement.boundElements.map((b) => ({
          id: b.id,
          type: b.type as "text" | "arrow",
        }))
      : null,
    updated: getUpdatedTimestamp(),
    link: null,
    locked: false,
  };
};

const parseRectangle = (aiElement: AIElementBase): ExcalidrawElement => {
  const base = createBaseElement(aiElement);
  return {
    ...base,
    type: "rectangle",
    width: aiElement.width || 150,
    height: aiElement.height || 80,
    roundness: aiElement.roundness
      ? {
          type: aiElement.roundness
            .type as typeof ROUNDNESS[keyof typeof ROUNDNESS],
          value: aiElement.roundness.value,
        }
      : { type: ROUNDNESS.ADAPTIVE_RADIUS, value: 8 },
  } as ExcalidrawElement;
};

const parseEllipse = (aiElement: AIElementBase): ExcalidrawElement => {
  const base = createBaseElement(aiElement);
  return {
    ...base,
    type: "ellipse",
    width: aiElement.width || 100,
    height: aiElement.height || 100,
  } as ExcalidrawElement;
};

const parseDiamond = (aiElement: AIElementBase): ExcalidrawElement => {
  const base = createBaseElement(aiElement);
  return {
    ...base,
    type: "diamond",
    width: aiElement.width || 120,
    height: aiElement.height || 100,
  } as ExcalidrawElement;
};

const parseText = (aiElement: AIElementBase): ExcalidrawElement => {
  const text = aiElement.text || "Label";
  const base = createBaseElement(aiElement);
  return {
    ...base,
    type: "text",
    width: aiElement.width || text.length * 10,
    height: aiElement.height || 25,
    text,
    originalText: text,
    fontSize: aiElement.fontSize || 16,
    fontFamily: aiElement.fontFamily || 1,
    textAlign: (aiElement.textAlign as "left" | "center" | "right") || "center",
    verticalAlign:
      (aiElement.verticalAlign as "top" | "middle" | "bottom") || "middle",
    containerId: aiElement.containerId || null,
    lineHeight: 1.25 as number & { _brand: "unitlessLineHeight" },
    autoResize: true,
  } as unknown as ExcalidrawElement;
};

const parseArrow = (aiElement: AIElementBase): ExcalidrawElement => {
  const rawPoints = aiElement.points || [
    [0, 0],
    [100, 0],
  ];
  const width =
    Math.abs(rawPoints[rawPoints.length - 1][0] - rawPoints[0][0]) ||
    aiElement.width ||
    100;
  const height =
    Math.abs(rawPoints[rawPoints.length - 1][1] - rawPoints[0][1]) ||
    aiElement.height ||
    0;

  // Convert to LocalPoint
  const points: LocalPoint[] = rawPoints.map((p) =>
    pointFrom<LocalPoint>(p[0], p[1]),
  );

  const base = createBaseElement(aiElement);
  return {
    ...base,
    type: "arrow",
    width,
    height,
    points,
    startArrowhead: (aiElement.startArrowhead || null) as any,
    endArrowhead: (aiElement.endArrowhead || "arrow") as any,
    startBinding: null,
    endBinding: null,
    lastCommittedPoint: null,
    elbowed: false,
  } as ExcalidrawElement;
};

const parseLine = (aiElement: AIElementBase): ExcalidrawElement => {
  const rawPoints = aiElement.points || [
    [0, 0],
    [100, 0],
  ];

  // Convert to LocalPoint
  const points: LocalPoint[] = rawPoints.map((p) =>
    pointFrom<LocalPoint>(p[0], p[1]),
  );

  const base = createBaseElement(aiElement);
  return {
    ...base,
    type: "line",
    width: aiElement.width || 100,
    height: aiElement.height || 0,
    points,
    startArrowhead: null,
    endArrowhead: null,
    startBinding: null,
    endBinding: null,
    lastCommittedPoint: null,
  } as ExcalidrawElement;
};

const parseCube = (aiElement: AIElementBase): ExcalidrawElement => {
  const base = createBaseElement(aiElement);
  const depth = Math.min(aiElement.width || 100, aiElement.height || 80) * 0.5;
  return {
    ...base,
    type: "cube",
    width: aiElement.width || 100,
    height: aiElement.height || 80,
    customData: {
      shape3d: {
        depth,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        perspective: 800,
      },
    },
  } as unknown as ExcalidrawElement;
};

const parseRectangularPrism = (aiElement: AIElementBase): ExcalidrawElement => {
  const base = createBaseElement(aiElement);
  const depth = Math.min(aiElement.width || 120, aiElement.height || 80) * 0.4;
  return {
    ...base,
    type: "rectangularPrism",
    width: aiElement.width || 120,
    height: aiElement.height || 80,
    customData: {
      shape3d: {
        depth,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        perspective: 800,
      },
    },
  } as unknown as ExcalidrawElement;
};

const parseElement = (aiElement: AIElementBase): ExcalidrawElement | null => {
  switch (aiElement.type) {
    case "rectangle":
      return parseRectangle(aiElement);
    case "ellipse":
      return parseEllipse(aiElement);
    case "diamond":
      return parseDiamond(aiElement);
    case "text":
      return parseText(aiElement);
    case "arrow":
      return parseArrow(aiElement);
    case "line":
      return parseLine(aiElement);
    case "cube":
      return parseCube(aiElement);
    case "rectangularPrism":
    case "rectangular_prism":
      return parseRectangularPrism(aiElement);
    default:
      console.warn(`Unknown element type: ${aiElement.type}`);
      return null;
  }
};

export const parseAIResponseToElements = (
  jsonResponse: string,
): ExcalidrawElement[] => {
  try {
    // Try to extract JSON from the response if it's wrapped in markdown code blocks
    let cleanedResponse = jsonResponse.trim();

    // Remove markdown code block wrappers if present
    const jsonMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[1].trim();
    }

    // Parse the JSON
    const parsed = JSON.parse(cleanedResponse);

    // Handle both array and single object responses
    const elements = Array.isArray(parsed) ? parsed : [parsed];

    // Map IDs for bound elements
    const idMap = new Map<string, string>();
    elements.forEach((el: AIElementBase) => {
      if (el.id) {
        const newId = randomId();
        idMap.set(el.id, newId);
        el.id = newId;
      }
    });

    // Update containerId and boundElements references
    elements.forEach((el: AIElementBase) => {
      if (el.containerId && idMap.has(el.containerId)) {
        el.containerId = idMap.get(el.containerId);
      }
      if (el.boundElements) {
        el.boundElements = el.boundElements.map((bound) => ({
          ...bound,
          id: idMap.get(bound.id) || bound.id,
        }));
      }
    });

    // Parse each element
    const excalidrawElements = elements
      .map((el: AIElementBase) => parseElement(el))
      .filter((el): el is ExcalidrawElement => el !== null);

    return excalidrawElements;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error("Response was:", jsonResponse);
    throw new Error(
      `Failed to parse AI response: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
};

export const generateElementsFromPrompt = async (
  generateFn: (prompt: string, systemPrompt: string) => Promise<string>,
  userPrompt: string,
  systemPrompt: string,
): Promise<ExcalidrawElement[]> => {
  const response = await generateFn(userPrompt, systemPrompt);
  return parseAIResponseToElements(response);
};
