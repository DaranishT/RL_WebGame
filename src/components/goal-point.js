// goal-point.js
import * as THREE from 'three';
import { entity } from './entity.js';

export class GoalPoint extends entity.Component {
  static CLASS_NAME = 'GoalPoint';

  get NAME() {
    return GoalPoint.CLASS_NAME;
  }

  constructor(params) {
    super();
    this.params = params;
    this.radius = 2; // Collision radius
    this.mesh = null;
    this.onGoalReached = params.onGoalReached || null; // Callback for RL agents
  }

  InitEntity() {
    // Create visual representation
    const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.7
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.Parent.Position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    this.params.scene.add(this.mesh);
  }

  Update(timeElapsed) {
    if (this.mesh) {
      // Pulsating effect
      this.mesh.scale.setScalar(1 + Math.sin(Date.now() * 0.002) * 0.1);
      
      // Rotate slowly
      this.mesh.rotation.y += timeElapsed * 0.5;
    }
  }

  CheckCollision(playerPosition) {
    const collision = this.Parent.Position.distanceTo(playerPosition) < this.radius;
    if (collision && this.onGoalReached) {
      this.onGoalReached(this.Parent.Position);
    }
    return collision;
  }

  Destroy() {
    if (this.mesh && this.params.scene) {
      this.params.scene.remove(this.mesh);
    }
  }
}