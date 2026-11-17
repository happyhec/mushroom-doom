import * as THREE from 'three';
import { createEnemyModel } from './actors.js';

const TYPES = ['goomba', 'koopa', 'boo', 'bowser'];
const DIRECTIONS = 8;
const WIDTH = 96;
const HEIGHT = 128;
const TAU = Math.PI * 2;

/**
 * Bake the original sculpted enemies into eight-direction DOS-style sprites.
 * The temporary WebGL context is released after capture; gameplay uses only
 * ordinary nearest-filtered CanvasTextures and one draw per living enemy.
 */
export function createRetroSprites() {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const hemisphere = new THREE.HemisphereLight(0xffe8bc, 0x465039, 2.1);
  const key = new THREE.DirectionalLight(0xffdfab, 2.4);
  scene.add(hemisphere, key, key.target);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 30);
  const cache = new Map();
  let model;

  try {
    for (const type of TYPES) {
      model = createEnemyModel(type);
      scene.add(model);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const height = bounds.max.y - bounds.min.y;
      const centerY = (bounds.max.y + bounds.min.y) / 2;
      // Fit every angle, including Bowser's tail and broad arm silhouette.
      const radialWidth = Math.hypot(
        Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
        Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
      ) * 2;
      const frameHeight = Math.max(height, radialWidth / (WIDTH / HEIGHT)) * 1.06;
      const frameWidth = frameHeight * WIDTH / HEIGHT;
      camera.left = -frameWidth / 2;
      camera.right = frameWidth / 2;
      camera.top = frameHeight / 2;
      camera.bottom = -frameHeight / 2;
      camera.updateProjectionMatrix();

      const frames = [];
      for (let index = 0; index < DIRECTIONS; index++) {
        const angle = index / DIRECTIONS * TAU;
        const side = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
        const outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
        camera.position.copy(outward).multiplyScalar(12);
        camera.position.y = centerY;
        camera.lookAt(0, centerY, 0);
        // Keep the light over the same screen shoulder for readable sprites.
        key.position.copy(outward).multiplyScalar(7).addScaledVector(side, -4);
        key.position.y = centerY + 7;
        key.target.position.set(0, centerY, 0);
        renderer.render(scene, camera);

        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Retro sprite capture requires a 2D canvas.');
        context.imageSmoothingEnabled = false;
        context.drawImage(renderer.domElement, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        frames.push(texture);
      }
      cache.set(type, { frames, frameWidth, frameHeight, centerY, height });
      scene.remove(model);
      // Actors share materials with the live scene. Dispose only baked geometry.
      model.traverse(child => { if (child.isMesh) child.geometry.dispose(); });
      model = null;
    }
  } catch (error) {
    for (const entry of cache.values()) entry.frames.forEach(texture => texture.dispose());
    throw error;
  } finally {
    if (model) model.traverse(child => { if (child.isMesh) child.geometry.dispose(); });
    renderer.dispose();
    renderer.forceContextLoss();
  }

  const cameraPosition = new THREE.Vector3();
  const modelPosition = new THREE.Vector3();
  const modelScale = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const sprites = new Set();

  function create(type) {
    const entry = cache.get(type) || cache.get('goomba');
    const material = new THREE.SpriteMaterial({
      map: entry.frames[0],
      color: 0xffffff,
      alphaTest: .45,
      transparent: true,
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
      fog: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(entry.frameWidth, entry.frameHeight, 1);
    sprite.position.y = entry.centerY;
    sprite.userData.retroType = cache.has(type) ? type : 'goomba';
    sprite.userData.frameWidth = entry.frameWidth;
    sprite.userData.frameHeight = entry.frameHeight;
    sprite.userData.frameIndex = 0;
    sprite.frustumCulled = false;
    sprites.add(sprite);
    return sprite;
  }

  function update(sprite, type, model, viewCamera, time = 0) {
    const entry = cache.get(type) || cache.get('goomba');
    viewCamera.getWorldPosition(cameraPosition);
    model.getWorldPosition(modelPosition);
    model.getWorldScale(modelScale);
    model.getWorldDirection(facing);
    const yaw = Math.atan2(facing.x, facing.z);
    const viewAngle = Math.atan2(cameraPosition.x - modelPosition.x, cameraPosition.z - modelPosition.z);
    const relative = ((viewAngle - yaw) % TAU + TAU) % TAU;
    const index = Math.round(relative / TAU * DIRECTIONS) % DIRECTIONS;
    if (sprite.userData.frameIndex !== index) {
      sprite.material.map = entry.frames[index];
      sprite.userData.frameIndex = index;
    }
    // Mirroring the outer scale also follows the existing death squash.
    sprite.scale.set(entry.frameWidth * modelScale.x, entry.frameHeight * modelScale.y, 1);
    sprite.position.copy(modelPosition);
    const bodyBob = model.userData.body?.position.y || 0;
    sprite.position.y += (entry.centerY + bodyBob) * modelScale.y;
  }

  return {
    create,
    update,
    frameCount: TYPES.length * DIRECTIONS,
    textureSize: { width: WIDTH, height: HEIGHT },
    release(sprite) {
      sprite.removeFromParent();
      sprite.material.dispose();
      sprites.delete(sprite);
    },
    dispose() {
      for (const sprite of sprites) {
        sprite.removeFromParent();
        sprite.material.dispose();
      }
      sprites.clear();
      for (const entry of cache.values()) entry.frames.forEach(texture => texture.dispose());
      cache.clear();
    },
  };
}
