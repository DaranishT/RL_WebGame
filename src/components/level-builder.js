// level-builder.js
import * as THREE from 'three';
import { entity } from './entity.js';

export class LevelBuilder extends entity.Component {
  static CLASS_NAME = 'LevelBuilder';
  get NAME() { return LevelBuilder.CLASS_NAME; }

  constructor(params) {
    super();
    this.params = params;
  }

  PostInitializeComponent() {
    this._CreateSky();
    console.log("Lighting and sky created.");
  }

  _CreateSky() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.params.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.params.scene.add(directionalLight);

    // Add a skybox/fog for better visuals
    this.params.scene.background = new THREE.Color(0xa0a0a0);
    this.params.scene.fog = new THREE.Fog(0xa0a0a0, 10, 200);
  }

  Update(_) {}
}
