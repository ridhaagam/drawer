# Quick Start: Testing 3D Shapes in Excalidraw

## 🚀 Getting Started

### Step 1: Install Dependencies (if not already done)

```bash
cd /home/agam/Documents/excalidraw
yarn install
```

### Step 2: Start the Development Server

```bash
yarn start
```

This will start the Excalidraw development server, typically at `http://localhost:3000`

### Step 3: Open Excalidraw in Your Browser

Open your browser and navigate to `http://localhost:3000`

---

## 🎨 Creating 3D Shapes

Since the 3D shapes aren't integrated into the UI toolbar yet, you'll need to create them programmatically via the **browser console**.

### Open Browser Console

Press **F12** (or Right-click → Inspect → Console tab)

### Method 1: Using the Excalidraw API (Recommended)

```javascript
// Get the Excalidraw API
const api = window.ExcalidrawLib;

// Create a cube
const cube = {
  id: "cube-" + Date.now(),
  type: "cube",
  x: 200,
  y: 200,
  width: 150,
  height: 150,
  angle: 0,
  strokeColor: "#000000",
  backgroundColor: "transparent",
  fillStyle: "hachure",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  index: null,
  roundness: null,
  seed: Math.floor(Math.random() * 1000000),
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
  customData: {
    shape3d: {
      rotationX: 0.3,
      rotationY: 0.4,
      rotationZ: 0,
      depth: 150,
      perspective: 800,
    },
  },
};

// Add to scene (method varies by Excalidraw version)
// Check window object for available API methods
console.log("Available APIs:", Object.keys(window));
```

### Method 2: Direct Element Creation

If you have access to the scene elements directly:

```javascript
// Create a cube with default isometric view
const createCube = (x, y, size = 150) => ({
  id: "cube-" + Math.random(),
  type: "cube",
  x: x,
  y: y,
  width: size,
  height: size,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "#ced4da",
  fillStyle: "hachure",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  seed: Math.floor(Math.random() * 1000000),
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  groupIds: [],
  frameId: null,
  index: null,
  roundness: null,
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
  customData: {
    shape3d: {
      rotationX: 0.3, // Pitch (tilt forward/back)
      rotationY: 0.4, // Yaw (turn left/right)
      rotationZ: 0, // Roll (rotate clockwise/counter-clockwise)
      depth: size, // Z dimension
      perspective: 800, // Camera distance
    },
  },
});

// Create a rectangular prism
const createPrism = (x, y, width = 200, height = 120, depth = 80) => ({
  id: "prism-" + Math.random(),
  type: "rectangularPrism",
  x: x,
  y: y,
  width: width,
  height: height,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "#ffc9c9",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 0.5,
  opacity: 100,
  seed: Math.floor(Math.random() * 1000000),
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  groupIds: [],
  frameId: null,
  index: null,
  roundness: null,
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
  customData: {
    shape3d: {
      rotationX: 0.3,
      rotationY: 0.4,
      rotationZ: 0,
      depth: depth,
      perspective: 800,
    },
  },
});

// Use them:
const myCube = createCube(100, 100, 200);
const myPrism = createPrism(400, 100, 250, 150, 100);

console.log("Cube:", myCube);
console.log("Prism:", myPrism);
```

---

## 🔄 Rotating 3D Shapes

### Understanding Rotation Angles

All rotations are in **radians**:

- `0` = No rotation
- `Math.PI / 4` = 45 degrees
- `Math.PI / 2` = 90 degrees
- `Math.PI` = 180 degrees
- `Math.PI * 2` = 360 degrees (full circle)

### Rotation Axes

- **rotationX (Pitch)**: Tilts the shape forward/backward (like nodding "yes")
- **rotationY (Yaw)**: Turns the shape left/right (like shaking head "no")
- **rotationZ (Roll)**: Rotates the shape clockwise/counter-clockwise (like tilting head)

### Example Rotations

```javascript
// Top-down view
{ rotationX: 0, rotationY: 0, rotationZ: 0 }

// Default isometric view
{ rotationX: 0.3, rotationY: 0.4, rotationZ: 0 }

// Side view
{ rotationX: 0, rotationY: Math.PI / 2, rotationZ: 0 }

// 45-degree angle
{ rotationX: Math.PI / 4, rotationY: Math.PI / 4, rotationZ: 0 }

// Dramatic angle
{ rotationX: 0.8, rotationY: 1.2, rotationZ: 0.3 }
```

---

## 📏 Scaling 3D Shapes

### Scaling Width and Height (X, Y dimensions)

```javascript
element.width = 300; // Wider
element.height = 200; // Taller
```

### Scaling Depth (Z dimension)

```javascript
element.customData.shape3d.depth = 250; // Deeper
```

### Uniform Scaling (for perfect cubes)

```javascript
const size = 200;
element.width = size;
element.height = size;
element.customData.shape3d.depth = size;
```

---

## 🎯 Adjusting Perspective

The `perspective` value controls how dramatic the 3D effect looks:

```javascript
// More dramatic perspective (closer camera)
element.customData.shape3d.perspective = 400;

// Less perspective (more flat/isometric)
element.customData.shape3d.perspective = 1500;

// Balanced (default)
element.customData.shape3d.perspective = 800;
```

---

## 🐛 Troubleshooting

### Issue: Shapes not appearing

1. **Check the console for errors**

   - Press F12 and look at the Console tab
   - Look for TypeScript or rendering errors

2. **Verify element structure**

   ```javascript
   console.log("Element:", yourElement);
   console.log("Has customData?", yourElement.customData);
   console.log("Has shape3d?", yourElement.customData?.shape3d);
   ```

3. **Check if type is recognized**
   ```javascript
   console.log("Element type:", yourElement.type);
   // Should be 'cube' or 'rectangularPrism'
   ```

### Issue: TypeScript Errors

If you see TypeScript errors in the console:

```bash
# Fix formatting and linting
yarn fix

# Run type checking
npm run test:typecheck
```

Some type errors are expected as the 3D feature is still being integrated.

### Issue: Can't find Excalidraw API

The API may be exposed differently depending on the environment. Try:

```javascript
// Check what's available
console.log("Window properties:", Object.keys(window));

// Try these:
window.ExcalidrawLib;
window.Excalidraw;
window.ExcalidrawAPI;
```

---

## 🎨 Example: Creating Multiple Shapes

```javascript
// Create a scene with multiple 3D shapes

const shapes = [
  // Cube at different rotation
  {
    ...createCube(100, 100, 120),
    customData: {
      shape3d: {
        rotationX: 0.2,
        rotationY: 0.3,
        rotationZ: 0,
        depth: 120,
        perspective: 800,
      },
    },
  },

  // Tall prism
  {
    ...createPrism(300, 80, 100, 200, 60),
    customData: {
      shape3d: {
        rotationX: 0.4,
        rotationY: 0.5,
        rotationZ: 0.1,
        depth: 60,
        perspective: 800,
      },
    },
  },

  // Wide prism
  {
    ...createPrism(500, 150, 250, 80, 120),
    backgroundColor: "#a5d8ff",
    customData: {
      shape3d: {
        rotationX: 0.3,
        rotationY: 0.2,
        rotationZ: 0,
        depth: 120,
        perspective: 800,
      },
    },
  },
];

console.log("Created shapes:", shapes);
```

---

## 📝 Next Steps

1. **Explore different rotations**: Try different rotation combinations
2. **Adjust perspective**: See how perspective affects the 3D look
3. **Change colors**: Modify `strokeColor` and `backgroundColor`
4. **Vary sizes**: Create cubes and prisms of different dimensions

For more detailed information, see:

- `3D_SHAPES_GUIDE.md` - Complete feature documentation
- Browser console - Check for API methods and errors

---

## 💡 Pro Tips

1. **Save rotation presets**: Store your favorite rotation combinations
2. **Use Math.PI**: More readable than raw radian values
3. **Start simple**: Begin with the default isometric view, then experiment
4. **Check customData**: Always verify your 3D data is properly structured
5. **Console is your friend**: Use `console.log()` extensively to debug

Happy 3D drawing! 🎨✨
