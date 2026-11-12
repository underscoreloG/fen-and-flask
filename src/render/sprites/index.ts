// Every code-drawn sprite, by texture frame name. Things that stand up or can be used get an
// ink outline (readability rule 1); ground tiles and shadows do not.
import { addOutline, sprite, type SpriteDef } from './format';
import { PLAYER_SPRITES } from './player';
import { SHADOW_SPRITES, STRUCTURE_SPRITES } from './structures';
import { TILE_SPRITES } from './tiles';

const outlined = (src: Record<string, readonly string[]>): Record<string, SpriteDef> =>
  Object.fromEntries(Object.entries(src).map(([k, rows]) => [k, sprite(addOutline(rows, 'k'))]));

const plain = (src: Record<string, readonly string[]>): Record<string, SpriteDef> =>
  Object.fromEntries(Object.entries(src).map(([k, rows]) => [k, sprite(rows)]));

export const SPRITES: Readonly<Record<string, SpriteDef>> = {
  ...plain(TILE_SPRITES),
  ...plain(SHADOW_SPRITES),
  ...outlined(PLAYER_SPRITES),
  ...outlined(STRUCTURE_SPRITES),
};

export { addOutline, flipX, LEGEND, type SpriteDef } from './format';
