import React from 'react';
import { X, Lock, Star, Flag, Trophy, Play } from 'lucide-react';
import { LEVELS } from '../game/levels';
import { LevelConfig, ProgressMap } from '../game/types';

interface LevelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevelId: number;
  progress: ProgressMap;
  walletCoins: number;
  coinIconUrl: string;
  onSelectLevel: (level: LevelConfig) => void;
}

const DIFFICULTY_STYLES: Record<LevelConfig['difficulty'], string> = {
  Easy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  Medium: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  Hard: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  Expert: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  Extreme: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  Impossible: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  isOpen,
  onClose,
  currentLevelId,
  progress,
  walletCoins,
  coinIconUrl,
  onSelectLevel,
}) => {
  if (!isOpen) return null;

  const totalStars = LEVELS.reduce((acc, lvl) => acc + (progress[lvl.id]?.stars || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 pointer-events-auto">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-950 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 p-1 flex items-center justify-center">
              <img
                src="/assets/aistudio/Screenshot_2026_1111_185946_3a195c90.png"
                alt="Optimum Mascot"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                SELECT STAGE (10 LEVELS)
              </h2>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold">
                <span className="flex items-center gap-1 text-amber-300">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {totalStars} / 30 Stars
                </span>
                <span className="flex items-center gap-1 text-slate-200">
                  <img src={coinIconUrl} alt="" className="w-4 h-3.5 object-contain" />
                  {walletCoins.toLocaleString()} Bank
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 10 Level Cards Grid */}
        <div className="p-3 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEVELS.map((lvl) => {
            const prog = progress[lvl.id] || {
              unlocked: lvl.id === 1,
              completed: false,
              stars: 0,
              bestDistance: 0,
              bestCoins: 0,
            };
            const isCurrent = lvl.id === currentLevelId;

            return (
              <button
                key={lvl.id}
                disabled={!prog.unlocked}
                onClick={() => {
                  if (prog.unlocked) {
                    onSelectLevel(lvl);
                    onClose();
                  }
                }}
                className={`relative text-left rounded-2xl p-3.5 border transition-all flex flex-col justify-between gap-2.5 ${
                  !prog.unlocked
                    ? 'bg-slate-900/40 border-slate-800/70 opacity-60 cursor-not-allowed'
                    : isCurrent
                    ? 'bg-slate-900 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)] cursor-pointer'
                    : 'bg-slate-900/80 hover:bg-slate-900 border-slate-700/80 hover:border-slate-500 cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white border border-white/20 shrink-0"
                      style={{
                        backgroundColor: `#${lvl.roadColor.toString(16).padStart(6, '0')}33`,
                        borderColor: `#${lvl.curbColor.toString(16).padStart(6, '0')}88`,
                      }}
                    >
                      {prog.unlocked ? lvl.id : <Lock className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-black text-white leading-snug">
                        {lvl.name}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{lvl.subtitle}</div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${
                      DIFFICULTY_STYLES[lvl.difficulty]
                    }`}
                  >
                    {lvl.difficulty}
                  </span>
                </div>

                {/* Bottom stats & 3-star rating */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-3 text-slate-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Flag className="w-3 h-3 text-emerald-400" />
                      {lvl.length}m
                    </span>
                    {prog.bestDistance > 0 && (
                      <span className="flex items-center gap-1 text-slate-300">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        {prog.bestDistance}m
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 3 Stars */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= prog.stars
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>

                    {prog.unlocked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500 text-slate-950 font-black text-[10px] uppercase">
                        <Play className="w-2.5 h-2.5 fill-slate-950" />
                        {isCurrent ? 'Active' : 'Play'}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
