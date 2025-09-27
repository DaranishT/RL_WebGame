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
import { TrainingUI } from './components/training-ui.js';
import { GoalPoint } from './components/goal-point.js';

class SphereGame {
  constructor() {
    console.log("SphereGame constructor");
    this.goalCooldown = false;
    this._Initialize();
  }

  async _Initialize() {
    console.log("Initializing SphereGame");

    // --- Load Ammo.js ---
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

    // --- Load Three.js ---
    await new Promise(resolve => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.onload = () => resolve(window.THREE);
      document.head.appendChild(script);
    });
    console.log("Three.js loaded");

    this.entityManager = new entity_manager.EntityManager();

    // --- Three.js scene ---
    const threejs = new entity.Entity();
    threejs.AddComponent(new ThreeJSController());
    this.entityManager.Add(threejs, 'threejs');
    threejs.isInit = true;

    this.scene = threejs.GetComponent('ThreeJSController').scene;
    this.camera = threejs.GetComponent('ThreeJSController').camera;

    // --- Physics ---
    const ammojs = new entity.Entity();
    ammojs.AddComponent(new AmmoJSController());
    this.entityManager.Add(ammojs, 'physics');
    ammojs.isInit = true;

    // --- Lighting & Sky ---
    const level = new entity.Entity();
    level.AddComponent(new LevelBuilder({
      scene: this.scene
    }));
    this.entityManager.Add(level, 'level');

    // --- Grid Environment for RL Training ---
    const grid = new entity.Entity();
    const gridComponent = new GridGenerator({
      scene: this.scene,
      gridSize: 180,
      cellSize: 6,
      tunnelHeight: 10,
      tunnelWidth: 2
    });
    grid.AddComponent(gridComponent);
    this.entityManager.Add(grid, 'grid');

    // --- Player with safe spawn position ---
    const player = new entity.Entity();
    const sphereController = new SphereController({
      scene: this.scene,
      camera: this.camera
    });
    player.AddComponent(sphereController);
    this.entityManager.Add(player, 'player');

    // --- Camera ---
    const cameraEntity = new entity.Entity();
    const thirdPersonCamera = new ThirdPersonCamera({
      camera: this.camera,
      target: player
    });
    cameraEntity.AddComponent(thirdPersonCamera);
    this.entityManager.Add(cameraEntity, 'camera');

    // --- Crosshair ---
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

    // --- Training UI ---
    this.trainingUI = new TrainingUI();

    // --- RL Training Tracking ---
    this.trainingEpisode = {
      startTime: null,
      visitedCells: 0,
      totalCells: 0,
      completionTime: 0,
      episodeCount: 0
    };

    // --- Initialize ---
    this._PostInitialize();

    // Set safe spawn position after initialization
    setTimeout(() => {
      this.SetSafeSpawnPosition();
      
      this.previousRAF = null;
      // Use bind to maintain the correct 'this' context
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
      const gridComponent = gridEntity.GetComponent('GridGenerator');
      const safePosition = gridComponent.GetRandomRoadPosition();
      
      // Reset player physics
      const playerController = playerEntity.GetComponent('SphereController');
      if (playerController && playerController.rigidBody) {
        // Stop all movement
        playerController.rigidBody.body_.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
        playerController.rigidBody.body_.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
      }
      
      playerEntity.SetPosition(safePosition);
      
      // Place goal point
      gridComponent.PlaceGoalPoint();
      
      console.log("Player spawned at safe position:", safePosition);
    }
  }

  _PostInitialize() {
    const entities = this.entityManager.Filter(e => true);
    for (const e of entities) {
      e.PostInitialize();
    }
  }

  StartNewEpisode() {
    // Reset cooldown
    this.goalCooldown = false;
    
    this.trainingEpisode.episodeCount++;
    this.trainingEpisode.startTime = performance.now();
    this.trainingEpisode.visitedCells = 0;
    
    // Regenerate entire grid
    const gridEntity = this.entityManager.Get('grid');
    if (gridEntity) {
      const gridComponent = gridEntity.GetComponent('GridGenerator');
      if (gridComponent) {
        gridComponent.RegenerateGrid();
        this.trainingEpisode.totalCells = gridComponent.validRoadPositions.length;
      }
    }
    
    // Set safe spawn position
    this.SetSafeSpawnPosition();
    
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
    
        // Calculate distance to goal
    this.CalculateGoalDistance();

    // Check for goal collision (only if not in cooldown)
    if (!this.goalCooldown) {
      this.CheckGoalCollision();
    }
    
    // Track player movement and update training progress
    const gridEntity = this.entityManager.Get('grid');
    const playerEntity = this.entityManager.Get('player');
    
    if (gridEntity && playerEntity) {
      const gridComponent = gridEntity.GetComponent('GridGenerator');
      
      if (gridComponent) {
        const visited = gridComponent.MarkCellVisited(playerEntity.Position);
        if (visited) {
          this.trainingEpisode.visitedCells++;
        }
        
        // Calculate completion percentage
        const completion = gridComponent.GetVisitedPercentage();
        
        // Update UI
        if (this.trainingUI) {
          this.trainingUI.updateProgress(completion, this.trainingEpisode.episodeCount);
        }
        
        // Check if episode is complete (95% exploration)
        if (completion >= 0.95) {
          this.trainingEpisode.completionTime = (performance.now() - this.trainingEpisode.startTime) / 1000;
          console.log(`Episode ${this.trainingEpisode.episodeCount} completed in ${this.trainingEpisode.completionTime.toFixed(1)} seconds!`);
          
          // Log episode data for RL training
          this.LogEpisodeData();
          
          // Start a new episode after a short delay
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
      
      // Calculate horizontal distance (ignore Y axis)
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
        
        // Set cooldown to prevent multiple triggers
        this.goalCooldown = true;
        
        // Show celebration message
        if (this.trainingUI) {
          this.trainingUI.showMessage("Goal Reached! Generating new maze...", 2000);
        }
        
        // Start new episode after a delay
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
      explorationRate: (this.trainingEpisode.visitedCells / this.trainingEpisode.totalCells).toFixed(4)
    };
    
    console.log("Episode Data:", episodeData);
  }
}

let _APP = null;
window.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM Content Loaded");
  _APP = new SphereGame();
});