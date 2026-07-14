# Procedural master scene for the ceramic-mug template (Phase 2 bake pipeline).
#
# Builds the whole studio in Blender headlessly — mug, decal-shell print
# surface, lights, camera — and saves the .blend that bake_template.py bakes
# from. The .blend is a reproducible artifact (this script is the source),
# so it lives in gitignored var/, not in the repo.
#
# Usage:
#   /Applications/Blender.app/Contents/MacOS/Blender -b \
#     -P labs/workflow/scripts/blender/make_mug_scene.py -- \
#     --out var/workflow-lab/scenes/mug-ceramic.blend
#
# Scene conventions consumed by bake_template.py:
#   - A mesh object named "PrintSurface": decal shell hugging the printable
#     area, UV-mapped 0..1 (u left->right, v top->bottom in bake output),
#     with custom property "logos_print_aspect" = physical width / height.
#   - Everything else renders as the stage. PrintSurface is hidden in the
#     beauty pass and only drives the uv / light passes.

import math
import sys

import bmesh
import bpy
from mathutils import Vector


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = "var/workflow-lab/scenes/mug-ceramic.blend"
    it = iter(argv)
    for a in it:
        if a == "--out":
            out = next(it)
    return out


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def new_ceramic_material():
    mat = bpy.data.materials.new("Ceramic")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.89, 0.89, 0.90, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.14
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.35
    return mat


def new_matte_material(name, value, roughness=0.6):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (value, value, value, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def build_mug(ceramic):
    # Lathe profile (radius, z) in meters, outside -> rim -> inside.
    profile = [
        (0.000, 0.0000),
        (0.030, 0.0000),
        (0.038, 0.0015),
        (0.041, 0.0060),
        (0.042, 0.0140),
        (0.042, 0.0840),
        (0.0417, 0.0930),
        (0.0402, 0.0960),
        (0.0387, 0.0930),
        (0.0382, 0.0840),
        (0.038, 0.0140),
        (0.000, 0.0120),
    ]
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0.0, z)) for r, z in profile]
    for a, b in zip(verts, verts[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(
        bm,
        geom=bm.verts[:] + bm.edges[:],
        cent=(0, 0, 0),
        axis=(0, 0, 1),
        angle=2 * math.pi,
        steps=96,
        use_merge=True,
    )
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    mesh = bpy.data.meshes.new("MugBody")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("MugBody", mesh)
    obj.data.materials.append(ceramic)
    bpy.context.collection.objects.link(obj)

    # Handle: vertical torus embedded into the +X side of the wall.
    bpy.ops.mesh.primitive_torus_add(
        location=(0.052, 0.0, 0.050),
        rotation=(math.radians(90), 0.0, 0.0),
        major_radius=0.019,
        minor_radius=0.0052,
        major_segments=64,
        minor_segments=24,
    )
    handle = bpy.context.active_object
    handle.name = "MugHandle"
    handle.scale = (0.72, 1.0, 1.15)
    handle.data.materials.append(ceramic)
    bpy.ops.object.shade_smooth()
    return obj


def build_print_surface(ceramic):
    # Decal shell: cylinder band 0.4 mm proud of the wall, facing the camera.
    radius = 0.0424
    half_arc = math.radians(50)  # 100 degrees of the front face
    z0, z1 = 0.022, 0.078
    cols, rows = 64, 8

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    grid = []
    for j in range(rows + 1):
        z = z0 + (z1 - z0) * j / rows
        row = []
        for i in range(cols + 1):
            phi = -half_arc + 2 * half_arc * i / cols
            row.append(bm.verts.new((radius * math.sin(phi), -radius * math.cos(phi), z)))
        grid.append(row)
    bm.verts.index_update()
    for j in range(rows):
        for i in range(cols):
            face = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            face.smooth = True
            us = (i / cols, (i + 1) / cols, (i + 1) / cols, i / cols)
            # v runs top -> bottom in template space; j runs bottom -> top.
            vs = (1 - j / rows, 1 - j / rows, 1 - (j + 1) / rows, 1 - (j + 1) / rows)
            for loop, u, v in zip(face.loops, us, vs):
                loop[uv_layer].uv = (u, v)
    mesh = bpy.data.meshes.new("PrintSurface")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("PrintSurface", mesh)
    obj.data.materials.append(ceramic)
    obj["logos_print_aspect"] = (radius * 2 * half_arc) / (z1 - z0)
    bpy.context.collection.objects.link(obj)
    return obj


def add_area_light(name, location, target, size, energy):
    light = bpy.data.lights.new(name, "AREA")
    light.size = size
    light.energy = energy
    obj = bpy.data.objects.new(name, light)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    look_at(obj, target)
    return obj


def main():
    out_path = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1200
    scene.view_settings.view_transform = "Standard"

    ceramic = new_ceramic_material()
    build_mug(ceramic)
    build_print_surface(ceramic)

    # Floor catches the contact shadow; the world is a soft studio white.
    studio_matte = new_matte_material("StudioWhite", 0.74, roughness=0.6)
    bpy.ops.mesh.primitive_plane_add(size=6.0, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "Floor"
    floor.data.materials.append(studio_matte)

    # Seamless sweep: a backdrop wall behind the subject, same matte white.
    bpy.ops.mesh.primitive_plane_add(
        size=6.0, location=(0, 0.9, 3.0), rotation=(math.radians(90), 0, 0)
    )
    backdrop = bpy.context.active_object
    backdrop.name = "Backdrop"
    backdrop.data.materials.append(studio_matte)

    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.90, 0.905, 0.915, 1.0)
    bg.inputs["Strength"].default_value = 0.5
    scene.world = world

    # A soft top light lifts the upper backdrop out of shadow (studio sweep)
    # without washing out the mug's own key/fill/rim modelling.
    focus = (0.0, 0.0, 0.048)
    add_area_light("Key", (-0.22, -0.28, 0.30), focus, size=0.5, energy=2.4)
    add_area_light("Fill", (0.32, -0.22, 0.14), focus, size=0.4, energy=0.7)
    add_area_light("Rim", (0.06, 0.34, 0.28), focus, size=0.4, energy=1.3)
    add_area_light("Sweep", (0.0, 0.4, 1.4), (0.0, 0.9, 1.6), size=2.0, energy=8.0)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 85
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (0.01, -0.46, 0.14)
    bpy.context.collection.objects.link(cam)
    look_at(cam, focus)
    scene.camera = cam

    import os

    abs_out = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(abs_out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=abs_out)
    print(f"saved scene: {abs_out}")


main()
