import * as THREE from 'three';
import { entity } from './entity.js';

// Helper flags
const flags = {
    CF_STATIC_OBJECT: 1,
    CF_KINEMATIC_OBJECT: 2,
    CF_NO_CONTACT_RESPONSE: 4,
    CF_CUSTOM_MATERIAL_CALLBACK: 8,
    CF_CHARACTER_OBJECT: 16
};

const GRAVITY = 75;

class AmmoJSKinematicCharacterController {
    constructor() {}
    Destroy() {}
    Init(pos, quat, userData) {
        const radius = 1;
        const height = 3;

        this.transform_ = new Ammo.btTransform();
        this.transform_.setIdentity();
        this.transform_.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        this.transform_.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));

        this.shape_ = new Ammo.btCapsuleShape(radius, height);
        this.shape_.setMargin(0.05);

        this.body_ = new Ammo.btPairCachingGhostObject();
        this.body_.setWorldTransform(this.transform_);
        this.body_.setCollisionShape(this.shape_);
        this.body_.setCollisionFlags(flags.CF_CHARACTER_OBJECT);
        this.body_.activate(true);

        this.controller_ = new Ammo.btKinematicCharacterController(this.body_, this.shape_, 0.35, 1);
        this.controller_.setUseGhostSweepTest(true);
        this.controller_.setUpInterpolate();
        this.controller_.setGravity(GRAVITY);
        this.controller_.setMaxSlope(Math.PI / 3);
        this.controller_.canJump(true);
        this.controller_.setJumpSpeed(GRAVITY/3);
        this.controller_.setMaxJumpHeight(100);

        this.userData_ = new Ammo.btVector3(0, 0, 0);
        this.userData_.userData = userData;
        this.body_.setUserPointer(this.userData_);

        this.tmpVec3_ = new Ammo.btVector3(0, 0, 0);
    }

    setJumpMultiplier(multiplier) {
        this.controller_.setJumpSpeed(multiplier * GRAVITY / 3);
    }

    setWalkDirection(walk) {
        this.tmpVec3_.setValue(walk.x, walk.y, walk.z);
        this.controller_.setWalkDirection(this.tmpVec3_);
    }

    onGround() {
        return this.controller_.onGround();
    }

    jump() {
        if (this.controller_.onGround()) {
            this.controller_.jump();
        }
    }
}

class AmmoJSRigidBody {
    constructor() {}
    Destroy() {
        // Clean up in reverse order of allocation (guard for nulls)
        try { if (this.body_) Ammo.destroy(this.body_); } catch (e) {}
        try { if (this.info_) Ammo.destroy(this.info_); } catch (e) {}
        try { if (this.shape_) Ammo.destroy(this.shape_); } catch (e) {}
        try { if (this.inertia_) Ammo.destroy(this.inertia_); } catch (e) {}
        try { if (this.motionState_) Ammo.destroy(this.motionState_); } catch (e) {}
        try { if (this.transform_) Ammo.destroy(this.transform_); } catch (e) {}
        try { if (this.userData_) Ammo.destroy(this.userData_); } catch (e) {}

        if (this.mesh_) {
            // mesh_ here refers to btTriangleMesh only for mesh shapes; it must be destroyed carefully
            try { Ammo.destroy(this.mesh_); } catch (e) {}
        }
    }

    InitBox(pos, quat, size, mass, userData) {
        const transform = new Ammo.btTransform();
        transform.setIdentity();
        transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));

        const motionState = new Ammo.btDefaultMotionState(transform);

        const btSize = new Ammo.btVector3(size.x * 0.5, size.y * 0.5, size.z * 0.5);
        this.shape_ = new Ammo.btBoxShape(btSize);
        this.shape_.setMargin(0.01);

        this.inertia_ = new Ammo.btVector3(0, 0, 0);
        if (mass > 0) {
            this.shape_.calculateLocalInertia(mass, this.inertia_);
        }

        this.info_ = new Ammo.btRigidBodyConstructionInfo(mass, motionState, this.shape_, this.inertia_);
        this.body_ = new Ammo.btRigidBody(this.info_);

        // Set proper collision properties
        this.body_.setFriction(0.8);
        this.body_.setRestitution(0.1);
        this.body_.setDamping(0.1, 0.1);

        const ud = new Ammo.btVector3(0, 0, 0);
        ud.userData = userData;
        this.body_.setUserPointer(ud);

        // keep references for clean up
        this.transform_ = transform;
        this.motionState_ = motionState;
        // keep btSize and others as temporary (they can be destroyed)
        Ammo.destroy(btSize);
    }

    InitSphere(pos, quat, radius, mass, userData) {
        // Keep transform / motionState references so Bullet can safely use them and so we can destroy later
        this.transform_ = new Ammo.btTransform();
        this.transform_.setIdentity();
        this.transform_.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
        this.transform_.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));

        this.motionState_ = new Ammo.btDefaultMotionState(this.transform_);

        this.shape_ = new Ammo.btSphereShape(radius);
        this.shape_.setMargin(0.01);

        this.inertia_ = new Ammo.btVector3(0, 0, 0);
        if (mass > 0) {
            this.shape_.calculateLocalInertia(mass, this.inertia_);
        }

        this.info_ = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState_, this.shape_, this.inertia_);
        this.body_ = new Ammo.btRigidBody(this.info_);

        // Set physical properties for sphere
        this.body_.setFriction(0.6);
        this.body_.setRestitution(0.2);
        this.body_.setDamping(0.05, 0.1);
        this.body_.setRollingFriction(0.1);

        // Prevent sleeping so player input is not ignored
        // 4 is DISABLE_DEACTIVATION in Bullet; numeric used to be robust in different Ammo builds.
        try { this.body_.setActivationState(4); } catch (e) {}

        this.userData_ = new Ammo.btVector3(0, 0, 0);
        this.userData_.userData = userData;
        this.body_.setUserPointer(this.userData_);
    }

    InitMesh(src, pos, quat, mass, userData) {
        const A0 = new Ammo.btVector3(0, 0, 0);
        const A1 = new Ammo.btVector3(0, 0, 0);
        const A2 = new Ammo.btVector3(0, 0, 0);

        const V0 = new THREE.Vector3();
        const V1 = new THREE.Vector3();
        const V2 = new THREE.Vector3();

        this.mesh_ = new Ammo.btTriangleMesh(true, true);

        src.traverse(c => {
            c.updateMatrixWorld(true);
            if (c.geometry) {
                const p = c.geometry.attributes.position.array;
                for (let i = 0; i < c.geometry.index.count; i+=3) {
                    const i0 = c.geometry.index.array[i] * 3;
                    const i1 = c.geometry.index.array[i+1] * 3;
                    const i2 = c.geometry.index.array[i+2] * 3;

                    V0.fromArray(p, i0).applyMatrix4(c.matrixWorld);
                    V1.fromArray(p, i1).applyMatrix4(c.matrixWorld);
                    V2.fromArray(p, i2).applyMatrix4(c.matrixWorld);

                    A0.setX(V0.x);
                    A0.setY(V0.y);
                    A0.setZ(V0.z);
                    A1.setX(V1.x);
                    A1.setY(V1.y);
                    A1.setZ(V1.z);
                    A2.setX(V2.x);
                    A2.setY(V2.y);
                    A2.setZ(V2.z);
                    this.mesh_.addTriangle(A0, A1, A2, false);
                }
            }
        });

        this.inertia_ = new Ammo.btVector3(0, 0, 0);
        this.shape_ = new Ammo.btBvhTriangleMeshShape(this.mesh_, true, true);
        this.shape_.setMargin(0.05);
        this.shape_.calculateLocalInertia(mass, this.inertia_);

        this.transform_ = new Ammo.btTransform();
        this.transform_.setIdentity();
        this.transform_.getOrigin().setValue(pos.x, pos.y, pos.z);
        this.transform_.getRotation().setValue(quat.x, quat.y, quat.z, quat.w);
        this.motionState_ = new Ammo.btDefaultMotionState(this.transform_);

        this.info_ = new Ammo.btRigidBodyConstructionInfo(mass, this.motionState_, this.shape_, this.inertia_);
        this.body_ = new Ammo.btRigidBody(this.info_);

        this.userData_ = new Ammo.btVector3(0, 0, 0);
        this.userData_.userData = userData;
        this.body_.setUserPointer(this.userData_);
    }
}

export class AmmoJSController extends entity.Component {
    static CLASS_NAME = 'AmmoJSController';

    get NAME() {
        return AmmoJSController.CLASS_NAME;
    }

    constructor() {
        super();
        this.initialized_ = false;
        this.tmpVec3_ = new Ammo.btVector3();
        this.rigidBodies_ = [];
    }

    Destroy() {
        // Destroy whole physics world & solver objects
        try { Ammo.destroy(this.physicsWorld_); } catch (e) {}
        try { Ammo.destroy(this.solver_); } catch (e) {}
        try { Ammo.destroy(this.broadphase_); } catch (e) {}
        try { Ammo.destroy(this.dispatcher_); } catch (e) {}
        try { Ammo.destroy(this.collisionConfiguration_); } catch (e) {}
    }

    InitEntity() {
        this.collisionConfiguration_ = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher_ = new Ammo.btCollisionDispatcher(this.collisionConfiguration_);
        this.broadphase_ = new Ammo.btDbvtBroadphase();
        this.solver_ = new Ammo.btSequentialImpulseConstraintSolver();
        this.physicsWorld_ = new Ammo.btDiscreteDynamicsWorld(
            this.dispatcher_, this.broadphase_, this.solver_, this.collisionConfiguration_);
        this.physicsWorld_.setGravity(new Ammo.btVector3(0, -9.81, 0));

        this.transformAux_ = new Ammo.btTransform();
        this.tmpVec3_ = new Ammo.btVector3();

        this.rigidBodies_ = [];
        this.kinematicControllers_ = [];

        console.log("AmmoJSController initialized with physics world.");
        this.initialized_ = true;
    }

    CreateKinematicCharacterController(pos, quat, userData) {
        const controller = new AmmoJSKinematicCharacterController();
        controller.Init(pos, quat, userData);

        this.physicsWorld_.addCollisionObject(controller.body_);
        this.physicsWorld_.addAction(controller.controller_);

        const broadphase = this.physicsWorld_.getBroadphase();
        const paircache = broadphase.getOverlappingPairCache();
        paircache.setInternalGhostPairCallback(new Ammo.btGhostPairCallback());

        this.kinematicControllers_.push(controller);

        return controller;
    }

    CreateSphere(pos, quat, radius, mass, userData) {
        const sphere = new AmmoJSRigidBody();
        sphere.InitSphere(pos, quat, radius, mass, userData);
        this.physicsWorld_.addRigidBody(sphere.body_);
        this.rigidBodies_.push(sphere);
        return sphere;
    }

    CreateBox(pos, quat, size, mass, userData) {
        const box = new AmmoJSRigidBody();

        box.InitBox(pos, quat, size, mass, userData);

        this.physicsWorld_.addRigidBody(box.body_);

        // For static objects, set mass to 0
        if (mass === 0) {
            const shape = box.body_.getCollisionShape();
            const inertia = new Ammo.btVector3(0, 0, 0);
            shape.calculateLocalInertia(0, inertia);
            box.body_.setMassProps(0, inertia);
            box.body_.setFriction(0.8);
            box.body_.setRestitution(0.1);
        }

        this.rigidBodies_.push(box);
        return box;
    }

    Update(timeElapsedS) {
        if (!this.initialized_) {
            return;
        }
        
        // Step the world
        this.physicsWorld_.stepSimulation(timeElapsedS, 10);

        // Sync rigid bodies -> entities (with safety checks)
        for (let i = 0; i < this.rigidBodies_.length; ++i) {
            const bodyWrapper = this.rigidBodies_[i];
            
            // Add safety checks to prevent memory access errors
            try {
                // Check if the body wrapper and its internal body still exist
                if (!bodyWrapper || !bodyWrapper.body_) {
                    console.warn("Invalid rigid body found, removing from list");
                    this.rigidBodies_.splice(i, 1);
                    i--;
                    continue;
                }
                
                // Check if motion state exists and is valid
                const motionState = bodyWrapper.body_.getMotionState();
                if (!motionState) {
                    console.warn("Rigid body has no motion state, removing from list");
                    this.rigidBodies_.splice(i, 1);
                    i--;
                    continue;
                }
                
                // Safely get the world transform
                motionState.getWorldTransform(this.transformAux_);
                const p = this.transformAux_.getOrigin();
                const q = this.transformAux_.getRotation();
                
                // Safely get user data with error handling
                let userData = null;
                try {
                    const userPointer = bodyWrapper.body_.getUserPointer();
                    if (userPointer) {
                        userData = Ammo.castObject(userPointer, Ammo.btVector3).userData;
                    }
                } catch (e) {
                    console.warn("Error accessing user pointer:", e);
                    // Remove invalid body from list
                    this.rigidBodies_.splice(i, 1);
                    i--;
                    continue;
                }

                if (userData && userData.entity) {
                    userData.entity.SetPosition(new THREE.Vector3(p.x(), p.y(), p.z()));
                    userData.entity.SetQuaternion(new THREE.Quaternion(q.x(), q.y(), q.z(), q.w()));
                }
            } catch (e) {
                console.warn("Error processing rigid body, removing from list:", e);
                // Remove invalid body from list
                this.rigidBodies_.splice(i, 1);
                i--;
            }
        }

        // Sync kinematic controllers -> entities (with safety checks)
        for (let i = 0; i < this.kinematicControllers_.length; ++i) {
            const controller = this.kinematicControllers_[i];
            
            // Add safety checks to prevent memory access errors
            try {
                // Check if the controller and its body still exist
                if (!controller || !controller.body_) {
                    console.warn("Invalid kinematic controller found, removing from list");
                    this.kinematicControllers_.splice(i, 1);
                    i--;
                    continue;
                }
                
                // Safely get the world transform
                const transform = controller.body_.getWorldTransform();
                const p = transform.getOrigin();
                const q = transform.getRotation();
                
                // Safely get user data with error handling
                let userData = null;
                try {
                    const userPointer = controller.body_.getUserPointer();
                    if (userPointer) {
                        userData = Ammo.castObject(userPointer, Ammo.btVector3).userData;
                    }
                } catch (e) {
                    console.warn("Error accessing user pointer:", e);
                    // Remove invalid controller from list
                    this.kinematicControllers_.splice(i, 1);
                    i--;
                    continue;
                }

                if (userData && userData.entity) {
                    userData.entity.SetPosition(new THREE.Vector3(p.x(), p.y(), p.z()));
                    userData.entity.SetQuaternion(new THREE.Quaternion(q.x(), q.y(), q.z(), q.w()));
                }
            } catch (e) {
                console.warn("Error processing kinematic controller, removing from list:", e);
                // Remove invalid controller from list
                this.kinematicControllers_.splice(i, 1);
                i--;
            }
        }
    }
}