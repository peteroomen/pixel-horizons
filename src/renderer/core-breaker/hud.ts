/**
 * FOUNDRY-styled Core Breaker HUD (Pixi). A header panel (biome + countdown + haul counters) and
 * a roster tray (armed-ball preview + cosmetic pips + queue previews + reprint/return buttons),
 * drawn as chamfered FOUNDRY panels matching `docs/design/mining-run-v2.dc.html`.
 *
 * Self-contained in the renderer layer (used by both the standalone route and the main game). The
 * v2 sim has no bounce budget, so the armed-ball pips are a static cosmetic count per ball type
 * (live bounce-countdown is deferred juice).
 */

import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';

import type { Resources } from '@/game/sim/run-state';
import type { BallType } from '@/game/surface/core-breaker';
import type { RosterBall } from '@/game/surface/ball-projection';

// FOUNDRY palette.
const PANEL_OUTER = 0x3a3e48;
const PANEL_INNER = 0x11131c;
const INSET = 0x16181d;
const DIVIDER = 0x23262d;
const LABEL_DIM = 0x6a6d76;
const READOUT = 0xe8e6e0;
const ORANGE = 0xff9e2c;
const ORANGE_DK = 0x2a1c10;
const STEEL = 0x9aa0ad;
const STEEL_DK = 0x23262d;
const PIP_OFF = 0x3a2c14;
const SCRAP_COL = 0x9aa0ad;
const BIO_COL = 0x8ac926;
const CORE_COL = 0x6ad1e3;

// Static cosmetic pip counts per ball type (prototype BMETA.maxB) — decorative only.
const BALL_PIPS: Record<BallType, number> = {
  standard: 8,
  heavy: 5,
  split: 6,
  drill: 4,
  ghost: 10,
};

const BALL_LABEL: Record<BallType, string> = {
  standard: 'STANDARD',
  heavy: 'HEAVY',
  split: 'SPLIT',
  drill: 'DRILL',
  ghost: 'GHOST',
};

export interface HudState {
  biome: string;
  timerSecs: number;
  haul: Resources;
  armed: RosterBall | null;
  queue: RosterBall[];
  remaining: number;
  /** null ⇒ reprint maxed out. */
  reprint: { cost: number; enabled: boolean } | null;
}

export interface HudOptions {
  columnWidth: number;
  columnHeight: number;
  headerH: number;
  trayH: number;
  ballTextures: Record<BallType, Texture>;
  onReprint: () => void;
  onReturn: () => void;
}

export interface HudHandle {
  container: Container;
  update(state: HudState): void;
  destroy(): void;
}

/** Resolve a CSS custom property (font stack) to a concrete family name; monospace fallback. */
function resolveFont(cssVar: string): string {
  try {
    const probe = document.createElement('span');
    probe.style.fontFamily = `var(${cssVar})`;
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    return family && family.trim() !== '' ? family : 'monospace';
  } catch {
    return 'monospace';
  }
}

/** Filled chamfered panel (top-left + bottom-right corners cut) — the FOUNDRY clip shape. */
function chamfer(g: Graphics, x: number, y: number, w: number, h: number, ch: number): Graphics {
  return g.poly([x + ch, y, x + w, y, x + w, y + h - ch, x + w - ch, y + h, x, y + h, x, y + ch]);
}

function panel(g: Graphics, x: number, y: number, w: number, h: number, ch: number): void {
  chamfer(g, x, y, w, h, ch).fill(PANEL_OUTER);
  chamfer(g, x + 2, y + 2, w - 4, h - 4, ch - 1).fill(PANEL_INNER);
}

export function createHud(opts: HudOptions): HudHandle {
  const { columnWidth: W, columnHeight: H, headerH, trayH } = opts;
  const labelFont = resolveFont('--font-label');
  const readoutFont = resolveFont('--font-readout');

  const container = new Container();
  container.eventMode = 'static';

  // ── Static panel chrome (drawn once) ──────────────────────────────────────
  const chrome = new Graphics();
  // Header: left (biome+timer) and right (haul) panels.
  const headerSplit = Math.round(W * 0.5);
  panel(chrome, 4, 4, headerSplit - 6, headerH - 8, 8);
  panel(chrome, headerSplit + 2, 4, W - headerSplit - 6, headerH - 8, 8);
  // Roster tray (full-width panel anchored to the bottom).
  const trayY = H - trayH;
  panel(chrome, 4, trayY + 4, W - 8, trayH - 8, 10);
  // Divider between armed/queue rows.
  chrome.rect(14, trayY + 78, W - 28, 1).fill(DIVIDER);
  // Armed-ball inset box.
  chrome.rect(16, trayY + 14, 48, 48).fill(INSET);
  container.addChild(chrome);

  // ── Header text ────────────────────────────────────────────────────────────
  const biomeText = new Text({
    text: '',
    style: { fontFamily: labelFont, fontSize: 8, fill: LABEL_DIM, letterSpacing: 1 },
  });
  biomeText.position.set(12, 14);
  const timerText = new Text({
    text: '',
    style: { fontFamily: readoutFont, fontSize: 20, fill: READOUT },
  });
  timerText.position.set(12, 26);
  container.addChild(biomeText, timerText);

  // Haul rows (icon + count) in the right header panel.
  const haulIcons = new Graphics();
  container.addChild(haulIcons);
  const haulX = headerSplit + 12;
  const scrapCount = makeCount(readoutFont);
  const bioCount = makeCount(readoutFont);
  const coreCount = makeCount(readoutFont);
  scrapCount.position.set(haulX + 16, 12);
  bioCount.position.set(haulX + 16, 28);
  coreCount.position.set(haulX + 16, 44);
  container.addChild(scrapCount, bioCount, coreCount);

  // ── Roster tray ──────────────────────────────────────────────────────────
  const armedSprite = new Sprite(opts.ballTextures.standard);
  armedSprite.anchor.set(0.5);
  armedSprite.position.set(40, trayY + 38);
  container.addChild(armedSprite);

  const armedLabel = new Text({
    text: '',
    style: { fontFamily: labelFont, fontSize: 9, fill: ORANGE, letterSpacing: 1 },
  });
  armedLabel.position.set(74, trayY + 16);
  const armedTag = new Text({
    text: 'ARMED',
    style: { fontFamily: labelFont, fontSize: 6, fill: ORANGE, letterSpacing: 1 },
  });
  armedTag.position.set(16, trayY + 4);
  container.addChild(armedLabel, armedTag);

  const pips = new Graphics();
  container.addChild(pips);

  const queueTag = new Text({
    text: '',
    style: { fontFamily: labelFont, fontSize: 6, fill: LABEL_DIM, letterSpacing: 1 },
  });
  queueTag.position.set(74, trayY + 40);
  container.addChild(queueTag);

  const queueSprites: Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const box = new Graphics();
    box.rect(74 + i * 36, trayY + 52, 30, 30).fill(INSET);
    container.addChild(box);
    const s = new Sprite(opts.ballTextures.standard);
    s.anchor.set(0.5);
    s.position.set(74 + i * 36 + 15, trayY + 52 + 15);
    s.visible = false;
    queueSprites.push(s);
    container.addChild(s);
  }
  const overflow = new Text({
    text: '',
    style: { fontFamily: readoutFont, fontSize: 14, fill: LABEL_DIM },
  });
  overflow.position.set(74 + 3 * 36, trayY + 58);
  container.addChild(overflow);

  // ── Action buttons ──────────────────────────────────────────────────────────
  const btnY = trayY + 86;
  const btnH = trayH - 96;
  const btnW = (W - 8 - 24 - 8) / 2;
  const reprintBtn = makeButton(
    8 + 8,
    btnY,
    btnW,
    btnH,
    ORANGE_DK,
    ORANGE,
    labelFont,
    opts.onReprint,
  );
  const returnBtn = makeButton(
    8 + 8 + btnW + 8,
    btnY,
    btnW,
    btnH,
    STEEL_DK,
    STEEL,
    labelFont,
    opts.onReturn,
  );
  returnBtn.label.text = 'RETURN ▸ KEEP HAUL';
  container.addChild(reprintBtn.container, returnBtn.container);

  // ── Update ───────────────────────────────────────────────────────────────
  function update(s: HudState): void {
    biomeText.text = s.biome.toUpperCase();
    const secs = Math.max(0, Math.ceil(s.timerSecs));
    timerText.text = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

    scrapCount.text = String(s.haul.scrap);
    bioCount.text = String(s.haul.biominerals);
    coreCount.text = String(s.haul.coreCrystals);

    haulIcons.clear();
    // Scrap — grey square.
    haulIcons.rect(haulX, 13, 9, 9).fill(SCRAP_COL);
    // Biominerals — green pentagon.
    haulIcons
      .poly([haulX + 4.5, 29, haulX + 9, 32.5, haulX + 7.3, 38, haulX + 1.7, 38, haulX, 32.5])
      .fill(BIO_COL);
    // Core — cyan diamond.
    haulIcons.poly([haulX + 4.5, 45, haulX + 9, 49.5, haulX + 4.5, 54, haulX, 49.5]).fill(CORE_COL);

    // Armed ball.
    if (s.armed) {
      armedSprite.visible = true;
      armedSprite.texture = opts.ballTextures[s.armed.type];
      armedSprite.scale.set(fitScale(armedSprite.texture, 40));
      armedLabel.text = BALL_LABEL[s.armed.type];
      drawPips(pips, 74, trayY + 30, BALL_PIPS[s.armed.type]);
    } else {
      armedSprite.visible = false;
      armedLabel.text = 'RUN COMPLETE';
      pips.clear();
    }

    queueTag.text = `ROSTER ▸ ${s.remaining} PROBES`;
    for (let i = 0; i < 3; i++) {
      const q = s.queue[i];
      if (q) {
        queueSprites[i].visible = true;
        queueSprites[i].texture = opts.ballTextures[q.type];
        queueSprites[i].scale.set(fitScale(queueSprites[i].texture, 22));
      } else {
        queueSprites[i].visible = false;
      }
    }
    overflow.text = s.queue.length > 3 ? `+${s.queue.length - 3}` : '';

    // Reprint button state.
    if (s.reprint === null) {
      reprintBtn.label.text = 'REPRINT ▸ MAX';
      reprintBtn.setEnabled(false);
    } else {
      reprintBtn.label.text = `REPRINT ▸ ${s.reprint.cost} SCRAP`;
      reprintBtn.setEnabled(s.reprint.enabled);
    }
  }

  return {
    container,
    update,
    destroy(): void {
      container.destroy({ children: true });
    },
  };
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function makeCount(font: string): Text {
  return new Text({ text: '0', style: { fontFamily: font, fontSize: 17, fill: READOUT } });
}

function fitScale(texture: Texture, target: number): number {
  return Math.max(1, Math.floor(target / Math.max(texture.width, texture.height)));
}

function drawPips(g: Graphics, x: number, y: number, count: number): void {
  g.clear();
  for (let i = 0; i < count; i++) {
    g.rect(x + i * 6, y, 4, 7).fill(i < count ? ORANGE : PIP_OFF);
  }
}

interface ButtonHandle {
  container: Container;
  label: Text;
  setEnabled(enabled: boolean): void;
}

function makeButton(
  x: number,
  y: number,
  w: number,
  h: number,
  bg: number,
  fg: number,
  font: string,
  onTap: () => void,
): ButtonHandle {
  const container = new Container();
  container.position.set(x, y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  const g = new Graphics();
  const ch = 8;
  g.poly([ch, 0, w, 0, w, h - ch, w - ch, h, 0, h, 0, ch]).fill(bg);
  container.addChild(g);

  const label = new Text({
    text: '',
    style: { fontFamily: font, fontSize: 8, fill: fg, letterSpacing: 1, align: 'center' },
  });
  label.anchor.set(0.5);
  label.position.set(w / 2, h / 2);
  container.addChild(label);

  let enabled = true;
  // Swallow the pointerdown so the field-aim handler on the stage doesn't also fire.
  container.on('pointerdown', (e) => {
    e.stopPropagation();
  });
  container.on('pointertap', () => {
    if (enabled) onTap();
  });

  return {
    container,
    label,
    setEnabled(next: boolean): void {
      enabled = next;
      container.alpha = next ? 1 : 0.4;
      container.cursor = next ? 'pointer' : 'default';
    },
  };
}
