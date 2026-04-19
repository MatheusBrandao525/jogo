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
        this.isMenuOpen = true;
        this.uiElement.style.display = "flex";
        document.exitPointerLock();
    }

    hide() {
        this.isMenuOpen = false;
        this.uiElement.style.display = "none";
    }

    private setupUI() {
        let html = `<h2>Select Class</h2><div style="display:flex;gap:20px;justify-content:center;margin-top:20px;">`;
        Object.keys(CLASS_CONFIG).forEach(key => {
            const c = CLASS_CONFIG[key];
            const isLocked = this.currentPlayerLevel < c.unlockLevel;
            
            html += `
                <div class="class-card ${isLocked ? 'locked' : ''}" ${!isLocked ? `onclick="window.selectClass('${key}')"` : ''}>
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

        (window as any).selectClass = (key: string) => {
            if (this.currentPlayerLevel >= CLASS_CONFIG[key].unlockLevel) {
                 this.selectClass(key);
            }
        };
    }

    private selectClass(key: string) {
        if (!CLASS_CONFIG[key] || !this.room) return;
        this.currentClass = key;
        
        // Notify server
        this.room.send("change_class", { classType: key });
        
        // Update local shooting profile immediately
        this.shootingSystem.applyClassProfile(CLASS_CONFIG[key]);
        this.hide();
    }
}
