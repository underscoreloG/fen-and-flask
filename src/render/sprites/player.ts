// Player 16x24: straw hat, teal coat, peat boots. Drawn without outline; the index adds ink.
// Upper body is rows 0-18, legs rows 19-23. The walk stride sinks the body 1 px.

const HAT = [
  '................',
  '......rrrr......',
  '.....rrrrrs.....',
  '....oooooooo....',
  '..rrrrrrrrrrrs..',
  '.srrrrrrrrrrrrs.',
];

const FRONT_UPPER = [
  ...HAT,
  '...pppppppppp...',
  '...osssssssso...',
  '...osskssksso...',
  '....OssssssO....',
  '.....OssssO.....',
  '....DeeEeeeD....',
  '...DWwwwewwwD...',
  '..DWWwwwwwwwwD..',
  '..DWwwwwwwwwwD..',
  '..DWwwwwwwwwDD..',
  '..sDooooooooDs..',
  '...DwwwwwwwwD...',
  '...DWwwwwwwwD...',
];

const BACK_UPPER = [
  ...HAT,
  '...pppppppppp...',
  '...poooooooop...',
  '...pooOOoooop...',
  '....poooooop....',
  '.....pppppp.....',
  '....DwwwwwwD....',
  '...DWwwwwwwwD...',
  '..DWWwwwwwwwwD..',
  '..DWwwwwwwwwwD..',
  '..DWwwwwwwwwDD..',
  '..sDooooooooDs..',
  '...DwwwwwwwwD...',
  '...DWwwwwwwwD...',
];

const SIDE_UPPER = [
  '................',
  '.......rrrr.....',
  '......rrrrrs....',
  '.....oooooooo...',
  '..rrrrrrrrrrrs..',
  '.srrrrrrrrrrrrs.',
  '....ppppppppp...',
  '....ooossssss...',
  '....oossssksss..',
  '....oosssssss...',
  '.....oOssssO....',
  '.....DwwwwwD....',
  '.....DWwwwwD....',
  '.....DWWwwwD....',
  '.....DwWwwwD....',
  '.....DwWwwwD....',
  '.....DosoooD....',
  '.....DwwwwwD....',
  '.....DWwwwwD....',
];

const FRONT_LEGS = [
  '....uuuuuuuu....',
  '....uuu..uuu....',
  '....ppp..ppp....',
  '...pppp..pppp...',
  '................',
];

// Three rows: the stride frame is shifted down by one, so the top leg row is hidden by the hem.
const FRONT_STRIDE = [
  '....uuu..ppp....',
  '....ppp..ppp....',
  '...pppp.........',
  '................',
];

const SIDE_LEGS = [
  '......uuuuu.....',
  '......uuuu......',
  '......pppp......',
  '......ppppp.....',
  '................',
];

const SIDE_STRIDE = [
  '.....uu..uu.....',
  '.....pp...pp....',
  '....pp.....ppp..',
  '................',
];

const BLANK = '................';

function stand(upper: readonly string[], legs: readonly string[]): string[] {
  return [...upper, ...legs];
}

function stride(upper: readonly string[], legs: readonly string[]): string[] {
  return [BLANK, ...upper, ...legs];
}

// Swing poses: a bone-bladed sickle, held out in the facing direction.
const SWING_DOWN = [
  ...FRONT_UPPER.slice(0, 15),
  '...DWwwwwwwwD...',
  '...DooossoooD...',
  '...DwwwwowwwD...',
  '...DWwwwowwwD...',
  '....uuuuouuu....',
  '....uuu.bbbb....',
  '....ppp..ppbb...',
  '...pppp..pppp...',
  '................',
];

const SWING_UP = [
  '................',
  '............bb..',
  '.....rrrrrs..bb.',
  '....oooooooo..b.',
  '..rrrrrrrrrrrs..',
  '.srrrrrrrrrrrrs.',
  '...pppppppppp.o.',
  '..spoooooooops..',
  '..wpooOOoooopw..',
  '..w.poooooop.w..',
  '..Dw.pppppp.wD..',
  '...DwDwwwwDwD...',
  '...DWwwwwwwwD...',
  '...DWwwwwwwwD...',
  '...DwwwwwwwwD...',
  '...DwwwwwwwwD...',
  '...DooooooooD...',
  '...DwwwwwwwwD...',
  '...DWwwwwwwwD...',
  ...FRONT_LEGS,
];

const SWING_SIDE = [
  ...SIDE_UPPER.slice(0, 9),
  '....oosssssss.b.',
  '.....oOssssO.bb.',
  '.....DwwwwwD.o..',
  '.....DWwwwwwss..',
  '.....DWwwwwD....',
  '.....DwwwwwD....',
  '.....DwwwwwD....',
  '.....DooooooD...',
  '.....DwwwwwD....',
  '.....DWwwwwD....',
  ...SIDE_LEGS,
];

export const PLAYER_SPRITES: Record<string, readonly string[]> = {
  player_down_0: stand(FRONT_UPPER, FRONT_LEGS),
  player_down_1: stride(FRONT_UPPER, FRONT_STRIDE),
  player_down_swing: SWING_DOWN,
  player_up_0: stand(BACK_UPPER, FRONT_LEGS),
  player_up_1: stride(BACK_UPPER, FRONT_STRIDE),
  player_up_swing: SWING_UP,
  player_side_0: stand(SIDE_UPPER, SIDE_LEGS),
  player_side_1: stride(SIDE_UPPER, SIDE_STRIDE),
  player_side_swing: SWING_SIDE,
};
