import * as THREE from 'three';
import { loadHillClimbTextures, HillClimbTextures } from './textures';
import { createJeep, JeepMesh } from './jeep';
import { buildTerrain, TerrainSystem } from './terrain';
import { HillClimbPhysics } from './hillClimbPhysics';
import { ControlInput, CollectibleItem, HillClimbState, LevelConfig, TimeOfDayLabel } from './types';
import { LEVELS } from './levels';
import { sound } from './audio';

export interface HillClimbEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  physics: HillClimbPhysics;
  jeep: JeepMesh;
  terrain: TerrainSystem;
  coinLogoCleanUrl: string;
  setInput: (input: ControlInput) => void;
  loadLevel: (level: LevelConfig) => void;
  resetGame: () => void;
  dispose: () => void;
}

const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _sunColor = new THREE.Color();

const MORNING_SKY = new THREE.Color(0x56ccf2);
const AFTERNOON_SKY = new THREE.Color(0x0ea5e9);
const SUNSET_SKY = new THREE.Color(0xf97316);
const NIGHT_SKY = new THREE.Color(0x0b1228);

const MORNING_FOG = new THREE.Color(0x93e2fc);
const AFTERNOON_FOG = new THREE.Color(0x7dd3fc);
const SUNSET_FOG = new THREE.Color(0xfdba74);
const NIGHT_FOG = new THREE.Color(0x162244);

export async function createHillClimbEngine(
  container: HTMLElement,
  initialLevel: LevelConfig,
  onCoinCollected: (item: CollectibleItem) => void,
  onFuelCollected: (item: CollectibleItem) => void,
  onStunt: (msg: string, bonus: number) => void,
  onObstacleHit: () => void,
  onStateUpdate: (state: HillClimbState) => void
): Promise<HillClimbEngine> {
  const isSoftwareGl = (() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  })();

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(initialLevel.skyColor);
  scene.fog = new THREE.FogExp2(initialLevel.fogColor, initialLevel.fogDensity);

  const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x166534, 1.15);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
  sunLight.position.set(20, 30, 25);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 120;
  sunLight.shadow.bias = -0.0005;
  const shadowRange = 25;
  sunLight.shadow.camera.left = -shadowRange;
  sunLight.shadow.camera.right = shadowRange;
  sunLight.shadow.camera.top = shadowRange;
  sunLight.shadow.camera.bottom = -shadowRange;
  scene.add(sunLight);

  // --- CELESTIAL SKY SYSTEM (Sun, Moon & Stars following camera X) ---
  const celestialGroup = new THREE.Group();
  scene.add(celestialGroup);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  celestialGroup.add(sunDisc);

  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xf1f5f9 })
  );
  celestialGroup.add(moonDisc);

  const starCount = 220;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 140;
    starPos[i * 3 + 1] = 4 + Math.random() * 45;
    starPos[i * 3 + 2] = -58 - Math.random() * 15;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.45,
    transparent: true,
    opacity: 0,
  });
  const skyStars = new THREE.Points(starGeo, starMat);
  celestialGroup.add(skyStars);

  // --- FINISH CELEBRATION 3D PARTICLES ---
  const celebCount = 90;
  const celebGeo = new THREE.BufferGeometry();
  const celebPos = new Float32Array(celebCount * 3);
  const celebCol = new Float32Array(celebCount * 3);
  const celebVel = new Float32Array(celebCount * 3);
  let celebActive = false;

  for (let i = 0; i < celebCount; i++) {
    celebCol[i * 3] = i % 3 === 0 ? 1 : 0.3;
    celebCol[i * 3 + 1] = i % 2 === 0 ? 0.9 : 0.6;
    celebCol[i * 3 + 2] = i % 3 === 2 ? 1 : 0.4;
  }
  celebGeo.setAttribute('position', new THREE.BufferAttribute(celebPos, 3));
  celebGeo.setAttribute('color', new THREE.BufferAttribute(celebCol, 3));

  const celebMat = new THREE.PointsMaterial({
    size: 0.42,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
  });
  const celebrationParticles = new THREE.Points(celebGeo, celebMat);
  celebrationParticles.visible = false;
  scene.add(celebrationParticles);

  const triggerCelebrationBurst = (x: number, y: number) => {
    celebActive = true;
    celebrationParticles.visible = true;
    for (let i = 0; i < celebCount; i++) {
      celebPos[i * 3] = x + (Math.random() - 0.5) * 2;
      celebPos[i * 3 + 1] = y + 1.5;
      celebPos[i * 3 + 2] = (Math.random() - 0.5) * 2;

      celebVel[i * 3] = (Math.random() - 0.5) * 14;
      celebVel[i * 3 + 1] = 6 + Math.random() * 12;
      celebVel[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    celebGeo.attributes.position.needsUpdate = true;
  };

  // 2.5D Side-View Camera
  const isPortrait = height > width;
  const camera = new THREE.PerspectiveCamera(isPortrait ? 54 : 46, width / height, 0.1, 500);
  camera.position.set(isPortrait ? 1.5 : 2.4, 2.5, isPortrait ? 18.5 : 13.5);

  const textures: HillClimbTextures = await loadHillClimbTextures(renderer);

  let activeLevel = initialLevel || LEVELS[0];
  let terrain: TerrainSystem = buildTerrain(textures, activeLevel);
  scene.add(terrain.group);

  const jeep: JeepMesh = createJeep(textures);
  scene.add(jeep.group);

  const physics = new HillClimbPhysics();
  const countLevelCoins = (t: TerrainSystem) => t.items.filter((i) => i.type === 'coin').length;
  physics.reset(activeLevel, countLevelCoins(terrain));

  const currentInput: ControlInput = { gas: false, brake: false };
  let dayPhase = activeLevel.initialDayPhase;
  let celebrationFiredForRun = false;

  const updateDayNightCycle = (delta: number) => {
    dayPhase = (dayPhase + delta * activeLevel.dayCycleSpeed) % 1.0;

    let timeLabel: TimeOfDayLabel = 'Morning';
    let nightStrength = 0;

    if (dayPhase < 0.25) {
      // Bright sunny morning -> afternoon
      const t = dayPhase / 0.25;
      _skyColor.copy(MORNING_SKY).lerp(AFTERNOON_SKY, t);
      _fogColor.copy(MORNING_FOG).lerp(AFTERNOON_FOG, t);
      _sunColor.setHex(0xfffbeb);
      sunLight.intensity = THREE.MathUtils.lerp(1.9, 2.3, t);
      hemiLight.intensity = THREE.MathUtils.lerp(1.05, 1.2, t);
      timeLabel = 'Morning';
      nightStrength = 0;
    } else if (dayPhase < 0.5) {
      // Afternoon -> Sunset start
      const t = (dayPhase - 0.25) / 0.25;
      _skyColor.copy(AFTERNOON_SKY).lerp(SUNSET_SKY, t);
      _fogColor.copy(AFTERNOON_FOG).lerp(SUNSET_FOG, t);
      _sunColor.setHex(0xffffff).lerp(new THREE.Color(0xfdba74), t);
      sunLight.intensity = THREE.MathUtils.lerp(2.3, 1.65, t);
      hemiLight.intensity = THREE.MathUtils.lerp(1.2, 0.9, t);
      timeLabel = t > 0.7 ? 'Sunset' : 'Afternoon';
      nightStrength = Math.max(0, (t - 0.75) * 0.8);
    } else if (dayPhase < 0.75) {
      // Orange sunset -> Dark night
      const t = (dayPhase - 0.5) / 0.25;
      _skyColor.copy(SUNSET_SKY).lerp(NIGHT_SKY, t);
      _fogColor.copy(SUNSET_FOG).lerp(NIGHT_FOG, t);
      _sunColor.setHex(0xfb923c).lerp(new THREE.Color(0x93c5fd), t);
      sunLight.intensity = THREE.MathUtils.lerp(1.65, 0.95, t);
      hemiLight.intensity = THREE.MathUtils.lerp(0.9, 0.58, t);
      timeLabel = t > 0.55 ? 'Night' : 'Sunset';
      nightStrength = THREE.MathUtils.smoothstep(t, 0.2, 0.85);
    } else {
      // Dark night with moon & stars -> Morning dawn
      const t = (dayPhase - 0.75) / 0.25;
      _skyColor.copy(NIGHT_SKY).lerp(MORNING_SKY, t * t);
      _fogColor.copy(NIGHT_FOG).lerp(MORNING_FOG, t * t);
      _sunColor.setHex(0x93c5fd).lerp(new THREE.Color(0xfffbeb), t);
      sunLight.intensity = THREE.MathUtils.lerp(0.95, 1.9, t);
      hemiLight.intensity = THREE.MathUtils.lerp(0.58, 1.05, t);
      timeLabel = t > 0.82 ? 'Morning' : 'Night';
      nightStrength = 1 - THREE.MathUtils.smoothstep(t, 0.6, 0.95);
    }

    // Subtle tint blend with level theme for volcano/desert personality
    if (activeLevel.theme === 'volcano') {
      _skyColor.lerp(new THREE.Color(activeLevel.skyColor), 0.35);
      _fogColor.lerp(new THREE.Color(activeLevel.fogColor), 0.35);
    } else if (activeLevel.theme === 'desert') {
      _skyColor.lerp(new THREE.Color(activeLevel.skyColor), 0.2);
    }

    scene.background = _skyColor;
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(_fogColor);
      scene.fog.density = activeLevel.fogDensity;
    }
    sunLight.color.copy(_sunColor);

    // Position sun & moon arcs in distant sky
    const sunAngle = dayPhase * Math.PI * 2;
    sunDisc.position.set(Math.cos(sunAngle) * 35, Math.sin(sunAngle) * 26 + 6, -65);
    sunDisc.visible = sunDisc.position.y > -8;

    moonDisc.position.set(-Math.cos(sunAngle) * 35, -Math.sin(sunAngle) * 26 + 6, -65);
    moonDisc.visible = moonDisc.position.y > -6;

    starMat.opacity = nightStrength * 0.95;
    skyStars.visible = nightStrength > 0.05;

    // Automatically turn on jeep headlights at night/dusk!
    const headlightsOn = nightStrength > 0.3;
    jeep.setHeadlights(nightStrength);
    physics.setAtmosphereInfo(timeLabel, headlightsOn);
  };

  const loadLevel = (newLevel: LevelConfig) => {
    activeLevel = newLevel;
    scene.remove(terrain.group);
    terrain = buildTerrain(textures, activeLevel);
    scene.add(terrain.group);
    dayPhase = activeLevel.initialDayPhase;
    celebrationFiredForRun = false;
    celebActive = false;
    celebrationParticles.visible = false;

    physics.reset(activeLevel, countLevelCoins(terrain));
    updateDayNightCycle(0);

    const portraitMode =
      (container.clientHeight || window.innerHeight) > (container.clientWidth || window.innerWidth);
    camera.position.set(portraitMode ? 1.5 : 2.4, 2.5, portraitMode ? 18.5 : 13.5);
    camera.lookAt(camera.position.x + 0.5, camera.position.y - 0.6, 0);
  };

  const handleResize = () => {
    if (!container) return;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const portrait = h > w;
    camera.fov = portrait ? 54 : 46;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', handleResize);

  const clock = new THREE.Clock();
  let frameId = 0;
  let isDisposed = false;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (isDisposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function tick() {
    if (isDisposed) return;
    const delta = Math.min(0.04, clock.getDelta());

    // 1. Update Day/Night cycle & headlights
    updateDayNightCycle(delta);

    // 2. Physics update
    physics.update(
      delta,
      currentInput,
      terrain.getY,
      terrain.getSlope,
      terrain.obstacles,
      onStunt,
      onObstacleHit
    );

    // Trigger 3D confetti particles once on level completion
    if (physics.state.isLevelComplete && !celebrationFiredForRun) {
      celebrationFiredForRun = true;
      triggerCelebrationBurst(physics.x, physics.y);
    }

    if (celebActive) {
      for (let i = 0; i < celebCount; i++) {
        celebPos[i * 3] += celebVel[i * 3] * delta;
        celebPos[i * 3 + 1] += celebVel[i * 3 + 1] * delta;
        celebPos[i * 3 + 2] += celebVel[i * 3 + 2] * delta;
        celebVel[i * 3 + 1] -= 12 * delta;
      }
      celebGeo.attributes.position.needsUpdate = true;
    }

    const isFrozen = physics.state.isCrashed || physics.state.isLevelComplete;

    // 3. Sync Jeep 3D mesh with physics
    jeep.group.position.set(physics.x, physics.y, 0);
    jeep.group.rotation.z = physics.theta;

    // 4. Animate wheels, suspension, mascot, and smoke (frozen on Game Over / Finish)
    jeep.updateAnimation(
      delta,
      isFrozen ? 0 : physics.vx,
      isFrozen ? false : currentInput.gas,
      isFrozen ? false : currentInput.brake,
      physics.frontSuspensionY,
      physics.rearSuspensionY,
      physics.state.inAir,
      isFrozen ? 0 : physics.omega
    );

    // 5. Update coins, fuel & moving obstacles only while actively playing
    if (!isFrozen) {
      terrain.update(
        delta,
        physics.x,
        physics.y,
        (item) => {
          sound.playCoinChime();
          physics.state.coinsCollected++;
          physics.state.score += 100;
          onCoinCollected(item);
        },
        (item) => {
          sound.playFuelRefill();
          physics.state.fuel = 100;
          onFuelCollected(item);
        }
      );
    }

    // 6. 2.5D SIDE-VIEW CAMERA TRACKING
    const cw = container.clientWidth || window.innerWidth;
    const ch = container.clientHeight || window.innerHeight;
    const portraitMode = ch > cw;
    const targetCamX = physics.x + (portraitMode ? 1.4 : 2.4);
    const targetCamY = Math.max(-26, physics.y) + (portraitMode ? 2.2 : 1.5);
    const camZ = portraitMode ? 18.5 : 13.5;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 10, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 8, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, camZ, 10, delta);

    camera.lookAt(camera.position.x + 0.5, camera.position.y - 0.6, 0);

    // Keep sky celestial objects centered with camera X
    celestialGroup.position.x = camera.position.x;

    // Sun follows car
    sunLight.position.set(physics.x + 20, physics.y + 30, 25);
    sunLight.target = jeep.group;

    // 7. UI callback
    onStateUpdate({ ...physics.state });

    // 8. Render
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  updateDayNightCycle(0);
  tick();

  const resetGame = () => {
    celebrationFiredForRun = false;
    celebActive = false;
    celebrationParticles.visible = false;
    dayPhase = activeLevel.initialDayPhase;
    physics.reset(activeLevel, countLevelCoins(terrain));
    terrain.resetItems();
    updateDayNightCycle(0);
  };

  const setInput = (input: ControlInput) => {
    currentInput.gas = input.gas;
    currentInput.brake = input.brake;
  };

  const dispose = () => {
    isDisposed = true;
    window.cancelAnimationFrame(frameId);
    window.clearTimeout(frameId);
    window.removeEventListener('resize', handleResize);
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  };

  return {
    renderer,
    scene,
    camera,
    physics,
    jeep,
    terrain,
    coinLogoCleanUrl: textures.coinLogoCleanUrl,
    setInput,
    loadLevel,
    resetGame,
    dispose,
  };
}
