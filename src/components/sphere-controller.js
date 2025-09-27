import * as THREE from 'three';
import { entity } from './entity.js';
import { AmmoJSController } from './ammojs-component.js';

export class SphereController extends entity.Component {
  static CLASS_NAME = 'SphereController';

  get NAME() {
    return SphereController.CLASS_NAME;
  }

  constructor(params) {
    super();
    this.params = params;
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
    };

    this.moveSpeed = 10;   // movement speed (units/sec)
    this.rotationSpeed = 5; // smooth turn speed
    this.radius = 1;
    this.jumpForce = 8;
    this.canJump = false;
  }

  InitEntity() {
    this.geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    this.material = new THREE.MeshPhongMaterial({
      color: 0x44aa88,
      shininess: 100,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.params.scene.add(this.mesh);

    this.Parent.SetPosition(new THREE.Vector3(0, this.radius + 2, 5));
    this.Parent.SetQuaternion(new THREE.Quaternion());
  }

  PostInitializeComponent() {
    const physics = this.FindEntity('physics');
    if (!physics) {
      console.error("Physics controller not found. Cannot create rigid body.");
      return;
    }
    this.physics = physics.GetComponent(AmmoJSController.CLASS_NAME);

    const pos = this.Parent.Position;
    const quat = this.Parent.Quaternion;
    const mass = 5;
    const userData = { entity: this.Parent, mesh: this.mesh };

    this.rigidBody = this.physics.CreateSphere(pos, quat, this.radius, mass, userData);

    this.rigidBody.body_.setFriction(0.6);
    this.rigidBody.body_.setRestitution(0.1);
    this.rigidBody.body_.setDamping(0.02, 0.05);
    this.rigidBody.body_.activate(true);
    try { this.rigidBody.body_.setActivationState(4); } catch (e) {}
  }

  InitComponent() {
    this._onKeyDown = (e) => this.onKeyDown(e);
    this._onKeyUp = (e) => this.onKeyUp(e);

    document.addEventListener('keydown', this._onKeyDown, false);
    document.addEventListener('keyup', this._onKeyUp, false);
  }

  onKeyDown(event) {
    switch (event.keyCode) {
      case 87: this.keys.forward = true; break;  // W
      case 83: this.keys.backward = true; break; // S
      case 65: this.keys.left = true; break;     // A
      case 68: this.keys.right = true; break;    // D
      case 32: // Space
        if (this.canJump) {
          this.Jump();
        }
        break;
    }
  }

  onKeyUp(event) {
    switch (event.keyCode) {
      case 87: this.keys.forward = false; break;
      case 83: this.keys.backward = false; break;
      case 65: this.keys.left = false; break;
      case 68: this.keys.right = false; break;
      case 32: this.keys.space = false; break;
    }
  }

  Jump() {
    if (this.canJump && this.rigidBody) {
      const jumpImpulse = new Ammo.btVector3(0, this.jumpForce, 0);
      this.rigidBody.body_.activate(true);
      this.rigidBody.body_.applyCentralImpulse(jumpImpulse);
      Ammo.destroy(jumpImpulse);
      this.canJump = false;
    }
  }

  CheckGroundContact() {
    if (!this.rigidBody) return false;

    const velocity = this.rigidBody.body_.getLinearVelocity();
    const yVel = velocity.y();
    const position = this.Parent.Position;

    if (position.y <= this.radius + 0.12 && Math.abs(yVel) < 0.6) {
      this.canJump = true;
      return true;
    }

    this.canJump = false;
    return false;
  }

  Update(timeElapsed) {
    if (!this.rigidBody) return;

    this.CheckGroundContact();

    const cameraEntity = this.FindEntity('camera');
    if (!cameraEntity) return;
    const cameraComponent = cameraEntity.GetComponent('ThirdPersonCamera');
    if (!cameraComponent) return;

    const cameraYaw = cameraComponent.Yaw;
    const moveDir = new THREE.Vector3(0, 0, 0);

    // Rotation from camera yaw
    const cameraRotation = new THREE.Quaternion();
    cameraRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);

    const cameraForward = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraRotation);
    const cameraRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(cameraRotation);

    cameraForward.y = 0;
    cameraRight.y = 0;
    cameraForward.normalize();
    cameraRight.normalize();

    if (this.keys.forward) moveDir.add(cameraForward);
    if (this.keys.backward) moveDir.sub(cameraForward);
    if (this.keys.left) moveDir.sub(cameraRight);
    if (this.keys.right) moveDir.add(cameraRight);

    const lv = this.rigidBody.body_.getLinearVelocity();
    let newVel;

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const desiredVel = moveDir.multiplyScalar(this.moveSpeed);
      newVel = new Ammo.btVector3(desiredVel.x, lv.y(), desiredVel.z);

      // Smoothly rotate sphere to face movement direction
      const targetQuat = new THREE.Quaternion();
      const forward = new THREE.Vector3(0, 0, 1); // sphere's local forward
      targetQuat.setFromUnitVectors(forward, new THREE.Vector3(desiredVel.x, 0, desiredVel.z).normalize());

      this.mesh.quaternion.slerp(targetQuat, this.rotationSpeed * timeElapsed);
    } else {
      newVel = new Ammo.btVector3(0, lv.y(), 0);
    }

    this.rigidBody.body_.activate(true);
    this.rigidBody.body_.setLinearVelocity(newVel);
    Ammo.destroy(newVel);

    // Sync position from physics
    const transform = this.rigidBody.body_.getWorldTransform();
    const origin = transform.getOrigin();
    this.mesh.position.set(origin.x(), origin.y(), origin.z());
  }
    GetGridPosition() {
    const gridEntity = this.FindEntity('grid');
    if (gridEntity) {
      const gridComponent = gridEntity.GetComponent('GridGenerator');
      if (gridComponent) {
        return gridComponent.GetGridCell(this.Parent.Position);
      }
    }
    return null;
  }


  Destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);

    if (this.mesh && this.params.scene) {
      this.params.scene.remove(this.mesh);
    }
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}
