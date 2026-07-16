# Neon sign — the first RUNTIME-Blender spike (not a baked template).
#
# Proves the "logo becomes an object" tier: the logo's own vector paths turn
# into glowing neon tubes floating in front of a neutral wall, lit only by the
# tubes plus a faint environment, wrapped in thin volumetric fog and shot on a
# shallow-DoF long-ish lens. None of this is possible in the bake pipeline (the
# logo shapes the 3D geometry and the lighting), and none of it involves
# generative AI — SVG -> curves -> emission tubes -> Cycles is fully
# deterministic, so logo fidelity stays guaranteed.
#
# Per-order economics: this renders per logo (minutes, not milliseconds) —
# the premium queue/batch tier explored in the workflow README's candidate
# list, not the free instant tier.
#
# The look was tuned interactively (2026-07-16) against the XTRUST wordmark:
# neutral wall with fine natural relief (NOT cloudy albedo), a bounded fog box
# (a WORLD volume extinguishes the HDRI — see note in setup_world), an HDRI for
# subtle non-uniform ambience, thin 80%-radius tubes, extra glow, and an unreal
# f/0.1 aperture so the background dissolves. MCP/Blender-GUI is only the tuning
# cockpit; reproduction for any other logo is this headless CLI alone.
#
# Usage:
#   /Applications/Blender.app/Contents/MacOS/Blender -b \
#     -P labs/workflow/scripts/blender/neon_sign.py -- \
#     --svg /path/to/logo.svg --out /path/to/render.png \
#     [--width 1600] [--height 1200] [--samples 150] [--hdri /path/to/env.hdr]

import colorsys
import math
import os
import sys

import bmesh
import bpy

# ---- sign geometry ----
SIGN_WIDTH = 2.4        # target world width on the wall (wide wordmark reference)
SIGN_HEIGHT_MAX = 1.2   # cap so square/tall marks don't blow past the frame
TUBE_RADIUS = 0.0052    # ~10 mm neon tube (thinned to 80% during tuning)
SIGN_CENTER_Z = 1.55
STANDOFF = 0.05         # tubes float this far off... nothing now; the wall is set back
WALL_GAP = 0.35         # background wall sits this far behind the sign plane
WARM_WHITE = (1.0, 0.72, 0.42)
NEON_STRENGTH = 6.5     # emission; also the scene's main light (glow lands on wall)

# ---- camera (front, slightly from below, shallow DoF) ----
LENS = 50.0
FSTOP = 0.1             # unreal on purpose — the lens is what changes the whole read
CAM_DIR = (0.0, -0.989, -0.146)  # unit dir sign->camera: front, tilted down to look up
FILL_W = 0.68           # fraction of frame width the sign fills (drives camera distance)
FILL_H = 0.58
OUTPUT_ASPECT = 4 / 3   # workflow-neon-sign-v1 presentation contract

# ---- world / atmosphere ----
HDRI_URL = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr"
HDRI_FILE = "empty_warehouse_01_1k.hdr"
HDRI_STRENGTH = 0.22    # moody: fluctuation visible, neon still the star
HDRI_ROT_Z = 120.0      # degrees
FOG_DENSITY = 0.045
FOG_ANISO = 0.3


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = {
        "width": 1600,
        "height": 1200,
        "samples": 150,
        "hdri": None,
        "color_mode": "logo",
    }
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
        elif a == "--hdri":
            args["hdri"] = next(it)
        elif a == "--color-mode":
            args["color_mode"] = next(it)
    if "svg" not in args or "out" not in args:
        raise SystemExit("neon_sign: --svg and --out are required")
    if args["width"] <= 0 or args["height"] <= 0:
        raise SystemExit("neon_sign: --width and --height must be positive")
    if not math.isclose(args["width"] / args["height"], OUTPUT_ASPECT,
                        rel_tol=0.0, abs_tol=1e-6):
        raise SystemExit("neon_sign: workflow-neon-sign-v1 output must be 4:3")
    if args["color_mode"] not in ("logo", "warm-white"):
        raise SystemExit("neon_sign: --color-mode must be logo or warm-white")
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


def emission_material(name, rgb, strength=NEON_STRENGTH):
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


def import_logo_tubes(svg_path, color_mode="logo"):
    """SVG -> curve objects -> neon tubes, normalized to SIGN_WIDTH and
    mounted on the sign plane (XZ, facing the camera at -Y)."""
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
    # Fit by width, but never taller than SIGN_HEIGHT_MAX (mark-only logos are square).
    scale = min(SIGN_WIDTH / max(w, 1e-6), SIGN_HEIGHT_MAX / max(h, 1e-6))
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
        rgb = WARM_WHITE if color_mode == "warm-white" else neon_color(fills[obj.name])
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


def neutral_wall_material():
    """A plain neutral wall. No bitmaps, no cloudy albedo — just fine, natural
    normal relief so the surface has micro-complexity that reads as a soft
    shading fluctuation (breaks the mechanical CG flatness) even under the
    heavy f/0.1 blur. Base color stays uniform on purpose."""
    mat = bpy.data.materials.new("NeutralWall")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (0.54, 0.53, 0.52, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.86
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.25

    coord = nt.nodes.new("ShaderNodeTexCoord")
    # mid-scale organic undulation (relief, not albedo) + a finer grain on top
    n_mid = nt.nodes.new("ShaderNodeTexNoise")
    n_mid.inputs["Scale"].default_value = 5.0
    n_mid.inputs["Detail"].default_value = 8.0
    n_mid.inputs["Roughness"].default_value = 0.55
    n_fine = nt.nodes.new("ShaderNodeTexNoise")
    n_fine.inputs["Scale"].default_value = 32.0
    n_fine.inputs["Detail"].default_value = 6.0
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.inputs["Fac"].default_value = 0.4
    nt.links.new(coord.outputs["Object"], n_mid.inputs["Vector"])
    nt.links.new(coord.outputs["Object"], n_fine.inputs["Vector"])
    nt.links.new(n_mid.outputs["Fac"], mix.inputs["Color1"])
    nt.links.new(n_fine.outputs["Fac"], mix.inputs["Color2"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.03
    nt.links.new(mix.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    # barely-there roughness variation for micro-realism
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = 0.82
    mr.inputs["To Max"].default_value = 0.9
    nt.links.new(n_mid.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], bsdf.inputs["Roughness"])
    return mat


def add_fog_box():
    """Bounded volumetric fog around the whole shot (camera sits inside it).
    A WORLD volume would fill infinite space and extinguish ALL environment
    light before it reaches any surface — that is why the HDRI must light the
    scene through a *bounded* medium, not a world volume."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, -2.0, 1.5))
    fog = bpy.context.active_object
    fog.name = "FogVolume"
    fog.scale = (12.0, 9.0, 8.0)
    fog.display_type = "WIRE"
    mat = bpy.data.materials.new("Fog")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vs = nt.nodes.new("ShaderNodeVolumeScatter")
    vs.inputs["Color"].default_value = (1, 1, 1, 1)
    vs.inputs["Density"].default_value = FOG_DENSITY
    vs.inputs["Anisotropy"].default_value = FOG_ANISO
    nt.links.new(vs.outputs["Volume"], out.inputs["Volume"])  # volume only -> box invisible
    fog.data.materials.append(mat)
    return fog


def ensure_hdri(args):
    """Return a local path to the environment HDRI, downloading the CC0
    Poly Haven asset into the gitignored var/ cache on first run. Returns
    None if unavailable (the world then falls back to a flat dim ambient)."""
    if args.get("hdri") and os.path.exists(args["hdri"]):
        return args["hdri"]
    script_dir = os.path.dirname(os.path.abspath(__file__))
    cache_dir = os.path.normpath(
        os.path.join(script_dir, "..", "..", "..", "..", "var", "workflow-lab", "hdri")
    )
    os.makedirs(cache_dir, exist_ok=True)
    dst = os.path.join(cache_dir, HDRI_FILE)
    if not os.path.exists(dst):
        try:
            import urllib.request

            urllib.request.urlretrieve(HDRI_URL, dst)
        except Exception as e:
            print(f"neon_sign: HDRI download failed ({e}); using flat ambient")
            return None
    return dst


def setup_world(scene, hdri_path):
    world = bpy.data.worlds.new("Night")
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    bg.inputs["Strength"].default_value = HDRI_STRENGTH
    if hdri_path:
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(hdri_path, check_existing=True)
        for cs in ("Linear Rec.709", "Linear"):
            try:
                env.image.colorspace_settings.name = cs
                break
            except Exception:
                continue
        env.image.reload()
        coord = nt.nodes.new("ShaderNodeTexCoord")
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Rotation"].default_value = (0.0, 0.0, math.radians(HDRI_ROT_Z))
        nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
        nt.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    else:
        bg.inputs["Color"].default_value = (0.10, 0.11, 0.14, 1.0)
    scene.world = world
    return world


def sign_bounds(tubes):
    """World-space AABB of the evaluated, beveled tube geometry.

    Spline control points are not the visible curve bounds: Bezier handles can
    push the rendered outline far away from their control points. Framing from
    those points put some logos well above the image center. Evaluating each
    curve to a mesh measures the geometry Cycles actually renders.
    """
    from mathutils import Vector

    xs, ys, zs = [], [], []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for tube in tubes:
        evaluated = tube.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mw = evaluated.matrix_world
            for vertex in mesh.vertices:
                wp = mw @ vertex.co
                xs.append(wp.x)
                ys.append(wp.y)
                zs.append(wp.z)
        finally:
            evaluated.to_mesh_clear()
    if not xs:
        raise SystemExit("neon_sign: tubes contain no evaluated geometry to frame")
    return Vector((min(xs), min(ys), min(zs))), Vector((max(xs), max(ys), max(zs)))


def frame_camera(scene, tubes):
    """Place the camera front-and-slightly-below, pulled back to fit the
    measured sign at FILL_W/FILL_H. Works for any logo aspect (wordmark or
    square mark) without re-tuning."""
    from mathutils import Vector

    mn, mx = sign_bounds(tubes)
    center = (mn + mx) / 2
    sw = max(mx.x - mn.x, 1e-4)
    sh = max(mx.z - mn.z, 1e-4)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = LENS
    sensor = cam_data.sensor_width  # 36 mm, AUTO-fit to the wider (horizontal) dim
    aspect = scene.render.resolution_y / scene.render.resolution_x
    hfov = 2 * math.atan((sensor / 2) / LENS)
    vfov = 2 * math.atan((sensor * aspect / 2) / LENS)
    dist_w = (sw / 2 / FILL_W) / math.tan(hfov / 2)
    dist_h = (sh / 2 / FILL_H) / math.tan(vfov / 2)
    dist = max(dist_w, dist_h, 1.5)

    cam = bpy.data.objects.new("Camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = center + Vector(CAM_DIR) * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = (center - cam.location).length
    cam_data.dof.aperture_fstop = FSTOP
    cam_data.dof.aperture_blades = 6
    scene.camera = cam
    print(
        "neon_sign framing: "
        f"output={scene.render.resolution_x}x{scene.render.resolution_y} "
        f"bounds=({mn.x:.4f},{mn.z:.4f})-({mx.x:.4f},{mx.z:.4f}) "
        f"center=({center.x:.4f},{center.z:.4f}) distance={dist:.4f}"
    )
    return cam


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

    # Neutral wall, set back behind the sign so f/0.1 dissolves it.
    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0, -STANDOFF + WALL_GAP, 1.8),
                                     rotation=(math.radians(90), 0, 0))
    wall = bpy.context.active_object
    wall.name = "Wall"
    wall.data.materials.append(neutral_wall_material())

    setup_world(scene, ensure_hdri(args))
    add_fog_box()

    tubes = import_logo_tubes(args["svg"], args["color_mode"])
    frame_camera(scene, tubes)

    # Compositor glow — the halo around the tubes.
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.glare_type = "FOG_GLOW"
    glare.quality = "HIGH"
    glare.threshold = 0.0   # everything above black blooms -> generous glow
    glare.size = 6
    glare.mix = 0.0
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
