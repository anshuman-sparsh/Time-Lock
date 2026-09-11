import { Mesh, Texture } from 'three';
import type { Object3D, Material, BufferGeometry } from 'three';
export function disposeObjects(root:Object3D) {
  const materials=new Set<Material>(),geometries=new Set<BufferGeometry>(),textures=new Set<Texture>();
  root.traverse(object=>{const mesh=object as Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);});
  for(const material of materials){for(const value of Object.values(material))if(value instanceof Texture)textures.add(value);material.dispose();}
  for(const geometry of geometries)geometry.dispose();for(const texture of textures)texture.dispose();root.clear();
}
