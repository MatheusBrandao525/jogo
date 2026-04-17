import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

export class AssetManager {
    private scene: BABYLON.Scene;
    public assets: { [key: string]: BABYLON.AbstractMesh[] } = {};

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    public async loadAsset(
        name: string, 
        folder: string, 
        filename: string, 
        fallbackBuilder: () => BABYLON.Mesh,
        normalizeSize: number = 2,
        colorHex: string | null = null // If null, keep original textures
    ): Promise<void> {
        let rootMesh: BABYLON.AbstractMesh;
        
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", folder, filename, this.scene);
            rootMesh = result.meshes[0];
            
            // Normalize scale strictly
            rootMesh.normalizeToUnitCube();
            rootMesh.scaling.scaleInPlace(normalizeSize);
            
            if (colorHex) {
                // Override with a stylized color if requested
                const mat = new BABYLON.StandardMaterial(`${name}_mat`, this.scene);
                mat.diffuseColor = BABYLON.Color3.FromHexString(colorHex);
                mat.specularColor = BABYLON.Color3.Black();
                result.meshes.forEach(m => m.material = mat);
            }
            
        } catch (e) {
            console.warn(`Asset ${filename} not found. Using procedural fallback for ${name}.`);
            rootMesh = fallbackBuilder();
            rootMesh.normalizeToUnitCube();
            rootMesh.scaling.scaleInPlace(normalizeSize);
        }

        rootMesh.isVisible = false;
        rootMesh.getChildMeshes().forEach(child => child.isVisible = false);

        if (!this.assets[name]) this.assets[name] = [];
        this.assets[name].push(rootMesh);
    }

    public spawnInstance(name: string, x: number, y: number, z: number, rotationY: number, sizeMultiplier: number = 1, shadowGen?: BABYLON.ShadowGenerator, enableCollisions: boolean = true) {
        const variants = this.assets[name];
        if (!variants || variants.length === 0) return null;

        // Randomly pick a variant for natural variety
        const base = variants[Math.floor(Math.random() * variants.length)];
        
        let instance: BABYLON.AbstractMesh;
        if (base instanceof BABYLON.Mesh && base.geometry) {
            instance = (base as BABYLON.Mesh).createInstance(`${name}_inst`);
        } else {
            instance = base.clone(`${name}_clone`, null, false) as BABYLON.AbstractMesh;
        }

        instance.position.set(x, y, z);
        instance.rotation = new BABYLON.Vector3(0, rotationY, 0);
        instance.scaling.setAll(sizeMultiplier);
        
        instance.getChildMeshes().forEach(child => {
            child.isVisible = true;
            child.checkCollisions = enableCollisions;
            if (shadowGen) shadowGen.addShadowCaster(child);
        });

        if (instance instanceof BABYLON.Mesh || instance.getClassName() === "InstancedMesh") {
            instance.checkCollisions = enableCollisions;
            if (shadowGen) shadowGen.addShadowCaster(instance);
        }

        return instance;
    }
}
