// 8x8 icons, ink outline drawn in (there is no room to add one). Item icons are named
// `icon_<itemId>`; they are also the pickups on the ground. Plus HUD and fx bits.

const ITEM_ICONS: Record<string, readonly string[]> = {
  // A mint leaf with its vein.
  mint: [
    '.....kk.',
    '....knnk',
    '...knnGk',
    '..knnGnk',
    '.knGnnk.',
    '.kGnnk..',
    'kgkkk...',
    'kk......',
  ],
  glowcap: [
    '..kkkk..',
    '.kcbcck.',
    'kcbcccWk',
    'kWWWWWWk',
    '.kkbbkk.',
    '..kbsk..',
    '..kbsk..',
    '..kkkk..',
  ],
  // A bound bundle of reeds.
  reed: [
    '.k.k.k..',
    'krkrkrk.',
    'krksrsk.',
    '.krsrsk.',
    '.koooOk.',
    '.krsrsk.',
    '.krsrsk.',
    '..kkkk..',
  ],
  // A short log, cut end toward the viewer.
  bogwood: [
    '........',
    '.kkkkkk.',
    'kooooOsk',
    'kOoooOOk',
    'kooopOsk',
    'koopoOOk',
    '.kkkkkk.',
    '........',
  ],
  // A wobbly gel drop.
  mudgel: [
    '...kk...',
    '..kQQk..',
    '.kQbQQk.',
    'kQbQQQQk',
    'kQQQQQPk',
    'kQQQQPPk',
    '.kPPPPk.',
    '..kkkk..',
  ],
  // A forked root, glowing at the tips.
  emberroot: [
    '..kkk...',
    '.kEek...',
    '.keEek..',
    '..keeek.',
    '.kepkek.',
    'kEk.kpek',
    'kk...kEk',
    '......kk',
  ],
  // Wooden bowl of green paste.
  mintpaste: [
    '........',
    '..kkkk..',
    '.knGnnk.',
    'knnnnggk',
    'kOoooook',
    '.kOooook',
    '..kkkkk.',
    '........',
  ],
  // A glittering pile of glow dust.
  glowdust: [
    '......b.',
    '...kk...',
    '..kcbk..',
    '.kccbck.',
    'kccccWck',
    'kcWcWWck',
    '.kkkkkk.',
    '........',
  ],
  emberpowder: [
    '........',
    '...kk...',
    '..keEk..',
    '.keeEek.',
    'keeeeEek',
    'keoeooek',
    '.kkkkkk.',
    '........',
  ],
  // Potions: cork, neck, round glass body; the fill is the potion's color.
  tonic: [
    '..kook..',
    '..kbbk..',
    '.kbnnbk.',
    'kbnnnnbk',
    'knGnnnnk',
    'kngnnnnk',
    '.kgggnk.',
    '..kkkk..',
  ],
  // Squat jar of salve under a waxed lid.
  salve: [
    '.kkkkkk.',
    'kOoooOOk',
    'kkkkkkkk',
    'kbQQQQbk',
    'kQbQQQQk',
    'kQQQQQPk',
    'kPPPPPPk',
    '.kkkkkk.',
  ],
  glowdraught: [
    '..kook..',
    '..kbbk..',
    '.kbccbk.',
    'kbccccbk',
    'kcbcccck',
    'kccccWck',
    '.kWWWck.',
    '..kkkk..',
  ],
  emberelixir: [
    '..kook..',
    '..kbbk..',
    '.kbEEbk.',
    'kbEEeebk',
    'keEeeeek',
    'keeeeeok',
    '.koooek.',
    '..kkkk..',
  ],
};

export const ICON_SPRITES: Record<string, readonly string[]> = {
  ...Object.fromEntries(Object.entries(ITEM_ICONS).map(([id, rows]) => [`icon_${id}`, rows])),
  heart: ['.kk..kk.', 'khbkkhhk', 'khbhhhhk', 'khhhhhhk', '.khhhhk.', '..khhk..', '...kk...', '........'],
  heart_empty: ['.kk..kk.', 'kLLkkLLk', 'kLPPPPLk', 'kLPPPPLk', '.kLPPLk.', '..kLLk..', '...kk...', '........'],
  coin: ['..kkkk..', '.kEE$$k.', 'kE$OO$$k', 'kE$O$$Ok', 'k$$O$$Ok', 'k$$OO$Ok', '.k$OOOk.', '..kkkk..'],
};

export const FX_SPRITES: Record<string, readonly string[]> = {
  // Tinted at runtime to the color of what was hit.
  particle: ['bb', 'bb'],
  particle_l: ['.b.', 'bbb', '.b.'],
  shadow_xs: ['.kkkkkk.', 'kkkkkkkk', '.kkkkkk.'],
};
