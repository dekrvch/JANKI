import type {
  CardWithProgress,
  CardProgress,
  SessionCard,
  Stats,
  Direction,
} from '../types';

// SRS interval sequence (in days)
const INTERVALS = [1, 3, 7, 14, 30, 60, 90];

// Number of correct answers needed to graduate a new card
const REPS_TO_GRADUATE = 3;

// Maximum number of new cards per session
const MAX_NEW_CARDS_PER_SESSION = 10;

/**
 * Get today's date as YYYY-MM-DD string
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Add days to a date string
 */
export function addDays(dateString: string, days: number): string {
  const d = new Date(dateString);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate statistics for home view
 */
export function calculateStats(cards: CardWithProgress[]): Stats {
  const today = getTodayString();
  let due = 0;
  let newCount = 0;
  let learned = 0;

  cards.forEach((card) => {
    const directions: Direction[] = ['ej', 'je'];

    directions.forEach((dir) => {
      const prog = card.progress[dir];

      if (!prog) {
        newCount++;
      } else if (prog.learned) {
        learned++;
        if (prog.nextDue && prog.nextDue <= today) {
          due++;
        }
      } else {
        // In learning phase
        if (prog.nextDue && prog.nextDue <= today) {
          due++;
        }
      }
    });
  });

  return { due, new: newCount, learned };
}

/**
 * Build session queue from cards
 */
export function buildSessionQueue(cards: CardWithProgress[]): SessionCard[] {
  const today = getTodayString();
  const queue: SessionCard[] = [];

  // Collect due reviews
  cards.forEach((card) => {
    const directions: Direction[] = ['ej', 'je'];

    directions.forEach((direction) => {
      const prog = card.progress[direction];

      if (prog?.learned && prog.nextDue && prog.nextDue <= today) {
        queue.push({ card, direction });
      }
    });
  });

  // Add new cards (up to max)
  const newCards: SessionCard[] = [];
  cards.forEach((card) => {
    const directions: Direction[] = ['ej', 'je'];

    directions.forEach((direction) => {
      const prog = card.progress[direction];

      if (!prog || (!prog.learned && prog.repsCorrect === 0)) {
        newCards.push({ card, direction });
      }
    });
  });

  // Shuffle and take up to MAX_NEW_CARDS_PER_SESSION new cards
  shuffle(newCards);
  queue.push(...newCards.slice(0, MAX_NEW_CARDS_PER_SESSION));

  // Shuffle queue, avoiding back-to-back same cards
  return shuffleAvoidingDuplicates(queue);
}

/**
 * Update progress after answering a card
 * Returns the updated progress and whether the card should be re-queued
 */
export function updateProgress(
  progress: CardProgress,
  correct: boolean
): { progress: CardProgress; requeue: boolean } {
  const prog = { ...progress };
  let requeue = false;

  if (prog.learned) {
    // SRS review
    if (correct) {
      // Advance interval
      const currentIndex = INTERVALS.indexOf(prog.interval);
      const nextIndex = currentIndex + 1;
      prog.interval =
        nextIndex < INTERVALS.length ? INTERVALS[nextIndex] : INTERVALS[INTERVALS.length - 1];
      prog.nextDue = addDays(getTodayString(), prog.interval);
    } else {
      // Reset to day 1
      prog.interval = 1;
      prog.nextDue = addDays(getTodayString(), 1);
    }
  } else {
    // New card learning
    if (correct) {
      prog.repsCorrect++;
      if (prog.repsCorrect >= REPS_TO_GRADUATE) {
        prog.learned = true;
        prog.interval = 1;
        prog.nextDue = addDays(getTodayString(), 1);
      } else {
        // Re-add to queue
        requeue = true;
      }
    } else {
      prog.repsCorrect = 0;
      // Re-add to queue
      requeue = true;
    }
  }

  return { progress: prog, requeue };
}

/**
 * Get status for a card direction (for card list display)
 */
export function getCardStatus(
  progress: CardProgress | undefined
): { class: string; text: string } {
  if (!progress) {
    return { class: 'new', text: 'new' };
  }
  if (progress.learned) {
    return { class: 'learned', text: 'learned' };
  }
  return { class: 'learning', text: `${progress.repsCorrect}/${REPS_TO_GRADUATE}` };
}

/**
 * Fisher-Yates shuffle
 */
function shuffle<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Shuffle array while trying to avoid back-to-back duplicates of the same card
 */
function shuffleAvoidingDuplicates(queue: SessionCard[]): SessionCard[] {
  if (queue.length <= 1) return queue;

  shuffle(queue);

  // Try to fix back-to-back same cards
  for (let i = 0; i < queue.length - 1; i++) {
    if (queue[i].card.id === queue[i + 1].card.id) {
      // Try to find a different card to swap with
      for (let j = i + 2; j < queue.length; j++) {
        if (queue[j].card.id !== queue[i].card.id) {
          [queue[i + 1], queue[j]] = [queue[j], queue[i + 1]];
          break;
        }
      }
    }
  }

  return queue;
}
