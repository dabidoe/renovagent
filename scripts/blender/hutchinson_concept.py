"""Listing-derived ground-floor concept, never a measured building model.

Printed room extents are transcribed from photo-20.jpg. Wall height, wall
thickness, openings, stair geometry and furniture are display-only stand-ins.
The living/dining area overlaps: dining is a zone, not another area to sum.
No room facts, takeoff, quote or construction document is produced here.
"""
import bpy, math, json, os, sys, hashlib
from mathutils import Vector

out = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
os.makedirs(out, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'NONE'
scene['status'] = 'listing-derived concept; not verified dimensions'
scene['source_photo'] = 'photo-20'
scene['display_only'] = 'wall heights/thickness, openings, stairs, furniture'

def mat(name, color, roughness=.7):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=roughness
    return m
walls=mat('Concept plaster',(.82,.85,.82))
floor=mat('Concept floor',(.63,.69,.65))
blue=mat('Reference blue',(.08,.31,.65))
wood=mat('Retained kitchen option',(.33,.23,.15))
white=mat('Simple furnishings',(.86,.84,.78))
dark=mat('Dark fixtures',(.07,.09,.09))
glass=mat('Window placeholder',(.61,.75,.85))

def box(name, location, scale, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    o=bpy.context.object;o.name=name;o.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material);o['basis']='display-only concept unless named listed room extent'
    if bevel:
        if hasattr(o.data, 'use_auto_smooth'):o.data.use_auto_smooth=True
        b=o.modifiers.new('Soft edges','BEVEL');b.width=bevel;b.segments=3
        o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o

ft=.3048
# Source printed extents: 13'1" × 23'2" open front room; 9'6" × 15'3" kitchen.
W=(13+1/12)*ft;L=(23+2/12)*ft;KW=9.5*ft;KL=15.25*ft
H=2.4 # display-only wall height, not a house measurement
T=.1 # display-only wall thickness
box('Listed living/dining footprint',(W/2,L/2,-.07),(W,L,.14),floor,.02)
box('Listed kitchen footprint',(KW/2,L+KL/2,-.07),(KW,KL,.14),floor,.02)

def wall(name,a,b,height):
    mid=((a[0]+b[0])/2,(a[1]+b[1])/2,height/2)
    ob=box(name,mid,((Vector(b)-Vector(a)).length,T,height),walls,.018)
    ob.rotation_euler.z=math.atan2(b[1]-a[1],b[0]-a[0])

wall('Left exterior',(0,0),(0,L+KL),H)
wall('Front cutaway',(0,0),(W,0),.22)
wall('Right cutaway',(W,0),(W,L),.35)
wall('Rear step in footprint',(W,L),(KW,L),.35)
wall('Kitchen right cutaway',(KW,L),(KW,L+KL),.35)
wall('Rear exterior',(0,L+KL),(KW,L+KL),H)
wall('Kitchen partition left',(0,L),(.83,L),1.1)
wall('Kitchen partition right',(KW-.37,L),(KW,L),1.1)
box('Rear window display placeholder',(KW/2,L+KL-.06,1.5),(1.15,.03,.85),glass,.02)

# Approximate circulation and furnishing positions from the listing drawing/photos.
stair_x=.75;stair_y=3.5
for i in range(12):
    h=(i+1)*.14
    box('Stair display placeholder %02d'%i,(stair_x/2,stair_y+i*.19,h/2),(stair_x,.2,h),white,.01)
def sofa(name,x,y,angle=0):
    parent=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(parent)
    for n,loc,sc in [('seat',(0,0,.28),(1.6,.7,.34)),('back',(0,.28,.62),(1.6,.15,.45)),('armL',(-.74,0,.48),(.16,.7,.4)),('armR',(.74,0,.48),(.16,.7,.4))]:
        o=box(name+' '+n,loc,sc,white,.06);o.parent=parent
    parent.location=(x,y,0);parent.rotation_euler.z=angle
sofa('Living seating concept',2.5,1.1)
sofa('Secondary seating concept',1.0,1.8,math.pi/2)
box('Living table concept',(2,2,.3),(.95,.52,.06),wood,.03)
box('Dining table concept',(2.4,5.6,.72),(1.25,.7,.08),wood,.03)
for x in [1.95,2.4,2.85]:
    for y in [4.97,6.23]:
        box('Dining seating display placeholder',(x,y,.42),(.34,.38,.12),white,.03)
        box('Dining chair back',(x,y+(.15 if y>5.6 else -.15),.7),(.34,.07,.5),white,.02)
box('Kitchen base cabinet concept',(.34,L+KL/2,.45),(.62,KL-.7,.9),wood,.02)
box('Kitchen counter concept',(.34,L+KL/2,.94),(.69,KL-.6,.08),white,.02)
box('Rear base cabinet concept',(KW/2,L+KL-.36,.45),(KW-.18,.64,.9),wood,.02)
box('Rear counter concept',(KW/2,L+KL-.36,.94),(KW-.12,.72,.08),white,.02)
box('Refrigerator display placeholder',(.4,L+.6,.94),(.72,.78,1.88),white,.03)
box('Sink display placeholder',(KW/2,L+KL-.4,.995),(.52,.38,.025),dark,.04)

bg=mat('Backdrop',(.94,.95,.92))
box('Backdrop',(W/2,(L+KL)/2,-.28),(200,200,.1),bg)
scene.world.color=(.8,.8,.8)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.82,.87,.9,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='AREA',location=(5,1,12));bpy.context.object.data.energy=1600;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=10
bpy.ops.object.camera_add(location=(13,-11,15))
cam=bpy.context.object;cam.rotation_euler=(Vector((W/2,(L+KL)/2,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=15.5;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1600;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Filmic'
scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(out,'blender-reference.png')
source_dir=os.path.abspath(os.path.join(out,'../../../.local/blender-sources'))
os.makedirs(source_dir,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(source_dir,'hutchinson-concept.blend'))
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type=='MESH' and obj.name!='Backdrop':obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'hutchinson-concept.glb'),export_format='GLB',use_selection=True,export_extras=True)
source=os.path.join(out,'photo-20.jpg')
with open(os.path.join(out,'blender-reference.json'),'w') as f:
    json.dump({'tool':'Blender','sourcePhoto':'photo-20','sourceSha256':hashlib.sha256(open(source,'rb').read()).hexdigest(),'basis':'Listing-plan concept; printed room extents, not site measurements','listedRoomExtents':{'openLivingDining':'13 ft 1 in × 23 ft 2 in','kitchen':'9 ft 6 in × 15 ft 3 in'},'displayOnly':['wall height and thickness','stair geometry','openings','furniture'],'outputs':['blender-reference.png','hutchinson-concept.glb']},f,indent=2)
print('RENOVAGENT Hutchinson listing concept rendered')
