// Every code-drawn sprite, by texture frame name. Things that stand up or can be used get an
// ink outline (readability rule 1); ground tiles and shadows do not. Everything that can be a
// swing or interact target also gets `<name>_hl`, the same sprite outlined in bone (rule 2).
import { addOutline, sprite, type SpriteDef } from './format';
import { CREATURE_SPRITES, NODE_SPRITES } from './gathering';
import { FX_SPRITES, ICON_SPRITES } from './icons';
import { PLAYER_SPRITES } from './player';
import { SHADOW_SPRITES, STRUCTURE_SPRITES } from './structures';
import { TILE_SPRITES } from './tiles';

const outlined = (src: Record<string, readonly string[]>): Record<string, SpriteDef> =>
  Object.fromEntries(Object.entries(src).map(([k, rows]) => [k, sprite(addOutline(rows, 'k'))]));

const plain = (src: Record<string, readonly string[]>): Record<string, SpriteDef> =>
  Object.fromEntries(Object.entries(src).map(([k, rows]) => [k, sprite(rows)]));

const targetable = (src: Record<string, readonly string[]>): Record<string, SpriteDef> => ({
  ...outlined(src),
  ...Object.fromEntries(Object.entries(src).map(([k, rows]) => [`${k}_hl`, sprite(addOutline(rows, 'b'))])),
});

export const SPRITES: Readonly<Record<string, SpriteDef>> = {
  ...plain(TILE_SPRITES),
  ...plain(SHADOW_SPRITES),
  ...outlined(PLAYER_SPRITES),
  ...targetable(STRUCTURE_SPRITES),
  ...targetable(NODE_SPRITES),
  ...targetable(CREATURE_SPRITES),
  ...plain(ICON_SPRITES),
  ...plain(FX_SPRITES),
};

export { addOutline, flipX, LEGEND, type SpriteDef } from './format';
