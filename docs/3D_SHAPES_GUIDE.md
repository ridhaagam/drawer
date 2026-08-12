# 3D Shapes in Excalidraw

This guide explains the new 3D shape functionality added to Excalidraw.

## Overview

Excalidraw now supports 3D rectangular shapes (cubes and rectangular prisms) that can be rotated in 3D space and projected to 2D for rendering. The 3D shapes use perspective projection to create realistic 3D effects.

## Available 3D Shapes

### 1. Cube

A cube is a 3D shape with equal dimensions (width = height = depth).

### 2. Rectangular Prism

A rectangular prism can have different width, height, and depth values.

## Creating 3D Elements

### Using the API

```typescript
import {
  newCubeElement,
  newRectangularPrismElement,
} from "@excalidraw/element";

// Create a cube
const cube = newCubeElement({
  x: 100,
  y: 100,
  width: 200,
  height: 200,
  rotationX: 0.3, // Rotation around X axis (radians)
  rotationY: 0.4, // Rotation around Y axis (radians)
  rotationZ: 0, // Rotation around Z axis (radians)
  depth: 200, // Z dimension (defaults to width for cubes)
  perspective: 800, // Perspective distance
});

// Create a rectangular prism
const prism = newRectangularPrismElement({
  x: 400,
  y: 100,
  width: 300,
  height: 150,
  rotationX: 0.2,
  rotationY: 0.5,
  rotationZ: 0.1,
  depth: 100, // Different from width/height
  perspective: 800,
});
```

## 3D Properties

All 3D elements store their 3D-specific properties in `customData.shape3d`:

```typescript
type Shape3DData = {
  rotationX: number; // Pitch (rotation around X axis) in radians
  rotationY: number; // Yaw (rotation around Y axis) in radians
  rotationZ: number; // Roll (rotation around Z axis) in radians
  depth: number; // Depth (Z dimension) of the shape
  perspective: number; // Perspective distance for projection (default: 800)
};
```

## Rotation

### Rotation Axes

- **rotationX (Pitch)**: Rotates the shape forward/backward (like nodding)
- **rotationY (Yaw)**: Rotates the shape left/right (like shaking head "no")
- **rotationZ (Roll)**: Rotates the shape clockwise/counterclockwise (like tilting head)

### Rotation Values

- Rotations are specified in **radians**
- `0` = no rotation
- `Math.PI / 4` = 45 degrees
- `Math.PI / 2` = 90 degrees
- `Math.PI` = 180 degrees

### Example Rotations

```typescript
// Default isometric view
rotationX: 0.3;
rotationY: 0.4;
rotationZ: 0;

// Top view
rotationX: 0;
rotationY: 0;
rotationZ: 0;

// Side view
rotationX: 0;
rotationY: Math.PI / 2;
rotationZ: 0;

// 45-degree rotation
rotationX: Math.PI / 4;
rotationY: Math.PI / 4;
rotationZ: 0;
```

## Scaling

### 2D Scaling

The standard `width` and `height` properties control the X and Y dimensions:

```typescript
element.width = 300; // Scale width (X dimension)
element.height = 200; // Scale height (Y dimension)
```

### 3D Scaling (Depth)

The `depth` property in `customData.shape3d` controls the Z dimension:

```typescript
element.customData.shape3d.depth = 150; // Scale depth (Z dimension)
```

### Uniform Scaling (Cubes)

For cubes, to maintain equal proportions:

```typescript
const size = 250;
element.width = size;
element.height = size;
element.customData.shape3d.depth = size;
```

## Updating 3D Elements

To modify a 3D element's rotation or depth:

```typescript
import { newElementWith } from "@excalidraw/element";

// Update rotation
const rotated = newElementWith(element, {
  customData: {
    ...element.customData,
    shape3d: {
      ...element.customData?.shape3d,
      rotationX: 0.5,
      rotationY: 0.6,
      rotationZ: 0.1,
    },
  },
});

// Update depth
const scaled = newElementWith(element, {
  customData: {
    ...element.customData,
    shape3d: {
      ...element.customData?.shape3d,
      depth: 300,
    },
  },
});
```

## Type Checking

Use the provided type guards to check for 3D elements:

```typescript
import {
  is3DElement,
  isCubeElement,
  isRectangularPrismElement,
} from "@excalidraw/element";

if (is3DElement(element)) {
  // Element is either a cube or rectangular prism
  const shape3d = element.customData?.shape3d;
  console.log(`Rotation: X=${shape3d?.rotationX}, Y=${shape3d?.rotationY}`);
}

if (isCubeElement(element)) {
  // Element is specifically a cube
}

if (isRectangularPrismElement(element)) {
  // Element is specifically a rectangular prism
}
```

## 3D Math Utilities

The `@excalidraw/math` package provides 3D transformation utilities:

```typescript
import {
  getBoxVertices,
  getBoxEdges,
  transformPoint,
  createRotationMatrix,
  projectTo2D,
  type Point3D,
} from "@excalidraw/math";

// Get the 8 vertices of a box
const vertices = getBoxVertices(
  width,
  height,
  depth,
  centerX,
  centerY,
  centerZ,
);

// Create rotation matrix
const rotationMatrix = createRotationMatrix(rotX, rotY, rotZ);

// Transform 3D point
const transformed = transformPoint(point3D, rotationMatrix);

// Project 3D to 2D
const point2D = projectTo2D(point3D, perspective, centerX, centerY);
```

## Implementation Details

### Rendering Pipeline

1. **Vertex Generation**: Generate 8 vertices of the rectangular prism
2. **Rotation**: Apply rotation transformations using 4x4 matrices
3. **Projection**: Project 3D coordinates to 2D using perspective projection
4. **Edge Drawing**: Connect vertices with edges using Rough.js paths

### Perspective Projection

The perspective parameter controls the "camera distance":

- **Larger values** (e.g., 1000+): Less perspective, more orthographic
- **Smaller values** (e.g., 400-600): More perspective, more dramatic depth
- **Default**: 800 (balanced perspective)

```typescript
// More dramatic perspective
element.customData.shape3d.perspective = 500;

// Less perspective (more flat/isometric)
element.customData.shape3d.perspective = 1500;
```

## Examples

### Creating a Rotating Cube Animation

```typescript
// Create a cube
let cube = newCubeElement({
  x: 300,
  y: 200,
  width: 150,
  height: 150,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
});

// Animate rotation
setInterval(() => {
  cube = newElementWith(cube, {
    customData: {
      ...cube.customData,
      shape3d: {
        ...cube.customData.shape3d,
        rotationY: (cube.customData.shape3d.rotationY + 0.05) % (Math.PI * 2),
      },
    },
  });
}, 50);
```

### Creating a Stack of Boxes

```typescript
const boxes = [];
for (let i = 0; i < 3; i++) {
  boxes.push(
    newCubeElement({
      x: 200,
      y: 100 + i * 180,
      width: 150,
      height: 150,
      rotationX: 0.3,
      rotationY: 0.4,
      rotationZ: 0,
    }),
  );
}
```

## Limitations

Current limitations of the 3D shape system:

1. **Basic Shapes Only**: Only rectangular shapes (cubes and prisms) are currently supported
2. **No Hidden Line Removal**: All edges are drawn (wireframe mode)
3. **No Face Filling**: Faces are not filled with solid colors yet
4. **No Lighting**: No shading or lighting effects
5. **Manual Rotation**: Rotation must be set programmatically (UI controls pending)

## Future Enhancements

Planned improvements:

- Interactive 3D rotation controls in the UI
- Face filling with proper z-sorting
- Hidden line removal (back-face culling)
- Additional 3D shapes (sphere, cylinder, pyramid, etc.)
- Lighting and shading effects
- Texture mapping
- Shadows and ambient occlusion

## Technical Architecture

### Files Modified

- `packages/element/src/types.ts` - Added 3D element types
- `packages/element/src/shape.ts` - Added 3D shape generation
- `packages/element/src/renderElement.ts` - Added 3D rendering
- `packages/element/src/newElement.ts` - Added 3D element creators
- `packages/element/src/typeChecks.ts` - Added 3D type guards
- `packages/math/src/transform3d.ts` - New 3D math utilities

### Type Hierarchy

```
ExcalidrawElement
├── ExcalidrawGenericElement
│   ├── ExcalidrawRectangleElement
│   ├── ExcalidrawDiamondElement
│   ├── ExcalidrawEllipseElement
│   ├── ExcalidrawCubeElement ✨ NEW
│   └── ExcalidrawRectangularPrismElement ✨ NEW
└── ...
```
