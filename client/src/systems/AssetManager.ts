import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

export class AssetManager {
    private scene: BABYLON.Scene;
    public assets: { [key: string]: BABYLON.Mesh | BABYLON.AbstractMesh } = {};

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    public async loadAsset(
        name: string, 
        folder: string, 
        filename: string, 
        fallbackBuilder: () => BABYLON.Mesh,
        normalizeSize: number = 2
    ): Promise<void> {
        let rootMesh: BABYLON.AbstractMesh;
        
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", folder, filename, this.scene);
            rootMesh = result.meshes[0];
            
            // Normalize scale strictly
            rootMesh.normalizeToUnitCube();
            rootMesh.scaling.scaleInPlace(normalizeSize);
            
            // Apply earth-tone standard material to loaded mesh components just in case their textures are heavy or absent
            const mat = new BABYLON.StandardMaterial(`${name}_mat`, this.scene);
            mat.diffuseColor = new BABYLON.Color3(0.4, 0.35, 0.3);
            mat.specularColor = BABYLON.Color3.Black(); // Matted low-poly look
            
            result.meshes.forEach(m => {
                m.material = mat;
            });
            
        } catch (e) {
            console.warn(`Asset ${filename} not found in ${folder}. Using procedural fallback for ${name}.`);
            rootMesh = fallbackBuilder();
            rootMesh.normalizeToUnitCube();
            rootMesh.scaling.scaleInPlace(normalizeSize);
        }

        rootMesh.isVisible = false;
        
        // Ensure children are invisible on the root mesh if it's a structural parent
        rootMesh.getChildMeshes().forEach(child => {
            child.isVisible = false;
        });

        this.assets[name] = rootMesh;
    }

    public spawnInstance(name: string, x: number, y: number, z: number, rotationY: number, sizeMultiplier: number = 1, shadowGen?: BABYLON.ShadowGenerator) {
        const base = this.assets[name];
        if (!base) return null;

        // Create an instance if base is a standard Mesh, or clone if it's a hierarchy
        let instance: BABYLON.AbstractMesh;
        
        if (base instanceof BABYLON.Mesh && base.geometry) {
            instance = (base as BABYLON.Mesh).createInstance(`${name}_inst`);
        } else {
            instance = base.clone(`${name}_clone`, null, false) as BABYLON.AbstractMesh;
        }

        instance.position.set(x, y, z);
        instance.rotation = new BABYLON.Vector3(0, rotationY, 0);
        instance.scaling.setAll(sizeMultiplier);
        
        // Root node might not have geometry, ensure children render
        instance.getChildMeshes().forEach(child => {
            child.isVisible = true;
            child.checkCollisions = true;
            if (shadowGen) shadowGen.addShadowCaster(child);
        });

        if (instance instanceof BABYLON.Mesh || instance.getClassName() === "InstancedMesh") {
            instance.checkCollisions = true;
            if (shadowGen) shadowGen.addShadowCaster(instance);
        }

        return instance;
    }
}
