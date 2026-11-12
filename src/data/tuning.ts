// Every tunable number, in the units of specs/content.md (px, px/s, seconds).
// Core converts durations once with ticks(); timers then count integer ticks.

export const TICK_RATE = 60;

export function ticks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

export const TUNING = {
  sim: {
    tickRate: TICK_RATE,
    maxStepsPerFrame: 5,
    maxSpeed: 32,
  },
  world: {
    tile: 16,
    plotW: 20,
    plotH: 14,
    border: 3,
    gridW: 2,
    gridH: 1,
    roadRow: 13,
  },
  player: {
    speed: 90,
    hitboxW: 10,
    hitboxH: 8,
    hearts: 5,
  },
  swing: {
    cooldown: 0.3,
    reachRadius: 20,
    reachOffset: 12,
    assistRadius: 18,
    damage: 1,
  },
  interact: {
    reachRadius: 20,
    reachOffset: 12,
    assistRadius: 18,
  },
  hurt: {
    invulnerable: 1.0,
    knockback: 24,
    knockbackTime: 0.15,
  },
  pickup: {
    scatterMin: 8,
    scatterMax: 14,
    magnetRadius: 28,
    flySpeed: 160,
    collectRadius: 6,
  },
  spawn: {
    nodeMaxRow: 11,
    creatureMaxRow: 12,
    clearance: 1,
    playerClearance: 1,
    creaturePlayerClearance: 4,
  },
  day: {
    length: 240,
    clockStartHour: 6,
    clockEndHour: 18,
  },
  mortar: {
    secondsPerUnit: 1.5,
  },
  cauldron: {
    secondsPerPotion: 6,
    maxQuantity: 5,
    fuelPerJob: 1,
  },
  stall: {
    customersBase: 6,
    customersPerExtraPlot: 2,
    walkIn: 2,
    reactionTime: 0.8,
    firstPriceFactor: 0.7,
    priceStep: 1,
    priceMin: 1,
    delightedMax: 0.8,
    happyMax: 1.1,
    grumblingMax: 1.3,
    grumbleDemandPenalty: 0.05,
    personalMin: 0.95,
    personalMax: 1.05,
  },
  demand: {
    start: 1.0,
    perSale: 0.04,
    floor: 0.6,
    perNight: 0.15,
    cap: 1.0,
    trendMultiplier: 1.3,
  },
  notebook: {
    historyLength: 3,
  },
  health: {
    evening1CoinsMin: 40,
    evening1CoinsMax: 130,
    plotBoughtMaxDay: 4,
    goalMaxDay: 6,
  },
  input: {
    deadZone: 0.25,
    uiStickThreshold: 0.5,
    repeatDelayMs: 350,
    repeatEveryMs: 120,
    repeatFastAfterMs: 1500,
    repeatFastEveryMs: 40,
  },
  audio: {
    volume: 0.6,
  },
  render: {
    viewW: 480,
    viewH: 270,
    walkFrameTicks: 9,
    waterFrameMs: 750,
    cauldronFrameMs: 260,
    shadowAlpha: 0.35,
    fogAlpha: 0.72,
    cameraLerp: 0.2,
    uiMargin: 2,
    atlasWidth: 256,
    atlasPadding: 1,
    fontCellW: 6,
    fontCellH: 8,
  },
} as const;
