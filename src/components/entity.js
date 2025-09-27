import * as THREE from 'three';

export const entity = (() => {

    class Entity {
        constructor() {
            this.name_ = null;
            this.id_ = null;
            this.components_ = {};
            this.attributes_ = {};

            this._position = new THREE.Vector3();
            this._rotation = new THREE.Quaternion();
            this.handlers_ = {};
            this.parent_ = null;
            this.dead_ = false;
        }

        Destroy() {
            for (let k in this.components_) {
                this.components_[k].Destroy();
            }
            this.components_ = null;
            this.parent_ = null;
            this.handlers_ = null;
        }

        RegisterHandler_(n, h) {
            if (!(n in this.handlers_)) {
                this.handlers_[n] = [];
            }
            this.handlers_[n].push(h);
        }

        SetParent(p) {
            this.parent_ = p;
        }

        SetName(n) {
            this.name_ = n;
        }

        SetId(id) {
            this.id_ = id;
        }

        get Name() {
            return this.name_;
        }

        get ID() {
            return this.id_;
        }

        get Manager() {
            return this.parent_;
        }

        get Attributes() {
            return this.attributes_;
        }

        get IsDead() {
            return this.dead_;
        }

        AddComponent(c) {
            c.SetParent(this);
            this.components_[c.NAME] = c;

            // This should be called after a component is added.
            c.InitComponent();
        }

        PostInitialize() {
            for (let k in this.components_) {
                const component = this.components_[k];
                if (component.PostInitializeComponent) {
                    component.PostInitializeComponent();
                }
            }
        }

        InitEntity() {
            for (let k in this.components_) {
                this.components_[k].InitEntity();
            }
        }

        GetComponent(n) {
            return this.components_[n];
        }

        FindEntity(n) {
            return this.parent_.Get(n);
        }

Broadcast(msg) {
  if (this.IsDead) {
    return;
  }
  // Add null check for handlers_
  if (!this.handlers_ || !(msg.topic in this.handlers_)) {
    return;
  }

  for (let curHandler of this.handlers_[msg.topic]) {
    curHandler(msg);
  }
}

        SetPosition(p) {
            this._position.copy(p);
            this.Broadcast({
                topic: 'update.position',
                value: this._position,
            });
        }

        SetQuaternion(r) {
            this._rotation.copy(r);
            this.Broadcast({
                topic: 'update.rotation',
                value: this._rotation,
            });
        }

        get Position() {
            return this._position;
        }

        get Quaternion() {
            return this._rotation;
        }

        Update(timeElapsed) {
            for (let k in this.components_) {
                this.components_[k].Update(timeElapsed);
            }
        }
    }

    class Component {
        get NAME() {
            console.error('Unnamed Component: ' + this.constructor.name);
            return '__UNNAMED__';
        }

        constructor() {
            this.parent_ = null;
        }

        Destroy() {
        }

        SetParent(p) {
            this.parent_ = p;
        }

        get Parent() {
            return this.parent_;
        }

        InitComponent() {}

        InitEntity() {}

        GetComponent(n) {
            return this.parent_.GetComponent(n);
        }

        get Manager() {
            return this.parent_.Manager;
        }

        FindEntity(n) {
            return this.parent_.FindEntity(n);
        }

        Broadcast(m) {
            this.parent_.Broadcast(m);
        }

        Update(_) {}
    }

    return {
        Entity: Entity,
        Component: Component,
    };
})();
