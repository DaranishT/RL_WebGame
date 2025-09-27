// enemy-bot.js
import * as THREE from 'three';
import { entity } from './entity.js';
import { AmmoJSController } from './ammojs-component.js';
import { EnemyFSM, EnemyStates } from '../entities/enemy-fsm.js';

export class EnemyBot extends entity.Component {
    static CLASS_NAME = 'EnemyBot';

    get NAME() {
        return EnemyBot.CLASS_NAME;
    }

    constructor(params) {
        super();
        this.params = params;
        this.speed = params.speed || 2;
        this.target = params.target || null;
        this.spawnPosition = params.spawnPosition || new THREE.Vector3(0, 0, 0);
        this.mesh = null;
        this.body = null;
        this.fsm = new EnemyFSM(this, { 
            target: this.target, 
            speed: this.speed,
            spawnPosition: this.spawnPosition
        });
    }

    InitComponent() {}

    InitEntity() {
        // Visual representation
        const geometry = new THREE.SphereGeometry(1, 16, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.params.scene.add(this.mesh);
    }

    PostInitializeComponent() {
        const physicsEntity = this.FindEntity('physics');
        if (!physicsEntity) {
            console.error("Physics not found for EnemyBot");
            return;
        }
        this.physics = physicsEntity.GetComponent(AmmoJSController.CLASS_NAME);

        // Use the provided spawn position
        const pos = this.spawnPosition;
        const quat = new THREE.Quaternion();
        const mass = 1;
        this.body = this.physics.CreateSphere(pos, quat, 1, mass, { entity: this.Parent });

        // Start FSM in IDLE
        this.fsm.setState(EnemyStates.IDLE);
    }

    Update(timeElapsedS) {
        if (!this.mesh || !this.Parent || !this.body) return;

        // Run FSM
        this.fsm.update(timeElapsedS);
    
        // Sync visual mesh with physics body
        const transform = this.body.body_.getWorldTransform();
        const origin = transform.getOrigin();
        this.mesh.position.set(origin.x(), origin.y(), origin.z());

        // Update the entity's position from the physics body's position
        this.Parent.SetPosition(this.mesh.position);
    }
}