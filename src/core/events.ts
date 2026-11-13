// Core -> render/audio. A tick where nothing happened returns an empty array; there is
// deliberately no per-tick event. Positions are world px (feet centers).
import type { CatalogId, CreatureId, ItemId, NodeId, StructureKind } from '../data/content';
import type { Reaction } from './shop';
import type { Area, Facing } from './state';
import type { StationKind } from './stations';

// What the core asks the UI to open.
export type UiRequest =
  | { ui: 'sleepConfirm' }
  | { ui: 'openShopConfirm' }
  | { ui: 'closeShopConfirm' }
  | { ui: 'gardenPicker'; bed: number }
  | { ui: 'station'; station: StationKind }
  // shelf indexes state.shop.shelves.
  | { ui: 'shelf'; shelf: number }
  // A one-line note at the top of the screen; it never pauses the sim.
  | { ui: 'toast'; text: string }
  // plot indexes state.plots.
  | { ui: 'buyPlotConfirm'; plot: number }
  | { ui: 'catalog' };

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
  // x, y is where the player fell; the player is already in bed.
  | { type: 'playerFainted'; x: number; y: number }
  // Through the hut door or the shop exit; area is where the player now is.
  | { type: 'areaChanged'; area: Area }
  | { type: 'interact'; kind: StructureKind; structureId: string }
  | ({ type: 'uiRequest' } & UiRequest)
  // Once per day, whatever switched it (timer, opening the shop, debug).
  | { type: 'eveningStarted'; day: number }
  // After the morning reset; day is the new day.
  | { type: 'morning'; day: number }
  // Station jobs, named by the station's id; item is the output (a ground item or a potion). One
  // jobUnitDone per unit, jobFinished on the tick of the last one.
  | { type: 'jobStarted'; station: StationKind; item: ItemId; qty: number }
  | { type: 'jobUnitDone'; station: StationKind; item: ItemId }
  | { type: 'jobFinished'; station: StationKind }
  // Shop. customerArrived fires when a customer reaches a stocked shelf; the reaction follows on
  // the same tick. A sale is a payment at the counter.
  | { type: 'stallOpened' }
  | { type: 'customerArrived'; item: ItemId }
  | { type: 'customerReacted'; item: ItemId; price: number; reaction: Reaction; sold: boolean }
  | { type: 'customerQueued'; item: ItemId }
  | { type: 'customerLeftUnpaid'; item: ItemId }
  // qty units (2 for a double buy on deep tables) at price each.
  | { type: 'sale'; item: ItemId; price: number; qty: number }
  | { type: 'stallClosed'; soldCount: number; soldCoins: number }
  // Right after eveningStarted, only on days with a trend.
  | { type: 'trendAnnounced'; item: ItemId }
  // Once per game: the first Ember Elixir paid for.
  | { type: 'goalReached' }
  | { type: 'plotBought'; plot: number }
  // At the morning reset, once per catalog item delivered (before morning).
  | { type: 'upgradeArrived'; id: CatalogId };
