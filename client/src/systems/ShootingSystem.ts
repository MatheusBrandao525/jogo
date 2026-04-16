import * as BABYLON from 'babylonjs';
import * as Colyseus from 'colyseus.js';

export class ShootingSystem {
    private scene: BABYLON.Scene;
    private camera: BABYLON.UniversalCamera;
    private room: Colyseus.Room | null = null;
    
    private lastShootTime = 0;
    private readonly COOLDOWN = 120; // limit fire rate
    private hitMarkerEl: HTMLElement | null = null;

    private muzzleLight: BABYLON.PointLight;

    constructor(scene: BABYLON.Scene, camera: BABYLON.UniversalCamera) {
        this.scene = scene;
        this.camera = camera;

        // Base light for muzzle flash effect
        this.muzzleLight = new BABYLON.PointLight("muzzleLight", BABYLON.Vector3.Zero(), scene);
        this.muzzleLight.diffuse = new BABYLON.Color3(1, 0.8, 0.2);
        this.muzzleLight.intensity = 0;
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
        this.playMuzzleFlash();

        if (!this.room) return;

        const origin = this.camera.position;
        const forward = this.camera.getDirection(BABYLON.Vector3.Forward());
        const ray = new BABYLON.Ray(origin, forward, 100);
        const hit = this.scene.pickWithRay(ray);
        
        let hitId = null;
        if (hit && hit.pickedMesh && hit.pickedMesh.name.startsWith("player_")) {
            hitId = hit.pickedMesh.name.replace("player_", "");
            this.showHitMarker();
        }
        
        this.room.send("shoot", { hitId });
    }

    private applyRecoil() {
        // Simple camera recoil offset
        const recoilAmountX = (Math.random() - 0.5) * 0.02;
        const recoilAmountY = -0.03; // kick up

        this.camera.cameraRotation.x += recoilAmountY;
        this.camera.cameraRotation.y += recoilAmountX;
    }

    private playMuzzleFlash() {
        // Place light at camera
        this.muzzleLight.position = this.camera.position.clone();
        this.muzzleLight.intensity = 2; // high flash
        
        // Rapidly lower intensity
        const fadeInt = setInterval(() => {
            this.muzzleLight.intensity -= 0.4;
            if (this.muzzleLight.intensity <= 0) {
                this.muzzleLight.intensity = 0;
                clearInterval(fadeInt);
            }
        }, 16);
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
