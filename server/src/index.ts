// @ts-nocheck
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";

import { BattleRoom } from "./rooms/BattleRoom";

const port = Number(process.env.PORT || 2568);
const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: server
  })
});

console.log("BattleRoom imported as:", typeof BattleRoom, BattleRoom);
gameServer.define("battle", BattleRoom as any);

app.get("/", (req, res) => {
  res.send("Colyseus Game Server is running!");
});

gameServer.listen(port).then(() => {
  console.log(`Server is running!`);
  console.log(`Listening on ws://localhost:${port}`);
});
