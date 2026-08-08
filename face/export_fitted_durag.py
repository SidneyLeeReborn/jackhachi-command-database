import bpy
from mathutils import Vector

head = bpy.data.objects.get("model")
durag_names = ["Object_4", "Object_5", "Object_6"]
durag_objects = [bpy.data.objects[name] for name in durag_names]

head_corners = [head.matrix_world @ Vector(corner) for corner in head.bound_box]
head_min = Vector((min(v.x for v in head_corners), min(v.y for v in head_corners), min(v.z for v in head_corners)))
head_max = Vector((max(v.x for v in head_corners), max(v.y for v in head_corners), max(v.z for v in head_corners)))
head_center = (head_min + head_max) * 0.5

export_objects = []
for source in durag_objects:
    mesh = source.data.copy()
    world_matrix = source.matrix_world.copy()
    for vertex in mesh.vertices:
        vertex.co = (world_matrix @ vertex.co - head_center) / 100.0
    exported = bpy.data.objects.new(f"FITTED_{source.name}", mesh)
    bpy.context.scene.collection.objects.link(exported)
    export_objects.append(exported)

bpy.ops.object.select_all(action="DESELECT")
for exported in export_objects:
    exported.select_set(True)
bpy.context.view_layer.objects.active = export_objects[0]

bpy.ops.export_scene.gltf(
    filepath=r"C:\Users\andre\Documents\Codex\2026-07-30\ja-den-blev-alt-for-bred\outputs\jackhachi-command-database\face\durag-fitted-raw.glb",
    export_format="GLB",
    use_selection=True,
    export_apply=True,
)
