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
  node: {
    hitboxW: 10,
    hitboxH: 8,
  },
  pickup: {
    scatterMin: 8,
    scatterMax: 14,
    magnetRadius: 28,
    flySpeed: 160,
    collectRadius: 6,
    // Time a fresh drop spends arcing out before the magnet may grab it, so the scatter reads.
    landTime: 0.3,
    // Angles tried to keep a drop out of solid things before falling back to the source.
    scatterTries: 8,
    // Box a drop must land in clear of solids.
    clearBox: 4,
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
    // The HUD clock moves in steps of this many minutes.
    clockStepMinutes: 10,
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
  // Headless autoplay policy (specs/wp/WP04): price nudges after each reaction, and how it fights.
  bot: {
    priceAfter: { delighted: 1.15, happy: 1.05, grumbling: 0.95, refuses: 0.85 },
    // A mudlet this close (px, feet to feet) is fought before anything else.
    fightRadius: 72,
    // While the swing cools down, back off from a mudlet closer than this (px).
    retreatRadius: 26,
    // Arrived when this close to a tile center (px).
    arriveEps: 0.5,
    // Stick for a turn on the spot: small enough to stay within arriveEps of the center.
    faceNudge: 0.05,
    // Pickups this close (BFS tiles) are fetched before other work; the rest after the nodes.
    nearPickupTiles: 3,
    // Seeds kept in hand for the garden: mint and glowcap beds, and one emberroot bed once
    // that many emberroot are owned.
    emberSeedMin: 3,
    // After this share of the day the bot brews with what it has instead of waiting for more.
    brewAnywayAt: 0.6,
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
    // A second play of the same sound inside this gap is dropped (a busy tick stacks hits).
    minGapMs: 50,
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
    // Mudlet hop: frame time, and the body lifts off the shadow by this much at the top.
    hopFrameMs: 150,
    hopLiftPx: 2,
    pickupBobMs: 260,
    pickupBobPx: 1,
    pickupArcPx: 10,
    // Progress bar over a busy station: size, and its gap above the sprite top.
    stationBarW: 12,
    stationBarH: 2,
    stationBarGap: 2,
  },
  // Juice (specs/design.md), driven by core events.
  fx: {
    squashX: 1.3,
    squashY: 0.7,
    squashFrames: 2,
    squashRecoverMs: 110,
    flashMs: 70,
    hitParticlesMin: 3,
    hitParticlesMax: 5,
    breakParticles: 6,
    deathParticles: 8,
    particleSpeedMin: 30,
    particleSpeedMax: 70,
    particleGravity: 220,
    particleLifeMs: 420,
    particleLiftPx: 6,
    particleFadeTail: 0.33,
    // Hit spray direction range, in units of PI (screen y is down, so 1-2 is the upper half).
    hitFanFrom: 1.1,
    hitFanTo: 1.9,
    breakSpeedBoost: 1.2,
    creatureShakePx: 1,
    hurtShakePx: 2,
    shakeMs: 90,
    hurtFlashMs: 500,
    hurtBlinkMs: 60,
    swingPoseMs: 140,
    popScale: 1.5,
    popMs: 160,
    faintFadeMs: 900,
    // Sleep: fade to night, hold, fade back (1.5 s in all).
    sleepFadeMs: 500,
    sleepHoldMs: 500,
    eveningTintAlpha: 0.14,
    // Potion done: a sparkle of glow bits from the cauldron's rim.
    sparkleParticles: 7,
  },
  // Shared panel box (specs/design.md Screens): at most 220 px wide.
  panel: {
    maxW: 220,
    padX: 6,
    padY: 5,
    rowH: 10,
    titleGap: 4,
    iconGap: 3,
    countGap: 8,
    dimAlpha: 0.4,
    // Title screen.
    titleTextY: 80,
    titleScale: 2,
    titleMenuY: 160,
    titleHintY: 190,
    // Footer line under a list (the station quantity).
    footerGap: 4,
  },
  hud: {
    heartGap: 1,
    slotGap: 6,
    iconTextGap: 1,
    barPadX: 4,
    barPadY: 3,
    barBottom: 3,
    hintGap: 3,
    keyPadX: 2,
    barAlpha: 0.85,
    hopMs: 380,
    hopArcPx: 24,
    hopFromLiftPx: 10,
    pendingAlpha: 0.35,
    clockGap: 2,
    clockHandPx: 3,
    // Sale: coins fly from the customer to the coin counter, "+N" rises over the customer.
    saleCoins: 3,
    saleCoinStaggerMs: 70,
    saleCoinMs: 520,
    saleArcPx: 28,
    plusRisePx: 14,
    // "+N" and the coins start this far above the customer's feet.
    saleLiftPx: 28,
    plusMs: 900,
  },
  // Toast (top-center one-liners) and the M1 goal banner.
  toast: {
    ms: 3000,
    bannerMs: 6000,
    fadeMs: 250,
    top: 22,
    bannerY: 60,
    padX: 5,
    padY: 3,
  },
  // Stall: customers in the world, the open view's left column.
  stallView: {
    bubbleLiftPx: 2,
    // Share of the walk out during which the reaction bubble stays up, fading.
    bubbleLingers: 0.4,
    popScale: 1.6,
    popMs: 180,
    walkFrameTicks: 10,
    // Fade-in / out at the plot edge, as a share of the walk.
    edgeFade: 0.1,
    columnX: 4,
    columnTop: 30,
    // Width kept for prices and counts in the stall rows, in characters.
    priceChars: 3,
    countChars: 3,
  },
} as const;
