import { Application, Container, Graphics, Sprite } from 'pixi.js';

import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './pixel-scale';

const TILE = 8;
const MOVER_SIZE = 16;
const MOVER_SPEED = 90; // virtual px per second

/**
 * Throwaway scene proving the pixel-perfect rendering contract: checkerboard background,
 * static sprites at odd offsets (half-pixel blur check), a 1px border (edge crispness),
 * and one sprite moving at constant speed (tearing/blur check). No game logic.
 */
export function buildTestScene(app: Application): void {
  const scene = new Container();
  app.stage.addChild(scene);

  const checker = new Graphics();
  for (let ty = 0; ty < VIRTUAL_HEIGHT / TILE; ty++) {
    for (let tx = 0; tx < VIRTUAL_WIDTH / TILE; tx++) {
      if ((tx + ty) % 2 === 0) {
        checker.rect(tx * TILE, ty * TILE, TILE, TILE).fill(0x16213e);
      }
    }
  }
  scene.addChild(checker);

  const border = new Graphics()
    .rect(0, 0, VIRTUAL_WIDTH, 1)
    .rect(0, VIRTUAL_HEIGHT - 1, VIRTUAL_WIDTH, 1)
    .rect(0, 0, 1, VIRTUAL_HEIGHT)
    .rect(VIRTUAL_WIDTH - 1, 0, 1, VIRTUAL_HEIGHT)
    .fill(0xe94560);
  scene.addChild(border);

  const spriteSource = new Graphics()
    .rect(0, 0, MOVER_SIZE, MOVER_SIZE)
    .fill(0xe94560)
    .rect(4, 4, MOVER_SIZE - 8, MOVER_SIZE - 8)
    .fill(0xffffff);
  const texture = app.renderer.generateTexture({ target: spriteSource, resolution: 1 });

  // Odd coordinates on purpose: any half-pixel offset or AA shows up immediately.
  for (const [x, y] of [
    [7, 13],
    [617, 13],
    [7, 331],
    [617, 331],
  ]) {
    const corner = new Sprite(texture);
    corner.position.set(x, y);
    scene.addChild(corner);
  }

  const mover = new Sprite(texture);
  mover.y = VIRTUAL_HEIGHT / 2 - MOVER_SIZE / 2;
  scene.addChild(mover);

  let distance = 0;
  app.ticker.add((ticker) => {
    distance += (MOVER_SPEED * ticker.deltaMS) / 1000;
    mover.x = (distance % (VIRTUAL_WIDTH + MOVER_SIZE)) - MOVER_SIZE;
  });
}
