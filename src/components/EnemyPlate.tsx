'use client';

import type { CombatView, EnemyPartView, IntentDetail, IntentView } from '@/game/main';
import Plate from '@/components/foundry/Plate';
import StatBar from '@/components/foundry/StatBar';
import InfoChip from '@/components/foundry/InfoChip';
import { DamageFloaters, HitFlash, useDamageFloaters } from '@/components/combat-fx';

interface EnemyPlateProps {
  view: CombatView;
  onSelectTarget?: (target: number | null) => void;
}

const INTENT_KIND_LABELS: Record<IntentView['kind'], string> = {
  attack: 'ATTACK',
  'attack-module': 'MODULE HIT',
  inject: 'INJECT',
};

export default function EnemyPlate({ view, onSelectTarget }: EnemyPlateProps) {
  const core = useDamageFloaters(view.enemyHp);
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
            <span className="relative font-readout text-[18px] sm:text-fd-numeral text-fd-ink">
              {view.enemyHp}/{view.enemyMaxHp}
              <DamageFloaters floaters={core.floaters} onDone={core.remove} tone="enemy" />
            </span>
          </span>
        </div>

        {/* Core debuffs (GDD §5.10) — tap a chip to explain it */}
        {view.enemyStatuses.length > 0 && (
          <div className="pointer-events-auto flex flex-wrap items-center gap-1">
            {view.enemyStatuses.map((status) => (
              <InfoChip
                key={status.id}
                label={status.name}
                value={status.value}
                description={status.description}
                tone={status.tone}
              />
            ))}
          </div>
        )}

        {/* HP bar — tap to focus the core (GDD §5.4) when organs are present */}
        {view.enemyParts.length > 0 ? (
          <HitFlash hitKey={core.hitKey}>
            <button
              type="button"
              onClick={() => onSelectTarget?.(null)}
              className={`pointer-events-auto touch-manipulation block w-full rounded-sm border px-1.5 py-1 text-left ${
                view.targetIsCore
                  ? 'border-fd-orange bg-fd-orange/15'
                  : 'border-transparent active:bg-white/5'
              }`}
            >
              <div className="mb-0.5 flex items-baseline justify-between gap-1">
                <span className="font-label uppercase text-[7px] sm:text-[9px] text-fd-muted">
                  Core
                </span>
                {view.targetIsCore && <FocusTag />}
              </div>
              <StatBar value={view.enemyHp} max={view.enemyMaxHp} fillClassName="bg-fd-red" />
            </button>
          </HitFlash>
        ) : (
          <HitFlash hitKey={core.hitKey}>
            <StatBar value={view.enemyHp} max={view.enemyMaxHp} fillClassName="bg-fd-red" />
          </HitFlash>
        )}

        {/* Targetable organs (GDD §5.4): tap to focus single-target fire */}
        {view.enemyParts.length > 0 && (
          <div className="space-y-1">
            <div className="font-label uppercase text-[7px] sm:text-[9px] text-fd-orange">
              Tap a target to focus fire
            </div>
            {view.enemyParts.map((part, index) => (
              <OrganRow key={part.name} part={part} index={index} onSelectTarget={onSelectTarget} />
            ))}
          </div>
        )}

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

/** One targetable organ row, owning its own hit floater/flash keyed off its HP. */
function OrganRow({
  part,
  index,
  onSelectTarget,
}: {
  part: EnemyPartView;
  index: number;
  onSelectTarget?: (target: number | null) => void;
}) {
  const fx = useDamageFloaters(part.hp);
  return (
    <div>
      <HitFlash hitKey={fx.hitKey}>
        <button
          type="button"
          disabled={!part.alive}
          onClick={() => onSelectTarget?.(part.selected ? null : index)}
          className={`pointer-events-auto touch-manipulation block w-full rounded-sm border px-1.5 py-1 text-left ${
            part.alive ? 'active:bg-white/5' : 'opacity-40'
          } ${part.selected ? 'border-fd-orange bg-fd-orange/15' : 'border-fd-strip'}`}
        >
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-label uppercase text-[8px] sm:text-[9px] text-fd-amber">
              {part.name}
              <span className="ml-1 text-fd-muted">{part.ability}</span>
            </span>
            <span className="relative flex items-baseline gap-1.5">
              {part.selected && <FocusTag />}
              <span className="relative font-readout text-[11px] sm:text-[13px] text-fd-ink">
                {part.hp}/{part.maxHp}
                <DamageFloaters floaters={fx.floaters} onDone={fx.remove} tone="enemy" />
              </span>
            </span>
          </div>
          <StatBar
            value={part.hp}
            max={part.maxHp}
            fillClassName={part.alive ? 'bg-fd-amber' : 'bg-fd-muted'}
          />
        </button>
      </HitFlash>
      {/* This organ's debuffs (GDD §5.10) — sits below its row, tap to explain */}
      {part.alive && part.statuses.length > 0 && (
        <div className="pointer-events-auto mt-0.5 flex flex-wrap items-center gap-1 pl-1.5">
          {part.statuses.map((status) => (
            <InfoChip
              key={status.id}
              label={status.name}
              value={status.value}
              description={status.description}
              tone={status.tone}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The "this is what your single-target fire hits" badge (GDD §5.4). */
function FocusTag() {
  return (
    <span className="shrink-0 bg-fd-orange text-fd-ink-dark font-label uppercase text-[6px] sm:text-[8px] px-1 py-0.5">
      ◎ Target
    </span>
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
