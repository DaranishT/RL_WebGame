import { entity } from './entity.js';
import { GridGenerator } from './grid-generator.js';

export class LevelManager extends entity.Component {
    static CLASS_NAME = 'LevelManager';

    get NAME() {
        return LevelManager.CLASS_NAME;
    }

    constructor(params) {
        super();
        this.params = params;
        this.game = params.game;
        this.currentLevel = 0;
        this.levels = [
            {
                name: "Training Level",
                seed: 12345,
                gridSize: 60,
                cellSize: 3,
            },
            {
                name: "Level 2",
                seed: null,
                gridSize: 80,
                cellSize: 4,
            }
        ];
    }

    InitComponent() {
        // No-op
    }

    LoadLevel(levelIndex) {
        if (levelIndex >= this.levels.length) {
            console.log("All levels completed!");
            return;
        }

        this.currentLevel = levelIndex;
        const levelData = this.levels[levelIndex];
        console.log(`Loading ${levelData.name}...`);

        const existingGrid = this.Manager.Get('grid');
        if (existingGrid) {
            this.UnloadLevel();
        }

        const gridEntity = new entity.Entity();
        const gridComponent = new GridGenerator({
            scene: this.params.scene,
            gridSize: levelData.gridSize,
            cellSize: levelData.cellSize,
            seed: levelData.seed || Date.now()
        });
        gridEntity.AddComponent(gridComponent);
        this.Manager.Add(gridEntity, 'grid');
        
        // This is the key change. We now trigger the game reset after the entity has been added
        // and its PostInitialize has run.
        gridEntity.PostInitialize();
        this.game.StartNewEpisode();
    }

    UnloadLevel() {
        const gridEntity = this.Manager.Get('grid');
        if (gridEntity) {
            console.log("Unloading previous level...");
            const gridComponent = gridEntity.GetComponent('GridGenerator');
            gridComponent.DestroyGrid();
            this.Manager.Remove(gridEntity.Name);
        }
    }

    NextLevel() {
        this.LoadLevel(this.currentLevel + 1);
    }
}