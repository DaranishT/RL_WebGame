// main.js
import { entity_manager } from './components/entity-manager.js';
import { entity } from './components/entity.js';

import { ThreeJSController } from './components/threejs-component.js';
import { AmmoJSController } from './components/ammojs-component.js';
import { ThirdPersonCamera } from './components/third-person-camera.js';
import { SphereController } from './components/sphere-controller.js';
import { LevelBuilder } from './components/level-builder.js';
import { Crosshair } from './components/crosshair.js';
import { GridGenerator } from './components/grid-generator.js';
import { DungeonGenerator } from './components/dungeon-generator.js';
import { TrainingUI } from './components/training-ui.js';
import { GoalPoint } from './components/goal-point.js';

class SphereGame {
  constructor() {
    console.log("SphereGame constructor");
    this.goalCooldown = false;
    
    // Toggle between grid and dungeon
    this.useDungeonGenerator = true;
    this.currentGenerator = null;
    
    this._Initialize();
  }

  async _Initialize() {
    console.log("Initializing SphereGame");

    // Load Ammo.js
    await new Promise(resolve => {
      const script = document.createElement('script');
      script.src = '/src/ammo.js';
      script.onload = () => {
        Ammo().then(loadedAmmo => {
          window.Ammo = loadedAmmo;
          resolve(loadedAmmo);
        }).catch(err => {
          console.error('Ammo initialization failed', err);
          resolve(null);
        });
      };
      script.onerror = (e) => {
        console.error('Failed to load /src/ammo.js', e);
        resolve(null);
      };
      document.head.appendChild(script);
    });
    console.log("Ammo.js loaded");

    // Load Three.js
    await new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.onload = () => resolve(window.THREE);
      document.head.appendChild(script);
    });
    console.log("Three.js loaded");

    this.entityManager = new entity_manager.EntityManager();

    // Three.js scene
    const threejs = new entity.Entity();
    threejs.AddComponent(new ThreeJSController());
    this.entityManager.Add(threejs, 'threejs');

    this.scene = threejs.GetComponent('ThreeJSController').scene;
    this.camera = threejs.GetComponent('ThreeJSController').camera;

    // Physics
    const ammojs = new entity.Entity();
    ammojs.AddComponent(new AmmoJSController());
    this.entityManager.Add(ammojs, 'physics');

    // Lighting & Sky
    const level = new entity.Entity();
    level.AddComponent(new LevelBuilder({
      scene: this.scene
    }));
    this.entityManager.Add(level, 'level');

    // Grid Environment for RL Training
    const grid = new entity.Entity();
    
    let gridComponent;
    if (this.useDungeonGenerator) {
      gridComponent = new DungeonGenerator({
        scene: this.scene,
        gridSize: 180,
        cellSize: 6,
        tunnelHeight: 10,
        // Dungeon parameters
        numRoomTries: 80,
        minRoomSize: 3,
        maxRoomSize: 7,
        maxRooms: 12,
        windingPercent: 40
      });
      this.currentGenerator = 'DungeonGenerator';
    } else {
      gridComponent = new GridGenerator({
        scene: this.scene,
        gridSize: 180,
        cellSize: 6,
        tunnelHeight: 10,
        tunnelWidth: 2
      });
      this.currentGenerator = 'GridGenerator';
    }
    
    grid.AddComponent(gridComponent);
    this.entityManager.Add(grid, 'grid');

    console.log(`Using ${this.currentGenerator} for environment`);

    // Player
    const player = new entity.Entity();
    const sphereController = new SphereController({
      scene: this.scene,
      camera: this.camera
    });
    player.AddComponent(sphereController);
    this.entityManager.Add(player, 'player');

    // Camera
    const cameraEntity = new entity.Entity();
    const thirdPersonCamera = new ThirdPersonCamera({
      camera: this.camera,
      target: player
    });
    cameraEntity.AddComponent(thirdPersonCamera);
    this.entityManager.Add(cameraEntity, 'camera');

    // Crosshair
    this.crosshair = new Crosshair({
      size: 14,
      color: 'white',
      fireColor: 'red',
      errorMargin: 25
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        const spread = this.crosshair.getSpreadVector();
        console.log("Fired with spread:", spread);
      }
    });

    // Training UI
    this.trainingUI = new TrainingUI();

    // RL Training Tracking
    this.trainingEpisode = {
      startTime: null,
      visitedCells: 0,
      totalCells: 0,
      completionTime: 0,
      episodeCount: 0
    };

    // Initialize
    this._PostInitialize();

    // Set safe spawn position after initialization
    setTimeout(() => {
      this.SetSafeSpawnPosition();
      
      this.previousRAF = null;
      this.RAF = this.RAF.bind(this);
      this.RAF();
      console.log("Game started successfully");
      
      // Start the first episode
      this.StartNewEpisode();
    }, 100);
  }

  SetSafeSpawnPosition() {
    const gridEntity = this.entityManager.Get('grid');
    const playerEntity = this.entityManager.Get('player');
    
    if (gridEntity && playerEntity) {
      const gridComponent = gridEntity.GetComponent(this.currentGenerator);
      
      if (!gridComponent) {
        console.error(`Grid component ${this.currentGenerator} not found`);
        this.UseFallbackSpawn(playerEntity);
        return;
      }
      
      if (typeof gridComponent.GetRandomRoadPosition !== 'function') {
        console.error('GetRandomRoadPosition method missing on grid component');
        this.UseFallbackSpawn(playerEntity);
        return;
      }
      
      // Wait a bit more if component seems uninitialized
      if (!gridComponent.validRoadPositions || gridComponent.validRoadPositions.length === 0) {
        console.warn('Grid component not fully initialized, retrying...');
        setTimeout(() => this.SetSafeSpawnPosition(), 100);
        return;
      }
      
      const safePosition = gridComponent.GetRandomRoadPosition();
      
      this.ResetPlayerPhysics(playerEntity);
      playerEntity.SetPosition(safePosition);
      
      // Place goal point
      if (typeof gridComponent.PlaceGoalPoint === 'function') {
        gridComponent.PlaceGoalPoint();
      }
      
      console.log(`Player spawned using ${this.currentGenerator}:`, safePosition);
    } else {
      console.error("Grid or player entity not found");
    }
  }

  UseFallbackSpawn(playerEntity) {
    const safePosition = new THREE.Vector3(0, 1, 0);
    this.ResetPlayerPhysics(playerEntity);
    playerEntity.SetPosition(safePosition);
    console.log("Using fallback spawn position:", safePosition);
  }

  ResetPlayerPhysics(playerEntity) {
    const playerController = playerEntity.GetComponent('SphereController');
    if (playerController && playerController.rigidBody) {
      playerController.rigidBody.body_.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
      playerController.rigidBody.body_.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
    }
  }

  _PostInitialize() {
    const entities = this.entityManager.Filter(e => true);
    for (const e of entities) {
      e.PostInitialize();
    }
  }

  StartNewEpisode() {
    this.goalCooldown = false;
    
    this.trainingEpisode.episodeCount++;
    this.trainingEpisode.startTime = performance.now();
    this.trainingEpisode.visitedCells = 0;
    
    // Regenerate entire grid
    const gridEntity = this.entityManager.Get('grid');
    if (gridEntity) {
      const gridComponent = gridEntity.GetComponent(this.currentGenerator);
      
      if (gridComponent && typeof gridComponent.RegenerateGrid === 'function') {
        gridComponent.RegenerateGrid();
        
        if (gridComponent.validRoadPositions) {
          this.trainingEpisode.totalCells = gridComponent.validRoadPositions.length;
        }
      }
    }
    
    // Set safe spawn position
    setTimeout(() => {
      this.SetSafeSpawnPosition();
    }, 50);
    
    console.log(`Starting episode ${this.trainingEpisode.episodeCount}`);
  }

  RAF() {
    requestAnimationFrame((t) => {
      if (this.previousRAF === null) {
        this.previousRAF = t;
      }
      this.Step(t - this.previousRAF);
      this.previousRAF = t;
      this.RAF();
    });
  }

  Step(timeElapsed) {
    const timeElapsedS = Math.min(1.0 / 30.0, timeElapsed * 0.001);
    this.entityManager.Update(timeElapsedS);
    
    if (this.crosshair) this.crosshair.update(timeElapsedS);
    
    this.CalculateGoalDistance();

    if (!this.goalCooldown) {
      this.CheckGoalCollision();
    }
    
    const gridEntity = this.entityManager.Get('grid');
    const playerEntity = this.entityManager.Get('player');
    
    if (gridEntity && playerEntity) {
      const gridComponent = gridEntity.GetComponent(this.currentGenerator);
      
      if (gridComponent && typeof gridComponent.MarkCellVisited === 'function') {
        const visited = gridComponent.MarkCellVisited(playerEntity.Position);
        if (visited) {
          this.trainingEpisode.visitedCells++;
        }
        
        const completion = gridComponent.GetVisitedPercentage();
        
        if (this.trainingUI) {
          this.trainingUI.updateProgress(completion, this.trainingEpisode.episodeCount);
        }
        
        if (completion >= 0.95) {
          this.trainingEpisode.completionTime = (performance.now() - this.trainingEpisode.startTime) / 1000;
          console.log(`Episode ${this.trainingEpisode.episodeCount} completed in ${this.trainingEpisode.completionTime.toFixed(1)} seconds!`);
          
          this.LogEpisodeData();
          
          setTimeout(() => {
            this.StartNewEpisode();
          }, 2000);
        }
      }
    }
  }

  CalculateGoalDistance() {
    const playerEntity = this.entityManager.Get('player');
    const goalEntity = this.entityManager.Get('goal');
    
    if (playerEntity && goalEntity && this.trainingUI) {
      const goalPosition = goalEntity.Position;
      const playerPosition = playerEntity.Position;
      
      const distance = Math.sqrt(
        Math.pow(goalPosition.x - playerPosition.x, 2) +
        Math.pow(goalPosition.z - playerPosition.z, 2)
      );
      
      this.trainingUI.updateDistance(distance.toFixed(1));
    } else if (this.trainingUI) {
      this.trainingUI.updateDistance('--');
    }
  }

  CheckGoalCollision() {
    const playerEntity = this.entityManager.Get('player');
    const goalEntity = this.entityManager.Get('goal');
    
    if (playerEntity && goalEntity) {
      const goalComponent = goalEntity.GetComponent('GoalPoint');
      
      if (goalComponent && goalComponent.CheckCollision(playerEntity.Position)) {
        console.log("Goal reached! Generating new maze...");
        
        this.goalCooldown = true;
        
        if (this.trainingUI) {
          this.trainingUI.showMessage("Goal Reached! Generating new maze...", 2000);
        }
        
        setTimeout(() => {
          this.StartNewEpisode();
        }, 2000);
      }
    }
  }

  LogEpisodeData() {
    const episodeData = {
      episode: this.trainingEpisode.episodeCount,
      completionTime: this.trainingEpisode.completionTime,
      visitedCells: this.trainingEpisode.visitedCells,
      totalCells: this.trainingEpisode.totalCells,
      explorationRate: this.trainingEpisode.totalCells > 0 ? 
        (this.trainingEpisode.visitedCells / this.trainingEpisode.totalCells).toFixed(4) : 0
    };
    
    console.log("Episode Data:", episodeData);
  }

  ToggleGenerator() {
    this.useDungeonGenerator = !this.useDungeonGenerator;
    console.log(`Switching to ${this.useDungeonGenerator ? 'DungeonGenerator' : 'GridGenerator'}`);
    
    this.StartNewEpisode();
  }
}

// Add UI controls for toggling
document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Switch to Grid';
  toggleButton.style.position = 'fixed';
  toggleButton.style.top = '10px';
  toggleButton.style.left = '10px';
  toggleButton.style.zIndex = '10000';
  toggleButton.style.padding = '10px';
  toggleButton.style.backgroundColor = '#333';
  toggleButton.style.color = 'white';
  toggleButton.style.border = 'none';
  toggleButton.style.borderRadius = '5px';
  toggleButton.style.cursor = 'pointer';
  
  toggleButton.addEventListener('click', () => {
    if (window._APP) {
      window._APP.ToggleGenerator();
      toggleButton.textContent = window._APP.useDungeonGenerator ? 
        'Switch to Grid' : 'Switch to Dungeon';
    }
  });
  document.body.appendChild(toggleButton);
});

let _APP = null;
window.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM Content Loaded");
  _APP = new SphereGame();
});