# Shared studio for all baked 3D templates — the one place the "logos studio"
# look lives. Every scene script imports this so mug / tote / bottle etc. are
# shot in the same room with the same background behaviour.
#
# Recipe (established 2026-07-15, see workflow README):
#   - infinity cove: ONE large-radius filleted sheet (radius ~1.3 m), never a
#     separate floor+wall (that reads as a stepped "wall line")
#   - big soft overhead wash evens the cove into a gentle top-dark ->
#     bottom-light gradient; low albedo (0.60) keeps the floor off 255
#   - smoothness is judged by MEASUREMENT, not by eye: the background column
#     must be monotonic, clip-free, dip-free (scratchpad measure script)

import math

import bmesh
import bpy


def look_at(obj, target):
    from mathutils import Vector

    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def new_matte_material(name, value, roughness=0.6):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (value, value, value, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def build_cove(matte, radius=1.3, floor_front=-1.4, curve_start=0.10,
               wall_top=2.6, half_width=3.2, arc_steps=96):
    """Seamless studio cove (infinity sweep): one sheet where the floor
    fillets up into the back wall with a large radius, so no floor/wall seam
    is ever visible. A bigger radius = a smoother, softer horizon."""
    profile = [(floor_front, 0.0), (curve_start, 0.0)]
    cy, cz = curve_start, radius  # fillet centre
    for i in range(1, arc_steps + 1):
        ang = math.radians(270 + 90 * i / arc_steps)  # floor tangent -> wall
        profile.append((cy + radius * math.cos(ang), cz + radius * math.sin(ang)))
    profile.append((curve_start + radius, wall_top))

    bm = bmesh.new()
    left = [bm.verts.new((-half_width, y, z)) for (y, z) in profile]
    right = [bm.verts.new((half_width, y, z)) for (y, z) in profile]
    for a in range(len(profile) - 1):
        # Winding chosen so the normal faces the camera (-Y / +Z side).
        f = bm.faces.new((left[a], right[a], right[a + 1], left[a + 1]))
        f.smooth = True
    mesh = bpy.data.meshes.new("Cove")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("Cove", mesh)
    obj.data.materials.append(matte)
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


def setup_studio(resolution=(1600, 1200), samples=128, **cove_overrides):
    """Fresh scene + render settings + cove + world + background wash.
    Subject lights (key/fill/rim) stay in each scene script — they scale with
    the subject — but the room itself is identical across templates.
    cove_overrides tune the sweep for bigger subjects (e.g. floor_front for a
    camera further back) without changing the look."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.view_settings.view_transform = "Standard"

    studio_matte = new_matte_material("StudioWhite", 0.60, roughness=0.6)
    build_cove(studio_matte, **cove_overrides)

    world = bpy.data.worlds.new("Studio")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.85, 0.855, 0.87, 1.0)
    bg.inputs["Strength"].default_value = 0.5
    scene.world = world

    add_area_light("BGWash", (0.0, -0.15, 2.2), (0.0, 0.6, 0.0), size=4.0, energy=2.6)
    return scene


def add_camera(scene, location, focus, lens=85):
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = lens
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = location
    bpy.context.collection.objects.link(cam)
    look_at(cam, focus)
    scene.camera = cam
    return cam


def save_scene(out_path):
    import os

    abs_out = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(abs_out), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=abs_out)
    print(f"saved scene: {abs_out}")
