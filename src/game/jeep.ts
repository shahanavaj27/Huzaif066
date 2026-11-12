import * as THREE from 'three';
import { HillClimbTextures } from './textures';

export interface JeepMesh {
  group: THREE.Group;
  chassis: THREE.Group;
  mascotRig: THREE.Group;
  mascotMesh: THREE.Mesh;
  frontWheelNear: THREE.Group;
  rearWheelNear: THREE.Group;
  frontWheelFar: THREE.Group;
  rearWheelFar: THREE.Group;
  frontSpringNear: THREE.Mesh;
  rearSpringNear: THREE.Mesh;
  smokeParticles: THREE.Points;
  setHeadlights: (strength: number) => void;
  updateAnimation: (
    delta: number,
    speed: number,
    isGas: boolean,
    isBrake: boolean,
    frontSuspensionY: number,
    rearSuspensionY: number,
    inAir: boolean,
    angularVelocity: number
  ) => void;
}

/**
 * Creates the 3D Off-Road Jeep with 4 visible rotating wheels,
 * suspension springs, and the exact Optimum mascot driver sitting inside.
 */
export function createJeep(textures: HillClimbTextures): JeepMesh {
  const carGroup = new THREE.Group();

  // Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xef4444, // Classic vibrant Hill Climb Red
    roughness: 0.35,
    metalness: 0.25,
  });

  const secondaryBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xfacc15, // Bright yellow hood / fenders accent
    roughness: 0.35,
    metalness: 0.25,
  });

  const rollCageMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Dark steel roll cage
    roughness: 0.4,
    metalness: 0.8,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.15,
    metalness: 0.95,
  });

  const springMaterial = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Chrome orange spring
    roughness: 0.3,
    metalness: 0.8,
  });

  const tireMaterial = new THREE.MeshStandardMaterial({
    color: 0x111827,
    map: textures.tireTexture,
    roughness: 0.85,
    metalness: 0.1,
  });

  // --- 1. CHASSIS & JEEP BODY ---
  const chassis = new THREE.Group();

  // Main tub / floor
  const tubGeo = new THREE.BoxGeometry(3.6, 0.4, 1.6);
  const tub = new THREE.Mesh(tubGeo, bodyMaterial);
  tub.position.y = 0.2;
  tub.castShadow = true;
  chassis.add(tub);

  // Front engine hood
  const hoodGeo = new THREE.BoxGeometry(1.4, 0.55, 1.5);
  const hood = new THREE.Mesh(hoodGeo, secondaryBodyMaterial);
  hood.position.set(1.0, 0.55, 0);
  hood.castShadow = true;
  chassis.add(hood);

  // Front grille & bumper
  const bumperGeo = new THREE.BoxGeometry(0.3, 0.3, 1.8);
  const bumper = new THREE.Mesh(bumperGeo, chromeMaterial);
  bumper.position.set(1.85, 0.2, 0);
  bumper.castShadow = true;
  chassis.add(bumper);

  // Front headlights & automatic night beams
  const lightGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const lightNear = new THREE.Mesh(lightGeo, lightMat);
  lightNear.rotation.z = Math.PI / 2;
  lightNear.position.set(1.75, 0.6, 0.55);
  chassis.add(lightNear);

  const lightFar = new THREE.Mesh(lightGeo, lightMat);
  lightFar.rotation.z = Math.PI / 2;
  lightFar.position.set(1.75, 0.6, -0.55);
  chassis.add(lightFar);

  // Volumetric headlight beam cones (visible at dusk/night)
  const beamGeo = new THREE.CylinderGeometry(0.15, 2.2, 13, 16, 1, true);
  beamGeo.translate(0, -6.5, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamNear = new THREE.Mesh(beamGeo, beamMat);
  beamNear.position.set(1.8, 0.58, 0.55);
  beamNear.rotation.z = -0.14;
  chassis.add(beamNear);

  const beamFar = new THREE.Mesh(beamGeo, beamMat);
  beamFar.position.set(1.8, 0.58, -0.55);
  beamFar.rotation.z = -0.14;
  chassis.add(beamFar);

  const headlightTarget = new THREE.Object3D();
  headlightTarget.position.set(16, -1.6, 0);
  chassis.add(headlightTarget);

  const headlightSpot = new THREE.SpotLight(0xfef9c3, 0, 32, Math.PI / 4, 0.45, 1.1);
  headlightSpot.position.set(1.85, 0.65, 0);
  headlightSpot.target = headlightTarget;
  chassis.add(headlightSpot);

  // Rear tailgate / equipment bed
  const bedGeo = new THREE.BoxGeometry(1.0, 0.6, 1.5);
  const bed = new THREE.Mesh(bedGeo, bodyMaterial);
  bed.position.set(-1.25, 0.55, 0);
  bed.castShadow = true;
  chassis.add(bed);

  // Spare tire on the back
  const spareTireGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 20);
  const spareTire = new THREE.Mesh(spareTireGeo, tireMaterial);
  spareTire.rotation.z = Math.PI / 2;
  spareTire.position.set(-1.95, 0.65, 0);
  spareTire.castShadow = true;
  chassis.add(spareTire);

  // --- 2. OFF-ROAD ROLL CAGE ---
  const cageGroup = new THREE.Group();

  const createCageBar = (length: number, rotZ: number, x: number, y: number, z: number) => {
    const barGeo = new THREE.CylinderGeometry(0.045, 0.045, length, 8);
    const bar = new THREE.Mesh(barGeo, rollCageMaterial);
    bar.rotation.z = rotZ;
    bar.position.set(x, y, z);
    bar.castShadow = true;
    cageGroup.add(bar);
    return bar;
  };

  // Near side roll bars
  createCageBar(1.4, 0.15, -0.7, 1.25, 0.72); // Rear pillar
  createCageBar(1.45, -0.4, 0.35, 1.25, 0.72); // Front windshield pillar
  createCageBar(1.2, Math.PI / 2, -0.15, 1.85, 0.72); // Roof rail

  // Far side roll bars
  createCageBar(1.4, 0.15, -0.7, 1.25, -0.72);
  createCageBar(1.45, -0.4, 0.35, 1.25, -0.72);
  createCageBar(1.2, Math.PI / 2, -0.15, 1.85, -0.72);

  // Overhead crossbars
  const crossGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.44, 8);
  const crossFront = new THREE.Mesh(crossGeo, rollCageMaterial);
  crossFront.rotation.x = Math.PI / 2;
  crossFront.position.set(0.4, 1.85, 0);
  cageGroup.add(crossFront);

  const crossRear = new THREE.Mesh(crossGeo, rollCageMaterial);
  crossRear.rotation.x = Math.PI / 2;
  crossRear.position.set(-0.7, 1.85, 0);
  cageGroup.add(crossRear);

  chassis.add(cageGroup);

  // Dashboard & tilted steering wheel
  const dashGeo = new THREE.BoxGeometry(0.4, 0.35, 1.3);
  const dash = new THREE.Mesh(dashGeo, rollCageMaterial);
  dash.position.set(0.35, 0.7, 0);
  chassis.add(dash);

  const steeringColumnGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8);
  const col = new THREE.Mesh(steeringColumnGeo, chromeMaterial);
  col.rotation.z = 0.55;
  col.position.set(0.18, 0.85, 0.2);
  chassis.add(col);

  const wheelGeo = new THREE.TorusGeometry(0.18, 0.03, 8, 16);
  const steerWheel = new THREE.Mesh(wheelGeo, rollCageMaterial);
  steerWheel.rotation.y = Math.PI / 2;
  steerWheel.rotation.z = -0.55;
  steerWheel.position.set(0.04, 0.98, 0.2);
  chassis.add(steerWheel);

  // --- 3. EXACT OPTIMUM MASCOT DRIVER RIG ---
  // "3. Place my exact uploaded white masked Optimum mascot wearing the black hoodie in the driver's seat. Its head and body must be visible from the side."
  const mascotRig = new THREE.Group();
  // Positioned directly in the open cockpit seat
  mascotRig.position.set(-0.25, 0.65, 0.15);

  // The mascot image has aspect ratio ~ 1.28
  const mascotWidth = 1.35;
  const mascotHeight = 1.72;

  const mascotPlaneGeo = new THREE.PlaneGeometry(mascotWidth, mascotHeight);
  const mascotMat = new THREE.MeshBasicMaterial({
    map: textures.mascotCutoutTexture,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const mascotMesh = new THREE.Mesh(mascotPlaneGeo, mascotMat);
  mascotMesh.position.set(0, mascotHeight * 0.45, 0);
  // Slight angle facing towards camera for perfect 2.5D read while driving right
  mascotMesh.rotation.y = 0.15;
  mascotMesh.castShadow = true;
  mascotRig.add(mascotMesh);

  // Seat backrest supporting the driver
  const seatGeo = new THREE.BoxGeometry(0.2, 0.9, 0.7);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.set(-0.6, 0.85, 0.15);
  seat.rotation.z = -0.15;
  chassis.add(seat);

  chassis.add(mascotRig);

  // Exhaust pipe at rear
  const pipeGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.4, 12);
  const pipe = new THREE.Mesh(pipeGeo, chromeMaterial);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(-1.8, 0.25, 0.6);
  chassis.add(pipe);

  // Smoke particles
  const smokeCount = 20;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(smokeCount * 3);
  const smokeSize = new Float32Array(smokeCount);
  const smokeLife = new Float32Array(smokeCount);

  for (let i = 0; i < smokeCount; i++) {
    smokePos[i * 3] = -2.0 - Math.random() * 0.8;
    smokePos[i * 3 + 1] = 0.25 + Math.random() * 0.3;
    smokePos[i * 3 + 2] = 0.6 + (Math.random() - 0.5) * 0.2;
    smokeSize[i] = 0.2 + Math.random() * 0.2;
    smokeLife[i] = Math.random();
  }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));

  const smokeMat = new THREE.PointsMaterial({
    color: 0x94a3b8,
    size: 0.35,
    transparent: true,
    opacity: 0.5,
  });
  const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
  chassis.add(smokeParticles);

  carGroup.add(chassis);

  // --- 4. FOUR VISIBLE WHEELS & SUSPENSION SPRINGS ---
  // "Both front and rear wheels must rotate while driving. Show the complete car at all times."
  const wheelRadius = 0.65;
  const wheelWidth = 0.45;

  const createWheel = () => {
    const wGroup = new THREE.Group();

    // Tire
    const tGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
    const tire = new THREE.Mesh(tGeo, tireMaterial);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    wGroup.add(tire);

    // Rim
    const rGeo = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, wheelWidth + 0.02, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3 });
    const rim = new THREE.Mesh(rGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    wGroup.add(rim);

    // Chrome center cap
    const capGeo = new THREE.CylinderGeometry(wheelRadius * 0.25, wheelRadius * 0.25, wheelWidth + 0.05, 12);
    const cap = new THREE.Mesh(capGeo, chromeMaterial);
    cap.rotation.x = Math.PI / 2;
    wGroup.add(cap);

    // 5 visible spokes
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spokeGeo = new THREE.BoxGeometry(wheelRadius * 0.45, 0.06, 0.06);
      const spoke = new THREE.Mesh(spokeGeo, chromeMaterial);
      spoke.position.set(Math.cos(angle) * wheelRadius * 0.35, Math.sin(angle) * wheelRadius * 0.35, (wheelWidth / 2) + 0.02);
      spoke.rotation.z = angle;
      wGroup.add(spoke);
    }

    return wGroup;
  };

  const frontWheelNear = createWheel();
  const rearWheelNear = createWheel();
  const frontWheelFar = createWheel();
  const rearWheelFar = createWheel();

  carGroup.add(frontWheelNear);
  carGroup.add(rearWheelNear);
  carGroup.add(frontWheelFar);
  carGroup.add(rearWheelFar);

  // Suspension shock absorber springs
  const springGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
  const frontSpringNear = new THREE.Mesh(springGeo, springMaterial);
  const rearSpringNear = new THREE.Mesh(springGeo, springMaterial);
  carGroup.add(frontSpringNear);
  carGroup.add(rearSpringNear);

  // Wheel tracking variables
  let wheelRotationAngle = 0;
  let mascotLean = 0;
  let vibration = 0;

  const updateAnimation = (
    delta: number,
    speed: number,
    isGas: boolean,
    isBrake: boolean,
    frontSuspensionY: number,
    rearSuspensionY: number,
    inAir: boolean,
    angularVelocity: number
  ) => {
    vibration += delta * (20 + Math.abs(speed) * 8);

    // 1. Wheel rotation
    // When driving forward (rightward, +X), wheels rotate clockwise around Z-axis: rotation.z decreases
    const rotSpeed = (speed / wheelRadius) * delta;
    wheelRotationAngle -= rotSpeed;

    frontWheelNear.rotation.z = wheelRotationAngle;
    rearWheelNear.rotation.z = wheelRotationAngle;
    frontWheelFar.rotation.z = wheelRotationAngle;
    rearWheelFar.rotation.z = wheelRotationAngle;

    // 2. Position wheels relative to chassis and suspension compression
    const frontAxleX = 1.35;
    const rearAxleX = -1.35;
    const nearZ = 0.95;
    const farZ = -0.95;

    // Base wheel Y relative to chassis center
    const baseWheelY = -0.35;
    const fY = baseWheelY + frontSuspensionY;
    const rY = baseWheelY + rearSuspensionY;

    frontWheelNear.position.set(frontAxleX, fY, nearZ);
    rearWheelNear.position.set(rearAxleX, rY, nearZ);
    frontWheelFar.position.set(frontAxleX, fY, farZ);
    rearWheelFar.position.set(rearAxleX, rY, farZ);

    // Springs stretching / compressing
    frontSpringNear.position.set(frontAxleX, fY + 0.35, nearZ - 0.15);
    rearSpringNear.position.set(rearAxleX, rY + 0.35, nearZ - 0.15);

    // 3. Optimum Mascot Driver Visible Reactions
    // Gas acceleration pushes mascot back: negative Z-rotation (leans back towards rear)
    // Braking pitches mascot forward: positive Z-rotation (leans forward towards steering wheel)
    let targetLean = 0;
    if (isGas) targetLean -= 0.22;
    if (isBrake) targetLean += 0.26;
    if (inAir) targetLean -= angularVelocity * 0.12;

    mascotLean = THREE.MathUtils.damp(mascotLean, targetLean, 8, delta);
    mascotRig.rotation.z = mascotLean;

    // Head bobbing with engine revs and bumpy terrain
    const bumpBob = Math.sin(vibration) * 0.02 + (inAir ? 0.04 : 0);
    mascotMesh.position.y = (mascotHeight * 0.45) + bumpBob;

    // Subtle head sway
    mascotMesh.rotation.z = Math.sin(vibration * 0.7) * 0.03;

    // 4. Exhaust smoke simulation
    const sPos = smokeParticles.geometry.attributes.position as THREE.BufferAttribute;
    const arr = sPos.array as Float32Array;
    for (let i = 0; i < smokeCount; i++) {
      arr[i * 3] -= (Math.abs(speed) + 2) * delta * 0.8; // travel left
      arr[i * 3 + 1] += delta * 0.5; // rise

      if (arr[i * 3] < -4.5 || Math.random() < (isGas ? 0.1 : 0.03)) {
        arr[i * 3] = -1.85;
        arr[i * 3 + 1] = 0.25 + (Math.random() - 0.5) * 0.1;
        arr[i * 3 + 2] = 0.6 + (Math.random() - 0.5) * 0.1;
      }
    }
    sPos.needsUpdate = true;
  };

  const setHeadlights = (strength: number) => {
    const s = Math.max(0, Math.min(1, strength));
    beamMat.opacity = s * 0.2;
    beamNear.visible = s > 0.02;
    beamFar.visible = s > 0.02;
    headlightSpot.intensity = s * 14.0;
    lightMat.color.setHex(s > 0.2 ? 0xffffff : 0xfef08a);
  };

  return {
    group: carGroup,
    chassis,
    mascotRig,
    mascotMesh,
    frontWheelNear,
    rearWheelNear,
    frontWheelFar,
    rearWheelFar,
    frontSpringNear,
    rearSpringNear,
    smokeParticles,
    setHeadlights,
    updateAnimation,
  };
}
