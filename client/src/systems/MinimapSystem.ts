import * as Colyseus from 'colyseus.js';

export class MinimapSystem {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private room: Colyseus.Room | null = null;
    private myPlayerId: string = "";
    private myTeam: string = "";

    // Map bounds mapping into 200x200 canvas
    private readonly MAP_WORLD_SIZE = 300; // -150 to 150
    private readonly UI_SIZE = 200;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.ctx = this.canvas.getContext("2d")!;
    }

    public setContext(room: Colyseus.Room, myPlayerId: string, myTeam: string) {
        this.room = room;
        this.myPlayerId = myPlayerId;
        this.myTeam = myTeam;
    }

    private worldToUI(wx: number, wz: number) {
        // Map [-150, 150] to [0, 200]
        const x = ((wx + (this.MAP_WORLD_SIZE / 2)) / this.MAP_WORLD_SIZE) * this.UI_SIZE;
        // Z is forward in Babylon, but Canvas Y is downward. Invert Z to map to Y accurately
        const y = (((this.MAP_WORLD_SIZE / 2) - wz) / this.MAP_WORLD_SIZE) * this.UI_SIZE;
        return { x, y };
    }

    private getTeamColor(team: string) {
        if (team === 'A') return "#3498db"; // Blue
        if (team === 'B') return "#e74c3c"; // Red
        return "#7f8c8d"; // Neutral
    }

    public update() {
        if (!this.room || !this.ctx) return;

        // Clear Background natively
        this.ctx.clearRect(0, 0, this.UI_SIZE, this.UI_SIZE);
        
        // Draw elegant circular boundaries framing
        this.ctx.beginPath();
        this.ctx.arc(this.UI_SIZE / 2, this.UI_SIZE / 2, this.UI_SIZE / 2 - 5, 0, Math.PI * 2);
        this.ctx.fillStyle = "rgba(10, 20, 20, 0.6)";
        this.ctx.fill();
        this.ctx.strokeStyle = "rgba(46, 204, 113, 0.3)";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        this.drawZones();
        this.drawPlayers();
    }

    private drawZones() {
        const zones = this.room!.state.zones;
        zones.forEach((zone: any) => {
            const pos = this.worldToUI(zone.x, zone.z);
            const radius = (zone.radius / this.MAP_WORLD_SIZE) * this.UI_SIZE;

            // Base Zone Area
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = this.getTeamColor(zone.owner) + "55"; // 55 adds alpha transparency in hex
            this.ctx.fill();
            
            if (zone.isHighValue) {
                // High Value Zone indication (Gold pulse)
                this.ctx.strokeStyle = "#f1c40f";
                this.ctx.lineWidth = 3;
            } else {
                this.ctx.strokeStyle = this.getTeamColor(zone.owner);
                this.ctx.lineWidth = 1.5;
            }
            this.ctx.stroke();

            // Capture Progress Inner Fill
            if (zone.captureProgress > 0) {
                const progressRadius = radius * (zone.captureProgress / 100);
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, progressRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = this.getTeamColor(zone.capturingTeam) + "AA";
                this.ctx.fill();
            }
        });
    }

    private drawPlayers() {
        const players = this.room!.state.players;
        const me = players.get(this.myPlayerId);
        if (!me) return;

        players.forEach((p: any, sessionId: string) => {
            if (p.isDead) return;

            const isMe = sessionId === this.myPlayerId;
            const isAlly = p.team === this.myTeam;
            
            // Vision Logic: Enemies are only visible if within radar range (e.g. 50 babylon units)
            if (!isAlly) {
                const dist = Math.sqrt((p.x - me.x) ** 2 + (p.z - me.z) ** 2);
                if (dist > 50) return; // Fog of war / omitted from minimap
            }

            const pos = this.worldToUI(p.x, p.z);

            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, isMe ? 4 : 3, 0, Math.PI * 2);
            
            if (isMe) {
                this.ctx.fillStyle = "#f1c40f"; // Gold for me
            } else {
                this.ctx.fillStyle = this.getTeamColor(p.team);
            }
            this.ctx.fill();

            // Draw orientation pointer for myself to orient easily
            if (isMe) {
                this.ctx.beginPath();
                this.ctx.moveTo(pos.x, pos.y);
                // p.rotY is heading in Radians. 
                // Babylon Y rotation starts facing +Z (minimap upward/negative Y). 
                const dirX = Math.sin(p.rotY) * 8;
                const dirY = -Math.cos(p.rotY) * 8;
                
                this.ctx.lineTo(pos.x + dirX, pos.y + dirY);
                this.ctx.strokeStyle = "#ffffff";
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
            }
        });
    }
}
