// UI -> core. Later WPs add members ({ type: 'SetPrice', ... }); UI changes state only through these.
export type Command = never;

// Everything one tick needs from the outside world.
export interface Frame {
  moveX: number;
  moveY: number;
  swing: boolean;
  interact: boolean;
  commands: Command[];
}

export function neutralFrame(): Frame {
  return { moveX: 0, moveY: 0, swing: false, interact: false, commands: [] };
}
