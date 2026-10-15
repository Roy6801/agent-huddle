import { PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { player, usePlayer } from "@/demo/room";

/** WCAG 2.2.2: the moving conversation can be paused, resumed and replayed, by keyboard too. */
export function DemoControls() {
  const { playing } = usePlayer();
  return (
    <div role="group" aria-label="Demo playback" className="demo-controls">
      <span aria-hidden className="demo-label">
        Demo
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={playing ? "Pause demo" : "Play demo"}
        title={playing ? "Pause demo" : "Play demo"}
        onClick={playing ? player.pause : player.play}
      >
        {playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Replay demo" title="Replay demo" onClick={player.replay}>
        <RotateCcwIcon aria-hidden />
      </Button>
    </div>
  );
}
