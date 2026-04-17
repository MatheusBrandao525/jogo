import { BattleState, Player } from "./schema/BattleState";
import { BattleRoom } from "./BattleRoom";

export class ProgressionSystem {
    private room: BattleRoom;
    private state: BattleState;
    // Memory DB mapping userId -> progression
    private db = new Map<string, { level: number, xp: number }>();

    constructor(room: BattleRoom, state: BattleState) {
        this.room = room;
        this.state = state;
    }

    public getXpForNextLevel(level: number): number {
        // Curve: 1000, 1500, 2250, 3375...
        return Math.floor(1000 * Math.pow(1.5, level - 1));
    }

    public grantXp(player: Player, amount: number) {
        if (!player) return;
        
        const userId = (player as any).userId;
        if (!userId) return;

        let record = this.db.get(userId);
        if (!record) return;

        record.xp += amount;
        let leveledUp = false;
        let req = this.getXpForNextLevel(record.level);

        while (record.xp >= req) {
            record.xp -= req;
            record.level++;
            leveledUp = true;
            req = this.getXpForNextLevel(record.level);
        }

        // Sync to schema so client updates UI
        player.xp = record.xp;
        player.level = record.level;

        if (leveledUp) {
            const client = this.room.clients.find(c => c.sessionId === player.id);
            if (client) {
                client.send("level_up", { level: record.level });
            }
        }
    }

    public attachProgress(userId: string, player: Player) {
        if (!this.db.has(userId)) {
            this.db.set(userId, { level: 1, xp: 0 }); // New Player
        }
        const data = this.db.get(userId)!;
        
        player.level = data.level;
        player.xp = data.xp;
        (player as any).userId = userId;
    }
}
