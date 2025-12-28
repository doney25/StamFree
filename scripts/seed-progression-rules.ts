/**
 * Seed script for progression rules (Firestore).
 * Usage: npx ts-node scripts/seed-progression-rules.ts
 */

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// 1. Setup Admin SDK (Same as your Content Bank script)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../server/credentials.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// 2. The Rules Matrix
const progressionRules = {
  turtle: {
    gameId: 'turtle',
    description: 'Rate Control / Slow Speech',
    tiers: {
      '1': {
        word: { targetWPM: 100, tolerance: 20, passRatio: 0.8, xpReward: 10 },
        phrase: { targetWPM: 110, tolerance: 25, passRatio: 0.8, xpReward: 20 },
        sentence: { targetWPM: 120, tolerance: 30, passRatio: 0.85, xpReward: 50 },
      },
      '2': {
        word: { targetWPM: 90, tolerance: 20, passRatio: 0.8, xpReward: 15 },
        phrase: { targetWPM: 100, tolerance: 25, passRatio: 0.8, xpReward: 25 },
        sentence: { targetWPM: 110, tolerance: 30, passRatio: 0.85, xpReward: 60 },
      },
      '3': {
        word: { targetWPM: 80, tolerance: 15, passRatio: 0.8, xpReward: 20 },
        phrase: { targetWPM: 90, tolerance: 20, passRatio: 0.8, xpReward: 30 },
        sentence: { targetWPM: 100, tolerance: 25, passRatio: 0.85, xpReward: 70 },
      },
    },
  },
  snake: {
    gameId: 'snake',
    description: 'Prolongation / Continuous Phonation',
    tiers: {
      '1': {
        // Tweak: Snake durations should be LONGER to force stretching
        word: { minDurationSec: 2.0, passRatio: 0.8, xpReward: 10 }, 
        phrase: { minDurationSec: 4.0, passRatio: 0.8, xpReward: 20 },
        sentence: { minDurationSec: 6.0, passRatio: 0.85, xpReward: 50 },
      },
      '2': {
        word: { minDurationSec: 2.5, passRatio: 0.8, xpReward: 15 },
        phrase: { minDurationSec: 5.0, passRatio: 0.8, xpReward: 25 },
        sentence: { minDurationSec: 7.0, passRatio: 0.85, xpReward: 60 },
      },
      '3': {
        word: { minDurationSec: 3.0, passRatio: 0.8, xpReward: 20 },
        phrase: { minDurationSec: 6.0, passRatio: 0.8, xpReward: 30 },
        sentence: { minDurationSec: 8.0, passRatio: 0.85, xpReward: 70 },
      },
    },
  },
  balloon: {
    gameId: 'balloon',
    description: 'Blocking / Easy Onset',
    tiers: {
      '1': {
        word: { maxAmplitudeStart: 0.4, silenceGapLimit: 0.3, passRatio: 0.8, xpReward: 10 },
        phrase: { maxAmplitudeStart: 0.35, silenceGapLimit: 0.25, passRatio: 0.8, xpReward: 20 },
        sentence: { maxAmplitudeStart: 0.3, silenceGapLimit: 0.2, passRatio: 0.85, xpReward: 50 },
      },
      '2': {
        word: { maxAmplitudeStart: 0.35, silenceGapLimit: 0.25, passRatio: 0.8, xpReward: 15 },
        phrase: { maxAmplitudeStart: 0.3, silenceGapLimit: 0.2, passRatio: 0.8, xpReward: 25 },
        sentence: { maxAmplitudeStart: 0.25, silenceGapLimit: 0.15, passRatio: 0.85, xpReward: 60 },
      },
      '3': {
        word: { maxAmplitudeStart: 0.3, silenceGapLimit: 0.2, passRatio: 0.8, xpReward: 20 },
        phrase: { maxAmplitudeStart: 0.25, silenceGapLimit: 0.15, passRatio: 0.8, xpReward: 30 },
        sentence: { maxAmplitudeStart: 0.2, silenceGapLimit: 0.1, passRatio: 0.85, xpReward: 70 },
      },
    },
  },
  onetap: {
    gameId: 'onetap',
    description: 'Repetition / One-Tap Control',
    tiers: {
      '1': {
        word: { maxRepetitionProb: 0.25, passRatio: 0.8, xpReward: 10 },
        phrase: { maxRepetitionProb: 0.2, passRatio: 0.8, xpReward: 20 },
        sentence: { maxRepetitionProb: 0.15, passRatio: 0.85, xpReward: 50 },
      },
      '2': {
        word: { maxRepetitionProb: 0.2, passRatio: 0.8, xpReward: 15 },
        phrase: { maxRepetitionProb: 0.15, passRatio: 0.8, xpReward: 25 },
        sentence: { maxRepetitionProb: 0.1, passRatio: 0.85, xpReward: 60 },
      },
      '3': {
        word: { maxRepetitionProb: 0.15, passRatio: 0.8, xpReward: 20 },
        phrase: { maxRepetitionProb: 0.1, passRatio: 0.8, xpReward: 30 },
        sentence: { maxRepetitionProb: 0.05, passRatio: 0.85, xpReward: 70 },
      },
    },
  },
};

async function seed() {
  console.log('🌱 Seeding progression rules...');
  try {
    const batch = db.batch();
    for (const [gameId, rules] of Object.entries(progressionRules)) {
      const ref = db.collection('progression_rules').doc(gameId);
      batch.set(ref, rules);
      console.log(`  ✓ ${gameId}`);
    }
    await batch.commit();
    console.log('✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();