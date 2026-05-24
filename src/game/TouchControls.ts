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
           and follow its CSS transform when we force-landscape on portrait
           phones. env(safe-area-inset-*) is viewport-relative and does not
           line up after rotation, so use plain padding. */
        .touch-controls {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 10;
          font-family: system-ui, sans-serif;
        }
        .touch-controls .pad {
          position: absolute;
          display: flex;
          gap: 12px;
          pointer-events: auto;
        }
        .touch-controls .pad.left  { left:  18px; bottom: 18px; }
        .touch-controls .pad.right { right: 18px; bottom: 18px; }
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
        <button data-key="left" aria-label="Left">&#9664;</button>
        <button data-key="right" aria-label="Right">&#9654;</button>
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
