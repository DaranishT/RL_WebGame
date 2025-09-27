// grid-generator.js
import * as THREE from 'three';
import { entity } from './entity.js';
import { AmmoJSController } from './ammojs-component.js';
import { GoalPoint } from './goal-point.js';

export class GridGenerator extends entity.Component {
  static CLASS_NAME = 'GridGenerator';
  get NAME() { return GridGenerator.CLASS_NAME; }

  constructor(params) {
    super();
    this.params = params;
    this.gridSize = params.gridSize || 150;
    this.cellSize = params.cellSize || 6;
    this.tunnelHeight = params.tunnelHeight || 10;
    this.tunnelWidth = params.tunnelWidth || 2;

    this.groundMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    this.roadMaterial   = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    this.wallMaterial   = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.3 });
    this.ceilingMaterial= new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 });

    this.gridCells = [];
    this.roadSquares = [];
    this.validRoadPositions = [];
    this.gridObjects = []; // Track all created objects for cleanup
    this.physicsBodies = []; // Track physics bodies separately
  }

  PostInitializeComponent() {
    const physicsEntity = this.FindEntity('physics');
    if (!physicsEntity) { console.error("Physics controller not found."); return; }
    this.physics = physicsEntity.GetComponent(AmmoJSController.CLASS_NAME);

    this.GenerateProceduralTunnels();
    console.log(`Procedural expanded tunnel grid generated with size ${this.gridSize}`);
  }

  GenerateProceduralTunnels() {
    // Clear any existing grid first
    this.ClearGrid();
    
    const halfSize = this.gridSize / 2;
    this.CreateGround();
    const roadMap = this.GenerateRoadMap();
    this.CreateTunnelsFromMap(roadMap, halfSize);
   // this.CreateCeiling(halfSize);
    this.InitializeGridCells(roadMap, halfSize);
  }

  GenerateRoadMap() {
    const array = [];
    const sideLength = Math.floor(this.gridSize / this.cellSize);

    // Initialize grid
    for (let i = 0; i < sideLength; i++) {
      const row = [];
      for (let j = 0; j < sideLength; j++) {
        row.push({ positionX: i, positionZ: j, terrainType: 'empty', used: false });
      }
      array.push(row);
    }

    // Horizontal tunnels every 5 rows
    for (let i = 0; i < sideLength; i++) {
      if (i % 5 === 0) {
        for (let j = 0; j < sideLength; j++) {
          array[i][j].terrainType = 'street';
          this.MarkSurroundingAsEmpty(array, i, j);
        }
      }
    }

    // Vertical tunnels every 5 columns (offset)
    for (let j = 0; j < sideLength; j++) {
      if (j % 5 === 2) {
        for (let i = 0; i < sideLength; i++) {
          array[i][j].terrainType = 'street';
          this.MarkSurroundingAsEmpty(array, i, j);
        }
      }
    }

    // Extra random connectors and diagonals
    for (let n = 0; n < sideLength * 2; n++) {
      const startX = Math.floor(Math.random() * sideLength);
      const startZ = Math.floor(Math.random() * sideLength);
      const length = Math.floor(Math.random() * 8) + 4;
      const direction = Math.floor(Math.random() * 4); // 0=hor,1=ver,2=diag,3=anti-diag

      for (let k = 0; k < length; k++) {
        let x = startX, z = startZ;
        if (direction === 0) x += k;
        else if (direction === 1) z += k;
        else if (direction === 2) { x += k; z += k; }
        else if (direction === 3) { x += k; z -= k; }

        if (x >= 0 && z >= 0 && x < sideLength && z < sideLength) {
          array[x][z].terrainType = 'street';
          this.MarkSurroundingAsEmpty(array, x, z);
        }
      }
    }

    return array;
  }

  MarkSurroundingAsEmpty(array, x, z) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const nx = x + dx, nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < array.length && nz < array[0].length) {
          if (array[nx][nz].terrainType !== 'street') array[nx][nz].terrainType = 'empty';
        }
      }
    }
  }

  CreateGround() {
    const groundGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
    const ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.params.scene.add(ground);
    this.gridObjects.push(ground);

    const pos = new THREE.Vector3(0, -0.05, 0);
    const groundBody = this.physics.CreateBox(pos, new THREE.Quaternion(), new THREE.Vector3(this.gridSize, 0.1, this.gridSize), 0, { entity: this.Parent });
    this.physicsBodies.push(groundBody.body_);
    this.gridObjects.push(groundBody);
  }

  CreateCeiling(halfSize) {
    const ceilingGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
    const ceiling = new THREE.Mesh(ceilingGeometry, this.ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.tunnelHeight;
    ceiling.receiveShadow = true;
    this.params.scene.add(ceiling);
    this.gridObjects.push(ceiling);

    const pos = new THREE.Vector3(0, this.tunnelHeight + 0.05, 0);
    const ceilingBody = this.physics.CreateBox(pos, new THREE.Quaternion(), new THREE.Vector3(this.gridSize, 0.1, this.gridSize), 0, { entity: this.Parent });
    this.physicsBodies.push(ceilingBody.body_);
    this.gridObjects.push(ceilingBody);
  }

  CreateTunnelsFromMap(roadMap, halfSize) {
    for (let x = 0; x < roadMap.length; x++) {
      for (let z = 0; z < roadMap[x].length; z++) {
        if (roadMap[x][z].terrainType === 'street') {
          const worldX = x * this.cellSize - halfSize + this.cellSize/2;
          const worldZ = z * this.cellSize - halfSize + this.cellSize/2;
          this.CreateRoadPiece(worldX, worldZ, this.cellSize);
          this.CreateTunnelWallsAroundRoad(worldX, worldZ, this.cellSize, roadMap, x, z);
          this.roadSquares.push([worldX, worldZ]);
        }
      }
    }
    this.CreateBorderWalls(halfSize);
  }

  CreateRoadPiece(x, z, size) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(size, 0.1, size), this.roadMaterial);
    road.position.set(x, 0.05, z);
    road.receiveShadow = true;
    this.params.scene.add(road);
    this.gridObjects.push(road);
  }

  CreateTunnelWallsAroundRoad(worldX, worldZ, cellSize, roadMap, gridX, gridZ) {
    const halfCell = cellSize / 2;
    const wallHeight = this.tunnelHeight;
    const wallWidth = this.tunnelWidth;

    const neighbors = [
      { dx: -1, dz: 0, pos: [worldX - halfCell, worldZ], size: [wallWidth, wallHeight, cellSize] },
      { dx: 1, dz: 0, pos: [worldX + halfCell, worldZ], size: [wallWidth, wallHeight, cellSize] },
      { dx: 0, dz: -1, pos: [worldX, worldZ - halfCell], size: [cellSize, wallHeight, wallWidth] },
      { dx: 0, dz: 1, pos: [worldX, worldZ + halfCell], size: [cellSize, wallHeight, wallWidth] }
    ];

    for (const n of neighbors) {
      const nx = gridX + n.dx, nz = gridZ + n.dz;
      if (nx < 0 || nz < 0 || nx >= roadMap.length || nz >= roadMap[0].length || roadMap[nx][nz].terrainType !== 'street') {
        this.CreateWall(n.pos[0], n.pos[1], n.size[0], n.size[2], wallHeight);
      }
    }
  }

  CreateWall(x, z, width, depth, height) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.wallMaterial);
    wall.position.set(x, height/2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.params.scene.add(wall);
    this.gridObjects.push(wall);

    const wallBody = this.physics.CreateBox(new THREE.Vector3(x, height/2, z), new THREE.Quaternion(), new THREE.Vector3(width, height, depth), 0, { entity: this.Parent });
    this.physicsBodies.push(wallBody.body_);
    this.gridObjects.push(wallBody);
  }

  CreateBorderWalls(halfSize) {
    const h = this.tunnelHeight, w = this.tunnelWidth, s = this.gridSize;
    this.CreateWall(0, -halfSize - w/2, s + w*2, w, h);
    this.CreateWall(0, halfSize + w/2, s + w*2, w, h);
    this.CreateWall(halfSize + w/2, 0, w, s + w*2, h);
    this.CreateWall(-halfSize - w/2, 0, w, s + w*2, h);
  }

  InitializeGridCells(roadMap, halfSize) {
    this.validRoadPositions = [];
    
    for (let x = 0; x < roadMap.length; x++) {
      this.gridCells[x] = [];
      for (let z = 0; z < roadMap[x].length; z++) {
        const cellX = x * this.cellSize - halfSize + this.cellSize/2;
        const cellZ = z * this.cellSize - halfSize + this.cellSize/2;
        this.gridCells[x][z] = { 
          x: cellX, 
          z: cellZ, 
          type: roadMap[x][z].terrainType, 
          visited: false 
        };
        
        // Store valid road positions for spawning
        if (roadMap[x][z].terrainType === 'street') {
          this.validRoadPositions.push(new THREE.Vector3(cellX, 1, cellZ));
        }
      }
    }
  }

  GetRandomRoadPosition() {
    if (this.validRoadPositions.length === 0) {
      return new THREE.Vector3(0, 1, 0); // Fallback position
    }
    
    const randomIndex = Math.floor(Math.random() * this.validRoadPositions.length);
    return this.validRoadPositions[randomIndex].clone();
  }

  PlaceGoalPoint() {
    // Remove existing goal if any
    const existingGoal = this.FindEntity('goal');
    if (existingGoal) {
      this.Manager.entities_ = this.Manager.entities_.filter(e => e !== existingGoal);
      delete this.Manager.entitiesMap_['goal'];
      existingGoal.Destroy();
    }

    // Get player position to ensure goal is placed far away
    const playerEntity = this.FindEntity('player');
    let playerPosition = new THREE.Vector3(0, 0, 0);
    if (playerEntity) {
      playerPosition = playerEntity.Position.clone();
    }

    // Try to find a position that's far from the player
    let goalPosition;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
      goalPosition = this.GetRandomRoadPosition();
      goalPosition.y = 1.5; // Position above ground
      attempts++;
      
      // If we can't find a far position after many attempts, just use any position
      if (attempts >= maxAttempts) {
        break;
      }
    } while (goalPosition.distanceTo(playerPosition) < (this.gridSize / 4)); // Minimum quarter grid size away

    const goalEntity = new entity.Entity();
    goalEntity.SetPosition(goalPosition);
    
    const goalComponent = new GoalPoint({
      scene: this.params.scene
    });
    
    goalEntity.AddComponent(goalComponent);
    this.Manager.Add(goalEntity, 'goal');
    
    console.log("Goal placed at:", goalPosition, "Distance from player:", goalPosition.distanceTo(playerPosition));
    return goalPosition;
  }

ClearGrid() {
    // Remove all physics bodies from physics world first
    const physicsEntity = this.FindEntity('physics');
    if (physicsEntity) {
        const physicsComponent = physicsEntity.GetComponent(AmmoJSController.CLASS_NAME);
        if (physicsComponent && physicsComponent.physicsWorld_) {
            this.physicsBodies.forEach(body => {
                try {
                    // Check if body still exists before trying to remove it
                    if (body && typeof body === 'object') {
                        physicsComponent.physicsWorld_.removeRigidBody(body);
                    }
                } catch (e) {
                    console.warn("Error removing physics body:", e);
                }
            });
            
            // Also clear the physics component's arrays to prevent sync errors
            physicsComponent.rigidBodies_ = physicsComponent.rigidBodies_.filter(rb => {
                return !this.gridObjects.includes(rb);
            });
        }
    }
    // Remove all grid objects from scene
    this.gridObjects.forEach(obj => {
        try {
            if (obj instanceof THREE.Mesh) {
                this.params.scene.remove(obj);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            } else if (obj && obj.Destroy) {
                // Physics objects - destroy them properly
                obj.Destroy();
            }
        } catch (e) {
            console.warn("Error cleaning up grid object:", e);
        }
    });
    
    this.physicsBodies = [];
    this.gridObjects = [];
    this.roadSquares = [];
    this.validRoadPositions = [];
    this.gridCells = [];
    
    console.log("Grid cleared");
}

  RegenerateGrid() {
    console.log("Regenerating entire grid...");
    this.GenerateProceduralTunnels();
    
    // Wait a frame for physics to settle before placing goal
    setTimeout(() => {
      this.PlaceGoalPoint();
      console.log("New grid generated");
    }, 100);
  }

  GetGridCell(position) {
    const halfSize = this.gridSize / 2;
    const gridX = Math.floor((position.x + halfSize) / this.cellSize);
    const gridZ = Math.floor((position.z + halfSize) / this.cellSize);
    
    if (gridX >= 0 && gridX < this.gridCells.length && 
        gridZ >= 0 && gridZ < this.gridCells[0].length) {
      return this.gridCells[gridX][gridZ];
    }
    return null;
  }

  MarkCellVisited(position) {
    const cell = this.GetGridCell(position);
    if (cell && cell.type === 'street' && !cell.visited) {
      cell.visited = true;
      return true;
    }
    return false;
  }

  GetVisitedPercentage() {
    let totalRoadCells = 0;
    let visitedRoadCells = 0;
    
    for (let x = 0; x < this.gridCells.length; x++) {
      for (let z = 0; z < this.gridCells[x].length; z++) {
        if (this.gridCells[x][z].type === 'street') {
          totalRoadCells++;
          if (this.gridCells[x][z].visited) {
            visitedRoadCells++;
          }
        }
      }
    }
    
    return totalRoadCells > 0 ? visitedRoadCells / totalRoadCells : 0;
  }

  IsOnRoad(position) {
    const cell = this.GetGridCell(position);
    return cell && cell.type === 'street';
  }

  ResetGrid() {
    for (let x = 0; x < this.gridCells.length; x++) {
      for (let z = 0; z < this.gridCells[x].length; z++) {
        if (this.gridCells[x][z]) {
          this.gridCells[x][z].visited = false;
        }
      }
    }
  }

  Update(_) {}
}