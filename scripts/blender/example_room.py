"""Render the example living room: one furnished camera view, every finish.

Run through scripts/render-example-room.ts. Builds the labelled example room
(14 x 12 x 8 ft, the same synthetic dimensions the example project records),
furnishes it with Poly Haven CC0 models, then renders each work stage and each
wall/floor combination from one fixed camera. Pin positions are projected from
that camera so overlays line up with every image by construction.

Furniture and finishes are illustrative. Nothing here is a product photo.
"""
import json
import math
import os
import subprocess
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

assets, out_dir, samples, only = (sys.argv[sys.argv.index("--") + 1 :] + [""])[:4]
samples = int(samples)
FT = 0.3048
L, W, H = 14 * FT, 12 * FT, 8 * FT
T = 0.12  # wall thickness for the render shell; not a measured value

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def lin(hexcode):
    h = hexcode.lstrip("#")
    srgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb) + (1.0,)


def principled(name, color, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color) if isinstance(color, str) else color
    b.inputs["Roughness"].default_value = rough
    return m


def box(name, size, center, mat=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        ob.data.materials.append(mat)
    return ob


# ---- Finishes -------------------------------------------------------------
WALLS = {
    "existing": "#cbbd9f",  # tired beige, the "before"
    "warm-white": "#f1ebdd",
    "sage": "#a9b79c",
    "soft-blue": "#a3b8cc",
}
wall_mat = principled("Walls", WALLS["existing"], 0.92)


def image_floor(name, folder, size_m, hue_sat_val=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    b = n["Principled BSDF"]
    coord = n.new("ShaderNodeTexCoord")
    mapping = n.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1 / size_m, 1 / size_m, 1)
    l.new(coord.outputs["Object"], mapping.inputs["Vector"])

    def tex(file, color=True):
        t = n.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(os.path.join(assets, folder, file))
        if not color:
            t.image.colorspace_settings.name = "Non-Color"
        l.new(mapping.outputs["Vector"], t.inputs["Vector"])
        return t

    diffuse = tex("Diffuse.jpg").outputs["Color"]
    if hue_sat_val:
        hsv = n.new("ShaderNodeHueSaturation")
        hsv.inputs["Saturation"].default_value, hsv.inputs["Value"].default_value = hue_sat_val
        l.new(diffuse, hsv.inputs["Color"])
        diffuse = hsv.outputs["Color"]
    l.new(diffuse, b.inputs["Base Color"])
    rough = n.new("ShaderNodeMath")
    rough.operation = "MULTIPLY"
    rough.inputs[1].default_value = 0.8
    l.new(tex("Rough.jpg", False).outputs["Color"], rough.inputs[0])
    l.new(rough.outputs[0], b.inputs["Roughness"])
    nm = n.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.5
    l.new(tex("nor_gl.jpg", False).outputs["Color"], nm.inputs["Color"])
    l.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


def carpet():
    m = bpy.data.materials.new("Carpet")
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    b = n["Principled BSDF"]
    coord = n.new("ShaderNodeTexCoord")
    blotch = n.new("ShaderNodeTexNoise")
    blotch.inputs["Scale"].default_value = 1.5
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = lin("#9c8b70")
    ramp.color_ramp.elements[1].color = lin("#b3a387")
    l.new(coord.outputs["Object"], blotch.inputs["Vector"])
    l.new(blotch.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], b.inputs["Base Color"])
    pile = n.new("ShaderNodeTexNoise")
    pile.inputs["Scale"].default_value = 900
    pile.inputs["Detail"].default_value = 4
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    l.new(coord.outputs["Object"], pile.inputs["Vector"])
    l.new(pile.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Sheen"].default_value = 0.6
    return m


def subfloor():
    # Bare plywood after the carpet and pad come up: sheet seams every 4 x 8 ft.
    m = bpy.data.materials.new("Subfloor")
    m.use_nodes = True
    n, l = m.node_tree.nodes, m.node_tree.links
    b = n["Principled BSDF"]
    coord = n.new("ShaderNodeTexCoord")
    grain = n.new("ShaderNodeTexWave")
    grain.inputs["Scale"].default_value = 3
    grain.inputs["Distortion"].default_value = 6
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = lin("#b8946a")
    ramp.color_ramp.elements[1].color = lin("#d2b48c")
    l.new(coord.outputs["Object"], grain.inputs["Vector"])
    l.new(grain.outputs["Fac"], ramp.inputs["Fac"])
    sheets = n.new("ShaderNodeTexBrick")
    sheets.inputs["Scale"].default_value = 1
    sheets.inputs["Brick Width"].default_value = 8 * FT
    sheets.inputs["Row Height"].default_value = 4 * FT
    sheets.inputs["Mortar Size"].default_value = 0.004
    sheets.inputs["Mortar"].default_value = lin("#5a4630")
    sheets.offset = 0.5
    l.new(coord.outputs["Object"], sheets.inputs["Vector"])
    l.new(ramp.outputs["Color"], sheets.inputs["Color1"])
    l.new(ramp.outputs["Color"], sheets.inputs["Color2"])
    l.new(sheets.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85
    return m


FLOORS = {
    "carpet": carpet(),
    "subfloor": subfloor(),
    "lvp": image_floor("Vinyl plank", "laminate_floor_02", 1.7),
    "hardwood": image_floor("Hardwood", "wood_floor_deck", 1.8, (0.8, 1.05)),
}

# ---- Shell ----------------------------------------------------------------
white = principled("Trim", "#f4f1ea", 0.5)
ceiling_mat = principled("Ceiling", "#f2f0ea", 0.95)
glass = bpy.data.materials.new("Glass")
glass.use_nodes = True
gn = glass.node_tree.nodes
gn.remove(gn["Principled BSDF"])
transp = gn.new("ShaderNodeBsdfTransparent")
glass.node_tree.links.new(transp.outputs[0], gn["Material Output"].inputs["Surface"])

floor_ob = box("Floor", (L, W, 0.02), (L / 2, W / 2, -0.01), FLOORS["carpet"])
box("Ceiling", (L + 2 * T, W + 2 * T, 0.05), (L / 2, W / 2, H + 0.025), ceiling_mat)
walls = {
    "back": box("Back wall", (L + 2 * T, T, H), (L / 2, W + T / 2, H / 2), wall_mat),
    "left": box("Left wall", (T, W, H), (-T / 2, W / 2, H / 2), wall_mat),
    "front": box("Front wall", (L + 2 * T, T, H), (L / 2, -T / 2, H / 2), wall_mat),
    "right": box("Right wall", (T, W, H), (L + T / 2, W / 2, H / 2), wall_mat),
}

# Windows: (wall, centre along wall, width, sill, height). Plan positions are
# part of the illustrative render, not recorded openings.
WINDOWS = [("back", 1.15, 1.3, 0.8, 1.35), ("left", 1.55, 1.1, 0.8, 1.35)]
for wall, along, width, sill, height in WINDOWS:
    zc = sill + height / 2
    if wall == "back":
        c, size = Vector((along, W + T / 2, zc)), (width, T * 3, height)
        frame_axis = "x"
    else:
        c, size = Vector((-T / 2, along, zc)), (T * 3, width, height)
        frame_axis = "y"
    cut = box("cut", size, c)
    cut.hide_render = True
    cut.hide_viewport = True
    mod = walls[wall].modifiers.new("window", "BOOLEAN")
    mod.object = cut
    mod.operation = "DIFFERENCE"
    # Frame, sill and a pane of glass.
    f = 0.05
    if frame_axis == "x":
        for dz in (-height / 2, height / 2):
            box("frame", (width + f, T + 0.02, f), c + Vector((0, 0, dz)), white)
        for dx in (-width / 2, 0, width / 2):
            box("frame", (f * (0.6 if dx == 0 else 1), T + 0.02, height), c + Vector((dx, 0, 0)), white)
        box("sill", (width + 0.12, 0.08, 0.03), Vector((along, W - 0.03, sill - 0.015)), white)
        box("glass", (width, 0.01, height), c, glass)
    else:
        for dz in (-height / 2, height / 2):
            box("frame", (T + 0.02, width + f, f), c + Vector((0, 0, dz)), white)
        for dy in (-width / 2, 0, width / 2):
            box("frame", (T + 0.02, f * (0.6 if dy == 0 else 1), height), c + Vector((0, dy, 0)), white)
        box("sill", (0.08, width + 0.12, 0.03), Vector((0.03, along, sill - 0.015)), white)
        box("glass", (0.01, width, height), c, glass)
    # Portal light so sky light finds its way in with little noise.
    bpy.ops.object.light_add(type="AREA", location=c)
    portal = bpy.context.object
    portal.data.shape = "RECTANGLE"
    portal.data.size, portal.data.size_y = width, height
    portal.data.cycles.is_portal = True
    portal.rotation_euler = (math.radians(90), 0, 0) if wall == "back" else (0, math.radians(90), 0)
    if wall == "left":
        portal.rotation_euler = (math.radians(90), 0, math.radians(-90))

# Baseboards along the visible walls (and the others, for reflections).
bb_h, bb_d = 0.11, 0.015
box("baseboard", (L, bb_d, bb_h), (L / 2, W - bb_d / 2, bb_h / 2), white)
box("baseboard", (bb_d, W, bb_h), (bb_d / 2, W / 2, bb_h / 2), white)
box("baseboard", (L, bb_d, bb_h), (L / 2, bb_d / 2, bb_h / 2), white)
box("baseboard", (bb_d, W, bb_h), (L - bb_d / 2, W / 2, bb_h / 2), white)
box("crown", (L, 0.03, 0.06), (L / 2, W - 0.015, H - 0.03), white)
box("crown", (0.03, W, 0.06), (0.015, W / 2, H - 0.03), white)

# ---- Furniture (Poly Haven CC0) -------------------------------------------
furniture = []


def place(name, at, yaw_deg, target_width=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(assets, name, name + ".gltf"))
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre = (lo + hi) / 2
    for o in new:
        if o.parent is root:
            o.location -= Vector((centre.x, centre.y, lo.z))
    if target_width:
        s = target_width / (hi.x - lo.x)
        root.scale = (s, s, s)
    root.rotation_euler = (0, 0, math.radians(yaw_deg))
    root.location = at
    furniture.extend([root, *new])
    bpy.context.view_layer.update()
    return hi - lo


dims = {}
dims["sofa"] = place("Sofa_01", Vector((2.75, W - 0.45, 0)), 0, 1.9)
dims["pillows"] = place("throw_pillows_01", Vector((2.75, W - 0.62, 0.36)), 0, 1.1)
dims["table"] = place("modern_coffee_table_01", Vector((2.75, W - 1.6, 0)), 90)
dims["chair"] = place("ArmChair_01", Vector((0.8, 1.7, 0)), 125)
dims["plant"] = place("potted_plant_01", Vector((0.4, W - 0.4, 0)), 20)
print("RENOVAGENT furniture sizes", {k: [round(v, 2) for v in d] for k, d in dims.items()})

# ---- Light and camera -----------------------------------------------------
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
sky = world.node_tree.nodes.new("ShaderNodeTexSky")
sky.sky_type = "NISHITA"
sky.sun_elevation = math.radians(28)
sky.sun_rotation = math.radians(200)
sky.sun_intensity = 0.6
world.node_tree.links.new(sky.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(58), 0, math.radians(-120)))
sun = bpy.context.object.data
sun.energy = 4.0
sun.angle = math.radians(2)
sun.color = (1.0, 0.93, 0.84)
bpy.ops.object.light_add(type="AREA", location=(L / 2, W / 2, H - 0.05))
fill = bpy.context.object.data
fill.shape = "RECTANGLE"
fill.size, fill.size_y = L * 0.6, W * 0.6
fill.energy = 140
fill.color = (1.0, 0.95, 0.88)

bpy.ops.object.camera_add(location=(L - 0.3, 0.35, 1.45))
cam = bpy.context.object
cam.data.lens = 15
cam.data.sensor_width = 36
cam.rotation_euler = (Vector((1.35, W - 0.7, 0.95)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000

scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = True
    scene.cycles.device = "GPU"
except Exception as e:  # pragma: no cover - depends on the machine
    print("GPU unavailable, rendering on CPU:", e)
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.view_settings.view_transform = "Filmic"
scene.view_settings.look = "Medium Contrast"
scene.view_settings.exposure = 0.0

# ---- Pins: projected from the camera --------------------------------------
bpy.context.view_layer.update()


def project(p):
    v = world_to_camera_view(scene, cam, Vector(p))
    return [round(v.x, 4), round(1 - v.y, 4)]


anchors = {
    "wall-paint": project((L * 0.72, W - 0.01, 1.75)),
    "carpet-removal": project((1.7, 1.25, 0.0)),
    "floor": project((2.55, 1.5, 0.0)),
}
for name, (x, y) in anchors.items():
    assert 0.03 < x < 0.97 and 0.03 < y < 0.97, f"{name} pin falls outside the frame: {x}, {y}"

# ---- Variants -------------------------------------------------------------
# stage: before (furnished, old walls, carpet) -> carpet out (empty, subfloor)
# -> painted (empty, new walls, subfloor or kept carpet) -> done (furnished).
variants = [("before", "existing", "carpet", True), ("carpet-out", "existing", "subfloor", False)]
for wall in ("warm-white", "sage", "soft-blue"):
    variants += [(f"painted-{wall}-subfloor", wall, "subfloor", False)]
    variants += [(f"painted-{wall}-carpet", wall, "carpet", False)]
    for floor in ("carpet", "lvp", "hardwood"):
        variants += [(f"done-{wall}-{floor}", wall, floor, True)]
all_names = [v[0] for v in variants]
if only == "anchors":  # re-project pins only; the stills stay as rendered
    variants = []
elif only:
    variants = [v for v in variants if v[0] in only.split(",")]

os.makedirs(out_dir, exist_ok=True)
for name, wall, floor, furnished in variants:
    wall_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = lin(WALLS[wall])
    floor_ob.data.materials[0] = FLOORS[floor]
    for o in furniture:
        o.hide_render = not furnished
    png = os.path.join(out_dir, name + ".png")
    scene.render.filepath = png
    bpy.ops.render.render(write_still=True)
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", png[:-4] + ".jpg"],
        check=True,
        capture_output=True,
    )
    os.remove(png)
    print("RENOVAGENT rendered", name, flush=True)

json.dump(
    {
        "room": {"lengthFt": 14, "widthFt": 12, "heightFt": 8},
        "image": {"width": 1600, "height": 1000},
        "anchors": anchors,
        "walls": {k: v for k, v in WALLS.items()},
        "variants": all_names,
    },
    open(os.path.join(out_dir, "scene-test.json" if only and only != "anchors" else "scene.json"), "w"),
    indent=1,
)
print("RENOVAGENT done", len(variants), "variants")
