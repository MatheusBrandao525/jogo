import { Room, Client } from "colyseus";
import { BattleState, Player, Zone } from "./schema/BattleState";
import { MatchSystem } from "./MatchSystem";
import { ProgressionSystem } from "./ProgressionSystem";
import { EventSystem } from "./EventSystem";
import { CLASS_CONFIG } from "./ClassConfig";

export class BattleRoom extends Room<BattleState> {
  maxClients = 80;
  matchSystem!: MatchSystem;
  progressionSystem!: ProgressionSystem;
  eventSystem!: EventSystem;
  shootTimers = new Map<string, number>();


  onCreate (options: any) {
    this.setState(new BattleState());
    
    // Set patch rate and simulation interval
    this.setPatchRate(50); // 20 times per second
    this.setSimulationInterval((deltaTime) => this.update(deltaTime));

    this.matchSystem = new MatchSystem(this, this.state);
    this.progressionSystem = new ProgressionSystem(this, this.state);
    this.eventSystem = new EventSystem(this, this.state);

    // Initialize map zones (simple linear frontline map)
    const zone1 = new Zone();
    zone1.id = "zone-1";
    zone1.x = -50;
    zone1.z = 0;
    zone1.radius = 15;
    this.state.zones.set("zone-1", zone1);

    const zone2 = new Zone();
    zone2.id = "zone-2";
    zone2.x = 0;
    zone2.z = 0;
    zone2.radius = 15;
    this.state.zones.set("zone-2", zone2);

    const zone3 = new Zone();
    zone3.id = "zone-3";
    zone3.x = 50;
    zone3.z = 0;
    zone3.radius = 15;
    this.state.zones.set("zone-3", zone3);

    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isDead) {
        player.x = data.x;
        player.y = data.y;
        player.z = data.z;
        player.rotX = data.rotX;
        player.rotY = data.rotY;
      }
    });

    this.onMessage("change_class", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && CLASS_CONFIG[data.classType]) {
        if (player.level < CLASS_CONFIG[data.classType].unlockLevel) {
          client.send("error", { message: `Level ${CLASS_CONFIG[data.classType].unlockLevel} needed for ${data.classType}!` });
          return;
        }

        player.classType = data.classType;
        player.maxHp = CLASS_CONFIG[data.classType].maxHp;
        // Kill player so they respawn instantly as new class
        if (!player.isDead) {
          player.isDead = true;
          player.hp = 0;
          this.broadcast("kill", { killer: "Environment", victim: player.team });
          this.triggerRespawn(player);
        }
      }
    });

    this.onMessage("shoot", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isDead) return;

      const playerConfig = CLASS_CONFIG[player.classType] || CLASS_CONFIG["Infantry"];
      const now = Date.now();
      const lastShoot = this.shootTimers.get(client.sessionId) || 0;
      
      // Server-side fire rate validation (with 20ms leniency for ping/lag)
      if (now - lastShoot < playerConfig.fireRateMs - 20) return;
      this.shootTimers.set(client.sessionId, now);

      // Broadcast shoot event to other clients for muzzle flash/sound
      this.broadcast("shoot", { id: client.sessionId }, { except: client });

      // In a real game, server should do raycasting. 
      // For MVP, we trust client hit if id is provided
      if (data.hitId) {
        const target = this.state.players.get(data.hitId);
        if (target && !target.isDead && target.team !== player.team) {
          target.hp -= playerConfig.damage;

          if (target.hp <= 0) {
             target.hp = 0;
             target.isDead = true;
             target.deaths += 1;
             player.kills += 1;

             this.progressionSystem.grantXp(player, 100);

             this.broadcast("kill", { killer: player.team, victim: target.team });
             this.triggerRespawn(target);
          }
        }
      }
    });
  }

  triggerRespawn(player: any) {
    let respawnTime = 3000;
    if (this.state.activeEvent === "Reinforcements " + player.team) {
        respawnTime = 1000; // Fast respawn!
    }

    setTimeout(() => {
      if (this.state.matchState !== "playing") return; // Let MatchSystem handle respawn if round ended
      player.isDead = false;
      player.hp = player.maxHp;
      // Reset to base pos
      const baseX = player.team === "A" ? -100 : 100;
      player.x = baseX;
      player.y = 1;
      player.z = 0;
    }, respawnTime);
  }

  onJoin (client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    const player = new Player();
    player.id = client.sessionId;
    
    // Assign proper persistent memory DB reference
    const userId = options.userId || client.sessionId;
    this.progressionSystem.attachProgress(userId, player);

    // Assign team
    const numPlayers = this.state.players.size;
    let countA = 0;
    let countB = 0;
    this.state.players.forEach((p: any) => {
      if (p.team === "A") countA++;
      else countB++;
    });
    
    player.team = countA <= countB ? "A" : "B";
    
    // Spawn bases
    if (player.team === "A") {
      player.x = -100;
      player.z = 0;
    } else {
      player.x = 100;
      player.z = 0;
    }
    player.y = 1;
    
    this.state.players.set(client.sessionId, player);
  }

  onLeave (client: Client, consented?: boolean) {
    console.log(client.sessionId, "left!");
    this.shootTimers.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
  }

  update (deltaTime: number) {
    // Territory capture logic
    this.state.zones.forEach((zone: any) => {
      let playersA = 0;
      let playersB = 0;

      this.state.players.forEach((p: any) => {
        if (p.isDead) return;
        const dist = Math.sqrt((p.x - zone.x) ** 2 + (p.z - zone.z) ** 2);
        if (dist <= zone.radius) {
          if (p.team === "A") playersA++;
          else if (p.team === "B") playersB++;
          // Give capture XP actively staying inside the zone
          if (this.state.matchState === "playing") {
             this.progressionSystem.grantXp(p, 10 * (deltaTime / 1000));
          }
        }
      });

      let netCapture = 0;
      let capturingTeam = "neutral";
      if (playersA > playersB) {
        netCapture = playersA - playersB;
        capturingTeam = "A";
      } else if (playersB > playersA) {
        netCapture = playersB - playersA;
        capturingTeam = "B";
      }

      if (capturingTeam !== "neutral") {
        if (zone.owner !== capturingTeam) {
          
          let captureModifier = 1;
          if (this.state.activeEvent === "Double Capture") captureModifier = 2;

          if (zone.capturingTeam !== capturingTeam && zone.captureProgress > 0) {
            zone.captureProgress -= netCapture * (deltaTime / 100) * captureModifier;
            if (zone.captureProgress <= 0) {
              zone.capturingTeam = capturingTeam;
              zone.captureProgress = 0;
            }
          } else {
            zone.capturingTeam = capturingTeam;
            zone.captureProgress += netCapture * (deltaTime / 100) * captureModifier;
            if (zone.captureProgress >= 100) {
              zone.captureProgress = 100;
              zone.owner = capturingTeam;
              zone.capturingTeam = "neutral";
            }
          }
        }
      } else {
        // Slowly revert if nobody is capturing
        if (zone.captureProgress > 0 && zone.owner !== zone.capturingTeam) {
            zone.captureProgress -= (deltaTime / 200);
            if (zone.captureProgress < 0) zone.captureProgress = 0;
        }
      }
    });

    // Score logic based on owned zones
    let scoreGainA = 0;
    let scoreGainB = 0;
    this.state.zones.forEach((zone: any) => {
        let mult = zone.isHighValue ? 2 : 1;
        if (zone.owner === "A") scoreGainA += mult;
        if (zone.owner === "B") scoreGainB += mult;
    });

    this.state.scoreA += scoreGainA * (deltaTime / 1000);
    this.state.scoreB += scoreGainB * (deltaTime / 1000);

    // Global Time match XP
    if (this.state.matchState === "playing") {
        this.state.players.forEach(p => {
             this.progressionSystem.grantXp(p, 5 * (deltaTime / 1000));
        });
    }

    this.matchSystem.update(deltaTime);
    this.eventSystem.update(deltaTime);
  }
}
