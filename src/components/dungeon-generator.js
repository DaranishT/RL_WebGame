// dungeon-generator.js
import * as THREE from 'three';
import { entity } from './entity.js';
import { AmmoJSController } from './ammojs-component.js';
import { GoalPoint } from './goal-point.js';

export class DungeonGenerator extends entity.Component {
  static CLASS_NAME = 'DungeonGenerator';
  get NAME() { return DungeonGenerator.CLASS_NAME; }

  constructor(params) {
    super();
    this.params = params;
    this.gridSize = params.gridSize || 80;
    this.cellSize = params.cellSize || 5;
    this.numRoomTries = params.numRoomTries || 100;
    this.extraConnectorChance = params.extraConnectorChance || 10;
    this.roomExtraSize = params.roomExtraSize || 1;
    this.windingPercent = params.windingPercent || 0; // Set to 0 for more direct paths
    this.tunnelHeight = params.tunnelHeight || 10;

    // Room constraints
    this.minRoomSize = params.minRoomSize || 5;
    this.maxRoomSize = params.maxRoomSize || 7;
    this.maxRooms = params.maxRooms || 5;

    // Materials
    this.groundMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    this.roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    this.wallMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.3 });

    this.rooms = [];
    this.grid = [];
    this.regions = [];
    this.currentRegion = -1;

    this.gridObjects = [];
    this.physicsBodies = [];
    this.validRoadPositions = [];
    this.wallPositions = new Set(); // Track wall positions for physics

    this.initialized = false;
  }

  PostInitializeComponent() {
    const physicsEntity = this.FindEntity('physics');
    if (!physicsEntity) {
      console.error("Physics controller not found.");
      return;
    }
    this.physics = physicsEntity.GetComponent(AmmoJSController.CLASS_NAME);

    this.GenerateDungeon();
    this.initialized = true;
  }

  GenerateDungeon() {
    this.ClearGrid();
    this.InitializeGrid();

    this.AddRooms();
    this.GrowMazes();
    this.ConnectRegions();
    this.RemoveDeadEnds();
    this.Build3DStructure();
    
    // Handles both player and goal placement synchronously after generation
    this.PlacePlayerAndGoal(); 

    console.log(`3D Dungeon generated with ${this.rooms.length} rooms`);
  }

  InitializeGrid() {
    const gridWidth = Math.floor(this.gridSize / this.cellSize);
    const gridHeight = Math.floor(this.gridSize / this.cellSize);

    this.grid = [];
    this.regions = [];

    for (let x = 0; x < gridWidth; x++) {
      this.grid[x] = [];
      this.regions[x] = [];
      for (let y = 0; y < gridHeight; y++) {
        this.grid[x][y] = 1; // 1 = wall, 0 = floor
        this.regions[x][y] = -1; // -1 = no region
      }
    }
  }

  AddRooms() {
    const gridWidth = this.grid.length;
    const gridHeight = this.grid[0].length;
    let roomsCreated = 0;

    for (let i = 0; i < this.numRoomTries; i++) {
      if (roomsCreated >= this.maxRooms) break;

      let size = Math.floor(Math.random() * (this.maxRoomSize - this.minRoomSize + 1)) + this.minRoomSize;
      if (size % 2 === 0) size++;

      const rectangularity = Math.floor(Math.random() * (1 + Math.floor(size / 2))) * 2;
      let width = size;
      let height = size;

      if (Math.random() < 0.5) {
        width += rectangularity;
      } else {
        height += rectangularity;
      }
      if (width % 2 === 0) width++;
      if (height % 2 === 0) height++;

      const x = Math.floor(Math.random() * Math.floor((gridWidth - width) / 2)) * 2 + 1;
      const y = Math.floor(Math.random() * Math.floor((gridHeight - height) / 2)) * 2 + 1;

      if (x + width >= gridWidth - 1 || y + height >= gridHeight - 1) {
          continue;
      }

      const room = {
        x: x, y: y, width: width, height: height,
        bounds: { left: x, top: y, right: x + width -1, bottom: y + height-1 }
      };

      let overlaps = false;
      for (const otherRoom of this.rooms) {
        if (this.RoomsOverlap(room, otherRoom)) {
          overlaps = true;
          break;
        }
      }

      if (overlaps) continue;

      this.rooms.push(room);
      roomsCreated++;
      this.StartRegion();

      for (let roomX = room.x; roomX < room.x + room.width; roomX++) {
        for (let roomY = room.y; roomY < room.y + room.height; roomY++) {
          this.Carve(roomX, roomY);
        }
      }
    }
  }

  RoomsOverlap(roomA, roomB) {
    const padding = 2; // Ensure rooms are spaced apart
    return roomA.bounds.left <= roomB.bounds.right + padding &&
           roomA.bounds.right >= roomB.bounds.left - padding &&
           roomA.bounds.top <= roomB.bounds.bottom + padding &&
           roomA.bounds.bottom >= roomB.bounds.top - padding;
  }

  GrowMazes() {
    const gridWidth = this.grid.length;
    const gridHeight = this.grid[0].length;

    for (let y = 1; y < gridHeight; y += 2) {
      for (let x = 1; x < gridWidth; x += 2) {
        if (this.grid[x][y] !== 0) { // If it's a wall
          this.GrowMazeFrom(x, y);
        }
      }
    }
  }

  GrowMazeFrom(startX, startY) {
    const cells = [];
    let lastDirection = null;

    this.StartRegion();
    this.Carve(startX, startY);
    cells.push({ x: startX, y: startY });

    const directions = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
    ];

    while (cells.length > 0) {
      const cell = cells[cells.length - 1];
      const unmadeDirections = [];

      for (const dir of directions) {
        if (this.CanCarve(cell, dir)) {
          unmadeDirections.push(dir);
        }
      }

      if (unmadeDirections.length > 0) {
        let direction;
        if (lastDirection && unmadeDirections.some(d => d.dx === lastDirection.dx && d.dy === lastDirection.dy) && Math.random() * 100 > this.windingPercent) {
          direction = lastDirection;
        } else {
          direction = unmadeDirections[Math.floor(Math.random() * unmadeDirections.length)];
        }

        this.Carve(cell.x + direction.dx, cell.y + direction.dy);
        this.Carve(cell.x + direction.dx * 2, cell.y + direction.dy * 2);

        cells.push({ x: cell.x + direction.dx * 2, y: cell.y + direction.dy * 2 });
        lastDirection = direction;
      } else {
        cells.pop();
        lastDirection = null;
      }
    }
  }

  CanCarve(cell, direction) {
    const nx = cell.x + direction.dx * 3;
    const ny = cell.y + direction.dy * 3;

    if (nx < 0 || nx >= this.grid.length || ny < 0 || ny >= this.grid[0].length) {
      return false;
    }
    // Check two cells ahead
    return this.grid[cell.x + direction.dx * 2][cell.y + direction.dy * 2] === 1;
  }

  ConnectRegions() {
    const connectors = [];
    const gridWidth = this.grid.length;
    const gridHeight = this.grid[0].length;

    for (let x = 1; x < gridWidth - 1; x++) {
      for (let y = 1; y < gridHeight - 1; y++) {
        if (this.grid[x][y] !== 1) continue;

        const regions = new Set();
        const neighbors = [{x: x - 1, y: y}, {x: x + 1, y: y}, {x: x, y: y - 1}, {x: x, y: y + 1}];
        for (const n of neighbors) {
          const region = this.regions[n.x]?.[n.y];
          if (region !== undefined && region !== -1) {
            regions.add(region);
          }
        }

        if (regions.size >= 2) {
          connectors.push({ x, y, regions: Array.from(regions) });
        }
      }
    }
    if (connectors.length === 0) return;

    const parent = Array.from({ length: this.currentRegion + 1 }, (_, i) => i);
    const find = (i) => {
      if (parent[i] === i) return i;
      return parent[i] = find(parent[i]);
    };

    for (let i = connectors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [connectors[i], connectors[j]] = [connectors[j], connectors[i]];
    }

    const openedConnectors = new Set();
    for (const connector of connectors) {
      const root1 = find(connector.regions[0]);
      const root2 = find(connector.regions[1]);
      
      if (root1 !== root2) {
        parent[root2] = root1;
        this.grid[connector.x][connector.y] = 0;
        openedConnectors.add(connector);
      }
    }
    
    for (const connector of connectors) {
        if (openedConnectors.has(connector)) continue;
        if (Math.random() * 100 < this.extraConnectorChance) {
             this.grid[connector.x][connector.y] = 0;
        }
    }
  }

  RemoveDeadEnds() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let x = 1; x < this.grid.length - 1; x++) {
        for (let y = 1; y < this.grid[0].length - 1; y++) {
          if (this.grid[x][y] === 1) continue;

          let isRoom = false;
          for(const room of this.rooms) {
              if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) {
                  isRoom = true;
                  break;
              }
          }
          if (isRoom) continue;

          let exits = 0;
          if (this.grid[x - 1][y] === 0) exits++;
          if (this.grid[x + 1][y] === 0) exits++;
          if (this.grid[x][y - 1] === 0) exits++;
          if (this.grid[x][y + 1] === 0) exits++;

          if (exits === 1) {
            this.grid[x][y] = 1;
            changed = true;
          }
        }
      }
    }
  }

  Build3DStructure() {
    const halfSize = this.gridSize / 2;
    const cellWorldSize = this.cellSize;

    this.CreateGround();
    this.wallPositions.clear();

    for (let x = 0; x < this.grid.length; x++) {
      for (let y = 0; y < this.grid[x].length; y++) {
        if (this.grid[x][y] === 1) { // Wall
          const worldX = x * cellWorldSize - halfSize + cellWorldSize / 2;
          const worldZ = y * cellWorldSize - halfSize + cellWorldSize / 2;
          this.wallPositions.add(`${worldX},${worldZ}`);
        }
      }
    }

    for (let x = 0; x < this.grid.length; x++) {
      for (let y = 0; y < this.grid[x].length; y++) {
        const cellType = this.grid[x][y];
        const worldX = x * cellWorldSize - halfSize + cellWorldSize / 2;
        const worldZ = y * cellWorldSize - halfSize + cellWorldSize / 2;

        if (cellType === 0) { // Floor
          this.CreateFloorPiece(worldX, worldZ, cellWorldSize);
          this.validRoadPositions.push(new THREE.Vector3(worldX, 1, worldZ));
        }

        this.CreateWallsAroundCell(x, y, worldX, worldZ, cellWorldSize);
      }
    }

    this.CreateOptimizedPhysicsWalls();
  }

  CreateGround() {
    const groundGeometry = new THREE.PlaneGeometry(this.gridSize, this.gridSize);
    const ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.params.scene.add(ground);
    this.gridObjects.push(ground);

    const groundBody = this.physics.CreateBox(
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(this.gridSize, 0.1, this.gridSize),
      0
    );
    if(groundBody.body_) this.physicsBodies.push(groundBody.body_);
  }

  CreateFloorPiece(x, z, size) {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.1, size),
      this.roadMaterial
    );
    floor.position.set(x, 0.05, z);
    floor.receiveShadow = true;
    this.params.scene.add(floor);
    this.gridObjects.push(floor);
  }

  CreateWallsAroundCell(gridX, gridY, worldX, worldZ, cellSize) {
    if (this.grid[gridX][gridY] !== 0) return;

    const wallHeight = this.tunnelHeight;
    const wallThickness = 1.0;
    const halfCell = cellSize / 2;

    const directions = [
      { dx: -1, dy: 0, pos: [worldX - halfCell, worldZ], size: [wallThickness, wallHeight, cellSize] },
      { dx: 1, dy: 0, pos: [worldX + halfCell, worldZ], size: [wallThickness, wallHeight, cellSize] },
      { dx: 0, dy: -1, pos: [worldX, worldZ - halfCell], size: [cellSize, wallHeight, wallThickness] },
      { dx: 0, dy: 1, pos: [worldX, worldZ + halfCell], size: [cellSize, wallHeight, wallThickness] }
    ];

    for (const dir of directions) {
      const neighborX = gridX + dir.dx;
      const neighborY = gridY + dir.dy;

      if (neighborX < 0 || neighborY < 0 ||
          neighborX >= this.grid.length || neighborY >= this.grid[0].length ||
          this.grid[neighborX][neighborY] === 1) {
        this.CreateVisualWall(dir.pos[0], dir.pos[1], dir.size[0], dir.size[2], wallHeight);
      }
    }
  }

  CreateVisualWall(x, z, width, depth, height) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      this.wallMaterial
    );
    wall.position.set(x, height / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.params.scene.add(wall);
    this.gridObjects.push(wall);
  }

  CreateOptimizedPhysicsWalls() {
    const wallHeight = this.tunnelHeight;

    this.wallPositions.forEach(positionKey => {
      const [x, z] = positionKey.split(',').map(Number);
      const wallBody = this.physics.CreateBox(
        new THREE.Vector3(x, wallHeight / 2, z),
        new THREE.Quaternion(),
        new THREE.Vector3(this.cellSize, wallHeight, this.cellSize),
        0
      );
      if (wallBody && wallBody.body_) {
        this.physicsBodies.push(wallBody.body_);
        this.gridObjects.push(wallBody);
      }
    });

    this.CreateBorderWalls();
  }

  CreateBorderWalls() {
    const h = this.tunnelHeight;
    const w = 2;
    const s = this.gridSize;
    const halfSize = this.gridSize / 2;

    const borderWalls = [
      { pos: [0, -halfSize - w / 2], size: [s + w * 2, w] },
      { pos: [0, halfSize + w / 2], size: [s + w * 2, w] },
      { pos: [halfSize + w / 2, 0], size: [w, s + w * 2] },
      { pos: [-halfSize - w / 2, 0], size: [w, s + w * 2] }
    ];

    borderWalls.forEach(wall => {
      this.CreateVisualWall(wall.pos[0], wall.pos[1], wall.size[0], wall.size[1], h);
      const wallBody = this.physics.CreateBox(
        new THREE.Vector3(wall.pos[0], h / 2, wall.pos[1]),
        new THREE.Quaternion(),
        new THREE.Vector3(wall.size[0], h, wall.size[1]),
        0
      );
      if (wallBody && wallBody.body_) {
        this.physicsBodies.push(wallBody.body_);
        this.gridObjects.push(wallBody);
      }
    });
  }

  GetRandomRoadPosition() {
    if (this.validRoadPositions.length === 0) {
      return new THREE.Vector3(0, 1, 0); // Return fallback, no warning
    }
    const randomIndex = Math.floor(Math.random() * this.validRoadPositions.length);
    return this.validRoadPositions[randomIndex].clone();
  }

  GetRandomRoomPosition() {
    if (this.rooms.length === 0) {
      return this.GetRandomRoadPosition(); // Fallback to any road if no rooms
    }
    const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
    const x = room.x + Math.floor(Math.random() * room.width);
    const y = room.y + Math.floor(Math.random() * room.height);

    const halfSize = this.gridSize / 2;
    const worldX = x * this.cellSize - halfSize + this.cellSize / 2;
    const worldZ = y * this.cellSize - halfSize + this.cellSize / 2;
    return new THREE.Vector3(worldX, 1.5, worldZ);
  }
  
  PlacePlayerAndGoal() {
    if (this.rooms.length < 2) {
      console.warn("Not enough rooms to place player and goal distinctly.");
      const playerEntity = this.FindEntity('player');
      if (playerEntity) {
        playerEntity.SetPosition(this.GetRandomRoomPosition());
        this.PlaceGoalPoint(playerEntity.Position);
      } else {
        this.PlaceGoalPoint();
      }
      return;
    }

    let roomIndices = Array.from(this.rooms.keys());
    const playerRoomIndex = roomIndices.splice(Math.floor(Math.random() * roomIndices.length), 1)[0];
    const goalRoomIndex = roomIndices[Math.floor(Math.random() * roomIndices.length)];
    
    const playerRoom = this.rooms[playerRoomIndex];
    
    const playerEntity = this.FindEntity('player');
    if (playerEntity) {
        const playerX = playerRoom.x + Math.floor(playerRoom.width / 2);
        const playerY = playerRoom.y + Math.floor(playerRoom.height / 2);
        const halfSize = this.gridSize / 2;
        const worldX = playerX * this.cellSize - halfSize + this.cellSize / 2;
        const worldZ = playerY * this.cellSize - halfSize + this.cellSize / 2;
        playerEntity.SetPosition(new THREE.Vector3(worldX, 1.5, worldZ));
        
        this.PlaceGoalPoint(playerEntity.Position, this.rooms[goalRoomIndex]);
    } else {
        this.PlaceGoalPoint();
    }
  }

  PlaceGoalPoint(playerPosition = new THREE.Vector3(), specificRoom = null) {
    const existingGoal = this.FindEntity('goal');
    if (existingGoal) {
        existingGoal.Destroy();
        if (this.Manager.entitiesMap_['goal'] === existingGoal) {
            delete this.Manager.entitiesMap_['goal'];
        }
    }

    let goalPosition;
    if (specificRoom) {
        const x = specificRoom.x + Math.floor(Math.random() * specificRoom.width);
        const y = specificRoom.y + Math.floor(Math.random() * specificRoom.height);
        const halfSize = this.gridSize / 2;
        const worldX = x * this.cellSize - halfSize + this.cellSize / 2;
        const worldZ = y * this.cellSize - halfSize + this.cellSize / 2;
        goalPosition = new THREE.Vector3(worldX, 1.5, worldZ);
    } else {
        let attempts = 0;
        do {
          goalPosition = this.GetRandomRoomPosition();
          attempts++;
        } while (goalPosition.distanceTo(playerPosition) < (this.gridSize / 4) && attempts < 50);
    }

    const goalEntity = new entity.Entity();
    goalEntity.SetPosition(goalPosition);
    goalEntity.AddComponent(new GoalPoint({ scene: this.params.scene }));
    this.Manager.Add(goalEntity, 'goal');

    // DEVELOPER NOTE: To fix rapid-fire regeneration, a cooldown is required.
    // In main.js, inside your CheckGoalCollision function, set a boolean flag like
    // `this.goalCooldown = true;` immediately after detecting a collision.
    // Then, use a setTimeout to call StartNewEpisode after 1-2 seconds.
    // In StartNewEpisode, set `this.goalCooldown = false;` to allow the goal to be triggered again.
    // Your collision check should be wrapped in `if (!this.goalCooldown) { ... }`
  }

  ClearGrid() {
    const physicsEntity = this.FindEntity('physics');
    if (physicsEntity) {
      const physicsComponent = physicsEntity.GetComponent(AmmoJSController.CLASS_NAME);
      if (physicsComponent) {
        if (physicsComponent.physicsWorld_) {
          this.physicsBodies.forEach(body => {
              if (body) {
                physicsComponent.physicsWorld_.removeRigidBody(body);
              }
          });
        }
        
        if (physicsComponent.rigidBodies_) {
            const gridObjectBodies = new Set(this.physicsBodies);
            physicsComponent.rigidBodies_ = physicsComponent.rigidBodies_.filter(rb => !gridObjectBodies.has(rb.body_));
        }
      }
    }

    this.gridObjects.forEach(obj => {
      if (obj instanceof THREE.Mesh) {
        this.params.scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      } else if (obj && obj.Destroy) {
        obj.Destroy();
      }
    });

    this.physicsBodies = [];
    this.gridObjects = [];
    this.validRoadPositions = [];
    this.wallPositions.clear();
    this.rooms = [];
    this.currentRegion = -1;
    this.initialized = false;
  }
  
  RegenerateGrid() {
    console.log("Regenerating dungeon...");
    this.GenerateDungeon();
    console.log("New dungeon generated");
  }

  StartRegion() {
    this.currentRegion++;
  }

  Carve(x, y) {
    this.grid[x][y] = 0;
    this.regions[x][y] = this.currentRegion;
  }
  
  GetGridCell(position) {return null;}
  MarkCellVisited(position) {return false;}
  GetVisitedPercentage() {return 0;}
  IsOnRoad(position) {return true;}

  Update(_) {}
}

