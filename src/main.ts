import { Game } from './game/Game';

const bootStatus = document.getElementById('boot-status');
function logBoot(msg: string): void {
  if (bootStatus) bootStatus.textContent = `boot: ${msg}`;
  // eslint-disable-next-line no-console
  console.log('[boot]', msg);
}

function showError(label: string, err: unknown): void {
  const overlay = document.createElement('pre');
  overlay.style.cssText =
    'position:fixed;inset:0;margin:0;padding:16px;z-index:9999;' +
    'background:rgba(20,0,0,0.92);color:#ffd0d0;font:12px/1.4 monospace;' +
    'white-space:pre-wrap;overflow:auto;';
  const message =
    err instanceof Error
      ? `${err.name}: ${err.message}\n\n${err.stack ?? ''}`
      : String(err);
  overlay.textContent = `${label}\n\n${message}`;
  document.body.appendChild(overlay);
  console.error(label, err);
}

window.addEventListener('error', (e) => showError('window.onerror', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showError('unhandledrejection', e.reason));

logBoot('js module entered');

try {
  const root = document.getElementById('app');
  if (!root) throw new Error('Missing #app root element');
  logBoot(`baseUrl=${import.meta.env.BASE_URL}`);
  const game = new Game(root);
  logBoot('Game constructed, starting...');
  game
    .start()
    .then(() => {
      logBoot('Game running');
      // Fade boot status after success.
      setTimeout(() => bootStatus?.remove(), 1500);
    })
    .catch((err) => showError('Failed to start game', err));
  (window as unknown as { game: Game }).game = game;
} catch (err) {
  showError('Bootstrap error', err);
}