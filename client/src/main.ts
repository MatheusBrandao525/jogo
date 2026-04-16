import './style.css';
import * as BABYLON from 'babylonjs';
import * as Colyseus from 'colyseus.js';

import { ShootingSystem } from './systems/ShootingSystem';
import { HealthSystem } from './systems/HealthSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);

let room: Colyseus.Room;
let myPlayerId: string;
let myTeam: string;
const players: { [id: string]: { mesh: BABYLON.Mesh, marker: BABYLON.Mesh } } = {};

const healthSystem = new HealthSystem();
let shootingSystem: ShootingSystem;
let envSystem: EnvironmentSystem;

// Injected UI
const uiContainer = document.getElementById("uiContainer") as HTMLElement;
uiContainer.innerHTML = `
    <div id="fullscreenOverlay"></div>
    <div class="kill-feed" id="killFeed"></div>
    <div class="hit-marker" id="hitMarker"></div>
    <div class="crosshair"></div>
    <div class="hud-top">
        <div class="score-A">Team A: <span id="scoreA">0</span></div>
        <div class="score-B">Team B: <span id="scoreB">0</span></div>
    </div>
    <div class="zones-container" id="zonesList"></div>
    <div class="hud-bottom">
        HP: <span id="hpText">100</span>
        <div class="health-bar-container">
            <div class="health-bar-fill" id="hpFill"></div>
        </div>
    </div>
`;
healthSystem.init("hpText", "hpFill", "fullscreenOverlay", "killFeed");

const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    
    // Environment & Atmosphere
    envSystem = new EnvironmentSystem(scene);
    envSystem.initialize(); // Loads GLBs asynchronously

    const camera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 2, 0), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    
    // FPS controls & movement feel
    camera.keysUp.push(87);    // W
    camera.keysDown.push(83);  // S
    camera.keysLeft.push(65);  // A
    camera.keysRight.push(68); // D
    camera.speed = 0.45;
    camera.inertia = 0.85; // Better decel
    camera.angularSensibility = 2000;
    
    // Heavier Gravity
    scene.gravity = new BABYLON.Vector3(0, -18, 0);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(0.8, 1.2, 0.8);
    
    shootingSystem = new ShootingSystem(scene, camera);
    shootingSystem.setHitMarkerElement(document.getElementById("hitMarker") as HTMLElement);

    scene.onPointerDown = (evt) => {
        if (evt.button === 0) engine.enterPointerlock();
        if (evt.button === 1) engine.exitPointerlock();
        if (evt.button === 0 && room) shootingSystem.shoot();
    };

    // Head Bobbing logic
    let timeSeconds = 0;
    let cameraPrePos = camera.position.clone();
    
    scene.onBeforeRenderObservable.add(() => {
        const dist = BABYLON.Vector3.Distance(camera.position, cameraPrePos);
        cameraPrePos.copyFrom(camera.position);

        if (dist > 0.05 && camera.position.y <= 2.2) { // only bob if moving on ground
            timeSeconds += engine.getDeltaTime() * 0.015;
            // Apply slight vertical offset simulating foot steps
            camera.cameraRotation.x += Math.sin(timeSeconds) * 0.0015;
            camera.cameraRotation.y += Math.cos(timeSeconds * 0.5) * 0.001;
        }
    });

    return { scene, camera };
};

const createPlayerMesh = (scene: BABYLON.Scene, id: string, team: string) => {
    // Player body
    const mesh = BABYLON.MeshBuilder.CreateCapsule("player_" + id, {radius: 0.6, height: 2.2}, scene);
    const mat = new BABYLON.StandardMaterial("player_mat_" + id, scene);
    mat.diffuseColor = team === "A" ? new BABYLON.Color3(0.2, 0.5, 1) : new BABYLON.Color3(1, 0.2, 0.2);
    mat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    mesh.material = mat;
    mesh.position.y = 1.1;
    mesh.checkCollisions = true;
    
    if (envSystem.shadowGenerator) {
        envSystem.shadowGenerator.addShadowCaster(mesh);
    }

    // Floating Team Marker above player's head for distant visibility
    const marker = BABYLON.MeshBuilder.CreateSphere("marker_" + id, {diameter: 0.3}, scene);
    const markerMat = new BABYLON.StandardMaterial("marker_mat_" + id, scene);
    markerMat.emissiveColor = team === "A" ? new BABYLON.Color3(0.3, 0.6, 1) : new BABYLON.Color3(1, 0.3, 0.3);
    markerMat.disableLighting = true; // Always visible
    marker.material = markerMat;

    return { mesh, marker };
};

const connectColyseus = async (scene: BABYLON.Scene, camera: BABYLON.UniversalCamera) => {
    const client = new Colyseus.Client('ws://localhost:2568');

    try {
        room = await client.joinOrCreate("battle");
        myPlayerId = room.sessionId;
        shootingSystem.setRoom(room);

        room.onMessage("kill", (message: { killer: string, victim: string, killerId?: string }) => {
            const isMyKill = message.killer === myTeam; 
            healthSystem.logKill(message.killer, message.victim, isMyKill);
        });

        room.state.players.onAdd((player: any, sessionId: string) => {
            if (sessionId === myPlayerId) {
                myTeam = player.team;
                camera.position.x = player.x;
                camera.position.y = 2.4;
                camera.position.z = player.z;
                
                healthSystem.updateHealth(player.hp, player.isDead);

                player.onChange(() => {
                    healthSystem.updateHealth(player.hp, player.isDead);
                });

            } else {
                const { mesh, marker } = createPlayerMesh(scene, sessionId, player.team);
                players[sessionId] = { mesh, marker };

                player.onChange(() => {
                    if (players[sessionId]) {
                        if (player.isDead) {
                            players[sessionId].mesh.isVisible = false;
                            players[sessionId].marker.isVisible = false;
                        } else {
                            players[sessionId].mesh.isVisible = true;
                            players[sessionId].marker.isVisible = true;
                            
                            players[sessionId].mesh.position.set(player.x, player.y, player.z);
                            players[sessionId].mesh.rotation.y = player.rotY;
                            
                            // Align marker directly above the player
                            players[sessionId].marker.position.set(player.x, player.y + 1.8, player.z);
                        }
                    }
                });
            }
        });

        room.state.players.onRemove((_player: any, sessionId: string) => {
            if (players[sessionId]) {
                players[sessionId].mesh.dispose();
                players[sessionId].marker.dispose();
                delete players[sessionId];
            }
        });

        room.state.zones.onAdd((zone: any, _key: string) => {
             updateZonesHUD(room.state.zones);
             
             // Base Visualization 
             const disk = BABYLON.MeshBuilder.CreateCylinder("zone_disk", {diameter: zone.radius * 2, height: 0.1}, scene);
             disk.position.set(zone.x, 0.05, zone.z);
             const diskMat = new BABYLON.StandardMaterial("zone_disk_mat", scene);
             diskMat.alpha = 0.2;
             diskMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
             disk.material = diskMat;
             
             // Animated Fill ring based on progress
             const fill = BABYLON.MeshBuilder.CreateCylinder("zone_fill", {diameter: zone.radius * 2, height: 0.2}, scene);
             fill.position.set(zone.x, 0.06, zone.z);
             const fillMat = new BABYLON.StandardMaterial("zone_fill_mat", scene);
             fillMat.alpha = 0.5;
             fillMat.emissiveColor = new BABYLON.Color3(0.5,0.5,0.5);
             fill.material = fillMat;
             fill.scaling.set(0.01, 1, 0.01); // starts empty

             zone.onChange(() => {
                 updateZonesHUD(room.state.zones);
                 
                 // Recolor base matching owner
                 if(zone.owner === "A") diskMat.diffuseColor = new BABYLON.Color3(0.2,0.5,1);
                 else if(zone.owner === "B") diskMat.diffuseColor = new BABYLON.Color3(1,0.2,0.2);
                 else diskMat.diffuseColor = new BABYLON.Color3(0.5,0.5,0.5);
                 
                 // Recolor fill matching capturer team
                 let cColor = new BABYLON.Color3(0.5,0.5,0.5);
                 if(zone.capturingTeam === "A") cColor = new BABYLON.Color3(0.2,0.5,1.0);
                 else if(zone.capturingTeam === "B") cColor = new BABYLON.Color3(1.0,0.2,0.2);
                 fillMat.emissiveColor = cColor;
                 fillMat.diffuseColor = cColor;
                 
                 // Update Scale representing capture progress (0 - 100%)
                 const p = Math.max(0.01, zone.captureProgress / 100);
                 fill.scaling.set(p, 1, p);
             });
        });

        room.state.onChange(() => {
            const scoreA = document.getElementById("scoreA");
            const scoreB = document.getElementById("scoreB");
            if(scoreA && scoreB) {
                scoreA.innerText = Math.floor(room.state.scoreA).toString();
                scoreB.innerText = Math.floor(room.state.scoreB).toString();
            }
        });

        scene.onBeforeRenderObservable.add(() => {
            if (room && myPlayerId) {
                room.send("move", {
                    x: camera.position.x,
                    y: camera.position.y - 1.2, // Send foot height relative
                    z: camera.position.z,
                    rotX: camera.rotation.x,
                    rotY: camera.rotation.y
                });
            }
        });

    } catch (e) {
        console.error("JOIN ERROR", e);
    }
};

const updateZonesHUD = (zones: any) => {
    const list = document.getElementById("zonesList");
    if (!list) return;
    
    let html = "";
    zones.forEach((z: any) => {
        let cls = "zone-neutral";
        if (z.owner === "A") cls = "zone-A";
        if (z.owner === "B") cls = "zone-B";
        html += `<div class="zone-indicator ${cls}">${Math.floor(z.captureProgress)}%</div>`;
    });
    list.innerHTML = html;
}

const { scene, camera } = createScene();

engine.runRenderLoop(() => {
    scene.render();
});

window.addEventListener('resize', () => {
    engine.resize();
});

connectColyseus(scene, camera);
