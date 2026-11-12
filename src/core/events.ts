// Core -> render/audio. A tick where nothing happened returns an empty array; there is
// deliberately no per-tick event. Positions are world px (feet centers).
import type { CreatureId, ItemId, NodeId, StructureKind } from '../data/content';
import type { Facing } from './state';

export type GameEvent =
  // Every swing that actually plays; targetId is null for a swing at the air.
  | { type: 'swing'; x: number; y: number; facing: Facing; targetId: number | null }
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
  | { type: 'interact'; kind: StructureKind; structureId: string };
