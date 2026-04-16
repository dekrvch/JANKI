import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Card, CardWithProgress, CardDocument, CardProgress, ExportCard } from '../types';

/**
 * Get the cards collection reference for a user
 */
function getCardsCollection(userId: string) {
  return collection(db, 'users', userId, 'cards');
}

/**
 * Initialize default progress for a new card
 */
function initializeProgress(): { ej: CardProgress; je: CardProgress } {
  return {
    ej: {
      repsCorrect: 0,
      learned: false,
      interval: 0,
      nextDue: new Date().toISOString().split('T')[0],
    },
    je: {
      repsCorrect: 0,
      learned: false,
      interval: 0,
      nextDue: new Date().toISOString().split('T')[0],
    },
  };
}

/**
 * Subscribe to real-time card updates
 */
export function subscribeToCards(
  userId: string,
  callback: (cards: CardWithProgress[]) => void
): () => void {
  const cardsRef = getCardsCollection(userId);
  const q = query(cardsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const cards: CardWithProgress[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as CardDocument;
      cards.push({
        id: doc.id,
        japanese: data.japanese,
        reading: data.reading,
        english: data.english,
        audioUrl: data.audioUrl || '',
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        userId,
        progress: data.progress || initializeProgress(),
      });
    });
    callback(cards);
  });
}

/**
 * Add a new card
 */
export async function addCard(
  userId: string,
  card: Omit<Card, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const cardsRef = getCardsCollection(userId);
  const newDocRef = doc(cardsRef);

  const cardData: CardDocument = {
    japanese: card.japanese,
    reading: card.reading,
    english: card.english,
    audioUrl: card.audioUrl || '',
    createdAt: Timestamp.now(),
    progress: initializeProgress(),
  };

  await setDoc(newDocRef, cardData);
  return newDocRef.id;
}

/**
 * Update card progress
 */
export async function updateCardProgress(
  userId: string,
  cardId: string,
  direction: 'ej' | 'je',
  progress: CardProgress
): Promise<void> {
  const cardRef = doc(db, 'users', userId, 'cards', cardId);
  await updateDoc(cardRef, {
    [`progress.${direction}`]: progress,
  });
}

/**
 * Delete a card
 */
export async function deleteCard(userId: string, cardId: string): Promise<void> {
  const cardRef = doc(db, 'users', userId, 'cards', cardId);
  await deleteDoc(cardRef);
}

/**
 * Import multiple cards
 */
export async function importCards(userId: string, cards: ExportCard[]): Promise<number> {
  let count = 0;
  for (const card of cards) {
    await addCard(userId, {
      japanese: card.japanese,
      reading: card.reading,
      english: card.english,
      audioUrl: card.audioUrl || '',
    });
    count++;
  }
  return count;
}

/**
 * Export all cards (without progress)
 */
export function exportCards(cards: CardWithProgress[]): ExportCard[] {
  return cards.map((card) => ({
    japanese: card.japanese,
    reading: card.reading,
    english: card.english,
    audioUrl: card.audioUrl || '',
  }));
}

/**
 * Reset all progress for all cards
 */
export async function resetAllProgress(userId: string): Promise<void> {
  const cardsRef = getCardsCollection(userId);
  const snapshot = await getDocs(cardsRef);

  const resetProgress = initializeProgress();
  const updates: Promise<void>[] = [];

  snapshot.forEach((doc) => {
    updates.push(
      updateDoc(doc.ref, {
        progress: resetProgress,
      })
    );
  });

  await Promise.all(updates);
}
