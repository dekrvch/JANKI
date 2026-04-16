import './styles/main.css';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signOut } from './lib/auth';
import {
  subscribeToCards,
  updateCardProgress,
  deleteCard as deleteCardFromDb,
  importCards as importCardsToDb,
  exportCards as exportCardsFromDb,
  resetAllProgress,
} from './lib/firestore';
import {
  calculateStats,
  buildSessionQueue,
  updateProgress,
  getCardStatus,
  getTodayString,
} from './lib/srs';
import { HiraganaKeyboard } from './lib/keyboard';
import type { CardWithProgress, SessionState, ViewName } from './types';

// ========================================
// Application State
// ========================================
const state: {
  user: User | null;
  cards: CardWithProgress[];
  session: SessionState;
  currentView: ViewName;
  keyboard: HiraganaKeyboard | null;
  unsubscribeCards: (() => void) | null;
} = {
  user: null,
  cards: [],
  session: {
    queue: [],
    current: null,
    currentAnswer: '',
    done: 0,
    correct: 0,
    missed: 0,
    state: 'question',
  },
  currentView: 'loading',
  keyboard: null,
  unsubscribeCards: null,
};

// ========================================
// Initialization
// ========================================
async function init() {
  showView('loading');

  // Listen for authentication state changes
  onAuthChange(async (user) => {
    if (user) {
      // User is signed in
      state.user = user;

      // Subscribe to cards
      if (state.unsubscribeCards) {
        state.unsubscribeCards();
      }
      state.unsubscribeCards = subscribeToCards(user.uid, (cards) => {
        state.cards = cards;
        updateHomeView();
        updateManageCardsView();
      });

      // Initialize keyboard
      if (!state.keyboard) {
        state.keyboard = new HiraganaKeyboard('hiragana-keyboard');
        state.keyboard.onChange((value) => {
          updateKeyboardDisplay(value);
        });
      }

      showView('home');
    } else {
      // User is signed out
      if (state.unsubscribeCards) {
        state.unsubscribeCards();
        state.unsubscribeCards = null;
      }
      state.user = null;
      state.cards = [];
      showView('login');
    }
  });

  setupEventListeners();
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
  // Login
  document.getElementById('btn-google-signin')?.addEventListener('click', handleSignIn);

  // Home
  document.getElementById('btn-start-session')?.addEventListener('click', startSession);
  document.getElementById('btn-manage-cards')?.addEventListener('click', () => showView('manage'));
  document.getElementById('btn-sign-out')?.addEventListener('click', handleSignOut);

  // Session
  document.getElementById('btn-submit-keyboard')?.addEventListener('click', submitAnswer);
  document.getElementById('btn-submit-text')?.addEventListener('click', submitAnswer);
  document.getElementById('answer-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });
  document.getElementById('answer-clear')?.addEventListener('click', () => {
    state.keyboard?.clear();
  });
  document.getElementById('btn-correct')?.addEventListener('click', () => gradeAnswer(true));
  document.getElementById('btn-wrong')?.addEventListener('click', () => gradeAnswer(false));
  document.getElementById('btn-play-audio')?.addEventListener('click', playAudio);

  // Done
  document.getElementById('btn-continue')?.addEventListener('click', () => showView('home'));

  // Manage
  document.getElementById('btn-import')?.addEventListener('click', handleImportCards);
  document.getElementById('btn-export')?.addEventListener('click', handleExportCards);
  document.getElementById('btn-reset')?.addEventListener('click', handleResetProgress);
  document.getElementById('btn-back-home')?.addEventListener('click', () => showView('home'));
}

// ========================================
// View Management
// ========================================
function showView(viewName: ViewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const viewElement = document.getElementById(`view-${viewName}`);
  if (viewElement) {
    viewElement.classList.add('active');
  }
  state.currentView = viewName;
}

// ========================================
// Authentication Handlers
// ========================================
async function handleSignIn() {
  try {
    await signInWithGoogle();
  } catch (error) {
    console.error('Sign in error:', error);
    alert('Failed to sign in. Please try again.');
  }
}

async function handleSignOut() {
  if (confirm('Are you sure you want to sign out?')) {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
}

// ========================================
// Home View
// ========================================
function updateHomeView() {
  const stats = calculateStats(state.cards);

  // Update stats
  const statsHtml = `
    <div class="stat">
      <div class="stat-number blue">${stats.due}</div>
      <div class="stat-label">Due</div>
    </div>
    <div class="stat">
      <div class="stat-number green">${stats.new}</div>
      <div class="stat-label">New</div>
    </div>
    <div class="stat">
      <div class="stat-number neutral">${stats.learned}</div>
      <div class="stat-label">Learned</div>
    </div>
  `;
  const statsEl = document.getElementById('home-stats');
  if (statsEl) statsEl.innerHTML = statsHtml;

  // Update start button state
  const startBtn = document.getElementById('btn-start-session') as HTMLButtonElement;
  const messageEl = document.getElementById('home-message');

  if (state.cards.length === 0) {
    if (startBtn) startBtn.disabled = true;
    if (messageEl) {
      messageEl.textContent = 'No cards yet. Go to "Manage Cards" to import some!';
      messageEl.style.display = 'block';
    }
  } else if (stats.due === 0 && stats.new === 0) {
    if (startBtn) startBtn.disabled = true;
    if (messageEl) {
      messageEl.textContent = 'Nothing due right now. Come back later!';
      messageEl.style.display = 'block';
    }
  } else {
    if (startBtn) startBtn.disabled = false;
    if (messageEl) messageEl.style.display = 'none';
  }
}

// ========================================
// Session Management
// ========================================
function startSession() {
  const queue = buildSessionQueue(state.cards);

  if (queue.length === 0) {
    return;
  }

  state.session = {
    queue,
    current: null,
    currentAnswer: '',
    done: 0,
    correct: 0,
    missed: 0,
    state: 'question',
  };

  showView('session');
  nextCard();
}

function nextCard() {
  if (state.session.queue.length === 0) {
    showDoneSummary();
    return;
  }

  state.session.current = state.session.queue.shift()!;
  state.session.state = 'question';
  state.session.currentAnswer = '';

  // Clear inputs
  state.keyboard?.clear();
  const textInput = document.getElementById('answer-input') as HTMLInputElement;
  if (textInput) textInput.value = '';

  updateSessionView();
}

function updateSessionView() {
  if (!state.session.current) return;

  const { card, direction } = state.session.current;
  const prog = card.progress[direction];

  // Update progress bar
  updateProgressBar();

  // Show question state, hide answer state
  const questionState = document.getElementById('question-state');
  const answerState = document.getElementById('answer-state');
  if (questionState) questionState.style.display = 'block';
  if (answerState) answerState.style.display = 'none';

  // Update direction label
  const directionLabel = document.getElementById('direction-label');
  if (directionLabel) {
    directionLabel.textContent = direction === 'ej' ? 'English → Japanese' : 'Japanese → English';
  }

  // Show rep badge if in learning phase
  const repBadge = document.getElementById('rep-badge');
  if (repBadge) {
    if (prog && !prog.learned) {
      repBadge.textContent = `Rep ${prog.repsCorrect + 1}/3`;
      repBadge.style.display = 'inline-block';
    } else {
      repBadge.style.display = 'none';
    }
  }

  // Update card display
  const cardBox = document.getElementById('card-box');
  if (cardBox) {
    if (direction === 'ej') {
      // Show English, ask for Japanese
      cardBox.innerHTML = `<div class="card-english">${escapeHtml(card.english)}</div>`;
    } else {
      // Show Japanese, ask for English
      cardBox.innerHTML = `
        <div class="card-japanese">${escapeHtml(card.japanese)}</div>
        <div class="card-reading">${escapeHtml(card.reading)}</div>
      `;
    }
  }

  // Show appropriate input method
  const keyboardInput = document.getElementById('keyboard-input');
  const textInput = document.getElementById('text-input');
  if (direction === 'ej') {
    if (keyboardInput) keyboardInput.style.display = 'block';
    if (textInput) textInput.style.display = 'none';
  } else {
    if (keyboardInput) keyboardInput.style.display = 'none';
    if (textInput) textInput.style.display = 'block';
    // Focus the text input
    setTimeout(() => {
      const input = document.getElementById('answer-input') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  }
}

function submitAnswer() {
  if (!state.session.current) return;

  const { direction } = state.session.current;

  // Get answer based on input method
  if (direction === 'ej') {
    state.session.currentAnswer = state.keyboard?.getValue() || '';
  } else {
    const input = document.getElementById('answer-input') as HTMLInputElement;
    state.session.currentAnswer = input?.value || '';
  }

  showAnswerState();
}

function showAnswerState() {
  if (!state.session.current) return;

  const { card, direction } = state.session.current;
  const userAnswer = state.session.currentAnswer.trim();
  const correctAnswer = direction === 'ej' ? card.reading : card.english;

  // Hide question state, show answer state
  const questionState = document.getElementById('question-state');
  const answerState = document.getElementById('answer-state');
  if (questionState) questionState.style.display = 'none';
  if (answerState) answerState.style.display = 'block';

  // Determine if answer is correct
  const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();

  // Display user's answer
  const userAnswerDisplay = document.getElementById('user-answer-display');
  if (userAnswerDisplay) {
    if (userAnswer === '') {
      userAnswerDisplay.innerHTML = '<div class="user-answer empty">(no answer)</div>';
    } else {
      const answerClass = isCorrect ? 'correct' : 'wrong';
      userAnswerDisplay.innerHTML = `<div class="user-answer ${answerClass}">${escapeHtml(
        userAnswer
      )}</div>`;
    }
  }

  // Display correct answer
  const correctAnswerText = document.getElementById('correct-answer-text');
  if (correctAnswerText) {
    correctAnswerText.textContent = correctAnswer;
  }

  // Show audio button if available (for Japanese cards)
  const audioBtn = document.getElementById('btn-play-audio');
  if (audioBtn && direction === 'ej' && card.audioUrl) {
    audioBtn.style.display = 'inline-block';
  } else if (audioBtn) {
    audioBtn.style.display = 'none';
  }
}

function gradeAnswer(correct: boolean) {
  if (!state.session.current) return;

  const { card, direction } = state.session.current;
  const userId = state.user?.uid;
  if (!userId) return;

  // Update stats
  state.session.done++;
  if (correct) {
    state.session.correct++;
  } else {
    state.session.missed++;
  }

  // Update progress
  const currentProgress = card.progress[direction];
  const { progress: newProgress, requeue } = updateProgress(currentProgress, correct);

  // Save to Firestore
  updateCardProgress(userId, card.id, direction, newProgress).catch((err) => {
    console.error('Failed to update progress:', err);
  });

  // Re-queue if needed
  if (requeue) {
    state.session.queue.push({ card, direction });
    // Shuffle to avoid immediate repetition
    if (state.session.queue.length > 1) {
      const lastIdx = state.session.queue.length - 1;
      const swapIdx = Math.floor(Math.random() * lastIdx);
      [state.session.queue[lastIdx], state.session.queue[swapIdx]] = [
        state.session.queue[swapIdx],
        state.session.queue[lastIdx],
      ];
    }
  }

  // Move to next card
  nextCard();
}

function updateProgressBar() {
  const total = state.session.done + state.session.queue.length;
  const percent = total > 0 ? (state.session.done / total) * 100 : 0;

  const progressFill = document.getElementById('progress-fill');
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }

  const progressText = document.getElementById('progress-text');
  if (progressText) {
    progressText.textContent = `${state.session.done} / ${total}`;
  }
}

function showDoneSummary() {
  const accuracy =
    state.session.done > 0 ? Math.round((state.session.correct / state.session.done) * 100) : 0;

  const summaryHtml = `
    <div class="summary-row">
      <span>Correct</span>
      <span class="summary-value green">${state.session.correct}</span>
    </div>
    <div class="summary-row">
      <span>Missed</span>
      <span class="summary-value red">${state.session.missed}</span>
    </div>
    <div class="summary-row">
      <span>Accuracy</span>
      <span class="summary-value">${accuracy}%</span>
    </div>
  `;

  const summaryEl = document.getElementById('session-summary');
  if (summaryEl) summaryEl.innerHTML = summaryHtml;

  showView('done');
}

function playAudio() {
  if (!state.session.current) return;

  const { card } = state.session.current;
  if (!card.audioUrl) return;

  const audio = document.getElementById('audio-player') as HTMLAudioElement;
  if (audio) {
    audio.src = card.audioUrl;
    audio.play().catch((err) => console.error('Audio playback failed:', err));
  }
}

function updateKeyboardDisplay(value: string) {
  const displayText = document.getElementById('answer-display-text');
  if (displayText) {
    if (value === '') {
      displayText.textContent = 'Type your answer...';
      displayText.classList.add('placeholder');
    } else {
      displayText.textContent = value;
      displayText.classList.remove('placeholder');
    }
  }
}

// ========================================
// Manage Cards View
// ========================================
function updateManageCardsView() {
  const cardCountEl = document.getElementById('card-count');
  if (cardCountEl) {
    cardCountEl.textContent = state.cards.length.toString();
  }

  const cardList = document.getElementById('card-list');
  if (!cardList) return;

  if (state.cards.length === 0) {
    cardList.innerHTML =
      '<div class="empty-state">No cards yet. Import some using the form above!</div>';
    return;
  }

  cardList.innerHTML = state.cards
    .map((card) => {
      const ejStatus = getCardStatus(card.progress.ej);
      const jeStatus = getCardStatus(card.progress.je);

      return `
        <div class="card-item">
          <div class="card-item-header">
            <div class="card-item-text">
              <div class="card-item-japanese">${escapeHtml(card.japanese)} (${escapeHtml(
        card.reading
      )})</div>
              <div class="card-item-english">${escapeHtml(card.english)}</div>
            </div>
            <button class="card-item-delete btn-small" data-card-id="${card.id}">Delete</button>
          </div>
          <div class="card-item-status">
            <span class="status-pill ${ejStatus.class}">EN→JP: ${ejStatus.text}</span>
            <span class="status-pill ${jeStatus.class}">JP→EN: ${jeStatus.text}</span>
          </div>
        </div>
      `;
    })
    .join('');

  // Add delete listeners
  cardList.querySelectorAll('.card-item-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const cardId = (e.target as HTMLElement).getAttribute('data-card-id');
      if (cardId) handleDeleteCard(cardId);
    });
  });
}

async function handleImportCards() {
  const textarea = document.getElementById('import-json') as HTMLTextAreaElement;
  const messageEl = document.getElementById('import-message');
  if (!textarea || !messageEl) return;

  const userId = state.user?.uid;
  if (!userId) return;

  try {
    const json = textarea.value.trim();
    if (!json) {
      throw new Error('Please paste JSON data first');
    }

    const cards = JSON.parse(json);
    if (!Array.isArray(cards)) {
      throw new Error('JSON must be an array of card objects');
    }

    const count = await importCardsToDb(userId, cards);

    messageEl.className = 'message success';
    messageEl.textContent = `Successfully imported ${count} card(s)!`;
    messageEl.style.display = 'block';
    textarea.value = '';

    setTimeout(() => {
      messageEl.style.display = 'none';
    }, 3000);
  } catch (error) {
    messageEl.className = 'message error';
    messageEl.textContent = `Import failed: ${(error as Error).message}`;
    messageEl.style.display = 'block';
  }
}

function handleExportCards() {
  const exported = exportCardsFromDb(state.cards);
  const json = JSON.stringify(exported, null, 2);

  // Create a download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `janki-cards-${getTodayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleDeleteCard(cardId: string) {
  if (!confirm('Are you sure you want to delete this card?')) return;

  const userId = state.user?.uid;
  if (!userId) return;

  try {
    await deleteCardFromDb(userId, cardId);
  } catch (error) {
    console.error('Failed to delete card:', error);
    alert('Failed to delete card. Please try again.');
  }
}

async function handleResetProgress() {
  if (
    !confirm(
      'Are you sure you want to reset ALL progress? This will set all cards back to new. This cannot be undone!'
    )
  ) {
    return;
  }

  const userId = state.user?.uid;
  if (!userId) return;

  try {
    await resetAllProgress(userId);
    alert('Progress reset successfully!');
  } catch (error) {
    console.error('Failed to reset progress:', error);
    alert('Failed to reset progress. Please try again.');
  }
}

// ========================================
// Utilities
// ========================================
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========================================
// Start Application
// ========================================
init();
