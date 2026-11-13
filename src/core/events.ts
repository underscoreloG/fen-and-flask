// Core -> render/audio. A tick where nothing happened returns an empty array; there is
// deliberately no per-tick event. Positions are world px (feet centers).
import type { CreatureId, ItemId, NodeId, StructureKind } from '../data/content';
import type { Facing } from './state';
import type { StationKind } from './stations';

// What the core asks the UI to open; later WPs add members (stations, stall, buy plot).
export type UiRequest =
  | { ui: 'sleepConfirm' }
  | { ui: 'callItADayConfirm' }
  | { ui: 'gardenPicker'; bed: number }
  | { ui: 'station'; station: StationKind };

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
  | { type: 'jobFinished'; station: StationKind };
