export class ProgressionSystem {
    private levelEl: HTMLElement;
    private xpFillEl: HTMLElement;
    private notificationEl: HTMLElement;

    constructor() {
        this.levelEl = document.getElementById("levelText") as HTMLElement;
        this.xpFillEl = document.getElementById("xpFill") as HTMLElement;
        this.notificationEl = document.getElementById("levelUpNotification") as HTMLElement;
    }

    public getXpForNextLevel(level: number): number {
        return Math.floor(1000 * Math.pow(1.5, level - 1));
    }

    public updateUI(currentLevel: number, currentXp: number) {
        if (!this.levelEl || !this.xpFillEl) return;
        
        this.levelEl.innerText = `Lvl ${currentLevel}`;
        
        const reqXp = this.getXpForNextLevel(currentLevel);
        const p = Math.min(100, Math.max(0, (currentXp / reqXp) * 100));
        this.xpFillEl.style.width = `${p}%`;
    }

    public triggerLevelUp(newLevel: number) {
        if (!this.notificationEl) return;

        let msg = `LEVEL UP! You reached Level ${newLevel}!`;
        // Check hardcoded unlocks
        if (newLevel === 3) msg += `<br><span style="color:#f1c40f;">Unlocked: Sniper Class!</span>`;
        if (newLevel === 5) msg += `<br><span style="color:#e74c3c;">Unlocked: Heavy Class!</span>`;

        this.notificationEl.innerHTML = msg;
        this.notificationEl.classList.add("active");

        setTimeout(() => {
            this.notificationEl.classList.remove("active");
        }, 4000);
    }
}
