import * as BABYLON from 'babylonjs';
import { CLASS_CONFIG } from './ClassConfig';

export class MovementSystem {
    public body: BABYLON.Mesh;
    public camera: BABYLON.UniversalCamera;
    private scene: BABYLON.Scene;

    // Movement Properties
    private velocity = BABYLON.Vector3.Zero();
    private baseSpeed = 0.55; // Increased further for world scale
    private targetSpeed = 0.55;
    private sprintMultiplier = 1.3;
    private currentTilt = 0;

    // Jumping & Gravity
    private isGrounded = true;
    private pointerLocked = false;
    private maxJumpVelocity = 0.26; // Short tactical jump (approx 1.8 units high)
    private gravity = -0.018;     // Stronger gravity per frame

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
        this.body.position = new BABYLON.Vector3(0, 5, 0); 
        this.body.checkCollisions = true; 
        this.body.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);
        this.body.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);
        this.body.isVisible = false; // First person: hide own body capsule
        
        // Parent camera to body for First Person
        this.camera.parent = this.body;
        this.camera.position = new BABYLON.Vector3(0, 0.8, 0); // Head level relative to capsule center
        this.camera.setTarget(new BABYLON.Vector3(0, 0.8, 1)); // Look forward

        // Anti-sticking: Dampen velocity if we hit something
        this.body.onCollide = () => {
             this.velocity.x *= 0.5;
             this.velocity.z *= 0.5;
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
        const scale = config.scale;
        this.camera.position = new BABYLON.Vector3(0, 0.8, 0);
    }

    private setupInputs() {
        window.addEventListener("keydown", (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;

            // Jump
            if (key === ' ' && this.isGrounded && this.pointerLocked) {
                this.velocity.y = this.maxJumpVelocity;
                this.isGrounded = false;
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
        if (!this.pointerLocked) return;

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

        if (moveDir.length() > 0) moveDir.normalize();

        // Sprinting logic
        let speed = this.targetSpeed;
        if (this.keys['shift'] && this.keys['w']) speed *= this.sprintMultiplier;

        // Smooth Acceleration Phase (Increased fluidity)
        const desiredVelocity = moveDir.scale(speed);
        const acceleration = this.isGrounded ? 0.12 : 0.02; // Less control in air
        this.velocity.x = BABYLON.Scalar.Lerp(this.velocity.x, desiredVelocity.x, acceleration);
        this.velocity.z = BABYLON.Scalar.Lerp(this.velocity.z, desiredVelocity.z, acceleration);

        // Realism: Strafe Tilt
        let targetTilt = 0;
        if (this.keys['a']) targetTilt = 0.02;
        if (this.keys['d']) targetTilt = -0.02;
        this.currentTilt = BABYLON.Scalar.Lerp(this.currentTilt, targetTilt, 0.1);
        this.camera.rotation.z = this.currentTilt;

        // Custom Gravity Phase (checks collisions cleanly preventing sticking)
        this.velocity.y += this.gravity;
        
        // Final Physical Move
        const prevY = this.body.position.y;
        const prevPos = this.body.position.clone();
        this.body.moveWithCollisions(this.velocity);

        // Ground check: if we tried moving down but Y didn't change (or went up a ramp), we are grounded
        if (this.velocity.y < 0 && this.body.position.y >= prevY) {
            this.isGrounded = true;
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

        if (horizontalVelDist > 0.05 && horizontalMoveDist < 0.001) {
            // We are likely pushing against a face we can't slide on. 
            // Nudge away from velocity direction to prevent getting "eaten" by the geometry
            const nudge = this.velocity.normalize().scale(-0.02);
            nudge.y = 0;
            this.body.position.addInPlace(nudge);
            this.velocity.scaleInPlace(0.8); // Lose momentum
        }

        // Align Body Rotation visually with Camera (strictly Y axis)
        this.body.rotation.y = this.camera.rotation.y;
    }
}
