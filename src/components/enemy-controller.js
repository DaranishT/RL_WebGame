import * as THREE from 'three';
import { entity } from './entity.js';
import { AmmoJSController } from './ammojs-component.js';
import { math } from '../math.js';

class PatrolState {
    constructor() {
        this.name = 'Patrol';
        this.nextDirectionTimer = 0;
        this.nextDirectionInterval = 5;
    }

    Update(parent, timeElapsed) {
        this.nextDirectionTimer += timeElapsed;
        if (this.nextDirectionTimer >= this.nextDirectionInterval) {
            parent.SetRandomMoveDirection();
            this.nextDirectionTimer = 0;
        }
    }
}

export class EnemyController extends entity.Component {
    static CLASS_NAME = 'EnemyController';

    get NAME() {
        return EnemyController.CLASS_NAME;
    }

    constructor(params) {
        super();
        this.params = params;
        this.radius = 1;
        this.moveSpeed = 10;
        this.currentState = new PatrolState();
        this.moveDirection = new THREE.Vector3();
    }

    InitEntity() {
        // Create the visual mesh for the enemy sphere
        this.geometry = new THREE.SphereGeometry(this.radius, 32, 32);
        this.material = new THREE.MeshPhongMaterial({
            color: 0xaa4444, // Red color for the enemy
            shininess: 100
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        this.params.scene.add(this.mesh);

        // Set the initial position of the enemy sphere
        this.Parent.SetPosition(new THREE.Vector3(10, this.radius, 10));
        this.Parent.SetQuaternion(new THREE.Quaternion());
    }

    PostInitializeComponent() {
        const physics = this.FindEntity('physics');
        if (!physics) {
            console.error("Physics controller not found. Cannot create enemy rigid body.");
            return;
        }
        this.physics = physics.GetComponent(AmmoJSController.CLASS_NAME);

        // Get the current position
        const pos = this.Parent.Position;
        const quat = this.Parent.Quaternion;
        const mass = 50;
        const userData = { entity: this.Parent, mesh: this.mesh };

        // Create the sphere rigid body for the enemy
        this.rigidBody = this.physics.CreateSphere(pos, quat, this.radius, mass, userData);

        // Set physics properties
        this.rigidBody.body_.setFriction(0.5);
        this.rigidBody.body_.setRestitution(0.2);
        this.rigidBody.body_.setDamping(0.2, 0.1);
        this.rigidBody.body_.activate(true);

        this.SetRandomMoveDirection();
        
        console.log("EnemyController initialized with physics body at position:", pos);
    }

    SetRandomMoveDirection() {
        this.moveDirection.set(
            math.rand_range(-1, 1),
            0,
            math.rand_range(-1, 1)
        ).normalize();
    }
    
    Update(timeElapsed) {
        if (!this.rigidBody) {
            return;
        }

        this.currentState.Update(this, timeElapsed);
        
        const force = new Ammo.btVector3(
            this.moveDirection.x * this.moveSpeed,
            0,
            this.moveDirection.z * this.moveSpeed
        );

        this.rigidBody.body_.applyCentralForce(force);
        Ammo.destroy(force);
    }

    Destroy() {
        if (this.mesh && this.params.scene) {
            this.params.scene.remove(this.mesh);
        }
        
        if (this.geometry) {
            this.geometry.dispose();
        }
        
        if (this.material) {
            this.material.dispose();
        }
    }
}
