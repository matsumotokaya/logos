# Neon sign — the first RUNTIME-Blender spike (not a baked template).
#
# Proves the "logo becomes an object" tier: the logo's own vector paths turn
# into glowing neon tubes on a dark brick wall, and the tube colors bleed
# onto the wall through real global illumination. None of this is possible
# in the bake pipeline (the logo shapes the 3D geometry and the lighting),
# and none of it involves generative AI — SVG -> curves -> emission tubes ->
# Cycles is fully deterministic, so logo fidelity stays guaranteed.
#
# Per-order economics: this renders per logo (minutes, not milliseconds) —
# the premium queue/batch tier explored in the workflow README's candidate
# list, not the free instant tier.
#
# Usage:
#   /Applications/Blender.app/Contents/MacOS/Blender -b \
#     -P labs/workflow/scripts/blender/neon_sign.py -- \
#     --svg /path/to/logo.svg --out /path/to/render.png \
#     [--width 1600] [--height 1200] [--samples 160]

import colorsys
import math
import sys

import bmesh
import bpy

SIGN_WIDTH = 1.2       # world meters on the wall
TUBE_RADIUS = 0.0065   # ~13 mm neon tube
SIGN_CENTER_Z = 1.55
STANDOFF = 0.05        # tubes float this far off the wall
WARM_WHITE = (1.0, 0.72, 0.42)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = {"width": 1600, "height": 1200, "samples": 160}
    it = iter(argv)
    for a in it:
        if a == "--svg":
            args["svg"] = next(it)
        elif a == "--out":
            args["out"] = next(it)
        elif a == "--width":
            args["width"] = int(next(it))
        elif a == "--height":
            args["height"] = int(next(it))
        elif a == "--samples":
            args["samples"] = int(next(it))
    if "svg" not in args or "out" not in args:
        raise SystemExit("neon_sign: --svg and --out are required")
    return args


def neon_color(base_rgb):
    """Tube color from the SVG fill: keep the hue at full glow; near-black /
    near-white fills become classic warm-white neon."""
    r, g, b = base_rgb[:3]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if v < 0.28 or s < 0.15:
        return WARM_WHITE
    r2, g2, b2 = colorsys.hsv_to_rgb(h, min(s * 1.2, 1.0), 1.0)
    return (r2, g2, b2)


def emission_material(name, rgb, strength=3.1):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*rgb, 1.0)
    emit.inputs["Strength"].default_value = strength
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def import_logo_tubes(svg_path):
    """SVG -> curve objects -> neon tubes, normalized to SIGN_WIDTH and
    mounted on the wall plane (XZ, facing the camera at -Y)."""
    try:
        bpy.ops.preferences.addon_enable(module="io_curve_svg")
    except Exception:
        pass  # bundled importer is usually already enabled
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=svg_path)
    curves = [o for o in set(bpy.data.objects) - before if o.type == "CURVE"]
    if not curves:
        raise SystemExit("neon_sign: no curves imported from the SVG")

    for obj in curves:
        if obj.name not in bpy.context.collection.objects:
            try:
                bpy.context.collection.objects.link(obj)
            except RuntimeError:
                pass  # already linked via the importer's own collection

    # Original fill colors (importer stores them on the curve materials).
    fills = {}
    for obj in curves:
        mat = obj.data.materials[0] if obj.data.materials else None
        fills[obj.name] = tuple(mat.diffuse_color)[:3] if mat else (1, 1, 1)
        obj.data.dimensions = "3D"  # 2D curves reject transform_apply

    # Normalize: scale the whole group so its width is SIGN_WIDTH, center it.
    # (bound_box is not reliably evaluated right after a background-mode
    # import, so measure the spline control points directly.)
    xs, ys = [], []
    for obj in curves:
        for spline in obj.data.splines:
            pts = spline.bezier_points if len(spline.bezier_points) else spline.points
            for p in pts:
                wp = obj.matrix_world @ p.co.to_3d() if len(p.co) == 4 else obj.matrix_world @ p.co
                xs.append(wp.x)
                ys.append(wp.y)
    if not xs:
        raise SystemExit("neon_sign: imported curves contain no points")
    w = max(xs) - min(xs)
    h = max(ys) - min(ys)
    # Fit by width, but never taller than 0.8 m (mark-only logos are square).
    scale = min(SIGN_WIDTH / max(w, 1e-6), 0.8 / max(h, 1e-6))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2

    for obj in curves:
        obj.location.x = (obj.location.x - cx) * scale
        obj.location.y = (obj.location.y - cy) * scale
        obj.scale = (obj.scale[0] * scale, obj.scale[1] * scale, obj.scale[2] * scale)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in curves:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.transform_apply(location=True, scale=True)

    # Neon tubes = the OUTLINE of each shape, not its fill. An SVG <circle
    # fill> imports as a filled area; beveling that still renders the filled
    # cap. So reduce every shape to its boundary edges (mesh -> strip faces)
    # and re-tube those, which turns a filled disc into a glowing ring.
    mats = {}
    tubes = []
    for obj in curves:
        rgb = neon_color(fills[obj.name])
        tube = outline_to_tube(obj)
        if tube is None:
            continue
        key = tuple(round(c, 3) for c in rgb)
        if key not in mats:
            mats[key] = emission_material(f"Neon-{len(mats)}", rgb)
        tube.data.materials.clear()
        tube.data.materials.append(mats[key])
        tube.rotation_euler = (math.radians(90), 0, 0)  # XY plane -> XZ wall
        tube.location = (tube.location.x, -STANDOFF, SIGN_CENTER_Z - tube.location.y)
        tubes.append(tube)
    return tubes


def outline_to_tube(curve_obj):
    """Filled curve -> boundary-edge wire -> beveled tube (a glowing outline).
    Returns the tube object, or None if the shape had no usable boundary."""
    bpy.ops.object.select_all(action="DESELECT")
    curve_obj.select_set(True)
    bpy.context.view_layer.objects.active = curve_obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    me = obj.data

    bm = bmesh.new()
    bm.from_mesh(me)
    # Keep only boundary edges (an edge on the fill's rim borders <2 faces).
    boundary = [e for e in bm.edges if len(e.link_faces) <= 1]
    keep = set()
    for e in boundary:
        keep.update(e.verts)
    for f in list(bm.faces):
        bm.faces.remove(f)
    for e in list(bm.edges):
        if e not in boundary:
            bm.edges.remove(e)
    for v in list(bm.verts):
        if v not in keep:
            bm.verts.remove(v)
    if not bm.edges:
        bm.free()
        return None
    bm.to_mesh(me)
    bm.free()

    bpy.ops.object.convert(target="CURVE")
    tube = bpy.context.view_layer.objects.active
    data = tube.data
    data.dimensions = "3D"
    data.bevel_depth = TUBE_RADIUS
    data.bevel_resolution = 6
    data.resolution_u = 12
    data.use_fill_caps = True
    return tube


def brick_material():
    mat = bpy.data.materials.new("DarkBrick")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.inputs["Scale"].default_value = 2.4
    brick.inputs["Color1"].default_value = (0.052, 0.045, 0.048, 1)
    brick.inputs["Color2"].default_value = (0.072, 0.060, 0.058, 1)
    brick.inputs["Mortar"].default_value = (0.030, 0.030, 0.032, 1)
    brick.inputs["Mortar Size"].default_value = 0.012
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], brick.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.72
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 90.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def build_scene(args):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = args["samples"]
    scene.cycles.use_denoising = True
    scene.render.resolution_x = args["width"]
    scene.render.resolution_y = args["height"]
    scene.view_settings.view_transform = "Filmic"  # neon needs highlight rolloff
    scene.view_settings.look = "Medium High Contrast"

    # Wall
    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0, 0.0, 1.8),
                                     rotation=(math.radians(90), 0, 0))
    wall = bpy.context.active_object
    wall.name = "Wall"
    wall.data.materials.append(brick_material())

    # Near-dark ambience: the tubes are the light source.
    world = bpy.data.worlds.new("Night")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.05, 0.07, 0.11, 1.0)
    bg.inputs["Strength"].default_value = 0.06
    scene.world = world

    tubes = import_logo_tubes(args["svg"])

    # Camera: slightly off-axis and below, looking up — storefront feel.
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 50
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (0.5, -2.5, 1.30)
    bpy.context.collection.objects.link(cam)
    from mathutils import Vector

    d = Vector((0.0, -STANDOFF, SIGN_CENTER_Z)) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    # Compositor bloom — the halo around the tubes.
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.glare_type = "FOG_GLOW"
    glare.quality = "HIGH"
    glare.threshold = 0.85
    glare.size = 4       # halo — too big blooms the tube into a solid disc
    glare.mix = -0.3
    comp = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], comp.inputs["Image"])
    return scene, tubes


def main():
    args = parse_args()
    scene, _ = build_scene(args)
    scene.render.filepath = args["out"]
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    bpy.ops.render.render(write_still=True)
    print(f"neon sign rendered: {args['out']}")


main()
