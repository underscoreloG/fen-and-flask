// The color bible (specs/design.md). No color ships outside these tokens.
export const PALETTE = {
  ink: 0x1b1f2a,
  deepwater: 0x22384a,
  water: 0x2f5d62,
  waterlight: 0x4f8a7b,
  moss: 0x3e6b3a,
  grass: 0x5f8f3e,
  grasslight: 0x8fb84e,
  peat: 0x3b2e26,
  mud: 0x5a4636,
  sand: 0xb59a6a,
  reed: 0xc9b458,
  wood: 0x7a5230,
  woodlight: 0xa8763e,
  mint: 0x7fd6a0,
  glow: 0x7df0e6,
  ember: 0xf0803c,
  emberhot: 0xffd166,
  plum: 0x8e5a8a,
  plumlight: 0xc08fbd,
  coin: 0xf2c94c,
  heart: 0xe0524d,
  bone: 0xf3ecd8,
  panel: 0x2a2433,
  panellight: 0x40364d,
  night: 0x3a4a8a,
} as const satisfies Record<string, number>;

export type Token = keyof typeof PALETTE;

export const TOKENS = Object.keys(PALETTE) as Token[];

export function hex(token: Token): string {
  return '#' + PALETTE[token].toString(16).padStart(6, '0');
}
