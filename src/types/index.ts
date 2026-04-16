import { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

// Card types
export interface Card {
  id: string;
  japanese: string;
  reading: string;
  english: string;
  audioUrl: string;
  createdAt?: Date;
  userId?: string;
}

// Direction for card review
export type Direction = 'ej' | 'je'; // English-to-Japanese or Japanese-to-English

// Progress for a specific card and direction
export interface CardProgress {
  repsCorrect: number;
  learned: boolean;
  interval: number;
  nextDue: string; // Date string in YYYY-MM-DD format
}

// Complete card with progress
export interface CardWithProgress extends Card {
  progress: {
    ej: CardProgress;
    je: CardProgress;
  };
}

// Session state
export interface SessionState {
  queue: SessionCard[];
  current: SessionCard | null;
  currentAnswer: string;
  done: number;
  correct: number;
  missed: number;
  state: 'question' | 'answer';
}

// Card in a session
export interface SessionCard {
  card: CardWithProgress;
  direction: Direction;
}

// Application state
export interface AppState {
  user: FirebaseUser | null;
  cards: CardWithProgress[];
  session: SessionState;
  currentView: ViewName;
}

// View names
export type ViewName = 'loading' | 'login' | 'home' | 'session' | 'done' | 'manage';

// Stats for home view
export interface Stats {
  due: number;
  new: number;
  learned: number;
}

// Message type
export interface Message {
  type: 'success' | 'error' | 'info';
  text: string;
}

// Import/Export card format (simplified, without progress)
export interface ExportCard {
  japanese: string;
  reading: string;
  english: string;
  audioUrl?: string;
}

// Firestore document data (for internal use)
export interface CardDocument {
  japanese: string;
  reading: string;
  english: string;
  audioUrl: string;
  createdAt: Timestamp;
  progress: {
    ej: CardProgress;
    je: CardProgress;
  };
}
