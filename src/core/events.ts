// Core -> render/audio. A tick where nothing happened returns an empty array; there is
// deliberately no per-tick event. Positions are world px (feet centers).
import type { CreatureId, ItemId, NodeId, PotionId, StructureKind } from '../data/content';
import type { Facing } from './state';
import type { Reaction } from './stall';
import type { StationKind } from './stations';

// What the core asks the UI to open; later WPs add members (stations, stall, buy plot).
export type UiRequest =
  | { ui: 'sleepConfirm' }
  | { ui: 'callItADayConfirm' }
  | { ui: 'gardenPicker'; bed: number }
  | { ui: 'station'; station: StationKind }
  // The evening stall's price list (setup); the open view is driven by stallOpened instead.
  | { ui: 'stall' }
  // A one-line note at the top of the screen; it never pauses the sim.
  | { ui: 'toast'; text: string }
  // plot indexes state.plots.
  | { ui: 'buyPlotConfirm'; plot: number };

export type GameEvent =
  // Every swing that actually plays; targetId is null for a swing at the air, a bed's
  // structure id for a harvest.
  | { type: 'swing'; x: number; y: number; facing: Facing; targetId: number | string | null }
  // Every hit on a node, the breaking one included; hp is what is left.
  | { type: 'nodeHit'; id: number; nodeType: NodeId; x: number; y: number; hp: number }
  | { type: 'nodeBroken'; id: number; nodeType: NodeId; x: number; y: number }
  | { type: 'creatureHit'; id: number; creatureType: CreatureId; x: number; y: number; hp: number }
  | { type: 'creatureDied'; id: number; creatureType: CreatureId; x: number; y: number }
  | { type: 'pickupSpawned'; id: number; item: ItemId; x: number; y: number; fromX: number; fromY: number }
  // count is the inventory count after collecting.
  | { type: 'pickupCollected'; id: number; item: ItemId; x: number; y: number; count: number }
  | { type: 'playerHurt'; x: number; y: number; hearts: number; fromX: number; fromY: number }
  // x, y is where the player fell; the player is already at the hut door.
  | { type: 'playerFainted'; x: number; y: number }
  | { type: 'interact'; kind: StructureKind; structureId: string }
  | ({ type: 'uiRequest' } & UiRequest)
  // Once per day, whatever switched it (timer, CallItADay, debug).
  | { type: 'eveningStarted'; day: number }
  // After the morning reset; day is the new day.
  | { type: 'morning'; day: number }
  // Station jobs; item is the output (a ground item or a potion). One jobUnitDone per unit,
  // jobFinished on the tick of the last one.
  | { type: 'jobStarted'; station: StationKind; item: ItemId; qty: number }
  | { type: 'jobUnitDone'; station: StationKind; item: ItemId }
  | { type: 'jobFinished'; station: StationKind }
  // Stall. customerArrived fires when a traveller reaches the spot and picks a potion; the
  // reaction, and the sale when there is one, follow on the same tick.
  | { type: 'stallOpened' }
  | { type: 'customerArrived'; potion: PotionId }
  | { type: 'customerReacted'; potion: PotionId; price: number; reaction: Reaction; sold: boolean }
  | { type: 'sale'; potion: PotionId; price: number }
  | { type: 'stallClosed'; soldCount: number; soldCoins: number }
  // Right after eveningStarted, only on days with a trend.
  | { type: 'trendAnnounced'; potion: PotionId }
  // Once per game: the first Ember Elixir sold.
  | { type: 'goalReached' }
  | { type: 'plotBought'; plot: number };
