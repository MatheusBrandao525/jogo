import { BattleState } from "./schema/BattleState";
import { BattleRoom } from "./BattleRoom";

export class EventSystem {
    private room: BattleRoom;
    private state: BattleState;
    private timeSinceLastEvent: number = 0;

    constructor(room: BattleRoom, state: BattleState) {
        this.room = room;
        this.state = state;
    }

    public update(deltaTime: number) {
        if (this.state.matchState !== "playing") return;

        if (this.state.activeEvent !== "none") {
            this.state.eventTimeLeft -= deltaTime / 1000;
            if (this.state.eventTimeLeft <= 0) {
                this.endEvent();
            }
        } else {
            this.timeSinceLastEvent += deltaTime / 1000;
            // 5% chance every 10 seconds to trigger an event, but at least 30 seconds between events
            if (this.timeSinceLastEvent > 30) {
                if (Math.random() < 0.05 * (deltaTime / 100)) { // rough probability per tick check
                    this.triggerRandomEvent();
                }
            }
        }
    }

    private triggerRandomEvent() {
        this.timeSinceLastEvent = 0;

        // Determine if there's a heavy losing team
        const scoreDiff = this.state.scoreA - this.state.scoreB;
        if (scoreDiff > 300) {
            this.startEvent("Reinforcements B", 30);
            return;
        } else if (scoreDiff < -300) {
            this.startEvent("Reinforcements A", 30);
            return;
        }

        const events = ["Double Capture", "High Value Zone"];
        const chosen = events[Math.floor(Math.random() * events.length)];
        
        switch (chosen) {
            case "Double Capture":
                this.startEvent("Double Capture", 25);
                break;
            case "High Value Zone":
                let nonNeutralZones: any[] = [];
                let allZones: any[] = [];
                this.state.zones.forEach(zone => {
                    allZones.push(zone);
                    if (zone.owner !== "neutral") nonNeutralZones.push(zone);
                });
                
                // Pick a zone randomly
                const targetZoneArray = nonNeutralZones.length > 0 ? nonNeutralZones : allZones;
                if (targetZoneArray.length > 0) {
                    const zone = targetZoneArray[Math.floor(Math.random() * targetZoneArray.length)];
                    zone.isHighValue = true;
                }
                this.startEvent("High Value Zone", 40);
                break;
        }
    }

    private startEvent(eventName: string, durationStr: number) {
        this.state.activeEvent = eventName;
        this.state.eventTimeLeft = durationStr;

        // Broadcast alert
        this.room.broadcast("system_message", `EVENT: ${eventName.toUpperCase()} TRIGGERED!`);
    }

    private endEvent() {
        this.state.activeEvent = "none";
        this.state.eventTimeLeft = 0;

        // Clean up specific event states
        this.state.zones.forEach(zone => {
            zone.isHighValue = false;
        });

        this.room.broadcast("system_message", "Event Ended.");
    }

    // Explicitly end all events during round resets
    public forceClear() {
        if (this.state.activeEvent !== "none") {
            this.endEvent();
        }
    }
}
