import * as THREE from 'three';
import { HillClimbTextures } from './textures';
import { CollectibleItem, LevelConfig, ObstacleItem, RoadGap } from './types';

export interface TerrainSystem {
  group: THREE.Group;
  level: LevelConfig;
  gaps: RoadGap[];
  items: CollectibleItem[];
  obstacles: ObstacleItem[];
  itemMeshes: Map<number, THREE.Group>;
  obstacleMeshes: Map<number, THREE.Group>;
  getY: (x: number) => number;
  getSlope: (x: number) => number;
  isGapAt: (x: number) => boolean;
  update: (
    delta: number,
    carX: number,
    carY: number,
    onCollectCoin: (item: CollectibleItem) => void,
    onCollectFuel: (item: CollectibleItem) => void
  ) => void;
  resetItems: () => void;
}

/**
 * Generates deterministic gaps, narrow bridges, and broken bridges for a level.
 */
export function generateLevelGaps(level: LevelConfig): RoadGap[] {
  const gaps: RoadGap[] = [];
  const totalFeatures = level.gapCount + level.bridgeCount + level.brokenBridgeCount;
  if (totalFeatures === 0) return gaps;

  const usableStart = 95;
  const usableEnd = level.length - 65;
  const spacing = (usableEnd - usableStart) / totalFeatures;

  let gIdx = 0;
  let bIdx = 0;
  let bbIdx = 0;

  for (let i = 0; i < totalFeatures; i++) {
    const center = usableStart + (i + 0.5) * spacing;

    // Interleave bridges, broken bridges, and open jump gaps
    if (bbIdx < level.brokenBridgeCount && (i % 2 === 1 || (gIdx >= level.gapCount && bIdx >= level.bridgeCount))) {
      const bridgeLen = 20;
      const startX = center - bridgeLen / 2;
      const endX = center + bridgeLen / 2;
      const gapW = Math.min(6.4, 4.2 + level.id * 0.22);
      gaps.push({
        startX,
        endX,
        hasBridge: true,
        bridgeBrokenGapStart: center - gapW * 0.35,
        bridgeBrokenGapEnd: center + gapW * 0.65,
      });
      bbIdx++;
    } else if (bIdx < level.bridgeCount && (i % 3 === 0 || gIdx >= level.gapCount)) {
      const bridgeLen = 18;
      gaps.push({
        startX: center - bridgeLen / 2,
        endX: center + bridgeLen / 2,
        hasBridge: true,
      });
      bIdx++;
    } else if (gIdx < level.gapCount) {
      const gapW = Math.min(6.8, 4.3 + level.id * 0.25);
      gaps.push({
        startX: center - gapW / 2,
        endX: center + gapW / 2,
        hasBridge: false,
      });
      gIdx++;
    }
  }

  return gaps.sort((a, b) => a.startX - b.startX);
}

/**
 * Checks whether world X is over an open chasm (either an unbridged gap or the broken section of a bridge).
 */
export function isOpenGap(x: number, gaps: RoadGap[]): boolean {
  for (const g of gaps) {
    if (x > g.startX && x < g.endX) {
      if (!g.hasBridge) return true;
      if (
        g.bridgeBrokenGapStart !== undefined &&
        g.bridgeBrokenGapEnd !== undefined &&
        x > g.bridgeBrokenGapStart &&
        x < g.bridgeBrokenGapEnd
      ) {
        return true;
      }
      return false;
    }
  }
  return false;
}

/**
 * Checks whether X lies on a bridge deck (solid span or intact section of a broken bridge).
 */
export function isBridgeDeck(x: number, gaps: RoadGap[]): RoadGap | null {
  for (const g of gaps) {
    if (g.hasBridge && x >= g.startX && x <= g.endX) {
      if (
        g.bridgeBrokenGapStart !== undefined &&
        g.bridgeBrokenGapEnd !== undefined &&
        x > g.bridgeBrokenGapStart &&
        x < g.bridgeBrokenGapEnd
      ) {
        return null;
      }
      return g;
    }
  }
  return null;
}

/**
 * Base continuous hill profile (excluding gap drops).
 */
function getContinuousBaseHeight(x: number, level: LevelConfig, gaps: RoadGap[]): number {
  if (x <= 18) {
    return 0;
  }

  const startBlend = Math.min(1, (x - 18) / 20);
  const distToFinish = level.length - x;
  let finishBlend = 1;
  if (distToFinish < 24) {
    finishBlend = Math.max(0, distToFinish / 24);
  }
  if (x >= level.length) {
    finishBlend = 0;
  }

  const d = x - 18;
  const amp = level.hillAmplitude;
  const freq = level.hillFrequency;
  const steep = level.steepnessFactor;

  // Steep primary hills + deep valleys + sharp ridges
  const primaryWave = Math.sin(d * freq) * amp;
  const secondaryWave = (Math.cos(d * freq * 0.48) - 1) * (level.valleyDepth * 0.72);
  const ridgeWave = Math.sin(d * freq * 2.2) * (amp * 0.18 * Math.min(1.65, steep));

  // Rocky micro-bumps on harder levels
  const rockyBumps =
    level.bumpiness > 0
      ? Math.sin(d * 0.85) * level.bumpiness * 0.32 + Math.cos(d * 1.55) * level.bumpiness * 0.18
      : 0;

  // Steep Hill Climb launch ramps with smooth landing downslope
  const rampPeriod = level.rampFrequency;
  const cyclePos = d % rampPeriod;
  const rampPeak = 3.8 + level.id * 0.35;
  let rampBoost = 0;
  if (cyclePos > rampPeriod - 28 && cyclePos < rampPeriod - 12) {
    const t = (cyclePos - (rampPeriod - 28)) / 16;
    rampBoost = t * t * rampPeak;
  } else if (cyclePos >= rampPeriod - 12 && cyclePos < rampPeriod) {
    const tDown = (cyclePos - (rampPeriod - 12)) / 12;
    rampBoost = rampPeak * 0.5 * (1 + Math.cos(tDown * Math.PI));
  }

  // Crisp upward launch lip before open chasm gaps
  let gapRampLip = 0;
  for (const g of gaps) {
    if (!g.hasBridge) {
      if (x >= g.startX - 9 && x <= g.startX) {
        const t = (x - (g.startX - 9)) / 9;
        gapRampLip = t * t * 2.1;
      }
    } else if (g.bridgeBrokenGapStart !== undefined && g.bridgeBrokenGapEnd !== undefined) {
      if (x >= g.bridgeBrokenGapStart - 6 && x <= g.bridgeBrokenGapStart) {
        const t = (x - (g.bridgeBrokenGapStart - 6)) / 6;
        gapRampLip = t * t * 1.35;
      }
    }
  }

  const altitudeClimb = Math.sin(d * 0.008) * (level.id * 0.42);
  const rawHeight = primaryWave + secondaryWave + ridgeWave + rockyBumps + rampBoost + altitudeClimb;

  return rawHeight * startBlend * finishBlend + gapRampLip;
}

/**
 * Computes terrain height at X, accounting for bridges and open chasms (-35 deep drop).
 */
export function getLevelTerrainHeight(x: number, level: LevelConfig, gaps: RoadGap[] = []): number {
  if (isOpenGap(x, gaps)) {
    return -55; // Deep chasm pit
  }

  const bridge = isBridgeDeck(x, gaps);
  if (bridge) {
    // Bridge deck smoothly interpolates between left cliff edge and right cliff edge
    const yStart = getContinuousBaseHeight(bridge.startX, level, gaps);
    const yEnd = getContinuousBaseHeight(bridge.endX, level, gaps);
    const t = (x - bridge.startX) / Math.max(0.1, bridge.endX - bridge.startX);
    let deckY = yStart + (yEnd - yStart) * t;

    // Slight sag/arch and ramp lip before broken section
    if (bridge.bridgeBrokenGapStart !== undefined && x <= bridge.bridgeBrokenGapStart) {
      const rampT = Math.max(0, (x - (bridge.bridgeBrokenGapStart - 6)) / 6);
      deckY += rampT * 1.05;
    } else {
      // Slight suspension bridge sag
      deckY -= Math.sin(t * Math.PI) * 0.35;
    }
    return deckY;
  }

  return getContinuousBaseHeight(x, level, gaps);
}

export function getLevelTerrainSlope(x: number, level: LevelConfig, gaps: RoadGap[] = []): number {
  const dx = 0.25;
  const x1 = isOpenGap(x - dx, gaps) ? x : x - dx;
  const x2 = isOpenGap(x + dx, gaps) ? x : x + dx;
  if (x1 === x2) return 0;
  const y1 = getLevelTerrainHeight(x1, level, gaps);
  const y2 = getLevelTerrainHeight(x2, level, gaps);
  if (y1 < -45 || y2 < -45) return 0;
  return (y2 - y1) / (x2 - x1);
}

/**
 * Creates the Optimum 3D Silver Infinity Coin.
 * Dedicated front/back CircleGeometry faces keep the silver infinity symbol
 * strictly HORIZONTAL, centered, and undistorted while rotating around Y.
 */
export function createHillClimbCoinMesh(textures: HillClimbTextures, radius = 0.85): THREE.Group {
  const coinGroup = new THREE.Group();

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.16,
  });

  const faceMaterial = new THREE.MeshPhysicalMaterial({
    map: textures.coinFrontTexture,
    bumpMap: textures.coinBumpTexture,
    bumpScale: 0.05,
    metalness: 0.85,
    roughness: 0.18,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });

  const thickness = 0.22;

  const cylinderGeo = new THREE.CylinderGeometry(radius, radius, thickness, 40);
  const rimBody = new THREE.Mesh(cylinderGeo, rimMaterial);
  rimBody.rotation.x = Math.PI / 2;
  rimBody.castShadow = true;
  coinGroup.add(rimBody);

  const bevelGeo = new THREE.TorusGeometry(radius, thickness * 0.42, 10, 48);
  const bevel = new THREE.Mesh(bevelGeo, rimMaterial);
  coinGroup.add(bevel);

  const discGeo = new THREE.CircleGeometry(radius * 0.96, 40);
  const frontDisc = new THREE.Mesh(discGeo, faceMaterial);
  frontDisc.position.z = thickness * 0.5 + 0.006;
  coinGroup.add(frontDisc);

  const backDisc = new THREE.Mesh(discGeo, faceMaterial);
  backDisc.position.z = -thickness * 0.5 - 0.006;
  backDisc.rotation.y = Math.PI;
  coinGroup.add(backDisc);

  return coinGroup;
}

function createFuelMesh(textures: HillClimbTextures): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.2,
  });

  const can = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.48), mat);
  can.castShadow = true;
  group.add(can);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.16), mat);
  handle.position.y = 0.6;
  group.add(handle);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: 0xfacc15 })
  );
  cap.position.set(0.24, 0.58, 0);
  group.add(cap);

  const badgeGeo = new THREE.PlaneGeometry(0.62, 0.62);
  const badgeMat = new THREE.MeshBasicMaterial({ map: textures.fuelTexture, transparent: true, side: THREE.DoubleSide });
  const badgeF = new THREE.Mesh(badgeGeo, badgeMat);
  badgeF.position.z = 0.25;
  group.add(badgeF);

  return group;
}

function createObstacleMesh(kind: ObstacleItem['kind'], radius: number): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'rock' || kind === 'moving_boulder') {
    const mat = new THREE.MeshStandardMaterial({
      color: kind === 'moving_boulder' ? 0x78716c : 0x57534e,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), mat);
    mesh.castShadow = true;
    group.add(mesh);

    if (kind === 'moving_boulder') {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.92, 0.06, 6, 16),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      group.add(band);
    }
  } else if (kind === 'log') {
    const logMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const log = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.75, radius * 0.85, 2.2, 10), logMat);
    log.rotation.x = Math.PI / 2;
    log.castShadow = true;
    group.add(log);
  } else if (kind === 'ice_block') {
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      roughness: 0.15,
      metalness: 0.1,
      clearcoat: 1.0,
    });
    const block = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.5, radius * 1.4, 2.0), iceMat);
    block.castShadow = true;
    group.add(block);
  } else if (kind === 'lava_rock') {
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0x450a0a,
      emissive: 0xea580c,
      emissiveIntensity: 0.9,
      roughness: 0.7,
      flatShading: true,
    });
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), lavaMat);
    rock.castShadow = true;
    group.add(rock);
  } else {
    const barMat = new THREE.MeshStandardMaterial({
      color: kind === 'sky_gate' ? 0x38bdf8 : 0xfacc15,
      roughness: 0.4,
      metalness: 0.3,
    });
    const post = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.1, radius * 1.8, 2.0), barMat);
    post.castShadow = true;
    group.add(post);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.15, radius * 0.35, 2.04),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    stripe.position.y = radius * 0.35;
    group.add(stripe);
  }

  return group;
}

function createPineTree(snowy = false): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.28, 1.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
  );
  trunk.position.y = 0.9;
  trunk.castShadow = true;
  tree.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({
    color: snowy ? 0xe0f2fe : 0x16a34a,
    roughness: 0.65,
  });
  const t1 = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, 8), leafMat);
  t1.position.y = 2.1;
  tree.add(t1);

  const t2 = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.4, 8), leafMat);
  t2.position.y = 2.9;
  tree.add(t2);

  const t3 = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.1, 8), leafMat);
  t3.position.y = 3.6;
  tree.add(t3);

  return tree;
}

function createCactus(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.6, 8), mat);
  body.position.y = 1.3;
  group.add(body);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.1, 8), mat);
  armL.position.set(-0.55, 1.6, 0);
  armL.rotation.z = 0.6;
  group.add(armL);

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.0, 8), mat);
  armR.position.set(0.55, 1.3, 0);
  armR.rotation.z = -0.6;
  group.add(armR);

  return group;
}

function createFinishGate(): THREE.Group {
  const gate = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.6, roughness: 0.3 });

  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.5, 10), poleMat);
  postL.position.set(0, 2.75, 2.1);
  gate.add(postL);

  const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.5, 10), poleMat);
  postR.position.set(0, 2.75, -2.1);
  gate.add(postR);

  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 1.1, 4.6),
    new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 0.4 })
  );
  banner.position.set(0, 5.0, 0);
  gate.add(banner);

  for (let i = 0; i < 8; i++) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.4, 0.5),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffffff : 0x0f172a })
    );
    tile.position.set(0, 5.0, -1.75 + i * 0.5);
    gate.add(tile);
  }

  return gate;
}

/**
 * Builds solid ground chunks (split cleanly at gaps), vertical cliff walls at gap edges,
 * narrow wooden/steel bridges (including broken bridges), obstacles, collectibles, and scenery.
 */
export function buildTerrain(textures: HillClimbTextures, level: LevelConfig): TerrainSystem {
  const group = new THREE.Group();
  const gaps = generateLevelGaps(level);
  const items: CollectibleItem[] = [];
  const obstacles: ObstacleItem[] = [];
  const itemMeshes = new Map<number, THREE.Group>();
  const obstacleMeshes = new Map<number, THREE.Group>();

  const startX = -45;
  const endX = level.length + 95;
  const zNear = level.roadWidth / 2;
  const zFar = -level.roadWidth / 2;
  const cliffBottomY = -48;

  const roadMaterial = new THREE.MeshStandardMaterial({
    map: textures.grassTexture,
    color: level.roadColor,
    roughness: level.theme === 'snow' ? 0.35 : 0.65,
    metalness: level.theme === 'optimum' ? 0.45 : 0.05,
    side: THREE.DoubleSide,
  });

  const soilMaterial = new THREE.MeshStandardMaterial({
    map: textures.dirtTexture,
    color: level.soilColor,
    emissive: level.theme === 'volcano' ? 0x9a3412 : 0x000000,
    emissiveIntensity: level.theme === 'volcano' ? 0.35 : 0,
    roughness: 0.9,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const curbMaterial = new THREE.MeshBasicMaterial({ color: level.curbColor, side: THREE.DoubleSide });

  // Build list of solid land spans (excluding gaps/bridges)
  const landSpans: { a: number; b: number }[] = [];
  let cursor = startX;
  for (const g of gaps) {
    if (g.startX > cursor) {
      landSpans.push({ a: cursor, b: g.startX });
    }
    cursor = Math.max(cursor, g.endX);
  }
  if (cursor < endX) {
    landSpans.push({ a: cursor, b: endX });
  }

  // Helper to build a single solid land chunk with top road, front soil cliff, and side chasm cliff walls
  const buildLandSpan = (spanA: number, spanB: number) => {
    const length = spanB - spanA;
    if (length <= 0.2) return;
    const segments = Math.max(4, Math.ceil(length * 1.1));
    const step = length / segments;

    const roadVertices: number[] = [];
    const roadUvs: number[] = [];
    const roadIndices: number[] = [];

    const soilVertices: number[] = [];
    const soilUvs: number[] = [];
    const soilIndices: number[] = [];

    const curbVertices: number[] = [];
    const curbIndices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const x = spanA + i * step;
      const y = getContinuousBaseHeight(x, level, gaps);
      const uvU = (x - startX) * 0.15;

      roadVertices.push(x, y, zNear);
      roadVertices.push(x, y, zFar);
      roadUvs.push(uvU, 0);
      roadUvs.push(uvU, 1);

      if (i < segments) {
        const idx = i * 2;
        roadIndices.push(idx, idx + 2, idx + 1);
        roadIndices.push(idx + 1, idx + 2, idx + 3);
      }

      soilVertices.push(x, y, zNear);
      soilVertices.push(x, cliffBottomY, zNear);
      soilUvs.push(uvU, y * 0.1);
      soilUvs.push(uvU, cliffBottomY * 0.1);

      if (i < segments) {
        const sIdx = i * 2;
        soilIndices.push(sIdx, sIdx + 1, sIdx + 2);
        soilIndices.push(sIdx + 2, sIdx + 1, sIdx + 3);
      }

      curbVertices.push(x, y + 0.05, zNear + 0.02);
      curbVertices.push(x, y - 0.26, zNear + 0.02);
      if (i < segments) {
        const cIdx = i * 2;
        curbIndices.push(cIdx, cIdx + 1, cIdx + 2);
        curbIndices.push(cIdx + 2, cIdx + 1, cIdx + 3);
      }

      // Scenery trees/cacti along non-bridge land
      if (i % 7 === 0 && x > -25 && x < level.length + 20) {
        if (level.theme === 'desert') {
          if (Math.random() > 0.35) {
            const cactus = createCactus();
            const s = 0.8 + Math.random() * 0.5;
            cactus.scale.set(s, s, s);
            cactus.position.set(x, y, zFar - 0.9 - Math.random() * 1.5);
            group.add(cactus);
          }
        } else if (level.theme === 'hills' || level.theme === 'forest' || level.theme === 'snow' || level.theme === 'night') {
          if (Math.random() > (level.theme === 'forest' ? 0.15 : 0.4)) {
            const tree = createPineTree(level.theme === 'snow');
            const s = 0.8 + Math.random() * 0.6;
            tree.scale.set(s, s, s);
            tree.position.set(x, y, zFar - 0.8 - Math.random() * 2.0);
            group.add(tree);
          }
        }
      }
    }

    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3));
    rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    rGeo.setIndex(roadIndices);
    rGeo.computeVertexNormals();
    const rMesh = new THREE.Mesh(rGeo, roadMaterial);
    rMesh.receiveShadow = true;
    group.add(rMesh);

    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(soilVertices, 3));
    sGeo.setAttribute('uv', new THREE.Float32BufferAttribute(soilUvs, 2));
    sGeo.setIndex(soilIndices);
    sGeo.computeVertexNormals();
    const sMesh = new THREE.Mesh(sGeo, soilMaterial);
    sMesh.receiveShadow = true;
    group.add(sMesh);

    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVertices, 3));
    cGeo.setIndex(curbIndices);
    cGeo.computeVertexNormals();
    group.add(new THREE.Mesh(cGeo, curbMaterial));

    // Vertical end-cap cliff walls at gap edges so chasms look solid in 3D
    const yLeft = getContinuousBaseHeight(spanA, level, gaps);
    const yRight = getContinuousBaseHeight(spanB, level, gaps);
    const wallDepth = zNear - zFar;
    const wallHeightL = yLeft - cliffBottomY;
    const wallHeightR = yRight - cliffBottomY;

    if (spanA > startX + 1) {
      const capL = new THREE.Mesh(new THREE.PlaneGeometry(wallDepth, wallHeightL), soilMaterial);
      capL.rotation.y = -Math.PI / 2;
      capL.position.set(spanA, cliffBottomY + wallHeightL / 2, (zNear + zFar) / 2);
      group.add(capL);
    }
    if (spanB < endX - 1) {
      const capR = new THREE.Mesh(new THREE.PlaneGeometry(wallDepth, wallHeightR), soilMaterial);
      capR.rotation.y = Math.PI / 2;
      capR.position.set(spanB, cliffBottomY + wallHeightR / 2, (zNear + zFar) / 2);
      group.add(capR);
    }
  };

  landSpans.forEach((s) => buildLandSpan(s.a, s.b));

  // Build 3D Narrow Bridges & Broken Bridges across bridged gaps
  const plankMat = new THREE.MeshStandardMaterial({
    color: level.theme === 'optimum' ? 0x334155 : 0x92400e,
    roughness: 0.75,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: level.theme === 'optimum' ? 0x22d3ee : 0xfacc15,
    roughness: 0.4,
  });

  gaps.forEach((g) => {
    if (!g.hasBridge) return;
    const bridgeZWidth = Math.min(2.3, level.roadWidth * 0.72);

    // Draw planks along bridge where deck exists
    for (let px = g.startX; px < g.endX; px += 0.9) {
      if (
        g.bridgeBrokenGapStart !== undefined &&
        g.bridgeBrokenGapEnd !== undefined &&
        px > g.bridgeBrokenGapStart &&
        px < g.bridgeBrokenGapEnd
      ) {
        continue; // Missing broken section!
      }
      const py = getLevelTerrainHeight(px, level, gaps);
      const slope = getLevelTerrainSlope(px, level, gaps);

      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.22, bridgeZWidth), plankMat);
      plank.position.set(px + 0.4, py - 0.1, 0);
      plank.rotation.z = Math.atan(slope);
      plank.castShadow = true;
      plank.receiveShadow = true;
      group.add(plank);

      // Far-side safety guard post every few planks
      if (Math.floor(px) % 3 === 0) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), railMat);
        post.position.set(px + 0.4, py + 0.3, -bridgeZWidth / 2);
        group.add(post);
      }
    }
  });

  // --- PLACE COINS & FUEL CANS ---
  let fuelPlacedX = level.fuelInterval;
  for (let x = 22; x < level.length - 12; x += 6.5) {
    const overGap = isOpenGap(x, gaps);
    const baseY = overGap ? getContinuousBaseHeight(x, level, gaps) : getLevelTerrainHeight(x, level, gaps);

    // Never place fuel cans over an open chasm
    if (!overGap && x >= fuelPlacedX) {
      const fuelY = baseY + 1.05;
      const itemData: CollectibleItem = {
        id: items.length,
        type: 'fuel',
        x,
        y: fuelY,
        collected: false,
        rotationY: 0,
      };
      items.push(itemData);
      const mesh = createFuelMesh(textures);
      mesh.position.set(x, fuelY, 0);
      group.add(mesh);
      itemMeshes.set(itemData.id, mesh);
      fuelPlacedX += level.fuelInterval;
      continue;
    }

    // Coin arc height: high arc over open jump gaps, ridge coins on slopes
    const slope = overGap ? 0 : getLevelTerrainSlope(x, level, gaps);
    const coinOffset = overGap ? 3.2 : slope < -0.15 ? 1.85 : 1.35;
    const coinY = baseY + coinOffset;

    const coinData: CollectibleItem = {
      id: items.length,
      type: 'coin',
      x,
      y: coinY,
      collected: false,
      rotationY: 0,
    };
    items.push(coinData);

    const mesh = createHillClimbCoinMesh(textures, 0.85);
    mesh.position.set(x, coinY, 0);
    group.add(mesh);
    itemMeshes.set(coinData.id, mesh);
  }

  // --- PLACE STATIC & MOVING OBSTACLES (never inside gaps or within 12m before a jump gap) ---
  const isNearGap = (x: number) => {
    for (const g of gaps) {
      if (x >= g.startX - 13 && x <= g.endX + 8) return true;
    }
    return false;
  };

  const usableSpan = level.length - 85;
  for (let s = 0; s < level.staticObstacleCount; s++) {
    const ox = 48 + ((s + 0.5) / Math.max(1, level.staticObstacleCount)) * usableSpan;
    if (isNearGap(ox)) continue;

    const oy = getLevelTerrainHeight(ox, level, gaps);
    const radius = 0.5 + (s % 3) * 0.12;

    let kind: ObstacleItem['kind'] = 'rock';
    if (level.theme === 'forest') kind = s % 2 === 0 ? 'log' : 'rock';
    else if (level.theme === 'snow') kind = s % 2 === 0 ? 'ice_block' : 'rock';
    else if (level.theme === 'volcano') kind = 'lava_rock';
    else if (level.theme === 'sky' || level.theme === 'optimum') kind = 'barrier';

    const obs: ObstacleItem = {
      id: obstacles.length,
      kind,
      x: ox,
      y: oy + radius * 0.65,
      baseX: ox,
      baseY: oy + radius * 0.65,
      radius,
      moveAmpX: 0,
      moveAmpY: 0,
      moveSpeed: 0,
      phase: 0,
      hitCooldown: 0,
    };
    obstacles.push(obs);

    const mesh = createObstacleMesh(kind, radius);
    mesh.position.set(obs.x, obs.y, 0);
    group.add(mesh);
    obstacleMeshes.set(obs.id, mesh);
  }

  for (let m = 0; m < level.movingObstacleCount; m++) {
    const mx = 65 + ((m + 0.4) / Math.max(1, level.movingObstacleCount)) * (usableSpan - 20);
    if (isNearGap(mx)) continue;

    const my = getLevelTerrainHeight(mx, level, gaps);
    const radius = 0.64;
    const isVerticalMover = m % 2 === 0;
    const kind: ObstacleItem['kind'] =
      level.theme === 'volcano'
        ? 'lava_rock'
        : level.theme === 'sky' || level.theme === 'optimum'
        ? 'sky_gate'
        : 'moving_boulder';

    const obs: ObstacleItem = {
      id: obstacles.length,
      kind,
      x: mx,
      y: my + (isVerticalMover ? 2.4 : 0.75),
      baseX: mx,
      baseY: my + (isVerticalMover ? 2.4 : 0.75),
      radius,
      moveAmpX: isVerticalMover ? 0 : 3.5 + level.id * 0.2,
      moveAmpY: isVerticalMover ? 1.8 + level.id * 0.1 : 0,
      moveSpeed: 1.6 + level.id * 0.16,
      phase: m * 1.3,
      hitCooldown: 0,
    };
    obstacles.push(obs);

    const mesh = createObstacleMesh(kind, radius);
    mesh.position.set(obs.x, obs.y, 0);
    group.add(mesh);
    obstacleMeshes.set(obs.id, mesh);
  }

  // Finish Line Arch
  const finishGate = createFinishGate();
  finishGate.position.set(level.length, getLevelTerrainHeight(level.length, level, gaps), 0);
  group.add(finishGate);

  // Background Mountains & Clouds
  const mountainGroup = new THREE.Group();
  mountainGroup.position.set(0, 0, -48);
  const mCount = Math.ceil((endX - startX) / 42) + 2;
  for (let m = 0; m < mCount; m++) {
    const mx = startX + m * 42;
    const mHeight = 16 + (m % 3) * 6 + Math.sin(m) * 4;
    const mRadius = 18 + (m % 2) * 8;

    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(mRadius, mHeight, 5),
      new THREE.MeshStandardMaterial({ color: level.mountainColor, roughness: 0.9 })
    );
    mountain.position.set(mx, mHeight / 2 - 6, 0);
    mountainGroup.add(mountain);

    if (level.theme === 'snow' || level.theme === 'hills' || mHeight > 20) {
      const capColor = level.theme === 'volcano' ? 0xf97316 : 0xffffff;
      const snowCap = new THREE.Mesh(
        new THREE.ConeGeometry(mRadius * 0.35, mHeight * 0.35, 5),
        new THREE.MeshStandardMaterial({
          color: capColor,
          emissive: level.theme === 'volcano' ? 0xea580c : 0x000000,
          roughness: 0.5,
        })
      );
      snowCap.position.set(mx, mHeight - mHeight * 0.18 - 6, 0);
      mountainGroup.add(snowCap);
    }
  }
  group.add(mountainGroup);

  const cloudMat = new THREE.MeshStandardMaterial({
    color: level.theme === 'volcano' ? 0x9a3412 : 0xffffff,
    roughness: 0.75,
  });
  const cloudCount = Math.ceil((endX - startX) / 60);
  for (let c = 0; c < cloudCount; c++) {
    const cloud = new THREE.Group();
    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + (p % 2) * 0.8, 8, 8), cloudMat);
      puff.position.set((p - 1.5) * 2.2, Math.sin(p) * 0.8, 0);
      cloud.add(puff);
    }
    cloud.position.set(startX + c * 60, 17 + (c % 4) * 3.5, -24 - (c % 3) * 5);
    group.add(cloud);
  }

  let time = 0;

  const update = (
    delta: number,
    carX: number,
    carY: number,
    onCollectCoin: (item: CollectibleItem) => void,
    onCollectFuel: (item: CollectibleItem) => void
  ) => {
    time += delta;

    items.forEach((item) => {
      const mesh = itemMeshes.get(item.id);
      if (!mesh) return;

      if (item.collected) {
        if (mesh.scale.x > 0.02) {
          mesh.scale.multiplyScalar(0.8);
        } else {
          mesh.visible = false;
        }
        return;
      }

      item.rotationY += delta * 2.2;
      mesh.rotation.y = item.rotationY;
      mesh.position.y = item.y + Math.sin(time * 3 + item.id) * 0.1;

      const dx = carX - item.x;
      const dy = carY - mesh.position.y;
      if (dx * dx + dy * dy < 5.0) {
        item.collected = true;
        if (item.type === 'coin') {
          onCollectCoin(item);
        } else {
          onCollectFuel(item);
        }
      }
    });

    obstacles.forEach((obs) => {
      if (obs.hitCooldown > 0) {
        obs.hitCooldown = Math.max(0, obs.hitCooldown - delta);
      }
      if (obs.moveSpeed > 0) {
        const mesh = obstacleMeshes.get(obs.id);
        if (!mesh) return;
        const offset = Math.sin(time * obs.moveSpeed + obs.phase);
        obs.x = obs.baseX + offset * obs.moveAmpX;
        if (obs.moveAmpX > 0 && !isOpenGap(obs.x, gaps)) {
          obs.y = getLevelTerrainHeight(obs.x, level, gaps) + obs.radius * 0.65;
          mesh.rotation.z = -offset * 3.0;
        } else {
          obs.y = obs.baseY + offset * obs.moveAmpY;
        }
        mesh.position.set(obs.x, obs.y, 0);
      }
    });
  };

  const resetItems = () => {
    items.forEach((item) => {
      item.collected = false;
      const mesh = itemMeshes.get(item.id);
      if (mesh) {
        mesh.visible = true;
        mesh.scale.set(1, 1, 1);
      }
    });
    obstacles.forEach((obs) => {
      obs.hitCooldown = 0;
    });
  };

  return {
    group,
    level,
    gaps,
    items,
    obstacles,
    itemMeshes,
    obstacleMeshes,
    getY: (x: number) => getLevelTerrainHeight(x, level, gaps),
    getSlope: (x: number) => getLevelTerrainSlope(x, level, gaps),
    isGapAt: (x: number) => isOpenGap(x, gaps),
    update,
    resetItems,
  };
}
