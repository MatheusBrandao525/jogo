export class HealthSystem {
    private hpTextEl: HTMLElement | null = null;
    private hpFillEl: HTMLElement | null = null;
    private overlayEl: HTMLElement | null = null;
    private killFeedEl: HTMLElement | null = null;

    constructor() {
        // Will map DOM elements explicitly via init
    }

    init(hpTextId: string, hpFillId: string, overlayId: string, feedId: string) {
        this.hpTextEl = document.getElementById(hpTextId);
        this.hpFillEl = document.getElementById(hpFillId);
        this.overlayEl = document.getElementById(overlayId);
        this.killFeedEl = document.getElementById(feedId);
    }

    updateHealth(hp: number, isDead: boolean) {
        if (!this.hpTextEl || !this.hpFillEl || !this.overlayEl) return;

        this.hpTextEl.innerText = hp.toString();
        
        // Smooth health bar width update
        this.hpFillEl.style.width = `${Math.max(0, hp)}%`;
        
        // Change color based on health
        if (hp <= 30) {
            this.hpFillEl.style.background = "#e74c3c"; // Red
        } else if (hp <= 60) {
            this.hpFillEl.style.background = "#f1c40f"; // Yellow
        } else {
            this.hpFillEl.style.background = "#2ecc71"; // Green
        }

        if (isDead) {
            this.hpTextEl.innerText = "DEAD (Respawning...)";
            this.overlayEl.classList.add("dead");
            this.overlayEl.innerText = "YOU DIED";
        } else {
            this.overlayEl.classList.remove("dead");
            this.overlayEl.innerText = "";
        }
    }

    logKill(killerTeam: string, victimTeam: string, isMyKill: boolean) {
        if (!this.killFeedEl) return;

        const log = document.createElement("div");
        log.className = "kill-log";
        
        if (isMyKill) {
            log.innerHTML = `🔥 <strong>You</strong> killed an enemy!`;
        } else {
            log.innerText = `Team ${killerTeam} eliminated Team ${victimTeam}`;
        }
        
        this.killFeedEl.appendChild(log);

        // Remove element after animation
        setTimeout(() => {
            if (log.parentElement) {
                log.parentElement.removeChild(log);
            }
        }, 4000);
    }
}
