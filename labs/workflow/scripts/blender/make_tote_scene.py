# Procedural master scene for the canvas-tote template (Phase 2 bake pipeline).
#
# The Blender-only wins this template exists to prove:
#   - real fabric drape: the bag billows/wrinkles via 3D displacement, and the
#     PrintSurface shell shares the exact same displacement field, so the
#     baked uv map bends the logo INTO the wrinkles
#   - woven texture: a "PrintLight" material (white + the same canvas-weave
#     bump as the bag) makes the printed logo inherit the weave shading —
#     ink sitting on fabric, not a sticker floating above it
#
# Usage:
#   /Applications/Blender.app/Contents/MacOS/Blender -b \
#     -P labs/workflow/scripts/blender/make_tote_scene.py -- \
#     --out var/workflow-lab/scenes/tote-canvas.blend
#
# Conventions consumed by bake_template.py: "PrintSurface" object with
# 0..1 UVs + "logos_print_aspect" prop, optional "PrintLight" material.

import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from studio import add_area_light, add_camera, save_scene, setup_studio  # noqa: E402

# Bag dimensions (m): width x depth x height, resting on the floor.
BAG_W, BAG_D, BAG_H = 0.36, 0.10, 0.38
ECRU = (0.80, 0.76, 0.68, 1.0)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = "var/workflow-lab/scenes/tote-canvas.blend"
    it = iter(argv)
    for a in it:
        if a == "--out":
            out = next(it)
    return out


def weave_bump_nodes(nt, strength=0.18):
    """Two perpendicular wave textures -> bump normal (canvas weave)."""
    coord = nt.nodes.new("ShaderNodeTexCoord")
    wave_x = nt.nodes.new("ShaderNodeTexWave")
    wave_y = nt.nodes.new("ShaderNodeTexWave")
    for wave, direction in ((wave_x, "X"), (wave_y, "Y")):
        wave.wave_type = "BANDS"
        wave.bands_direction = direction
        wave.inputs["Scale"].default_value = 320.0
        wave.inputs["Distortion"].default_value = 0.4
        wave.inputs["Detail"].default_value = 2.0
        nt.links.new(coord.outputs["Object"], wave.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "MAXIMUM"
    nt.links.new(wave_x.outputs["Fac"], mix.inputs[0])
    nt.links.new(wave_y.outputs["Fac"], mix.inputs[1])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength * 0.7
    bump.inputs["Distance"].default_value = 0.0004
    nt.links.new(mix.outputs["Value"], bump.inputs["Height"])
    return bump


def new_canvas_material(name="Canvas", color=ECRU):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.9
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = 0.3
    bump = weave_bump_nodes(mat.node_tree)
    mat.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def new_print_light_material():
    """White version of the canvas: the light pass shades the logo with the
    same weave, so ink reads as printed on fabric."""
    mat = new_canvas_material("PrintLight", (1.0, 1.0, 1.0, 1.0))
    mat.use_fake_user = True  # kept even though no object uses it directly
    return mat


def add_displacement(obj, coords_empty):
    """Shared drape field: Clouds displacements sampled in the space of one
    empty, so the bag and the print shell wrinkle identically. The empty is
    stretched in Z, which elongates the noise into vertical drape folds."""
    for name, size, strength in (
        ("Billow", 0.50, 0.030),
        ("Fold", 0.22, 0.016),
        ("Wrinkle", 0.09, 0.005),
    ):
        tex = bpy.data.textures.get(name) or bpy.data.textures.new(name, "CLOUDS")
        tex.noise_scale = size
        mod = obj.modifiers.new(name, "DISPLACE")
        mod.texture = tex
        mod.texture_coords = "OBJECT"
        mod.texture_coords_object = coords_empty
        mod.strength = strength
        mod.direction = "NORMAL"


def build_bag(canvas, coords_empty):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, BAG_H / 2))
    bag = bpy.context.active_object
    bag.name = "BagBody"
    bag.scale = (BAG_W, BAG_D, BAG_H)
    bpy.ops.object.transform_apply(scale=True)
    bevel = bag.modifiers.new("Bevel", "BEVEL")
    bevel.width = 0.012
    bevel.segments = 3
    # Catmull-Clark (not simple) so the bevel rim smooths out instead of
    # leaving stacked ridges once displacement pushes along the normals.
    subdiv = bag.modifiers.new("Subdiv", "SUBSURF")
    subdiv.levels = 4
    subdiv.render_levels = 5
    add_displacement(bag, coords_empty)
    bag.data.materials.append(canvas)
    bpy.ops.object.shade_smooth()
    return bag


def build_strap(name, y, canvas):
    """Webbing loop over the top: a ribbon along a semi-ellipse in XZ,
    width across Y, sagging naturally over the bag mouth."""
    x_reach, z_base, z_rise, half_w, steps = 0.10, BAG_H - 0.02, 0.14, 0.016, 48
    bm = bmesh.new()
    near, far = [], []
    for i in range(steps + 1):
        theta = math.pi * (1 - i / steps)  # left attach -> over the top -> right
        x = x_reach * math.cos(theta)
        z = z_base + z_rise * math.sin(theta)
        near.append(bm.verts.new((x, y - half_w, z)))
        far.append(bm.verts.new((x, y + half_w, z)))
    for i in range(steps):
        f = bm.faces.new((near[i], far[i], far[i + 1], near[i + 1]))
        f.smooth = True
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(canvas)
    bpy.context.collection.objects.link(obj)
    solid = obj.modifiers.new("Solid", "SOLIDIFY")
    solid.thickness = 0.0045
    return obj


def build_print_surface(canvas, coords_empty):
    """Flat decal grid 0.4 mm in front of the bag face, sharing the bag's
    displacement so the logo lands in the same wrinkles."""
    size, cx, cz, grid = 0.24, 0.0, 0.185, 64
    y = -(BAG_D / 2) - 0.0004
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    pts = []
    for j in range(grid + 1):  # bottom -> top
        z = cz - size / 2 + size * j / grid
        pts.append([bm.verts.new((cx - size / 2 + size * i / grid, y, z)) for i in range(grid + 1)])
    for j in range(grid):
        for i in range(grid):
            f = bm.faces.new((pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]))
            f.smooth = True
            us = (i / grid, (i + 1) / grid, (i + 1) / grid, i / grid)
            vs = (1 - j / grid, 1 - j / grid, 1 - (j + 1) / grid, 1 - (j + 1) / grid)
            for loop, u, v in zip(f.loops, us, vs):
                loop[uv_layer].uv = (u, v)
    mesh = bpy.data.meshes.new("PrintSurface")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("PrintSurface", mesh)
    obj.data.materials.append(canvas)
    obj["logos_print_aspect"] = 1.0
    bpy.context.collection.objects.link(obj)
    add_displacement(obj, coords_empty)
    return obj


def main():
    out_path = parse_args()
    # Camera sits further back than the mug's, so pull the cove floor forward.
    scene = setup_studio(floor_front=-2.6)

    coords = bpy.data.objects.new("DrapeCoords", None)
    coords.scale = (1.0, 1.0, 2.4)  # stretch the noise into vertical folds
    bpy.context.collection.objects.link(coords)

    canvas = new_canvas_material()
    new_print_light_material()
    build_bag(canvas, coords)
    build_strap("StrapFront", -(BAG_D / 2) + 0.012, canvas)
    build_strap("StrapBack", (BAG_D / 2) - 0.012, canvas)
    build_print_surface(canvas, coords)

    # Raking key from the side so the drape folds actually cast shading on
    # the front face; frontal light would flatten the fabric completely.
    focus = (0.0, 0.0, 0.24)
    add_area_light("Key", (-1.5, -0.55, 0.85), focus, size=1.2, energy=10.0)
    add_area_light("Fill", (1.1, -0.9, 0.5), focus, size=1.2, energy=2.4)
    add_area_light("Rim", (0.2, 1.2, 1.0), focus, size=1.2, energy=7.0)

    add_camera(scene, (0.02, -1.55, 0.30), focus, lens=70)
    save_scene(out_path)


main()
