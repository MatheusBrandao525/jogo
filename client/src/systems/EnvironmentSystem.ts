import * as BABYLON from 'babylonjs';
import { AssetManager } from './AssetManager';

export class EnvironmentSystem {
    private scene: BABYLON.Scene;
    public shadowGenerator: BABYLON.ShadowGenerator | null = null;
    private wallMaterial: BABYLON.StandardMaterial;
    public assetManager: AssetManager;
    private collisionMaterial: BABYLON.StandardMaterial;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
        this.assetManager = new AssetManager(scene);

        this.wallMaterial = new BABYLON.StandardMaterial("wallMat", scene);
        this.wallMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.45);
        this.wallMaterial.specularColor = BABYLON.Color3.Black();

        this.collisionMaterial = new BABYLON.StandardMaterial("collisionProxyMat", scene);
        this.collisionMaterial.alpha = 0;

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
        this.assetManager.spawnInstance("base_struct", -125, 0, 0, Math.PI/2, 1, this.shadowGenerator!, false);
        this.createCollisionBox("base_a", -125, 0, 0, 12, 8, 12, Math.PI / 2);
        this.assetManager.spawnInstance("base_struct", 125, 0, 0, -Math.PI/2, 1, this.shadowGenerator!, false);
        this.createCollisionBox("base_b", 125, 0, 0, 12, 8, 12, -Math.PI / 2);

        // Outposts on flanks
        this.assetManager.spawnInstance("outpost", 0, 0, 80, 0, 1, this.shadowGenerator!, false);
        this.createCollisionBox("outpost_north", 0, 0, 80, 8, 6, 8);
        this.assetManager.spawnInstance("outpost", 0, 0, -80, 0, 1, this.shadowGenerator!, false);
        this.createCollisionBox("outpost_south", 0, 0, -80, 8, 6, 8);

        // Frontline trenches with real models
        for (let i = -40; i <= 40; i += 15) {
            if (Math.abs(i) < 5) continue;
            this.assetManager.spawnInstance("trench", -30, 0, i, 0, 1, this.shadowGenerator!, false);
            this.createCollisionBox("trench_left_" + i, -30, 0, i, 5.5, 2.4, 2.2);
            this.assetManager.spawnInstance("trench", 30, 0, i, 0, 1, this.shadowGenerator!, false);
            this.createCollisionBox("trench_right_" + i, 30, 0, i, 5.5, 2.4, 2.2);
        }
        
        // Mid-field cover
        for(let i=0; i<5; i++) {
            const rX = (Math.random() - 0.5) * 10;
            const rZ = (Math.random() - 0.5) * 40;
            this.assetManager.spawnInstance("barrel", rX, 0, rZ, 0, 1, this.shadowGenerator!, false);
            this.createCollisionCylinder("barrel_" + i, rX, rZ, 0.75, 2.0);
            this.assetManager.spawnInstance("crate", rX + 2, 0, rZ + 2, 0, 1, this.shadowGenerator!, false);
            this.createCollisionBox("crate_" + i, rX + 2, 0, rZ + 2, 1.8, 1.8, 1.8);
        }
        
        this.assetManager.spawnInstance("metal_fence", 0, 0, 15, Math.PI/2, 1, this.shadowGenerator!, false);
        this.createCollisionBox("mid_fence_north", 0, 0, 15, 10, 2.4, 0.8, Math.PI / 2);
        this.assetManager.spawnInstance("metal_fence", 0, 0, -15, Math.PI/2, 1, this.shadowGenerator!, false);
        this.createCollisionBox("mid_fence_south", 0, 0, -15, 10, 2.4, 0.8, Math.PI / 2);


        // --- 3. External Asset Integration ---
        // Boundaries using Cliffs
        for (let i = 0; i < 35; i++) {
            const angle = (i / 35) * Math.PI * 2;
            const radius = 135 + Math.random() * 5;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            this.assetManager.spawnInstance("cliff", x, 0, z, angle + Math.PI/2, Math.random() * 0.4 + 0.8, this.shadowGenerator!, false);
            this.createCollisionBox("cliff_" + i, x, 0, z, 12, 6, 4, angle + Math.PI / 2);
        }

        // Cover Rocks around Capture Zones and Procedural Hills
        // Near Center (0, 0)
        this.assetManager.spawnInstance("rock", -10, 0, -5, Math.random() * Math.PI, 1, this.shadowGenerator!, false);
        this.createCollisionCylinder("rock_center_a", -10, -5, 1.5, 2.8);
        this.assetManager.spawnInstance("rock", 10, 0, 5, Math.random() * Math.PI, 1.2, this.shadowGenerator!, false);
        this.createCollisionCylinder("rock_center_b", 10, 5, 1.8, 3.1);
        
        // Flank Rocks integrated into procedural hills perfectly
        this.assetManager.spawnInstance("rock", -20, 0, -40, Math.random() * Math.PI, 1.5, this.shadowGenerator!, false);
        this.createCollisionCylinder("rock_flank_a", -20, -40, 2.2, 3.4);
        this.assetManager.spawnInstance("rock", 20, 0, 40, Math.random() * Math.PI, 1.5, this.shadowGenerator!, false);
        this.createCollisionCylinder("rock_flank_b", 20, 40, 2.2, 3.4);

        // Small Props scattered selectively near trenches (immersion detailing)
        this.assetManager.spawnInstance("prop", -18, 0, -17, 0, 1, this.shadowGenerator!, false);
        this.assetManager.spawnInstance("prop", -19, 0, -17, 0, 1, this.shadowGenerator!, false);
        this.assetManager.spawnInstance("prop", 22, 0, 17, 0, 1, this.shadowGenerator!, false);
        this.assetManager.spawnInstance("prop", 5, 0, 12, 0, 1, this.shadowGenerator!, false);
        
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
            grass.metadata = { assetName: "grass_model" };
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
                 this.assetManager.spawnInstance("fence", fx, 0, fz, rotation, 1, this.shadowGenerator!, false);
             }
             this.createCollisionBox("fence_wall_" + x + "_" + z, x, 0, z, w, h, Math.max(d, 0.8), rotation);
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
        const radius = diameter / 2;
        const radialSegments = 18;
        const rings = 8;
        const positions: number[] = [];
        const indices: number[] = [];

        positions.push(x, height, z);

        for (let ring = 1; ring <= rings; ring++) {
            const t = ring / rings;
            const ringRadius = radius * t;
            const y = height * Math.cos(t * Math.PI * 0.5);

            for (let segment = 0; segment < radialSegments; segment++) {
                const angle = (segment / radialSegments) * Math.PI * 2;
                positions.push(
                    x + Math.cos(angle) * ringRadius,
                    y,
                    z + Math.sin(angle) * ringRadius
                );
            }
        }

        for (let segment = 0; segment < radialSegments; segment++) {
            const next = (segment + 1) % radialSegments;
            indices.push(0, 1 + segment, 1 + next);
        }

        for (let ring = 1; ring < rings; ring++) {
            const currentStart = 1 + (ring - 1) * radialSegments;
            const nextStart = 1 + ring * radialSegments;

            for (let segment = 0; segment < radialSegments; segment++) {
                const next = (segment + 1) % radialSegments;
                const a = currentStart + segment;
                const b = currentStart + next;
                const c = nextStart + segment;
                const d = nextStart + next;

                indices.push(a, c, b);
                indices.push(b, c, d);
            }
        }

        const normals: number[] = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);

        const hill = new BABYLON.Mesh("hill", this.scene);
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.normals = normals;
        vertexData.applyToMesh(hill);

        const mat = new BABYLON.StandardMaterial("hillMat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.3, 0.4, 0.25);
        mat.specularColor = BABYLON.Color3.Black();
        hill.material = mat;
        hill.checkCollisions = true;
        hill.receiveShadows = true;
        if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(hill);

        const skirtPositions: number[] = [];
        const skirtIndices: number[] = [];
        const outerStart = 1 + (rings - 1) * radialSegments;
        const skirtDepth = 2;

        for (let segment = 0; segment < radialSegments; segment++) {
            const topIndex = outerStart + segment;
            skirtPositions.push(
                positions[topIndex * 3],
                positions[topIndex * 3 + 1],
                positions[topIndex * 3 + 2]
            );
        }

        for (let segment = 0; segment < radialSegments; segment++) {
            const angle = (segment / radialSegments) * Math.PI * 2;
            skirtPositions.push(
                x + Math.cos(angle) * (radius + 0.5),
                -skirtDepth,
                z + Math.sin(angle) * (radius + 0.5)
            );
        }

        for (let segment = 0; segment < radialSegments; segment++) {
            const next = (segment + 1) % radialSegments;
            const a = segment;
            const b = next;
            const c = radialSegments + segment;
            const d = radialSegments + next;

            skirtIndices.push(a, c, b);
            skirtIndices.push(b, c, d);
        }

        const skirtNormals: number[] = [];
        BABYLON.VertexData.ComputeNormals(skirtPositions, skirtIndices, skirtNormals);

        const skirt = new BABYLON.Mesh("hill_skirt", this.scene);
        const skirtData = new BABYLON.VertexData();
        skirtData.positions = skirtPositions;
        skirtData.indices = skirtIndices;
        skirtData.normals = skirtNormals;
        skirtData.applyToMesh(skirt);
        skirt.material = mat;
        skirt.checkCollisions = false;
        skirt.isPickable = false;
        skirt.receiveShadows = true;
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
        this.assetManager.spawnInstance("prop", x + 5, 0, z - 2, 0, 1, this.shadowGenerator!, false);
        this.assetManager.spawnInstance("prop", x - 6, 0, z + 3, 0, 1, this.shadowGenerator!, false);
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
                this.assetManager.spawnInstance(assetType, x, 0, z, rotY, scale, this.shadowGenerator!, false);
                this.createCollisionCylinder(assetType + "_" + i + "_" + j, x, z, assetType === "tree" ? 0.55 * scale : 0.45 * scale, 5.5 * scale);
                
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
            this.assetManager.spawnInstance(assetType, x, -0.1, z, rotY, scale, this.shadowGenerator!, false);
            this.createCollisionCylinder(assetType + "_lone_" + i, x, z, assetType === "tree" ? 0.55 * scale : 0.45 * scale, 5.5 * scale);
        }
    }

    private createCollisionBox(name: string, x: number, y: number, z: number, width: number, height: number, depth: number, rotationY: number = 0) {
        const collider = BABYLON.MeshBuilder.CreateBox("collision_" + name, { width, height, depth }, this.scene);
        collider.position.set(x, y + height / 2, z);
        collider.rotation.y = rotationY;
        this.setupCollisionProxy(collider);
        return collider;
    }

    private createCollisionCylinder(name: string, x: number, z: number, radius: number, height: number) {
        const collider = BABYLON.MeshBuilder.CreateCylinder("collision_" + name, {
            diameter: radius * 2,
            height,
            tessellation: 12
        }, this.scene);
        collider.position.set(x, height / 2, z);
        this.setupCollisionProxy(collider);
        return collider;
    }

    private setupCollisionProxy(collider: BABYLON.Mesh) {
        collider.isVisible = false;
        collider.isPickable = false;
        collider.checkCollisions = true;
        collider.material = this.collisionMaterial;
        collider.freezeWorldMatrix();
    }
}
