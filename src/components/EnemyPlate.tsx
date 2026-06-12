'use client';

import type { CombatView, IntentDetail, IntentView } from '@/game/main';
import Plate from '@/components/foundry/Plate';
import StatBar from '@/components/foundry/StatBar';

interface EnemyPlateProps {
  view: CombatView;
}

export default function EnemyPlate({ view }: EnemyPlateProps) {
  const revealed = view.intent.detail !== null;

  return (
    <Plate
      chamfer="chamfer-6 sm:chamfer-10"
      fillClassName="bg-fd-plate p-2.5 sm:p-4"
      className="pointer-events-none"
    >
      <div className="space-y-1.5 sm:space-y-2.5">
        {/* Name + HP row */}
        <div className="flex items-baseline justify-between">
          <span className="font-label text-[8px] sm:text-fd-label text-fd-muted uppercase">
            {view.enemyName}
          </span>
          <span className="font-readout text-[18px] sm:text-fd-numeral text-fd-ink">
            {view.enemyHp}/{view.enemyMaxHp}
          </span>
        </div>

        {/* HP bar */}
        <StatBar value={view.enemyHp} max={view.enemyMaxHp} fillClassName="bg-fd-red" />
      </div>

      {/* Intent chip — fused directly under the HP bar, zero gap */}
      <div
        className={`chamfer chamfer-5 sm:chamfer-8 mt-0 px-2 py-1.5 sm:px-3 sm:py-2 ${
          revealed ? 'bg-fd-red text-fd-ink-dark' : 'bg-fd-strip text-fd-muted'
        }`}
      >
        <span className="font-label text-[6px] sm:text-fd-tag uppercase">Intent</span>
        <div className="font-readout text-[13px] sm:text-fd-intent">
          {revealed ? intentText(view.intent) : '???'}
        </div>
      </div>
    </Plate>
  );
}

function intentText(intent: IntentView): string {
  if (intent.detail === null) return '???';
  return `${intent.name} ${intentDetailText(intent.detail)}`;
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
