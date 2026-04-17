import * as BABYLON from 'babylonjs';
import { AssetManager } from './AssetManager';

export class CharacterRenderer {
    public static createLowPolyCharacter(scene: BABYLON.Scene, id: string, team: string, classType: string, assetManager?: AssetManager) {
        
        if (assetManager) {
            const assetKey = team === "A" ? "char_soldier" : "char_enemy";
            const instance = assetManager.spawnInstance(assetKey, 0, 0, 0, 0);
            if (instance) {
                // If it's a real model, we might still want to add some class-specific scale
                if (classType === "Heavy") instance.scaling.scaleInPlace(1.2);
                if (classType === "Sniper") instance.scaling.scaleInPlace(0.9);
                return instance;
            }
        }

        const container = new BABYLON.Mesh("player_container_" + id, scene);
        
        const teamColor = team === "A" ? new BABYLON.Color3(0.2, 0.5, 1) : new BABYLON.Color3(1, 0.2, 0.2);
        const outfitColor = team === "A" ? new BABYLON.Color3(0.1, 0.2, 0.4) : new BABYLON.Color3(0.4, 0.1, 0.1);

        // Torso
        const torso = BABYLON.MeshBuilder.CreateBox("torso", {width: 0.6, height: 0.8, depth: 0.3}, scene);
        torso.position.y = 1.2;
        const torsoMat = new BABYLON.StandardMaterial("torsoMat", scene);
        torsoMat.diffuseColor = outfitColor;
        torso.material = torsoMat;
        torso.parent = container;

        // Head
        const head = BABYLON.MeshBuilder.CreateBox("head", {size: 0.35}, scene);
        head.position.y = 1.8;
        const headMat = new BABYLON.StandardMaterial("headMat", scene);
        headMat.diffuseColor = new BABYLON.Color3(0.9, 0.7, 0.6); // Skin tone
        head.material = headMat;
        head.parent = container;

        // Helmet/Hat based on team
        const helmet = BABYLON.MeshBuilder.CreateBox("helmet", {width: 0.4, height: 0.1, depth: 0.4}, scene);
        helmet.position.y = 2.0;
        const helmetMat = new BABYLON.StandardMaterial("helmetMat", scene);
        helmetMat.diffuseColor = teamColor;
        helmet.material = helmetMat;
        helmet.parent = container;

        // Legs
        const legLeft = BABYLON.MeshBuilder.CreateBox("legL", {width: 0.2, height: 0.8, depth: 0.2}, scene);
        legLeft.position.set(-0.15, 0.4, 0);
        legLeft.material = torsoMat;
        legLeft.parent = container;

        const legRight = BABYLON.MeshBuilder.CreateBox("legR", {width: 0.2, height: 0.8, depth: 0.2}, scene);
        legRight.position.set(0.15, 0.4, 0);
        legRight.material = torsoMat;
        legRight.parent = container;

        // Arms
        const armLeft = BABYLON.MeshBuilder.CreateBox("armL", {width: 0.15, height: 0.7, depth: 0.15}, scene);
        armLeft.position.set(-0.4, 1.2, 0);
        armLeft.material = torsoMat;
        armLeft.parent = container;

        const armRight = BABYLON.MeshBuilder.CreateBox("armR", {width: 0.15, height: 0.7, depth: 0.15}, scene);
        armRight.position.set(0.4, 1.2, 0);
        armRight.material = torsoMat;
        armRight.parent = container;

        // Armor/Gear based on Class
        if (classType === "Heavy") {
            const vest = BABYLON.MeshBuilder.CreateBox("vest", {width: 0.7, height: 0.66, depth: 0.45}, scene);
            vest.position.y = 1.2;
            const vestMat = new BABYLON.StandardMaterial("vestMat", scene);
            vestMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
            vest.material = vestMat;
            vest.parent = container;
        } else if (classType === "Sniper") {
            const goggles = BABYLON.MeshBuilder.CreateBox("goggles", {width: 0.35, height: 0.1, depth: 0.1}, scene);
            goggles.position.set(0, 1.85, 0.15);
            const gMat = new BABYLON.StandardMaterial("gMat", scene);
            gMat.diffuseColor = teamColor;
            goggles.material = gMat;
            goggles.parent = container;
        }

        // Backpack for all
        const pack = BABYLON.MeshBuilder.CreateBox("pack", {width: 0.45, height: 0.6, depth: 0.25}, scene);
        pack.position.set(0, 1.2, -0.28);
        const packMat = new BABYLON.StandardMaterial("packMat", scene);
        packMat.diffuseColor = new BABYLON.Color3(0.2, 0.15, 0.1);
        pack.material = packMat;
        pack.parent = container;

        return container;
    }
}
