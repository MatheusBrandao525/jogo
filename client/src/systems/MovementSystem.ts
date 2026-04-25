import * as BABYLON from 'babylonjs';
import { CLASS_CONFIG } from './ClassConfig';

export class MovementSystem {
    public body: BABYLON.Mesh;
    public camera: BABYLON.UniversalCamera;
    private scene: BABYLON.Scene;

    // Movement Properties
    private velocity = BABYLON.Vector3.Zero();
    private baseSpeed = 28;
    private targetSpeed = 28;
    private sprintMultiplier = 1.3;
    private currentTilt = 0;
    private currentSpeedRatio = 0;
    private sprinting = false;

    // Jumping & Gravity
    private isGrounded = true;
    private pointerLocked = false;
    private jumpVelocity = 8.3;
    private gravity = -48;
    private coyoteTime = 0;
    private jumpBuffer = 0;
    private readonly maxCoyoteTime = 0.1;
    private readonly maxJumpBuffer = 0.12;
    private readonly bodyHeightOffset = 1.1;
    private readonly safeSpawnLift = 1.4;

    // Inputs
    private keys: { [key: string]: boolean } = {
        'w': false, 'a': false, 's': false, 'd': false, ' ': false, 'shift': false
    };

    constructor(scene: BABYLON.Scene, camera: BABYLON.UniversalCamera) {
        this.scene = scene;
        this.camera = camera;

        // Disconnect Babylon's default WASD to handle it manually for smoothness
        this.camera.keysUp = [];
        this.camera.keysDown = [];
        this.camera.keysLeft = [];
        this.camera.keysRight = [];
        this.camera.applyGravity = false; // We handle gravity physically
        this.camera.checkCollisions = false;

        // Create logical physical player body (invisible capsule)
        this.body = BABYLON.MeshBuilder.CreateCapsule("localPlayerBody", { radius: 0.6, height: 2.2 }, scene);
        this.body.position = new BABYLON.Vector3(0, 3, 0); 
        this.body.checkCollisions = true; 
        this.body.ellipsoid = new BABYLON.Vector3(0.32, 0.9, 0.32);
        this.body.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);
        this.body.isVisible = false; // First person: hide own body capsule
        
        // Parent camera to body for First Person
        this.camera.parent = this.body;
        this.camera.position = new BABYLON.Vector3(0, 0.8, 0); // Head level relative to capsule center
        this.camera.setTarget(new BABYLON.Vector3(0, 0.8, 1)); // Look forward

        // Anti-sticking: Dampen velocity if we hit something
        this.body.onCollide = () => {
             this.velocity.x *= 0.94;
             this.velocity.z *= 0.94;
        };

        this.setupInputs();
        this.scene.onBeforeRenderObservable.add(() => this.update());
    }

    public applyClassProfile(className: string) {
        const config = CLASS_CONFIG[className] || CLASS_CONFIG["Infantry"];
        this.targetSpeed = this.baseSpeed * config.speedMultiplier;
        
        // Dynamic Scaling
        this.body.scaling.setAll(config.scale);
        
        // Adjust camera offset for larger players if needed
        this.camera.position = new BABYLON.Vector3(0, 0.8, 0);
    }

    public getHorizontalSpeedRatio() {
        return this.currentSpeedRatio;
    }

    public isSprinting() {
        return this.sprinting;
    }

    public teleportToSpawn(x: number, z: number, footY: number = 1) {
        this.body.position.set(x, Math.max(footY + this.safeSpawnLift, 2.4), z);
        this.velocity.setAll(0);
        this.isGrounded = false;
        this.coyoteTime = 0;
        this.jumpBuffer = 0;
    }

    public getNetworkFootY() {
        return Math.max(0, this.body.position.y - this.bodyHeightOffset);
    }

    private setupInputs() {
        window.addEventListener("keydown", (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;

            // Jump
            if (key === ' ') {
                e.preventDefault();
                this.jumpBuffer = this.maxJumpBuffer;
            }
        });

        window.addEventListener("keyup", (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
        });

        document.addEventListener("pointerlockchange", () => {
            this.pointerLocked = document.pointerLockElement !== null;
        });
    }

    private update() {
        const dt = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.05);

        if (this.body.position.y < -6) {
            this.teleportToSpawn(this.body.position.x, this.body.position.z);
            return;
        }

        if (!this.pointerLocked) {
            this.velocity.setAll(0);
            this.currentSpeedRatio = 0;
            this.sprinting = false;
            this.jumpBuffer = 0;
            this.currentTilt = BABYLON.Scalar.Lerp(this.currentTilt, 0, 1 - Math.exp(-10 * dt));
            this.camera.rotation.z = this.currentTilt;
            return;
        }

        this.coyoteTime = Math.max(0, this.coyoteTime - dt);
        this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

        // Determine input direction strictly relative to camera's Y-rotation (looking left/right)
        const forward = this.camera.getDirection(BABYLON.Vector3.Forward()).normalize();
        const right = this.camera.getDirection(BABYLON.Vector3.Right()).normalize();
        
        // Remove vertical component so we don't move into the ground when looking down
        forward.y = 0; right.y = 0;
        forward.normalize(); right.normalize();

        const moveDir = BABYLON.Vector3.Zero();

        if (this.keys['w']) moveDir.addInPlace(forward);
        if (this.keys['s']) moveDir.subtractInPlace(forward);
        if (this.keys['d']) moveDir.addInPlace(right);
        if (this.keys['a']) moveDir.subtractInPlace(right);

        const hasMoveInput = this.pointerLocked && moveDir.length() > 0;
        if (hasMoveInput) moveDir.normalize();
        else moveDir.setAll(0);

        // Sprinting logic
        let speed = this.targetSpeed;
        this.sprinting = this.pointerLocked && this.keys['shift'] && this.keys['w'] && !this.keys['s'];
        if (this.sprinting) speed *= this.sprintMultiplier;

        // Smooth acceleration with frame-rate independent damping.
        const desiredVelocity = moveDir.scale(speed);
        const accelerationRate = this.isGrounded ? (hasMoveInput ? 16 : 11) : 4.5;
        const acceleration = 1 - Math.exp(-accelerationRate * dt);
        this.velocity.x = BABYLON.Scalar.Lerp(this.velocity.x, desiredVelocity.x, acceleration);
        this.velocity.z = BABYLON.Scalar.Lerp(this.velocity.z, desiredVelocity.z, acceleration);
        this.currentSpeedRatio = BABYLON.Scalar.Clamp(
            new BABYLON.Vector2(this.velocity.x, this.velocity.z).length() / (this.targetSpeed * this.sprintMultiplier),
            0,
            1
        );

        // Realism: Strafe Tilt
        let targetTilt = 0;
        if (this.pointerLocked && this.keys['a']) targetTilt = 0.025;
        if (this.pointerLocked && this.keys['d']) targetTilt = -0.025;
        this.currentTilt = BABYLON.Scalar.Lerp(this.currentTilt, targetTilt, 1 - Math.exp(-10 * dt));
        this.camera.rotation.z = this.currentTilt;

        if (this.jumpBuffer > 0 && (this.isGrounded || this.coyoteTime > 0) && this.pointerLocked) {
            this.velocity.y = this.jumpVelocity;
            this.isGrounded = false;
            this.coyoteTime = 0;
            this.jumpBuffer = 0;
        }

        // Custom Gravity Phase (checks collisions cleanly preventing sticking)
        this.velocity.y += this.gravity * dt;
        
        // Final Physical Move
        const prevY = this.body.position.y;
        const prevPos = this.body.position.clone();
        const frameMove = this.velocity.scale(dt);
        this.body.moveWithCollisions(frameMove);

        // Ground check: if we tried moving down but Y didn't change (or went up a ramp), we are grounded
        if (this.velocity.y < 0 && this.body.position.y >= prevY) {
            this.isGrounded = true;
            this.coyoteTime = this.maxCoyoteTime;
            this.velocity.y = 0; 
        } else {
            this.isGrounded = false;
        }

        // Anti-Stuck Nudge: If we moved very little despite high horizontal velocity, nudge back slightly
        const horizontalMoveDist = BABYLON.Vector2.Distance(
            new BABYLON.Vector2(this.body.position.x, this.body.position.z),
            new BABYLON.Vector2(prevPos.x, prevPos.z)
        );
        const horizontalVelDist = new BABYLON.Vector2(this.velocity.x, this.velocity.z).length();

        if (horizontalVelDist > 1.5 && horizontalMoveDist < 0.006) {
            // We are likely pushing against a face we can't slide on. 
            // Nudge away from velocity direction to prevent getting "eaten" by the geometry
            const nudge = this.velocity.clone().normalize().scale(-0.08);
            nudge.y = 0;
            this.body.position.addInPlace(nudge);
            this.velocity.scaleInPlace(0.92); // Lose a little momentum while preserving slide feel
        }

        // Align Body Rotation visually with Camera (strictly Y axis)
        this.body.rotation.y = this.camera.rotation.y;
    }
}
