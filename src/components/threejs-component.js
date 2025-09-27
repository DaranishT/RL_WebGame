import * as THREE from 'three';
import { entity } from './entity.js';

export class ThreeJSController extends entity.Component {
  static CLASS_NAME = 'ThreeJSController';

  get NAME() {
    return ThreeJSController.CLASS_NAME;
  }

  constructor() {
    super();
    this.initialized = false;
  }

  InitEntity() {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('container').appendChild(this.renderer.domElement);

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa0a0a0);
    this.scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(0, 5, -10);

    // Add some basic lighting immediately
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    this.scene.add(directionalLight);

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize(), false);
    
    this.initialized = true;
    console.log("ThreeJSController initialized");
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  Update(timeElapsed) {
    if (!this.initialized) return;
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }
}
