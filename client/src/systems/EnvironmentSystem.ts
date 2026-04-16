import * as BABYLON from 'babylonjs';
import { AssetManager } from './AssetManager';

export class EnvironmentSystem {
    private scene: BABYLON.Scene;
    public shadowGenerator: BABYLON.ShadowGenerator | null = null;
    private wallMaterial: BABYLON.StandardMaterial;
    private assetManager: AssetManager;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.assetManager = new AssetManager(scene);

        this.wallMaterial = new BABYLON.StandardMaterial("wallMat", scene);
        this.wallMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.45);
        this.wallMaterial.specularColor = BABYLON.Color3.Black();

        this.setupAtmosphere();
        this.setupLighting();
    }

    public async initialize() {
        await this.loadAssets();
        this.buildHybridMap();
    }

    private setupAtmosphere() {
        this.scene.clearColor = new BABYLON.Color4(0.4, 0.45, 0.5, 1);
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.005; // Slightly clearer
        this.scene.fogColor = new BABYLON.Color3(0.4, 0.45, 0.5);
    }

    private setupLighting() {
        const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), this.scene);
        ambient.intensity = 0.4;
        ambient.groundColor = new BABYLON.Color3(0.2, 0.2, 0.2);

        const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.6, -1, -0.4), this.scene);
        sun.position = new BABYLON.Vector3(100, 200, 100);
        sun.intensity = 1.0;

        this.shadowGenerator = new BABYLON.ShadowGenerator(1024, sun);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurKernel = 32;
    }

    private async loadAssets() {
        // Load Cliffs
        await this.assetManager.loadAsset("cliff", "/assets/", "cliff.glb", () => {
            const fallback = BABYLON.MeshBuilder.CreatePolyhedron("fallbackCliff", {type: 1, size: 1}, this.scene);
            return fallback;
        }, 15); // Large map boundary scale

        // Load Rocks
        await this.assetManager.loadAsset("rock", "/assets/", "rock.glb", () => {
            const fallback = BABYLON.MeshBuilder.CreatePolyhedron("fallbackRock", {type: 0, size: 1}, this.scene);
            return fallback;
        }, 4); // Medium cover scale

        // Load Props (Barrels/Crates)
        await this.assetManager.loadAsset("prop", "/assets/", "prop.glb", () => {
            const fallback = BABYLON.MeshBuilder.CreateCylinder("fallbackProp", {diameter: 1, height: 1.5}, this.scene);
            // Paint fallback a rusty color
            const mat = new BABYLON.StandardMaterial("propMat", this.scene);
            mat.diffuseColor = new BABYLON.Color3(0.6, 0.3, 0.1);
            fallback.material = mat;
            return fallback;
        }, 1.5); // Human sized cover
    }

    private buildHybridMap() {
        // Core Procedural Ground
        const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 400, height: 400}, this.scene);
        const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.25, 0.35, 0.2); // Earthy low-poly green
        groundMat.specularColor = BABYLON.Color3.Black(); 
        ground.material = groundMat;
        ground.receiveShadows = true;
        ground.checkCollisions = true;

        // --- 1. Procedural Hills ---
        // Organic elevation variations mapping flanks
        this.createHill(0, -60, 40, 10);
        this.createHill(0, 60, 40, 10);
        this.createHill(-60, -40, 30, 8);
        this.createHill(60, 40, 30, 8);

        // --- 2. Procedural Core Trenches & Bases ---
        // Frontline trenches
        this.createWall(-20, -15, 20, 2.5, 1, 0);
        this.createWall(-20, 15, 20, 2.5, 1, 0);
        this.createWall(20, -15, 20, 2.5, 1, 0);
        this.createWall(20, 15, 20, 2.5, 1, 0);

        // Sub-trenches
        this.createWall(0, -10, 10, 2.5, 1, 0);
        this.createWall(0, 10, 10, 2.5, 1, 0);

        // Bases
        this.createBasePlate(-100, 0, new BABYLON.Color3(0.2, 0.4, 0.9));
        this.createBasePlate(100, 0, new BABYLON.Color3(0.9, 0.2, 0.2));


        // --- 3. External Asset Integration ---
        // Boundaries using Cliffs
        for (let i = 0; i < 35; i++) {
            const angle = (i / 35) * Math.PI * 2;
            const radius = 135 + Math.random() * 5;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            this.assetManager.spawnInstance("cliff", x, 0, z, angle + Math.PI/2, Math.random() * 0.4 + 0.8, this.shadowGenerator!);
        }

        // Cover Rocks around Capture Zones and Procedural Hills
        // Near Center (0, 0)
        this.assetManager.spawnInstance("rock", -10, 0, -5, Math.random() * Math.PI, 1, this.shadowGenerator!);
        this.assetManager.spawnInstance("rock", 10, 0, 5, Math.random() * Math.PI, 1.2, this.shadowGenerator!);
        
        // Flank Rocks integrated into procedural hills perfectly
        this.assetManager.spawnInstance("rock", -20, 0, -40, Math.random() * Math.PI, 1.5, this.shadowGenerator!);
        this.assetManager.spawnInstance("rock", 20, 0, 40, Math.random() * Math.PI, 1.5, this.shadowGenerator!);

        // Small Props scattered selectively near trenches (immersion detailing)
        this.assetManager.spawnInstance("prop", -18, 0, -17, 0, 1, this.shadowGenerator!);
        this.assetManager.spawnInstance("prop", -19, 0, -17, 0, 1, this.shadowGenerator!);
        this.assetManager.spawnInstance("prop", 22, 0, 17, 0, 1, this.shadowGenerator!);
        this.assetManager.spawnInstance("prop", 5, 0, 12, 0, 1, this.shadowGenerator!);
    }

    // Existing Procedural Generators Preserved
    private createWall(x: number, z: number, w: number, h: number, d: number, rotation: number) {
        const wall = BABYLON.MeshBuilder.CreateBox("wall", {width: w, height: h, depth: d}, this.scene);
        wall.position.set(x, h/2, z);
        wall.rotation.y = rotation;
        wall.material = this.wallMaterial;
        wall.receiveShadows = true;
        wall.checkCollisions = true;
        if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(wall);
    }

    private createHill(x: number, z: number, diameter: number, height: number) {
        const hill = BABYLON.MeshBuilder.CreateSphere("hill", {diameter: diameter, segments: 16}, this.scene);
        hill.scaling.y = height / diameter;
        hill.position.set(x, 0, z);
        const mat = new BABYLON.StandardMaterial("hillMat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.3, 0.4, 0.25);
        mat.specularColor = BABYLON.Color3.Black();
        hill.material = mat;
        hill.checkCollisions = true;
        hill.receiveShadows = true;
        if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(hill);
    }

    private createBasePlate(x: number, z: number, color: BABYLON.Color3) {
        const flag = BABYLON.MeshBuilder.CreateCylinder("baseFlag", {diameter: 12, height: 0.2}, this.scene);
        flag.position.set(x, 0.05, z);
        const mat = new BABYLON.StandardMaterial("baseMat", this.scene);
        mat.diffuseColor = color;
        mat.emissiveColor = color.scale(0.3);
        flag.material = mat;
        flag.receiveShadows = true;

        // Base bunkers - structured covers
        this.createWall(x + 10, z + 10, 6, 3, 1, Math.PI / 4);
        this.createWall(x + 10, z - 10, 6, 3, 1, -Math.PI / 4);
        this.createWall(x - 10, z + 10, 6, 3, 1, -Math.PI / 4);
        this.createWall(x - 10, z - 10, 6, 3, 1, Math.PI / 4);

        // Scatter 2 props near each base
        this.assetManager.spawnInstance("prop", x + 5, 0, z - 2, 0, 1, this.shadowGenerator!);
        this.assetManager.spawnInstance("prop", x - 6, 0, z + 3, 0, 1, this.shadowGenerator!);
    }
}
