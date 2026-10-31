"""Build and render a Renovagent room model in Blender (headless).

Run through scripts/render-room.ts, which writes room-model.json from the same
core RoomModel the web 3D view and plan drawing use. Plan (x, y) metres map to
Blender (x, -y), Z up, so the top view matches the plan drawing. Walls whose
height or thickness the plan does not give are drawn with display stand-ins in
an orange "not measured" material and flagged in the GLB extras.
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

model_path, out_dir = sys.argv[sys.argv.index("--") + 1 :][:2]
model = json.load(open(model_path))
look = model["look"]
DISPLAY_H, DISPLAY_T = 2.4, 0.08

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def hex_rgba(h):
    h = h.lstrip("#")
    srgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def material(name, rgba, rough=0.8, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    return m


def floor_material(kind):
    m = bpy.data.materials.new("Floor")
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    coord = nodes.new("ShaderNodeTexCoord")
    if kind in ("wood", "vinyl-plank"):
        base = (0.45, 0.28, 0.14, 1) if kind == "wood" else (0.42, 0.39, 0.34, 1)
        brick = nodes.new("ShaderNodeTexBrick")
        brick.inputs["Color1"].default_value = base
        brick.inputs["Color2"].default_value = tuple(c * 0.82 for c in base[:3]) + (1,)
        brick.inputs["Mortar"].default_value = (0.06, 0.04, 0.03, 1)
        brick.inputs["Scale"].default_value = 1.0
        brick.inputs["Mortar Size"].default_value = 0.003
        brick.inputs["Brick Width"].default_value = 1.2
        brick.inputs["Row Height"].default_value = 0.15
        brick.offset = 0.37
        links.new(coord.outputs["Object"], brick.inputs["Vector"])
        links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.4
    elif kind == "tile":
        brick = nodes.new("ShaderNodeTexBrick")
        brick.inputs["Color1"].default_value = (0.7, 0.68, 0.64, 1)
        brick.inputs["Color2"].default_value = (0.66, 0.64, 0.6, 1)
        brick.inputs["Mortar"].default_value = (0.35, 0.33, 0.3, 1)
        brick.inputs["Scale"].default_value = 1.0
        brick.inputs["Mortar Size"].default_value = 0.004
        brick.inputs["Brick Width"].default_value = 0.3
        brick.inputs["Row Height"].default_value = 0.3
        brick.offset = 0.0
        links.new(coord.outputs["Object"], brick.inputs["Vector"])
        links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.3
    else:
        bsdf.inputs["Base Color"].default_value = (0.55, 0.53, 0.5, 1)
        bsdf.inputs["Roughness"].default_value = 0.9 if kind == "carpet" else 0.7
    return m


def box(name, size, center, angle_z, mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    ob.location = center
    ob.rotation_euler = (0, 0, angle_z)
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        ob.data.materials.append(mat)
    return ob


P = lambda p, z=0.0: Vector((p[0], -p[1], z))
wall_mat = material("Walls", hex_rgba(look["wallHex"]), 0.9)
unknown_mat = material("Not measured", hex_rgba("#f97316"), 0.9, alpha=0.5)
fixture_mat = material("Existing fixture", hex_rgba("#dfe3e8"), 0.6)

cutters, xs, ys = [], [], []
for w in model["walls"]:
    a, b = P(w["a"]), P(w["b"])
    d = (b - a).normalized()
    ang = math.atan2(d.y, d.x)
    h = w["heightM"] or DISPLAY_H
    t = w["thicknessM"] or DISPLAY_T
    known = w["heightM"] is not None and not w["curved"]
    mid = (a + b) / 2
    ob = box("Wall", (w["lengthM"] + t, t, h), Vector((mid.x, mid.y, h / 2)), ang, wall_mat if known else unknown_mat)
    ob["renovagent_surface"] = "wall"
    ob["source_id"] = w["id"]
    ob["length_m"] = w["lengthM"]
    ob["height_m"] = w["heightM"] if w["heightM"] is not None else "not established"
    ob["thickness_measured"] = w["thicknessM"] is not None
    ob["verified"] = False
    for o in w["openings"]:
        c = a + d * o["alongM"]
        sill = o["sillM"] or 0.0
        z0 = -0.05 if sill <= 0.01 else sill
        z1 = sill + o["heightM"]
        cut = box(o["kind"], (o["widthM"], t + 0.4, z1 - z0), Vector((c.x, c.y, (z0 + z1) / 2)), ang)
        cut.hide_render = True
        cut.display_type = "WIRE"
        cutters.append(cut)
        mod = ob.modifiers.new("cut", "BOOLEAN")
        mod.object = cut
        mod.operation = "DIFFERENCE"
    xs += [a.x, b.x]
    ys += [a.y, b.y]

outline = model.get("floorOutline") or [[min(xs), -min(ys)], [max(xs), -min(ys)], [max(xs), -max(ys)], [min(xs), -max(ys)]]
mesh = bpy.data.meshes.new("Floor")
bm = bmesh.new()
verts = [bm.verts.new(P(p)) for p in outline]
bm.faces.new(verts)
bm.to_mesh(mesh)
bm.free()
floor = bpy.data.objects.new("Floor", mesh)
scene.collection.objects.link(floor)
floor.data.materials.append(floor_material(look["floorKind"]))
floor["renovagent_surface"] = "floor"
floor["finish"] = look["floorName"]
floor["outline_measured"] = model.get("floorOutline") is not None

for f in model["fixtures"]:
    h = f["heightM"] or 0.4
    c = P(f["center"], h / 2)
    ob = box(f["category"], (f["widthM"], f["depthM"], h), c, -f["rotationRad"], fixture_mat)
    ob["renovagent_surface"] = "fixture"
    ob["category"] = f["category"]
    ob["existing"] = True

cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
span = max(max(xs) - min(xs), max(ys) - min(ys), 2)
top = max([(w["heightM"] or DISPLAY_H) for w in model["walls"]])

world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.86, 0.95, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), 0, math.radians(-35)))
bpy.context.object.data.energy = 3.5
bpy.context.object.data.angle = math.radians(4)
bpy.context.object.data.color = (1.0, 0.92, 0.8)

scene.render.engine = "CYCLES"
# NVIDIA (OptiX, then CUDA) on Linux GPU hosts such as Modal; Metal on a Mac.
gpu = None
prefs = bpy.context.preferences.addons["cycles"].preferences
for kind in ("OPTIX", "CUDA", "METAL"):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
    except Exception:
        continue
    if any(d.type == kind for d in prefs.devices):
        for d in prefs.devices:
            d.use = d.type == kind
        scene.cycles.device = "GPU"
        gpu = kind
        break
print("Cycles device:", gpu or "CPU")
scene.cycles.samples = int(model.get("samples", 96))
scene.cycles.use_denoising = True
# Filmic and its looks exist in Blender 3.x; newer versions rename them.
try:
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
except TypeError as e:
    print("Keeping the default view transform:", e)


def shoot(name, location, target, ortho=None, size=(1600, 1000), lens=20):
    bpy.ops.object.camera_add(location=location)
    cam = bpy.context.object
    if ortho:
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = ortho
    else:
        cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.filepath = os.path.join(out_dir, name)
    bpy.ops.render.render(write_still=True)


shoot("perspective.png", (cx + span * 0.75, cy - span * 0.95, top + span * 0.7), (cx, cy, 0.9))
shoot("plan-top.png", (cx, cy, top + 20), (cx, cy + 0.0001, 0), ortho=span * 1.25, size=(1400, 1400))

bpy.ops.export_scene.gltf(
    filepath=os.path.join(out_dir, "room.glb"),
    export_format="GLB",
    export_extras=True,
    export_apply=True,
    use_renderable=True,
)
# Eye level from one corner, the same view as the web Photoreal still, with a
# ceiling and a ceiling light. Added after the export so room.glb stays the
# measured geometry only.
dx, dy = max(xs) - min(xs), max(ys) - min(ys)
bpy.ops.mesh.primitive_plane_add(size=1, location=(cx, cy, top))
ceiling = bpy.context.object
ceiling.scale = (dx + 0.4, dy + 0.4, 1)
ceiling.data.materials.append(material("Ceiling", hex_rgba("#f4f3ef"), 0.95))
bpy.ops.object.light_add(type="AREA", location=(cx, cy, top - 0.05))
lamp = bpy.context.object.data
lamp.shape = "RECTANGLE"
lamp.size, lamp.size_y = max(dx * 0.5, 0.5), max(dy * 0.5, 0.5)
lamp.energy = 30 * dx * dy
lamp.color = (1.0, 0.95, 0.88)
shoot(
    "interior.png",
    (cx + dx * 0.4, cy - dy * 0.4, 1.55),
    (cx - dx * 0.25, cy + dy * 0.25, 1.15),
    size=(1536, 1024),
    lens=16,
)
print("RENOVAGENT rendered", len(model["walls"]), "walls to", out_dir)
