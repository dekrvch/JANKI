/**
 * Hiragana keyboard with support for:
 * - Single tap: Add character
 * - Double tap: Add voiced mark (゛or ゜)
 * - Long press: Add small character (ゃゅょっ etc.)
 */

const HIRAGANA_LAYOUT = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '', 'ゆ', '', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', '', '', 'を', 'ん'],
  ['。', '、', '？', '！', '〜'],
];

const VOICED_MAP: Record<string, string> = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご',
  さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ',
  ば: 'ぱ', び: 'ぴ', ぶ: 'ぷ', べ: 'ぺ', ぼ: 'ぽ',
};

const SMALL_MAP: Record<string, string> = {
  あ: 'ぁ', い: 'ぃ', う: 'ぅ', え: 'ぇ', お: 'ぉ',
  や: 'ゃ', ゆ: 'ゅ', よ: 'ょ',
  つ: 'っ', わ: 'ゎ',
};

const DOUBLE_TAP_THRESHOLD = 220; // ms
const LONG_PRESS_DURATION = 450; // ms

interface KeyboardState {
  currentAnswer: string;
  lastTapTime: number;
  lastTapKey: string | null;
  longPressTimer: number | null;
}

export class HiraganaKeyboard {
  private container: HTMLElement;
  private state: KeyboardState = {
    currentAnswer: '',
    lastTapTime: 0,
    lastTapKey: null,
    longPressTimer: null,
  };
  private onChangeCallback: ((value: string) => void) | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id "${containerId}" not found`);
    }
    this.container = container;
    this.build();
  }

  /**
   * Build the keyboard UI
   */
  private build(): void {
    this.container.innerHTML = '';

    // Create keyboard rows
    HIRAGANA_LAYOUT.forEach((row) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'kana-row';

      row.forEach((char) => {
        const key = document.createElement('div');
        key.className = 'kana-key';

        if (char === '') {
          key.classList.add('disabled');
        } else {
          key.textContent = char;

          // Add indicator dots
          if (VOICED_MAP[char]) {
            const dot = document.createElement('div');
            dot.className = 'dot-voiced';
            key.appendChild(dot);
          }
          if (SMALL_MAP[char]) {
            const dot = document.createElement('div');
            dot.className = 'dot-small';
            key.appendChild(dot);
          }

          // Event listeners
          key.addEventListener('pointerdown', (e) => this.handleKeyPointerDown(e, char, key));
          key.addEventListener('pointerup', (e) => this.handleKeyPointerUp(e, char, key));
          key.addEventListener('pointercancel', () => this.clearLongPress());
        }

        rowDiv.appendChild(key);
      });

      this.container.appendChild(rowDiv);
    });

    // Bottom row: delete and space
    const bottomRow = document.createElement('div');
    bottomRow.className = 'kana-row';

    const delKey = document.createElement('div');
    delKey.className = 'kana-key special';
    delKey.style.flex = '2';
    delKey.textContent = '← del';
    delKey.addEventListener('pointerdown', () => {
      if (this.state.currentAnswer.length > 0) {
        this.setValue(this.state.currentAnswer.slice(0, -1));
      }
    });
    bottomRow.appendChild(delKey);

    const spaceKey = document.createElement('div');
    spaceKey.className = 'kana-key special';
    spaceKey.style.flex = '5';
    spaceKey.textContent = 'space';
    spaceKey.addEventListener('pointerdown', () => {
      this.setValue(this.state.currentAnswer + '　'); // Full-width space
    });
    bottomRow.appendChild(spaceKey);

    this.container.appendChild(bottomRow);
  }

  /**
   * Handle key press down
   */
  private handleKeyPointerDown(e: PointerEvent, char: string, keyElement: HTMLElement): void {
    e.preventDefault();

    // Single tap: add character immediately
    this.setValue(this.state.currentAnswer + char);

    // Setup long press for small characters
    this.state.longPressTimer = window.setTimeout(() => {
      if (SMALL_MAP[char]) {
        this.replaceLastChar(SMALL_MAP[char]);
        this.flashKey(keyElement, 'small');
      }
      this.state.longPressTimer = null;
    }, LONG_PRESS_DURATION);
  }

  /**
   * Handle key release
   */
  private handleKeyPointerUp(e: PointerEvent, char: string, keyElement: HTMLElement): void {
    e.preventDefault();

    this.clearLongPress();

    // Check for double tap
    const now = Date.now();
    const timeSinceLastTap = now - this.state.lastTapTime;

    if (timeSinceLastTap < DOUBLE_TAP_THRESHOLD && this.state.lastTapKey === char) {
      // Double tap detected - add voiced mark
      if (VOICED_MAP[char]) {
        this.replaceLastChar(VOICED_MAP[char]);
        this.flashKey(keyElement, 'voiced');
      }
      this.state.lastTapTime = 0;
      this.state.lastTapKey = null;
    } else {
      this.state.lastTapTime = now;
      this.state.lastTapKey = char;
    }
  }

  /**
   * Clear long press timer
   */
  private clearLongPress(): void {
    if (this.state.longPressTimer) {
      clearTimeout(this.state.longPressTimer);
      this.state.longPressTimer = null;
    }
  }

  /**
   * Replace the last character in the answer
   */
  private replaceLastChar(newChar: string): void {
    if (this.state.currentAnswer.length > 0) {
      this.setValue(this.state.currentAnswer.slice(0, -1) + newChar);
    }
  }

  /**
   * Flash key animation
   */
  private flashKey(keyElement: HTMLElement, type: 'voiced' | 'small'): void {
    keyElement.classList.add(`flash-${type}`);
    setTimeout(() => {
      keyElement.classList.remove(`flash-${type}`);
    }, 200);
  }

  /**
   * Set the current answer value
   */
  private setValue(value: string): void {
    this.state.currentAnswer = value;
    if (this.onChangeCallback) {
      this.onChangeCallback(value);
    }
  }

  /**
   * Public API: Set change callback
   */
  public onChange(callback: (value: string) => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * Public API: Get current value
   */
  public getValue(): string {
    return this.state.currentAnswer;
  }

  /**
   * Public API: Clear the answer
   */
  public clear(): void {
    this.setValue('');
  }

  /**
   * Public API: Reset the keyboard state
   */
  public reset(): void {
    this.state = {
      currentAnswer: '',
      lastTapTime: 0,
      lastTapKey: null,
      longPressTimer: null,
    };
    if (this.onChangeCallback) {
      this.onChangeCallback('');
    }
  }
}
