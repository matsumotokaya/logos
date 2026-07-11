// Three.js helpers shared by the 3D experiments (012-014).
//
// Turns a logo's SVG paths into a centered, normalized extruded THREE.Group.
// SVG uses a y-down coordinate system, so geometry is flipped on Y (by
// scaling the geometry itself, not the transform, to keep normals correct)
// and then recentered to the origin and scaled to a ~2-unit box.

import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { LabLogo } from "./experiment-api";

export type ExtrudeOptions = {
  /** Extrusion depth in SVG user units. Defaults to ~12% of the viewBox width. */
  depth?: number;
  bevel?: boolean;
  /** Build the material for a given path fill colour. Defaults to a matte standard material. */
  material?: (color: THREE.Color) => THREE.Material;
};

const DEFAULT_MATERIAL = (color: THREE.Color) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });

/** Extrude a logo's SVG into a centered, unit-scaled THREE.Group. SVG only. */
export function buildLogoExtrusion(
  logo: LabLogo,
  opts: ExtrudeOptions = {},
): THREE.Group {
  if (!logo.svg) throw new Error("buildLogoExtrusion needs an SVG logo.");

  const depth = opts.depth ?? Math.max(6, logo.viewBox.w * 0.12);
  const makeMaterial = opts.material ?? DEFAULT_MATERIAL;
  const bevel = opts.bevel ?? true;

  const parsed = new SVGLoader().parse(logo.svg);
  const group = new THREE.Group();

  for (const path of parsed.paths) {
    const fill = path.userData?.style?.fill;
    const color =
      fill && fill !== "none" && !fill.startsWith("url(")
        ? new THREE.Color(fill)
        : new THREE.Color("#101012");
    const material = makeMaterial(color);

    for (const shape of SVGLoader.createShapes(path)) {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: bevel,
        bevelThickness: depth * 0.05,
        bevelSize: depth * 0.03,
        bevelSegments: 2,
        curveSegments: 12,
      });
      // Flip Y in geometry space (SVG is y-down) and fix normals.
      geometry.scale(1, -1, 1);
      geometry.computeVertexNormals();
      group.add(new THREE.Mesh(geometry, material));
    }
  }

  // Recenter to origin and normalize to a ~2-unit box.
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  for (const child of group.children) child.position.sub(center);
  const scale = 2 / Math.max(size.x, size.y, 0.0001);
  group.scale.setScalar(scale);

  return group;
}

/** Dispose all geometries and materials under a group (call on unmount). */
export function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}
