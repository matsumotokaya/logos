# Bake a Blender scene into a logos-2d-template@1 directory (Phase 2).
#
# Heavy tools run at template-creation time only (workflow README, principle
# 2): this script renders three passes and writes a template the pure-TS
# engine composites at order time with zero marginal cost.
#
#   stage.png  — beauty render, PrintSurface hidden (the blank product shot)
#   uvmap.png  — 16-bit PNG; R = u*coverage, G = v*coverage, B = coverage,
#                baked from an emission render of the PrintSurface UVs
#   light.png  — the scene re-rendered with PrintSurface as pure white
#                diffuse: real shading to multiply into the printed logo
#
# Scene conventions (see make_mug_scene.py):
#   - mesh object "PrintSurface" with 0..1 UVs and custom property
#     "logos_print_aspect" (physical width / height of the printable area)
#
# Usage:
#   /Applications/Blender.app/Contents/MacOS/Blender -b <scene.blend> \
#     -P labs/workflow/scripts/blender/bake_template.py -- \
#     --out labs/workflow/templates/mug-ceramic --id mug-ceramic \
#     [--name "Ceramic Mug"] [--name-ja "セラミックマグ"] [--samples 128]

import json
import os
import struct
import sys
import time
import zlib

import bpy
import numpy as np


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    args = {"name": "Ceramic Mug", "name_ja": "セラミックマグ", "samples": None, "order": 30}
    it = iter(argv)
    for a in it:
        if a == "--out":
            args["out"] = next(it)
        elif a == "--id":
            args["id"] = next(it)
        elif a == "--name":
            args["name"] = next(it)
        elif a == "--name-ja":
            args["name_ja"] = next(it)
        elif a == "--samples":
            args["samples"] = int(next(it))
        elif a == "--order":
            args["order"] = int(next(it))
    if "out" not in args or "id" not in args:
        raise SystemExit("bake_template: --out and --id are required")
    return args


def render_to(scene, filepath, file_format, color_mode="RGB", color_depth="8"):
    scene.render.filepath = filepath
    scene.render.image_settings.file_format = file_format
    scene.render.image_settings.color_mode = color_mode
    scene.render.image_settings.color_depth = color_depth
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"rendered {os.path.basename(filepath)} in {time.time() - t:.1f}s")


def write_png16_rgb(path, rgb):
    """rgb: float array (h, w, 3) in 0..1, top row first."""
    h, w, _ = rgb.shape
    data = np.clip(np.round(rgb * 65535.0), 0, 65535).astype(">u2")
    raw = b"".join(b"\x00" + data[y].tobytes() for y in range(h))

    def chunk(typ, body):
        c = struct.pack(">I", len(body)) + typ + body
        return c + struct.pack(">I", zlib.crc32(typ + body) & 0xFFFFFFFF)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 16, 2, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(raw, 6)))
        f.write(chunk(b"IEND", b""))


def make_uv_emission_material():
    mat = bpy.data.materials.new("_bake_uv_emit")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    combine = nt.nodes.new("ShaderNodeCombineColor")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    uv = nt.nodes.new("ShaderNodeUVMap")
    nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["X"], combine.inputs["Red"])
    nt.links.new(sep.outputs["Y"], combine.inputs["Green"])
    combine.inputs["Blue"].default_value = 1.0
    nt.links.new(combine.outputs["Color"], emit.inputs["Color"])
    emit.inputs["Strength"].default_value = 1.0
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_black_emission_material():
    mat = bpy.data.materials.new("_bake_black")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (0, 0, 0, 1)
    emit.inputs["Strength"].default_value = 0.0
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_white_diffuse_material():
    mat = bpy.data.materials.new("_bake_white")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    diff.inputs["Roughness"].default_value = 0.4
    nt.links.new(diff.outputs["BSDF"], out.inputs["Surface"])
    return mat


def swap_materials(obj, mat):
    """Replace every slot with mat; returns the original slot materials."""
    original = [slot.material for slot in obj.material_slots]
    if not obj.material_slots:
        obj.data.materials.append(mat)
        return original
    for slot in obj.material_slots:
        slot.material = mat
    return original


def restore_materials(obj, original):
    for slot, mat in zip(obj.material_slots, original):
        slot.material = mat


def main():
    args = parse_args()
    out_dir = os.path.abspath(args["out"])
    os.makedirs(out_dir, exist_ok=True)

    scene = bpy.context.scene
    if args["samples"]:
        scene.cycles.samples = args["samples"]
    w, h = scene.render.resolution_x, scene.render.resolution_y
    scene.render.resolution_percentage = 100

    ps = bpy.data.objects.get("PrintSurface")
    if ps is None:
        raise SystemExit('bake_template: object "PrintSurface" not found')
    aspect = ps.get("logos_print_aspect")
    if not aspect:
        raise SystemExit('bake_template: PrintSurface needs "logos_print_aspect"')

    meshes = [o for o in scene.objects if o.type == "MESH" and o is not ps]

    # --- Pass 1: beauty stage (PrintSurface hidden) -------------------------
    ps.hide_render = True
    render_to(scene, os.path.join(out_dir, "stage.png"), "PNG")

    # --- Pass 2: light (PrintSurface as white diffuse, scene untouched) -----
    # Convention: a material named "PrintLight" in the scene overrides the
    # plain white diffuse — e.g. white + canvas-weave bump so the printed
    # logo inherits the fabric texture, not just its large-scale shading.
    ps.hide_render = False
    light_mat = bpy.data.materials.get("PrintLight") or make_white_diffuse_material()
    ps_original = swap_materials(ps, light_mat)
    render_to(scene, os.path.join(out_dir, "light.png"), "PNG")

    # --- Pass 3: uv field (emission only, transparent film, no denoise) -----
    swap_materials(ps, make_uv_emission_material())
    black = make_black_emission_material()
    mesh_originals = [(o, swap_materials(o, black)) for o in meshes]
    saved = (
        scene.render.film_transparent,
        scene.cycles.use_denoising,
        scene.cycles.samples,
        scene.world,
    )
    scene.render.film_transparent = True
    scene.cycles.use_denoising = False
    scene.cycles.samples = 32
    scene.world = None
    uv_exr = os.path.join(out_dir, "_uv.exr")
    render_to(scene, uv_exr, "OPEN_EXR", color_mode="RGBA", color_depth="32")
    scene.render.film_transparent, scene.cycles.use_denoising, scene.cycles.samples, scene.world = saved
    for o, original in mesh_originals:
        restore_materials(o, original)
    restore_materials(ps, ps_original)

    # --- Convert the EXR to the premultiplied 16-bit uv map -----------------
    img = bpy.data.images.load(uv_exr)
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    px = buf.reshape(h, w, 4)[::-1, :, :3]  # top row first, drop alpha
    write_png16_rgb(os.path.join(out_dir, "uvmap.png"), px)
    bpy.data.images.remove(img)
    os.remove(uv_exr)

    # --- Print-region bounding box (canvas px, from coverage) ---------------
    cov = px[:, :, 2] > 0.02
    ys, xs = np.nonzero(cov)
    if xs.size == 0:
        raise SystemExit("bake_template: uv pass has zero coverage")
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())

    template = {
        "format": "logos-2d-template@1",
        "id": args["id"],
        "name": args["name"],
        "nameJa": args["name_ja"],
        "category": "product",
        "presentation": {
            "allowedPlacements": ["merch.primary"],
            "defaultMappings": [
                {"placementId": "merch.primary", "order": args["order"], "enabled": False}
            ],
        },
        "presentationScene": "merch",
        "presentationAdopted": False,
        "presentationOrder": args["order"],
        "canvas": {"width": w, "height": h},
        "stage": {"src": "stage.png"},
        "surface": {
            "corners": {
                "tl": [x0, y0],
                "tr": [x1, y0],
                "br": [x1, y1],
                "bl": [x0, y1],
            },
            "uvWarp": {"src": "uvmap.png", "aspect": float(aspect), "light": "light.png"},
            "logo": {
                "blend": "over",
                "placement": {"cx": 0.5, "cy": 0.5, "width": 0.88},
                "clearSpace": 0.12,
                "minWidth": 0.25,
                "maxWidth": 0.92,
            },
        },
        "impressions": ["プロダクト", "フォトリアル"],
        "notesJa": "Blender焼き込みパイプライン(Phase 2)による3Dテンプレート。舞台・UVワープマップ・陰影マップをCyclesで焼き出し、ロゴはUVフィールド経由で決定論的に合成する。",
    }
    with open(os.path.join(out_dir, "template.json"), "w", encoding="utf-8") as f:
        json.dump(template, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"template written: {out_dir}")


main()
