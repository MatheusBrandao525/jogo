import { BattleState } from "./schema/BattleState";
import { BattleRoom } from "./BattleRoom";

export class MatchSystem {
    private state: BattleState;
    private room: BattleRoom;
    private internalTimer: number = 0;
    
    constructor(room: BattleRoom, state: BattleState) {
        this.room = room;
        this.state = state;
    }

    update(deltaTime: number) {
        if (this.state.matchState === "match_end") return;
        
        if (this.state.matchState === "round_end") {
            this.internalTimer -= deltaTime / 1000;
            if (this.internalTimer <= 0) {
                this.startNewRound();
            }
            return;
        }

        // Playing State
        this.state.timer -= deltaTime / 1000;
        if (this.state.timer <= 0) {
            this.endRound();
        }
    }

    private endRound() {
        this.state.timer = 0;
        this.state.matchState = "round_end";
        
        // Determine round winner
        let roundWinner = "Draw";
        if (this.state.scoreA > this.state.scoreB) {
            this.state.roundWinsA++;
            roundWinner = "Team A";
        } else if (this.state.scoreB > this.state.scoreA) {
            this.state.roundWinsB++;
            roundWinner = "Team B";
        }

        // Check Match End
        if (this.state.currentRound >= this.state.maxRounds) {
            this.state.matchState = "match_end";
            let matchWinner = "Draw";
            if (this.state.roundWinsA > this.state.roundWinsB) matchWinner = "Team A";
            else if (this.state.roundWinsB > this.state.roundWinsA) matchWinner = "Team B";
            
            this.state.statusMessage = `MATCH OVER! ${matchWinner} WINS!`;
            return;
        }

        this.state.statusMessage = `Round End! ${roundWinner} Wins Round ${this.state.currentRound}`;
        this.internalTimer = 5; // 5 seconds inter-round delay
    }

    private startNewRound() {
        this.state.currentRound++;
        this.state.timer = 300; // Reset to 5 mins
        this.state.scoreA = 0;
        this.state.scoreB = 0; // Reset temporary stats (score per round)
        this.state.statusMessage = `Round ${this.state.currentRound} Start!`;
        this.state.matchState = "playing";

        // Reset zones
        this.state.zones.forEach((zone: any) => {
            zone.owner = "neutral";
            zone.captureProgress = 0;
            zone.capturingTeam = "neutral";
        });

        // Reset players
        this.state.players.forEach((player: any) => {
            player.hp = player.maxHp || 100;
            player.isDead = false;
            
            // Spawn bases
            if (player.team === "A") {
                player.x = -100;
            } else {
                player.x = 100;
            }
            player.y = 1;
            player.z = 0;
        });
        
        // Force clear active events
        this.room.eventSystem.forceClear();

        // Broadcast to clients so they can reset UI / reposition
        this.room.broadcast("round_start");
    }
}
