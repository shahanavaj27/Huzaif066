import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { createHillClimbEngine, HillClimbEngine } from './game/sceneManager';
import { HillClimbState, CollectibleItem, LevelConfig, ProgressMap } from './game/types';
import {
  LEVELS,
  getInitialProgress,
  saveProgress,
  getStoredWallet,
  saveWallet,
} from './game/levels';
import { sound } from './game/audio';
import { HillClimbHUD } from './components/HillClimbHUD';
import { LevelSelectModal } from './components/LevelSelectModal';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HillClimbEngine | null>(null);

  const [progress, setProgress] = useState<ProgressMap>(() => getInitialProgress());
  const [walletCoins, setWalletCoins] = useState<number>(() => getStoredWallet());
  const [currentLevel, setCurrentLevel] = useState<LevelConfig>(() => LEVELS[0]);
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);

  const [coinIconUrl, setCoinIconUrl] = useState<string>(
    '/assets/aistudio/Screenshot_2026_1111_013101_29e1dc6a.png'
  );

  const [gameState, setGameState] = useState<HillClimbState>({
    levelId: LEVELS[0].id,
    levelName: LEVELS[0].name,
    levelLength: LEVELS[0].length,
    distance: 0,
    coinsCollected: 0,
    totalLevelCoins: 100,
    score: 0,
    fuel: 100,
    health: 100,
    speed: 0,
    inAir: false,
    airTime: 0,
    flips: 0,
    isCrashed: false,
    crashReason: null,
    isLevelComplete: false,
    starsEarned: 0,
    bonusReward: 0,
    timeOfDay: 'Morning',
    headlightsOn: false,
  });

  const [stuntMessage, setStuntMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeControls, setActiveControls] = useState({ gas: false, brake: false });

  const inputRef = useRef({ gas: false, brake: false });
  const levelCompletedHandledRef = useRef(false);
  const currentLevelRef = useRef(currentLevel);
  currentLevelRef.current = currentLevel;

  // Update best distance & handle level completion progression
  useEffect(() => {
    const lvlId = gameState.levelId;

    // Reset completion guard when restarting/not complete
    if (!gameState.isLevelComplete) {
      levelCompletedHandledRef.current = false;
    }

    // Track best distance continuously
    setProgress((prev) => {
      const existing = prev[lvlId];
      if (!existing) return prev;
      const newBestDist = Math.max(existing.bestDistance, gameState.distance);
      const newBestCoins = Math.max(existing.bestCoins, gameState.coinsCollected);

      if (
        newBestDist === existing.bestDistance &&
        newBestCoins === existing.bestCoins &&
        !gameState.isLevelComplete
      ) {
        return prev;
      }

      const updated: ProgressMap = {
        ...prev,
        [lvlId]: {
          ...existing,
          bestDistance: newBestDist,
          bestCoins: newBestCoins,
          completed: existing.completed || gameState.isLevelComplete,
          stars: Math.max(existing.stars, gameState.starsEarned || 0),
        },
      };

      // Unlock next level upon completion
      if (gameState.isLevelComplete && lvlId < LEVELS.length) {
        updated[lvlId + 1] = {
          ...updated[lvlId + 1],
          unlocked: true,
        };
      }

      saveProgress(updated);
      return updated;
    });

    // Grant bonus coins once upon crossing finish line
    if (gameState.isLevelComplete && !levelCompletedHandledRef.current) {
      levelCompletedHandledRef.current = true;
      setWalletCoins((prev) => {
        const next = prev + gameState.bonusReward;
        saveWallet(next);
        return next;
      });
      confetti({
        particleCount: 80,
        spread: 85,
        origin: { y: 0.5 },
        colors: ['#ffffff', '#cbd5e1', '#38bdf8', '#10b981', '#fbbf24'],
      });
    }
  }, [
    gameState.levelId,
    gameState.distance,
    gameState.coinsCollected,
    gameState.isLevelComplete,
    gameState.starsEarned,
    gameState.bonusReward,
  ]);

  const handleCoinCollected = useCallback((item: CollectibleItem) => {
    setWalletCoins((prev) => {
      const next = prev + 1;
      saveWallet(next);
      return next;
    });

    if ((item.id + 1) % 15 === 0) {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#ffffff', '#cbd5e1', '#38bdf8'],
      });
    }
  }, []);

  const handleFuelCollected = useCallback((_item: CollectibleItem) => {
    setStuntMessage('FUEL TANK FULL!');
    window.setTimeout(() => setStuntMessage(null), 1300);
  }, []);

  const handleStunt = useCallback((msg: string, _bonus: number) => {
    setStuntMessage(msg);
    window.setTimeout(() => setStuntMessage(null), 1600);
  }, []);

  const handleObstacleHit = useCallback(() => {
    setStuntMessage('OBSTACLE HIT!');
    window.setTimeout(() => setStuntMessage(null), 900);
  }, []);

  const handleStateUpdate = useCallback((newState: HillClimbState) => {
    setGameState(newState);
    if ((newState.isCrashed || newState.isLevelComplete) && (inputRef.current.gas || inputRef.current.brake)) {
      inputRef.current.gas = false;
      inputRef.current.brake = false;
      engineRef.current?.setInput(inputRef.current);
      setActiveControls({ gas: false, brake: false });
    }
  }, []);

  // Initialize 2.5D Side-View Engine once
  useEffect(() => {
    if (!mountRef.current) return;

    let active = true;

    createHillClimbEngine(
      mountRef.current,
      LEVELS[0],
      handleCoinCollected,
      handleFuelCollected,
      handleStunt,
      handleObstacleHit,
      handleStateUpdate
    )
      .then((engine) => {
        if (!active) {
          engine.dispose();
          return;
        }
        engineRef.current = engine;
        setCoinIconUrl(engine.coinLogoCleanUrl);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to init HillClimbEngine:', err);
      });

    return () => {
      active = false;
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [handleCoinCollected, handleFuelCollected, handleStunt, handleObstacleHit, handleStateUpdate]);

  const syncInputState = useCallback((nextGas: boolean, nextBrake: boolean) => {
    inputRef.current.gas = nextGas;
    inputRef.current.brake = nextBrake;
    engineRef.current?.setInput(inputRef.current);
    setActiveControls((prev) =>
      prev.gas === nextGas && prev.brake === nextBrake ? prev : { gas: nextGas, brake: nextBrake }
    );
  }, []);

  const handleFirstInteraction = useCallback(() => {
    sound.startEngine();
  }, []);

  const handlePedalPress = useCallback(
    (pedal: 'gas' | 'brake') => {
      handleFirstInteraction();
      if (pedal === 'gas') {
        syncInputState(true, inputRef.current.brake);
      } else {
        syncInputState(inputRef.current.gas, true);
      }
    },
    [handleFirstInteraction, syncInputState]
  );

  const handlePedalRelease = useCallback(
    (pedal: 'gas' | 'brake') => {
      if (pedal === 'gas') {
        syncInputState(false, inputRef.current.brake);
      } else {
        syncInputState(inputRef.current.gas, false);
      }
    },
    [syncInputState]
  );

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      handleFirstInteraction();
      const k = e.key.toLowerCase();
      if (k === 'arrowright' || k === 'd' || k === 'w' || k === 'arrowup') {
        syncInputState(true, inputRef.current.brake);
      }
      if (k === 'arrowleft' || k === 'a' || k === 's' || k === 'arrowdown') {
        syncInputState(inputRef.current.gas, true);
      }
      if (k === 'r') {
        levelCompletedHandledRef.current = false;
        syncInputState(false, false);
        engineRef.current?.resetGame();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowright' || k === 'd' || k === 'w' || k === 'arrowup') {
        syncInputState(false, inputRef.current.brake);
      }
      if (k === 'arrowleft' || k === 'a' || k === 's' || k === 'arrowdown') {
        syncInputState(inputRef.current.gas, false);
      }
    };

    const onBlur = () => {
      syncInputState(false, false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleFirstInteraction, syncInputState]);

  const handleRestart = () => {
    sound.playClick();
    levelCompletedHandledRef.current = false;
    syncInputState(false, false);
    engineRef.current?.resetGame();
  };

  const handleSelectLevel = (level: LevelConfig) => {
    sound.playClick();
    levelCompletedHandledRef.current = false;
    syncInputState(false, false);
    setCurrentLevel(level);
    engineRef.current?.loadLevel(level);
  };

  const handleNextLevel = () => {
    const nextLvl = LEVELS.find((l) => l.id === currentLevel.id + 1);
    if (nextLvl) {
      handleSelectLevel(nextLvl);
    }
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const currentBestDistance = progress[currentLevel.id]?.bestDistance || 0;
  const hasNextLevel = currentLevel.id < LEVELS.length;

  return (
    <div
      onClick={handleFirstInteraction}
      className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none"
    >
      {/* 3D WebGL Canvas Container (2.5D Side-View) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0 cursor-default" />

      {/* Loading Screen */}
      {isLoading && (
        <div className="absolute inset-0 z-40 bg-slate-950 flex flex-col items-center justify-center gap-4 text-white">
          <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-700 p-3 shadow-2xl flex items-center justify-center">
            <img
              src={coinIconUrl}
              alt="Optimum"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col items-center gap-1 text-center px-4">
            <span className="font-black text-xl tracking-wider text-white">
              OPTIMUM COIN RUSH
            </span>
            <span className="text-xs text-emerald-400 font-semibold">
              Loading 10 Hills, Off-Road Jeep & Mascot Driver...
            </span>
          </div>
        </div>
      )}

      {/* Hill Climb HUD & Pedals */}
      {!isLoading && (
        <HillClimbHUD
          state={gameState}
          bestDistance={currentBestDistance}
          walletCoins={walletCoins}
          coinIconUrl={coinIconUrl}
          isMuted={isMuted}
          hasNextLevel={hasNextLevel}
          onToggleMute={handleToggleMute}
          onRestart={handleRestart}
          onOpenLevels={() => {
            sound.playClick();
            syncInputState(false, false);
            setIsLevelSelectOpen(true);
          }}
          onNextLevel={handleNextLevel}
          stuntMessage={stuntMessage}
          activeControls={activeControls}
          onPedalPress={handlePedalPress}
          onPedalRelease={handlePedalRelease}
        />
      )}

      {/* 10-Level Selection Modal */}
      <LevelSelectModal
        isOpen={isLevelSelectOpen}
        onClose={() => setIsLevelSelectOpen(false)}
        currentLevelId={currentLevel.id}
        progress={progress}
        walletCoins={walletCoins}
        coinIconUrl={coinIconUrl}
        onSelectLevel={handleSelectLevel}
      />
    </div>
  );
}
