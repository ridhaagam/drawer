# 🎨 How to Use 3D Shapes in Excalidraw - NOW IN THE TOOLBAR!

## ✅ Setup Complete!

The 3D shapes are now fully integrated into the Excalidraw UI! No more console commands needed!

## 🚀 How to Create 3D Shapes

### Step 1: Start Excalidraw

Your development server should already be running at `http://localhost:3000`

### Step 2: Find the 3D Shape Tools

Look in the **left toolbar** - you'll now see two new icons:

1. **🧊 Cube Icon** - Creates 3D cubes
2. **📦 Rectangular Prism Icon** - Creates 3D rectangular prisms

They're located right after the Ellipse tool (○) and before the Arrow tool (→).

### Step 3: Select and Draw

1. **Click** on the Cube or Rectangular Prism icon in the toolbar
2. **Click and drag** on the canvas to create your 3D shape
3. The shape will appear with a default isometric view!

## 🎯 What You'll See

- **Cube**: A perfect 3D cube with equal width, height, and depth
- **Rectangular Prism**: A 3D box that can have different dimensions

Both shapes are drawn in a **wireframe style** with perspective projection, giving them a realistic 3D appearance!

## 🎨 Customization

Once you create a shape, you can:

### Basic Editing (via UI)

- **Move it**: Click and drag
- **Resize it**: Drag the corner handles
- **Change colors**: Use the stroke and fill color pickers
- **Change style**: Modify stroke width, roughness, fill style

### Advanced Rotation (via Console)

To rotate your 3D shapes, open the browser console (F12) and use:

```javascript
// Get the selected 3D shape
const api = window.excalidrawAPI;
const elements = api.getSceneElements();
const shape3d = elements.find(
  (el) => el.type === "cube" || el.type === "rectangularPrism",
);

if (shape3d && shape3d.customData?.shape3d) {
  // Rotate it
  shape3d.customData.shape3d.rotationX = 0.5; // Tilt forward/back
  shape3d.customData.shape3d.rotationY = 0.8; // Turn left/right
  shape3d.customData.shape3d.rotationZ = 0.2; // Rotate clockwise/counter

  // Update the scene
  api.updateScene({ elements: [...elements] });
}
```

## 📐 Default Settings

Both 3D shapes are created with these defaults:

- **Rotation X (Pitch)**: 0.3 radians (~17°)
- **Rotation Y (Yaw)**: 0.4 radians (~23°)
- **Rotation Z (Roll)**: 0 radians (no roll)
- **Perspective**: 800 (balanced view)
- **Depth**:
  - Cube: Equal to width
  - Rectangular Prism: 50% of width

## 🔄 Rotation Explained

- **Rotation X (Pitch)**: Tilts the shape forward/backward (like nodding "yes")
- **Rotation Y (Yaw)**: Turns the shape left/right (like shaking head "no")
- **Rotation Z (Roll)**: Rotates the shape clockwise/counter-clockwise (like tilting head)

All rotations are in **radians**:

- `0` = no rotation
- `Math.PI / 4` = 45°
- `Math.PI / 2` = 90°
- `Math.PI` = 180°

## 🎨 Example Use Cases

### Create a Stack of Cubes

1. Click the Cube tool
2. Draw a cube
3. Press **Ctrl+D** (duplicate)
4. Move it above the first cube
5. Repeat!

### Create a 3D Scene

1. Draw a large rectangular prism for the ground
2. Add several cubes of different sizes
3. Arrange them to create a simple 3D scene

### Design a Logo

1. Create a cube
2. Use different stroke colors and fill styles
3. Rotate it via console for the perfect angle

## 🔧 Troubleshooting

### Shape doesn't appear

- Make sure you clicked and dragged (not just clicked)
- Check that the shape tool is selected (highlighted in the toolbar)
- Try refreshing the page

### Can't find the icons

- Look between the Ellipse (○) and Arrow (→) tools
- The cube icon looks like a 3D box with visible edges
- The rectangular prism looks similar but more elongated

### Want to rotate shapes interactively

- Currently rotation requires console commands
- Future UI controls for rotation are planned!
- See the rotation example above

## 📝 Pro Tips

1. **Start simple**: Create a few cubes first to get familiar
2. **Experiment with colors**: Use different strokes and fills
3. **Use the roughness slider**: Lower roughness = cleaner edges
4. **Copy and paste**: Create one good shape, then duplicate it
5. **Check the console**: Use `console.log(shape3d)` to inspect your shapes

## 🎯 Next Steps

Once you're comfortable with basic 3D shapes:

1. Experiment with rotation via console
2. Try creating complex 3D scenes
3. Combine 3D shapes with 2D elements
4. Export your creations!

## 📚 More Information

- Full documentation: `/home/agam/Documents/excalidraw/3D_SHAPES_GUIDE.md`
- Quick start guide: `/home/agam/Documents/excalidraw/QUICKSTART_3D.md`

---

## 🎉 You're Ready!

The 3D shapes are now part of Excalidraw! Just click the icon and start drawing. Have fun creating amazing 3D artwork! 🚀

**Need help?** Check the browser console for any errors, or see the detailed guides mentioned above.
