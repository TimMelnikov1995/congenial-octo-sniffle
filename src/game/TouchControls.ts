import type { InputManager } from './Input';

// HTML-overlay on-screen controls. We use HTML rather than Pixi so styling and
// pointer-event handling stay simple. Buttons are only shown on touch devices.

export class TouchControls {
  private root: HTMLDivElement | null = null;

  constructor(private readonly input: InputManager) {}

  mount(parent: HTMLElement): void {
    if (!this.shouldEnable()) return;
    const root = document.createElement('div');
    root.className = 'touch-controls';
    root.innerHTML = `
      <style>
        /* position: absolute (not fixed) so the controls stay inside #app
           and follow its CSS transform when we force-landscape on a portrait
           phone. */
        .touch-controls {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 10;
          font-family: system-ui, sans-serif;
        }
        .touch-controls .pad {
          position: absolute;
          pointer-events: auto;
        }
        .touch-controls .pad.right { display: flex; gap: 12px; }
        /* D-pad cross: 3x3 grid with only the cardinal cells filled. */
        .touch-controls .pad.left {
          display: grid;
          grid-template-columns: repeat(3, 64px);
          grid-template-rows:    repeat(3, 64px);
          gap: 4px;
        }
        .touch-controls .pad.left button[data-key="up"]    { grid-column: 2; grid-row: 1; border-radius: 12px 12px 4px 4px; }
        .touch-controls .pad.left button[data-key="left"]  { grid-column: 1; grid-row: 2; border-radius: 12px 4px 4px 12px; }
        .touch-controls .pad.left button[data-key="right"] { grid-column: 3; grid-row: 2; border-radius: 4px 12px 12px 4px; }
        .touch-controls .pad.left button[data-key="down"]  { grid-column: 2; grid-row: 3; border-radius: 4px 4px 12px 12px; }
        /* Native landscape: safe-area axes line up with content axes. */
        .touch-controls .pad.left  {
          left:   max(24px, env(safe-area-inset-left));
          bottom: max(24px, env(safe-area-inset-bottom));
        }
        .touch-controls .pad.right {
          right:  max(24px, env(safe-area-inset-right));
          bottom: max(24px, env(safe-area-inset-bottom));
        }
        /* Portrait phone with CSS rotate(90deg) applied to #app: the
           content's logical axes are rotated relative to the device, so the
           safe-area variables must be remapped. After CW rotation:
             logical left  <- physical top    (notch / status bar)
             logical right <- physical bottom (home indicator)
             logical bottom<- physical left   (rounded corner)
             logical top   <- physical right  (rounded corner)
        */
        @media (orientation: portrait) and (hover: none) {
          .touch-controls .pad.left {
            left:   max(24px, env(safe-area-inset-top));
            bottom: max(24px, env(safe-area-inset-left));
          }
          .touch-controls .pad.right {
            right:  max(24px, env(safe-area-inset-bottom));
            bottom: max(24px, env(safe-area-inset-left));
          }
        }
        .touch-controls .pad.left button { width: 64px; height: 64px; }
        .touch-controls button {
          width: 72px; height: 72px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.4);
          background: rgba(20,24,32,0.5);
          color: #fff; font-size: 28px; font-weight: 600;
          touch-action: none; user-select: none;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(6px);
          -webkit-tap-highlight-color: transparent;
        }
        .touch-controls button.active {
          background: rgba(100,160,220,0.6);
          border-color: rgba(255,255,255,0.8);
        }
        .touch-controls .pad.right button.jump { background: rgba(60,140,90,0.55); }
        .touch-controls .pad.right button.jump.active { background: rgba(80,200,120,0.7); }
      </style>
      <div class="pad left">
        <button data-key="up"    aria-label="Up">&#9650;</button>
        <button data-key="left"  aria-label="Left">&#9664;</button>
        <button data-key="right" aria-label="Right">&#9654;</button>
        <button data-key="down"  aria-label="Down">&#9660;</button>
      </div>
      <div class="pad right">
        <button data-key="attack" aria-label="Attack">&#9876;</button>
        <button data-key="jump" class="jump" aria-label="Jump">&#9650;</button>
      </div>
    `;
    parent.appendChild(root);
    this.root = root;

    for (const btn of Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-key]'))) {
      const key = btn.dataset.key as keyof InputManager['touch'];
      this.bindButton(btn, key);
    }
  }

  unmount(): void {
    this.root?.remove();
    this.root = null;
  }

  private bindButton(btn: HTMLButtonElement, key: keyof InputManager['touch']): void {
    const set = (on: boolean) => {
      this.input.touch[key] = on;
      btn.classList.toggle('active', on);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      set(true);
    });
    const release = (e: PointerEvent) => {
      if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
      set(false);
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private shouldEnable(): boolean {
    if (typeof window === 'undefined') return false;
    // Show on any device that has touch capability, even hybrid laptops; the
    // buttons are unobtrusive when not used.
    return (
      'ontouchstart' in window ||
      (navigator.maxTouchPoints ?? 0) > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  }
}
