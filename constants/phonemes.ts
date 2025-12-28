export type Phoneme = {
  id: string;
  ipa: string;
  label: string;
  frequency: number; // 0-100 commonality in English
  difficulty: number; // 1-5 subjective baseline
  unlockLevel: number; // progression level (1 = starter, 5 = advanced)
};

export const phonemes: Phoneme[] = [
  // Level 1: Most common, easiest phonemes
  { id: 'm', ipa: '/m/', label: 'M (as in "map")', frequency: 62, difficulty: 1, unlockLevel: 1 },
  { id: 'n', ipa: '/n/', label: 'N (as in "nap")', frequency: 74, difficulty: 1, unlockLevel: 1 },
  { id: 't', ipa: '/t/', label: 'T (as in "tap")', frequency: 80, difficulty: 2, unlockLevel: 1 },
  { id: 'd', ipa: '/d/', label: 'D (as in "dog")', frequency: 76, difficulty: 2, unlockLevel: 1 },
  { id: 's', ipa: '/s/', label: 'S (as in "see")', frequency: 78, difficulty: 2, unlockLevel: 1 },
  { id: 'p', ipa: '/p/', label: 'P (as in "pat")', frequency: 72, difficulty: 2, unlockLevel: 1 },

  // Level 2: Adding more common consonants
  { id: 'b', ipa: '/b/', label: 'B (as in "bat")', frequency: 68, difficulty: 2, unlockLevel: 2 },
  { id: 'k', ipa: '/k/', label: 'K (as in "cat")', frequency: 70, difficulty: 2, unlockLevel: 2 },
  { id: 'g', ipa: '/g/', label: 'G (as in "go")', frequency: 60, difficulty: 2, unlockLevel: 2 },
  { id: 'l', ipa: '/l/', label: 'L (as in "love")', frequency: 65, difficulty: 2, unlockLevel: 2 },

  // Level 3: Adding r, f, v
  { id: 'r', ipa: '/ɹ/', label: 'R (as in "red")', frequency: 67, difficulty: 3, unlockLevel: 3 },
  { id: 'f', ipa: '/f/', label: 'F (as in "fish")', frequency: 55, difficulty: 3, unlockLevel: 3 },
  { id: 'v', ipa: '/v/', label: 'V (as in "voice")', frequency: 50, difficulty: 3, unlockLevel: 3 },

  // Level 4: Adding sh, ch, j
  { id: 'sh', ipa: '/ʃ/', label: 'SH (as in "ship")', frequency: 40, difficulty: 3, unlockLevel: 4 },
  { id: 'ch', ipa: '/tʃ/', label: 'CH (as in "chair")', frequency: 38, difficulty: 3, unlockLevel: 4 },
  { id: 'j', ipa: '/dʒ/', label: 'J (as in "jump")', frequency: 36, difficulty: 3, unlockLevel: 4 },

  // Level 5: Advanced phonemes
  { id: 'z', ipa: '/z/', label: 'Z (as in "zoo")', frequency: 52, difficulty: 3, unlockLevel: 5 },
  { id: 'ng', ipa: '/ŋ/', label: 'NG (as in "sing")', frequency: 45, difficulty: 2, unlockLevel: 5 },
  { id: 'th_voiceless', ipa: '/θ/', label: 'TH (as in "thin")', frequency: 28, difficulty: 4, unlockLevel: 5 },
  { id: 'th_voiced', ipa: '/ð/', label: 'TH (as in "this")', frequency: 30, difficulty: 4, unlockLevel: 5 },
  { id: 'h', ipa: '/h/', label: 'H (as in "hat")', frequency: 58, difficulty: 1, unlockLevel: 5 },
  { id: 'y', ipa: '/j/', label: 'Y (as in "yes")', frequency: 42, difficulty: 2, unlockLevel: 5 },
  { id: 'w', ipa: '/w/', label: 'W (as in "we")', frequency: 48, difficulty: 2, unlockLevel: 5 },
];

// Helper to get phonemes unlocked at a given level
export function getPhonemesForLevel(level: number): Phoneme[] {
  return phonemes.filter((p) => p.unlockLevel <= level);
}

// Basic voiced/unvoiced heuristic for gating movement
// Voiced: vowels, nasals (m, n), liquids/glides (l, r, w, y), many sonorants
// Unvoiced: core fricatives (s, f, sh, h), voiceless th
// Note: This is a heuristic for client-side gating; authoritative checks happen server-side.
const UNVOICED_SET = new Set<string>([
  's', 'f', 'sh', 'h', 'th_voiceless'
]);

const VOICED_SET = new Set<string>([
  'm', 'n', 'l', 'r', 'w', 'y', 'v', 'z', 'ng', 'th_voiced', 'j'
]);

export function isVoicedPhoneme(id: string | undefined): boolean {
  if (!id) return true; // default to voiced requirement
  const key = id.toLowerCase();
  if (UNVOICED_SET.has(key)) return false;
  if (VOICED_SET.has(key)) return true;
  // Fallback: treat unknowns (including vowels like 'a','ah','aa') as voiced
  return true;
}
