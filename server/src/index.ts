import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";

import { BattleRoom } from "./rooms/BattleRoom";

const port = Number(process.env.PORT || 2568);
const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  server: server
});

gameServer.define("battle", BattleRoom);

app.get("/", (req, res) => {
  res.send("Colyseus Game Server is running!");
});

gameServer.listen(port).then(() => {
  console.log(`Server is running!`);
  console.log(`Listening on localhost:${port}`);
});
