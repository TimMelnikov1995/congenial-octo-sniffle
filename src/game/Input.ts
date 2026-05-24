// Direction-style input shared between keyboard and on-screen touch controls.

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;        // held
  jumpPressed: boolean; // single-frame edge
  jumpReleased: boolean;
  attack: boolean;
  attackPressed: boolean;
}

export class InputManager {
  private state: InputState = this.fresh();
  private next: InputState = this.fresh();
  private prevJump = false;
  private prevAttack = false;

  private readonly keysDown = new Set<string>();
  // Bridges for touch buttons (TouchControls flips these).
  readonly touch = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    attack: false,
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  // Returns the current frame's state. Call once per frame from the game loop.
  poll(): InputState {
    const k = this.keysDown;
    this.next.left = this.touch.left || k.has('ArrowLeft') || k.has('KeyA');
    this.next.right = this.touch.right || k.has('ArrowRight') || k.has('KeyD');
    this.next.up = this.touch.up || k.has('ArrowUp') || k.has('KeyW');
    this.next.down = this.touch.down || k.has('ArrowDown') || k.has('KeyS');
    this.next.jump = this.touch.jump || k.has('Space') || k.has('KeyZ');
    this.next.attack = this.touch.attack || k.has('KeyX') || k.has('KeyJ');

    this.next.jumpPressed = this.next.jump && !this.prevJump;
    this.next.jumpReleased = !this.next.jump && this.prevJump;
    this.next.attackPressed = this.next.attack && !this.prevAttack;
    this.prevJump = this.next.jump;
    this.prevAttack = this.next.attack;

    // Copy to stable state object so consumers can read repeatedly.
    Object.assign(this.state, this.next);
    return this.state;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    this.keysDown.add(e.code);
    if (
      e.code === 'Space' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private onBlur = (): void => {
    this.keysDown.clear();
    this.touch.left = false;
    this.touch.right = false;
    this.touch.up = false;
    this.touch.down = false;
    this.touch.jump = false;
    this.touch.attack = false;
  };

  private fresh(): InputState {
    return {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      jumpPressed: false,
      jumpReleased: false,
      attack: false,
      attackPressed: false,
    };
  }
}
