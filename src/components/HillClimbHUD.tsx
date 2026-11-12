import React, { useRef, useEffect } from 'react';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Fuel,
  Trophy,
  Award,
  Map,
  Star,
  ArrowRight,
  Flag,
  Sun,
  Sunset,
  Moon,
  Lightbulb,
  Shield,
} from 'lucide-react';
import { HillClimbState } from '../game/types';

interface HillClimbHUDProps {
  state: HillClimbState;
  bestDistance: number;
  walletCoins: number;
  coinIconUrl: string;
  isMuted: boolean;
  hasNextLevel: boolean;
  onToggleMute: () => void;
  onRestart: () => void;
  onOpenLevels: () => void;
  onNextLevel: () => void;
  stuntMessage: string | null;
  activeControls: { gas: boolean; brake: boolean };
  onPedalPress: (pedal: 'gas' | 'brake') => void;
  onPedalRelease: (pedal: 'gas' | 'brake') => void;
}

export const HillClimbHUD: React.FC<HillClimbHUDProps> = ({
  state,
  bestDistance,
  walletCoins,
  coinIconUrl,
  isMuted,
  hasNextLevel,
  onToggleMute,
  onRestart,
  onOpenLevels,
  onNextLevel,
  stuntMessage,
  activeControls,
  onPedalPress,
  onPedalRelease,
}) => {
  const brakePointersRef = useRef<Set<number>>(new Set());
  const gasPointersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const clearAll = () => {
      if (brakePointersRef.current.size > 0) {
        brakePointersRef.current.clear();
        onPedalRelease('brake');
      }
      if (gasPointersRef.current.size > 0) {
        gasPointersRef.current.clear();
        onPedalRelease('gas');
      }
    };
    window.addEventListener('blur', clearAll);
    const onVis = () => {
      if (document.hidden) clearAll();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', clearAll);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [onPedalRelease]);

  const handlePointerDown = (pedal: 'gas' | 'brake', e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const set = pedal === 'gas' ? gasPointersRef.current : brakePointersRef.current;
    set.add(e.pointerId);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
    onPedalPress(pedal);
  };

  const handlePointerEnd = (pedal: 'gas' | 'brake', e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const set = pedal === 'gas' ? gasPointersRef.current : brakePointersRef.current;
    set.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    if (set.size === 0) {
      onPedalRelease(pedal);
    }
  };

  const handleLostCapture = (pedal: 'gas' | 'brake', e: React.PointerEvent<HTMLButtonElement>) => {
    const set = pedal === 'gas' ? gasPointersRef.current : brakePointersRef.current;
    set.delete(e.pointerId);
    if (set.size === 0) {
      onPedalRelease(pedal);
    }
  };

  const handleTouchStart = (pedal: 'gas' | 'brake', e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onPedalPress(pedal);
  };

  const handleTouchEnd = (pedal: 'gas' | 'brake', e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (e.targetTouches.length === 0) {
      const set = pedal === 'gas' ? gasPointersRef.current : brakePointersRef.current;
      set.clear();
      onPedalRelease(pedal);
    }
  };

  const fuelPct = Math.max(0, Math.min(100, state.fuel));
  const healthPct = Math.max(0, Math.min(100, state.health));
  const isLowFuel = fuelPct < 25;
  const isLowHealth = healthPct <= 35;
  const levelProgressPct = Math.min(
    100,
    Math.round((state.distance / Math.max(1, state.levelLength)) * 100)
  );

  const renderTimeIcon = () => {
    if (state.timeOfDay === 'Night') return <Moon className="w-3 h-3 text-indigo-300" />;
    if (state.timeOfDay === 'Sunset') return <Sunset className="w-3 h-3 text-orange-300" />;
    return <Sun className="w-3 h-3 text-amber-300" />;
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-2.5 sm:p-4 font-sans">
      {/* === TOP FIXED HUD STACK (Zero overlap with car, mascot, road, or coins) === */}
      <div className="w-full flex flex-col items-center gap-2 pointer-events-none">
        {/* ROW 1: Distance/Level (Left) + Coins & Actions (Right) */}
        <div className="w-full flex items-start justify-between gap-2 pointer-events-auto">
          {/* Left: Level & Distance Progress */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="bg-slate-950/92 border border-slate-700/80 rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 shadow-lg flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[10px] font-black uppercase tracking-wider shrink-0">
                  LVL {state.levelId}
                </span>
                <span className="text-[11px] sm:text-xs font-extrabold text-slate-200 truncate max-w-[105px] sm:max-w-[210px]">
                  {state.levelName}
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-lg sm:text-2xl font-black text-white leading-none">
                  {state.distance}
                </span>
                <span className="font-mono text-[11px] sm:text-xs font-bold text-slate-400">
                  / {state.levelLength}M
                </span>
                <Flag className="w-3 h-3 text-emerald-400 ml-0.5" />
              </div>

              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-150"
                  style={{ width: `${levelProgressPct}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {bestDistance > 0 && (
                <div className="flex items-center gap-1 bg-slate-950/85 border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] text-amber-300 font-bold w-fit">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  <span>BEST: {bestDistance}m</span>
                </div>
              )}

              <div className="flex items-center gap-1 bg-slate-950/85 border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] text-slate-300 font-bold w-fit">
                {renderTimeIcon()}
                <span>{state.timeOfDay}</span>
                {state.headlightsOn && (
                  <Lightbulb className="w-3 h-3 text-yellow-300 ml-0.5" />
                )}
              </div>
            </div>
          </div>

          {/* Right: Optimum Coins + Level Select + Restart + Audio */}
          <div className="flex items-start gap-1.5 sm:gap-2 shrink-0">
            <div className="bg-slate-950/92 border border-slate-700/80 rounded-2xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 shadow-lg flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-900 border border-slate-700 p-1 flex items-center justify-center shrink-0">
                <img
                  src={coinIconUrl}
                  alt="Optimum Coin"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none">
                  Coins
                </span>
                <span className="font-mono text-base sm:text-xl font-black text-white leading-tight">
                  {state.coinsCollected}
                </span>
                <span className="text-[9px] text-slate-400 font-mono leading-none">
                  Bank: {walletCoins.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                onClick={onOpenLevels}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-950/92 hover:bg-slate-800 border border-sky-500/50 text-sky-300 rounded-xl shadow-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-black uppercase"
                title="Main Menu / Levels (1-10)"
              >
                <Map className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Levels</span>
              </button>

              <div className="flex gap-1.5">
                <button
                  onClick={onRestart}
                  className="p-2 bg-slate-950/92 hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded-xl shadow-lg transition-colors cursor-pointer"
                  title="Restart Level (R)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onToggleMute}
                  className="p-2 bg-slate-950/92 hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded-xl shadow-lg transition-colors cursor-pointer"
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: TOP-CENTER COMPACT FUEL & HULL BAR (Below Distance & Game HUD) */}
        <div className="pointer-events-auto flex items-center justify-center gap-2 flex-wrap">
          <div
            className={`flex items-center gap-1.5 bg-slate-950/92 border rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-xl ${
              isLowFuel ? 'border-rose-500/90' : 'border-slate-700/80'
            }`}
          >
            <Fuel
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                isLowFuel ? 'text-rose-500' : 'text-amber-400'
              }`}
            />
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-300">
              FUEL
            </span>
            <div className="w-20 sm:w-32 h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-100 ${
                  isLowFuel
                    ? 'bg-rose-500'
                    : fuelPct < 50
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${fuelPct}%` }}
              />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-mono font-black w-8 text-right ${
                isLowFuel ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {Math.round(fuelPct)}%
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 bg-slate-950/92 border rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-xl ${
              isLowHealth ? 'border-rose-500/90' : 'border-slate-700/80'
            }`}
          >
            <Shield
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${
                isLowHealth ? 'text-rose-500' : 'text-sky-400'
              }`}
            />
            <div className="w-14 sm:w-20 h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  isLowHealth
                    ? 'bg-rose-500'
                    : healthPct < 65
                    ? 'bg-amber-400'
                    : 'bg-sky-400'
                }`}
                style={{ width: `${healthPct}%` }}
              />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-mono font-black w-8 text-right ${
                isLowHealth ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {Math.round(healthPct)}%
            </span>
          </div>
        </div>

        {stuntMessage && (
          <div className="bg-amber-400 text-slate-950 border border-amber-200 px-3.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 font-black text-xs tracking-wide">
            <Award className="w-3.5 h-3.5 text-slate-950" />
            <span>{stuntMessage}</span>
          </div>
        )}
      </div>

      {/* === BOTTOM PEDAL CONTROLS (Pointer Capture + Touch + Desktop) === */}
      <div className="w-full flex justify-between items-end pb-1 sm:pb-3 px-1 sm:px-4 pointer-events-auto">
        <button
          type="button"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => handlePointerDown('brake', e)}
          onPointerUp={(e) => handlePointerEnd('brake', e)}
          onPointerCancel={(e) => handlePointerEnd('brake', e)}
          onLostPointerCapture={(e) => handleLostCapture('brake', e)}
          onTouchStart={(e) => handleTouchStart('brake', e)}
          onTouchEnd={(e) => handleTouchEnd('brake', e)}
          onTouchCancel={(e) => handleTouchEnd('brake', e)}
          className={`w-24 h-20 sm:w-32 sm:h-28 rounded-2xl sm:rounded-3xl border-3 sm:border-4 shadow-[0_8px_20px_rgba(244,63,94,0.35)] flex flex-col items-center justify-center text-white cursor-pointer transition-transform touch-none select-none ${
            activeControls.brake
              ? 'bg-gradient-to-b from-rose-600 to-rose-800 border-rose-300 scale-95'
              : 'bg-gradient-to-b from-rose-900 to-rose-950 border-rose-500/85'
          }`}
        >
          <span className="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-widest text-rose-300 pointer-events-none">
            [A / ←]
          </span>
          <span className="text-base sm:text-2xl font-black tracking-wider uppercase text-white pointer-events-none">
            BRAKE
          </span>
          <span className="text-[9px] sm:text-[10px] font-bold text-rose-200 uppercase tracking-wider pointer-events-none">
            REVERSE
          </span>
        </button>

        <button
          type="button"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={(e) => handlePointerDown('gas', e)}
          onPointerUp={(e) => handlePointerEnd('gas', e)}
          onPointerCancel={(e) => handlePointerEnd('gas', e)}
          onLostPointerCapture={(e) => handleLostCapture('gas', e)}
          onTouchStart={(e) => handleTouchStart('gas', e)}
          onTouchEnd={(e) => handleTouchEnd('gas', e)}
          onTouchCancel={(e) => handleTouchEnd('gas', e)}
          className={`w-24 h-20 sm:w-32 sm:h-28 rounded-2xl sm:rounded-3xl border-3 sm:border-4 shadow-[0_8px_20px_rgba(16,185,129,0.35)] flex flex-col items-center justify-center text-white cursor-pointer transition-transform touch-none select-none ${
            activeControls.gas
              ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 border-emerald-300 scale-95'
              : 'bg-gradient-to-b from-emerald-900 to-emerald-950 border-emerald-500/85'
          }`}
        >
          <span className="text-[9px] sm:text-[11px] font-extrabold uppercase tracking-widest text-emerald-300 pointer-events-none">
            [D / →]
          </span>
          <span className="text-base sm:text-2xl font-black tracking-wider uppercase text-white pointer-events-none">
            GAS
          </span>
          <span className="text-[9px] sm:text-[10px] font-bold text-emerald-200 uppercase tracking-wider pointer-events-none">
            ACCELERATE
          </span>
        </button>
      </div>

      {/* === GAME OVER MODAL === */}
      {state.isCrashed && !state.isLevelComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/82 pointer-events-auto">
          <div className="relative w-full max-w-sm bg-slate-950 border-2 border-rose-500/85 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-900 border-2 border-slate-700 overflow-hidden shadow-xl mb-3">
              <img
                src="/assets/aistudio/Screenshot_2026_1111_185946_3a195c90.png"
                alt="Driver"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="px-3 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/50 text-rose-300 text-[10px] font-black uppercase tracking-widest mb-1">
              GAME OVER
            </div>

            <h2 className="text-2xl font-black tracking-tight uppercase text-white">
              {state.crashReason || 'Crashed!'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Level {state.levelId}: {state.levelName}
            </p>

            <div className="w-full grid grid-cols-2 gap-2 my-4">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Distance Travelled
                </span>
                <span className="font-mono text-xl font-black text-white">
                  {state.distance}m
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Coins Collected
                </span>
                <span className="font-mono text-xl font-black text-amber-300">
                  {state.coinsCollected}
                </span>
              </div>
            </div>

            <div className="w-full flex gap-2">
              <button
                onClick={onOpenLevels}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Map className="w-4 h-4" />
                Main Menu
              </button>
              <button
                onClick={onRestart}
                className="flex-[1.5] py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-slate-950" />
                Restart Level
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === LEVEL COMPLETED CELEBRATION MODAL === */}
      {state.isLevelComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/82 pointer-events-auto">
          <div className="relative w-full max-w-sm bg-slate-950 border-2 border-emerald-400/90 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="px-3.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-xs font-black uppercase tracking-wider mb-2">
              LEVEL {state.levelId} COMPLETED!
            </div>

            <h2 className="text-2xl font-black tracking-tight text-white">
              {state.levelName}
            </h2>

            {/* 3-Star Rating */}
            <div className="flex items-center justify-center gap-2 my-3">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`w-10 h-10 transition-transform duration-300 ${
                    s <= state.starsEarned
                      ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]'
                      : 'text-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* Score, Coins & Bonus */}
            <div className="w-full grid grid-cols-3 gap-2 my-3">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Score</span>
                <span className="font-mono text-base font-black text-sky-300">
                  {state.score.toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Coins</span>
                <span className="font-mono text-base font-black text-white">
                  +{state.coinsCollected}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Bonus</span>
                <span className="font-mono text-base font-black text-emerald-400">
                  +{state.bonusReward}
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 mt-2">
              {hasNextLevel && (
                <button
                  onClick={onNextLevel}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-400 to-sky-400 hover:from-emerald-300 hover:to-sky-300 text-slate-950 font-black text-base uppercase tracking-wider rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Next Level Unlocked</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}

              <div className="w-full flex gap-2">
                <button
                  onClick={onOpenLevels}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Map className="w-4 h-4" />
                  Main Menu
                </button>
                <button
                  onClick={onRestart}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Replay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
