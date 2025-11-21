/**
 * WhiteboardToolsService
 * Manages all whiteboard tools: pause, freeze, clear, shuffle, timers, stopwatches, reactions, animations
 * Handles state management and synchronization across trainer and learner via whiteboard service
 */

class WhiteboardToolsService {
  constructor(whiteboardService) {
    this.whiteboardService = whiteboardService;

    // Tool state management
    this.isPaused = false;
    this.isFrozen = false;
    this.isCleared = false;
    this.isWaiting = false;

    // Timers and Stopwatches
    this.timers = new Map();
    this.stopwatches = new Map();

    // Reactions and animations
    this.activeReactions = new Map();
    this.activeAnimations = new Map();

    // Callbacks for state changes
    this.onToolStateChange = null;
    this.onItemsCleared = null;
    this.onItemsShuffled = null;
    this.onTimerTick = null;
    this.onStopwatchTick = null;
    this.onReactionAdded = null;
    this.onAnimationAdded = null;
  }

  /**
   * 🔹 PAUSE TOOL: Disables all whiteboard interactions for both trainer and learner
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    const state = {
      tool: 'pause',
      active: this.isPaused,
      timestamp: Date.now()
    };

    // Emit via whiteboard service
    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    if (this.onToolStateChange) {
      this.onToolStateChange('pause', this.isPaused);
    }

    return this.isPaused;
  }

  /**
   * 🔹 FREEZE TOOL: Locks learner's whiteboard while trainer can continue
   */
  toggleFreeze() {
    this.isFrozen = !this.isFrozen;
    const state = {
      tool: 'freeze',
      active: this.isFrozen,
      timestamp: Date.now()
    };

    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    if (this.onToolStateChange) {
      this.onToolStateChange('freeze', this.isFrozen);
    }

    return this.isFrozen;
  }

  /**
   * 🔹 CLEAR TOOL: Wipes entire whiteboard (drawings, text, images)
   */
  clearWhiteboard() {
    this.isCleared = true;
    const state = {
      tool: 'clear',
      active: true,
      timestamp: Date.now()
    };

    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    if (this.onItemsCleared) {
      this.onItemsCleared();
    }

    return state;
  }

  /**
   * 🔹 SHUFFLE TOOL: Randomly rearranges all items on the whiteboard
   */
  shuffleItems(items, canvasWidth, canvasHeight) {
    if (!items || items.length === 0) {
      return [];
    }

    const shuffledItems = items.map(item => ({
      ...item,
      x: Math.random() * (canvasWidth - (item.width || 100)),
      y: Math.random() * (canvasHeight - (item.height || 100))
    }));

    const state = {
      tool: 'shuffle',
      items: shuffledItems,
      timestamp: Date.now()
    };

    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    if (this.onItemsShuffled) {
      this.onItemsShuffled(shuffledItems);
    }

    return shuffledItems;
  }

  /**
   * 🔹 TIMER TOOL: Add countdown timer to whiteboard
   */
  startTimer(minutes, seconds = 0) {
    const timerId = `timer_${Date.now()}`;
    let totalSeconds = minutes * 60 + seconds;

    const state = {
      tool: 'timer',
      id: timerId,
      active: true,
      totalSeconds: totalSeconds,
      remainingSeconds: totalSeconds,
      timestamp: Date.now()
    };

    // Emit timer start event
    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    // Store timer reference
    const timerInterval = setInterval(() => {
      totalSeconds--;

      if (totalSeconds < 0) {
        clearInterval(timerInterval);
        this.timers.delete(timerId);

        // Emit timer end
        if (this.whiteboardService) {
          this.whiteboardService.send('tool_state', {
            tool: 'timer',
            id: timerId,
            active: false,
            timestamp: Date.now()
          });
        }
        return;
      }

      // Emit tick
      if (this.onTimerTick) {
        this.onTimerTick(timerId, totalSeconds);
      }

      if (this.whiteboardService) {
        this.whiteboardService.send('tool_state', {
          tool: 'timer',
          id: timerId,
          remainingSeconds: totalSeconds,
          timestamp: Date.now()
        });
      }
    }, 1000);

    this.timers.set(timerId, {
      interval: timerInterval,
      totalSeconds: minutes * 60 + seconds,
      remainingSeconds: totalSeconds
    });

    return timerId;
  }

  /**
   * 🔹 STOPWATCH TOOL: Elapsed time tracker with start/pause/reset
   */
  startStopwatch() {
    const stopwatchId = `stopwatch_${Date.now()}`;
    let elapsedSeconds = 0;

    const state = {
      tool: 'stopwatch',
      id: stopwatchId,
      active: true,
      elapsedSeconds: 0,
      timestamp: Date.now()
    };

    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    const stopwatchInterval = setInterval(() => {
      elapsedSeconds++;

      if (this.onStopwatchTick) {
        this.onStopwatchTick(stopwatchId, elapsedSeconds);
      }

      if (this.whiteboardService) {
        this.whiteboardService.send('tool_state', {
          tool: 'stopwatch',
          id: stopwatchId,
          elapsedSeconds: elapsedSeconds,
          timestamp: Date.now()
        });
      }
    }, 1000);

    this.stopwatches.set(stopwatchId, {
      interval: stopwatchInterval,
      elapsedSeconds: 0,
      paused: false
    });

    return stopwatchId;
  }

  pauseStopwatch(stopwatchId) {
    const stopwatch = this.stopwatches.get(stopwatchId);
    if (stopwatch) {
      clearInterval(stopwatch.interval);
      stopwatch.paused = true;

      if (this.whiteboardService) {
        this.whiteboardService.send('tool_state', {
          tool: 'stopwatch',
          id: stopwatchId,
          paused: true,
          timestamp: Date.now()
        });
      }
    }
  }

  resumeStopwatch(stopwatchId) {
    const stopwatch = this.stopwatches.get(stopwatchId);
    if (stopwatch && stopwatch.paused) {
      let elapsedSeconds = stopwatch.elapsedSeconds;

      const newInterval = setInterval(() => {
        elapsedSeconds++;

        if (this.onStopwatchTick) {
          this.onStopwatchTick(stopwatchId, elapsedSeconds);
        }

        if (this.whiteboardService) {
          this.whiteboardService.send('tool_state', {
            tool: 'stopwatch',
            id: stopwatchId,
            elapsedSeconds: elapsedSeconds,
            timestamp: Date.now()
          });
        }
      }, 1000);

      stopwatch.interval = newInterval;
      stopwatch.paused = false;
      stopwatch.elapsedSeconds = elapsedSeconds;
    }
  }

  resetStopwatch(stopwatchId) {
    const stopwatch = this.stopwatches.get(stopwatchId);
    if (stopwatch) {
      clearInterval(stopwatch.interval);
      this.stopwatches.delete(stopwatchId);

      if (this.whiteboardService) {
        this.whiteboardService.send('tool_state', {
          tool: 'stopwatch',
          id: stopwatchId,
          active: false,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * 🔹 REACTIONS: Display emoji feedback on whiteboard
   */
  addReaction(reactionType) {
    const reactionId = `reaction_${Date.now()}`;

    const reactionConfig = {
      '👍 Good Job!': { emoji: '👍', label: 'Good Job!' },
      '🌟 Wow!': { emoji: '🌟', label: 'Wow!' },
      '💪 Doing Well': { emoji: '💪', label: 'Doing Well' },
      '🙏 Thank You': { emoji: '🙏', label: 'Thank You' },
      '❤️ Loved it': { emoji: '❤️', label: 'Loved it' },
      '📈 Can Better': { emoji: '📈', label: 'Can Better' },
      '😌 Relax': { emoji: '😌', label: 'Relax' }
    };

    const config = reactionConfig[reactionType] || { emoji: '👍', label: 'Reaction' };

    const state = {
      tool: 'reaction',
      id: reactionId,
      type: reactionType,
      emoji: config.emoji,
      label: config.label,
      x: Math.random() * 200 + 100, // Random position
      y: Math.random() * 200 + 100,
      timestamp: Date.now()
    };

    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    this.activeReactions.set(reactionId, state);

    if (this.onReactionAdded) {
      this.onReactionAdded(state);
    }

    // Auto-remove reaction after 3 seconds
    setTimeout(() => {
      this.activeReactions.delete(reactionId);
    }, 3000);

    return reactionId;
  }

  /**
   * 🔹 ANIMATIONS: Display visual animations on whiteboard
   */
  startAnimation(animationType) {
    const animationId = `animation_${Date.now()}`;

    const state = {
      tool: 'animation',
      id: animationId,
      type: animationType, // 'bubbles', 'smileys', 'balloons', 'stars'
      active: true,
      timestamp: Date.now()
    };

    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    this.activeAnimations.set(animationId, state);

    if (this.onAnimationAdded) {
      this.onAnimationAdded(state);
    }

    // Auto-end animation after 5 seconds
    setTimeout(() => {
      this.activeAnimations.delete(animationId);

      if (this.whiteboardService) {
        this.whiteboardService.send('tool_state', {
          tool: 'animation',
          id: animationId,
          active: false,
          timestamp: Date.now()
        });
      }
    }, 5000);

    return animationId;
  }

  /**
   * 🔹 WAIT OVERLAY: Shows semi-transparent overlay telling learner to wait
   */
  showWaitOverlay() {
    this.isWaiting = true;

    const state = {
      tool: 'wait',
      active: true,
      timestamp: Date.now()
    };

    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    if (this.onToolStateChange) {
      this.onToolStateChange('wait', true);
    }

    return state;
  }

  hideWaitOverlay() {
    this.isWaiting = false;

    const state = {
      tool: 'wait',
      active: false,
      timestamp: Date.now()
    };

    if (this.whiteboardService) {
      this.whiteboardService.send('tool_state', state);
    }

    if (this.onToolStateChange) {
      this.onToolStateChange('wait', false);
    }

    return state;
  }

  /**
   * Process incoming tool state from learner's side
   */
  processToolState(state) {
    switch (state.tool) {
      case 'pause':
        this.isPaused = state.active;
        break;
      case 'freeze':
        this.isFrozen = state.active;
        break;
      case 'clear':
        this.isCleared = state.active;
        break;
      case 'wait':
        this.isWaiting = state.active;
        break;
      case 'reaction':
        this.activeReactions.set(state.id, state);
        break;
      case 'animation':
        if (state.active) {
          this.activeAnimations.set(state.id, state);
        } else {
          this.activeAnimations.delete(state.id);
        }
        break;
      case 'timer':
        // Timer state received
        break;
      case 'stopwatch':
        // Stopwatch state received
        break;
    }
  }

  /**
   * Get all active tool states
   */
  getActiveToolStates() {
    return {
      isPaused: this.isPaused,
      isFrozen: this.isFrozen,
      isCleared: this.isCleared,
      isWaiting: this.isWaiting,
      activeReactions: Array.from(this.activeReactions.values()),
      activeAnimations: Array.from(this.activeAnimations.values()),
      timers: Array.from(this.timers.entries()).map(([id, data]) => ({
        id,
        ...data
      })),
      stopwatches: Array.from(this.stopwatches.entries()).map(([id, data]) => ({
        id,
        ...data
      }))
    };
  }

  /**
   * Clean up all tools and intervals
   */
  cleanup() {
    // Clear all timers
    this.timers.forEach(timer => clearInterval(timer.interval));
    this.timers.clear();

    // Clear all stopwatches
    this.stopwatches.forEach(stopwatch => clearInterval(stopwatch.interval));
    this.stopwatches.clear();

    // Clear reactions and animations
    this.activeReactions.clear();
    this.activeAnimations.clear();

    // Reset states
    this.isPaused = false;
    this.isFrozen = false;
    this.isCleared = false;
    this.isWaiting = false;
  }
}

export default WhiteboardToolsService;
