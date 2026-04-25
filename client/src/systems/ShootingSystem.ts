import * as BABYLON from 'babylonjs';
import * as Colyseus from '@colyseus/sdk';

export class ShootingSystem {
    private scene: BABYLON.Scene;
    private camera: BABYLON.UniversalCamera;
    private room: Colyseus.Room | null = null;
    
    private lastShootTime = 0;
    private COOLDOWN = 150; // default
    private hitMarkerEl: HTMLElement | null = null;
    private recoilMultiplier = 1.0;
    private muzzleLight: BABYLON.PointLight;
    private gunMesh: BABYLON.AbstractMesh | null = null;
    private assetManager: any | null = null;
    private impactParticles: BABYLON.ParticleSystem;
    private muzzleParticles: BABYLON.ParticleSystem;
    private muzzleEmitter: BABYLON.AbstractMesh;
    private muzzleNode: BABYLON.TransformNode;
    private muzzleFlare: BABYLON.Mesh;
    private tracerPool: BABYLON.Mesh[] = [];
    private tracerMat: BABYLON.StandardMaterial;

    constructor(scene: BABYLON.Scene, camera: BABYLON.UniversalCamera) {
        this.scene = scene;
        this.camera = camera;

        // Base light for muzzle flash effect
        this.muzzleLight = new BABYLON.PointLight("muzzleLight", BABYLON.Vector3.Zero(), scene);
        this.muzzleLight.diffuse = new BABYLON.Color3(1, 0.8, 0.2);
        this.muzzleLight.intensity = 0;

        // Impact Particles
        this.impactParticles = new BABYLON.ParticleSystem("impact", 200, this.scene);
        this.impactParticles.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJS_Resources/master/ParticleUtils/textures/flare.png", this.scene);
        this.impactParticles.emitter = BABYLON.Vector3.Zero();
        this.impactParticles.minSize = 0.05;
        this.impactParticles.maxSize = 0.15;
        this.impactParticles.minLifeTime = 0.1;
        this.impactParticles.maxLifeTime = 0.3;
        this.impactParticles.emitRate = 0;
        this.impactParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
        this.impactParticles.gravity = new BABYLON.Vector3(0, -9.81, 0);
        this.impactParticles.direction1 = new BABYLON.Vector3(-1, 2, -1);
        this.impactParticles.direction2 = new BABYLON.Vector3(1, 4, 1);
        this.impactParticles.minEmitPower = 1;
        this.impactParticles.maxEmitPower = 3;
        this.impactParticles.updateSpeed = 0.01;
        this.impactParticles.start();

        // Muzzle Node (Anchor point at barrel tip)
        this.muzzleNode = new BABYLON.TransformNode("muzzleNode", this.scene);

        // Muzzle Flash Spark Particles
        this.muzzleEmitter = new BABYLON.AbstractMesh("muzzleEmitter", this.scene);
        this.muzzleEmitter.parent = this.muzzleNode;
        this.muzzleParticles = new BABYLON.ParticleSystem("muzzle", 100, this.scene);
        this.muzzleParticles.particleTexture = new BABYLON.Texture("https://raw.githubusercontent.com/PatrickRyanMS/BabylonJS_Resources/master/ParticleUtils/textures/flare.png", this.scene);
        this.muzzleParticles.emitter = this.muzzleEmitter;
        this.muzzleParticles.minSize = 0.02;
        this.muzzleParticles.maxSize = 0.1;
        this.muzzleParticles.minLifeTime = 0.05;
        this.muzzleParticles.maxLifeTime = 0.2;
        this.muzzleParticles.emitRate = 0;
        this.muzzleParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
        this.muzzleParticles.direction1 = new BABYLON.Vector3(-1, -1, -1);
        this.muzzleParticles.direction2 = new BABYLON.Vector3(1, 1, 1);
        this.muzzleParticles.minEmitPower = 5;
        this.muzzleParticles.maxEmitPower = 15;
        this.muzzleParticles.color1 = new BABYLON.Color4(1, 0.9, 0.4, 1);
        this.muzzleParticles.color2 = new BABYLON.Color4(1, 0.5, 0, 1);
        this.muzzleParticles.start();

        // Muzzle Flare (Small glowing sphere)
        this.muzzleFlare = BABYLON.MeshBuilder.CreateSphere("muzzleFlare", {diameter: 0.15}, this.scene);
        const flareMat = new BABYLON.StandardMaterial("flareMat", this.scene);
        flareMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.2);
        this.muzzleFlare.material = flareMat;
        this.muzzleFlare.isVisible = false;
        this.muzzleFlare.parent = this.muzzleNode;
        this.muzzleFlare.renderingGroupId = 2; // Render on top

        this.muzzleLight.parent = this.muzzleNode;

        // Tracer Material
        this.tracerMat = new BABYLON.StandardMaterial("tracerMat", this.scene);
        this.tracerMat.emissiveColor = new BABYLON.Color3(1, 1, 0.8);
        this.tracerMat.disableLighting = true;

        // Initial fallback
        this.createGunMesh();
    }

    public setAssetManager(am: any) {
        this.assetManager = am;
    }

    private createGunMesh() {
        if (this.gunMesh) this.gunMesh.dispose();
        
        // Root container for the gun parts
        const gunRoot = new BABYLON.Mesh("gun_root", this.scene);
        
        // Receiver / Body
        const body = BABYLON.MeshBuilder.CreateBox("gun_body", {width: 0.12, height: 0.18, depth: 0.45}, this.scene);
        body.position.z = 0.2;
        
        // Barrel
        const barrel = BABYLON.MeshBuilder.CreateCylinder("gun_barrel", {diameter: 0.06, height: 0.5}, this.scene);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.6;
        
        // Handle / Grip
        const handle = BABYLON.MeshBuilder.CreateBox("gun_handle", {width: 0.1, height: 0.2, depth: 0.08}, this.scene);
        handle.position.y = -0.15;
        handle.position.z = 0.1;
        handle.rotation.x = -Math.PI / 10;
        
        // Stock
        const stock = BABYLON.MeshBuilder.CreateBox("gun_stock", {width: 0.1, height: 0.15, depth: 0.3}, this.scene);
        stock.position.z = -0.15;
        stock.position.y = -0.05;

        // Magazine
        const mag = BABYLON.MeshBuilder.CreateBox("gun_mag", {width: 0.08, height: 0.22, depth: 0.06}, this.scene);
        mag.position.z = 0.35;
        mag.position.y = -0.18;
        mag.rotation.x = Math.PI / 12;

        // Materials
        const gunMat = new BABYLON.StandardMaterial("gunMat", this.scene);
        gunMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.18);
        gunMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        
        const accentMat = new BABYLON.StandardMaterial("gunAccentMat", this.scene);
        accentMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);

        body.material = gunMat;
        barrel.material = accentMat;
        handle.material = accentMat;
        stock.material = accentMat;
        mag.material = accentMat;

        body.parent = gunRoot;
        barrel.parent = gunRoot;
        handle.parent = gunRoot;
        stock.parent = gunRoot;
        mag.parent = gunRoot;

        gunRoot.position = new BABYLON.Vector3(0.25, -0.35, 0.6); // Position in front of camera
        gunRoot.scaling.setAll(0.35);
        gunRoot.parent = this.camera;
        gunRoot.getChildMeshes().forEach(m => m.renderingGroupId = 1); // Render on top
        this.gunMesh = gunRoot;

        // ATTACH MUZZLE NODE (Where particles come from)
        this.muzzleNode.parent = this.gunMesh;
        this.muzzleNode.position = new BABYLON.Vector3(0, 0, 0.85); // Adjust this for procedural gun tip
    }

    public updateGunVisual(className: string) {
        if (this.assetManager) {
            let assetKey = "gun_infantry";
            if (className === "Sniper") assetKey = "gun_sniper";
            if (className === "Heavy") assetKey = "gun_heavy";

            const newGun = this.assetManager.spawnInstance(assetKey, 0, 0, 0, 0);
            if (newGun) {
                if (this.gunMesh) this.gunMesh.dispose();
                this.gunMesh = newGun;
                this.gunMesh.parent = this.camera;
                
                // Position relative to the camera (FPS position)
                if (assetKey === "gun_sniper") {
                    this.gunMesh.position = new BABYLON.Vector3(0.25, -0.3, 0.45);
                    this.gunMesh.scaling.setAll(0.4);
                } else if (assetKey === "gun_heavy") {
                    this.gunMesh.position = new BABYLON.Vector3(0.35, -0.45, 0.55);
                    this.gunMesh.scaling.setAll(0.6);
                } else {
                    // Standard Rifle/Infantry
                    this.gunMesh.position = new BABYLON.Vector3(0.25, -0.35, 0.6);
                    this.gunMesh.scaling.setAll(0.35);
                }

                // Point gun FORWARD correctly
                this.gunMesh.rotation.set(0, Math.PI / 2, 0); 
                this.gunMesh.getChildMeshes().forEach(m => m.renderingGroupId = 1);
                
                // ATTACH MUZZLE NODE TO BARREL TIP
                this.muzzleNode.parent = this.gunMesh;
                
                // ADJUST MUZZLE POSITION HERE (Local coordinates of the gun model)
                // Different models have different barrel lengths
                if (assetKey === "gun_sniper") {
                    this.muzzleNode.position = new BABYLON.Vector3(-1.4, 0.05, 0); 
                } else if (assetKey === "gun_heavy") {
                    this.muzzleNode.position = new BABYLON.Vector3(-1.1, 0.1, 0); 
                } else {
                    // Standard Infantry Rifle
                    this.muzzleNode.position = new BABYLON.Vector3(-0.9, 0.05, 0); 
                }                
                // Ensure all parts are visible
                this.gunMesh.getChildMeshes().forEach(m => m.isVisible = true);
                return;
            }
        }

        if (!this.gunMesh) return;
        // Fallback procedural logic if assets not loaded yet
        const body = this.gunMesh.getChildMeshes().find(m => m.name === "gun_body");
        const barrel = this.gunMesh.getChildMeshes().find(m => m.name === "gun_barrel");
        const stock = this.gunMesh.getChildMeshes().find(m => m.name === "gun_stock");
        const mag = this.gunMesh.getChildMeshes().find(m => m.name === "gun_mag");

        switch(className) {
            case "Sniper":
                if (barrel) { barrel.scaling.set(1, 2.5, 1); barrel.position.z = 0.9; }
                if (stock) { stock.scaling.set(1, 1.2, 1.5); stock.position.z = -0.25; }
                if (mag) mag.isVisible = false;
                break;
            case "Heavy":
                if (body) body.scaling.set(1.5, 1.5, 1.2);
                if (barrel) { barrel.scaling.set(2.4, 0.8, 1); barrel.position.z = 0.5; }
                if (mag) mag.isVisible = false;
                break;
            default: // Infantry
                if (body) body.scaling.set(1, 1, 1);
                if (barrel) {
                    barrel.scaling.set(1, 1, 1);
                    barrel.position.z = 0.6;
                }
                if (mag) {
                    mag.isVisible = true;
                    mag.scaling.set(1, 1, 1);
                }
                if (this.muzzleNode) this.muzzleNode.position.set(0, 0, 0.85);
                break;
        }
    }

    applyClassProfile(config: any) {
        this.COOLDOWN = config.fireRateMs;
        this.recoilMultiplier = config.recoilMultiplier;
        this.updateGunVisual(config.name);
    }

    setRoom(room: Colyseus.Room) {
        this.room = room;
    }

    setHitMarkerElement(el: HTMLElement) {
        this.hitMarkerEl = el;
    }

    shoot() {
        const now = Date.now();
        if (now - this.lastShootTime < this.COOLDOWN) return;
        this.lastShootTime = now;
        
        this.applyRecoil();

        // New Logic: Create ray from mouse cursor (works for both locked and free mouse)
        const ray = this.scene.createPickingRay(
            this.scene.pointerX, 
            this.scene.pointerY, 
            BABYLON.Matrix.Identity(), 
            this.camera
        );
        
        const hit = this.scene.pickWithRay(ray, (m) => {
            return !m.name.includes("localPlayerBody") && m.isVisible;
        });

        const origin = this.camera.position;
        const forward = ray.direction; // Follow the ray direction

        // Resolve hit target
        let hitId = null;
        if (hit && hit.pickedMesh && hit.pickedMesh.name.startsWith("player_")) {
            hitId = hit.pickedMesh.name.replace("player_", "");
            this.showHitMarker();
        }
        
        // 1. Get the REAL Muzzle Position from the muzzleNode
        const muzzlePos = this.muzzleNode.getAbsolutePosition();

        // Visual effects (independent of server)
        const targetPos = hit && hit.hit ? hit.pickedPoint! : origin.add(forward.scale(150));
        
        // Start tracer at the REAL muzzle
        this.createTracer(muzzlePos, targetPos, !!hitId);
        this.playMuzzleEffectAt(muzzlePos, targetPos);
        
        if (hit && hit.hit && hit.pickedPoint) {
            this.playImpactEffect(hit.pickedPoint, hit.getNormal(true));
        }

        // Server communication
        if (!this.room) return;
        this.room.send("shoot", { hitId });
    }

    private createTracer(start: BABYLON.Vector3, end: BABYLON.Vector3, isHit: boolean) {
        const dist = BABYLON.Vector3.Distance(start, end);
        if (dist < 0.1) return;

        let tracer = this.tracerPool.pop();
        if (!tracer) {
            tracer = BABYLON.MeshBuilder.CreateBox("tracer", {width: 0.02, height: 0.02, depth: 1}, this.scene);
            tracer.material = this.tracerMat.clone("tracerInst");
            tracer.isPickable = false;
        }

        tracer.isVisible = true;
        tracer.scaling.z = dist;
        tracer.position = BABYLON.Vector3.Lerp(start, end, 0.5);
        tracer.lookAt(end);

        const mat = tracer.material as BABYLON.StandardMaterial;
        if (isHit) {
            mat.emissiveColor = new BABYLON.Color3(1, 0.3, 0.3);
        } else {
            mat.emissiveColor = new BABYLON.Color3(1, 0.9, 0.6);
        }

        setTimeout(() => {
            if (tracer) {
                tracer.isVisible = false;
                this.tracerPool.push(tracer);
            }
        }, 120);
    }

    private playImpactEffect(pos: BABYLON.Vector3, normal: BABYLON.Vector3 | null = null) {
        this.impactParticles.emitter = pos;
        
        if (normal) {
            // Use the surface normal to direct the impact sparks
            const spread = 0.6;
            this.impactParticles.direction1 = normal.scale(3).subtract(new BABYLON.Vector3(spread, spread, spread));
            this.impactParticles.direction2 = normal.scale(5).add(new BABYLON.Vector3(spread, spread, spread));
        } else {
            // Fallback to UP if no normal is available
            this.impactParticles.direction1 = new BABYLON.Vector3(-1, 2, -1);
            this.impactParticles.direction2 = new BABYLON.Vector3(1, 4, 1);
        }

        this.impactParticles.manualEmitCount = 10;
    }

    private applyRecoil() {
        // Simple camera recoil offset (Dampened)
        const recoilAmountX = (Math.random() - 0.5) * 0.01 * this.recoilMultiplier;
        const recoilAmountY = -0.015 * this.recoilMultiplier; // kick up

        this.camera.cameraRotation.x += recoilAmountY;
        this.camera.cameraRotation.y += recoilAmountX;
    }

    private playMuzzleEffectAt(pos: BABYLON.Vector3, targetPos: BABYLON.Vector3) {
        // Components are already parented to muzzleNode, so they stay at local (0,0,0)
        this.muzzleLight.position.setAll(0);
        this.muzzleFlare.position.setAll(0);
        
        // Direction from muzzle to the actual target point (center of screen)
        const directionToTarget = targetPos.subtract(pos).normalize();
        
        // Use camera's relative vectors to create a consistent spread around the target direction
        const right = this.camera.getDirection(BABYLON.Vector3.Right());
        const up = this.camera.getDirection(BABYLON.Vector3.Up());
        
        const spread = 0.15;
        const speed = 12;
        
        // Calculate spread vectors (horizontal and vertical relative to camera)
        const hSpread = right.scale(spread);
        const vSpread = up.scale(spread);
        
        // direction1 and direction2 define the cone/box of emission
        // We center it on directionToTarget * speed
        const baseDir = directionToTarget.scale(speed);
        
        this.muzzleParticles.direction1 = baseDir.subtract(hSpread).subtract(vSpread).scale(0.8);
        this.muzzleParticles.direction2 = baseDir.add(hSpread).add(vSpread).scale(1.2);
        
        // Add a bit of gravity so sparks fall naturally
        this.muzzleParticles.gravity = new BABYLON.Vector3(0, -9.81, 0); 
        
        // Trigger visuals
        this.muzzleLight.intensity = 4.0;
        this.muzzleFlare.isVisible = true;
        this.muzzleParticles.manualEmitCount = 25;
        
        setTimeout(() => {
            if (this.muzzleLight) this.muzzleLight.intensity = 0;
            if (this.muzzleFlare) this.muzzleFlare.isVisible = false;
        }, 65);
    }

    private showHitMarker() {
        if (!this.hitMarkerEl) return;
        this.hitMarkerEl.classList.remove("active");
        // Trigger reflow
        void this.hitMarkerEl.offsetWidth;
        this.hitMarkerEl.classList.add("active");

        // Small audio ping could be added here
    }
}
