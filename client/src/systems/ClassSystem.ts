import * as Colyseus from '@colyseus/sdk';
import { CLASS_CONFIG } from './ClassConfig';
import { ShootingSystem } from './ShootingSystem';

export class ClassSystem {
    private room: Colyseus.Room | null = null;
    private uiElement: HTMLElement;
    private shootingSystem: ShootingSystem;
    private currentClass: string = "Infantry";
    private currentPlayerLevel: number = 1;
    public isMenuOpen: boolean = false;
    private isCountingDown: boolean = false;

    constructor(uiId: string, shootingSystem: ShootingSystem) {
        this.uiElement = document.getElementById(uiId) as HTMLElement;
        this.shootingSystem = shootingSystem;

        this.setupUI();
    }

    get activeClass(): string {
        return this.currentClass;
    }

    setPlayerLevel(level: number) {
        if (this.currentPlayerLevel !== level) {
            this.currentPlayerLevel = level;
            this.setupUI(); // Re-render unlocks
        }
    }

    setRoom(room: Colyseus.Room) {
        this.room = room;
    }

    show() {
        this.setupUI(); // Refresh cards
        this.isMenuOpen = true;
        this.uiElement.style.display = "flex";
        document.exitPointerLock();
    }

    hide() {
        this.isMenuOpen = false;
        this.uiElement.style.display = "none";
    }

    private setupUI() {
        if (this.isCountingDown) return;
        let html = `<h2>Select Class</h2><div style="display:flex;gap:20px;justify-content:center;margin-top:20px;">`;
        Object.keys(CLASS_CONFIG).forEach(key => {
            const c = CLASS_CONFIG[key];
            const isLocked = this.currentPlayerLevel < c.unlockLevel;
            const isCurrent = this.currentClass === key;
            
            html += `
                <div class="class-card ${isLocked ? 'locked' : ''} ${isCurrent ? 'current' : ''}" data-class="${key}">
                    ${isCurrent ? '<div class="current-label">Active</div>' : ''}
                    <h3>${c.name}</h3>
                    <p>HP: ${c.maxHp}</p>
                    <p>DMG: ${c.damage}</p>
                    <p>Speed: ${c.speedMultiplier}x</p>
                    ${isLocked ? `<div class="lock-overlay">Unlocks Lvl ${c.unlockLevel}</div>` : ''}
                </div>
            `;
        });
        html += `</div>`;
        this.uiElement.innerHTML = html;

        // Add event listeners to all cards
        const cards = this.uiElement.querySelectorAll('.class-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const classKey = (card as HTMLElement).dataset.class;
                if (classKey && this.currentPlayerLevel >= CLASS_CONFIG[classKey].unlockLevel) {
                    // Lock pointer immediately on user interaction
                    const canvas = document.getElementById("renderCanvas");
                    if (canvas) {
                        canvas.requestPointerLock();
                    }
                    this.selectClass(classKey);
                }
            });
        });
    }

    private selectClass(key: string) {
        if (!CLASS_CONFIG[key] || !this.room) return;
        
        this.currentClass = key;
        
        // Notify server
        this.room.send("change_class", { classType: key });
        
        // Update local shooting profile immediately
        this.shootingSystem.applyClassProfile(CLASS_CONFIG[key]);

        // Countdown Logic
        this.startCountdown();
    }

    private startCountdown() {
        this.isCountingDown = true;
        
        // Clear previous UI and show countdown
        this.uiElement.innerHTML = `
            <div style="font-size: 48px; font-weight: bold; text-transform: uppercase; letter-spacing: 5px; color: white; text-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                Deploying in...
                <div id="deploymentTimer" style="font-size: 120px; color: #2ecc71; margin-top: 20px;">3</div>
                <div style="font-size: 16px; margin-top: 20px; opacity: 0.7;">Prepare for Combat</div>
            </div>
        `;

        let timeLeft = 3;
        const timerEl = document.getElementById("deploymentTimer");
        
        const interval = setInterval(() => {
            if (!this.isMenuOpen) {
                clearInterval(interval);
                this.isCountingDown = false;
                return;
            }

            timeLeft--;
            if (timerEl) timerEl.innerText = Math.max(0, timeLeft).toString();
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                this.isCountingDown = false;
                this.hide();
                
                // Final Pointer Lock attempt if not already locked
                const canvas = document.getElementById("renderCanvas");
                if (canvas && document.pointerLockElement !== canvas) {
                    canvas.requestPointerLock();
                }
            }
        }, 1000);
    }
}
