'use client';

import { useState } from 'react';

import GameCanvas from '@/components/GameCanvas';
import { Button } from '@/components/ui/8bit/button';

export default function Home() {
  const [zoom, setZoom] = useState<number | null>(null);

  return (
    <main className="fixed inset-0 touch-none select-none bg-[#050508]">
      <GameCanvas onScaleChange={setZoom} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <span className="retro text-xs text-white/80">
          {zoom === null ? 'loading…' : zoom >= 1 ? `scale ×${zoom}` : `scale ×${zoom.toFixed(2)}`}
        </span>
        <Button className="pointer-events-auto" font="retro">
          Pixel Horizons
        </Button>
      </div>
    </main>
  );
}
