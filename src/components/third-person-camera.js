import * as THREE from 'three';
import { entity } from './entity.js';

export class ThirdPersonCamera extends entity.Component {
  static CLASS_NAME = 'ThirdPersonCamera';

  get NAME() {
    return ThirdPersonCamera.CLASS_NAME;
  }

  constructor(params) {
    super();
    this.params = params;
    this.camera = params.camera;
    this.target = params.target;

    this.currentPosition = new THREE.Vector3();
    this.currentLookat = new THREE.Vector3();
    this.initialized = false;

    this.distance = 6;
    this.height = 2.5;

    this.mouseSensitivity = 0.002;
    this.yaw = 0;
    this.pitch = 0;

    this.maxPitch = Math.PI / 8;    // ~30 degrees
    this.minPitch = -Math.PI / 3.5; // ~-51 degrees

    this.isPointerLocked = false;
  }

  InitComponent() {
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange(), false);
    document.addEventListener('mozpointerlockchange', () => this.onPointerLockChange(), false);

    document.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        document.body.requestPointerLock = document.body.requestPointerLock ||
                                           document.body.mozRequestPointerLock;
        document.body.requestPointerLock();

        this.previousMouseX = 0;
        this.previousMouseY = 0;
      }
    }, false);

    document.addEventListener('mousemove', (e) => this.onMouseMove(e), false);

    this.initialized = true;
    console.log("ThirdPersonCamera initialized with proper boundaries");
  }

  onPointerLockChange() {
    this.isPointerLocked = !!(
      document.pointerLockElement ||
      document.mozPointerLockElement
    );

    console.log("Pointer lock:", this.isPointerLocked);
  }

  onMouseMove(e) {
    if (!this.isPointerLocked) return;

    const movementX = e.movementX || e.mozMovementX || 0;
    const movementY = e.movementY || e.mozMovementY || 0;

    this.yaw -= movementX * this.mouseSensitivity;
    this.pitch -= movementY * this.mouseSensitivity;

    // Clamp pitch to prevent camera from looking under the floor
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
  }

  CalculateIdealOffset() {
    if (!this.target || !this.target.Position) {
      return new THREE.Vector3(0, this.height, -this.distance);
    }

    const playerPosition = this.target.Position.clone();
    const idealOffset = new THREE.Vector3(0, this.height, -this.distance);

    const rotation = new THREE.Quaternion();
    rotation.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    idealOffset.applyQuaternion(rotation);

    idealOffset.add(playerPosition);

    return idealOffset;
  }

  CalculateIdealLookat() {
    if (!this.target || !this.target.Position) {
      return new THREE.Vector3(0, 0, 0);
    }

    const lookat = this.target.Position.clone();
    lookat.y += 1.5;
    return lookat;
  }

  Update(timeElapsed) {
    if (!this.initialized || !this.target) return;

    const idealOffset = this.CalculateIdealOffset();
    const idealLookat = this.CalculateIdealLookat();

    // Prevent camera from going under the floor (assuming y = 0 is floor level)
    if (idealOffset.y < this.height * 0.5) {
      idealOffset.y = this.height * 0.5;
    }

    const t = 1.0 - Math.pow(0.001, timeElapsed);

    this.currentPosition.lerp(idealOffset, t);
    this.currentLookat.lerp(idealLookat, t);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookat);
  }

  get Yaw() {
    return this.yaw;
  }
}
