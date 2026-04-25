import './style.css';
import * as BABYLON from 'babylonjs';
import * as Colyseus from '@colyseus/sdk';

import { ShootingSystem } from './systems/ShootingSystem';
import { HealthSystem } from './systems/HealthSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { ClassSystem } from './systems/ClassSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { MinimapSystem } from './systems/MinimapSystem';
import { MovementSystem } from './systems/MovementSystem';
import { CLASS_CONFIG } from './systems/ClassConfig';
import { CharacterRenderer } from './systems/CharacterRenderer';
import { BattleState } from './schema/BattleState';


const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);

// Prevent right-click context menu popping up on zoom
canvas.oncontextmenu = (e) => e.preventDefault();

let room: Colyseus.Room<BattleState>;
let myPlayerId: string;
let myTeam: string;
const players: { [id: string]: { mesh: BABYLON.Mesh, marker: BABYLON.Mesh } } = {};

const healthSystem = new HealthSystem();
let shootingSystem: ShootingSystem;
let envSystem: EnvironmentSystem;

// Injected UI
const uiContainer = document.getElementById("uiContainer") as HTMLElement;
uiContainer.innerHTML = `
    <div id="startScreen" class="start-screen">
        <h1>BATTLEFIELD</h1>
        <p>LOW-POLY COMBAT ARENA</p>
        <button class="play-button" id="playBtn">Play</button>
    </div>
    <div id="levelUpNotification" class="level-notification"></div>
    <div id="classSelectionScreen" class="class-selection-overlay" style="display:none;"></div>
    <div id="matchOverlay" class="match-overlay"></div>
    <div id="fullscreenOverlay"></div>
    <div class="kill-feed" id="killFeed"></div>
    <div class="hit-marker" id="hitMarker"></div>
    <div class="crosshair" id="crosshair" aria-hidden="true">
        <span class="crosshair-dot"></span>
        <span class="crosshair-line crosshair-line-top"></span>
        <span class="crosshair-line crosshair-line-right"></span>
        <span class="crosshair-line crosshair-line-bottom"></span>
        <span class="crosshair-line crosshair-line-left"></span>
    </div>
    <canvas id="minimap" class="minimap" width="200" height="200"></canvas>
    
    <div class="hud-top" style="display:none;" id="hudTop">
        <div class="progression-container">
            <span id="levelText" style="font-weight:bold; color:#f1c40f;">Lvl 1</span>
            <div class="xp-bar-container">
                <div class="xp-bar-fill" id="xpFill"></div>
            </div>
        </div>
        <div class="score-A">Score A: <span id="scoreA">0</span></div>
        <div class="match-info">
            <span id="roundNumber">Round 1</span> | <span id="matchTimer">5:00</span>
            <br><span style="font-size:12px; font-weight:normal">Wins - A: <span id="winsA">0</span> | B: <span id="winsB">0</span></span>
        </div>
        <div class="score-B">Score B: <span id="scoreB">0</span></div>
    </div>
    
    <div class="event-banner" id="eventBanner" style="display:none;">
        <h3 id="eventName">DOUBLE CAPTURE</h3>
        <p id="eventTimer">20s</p>
    </div>

    <div class="zones-container" id="zonesList"></div>
    <div class="hud-bottom" style="display:none;" id="hudBottom">
        HP: <span id="hpText">100</span>
        <div class="health-bar-container">
            <div class="health-bar-fill" id="hpFill"></div>
        </div>
    </div>
`;

document.getElementById("playBtn")!.addEventListener("click", () => {
    document.getElementById("startScreen")!.style.display = "none";
    connectColyseus(scene, camera);
});
healthSystem.init("hpText", "hpFill", "fullscreenOverlay", "killFeed");
    
let classSystem: ClassSystem;
let progressionSystem: ProgressionSystem;
let minimapSystem: MinimapSystem;
let movementSystem: MovementSystem;

const createScene = function () {
    const scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;
    
    // Environment & Atmosphere
    envSystem = new EnvironmentSystem(scene);
    const environmentReady = envSystem.initialize(); // Loads GLBs asynchronously

    const camera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 2, 0), scene);
    camera.minZ = 0.2; // Prevent near-clipping into large objects
    camera.angularSensibility = 4500;
    camera.inertia = 0.35;
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    
    // Heavier Gravity (for scene objects, not player anymore)
    scene.gravity = new BABYLON.Vector3(0, -18, 0);

    movementSystem = new MovementSystem(scene, camera);
    
    shootingSystem = new ShootingSystem(scene, camera);
    shootingSystem.setHitMarkerElement(document.getElementById("hitMarker") as HTMLElement);
    shootingSystem.setCrosshairElement(document.getElementById("crosshair") as HTMLElement);
    
    // Pass asset manager to shooting system
    shootingSystem.setAssetManager(envSystem.assetManager);

    classSystem = new ClassSystem("classSelectionScreen", shootingSystem);
    progressionSystem = new ProgressionSystem();
    minimapSystem = new MinimapSystem("minimap");
    
    // We update gun visual once assets are ready
    environmentReady.then(() => {
        shootingSystem.updateGunVisual(classSystem.activeClass);
    });

    scene.onPointerDown = (evt) => {
        if (evt.button === 0) engine.enterPointerlock();
        if (evt.button === 1) engine.exitPointerlock();
        if (evt.button === 0) shootingSystem.startFiring();
        
        // Right Click Zoom logic for Sniper
        if (evt.button === 2 && classSystem.activeClass === "Sniper") {
            camera.fov = 0.3; // Zoom in
        }
    };

    scene.onPointerUp = (evt) => {
        if (evt.button === 0) shootingSystem.stopFiring();
        if (evt.button === 2) {
            camera.fov = 0.8; // Restore normal FOV
        }
    };


    // Head Bobbing logic mapping to body distance now
    let timeSeconds = 0;
    let bodyPrePos = movementSystem.body.position.clone();
    
    scene.onBeforeRenderObservable.add(() => {
        const currentPos = movementSystem.body.position;
        const dist = BABYLON.Vector3.Distance(currentPos, bodyPrePos);
        bodyPrePos.copyFrom(currentPos);

        const isMoving = dist > 0.02;
        const isOnGround = movementSystem.body.position.y <= 2.5; // simple height check

        if (isMoving && isOnGround) {
            // Scale animation speed directly with distance traveled for perfect sync
            // A lower factor (0.25) makes the stride feel longer and more realistic
            timeSeconds += dist * 0.25; 
            
            // Vertical bobbing (slight increase in amplitude for feedback)
            camera.position.y = 0.8 + Math.sin(timeSeconds * 2) * 0.05;
            
            // Subtle horizontal sway
            camera.cameraRotation.y += Math.cos(timeSeconds) * 0.0006;
        } else {
            // Return to center slowly
            camera.position.y = BABYLON.Scalar.Lerp(camera.position.y, 0.8, 0.1);
        }

        const crosshair = document.getElementById("crosshair");
        if (crosshair) {
            const speedRatio = movementSystem.getHorizontalSpeedRatio();
            crosshair.style.setProperty("--move-spread", `${Math.round(speedRatio * 18)}px`);
            crosshair.classList.toggle("moving", speedRatio > 0.12);
            crosshair.classList.toggle("sprinting", movementSystem.isSprinting());
        }
    });

    return { scene, camera };
};

const createPlayerMesh = (scene: BABYLON.Scene, id: string, team: string, classType: string = "Infantry") => {
    // Player body collider
    const cnf = CLASS_CONFIG[classType] || CLASS_CONFIG["Infantry"];
    const mesh = BABYLON.MeshBuilder.CreateCapsule("player_" + id, {radius: 0.6, height: 2.2}, scene);
    mesh.isVisible = false; // collider is invisible
    
    // Attach Character Visuals
    const visual = CharacterRenderer.createLowPolyCharacter(scene, id, team, classType, envSystem.assetManager);
    visual.parent = mesh;
    visual.position.y = -1.1; // adjust to capsule center
    
    mesh.position.y = 1.1;
    mesh.scaling.setAll(cnf.scale);
    mesh.checkCollisions = true;
    
    if (envSystem.shadowGenerator) {
        visual.getChildMeshes().forEach(m => envSystem.shadowGenerator!.addShadowCaster(m));
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

    // Simple temporary persistence mechanism
    let storedUserId = localStorage.getItem("jogo_user_id");
    if (!storedUserId) {
        storedUserId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem("jogo_user_id", storedUserId);
    }

    try {
        room = await client.joinOrCreate<BattleState>("battle", { userId: storedUserId });
        myPlayerId = room.sessionId;
        
        shootingSystem.setRoom(room);
        classSystem.setRoom(room);

        room.onMessage("level_up", (data: { level: number }) => {
            progressionSystem.triggerLevelUp(data.level);
        });

        room.onMessage("kill", (message: { killer: string, victim: string, killerId?: string }) => {
            const isMyKill = message.killer === myTeam; 
            healthSystem.logKill(message.killer, message.victim, isMyKill);
        });

        room.onMessage("round_start", () => {
            // Teleport player body back to base
            movementSystem.teleportToSpawn(myTeam === "A" ? -100 : 100, 0);
            camera.rotation.setAll(0);
        });

        // Use onStateChange.once to ensure the schema is fully synchronized before attaching listeners
        room.onStateChange.once((state: BattleState) => {
            console.log("Match State Synchronized", state);
            
            (state.players as any).onAdd((player: any, sessionId: string) => {
                console.log("Player Joined:", sessionId, player.team);
                if (sessionId === myPlayerId) {
                    myTeam = player.team;
                    movementSystem.teleportToSpawn(player.x, player.z, player.y);
                    
                    healthSystem.updateHealth(player.hp, player.isDead);
                    minimapSystem.setContext(room, myPlayerId, myTeam);

                    document.getElementById("hudTop")!.style.display = "flex";
                    document.getElementById("hudBottom")!.style.display = "block";

                    classSystem.setPlayerLevel(player.level);
                    progressionSystem.updateUI(player.level, player.xp);
                    movementSystem.applyClassProfile(player.classType);
                    shootingSystem.updateGunVisual(player.classType);
                    
                    let localVisual: BABYLON.AbstractMesh | null = null;
                    let localClassType = player.classType;
                    const setupLocalVisual = () => {
                        if (localVisual) localVisual.dispose();
                        localVisual = CharacterRenderer.createLowPolyCharacter(scene, "local", player.team, player.classType, envSystem.assetManager);
                        localVisual.parent = movementSystem.body;
                        localVisual.position.y = -1.1;
                        localVisual.getChildMeshes().forEach(m => m.isVisible = false); // Hide all parts of own body
                        movementSystem.body.isVisible = false; 
                    };
                    setupLocalVisual();

                    player.onChange(() => {
                        healthSystem.updateHealth(player.hp, player.isDead);
                        classSystem.setPlayerLevel(player.level);
                        progressionSystem.updateUI(player.level, player.xp);
                        
                        if (player.classType !== localClassType) {
                             localClassType = player.classType;
                             movementSystem.applyClassProfile(player.classType);
                             shootingSystem.updateGunVisual(player.classType);
                             setupLocalVisual();
                             if (localVisual) (localVisual as any).metadata = { classType: player.classType };
                        }
                    });

                    classSystem.show();

                } else {
                    const { mesh, marker } = createPlayerMesh(scene, sessionId, player.team, player.classType);
                    players[sessionId] = { mesh, marker };

                    player.onChange(() => {
                        if (players[sessionId]) {
                            if (player.isDead) {
                                players[sessionId].mesh.isVisible = false;
                                players[sessionId].marker.isVisible = false;
                            } else {
                                players[sessionId].mesh.isVisible = true;
                                players[sessionId].marker.isVisible = true;
                                
                                const cnf = CLASS_CONFIG[player.classType] || CLASS_CONFIG["Infantry"];
                                players[sessionId].mesh.scaling.setAll(cnf.scale);

                                players[sessionId].mesh.position.set(player.x, player.y + 1.1, player.z);
                                players[sessionId].mesh.rotation.y = player.rotY;
                                players[sessionId].marker.position.set(player.x, player.y + (1.8 * cnf.scale) + 1.1, player.z);
                            }
                        }
                    });
                }
            });

            (state.players as any).onRemove((_player: any, sessionId: string) => {
                if (players[sessionId]) {
                    players[sessionId].mesh.dispose();
                    players[sessionId].marker.dispose();
                    delete players[sessionId];
                }
            });

            (state.zones as any).onAdd((zone: any, _key: string) => {
                updateZonesHUD(state.zones);
            // ... (rest of zone logic)
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

        const updateHUD = () => {
            if (!room) return;
            const scoreA = document.getElementById("scoreA");
            const scoreB = document.getElementById("scoreB");
            const winsA = document.getElementById("winsA");
            const winsB = document.getElementById("winsB");
            const roundNumber = document.getElementById("roundNumber");
            const matchTimer = document.getElementById("matchTimer");
            const matchOverlay = document.getElementById("matchOverlay");

            if(scoreA && scoreB) {
                scoreA.innerText = Math.floor(room.state.scoreA || 0).toString();
                scoreB.innerText = Math.floor(room.state.scoreB || 0).toString();
            }
            if(winsA && winsB) {
                winsA.innerText = (room.state.roundWinsA || 0).toString();
                winsB.innerText = (room.state.roundWinsB || 0).toString();
                roundNumber!.innerText = `Round ${room.state.currentRound || 1}`;
                
                // Format Timer
                const timerVal = room.state.timer || 0;
                const m = Math.floor(timerVal / 60);
                const s = Math.floor(timerVal % 60);
                matchTimer!.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
            }
            
            if (matchOverlay) {
                if (room.state.matchState === "round_end" || room.state.matchState === "match_end") {
                    matchOverlay.innerText = room.state.statusMessage;
                    matchOverlay.classList.add("active");
                } else if (room.state.timer > 295) { // Show "Round Start" for first 5 seconds
                    matchOverlay.innerText = room.state.statusMessage;
                    matchOverlay.classList.add("active");
                } else {
                    matchOverlay.classList.remove("active");
                }
            }

            const eb = document.getElementById("eventBanner");
            if (eb) {
                if (room.state.activeEvent !== "none") {
                    eb.style.display = "block";
                    document.getElementById("eventName")!.innerText = room.state.activeEvent.toUpperCase();
                    document.getElementById("eventTimer")!.innerText = Math.ceil(room.state.eventTimeLeft) + "s";
                } else {
                    eb.style.display = "none";
                }
            }
        };

        room.onStateChange(() => {
             updateHUD();
        });

        scene.onBeforeRenderObservable.add(() => {
             updateHUD();
            if (room && myPlayerId && movementSystem) {
                room.send("move", {
                    x: movementSystem.body.position.x,
                    y: movementSystem.getNetworkFootY(), // Send foot level relative to schema
                    z: movementSystem.body.position.z,
                    rotX: camera.rotation.x,
                    rotY: camera.rotation.y
                });
            }
        });

        // Show class menu on connect and via 'C'
        window.addEventListener('keydown', (e) => {
            if (e.key === 'c' || e.key === 'C') {
                if (classSystem.isMenuOpen) {
                    classSystem.hide();
                    engine.enterPointerlock();
                } else {
                    shootingSystem.stopFiring();
                    classSystem.show();
                }
            }
        });
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
    if (minimapSystem) minimapSystem.update();
});

window.addEventListener('resize', () => {
    engine.resize();
});

// Game waits for user to click "Play" to connect
