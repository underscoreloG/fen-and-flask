// Core -> render/audio. Later WPs add members ({ type: 'nodeHit', ... }). A tick where nothing
// happened returns an empty array; there is deliberately no per-tick event.
export type GameEvent = never;
