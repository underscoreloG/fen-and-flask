// Gatherable nodes (16x16) and the mudlet (16x12, 2-frame hop). Drawn without outline and with a
// 1 px clear margin; the index adds the ink outline and the bone target outline (`_hl`).
// Light comes from the top-left: highlight up there, the darkest shade at the bottom right.

// Round mint mound: two leaf tips on top, lit mint leaves top-left with grass veins, grass
// toward the bottom right, moss underneath.
const MINTBUSH = [
  '................',
  '................',
  '......n..n......',
  '....nnnn.nnn....',
  '...nnnnnnnnng...',
  '..nnngnnnnnngg..',
  '..nnnngnnngngg..',
  '.nnnnnnggnnggng.',
  '.nnngnnnnnggngg.',
  '.gnnnggnnggnggg.',
  '.ggnnnggngggggm.',
  '.gggnggggggggmm.',
  '..mggggggggmgm..',
  '..mmmggmmmmmmm..',
  '...mmmmmmmmmm...',
  '................',
];

// One tall glowing cap, a small one to the right, a button in front. Teal underside shade.
const GLOWCAPS = [
  '................',
  '................',
  '.....cccc.......',
  '...ccbbcccc.....',
  '..ccbccccccW....',
  '..cccccccWWW....',
  '...WWWWWWWW.....',
  '.....sbbs...ccc.',
  '.....sbbs..cbcW.',
  '..c..sbbs..WWWW.',
  '.cbc.sbbs...sb..',
  '.WWW.sbbs...sb..',
  '..s..sbbs...sb..',
  '.mmmmmsbbmmmmmm.',
  '..mmmmmmmmmmmm..',
  '................',
];

// Three cattails over a fan of reed blades.
const REEDCLUMP = [
  '................',
  '.....oo.........',
  '.....Oo....oo...',
  '..oo.Oo....Oo...',
  '..Oo.Oo....Oo...',
  '..Oo.Oo..r.Oo...',
  '..rs.rs..r.rs.r.',
  '..rs.rs.rr.rs.r.',
  '.rrs.rs.r..rsrr.',
  '.r.rsrs.r.rrsr..',
  '.r.rsrsrr.rrs...',
  '..rrsrsrsrrsr...',
  '..mrsrsrsmrsm...',
  '.mmmmsmmmmmmmm..',
  '..mmmmmmmmmmm...',
  '................',
];

// Cut bogwood stump: ringed top, bark in two shades, a moss cap and splayed roots.
const STUMP = [
  '................',
  '................',
  '................',
  '.....mOOOOO.....',
  '...OOsssssOOm...',
  '..OssOOOOOssOm..',
  '..OsOssssOsOom..',
  '..OssOOOOOssOo..',
  '..oOOsssssOOoo..',
  '..ooOOOOOOOopo..',
  '..oOooOoooopoo..',
  '..oOoopOoooppo..',
  '.moOoopOoooopom.',
  '.mpuooppoopoupm.',
  '..pp.mpp.pp.pp..',
  '................',
];

// Dark leaves holding three ember bulbs; the hot core shows where the root is ready.
const EMBERPLANT = [
  '................',
  '.......e........',
  '......eEe.......',
  '..e...eEe...e...',
  '.eEe..eee..eEe..',
  '.eee...g...eee..',
  '..g...ggg...g...',
  '..gG.gGggg.Gg...',
  '.gGgggmggggggG..',
  '.ggmgGgmgGgmgg..',
  '..gmmggmggmmg...',
  '..mmgmmmmmgmm...',
  '...mmemmmmemm...',
  '....pEeppeEp....',
  '.....pp..pp.....',
  '................',
];

// A plum mud blob with a reed sprout; frame 1 is the stretched mid-hop pose.
const MUDLET_0 = [
  '................',
  '.......G........',
  '......Gq........',
  '....qQQQqq......',
  '...qQQqqqqqq....',
  '..qQqbbqqbbqq...',
  '..qQqbkqqbkqqq..',
  '.qqqqqqqqqqqqPq.',
  '.qqqqqkkkqqqqPq.',
  '.PqqqqqqqqqqqPP.',
  '..PPPPPPPPPPPP..',
  '................',
];

const MUDLET_1 = [
  '................',
  '......Gq........',
  '.....qQQq.......',
  '....qQQqqq......',
  '...qQqqqqqq.....',
  '...qQbbqqbbq....',
  '...qqbkqqbkq....',
  '...qqqqqqqqqP...',
  '..qqqqqkkqqqPq..',
  '..PqqqqqqqqqPP..',
  '...PPPPPPPPPP...',
  '................',
];

export const NODE_SPRITES: Record<string, readonly string[]> = {
  node_mintbush: MINTBUSH,
  node_glowcaps: GLOWCAPS,
  node_reedclump: REEDCLUMP,
  node_stump: STUMP,
  node_emberplant: EMBERPLANT,
};

export const CREATURE_SPRITES: Record<string, readonly string[]> = {
  mudlet_0: MUDLET_0,
  mudlet_1: MUDLET_1,
};
