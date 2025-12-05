/**
 * 3D transformation and projection utilities for rendering 3D shapes
 */

export type Point3D = {
  x: number;
  y: number;
  z: number;
};

export type Point2D = {
  x: number;
  y: number;
};

export type Matrix3D = number[][]; // 4x4 matrix for 3D transformations

/**
 * Create an identity matrix (4x4)
 */
export const identityMatrix = (): Matrix3D => {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
};

/**
 * Multiply two 4x4 matrices
 */
export const multiplyMatrices = (a: Matrix3D, b: Matrix3D): Matrix3D => {
  const result = identityMatrix();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] =
        a[i][0] * b[0][j] +
        a[i][1] * b[1][j] +
        a[i][2] * b[2][j] +
        a[i][3] * b[3][j];
    }
  }
  return result;
};

/**
 * Create a rotation matrix around the X axis
 */
export const rotationMatrixX = (angle: number): Matrix3D => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [1, 0, 0, 0],
    [0, cos, -sin, 0],
    [0, sin, cos, 0],
    [0, 0, 0, 1],
  ];
};

/**
 * Create a rotation matrix around the Y axis
 */
export const rotationMatrixY = (angle: number): Matrix3D => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [cos, 0, sin, 0],
    [0, 1, 0, 0],
    [-sin, 0, cos, 0],
    [0, 0, 0, 1],
  ];
};

/**
 * Create a rotation matrix around the Z axis
 */
export const rotationMatrixZ = (angle: number): Matrix3D => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    [cos, -sin, 0, 0],
    [sin, cos, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
};

/**
 * Create a combined rotation matrix from X, Y, Z rotations
 */
export const createRotationMatrix = (
  rotX: number,
  rotY: number,
  rotZ: number,
): Matrix3D => {
  const rx = rotationMatrixX(rotX);
  const ry = rotationMatrixY(rotY);
  const rz = rotationMatrixZ(rotZ);

  // Apply rotations in order: Z, Y, X
  return multiplyMatrices(multiplyMatrices(rx, ry), rz);
};

/**
 * Transform a 3D point using a transformation matrix
 */
export const transformPoint = (point: Point3D, matrix: Matrix3D): Point3D => {
  const { x, y, z } = point;
  return {
    x: matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z + matrix[0][3],
    y: matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z + matrix[1][3],
    z: matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z + matrix[2][3],
  };
};

/**
 * Project a 3D point to 2D using perspective projection
 * @param point - 3D point to project
 * @param perspective - Perspective distance (larger = less perspective)
 * @param centerX - Center X coordinate for projection
 * @param centerY - Center Y coordinate for projection
 */
export const projectTo2D = (
  point: Point3D,
  perspective: number,
  centerX: number = 0,
  centerY: number = 0,
): Point2D => {
  // Simple perspective projection
  const scale = perspective / (perspective + point.z);

  return {
    x: centerX + point.x * scale,
    y: centerY + point.y * scale,
  };
};

/**
 * Get the 8 vertices of a rectangular prism (box)
 * @param width - Width (X dimension)
 * @param height - Height (Y dimension)
 * @param depth - Depth (Z dimension)
 * @param centerX - Center X position
 * @param centerY - Center Y position
 * @param centerZ - Center Z position
 */
export const getBoxVertices = (
  width: number,
  height: number,
  depth: number,
  centerX: number = 0,
  centerY: number = 0,
  centerZ: number = 0,
): Point3D[] => {
  const w2 = width / 2;
  const h2 = height / 2;
  const d2 = depth / 2;

  return [
    // Front face
    { x: centerX - w2, y: centerY - h2, z: centerZ + d2 }, // 0: Front bottom-left
    { x: centerX + w2, y: centerY - h2, z: centerZ + d2 }, // 1: Front bottom-right
    { x: centerX + w2, y: centerY + h2, z: centerZ + d2 }, // 2: Front top-right
    { x: centerX - w2, y: centerY + h2, z: centerZ + d2 }, // 3: Front top-left

    // Back face
    { x: centerX - w2, y: centerY - h2, z: centerZ - d2 }, // 4: Back bottom-left
    { x: centerX + w2, y: centerY - h2, z: centerZ - d2 }, // 5: Back bottom-right
    { x: centerX + w2, y: centerY + h2, z: centerZ - d2 }, // 6: Back top-right
    { x: centerX - w2, y: centerY + h2, z: centerZ - d2 }, // 7: Back top-left
  ];
};

/**
 * Get the edges of a box as pairs of vertex indices
 */
export const getBoxEdges = (): [number, number][] => {
  return [
    // Front face
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    // Back face
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    // Connecting edges
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
};

/**
 * Get the faces of a box as arrays of vertex indices
 * Each face is defined by 4 vertices in clockwise order
 */
export const getBoxFaces = (): number[][] => {
  return [
    [0, 1, 2, 3], // Front face
    [5, 4, 7, 6], // Back face
    [4, 0, 3, 7], // Left face
    [1, 5, 6, 2], // Right face
    [3, 2, 6, 7], // Top face
    [4, 5, 1, 0], // Bottom face
  ];
};

/**
 * Calculate the normal vector of a face (for back-face culling)
 */
export const calculateFaceNormal = (vertices: Point3D[]): Point3D => {
  if (vertices.length < 3) {
    return { x: 0, y: 0, z: 1 };
  }

  // Use first three vertices to calculate normal
  const v1 = {
    x: vertices[1].x - vertices[0].x,
    y: vertices[1].y - vertices[0].y,
    z: vertices[1].z - vertices[0].z,
  };

  const v2 = {
    x: vertices[2].x - vertices[0].x,
    y: vertices[2].y - vertices[0].y,
    z: vertices[2].z - vertices[0].z,
  };

  // Cross product
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x,
  };
};

/**
 * Check if a face is visible (front-facing) based on its normal
 */
export const isFaceVisible = (normal: Point3D): boolean => {
  // If normal's Z component is positive, face is front-facing
  return normal.z > 0;
};

/**
 * Sort faces by average Z depth (for painter's algorithm)
 */
export const sortFacesByDepth = (
  faces: Array<{ vertices: Point3D[]; faceIndex: number }>,
): Array<{ vertices: Point3D[]; faceIndex: number }> => {
  return faces.sort((a, b) => {
    const avgDepthA =
      a.vertices.reduce((sum, v) => sum + v.z, 0) / a.vertices.length;
    const avgDepthB =
      b.vertices.reduce((sum, v) => sum + v.z, 0) / b.vertices.length;

    // Sort by depth (farthest first for rendering)
    return avgDepthA - avgDepthB;
  });
};
