import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("number") rotX: number = 0;
  @type("number") rotY: number = 0;
  @type("number") hp: number = 100;
  @type("string") team: string = "A"; // "A" or "B"
  @type("boolean") isDead: boolean = false;
  @type("number") kills: number = 0;
  @type("number") deaths: number = 0;
  @type("string") classType: string = "Infantry";
  @type("number") maxHp: number = 100;
  @type("number") level: number = 1;
  @type("number") xp: number = 0;
}

export class Zone extends Schema {
  @type("string") id: string = "";
  @type("string") owner: string = "neutral"; // "A", "B", or "neutral"
  @type("number") captureProgress: number = 0; // 0 to 100
  @type("string") capturingTeam: string = "neutral";
  @type("number") x: number = 0;
  @type("number") z: number = 0;
  @type("number") radius: number = 10;
  @type("boolean") isHighValue: boolean = false;
}

export class BattleState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Zone }) zones = new MapSchema<Zone>();

  @type("number") scoreA: number = 0;
  @type("number") scoreB: number = 0;

  @type("number") timer: number = 300; 
  @type("number") currentRound: number = 1;
  @type("number") maxRounds: number = 5;
  @type("number") roundWinsA: number = 0;
  @type("number") roundWinsB: number = 0;
  @type("string") matchState: string = "playing"; 
  @type("string") statusMessage: string = "Round 1 Start!";

  @type("string") activeEvent: string = "none";
  @type("number") eventTimeLeft: number = 0;
}
