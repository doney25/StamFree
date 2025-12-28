/**
 * Practice sentences for speech therapy exercises.
 * Each sentence targets specific phonemes and has a difficulty level.
 */

export interface Sentence {
  id: string;
  text: string;
  targetPhonemes: string[]; // phoneme IDs from phonemes.ts
  difficulty: 'easy' | 'medium' | 'hard';
  unlockLevel: number; // minimum level required to unlock
}

// Gentle guidance copy for voiced targets (post-game indicator)
export const voiceGuidance = {
  detected: 'Your voice came through! Keep it smooth and steady.',
  missing: 'Try using your voice for the target sound so I can hear it clearly.',
};

export const sentences: Sentence[] = [
  // Level 1 - Starter sentences (common phonemes: m, n, t, d, s, p)
  {
    id: 's1',
    text: 'I see my mom.',
    targetPhonemes: ['m', 's', 'n'],
    difficulty: 'easy',
    unlockLevel: 1,
  },
  {
    id: 's2',
    text: 'The cat sat on the mat.',
    targetPhonemes: ['t', 's', 'm', 'n'],
    difficulty: 'easy',
    unlockLevel: 1,
  },
  {
    id: 's3',
    text: 'Dad can see the sun.',
    targetPhonemes: ['d', 's', 'n', 't'],
    difficulty: 'easy',
    unlockLevel: 1,
  },
  {
    id: 's4',
    text: 'Mom made me some pasta.',
    targetPhonemes: ['m', 's', 't', 'p'],
    difficulty: 'easy',
    unlockLevel: 1,
  },
  {
    id: 's5',
    text: 'Sam needs a pen.',
    targetPhonemes: ['s', 'n', 'd', 'p'],
    difficulty: 'easy',
    unlockLevel: 1,
  },
  {
    id: 's6',
    text: 'Ten tiny toes tap.',
    targetPhonemes: ['t', 'n'],
    difficulty: 'easy',
    unlockLevel: 1,
  },

  // Level 2 - Adding b, k, g, l
  {
    id: 's7',
    text: 'Big black bugs bite.',
    targetPhonemes: ['b', 'k', 'g', 't'],
    difficulty: 'medium',
    unlockLevel: 2,
  },
  {
    id: 's8',
    text: 'Look at the yellow balloon.',
    targetPhonemes: ['l', 'k', 't', 'b'],
    difficulty: 'medium',
    unlockLevel: 2,
  },
  {
    id: 's9',
    text: 'Kelly likes green apples.',
    targetPhonemes: ['k', 'l', 'g', 'p'],
    difficulty: 'medium',
    unlockLevel: 2,
  },

  // Level 3 - Adding r, f, v
  {
    id: 's10',
    text: 'Red rabbits run really fast.',
    targetPhonemes: ['r', 't', 's', 'f'],
    difficulty: 'medium',
    unlockLevel: 3,
  },
  {
    id: 's11',
    text: 'Five frogs love to visit.',
    targetPhonemes: ['f', 'v', 'r', 'l', 't'],
    difficulty: 'medium',
    unlockLevel: 3,
  },
  {
    id: 's12',
    text: 'The river flows very fast.',
    targetPhonemes: ['r', 'v', 'f', 's', 't'],
    difficulty: 'hard',
    unlockLevel: 3,
  },

  // Level 4 - Adding sh, ch, j
  {
    id: 's13',
    text: 'She sells seashells by the shore.',
    targetPhonemes: ['sh', 's', 'l'],
    difficulty: 'hard',
    unlockLevel: 4,
  },
  {
    id: 's14',
    text: 'Charlie chose chocolate chips.',
    targetPhonemes: ['ch', 's'],
    difficulty: 'hard',
    unlockLevel: 4,
  },
  {
    id: 's15',
    text: 'John enjoys jumping jacks.',
    targetPhonemes: ['j', 'n'],
    difficulty: 'hard',
    unlockLevel: 4,
  },

  // Level 5 - Adding th, z, w, y, h
  {
    id: 's16',
    text: 'Three thin things.',
    targetPhonemes: ['th_voiceless', 'n'],
    difficulty: 'hard',
    unlockLevel: 5,
  },
  {
    id: 's17',
    text: 'This is the other one.',
    targetPhonemes: ['th_voiced', 's', 'n'],
    difficulty: 'hard',
    unlockLevel: 5,
  },
  {
    id: 's18',
    text: 'Why would you wait here?',
    targetPhonemes: ['w', 'y', 'h'],
    difficulty: 'medium',
    unlockLevel: 5,
  },
  {
    id: 's19',
    text: 'Zebras zoom through the zoo.',
    targetPhonemes: ['z', 'th_voiced'],
    difficulty: 'hard',
    unlockLevel: 5,
  },
];

// Helper to get sentences available at a given level
export function getSentencesForLevel(level: number): Sentence[] {
  return sentences.filter((s) => s.unlockLevel <= level);
}

// Helper to get next sentence for current level
export function getNextSentence(completedIds: string[], currentLevel: number): Sentence | null {
  const available = getSentencesForLevel(currentLevel);
  const remaining = available.filter((s) => !completedIds.includes(s.id));
  return remaining.length > 0 ? remaining[0] : null;
}
