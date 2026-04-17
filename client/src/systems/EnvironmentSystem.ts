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
        const fogColor = new BABYLON.Color3(0.55, 0.65, 0.75); // Atmospheric depth bleeding
        this.scene.clearColor = new BABYLON.Color4(fogColor.r, fogColor.g, fogColor.b, 1);
        this.scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
        this.scene.fogStart = 80;
        this.scene.fogEnd = 240;
        this.scene.fogColor = fogColor;

        // Simple Skybox
        const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size: 1000.0}, this.scene);
        const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.disableLighting = true;
        skybox.material = skyboxMaterial;
        skybox.infiniteDistance = true;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        
        // Sky Gradient (Emissive)
        skyboxMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.7, 0.9);
    }

    private setupLighting() {
        const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), this.scene);
        ambient.intensity = 0.5;
        ambient.groundColor = new BABYLON.Color3(0.1, 0.1, 0.15);

        const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.6, -1, -0.4).normalize(), this.scene);
        sun.position = new BABYLON.Vector3(100, 200, 100);
        sun.intensity = 1.2;

        this.shadowGenerator = new BABYLON.ShadowGenerator(2048, sun);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurKernel = 32;
        this.shadowGenerator.darkness = 0.4;
    }

    private async loadAssets() {
        const megaKitPath = "/Stylized Nature MegaKit[Standard]/glTF/";

        // Load Cliffs / Large Rocks
        await this.assetManager.loadAsset("cliff", megaKitPath, "RockPath_Round_Wide.gltf", () => {
             const fallback = BABYLON.MeshBuilder.CreatePolyhedron("fallbackCliff", {type: 2, size: 1}, this.scene);
             return fallback;
        }, 15);

        // Load Rocks (Variants)
        const rocks = ["Rock_Medium_1.gltf", "Rock_Medium_2.gltf", "Rock_Medium_3.gltf"];
        for (const r of rocks) {
            await this.assetManager.loadAsset("rock", megaKitPath, r, () => {
                return BABYLON.MeshBuilder.CreatePolyhedron("fallbackRock", {type: 1, size: 1}, this.scene);
            }, 4);
        }
        
        // Load Fences
        await this.assetManager.loadAsset("fence", "/Demo/Models/", "Fence Type2 03.dae", () => {
             return BABYLON.MeshBuilder.CreateBox("fallbackFence", {width: 2, height: 1.2, depth: 0.15}, this.scene);
        }, 3);

        // Load Props (Pebbles & Details)
        const pebbles = ["Pebble_Round_1.gltf", "Pebble_Square_1.gltf", "Mushroom_Common.gltf"];
        for (const p of pebbles) {
            await this.assetManager.loadAsset("prop", megaKitPath, p, () => {
                return BABYLON.MeshBuilder.CreateBox("fallbackProp", {size: 0.5}, this.scene);
            }, 1.5);
        }

        // Load Trees (Variants)
        const trees = ["CommonTree_1.gltf", "CommonTree_2.gltf", "CommonTree_3.gltf", "CommonTree_4.gltf"];
        for (const t of trees) {
            await this.assetManager.loadAsset("tree", megaKitPath, t, () => {
                const container = new BABYLON.Mesh("fallbackTree", this.scene);
                return container as any;
            }, 8);
        }

        // Load Conifers (Variants)
        const pines = ["Pine_1.gltf", "Pine_2.gltf", "Pine_3.gltf"];
        for (const p of pines) {
            await this.assetManager.loadAsset("conifer", megaKitPath, p, () => {
                 return new BABYLON.Mesh("fallbackPine", this.scene) as any;
            }, 10);
        }

        // Load Bushes
        await this.assetManager.loadAsset("bush", megaKitPath, "Bush_Common.gltf", () => {
            return BABYLON.MeshBuilder.CreatePolyhedron("fallbackBush", {type: 0, size: 0.8}, this.scene);
        }, 3);
        
        await this.assetManager.loadAsset("grass_model", megaKitPath, "Grass_Common_Tall.gltf", () => {
             return BABYLON.MeshBuilder.CreateBox("fallbackGrass", {size: 0.2}, this.scene);
        }, 1.2);

        // --- NEW ASSETS: Weapons ---
        const gunPath = "Guns-20260417T004541Z-3-001/Guns/glTF/";
        await this.assetManager.loadAsset("gun_infantry", "", "Assault Rifle.glb", () => BABYLON.MeshBuilder.CreateBox("ak_fb", {size: 0.5}, this.scene), 1);
        await this.assetManager.loadAsset("gun_sniper", gunPath, "Sniper.gltf", () => BABYLON.MeshBuilder.CreateBox("sni_fb", {size: 0.5}, this.scene), 1.2);
        await this.assetManager.loadAsset("gun_heavy", gunPath, "RocketLauncher.gltf", () => BABYLON.MeshBuilder.CreateBox("hvy_fb", {size: 0.5}, this.scene), 1.5);
        
        // --- NEW ASSETS: Characters ---
        const charPath = "Characters-20260417T004542Z-3-001/Characters/glTF/";
        await this.assetManager.loadAsset("char_soldier", charPath, "Character_Soldier.gltf", () => BABYLON.MeshBuilder.CreateCapsule("sol_fb", {}, this.scene), 2.1);
        await this.assetManager.loadAsset("char_enemy", charPath, "Character_Enemy.gltf", () => BABYLON.MeshBuilder.CreateCapsule("enm_fb", {}, this.scene), 2.1);

        // --- NEW ASSETS: Map Objects ---
        const objPath = "Environment-20260417T004542Z-3-001/Environment/glTF/";
        await this.assetManager.loadAsset("crate", objPath, "Crate.gltf", () => BABYLON.MeshBuilder.CreateBox("crate_fb", {}, this.scene), 1.5);
        await this.assetManager.loadAsset("trench", objPath, "SackTrench.gltf", () => BABYLON.MeshBuilder.CreateBox("trench_fb", {}, this.scene), 3);
        await this.assetManager.loadAsset("metal_fence", objPath, "MetalFence.gltf", () => BABYLON.MeshBuilder.CreateBox("fence_fb", {}, this.scene), 3);
        await this.assetManager.loadAsset("barrel", objPath, "ExplodingBarrel.gltf", () => BABYLON.MeshBuilder.CreateCylinder("bar_fb", {}, this.scene), 1.2);
        
        await this.assetManager.loadAsset("base_struct", objPath, "Structure_1.gltf", () => BABYLON.MeshBuilder.CreateBox("str_fb", {}, this.scene), 12);
        await this.assetManager.loadAsset("outpost", objPath, "Structure_2.gltf", () => BABYLON.MeshBuilder.CreateBox("out_fb", {}, this.scene), 8);
    }

    private buildHybridMap() {
        // Core Procedural Ground
        const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 400, height: 400}, this.scene);
        const groundMat = new BABYLON.StandardMaterial("groundMat", this.scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.3, 0.15); 
        groundMat.specularColor = BABYLON.Color3.Black(); 
        
        // Add a subtle grid to the ground for scale and premium feel
        const gridTexture = new BABYLON.DynamicTexture("grid", {width: 1024, height: 1024}, this.scene);
        const ctx = gridTexture.getContext();
        ctx.fillStyle = "#2a3d24";
        ctx.fillRect(0, 0, 1024, 1024);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 2;
        for(let i=0; i<=1024; i+=64) {
            ctx.moveTo(i, 0); ctx.lineTo(i, 1024);
            ctx.moveTo(0, i); ctx.lineTo(1024, i);
        }
        ctx.stroke();
        gridTexture.update();
        groundMat.diffuseTexture = gridTexture;
        
        ground.material = groundMat;
        ground.receiveShadows = true;
        ground.checkCollisions = true;

        // --- 1. Procedural Hills ---
        // Organic elevation variations mapping flanks
        this.createHill(0, -60, 40, 10);
        this.createHill(0, 60, 40, 10);
        this.createHill(-60, -40, 30, 8);
        this.createHill(60, 40, 30, 8);
        
        // Dynamic Outer Environment Hills breaking horizontal flatness completely
        for (let i = 0; i < 35; i++) { 
             const hx = (Math.random() - 0.5) * 380;
             const hz = (Math.random() - 0.5) * 380;
             if (Math.abs(hx) < 50 && Math.abs(hz) < 140) continue; 
             
             const hScale = 15 + Math.random() * 35;
             const hHeight = 4 + Math.random() * 10;
             this.createHill(hx, hz, hScale, hHeight);
        }

        // --- 2. Procedural Core Trenches & Bases ---
        // Bases
        this.createBasePlate(-120, 0, new BABYLON.Color3(0.2, 0.4, 0.9));
        this.createBasePlate(120, 0, new BABYLON.Color3(0.9, 0.2, 0.2));
        
        // Base Buildings
        this.assetManager.spawnInstance("base_struct", -125, 0, 0, Math.PI/2, 1, this.shadowGenerator!);
        this.assetManager.spawnInstance("base_struct", 125, 0, 0, -Math.PI/2, 1, this.shadowGenerator!);

        // Outposts on flanks
        this.assetManager.spawnInstance("outpost", 0, 0, 80, 0, 1, this.shadowGenerator!);
        this.assetManager.spawnInstance("outpost", 0, 0, -80, 0, 1, this.shadowGenerator!);

        // Frontline trenches with real models
        for (let i = -40; i <= 40; i += 15) {
            if (Math.abs(i) < 5) continue;
            this.assetManager.spawnInstance("trench", -30, 0, i, 0, 1, this.shadowGenerator!);
            this.assetManager.spawnInstance("trench", 30, 0, i, 0, 1, this.shadowGenerator!);
        }
        
        // Mid-field cover
        for(let i=0; i<5; i++) {
            const rX = (Math.random() - 0.5) * 10;
            const rZ = (Math.random() - 0.5) * 40;
            this.assetManager.spawnInstance("barrel", rX, 0, rZ, 0, 1, this.shadowGenerator!);
            this.assetManager.spawnInstance("crate", rX + 2, 0, rZ + 2, 0, 1, this.shadowGenerator!);
        }
        
        this.assetManager.spawnInstance("metal_fence", 0, 0, 15, Math.PI/2, 1, this.shadowGenerator!);
        this.assetManager.spawnInstance("metal_fence", 0, 0, -15, Math.PI/2, 1, this.shadowGenerator!);


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
        
        this.placeForests();
        this.placeGrass();
    }

    private placeGrass() {
        if (this.assetManager.assets["grass_model"]) {
            for (let i = 0; i < 600; i++) {
                const x = (Math.random() - 0.5) * 360;
                const z = (Math.random() - 0.5) * 360;
                if (Math.abs(x) > 80 && Math.abs(x) < 120 && Math.abs(z) < 20) continue;
                this.assetManager.spawnInstance("grass_model", x, 0, z, Math.random() * Math.PI, 0.5 + Math.random(), this.shadowGenerator!, false);
            }
            return;
        }

        const grassMat = new BABYLON.StandardMaterial("grassMat", this.scene);
        grassMat.diffuseColor = new BABYLON.Color3(0.4, 0.7, 0.3);
        grassMat.specularColor = BABYLON.Color3.Black();

        for (let i = 0; i < 400; i++) {
            const x = (Math.random() - 0.5) * 350;
            const z = (Math.random() - 0.5) * 350;
            
            // Skip bases and high combat areas
            if (Math.abs(x) > 80 && Math.abs(x) < 120 && Math.abs(z) < 20) continue;
            
            const grass = BABYLON.MeshBuilder.CreateBox("grass", {width: 0.2 + Math.random(), height: 0.1 + Math.random()*0.5, depth: 0.05}, this.scene);
            grass.position.set(x, 0.1, z);
            grass.rotation.y = Math.random() * Math.PI;
            grass.material = grassMat;
            grass.freezeWorldMatrix(); // optimization
        }
    }

    // Existing Procedural Generators Preserved
    private createWall(x: number, z: number, w: number, h: number, d: number, rotation: number) {
        // Use real fence asset if possible
        if (this.assetManager.assets["fence"]) {
             const numFences = Math.ceil(w / 3);
             for(let i=0; i<numFences; i++) {
                 const offset = (i - (numFences-1)/2) * 3;
                 const fx = x + Math.cos(rotation) * offset;
                 const fz = z + Math.sin(rotation) * offset;
                 this.assetManager.spawnInstance("fence", fx, 0, fz, rotation, 1, this.shadowGenerator!);
             }
        } else {
            const wall = BABYLON.MeshBuilder.CreateBox("wall", {width: w, height: h, depth: d}, this.scene);
            wall.position.set(x, h/2, z);
            wall.rotation.y = rotation;
            wall.material = this.wallMaterial;
            wall.receiveShadows = true;
            wall.checkCollisions = true;
            if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(wall);
        }
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

    private placeForests() {
        // Clump-based tree placement for more natural forest patches
        const clumpCount = 15;
        const treesPerClump = 10;
        
        for (let i = 0; i < clumpCount; i++) {
            let cx = (Math.random() - 0.5) * 350;
            let cz = (Math.random() - 0.5) * 350;

            // Push clump centers out of the middle combat zone
            if (Math.abs(cx) < 60 && Math.abs(cz) < 150) {
                cx = Math.sign(cx) * (60 + Math.random() * 115);
                cz = Math.sign(cz) * (150 + Math.random() * 25);
            }

            for (let j = 0; j < treesPerClump; j++) {
                const offsetX = (Math.random() - 0.5) * 45;
                const offsetZ = (Math.random() - 0.5) * 45;
                const x = cx + offsetX;
                const z = cz + offsetZ;

                if (Math.abs(x) < 40 && Math.abs(z) < 140) continue;

                const rotY = Math.random() * Math.PI * 2;
                const scale = 0.5 + Math.random() * 1.5; 
                
                // Randomize tree variety if we had multiple variants loaded
                const assetType = Math.random() > 0.4 ? "tree" : "conifer";
                this.assetManager.spawnInstance(assetType, x, 0, z, rotY, scale, this.shadowGenerator!);
                
                // Add some bushes at base
                if(Math.random() > 0.6) {
                    this.assetManager.spawnInstance("bush", x + Math.random()*3, 0, z + Math.random()*3, rotY, 0.8 + Math.random() * 1.5, this.shadowGenerator!, false);
                }
            }
        }

        // Add some lone trees for sparse decoration in the distance
        for (let i = 0; i < 20; i++) {
            const x = (Math.random() - 0.5) * 380;
            const z = (Math.random() - 0.5) * 380;
            if (Math.abs(x) < 55 && Math.abs(z) < 160) continue;

            const rotY = Math.random() * Math.PI * 2;
            const scale = 0.4 + Math.random() * 0.7;
            const assetType = Math.random() > 0.5 ? "tree" : "conifer";
            this.assetManager.spawnInstance(assetType, x, -0.1, z, rotY, scale, this.shadowGenerator!);
        }
    }
}
