// Browser-facing reader: turns DOM key events and the Gamepad API into the plain snapshots
// that input.ts consumes. Keys are read by value (event.key), never by event.code, so the
// key labelled M is M on any layout.
import { noKeys, type KeyState, type PadState } from './input';

const KEY_MAP: Readonly<Record<string, keyof KeyState>> = {
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  x: 'x',
  c: 'c',
  v: 'v',
  m: 'm',
  escape: 'esc',
};

export interface DeviceReader {
  read(): { keys: KeyState; pad: PadState | null };
  dispose(): void;
}

export function createDeviceReader(target: Window): DeviceReader {
  const down = noKeys();
  // A tap that starts and ends between two reads still shows up once.
  const tapped = noKeys();

  const onDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = KEY_MAP[e.key.toLowerCase()];
    if (!k) return;
    e.preventDefault();
    if (!e.repeat) tapped[k] = true;
    down[k] = true;
  };
  const onUp = (e: KeyboardEvent): void => {
    const k = KEY_MAP[e.key.toLowerCase()];
    if (k) down[k] = false;
  };
  const onBlur = (): void => {
    Object.assign(down, noKeys());
  };
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);

  return {
    read() {
      const keys = noKeys();
      for (const k of Object.keys(keys) as (keyof KeyState)[]) {
        keys[k] = down[k] || tapped[k];
        tapped[k] = false;
      }
      return { keys, pad: readPad(target) };
    },
    dispose() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}

function readPad(target: Window): PadState | null {
  const pads = target.navigator.getGamepads?.() ?? [];
  for (const p of pads) {
    if (p && p.connected) {
      return { axes: [...p.axes], buttons: p.buttons.map((b) => b.pressed) };
    }
  }
  return null;
}
