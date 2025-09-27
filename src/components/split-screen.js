// split-screen.js
import * as THREE from 'three';
import { entity } from './entity.js';

export class SplitScreenRenderer extends entity.Component {
  static CLASS_NAME = 'SplitScreenRenderer';
  get NAME() { return SplitScreenRenderer.CLASS_NAME; }

  constructor(params) {
    super();
    this.params = params;
    this.renderer = params.renderer;
    this.scene = params.scene;
    this.mainCamera = params.mainCamera;
    this.playerEntity = params.playerEntity;

    // Create top-down orthographic camera
    this.topDownCamera = new THREE.OrthographicCamera(
      -100, 100, 100, -100, 0.1, 1000
    );
    this.topDownCamera.position.set(0, 200, 0);
    this.topDownCamera.lookAt(0, 0, 0);
  }

  Update(_) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // --- Left side: normal gameplay camera
    this.renderer.setViewport(0, 0, w / 2, h);
    this.renderer.setScissor(0, 0, w / 2, h);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.mainCamera);

    // --- Right side: top-down camera
    if (this.playerEntity) {
      const playerPos = this.playerEntity.Position;
      this.topDownCamera.position.set(playerPos.x, 200, playerPos.z);
      this.topDownCamera.lookAt(playerPos.x, 0, playerPos.z);
    }

    this.renderer.setViewport(w / 2, 0, w / 2, h);
    this.renderer.setScissor(w / 2, 0, w / 2, h);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.topDownCamera);
  }
}
