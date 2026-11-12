export type TimeOfDayLabel = 'Morning' | 'Afternoon' | 'Sunset' | 'Night';

export interface RoadGap {
  startX: number;
  endX: number;
  hasBridge?: boolean;
  bridgeBrokenGapStart?: number; // optional broken gap inside a bridge
  bridgeBrokenGapEnd?: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Extreme' | 'Impossible';
  length: number; // meters to finish line
  roadWidth: number; // depth along Z axis
  hillAmplitude: number;
  hillFrequency: number;
  valleyDepth: number;
  steepnessFactor: number;
  bumpiness: number; // rocky micro-bump intensity
  rampFrequency: number; // meters between major jump ramps
  fuelBurnRate: number;
  fuelInterval: number; // meters between fuel cans
  staticObstacleCount: number;
  movingObstacleCount: number;
  gapCount: number;
  bridgeCount: number;
  brokenBridgeCount: number;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  roadColor: number;
  soilColor: number;
  curbColor: number;
  mountainColor: number;
  theme: 'hills' | 'desert' | 'snow' | 'canyon' | 'forest' | 'volcano' | 'night' | 'sky' | 'extreme' | 'optimum';
  bonusCoins: number;
  dayCycleSpeed: number; // speed of day-night transition
  initialDayPhase: number; // 0..1 starting time of day
}

export interface LevelProgress {
  unlocked: boolean;
  completed: boolean;
  stars: number; // 0 to 3
  bestDistance: number;
  bestCoins: number;
}

export type ProgressMap = Record<number, LevelProgress>;

export interface HillClimbState {
  levelId: number;
  levelName: string;
  levelLength: number;
  distance: number; // meters traveled
  coinsCollected: number;
  totalLevelCoins: number;
  score: number;
  fuel: number; // 0 to 100
  health: number; // 0 to 100 (critical damage at 0)
  speed: number;
  inAir: boolean;
  airTime: number; // seconds
  flips: number;
  isCrashed: boolean;
  crashReason: string | null;
  isLevelComplete: boolean;
  starsEarned: number;
  bonusReward: number;
  timeOfDay: TimeOfDayLabel;
  headlightsOn: boolean;
}

export interface CollectibleItem {
  id: number;
  type: 'coin' | 'fuel';
  x: number;
  y: number;
  collected: boolean;
  rotationY: number;
}

export interface ObstacleItem {
  id: number;
  kind: 'rock' | 'log' | 'barrier' | 'moving_boulder' | 'lava_rock' | 'ice_block' | 'sky_gate';
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  moveAmpX: number;
  moveAmpY: number;
  moveSpeed: number;
  phase: number;
  hitCooldown: number;
}

export interface ControlInput {
  gas: boolean;
  brake: boolean;
}
