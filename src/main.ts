import { Game } from './game/Game';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');

const game = new Game(root);
game.start().catch((err) => {
  console.error('Failed to start game', err);
});

// Expose for debugging in dev tools.
(window as unknown as { game: Game }).game = game;
