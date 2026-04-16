import './style.css';
import * as BABYLON from 'babylonjs';
import * as Colyseus from 'colyseus.js';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);

let room: Colyseus.Room;
let myPlayerId: string;
const players: { [id: string]: { mesh: BABYLON.Mesh } } = {};

const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.5, 0.7, 0.9, 1);

    const camera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 2, 0), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    
    // FPS controls
    camera.keysUp.push(87);    // W
    camera.keysDown.push(83);  // S
    camera.keysLeft.push(65);  // A
    camera.keysRight.push(68); // D
    camera.speed = 0.5;
    camera.angularSensibility = 2000;
    
    // Simple gravity and collisions
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
    camera.applyGravity = true;
    camera.checkCollisions = true;
    camera.ellipsoid = new BABYLON.Vector3(1, 1, 1);
    
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Ground
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 300, height: 300}, scene);
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.2);
    ground.material = groundMat;
    ground.checkCollisions = true;

    // Map Obstacles
    const createObstacle = (x:number, z:number, w:number, d:number) => {
        const obs = BABYLON.MeshBuilder.CreateBox("obs", {width: w, height: 4, depth: d}, scene);
        obs.position.x = x;
        obs.position.z = z;
        obs.position.y = 2;
        obs.checkCollisions = true;
    };
    // Simple map design
    createObstacle(-25, -15, 10, 2);
    createObstacle(-25, 15, 10, 2);
    createObstacle(25, -15, 10, 2);
    createObstacle(25, 15, 10, 2);
    createObstacle(0, 0, 4, 10);

    // Crosshair UI
    const uiContainer = document.getElementById("uiContainer") as HTMLElement;
    uiContainer.innerHTML = `
        <div class="crosshair"></div>
        <div class="hud-top">
            <div class="score-A">Team A: <span id="scoreA">0</span></div>
            <div class="score-B">Team B: <span id="scoreB">0</span></div>
        </div>
        <div class="zones-container" id="zonesList"></div>
        <div class="hud-bottom">
            HP: <span id="hp">100</span>
        </div>
    `;

    // Pointer lock for FPS
    scene.onPointerDown = (evt) => {
        if (evt.button === 0) engine.enterPointerlock();
        if (evt.button === 1) engine.exitPointerlock();
        
        // Shoot
        if (evt.button === 0 && room) {
            // Raycast
            const origin = camera.position;
            const forward = camera.getDirection(BABYLON.Vector3.Forward());
            const ray = new BABYLON.Ray(origin, forward, 100);
            const hit = scene.pickWithRay(ray);
            
            let hitId = null;
            if (hit && hit.pickedMesh && hit.pickedMesh.name.startsWith("player_")) {
                hitId = hit.pickedMesh.name.replace("player_", "");
            }
            
            room.send("shoot", { hitId });
        }
    };

    return { scene, camera };
};

const createPlayerMesh = (scene: BABYLON.Scene, id: string, team: string) => {
    const mesh = BABYLON.MeshBuilder.CreateBox("player_" + id, {width: 1, height: 2, depth: 1}, scene);
    const mat = new BABYLON.StandardMaterial("player_mat_" + id, scene);
    mat.diffuseColor = team === "A" ? new BABYLON.Color3(0.2, 0.5, 1) : new BABYLON.Color3(1, 0.2, 0.2);
    mesh.material = mat;
    mesh.position.y = 1;
    mesh.checkCollisions = true; // Other players can be shot
    return mesh;
};

const connectColyseus = async (scene: BABYLON.Scene, camera: BABYLON.UniversalCamera) => {
    const client = new Colyseus.Client('ws://localhost:2567');

    try {
        room = await client.joinOrCreate("battle");
        myPlayerId = room.sessionId;

        room.state.players.onAdd((player: any, sessionId: string) => {
            if (sessionId === myPlayerId) {
                // Initialize my camera position
                camera.position.x = player.x;
                camera.position.y = 2; // player height
                camera.position.z = player.z;
                
                // Update HUD
                player.onChange(() => {
                    const hpEl = document.getElementById("hp");
                    if(hpEl) hpEl.innerText = player.hp;
                    if (player.isDead) {
                        hpEl!.innerText = "DEAD (Respawning...)";
                    }
                });

            } else {
                // Create enemy/ally mesh
                const mesh = createPlayerMesh(scene, sessionId, player.team);
                players[sessionId] = { mesh };

                player.onChange(() => {
                    if (players[sessionId]) {
                        if (player.isDead) {
                            players[sessionId].mesh.isVisible = false;
                        } else {
                            players[sessionId].mesh.isVisible = true;
                            // Interpolation could be added here for smoothness
                            players[sessionId].mesh.position.set(player.x, player.y, player.z);
                            // Simple rotation sync:
                            players[sessionId].mesh.rotation.y = player.rotY;
                        }
                    }
                });
            }
        });

        room.state.players.onRemove((_player: any, sessionId: string) => {
            if (players[sessionId]) {
                players[sessionId].mesh.dispose();
                delete players[sessionId];
            }
        });

        room.state.zones.onAdd((zone: any, _key: string) => {
             updateZonesHUD(room.state.zones);
             zone.onChange(() => updateZonesHUD(room.state.zones));
             
             // Create visual circle for zone
             const torus = BABYLON.MeshBuilder.CreateTorus("zone_ring", {diameter: zone.radius * 2, thickness: 0.5}, scene);
             torus.position.set(zone.x, 0.25, zone.z);
             const mat = new BABYLON.StandardMaterial("zone_mat", scene);
             mat.emissiveColor = new BABYLON.Color3(0.5,0.5,0.5);
             torus.material = mat;
             
             zone.onChange(() => {
                 if(zone.owner === "A") (torus.material as BABYLON.StandardMaterial).emissiveColor = new BABYLON.Color3(0.2,0.5,1);
                 else if(zone.owner === "B") (torus.material as BABYLON.StandardMaterial).emissiveColor = new BABYLON.Color3(1,0.2,0.2);
                 else (torus.material as BABYLON.StandardMaterial).emissiveColor = new BABYLON.Color3(0.5,0.5,0.5);
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

        // Sync local position to server
        scene.onBeforeRenderObservable.add(() => {
            if (room && myPlayerId) {
                room.send("move", {
                    x: camera.position.x,
                    y: camera.position.y - 1, // send feet pos
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
    
    // Sort logic requires collecting correctly, here we just iterate
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
