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
    // The shop interior lives in the same px space, this many tiles below the world, so nothing
    // indoors can ever overlap anything outdoors.
    shopGap: 4,
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
  // The copper sickle (specs/wp/WP07): every node type needs this many hits fewer.
  sickle: {
    hitsFewer: 1,
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
    // With the stone mortar (specs/wp/WP07): 45 ticks.
    stoneSecondsPerUnit: 0.75,
  },
  cauldron: {
    secondsPerPotion: 6,
    maxQuantity: 5,
    fuelPerJob: 1,
  },
  stall: {
    customersBase: 6,
    customersPerExtraPlot: 2,
    reactionTime: 0.8,
    firstPriceFactor: 0.7,
    priceStep: 1,
    priceMin: 1,
    delightedMax: 0.8,
    happyMax: 1.1,
    grumblingMax: 1.3,
    personalMin: 0.95,
    personalMax: 1.05,
  },
  // The shop interior (specs/wp/WP06).
  shop: {
    shelfCapacity: 5,
    // With deep tables (specs/wp/WP07): the capacity, and the chance a buyer on a table holding 2
    // or more takes two.
    deepShelfCapacity: 8,
    doubleChance: 0.25,
    maxIndoors: 2,
    // 150 ticks between two customers coming in.
    enterGap: 2.5,
    customerSpeed: 40,
  },
  // The daily order (specs/wp/WP09): qty from 1 to qtyMax (qtyMaxDay1 on day 1), pay = payFactor x
  // base value x qty, rounded.
  orders: {
    qtyMin: 1,
    qtyMax: 3,
    qtyMaxDay1: 2,
    payFactor: 1.5,
  },
  // Helper toads (specs/wp/WP08): the counter toad rings up a customer who waited this long at
  // spot 1 (480 ticks; 180 trained); the basket toad brings this many ingredients each morning.
  helpers: {
    counterDelay: 8,
    counterDelayTrained: 3,
    basketItems: 5,
    basketItemsBigger: 9,
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
    // M2 (specs/wp/WP07-WP09): every catalog item owned, and so m2GoalReached, by this day (all 14
    // with the helpers); then, over the lantern sign's arrival day and the 4 after it, coins per
    // evening at least this times evenings 3-5, and at least this many units sold per evening.
    catalogAllMaxDay: 20,
    lateEveningsAfter: 4,
    lateCoinsRatio: 1.5,
    lateUnitsMin: 12,
    // WP09: of the orders posted from this day on, at least this share delivered; customers left
    // unpaid at most this many before a counter toad is owned (none after).
    ordersFromDay: 3,
    ordersDeliveredMin: 0.5,
    unpaidBeforeToadMax: 1,
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
  // Hidden test menu (F2).
  cheat: { coinsSmall: 100, coinsBig: 1000, items: 5 },
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
    // Sale: coins fly from the counter to the coin counter, "+N" rises over the till.
    saleCoins: 3,
    saleCoinStaggerMs: 70,
    saleCoinMs: 520,
    saleArcPx: 28,
    plusRisePx: 14,
    // "+N" and the coins start this far above the counter's interact tile center.
    saleLiftPx: 12,
    plusMs: 900,
    // The OPEN tag under the clock.
    openTagGap: 2,
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
  // Shop: customers, their bubbles, the shelves' wares.
  shopView: {
    bubbleLiftPx: 2,
    popScale: 1.6,
    popMs: 180,
    walkFrameTicks: 10,
    // The carried item bobs over the head.
    carryLiftPx: 3,
    carryBobMs: 200,
    // Patience bar under the waiting bubble; it turns ember in the last third.
    patienceBarH: 2,
    patienceWarn: 1 / 3,
    // Fade in / out on the entry tile, in ticks of walking.
    edgeFadeTicks: 12,
    // A shelf's ware sits this far above the table's footprint top; pips under it.
    wareLiftPx: 3,
    pipSize: 2,
    pipGap: 1,
    // More than this many pips (deep tables hold 8) wrap into a second row.
    pipsPerRow: 5,
    // The delivery crate goes once the player comes this close (tiles).
    crateClearTiles: 1,
    // The back room's floor glows warm around a lit cauldron.
    glowAlpha: 0.35,
    glowPulseMs: 420,
    glowPulseAmp: 0.25,
    // Helper toads: idle frame time; the counter toad's hop and the till flash when it rings up;
    // the counter toad's feet sit this far above the counter's footprint bottom.
    toadIdleMs: 700,
    toadHopMs: 240,
    toadHopPx: 3,
    tillFlashMs: 300,
    toadOnCounterPx: 13,
  },
  // The shelf panel's fields.
  shelfPanel: {
    labelChars: 9,
    historyGap: 6,
  },
} as const;
