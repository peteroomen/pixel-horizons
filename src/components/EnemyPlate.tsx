'use client';

import type { CombatView, IntentDetail, IntentView } from '@/game/main';
import Plate from '@/components/foundry/Plate';
import StatBar from '@/components/foundry/StatBar';

interface EnemyPlateProps {
  view: CombatView;
}

const INTENT_KIND_LABELS: Record<IntentView['kind'], string> = {
  attack: 'ATTACK',
  'attack-module': 'MODULE HIT',
  inject: 'INJECT',
};

export default function EnemyPlate({ view }: EnemyPlateProps) {
  return (
    <Plate
      chamfer="chamfer-6 sm:chamfer-10"
      fillClassName="bg-fd-plate p-2.5 sm:p-4"
      className="pointer-events-none flex-1 sm:flex-none sm:w-[460px]"
    >
      <div className="space-y-1.5 sm:space-y-2.5">
        {/* Name + armor + HP row */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-label text-[8px] sm:text-fd-label text-fd-muted uppercase">
            {view.boss && <span className="mr-1 text-fd-red">BOSS · </span>}
            {view.enemyName}
            {view.bossPhase !== null && view.bossPhase >= 0 && (
              <span className="ml-1 text-fd-red text-[7px] sm:text-[9px]">
                P{view.bossPhase + 2}
              </span>
            )}
          </span>
          <span className="flex items-baseline gap-1.5 sm:gap-2">
            {view.enemyArmor > 0 && (
              <span className="font-readout text-[13px] sm:text-fd-readout text-fd-amber">
                ⛨ {view.enemyArmor}
              </span>
            )}
            <span className="font-readout text-[18px] sm:text-fd-numeral text-fd-ink">
              {view.enemyHp}/{view.enemyMaxHp}
            </span>
          </span>
        </div>

        {/* HP bar */}
        <StatBar value={view.enemyHp} max={view.enemyMaxHp} fillClassName="bg-fd-red" />

        {/* Intent row — kind and name always visible; numbers only behind Deep Scan */}
        <div className="chamfer chamfer-5 sm:chamfer-8 bg-fd-strip flex items-center gap-1.5 px-1.5 py-1 sm:gap-2.5 sm:px-2.5 sm:py-2">
          <span className="shrink-0 bg-fd-red text-fd-ink-dark font-label uppercase text-[6px] sm:text-fd-tag px-1 py-0.5 sm:px-1.5">
            {INTENT_KIND_LABELS[view.intent.kind]}
          </span>
          <span className="min-w-0 font-readout text-[13px] sm:text-fd-intent text-fd-ink">
            {view.intent.name}
          </span>
          {view.intent.detail === null ? (
            <span className="ml-auto shrink-0 border border-fd-red text-fd-red font-label uppercase text-[6px] sm:text-fd-tag px-1 py-0.5 sm:px-1.5">
              DMG ?
            </span>
          ) : (
            <span className="ml-auto shrink-0 font-readout text-[13px] sm:text-fd-intent text-fd-red">
              {intentDetailText(view.intent.detail)}
            </span>
          )}
        </div>
      </div>
    </Plate>
  );
}

function intentDetailText(detail: IntentDetail): string {
  switch (detail.kind) {
    case 'attack':
      return `${detail.amount}${detail.hits > 1 ? `×${detail.hits}` : ''}${detail.piercing ? ' PIERCE' : ''}`;
    case 'attack-module':
      return `${detail.amount}${detail.piercing ? ' PIERCE' : ''}${
        detail.targeting === 'highest-value' ? ' → BEST MODULE' : ' → RANDOM MODULE'
      }`;
    case 'inject':
      return `×${detail.count} ${detail.cardName}`;
  }
}
