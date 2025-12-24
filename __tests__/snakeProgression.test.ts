import { deriveSnakeLevel, getInstructionText, type ContentBankItem } from '@/services/snakeProgression';

describe('snakeProgression derivation', () => {
  const sample: ContentBankItem = {
    id: 't1_word_m',
    text: 'Mmmmm',
    phoneme: 'M',
    phonemeCode: 'M',
    tier: 1,
    type: 'word',
    syllables: 1,
    compatibleGames: ['snake'],
    ipa: 'm',
    createdAt: new Date().toISOString(),
  };

  it('derives SnakeLevel duration and XP correctly', () => {
    const level = deriveSnakeLevel(sample);
    expect(level.targetDurationSec).toBe(2);
    expect(level.xpReward).toBeGreaterThan(0);
    expect(level.allowPauses).toBe(false);
  });

  it('instruction text exists for Tier 1 phoneme', () => {
    const level = deriveSnakeLevel(sample);
    const text = getInstructionText(level);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });
});
