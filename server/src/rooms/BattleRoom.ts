// @ts-nocheck
import { Room, Client } from "@colyseus/core";
import { BattleState, Player, Zone } from "./schema/BattleState";

export class BattleRoom extends Room {
  maxClients = 80;

  onCreate (options: any) {
    this.setState(new BattleState());
    
    // Set patch rate and simulation interval
    this.setPatchRate(50); // 20 times per second
    this.setSimulationInterval((deltaTime) => this.update(deltaTime));

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

    this.onMessage("shoot", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isDead) return;

      // Broadcast shoot event to other clients for muzzle flash/sound
      this.broadcast("shoot", { id: client.sessionId }, { except: client });

      // In a real game, server should do raycasting. 
      // For MVP, we trust client hit if id is provided
      if (data.hitId) {
        const target = this.state.players.get(data.hitId);
        if (target && !target.isDead && target.team !== player.team) {
          target.hp -= 40; // High damage

          if (target.hp <= 0) {
            target.hp = 0;
            target.isDead = true;
            target.deaths += 1;
            player.kills += 1;

            this.broadcast("kill", { killer: player.team, victim: target.team });

            // Respawn after 3 seconds
            setTimeout(() => {
              target.isDead = false;
              target.hp = 100;
              // Reset to base pos
              const baseX = target.team === "A" ? -100 : 100;
              target.x = baseX;
              target.y = 1;
              target.z = 0;
            }, 3000);
          }
        }
      }
    });
  }

  onJoin (client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    const player = new Player();
    player.id = client.sessionId;
    
    // Auto-balance teams
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

  onLeave (client: Client, code?: number) {
    console.log(client.sessionId, "left!");
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
          if (zone.capturingTeam !== capturingTeam && zone.captureProgress > 0) {
            zone.captureProgress -= netCapture * (deltaTime / 100);
            if (zone.captureProgress <= 0) {
              zone.capturingTeam = capturingTeam;
              zone.captureProgress = 0;
            }
          } else {
            zone.capturingTeam = capturingTeam;
            zone.captureProgress += netCapture * (deltaTime / 100);
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
    let zonesA = 0;
    let zonesB = 0;
    this.state.zones.forEach((zone: any) => {
        if (zone.owner === "A") zonesA++;
        if (zone.owner === "B") zonesB++;
    });

    this.state.scoreA += zonesA * (deltaTime / 1000);
    this.state.scoreB += zonesB * (deltaTime / 1000);
  }
}
