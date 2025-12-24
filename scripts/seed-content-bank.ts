/**
 * Content Bank Seed Script
 * 
 * Populates Firestore `content_bank` collection with speech therapy content
 * shared across multiple games (Snake, Turtle, Balloon, One-Tap).
 * 
 * Architecture: "One Word, Many Games" - Each content item is tagged with
 * compatibleGames array to indicate which exercises can use it.
 * 
 * Compatibility Rules:
 * - Turtle (slow speech): ALL content (any phoneme can be slowed)
 * - Snake (prolongation): Tier 1 (vowels/glides) + Tier 2 (fricatives) ONLY
 * - Balloon (soft onset): Tier 3 (stops) + vowel contexts
 * - One-Tap (rhythm): Multi-syllable content preferred (syllables >= 2)
 * 
 * Related: FR-009, Clarifications 2025-12-24
 */

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../server/credentials.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

/**
 * Content Bank Item Interface
 * Matches ContentBankItem entity from spec
 */
interface ContentBankItem {
  id: string;
  text: string;
  phoneme: string; // Display name (e.g., "M", "S", "A")
  phonemeCode: string; // IPA or technical code (e.g., "M", "S", "AA")
  tier: 1 | 2 | 3; // 1=Flow, 2=Friction, 3=Stops
  type: 'word' | 'phrase' | 'sentence';
  syllables: number;
  compatibleGames: ('snake' | 'turtle' | 'balloon' | 'onetap')[];
  ipa?: string; // Optional IPA transcription
  createdAt: string;
}

/**
 * Determine which games can use this content based on phoneme type
 */
function getCompatibleGames(
  tier: 1 | 2 | 3,
  phonemeCode: string,
  syllables: number
): ('snake' | 'turtle' | 'balloon' | 'onetap')[] {
  const games: ('snake' | 'turtle' | 'balloon' | 'onetap')[] = ['turtle']; // Everyone gets Turtle

  // SNAKE LOGIC: Only continuous sounds (Tier 1 + 2)
  // Tier 1: M, N, L, R, W, Y + vowels
  // Tier 2: S, Z, F, V, SH, TH, H
  // Excludes Tier 3 stops (P, B, T, D, K, G, CH, J)
  if (tier === 1 || tier === 2) {
    games.push('snake');
  }

  // BALLOON LOGIC: Focus on hard attacks (Tier 3 stops) or vowel contexts
  if (tier === 3 || ['AA', 'AE', 'IY', 'OW', 'UW', 'A', 'E', 'I', 'O', 'U'].includes(phonemeCode)) {
    games.push('balloon');
  }

  // ONE-TAP LOGIC: Needs rhythm (multi-syllable preferred)
  if (syllables >= 2) {
    games.push('onetap');
  }

  return games;
}

/**
 * Master content database organized by tier
 */
const contentDatabase: Omit<ContentBankItem, 'id' | 'compatibleGames' | 'createdAt'>[] = [
  // ============================================================================
  // TIER 1: FLOW SOUNDS (Vowels, M, N, L, R, W, Y)
  // Snake-Compatible: YES
  // ============================================================================

  // M words
  { text: 'Moon', phoneme: 'M', phonemeCode: 'M', tier: 1, type: 'word', syllables: 1 },
  { text: 'Mama', phoneme: 'M', phonemeCode: 'M', tier: 1, type: 'word', syllables: 2 },
  { text: 'Money', phoneme: 'M', phonemeCode: 'M', tier: 1, type: 'word', syllables: 2 },
  { text: 'My moon glows', phoneme: 'M', phonemeCode: 'M', tier: 1, type: 'phrase', syllables: 3 },
  { text: 'Mama makes me smile', phoneme: 'M', phonemeCode: 'M', tier: 1, type: 'phrase', syllables: 5 },
  { text: 'The moon is shining bright tonight', phoneme: 'M', phonemeCode: 'M', tier: 1, type: 'sentence', syllables: 8 },

  // N words
  { text: 'No', phoneme: 'N', phonemeCode: 'N', tier: 1, type: 'word', syllables: 1 },
  { text: 'Nice', phoneme: 'N', phonemeCode: 'N', tier: 1, type: 'word', syllables: 1 },
  { text: 'Nobody', phoneme: 'N', phonemeCode: 'N', tier: 1, type: 'word', syllables: 3 },
  { text: 'No more noise', phoneme: 'N', phonemeCode: 'N', tier: 1, type: 'phrase', syllables: 3 },
  { text: 'Nice and neat', phoneme: 'N', phonemeCode: 'N', tier: 1, type: 'phrase', syllables: 3 },
  { text: 'Nobody knows where the noise came from', phoneme: 'N', phonemeCode: 'N', tier: 1, type: 'sentence', syllables: 9 },

  // L words
  { text: 'Lion', phoneme: 'L', phonemeCode: 'L', tier: 1, type: 'word', syllables: 2 },
  { text: 'Love', phoneme: 'L', phonemeCode: 'L', tier: 1, type: 'word', syllables: 1 },
  { text: 'Little', phoneme: 'L', phonemeCode: 'L', tier: 1, type: 'word', syllables: 2 },
  { text: 'Little lion roars', phoneme: 'L', phonemeCode: 'L', tier: 1, type: 'phrase', syllables: 4 },
  { text: 'Love and laughter', phoneme: 'L', phonemeCode: 'L', tier: 1, type: 'phrase', syllables: 5 },
  { text: 'The little lion lives in the jungle', phoneme: 'L', phonemeCode: 'L', tier: 1, type: 'sentence', syllables: 9 },

  // R words
  { text: 'Rain', phoneme: 'R', phonemeCode: 'R', tier: 1, type: 'word', syllables: 1 },
  { text: 'Rainbow', phoneme: 'R', phonemeCode: 'R', tier: 1, type: 'word', syllables: 2 },
  { text: 'Running', phoneme: 'R', phonemeCode: 'R', tier: 1, type: 'word', syllables: 2 },
  { text: 'Rain is falling', phoneme: 'R', phonemeCode: 'R', tier: 1, type: 'phrase', syllables: 4 },
  { text: 'Rainbow in the sky', phoneme: 'R', phonemeCode: 'R', tier: 1, type: 'phrase', syllables: 5 },
  { text: 'The rain makes a rainbow after the storm', phoneme: 'R', phonemeCode: 'R', tier: 1, type: 'sentence', syllables: 10 },

  // W words
  { text: 'Why', phoneme: 'W', phonemeCode: 'W', tier: 1, type: 'word', syllables: 1 },
  { text: 'Water', phoneme: 'W', phonemeCode: 'W', tier: 1, type: 'word', syllables: 2 },
  { text: 'Window', phoneme: 'W', phonemeCode: 'W', tier: 1, type: 'word', syllables: 2 },
  { text: 'Why wait longer', phoneme: 'W', phonemeCode: 'W', tier: 1, type: 'phrase', syllables: 4 },
  { text: 'Water in the well', phoneme: 'W', phonemeCode: 'W', tier: 1, type: 'phrase', syllables: 5 },
  { text: 'I see water through the window', phoneme: 'W', phonemeCode: 'W', tier: 1, type: 'sentence', syllables: 8 },

  // Y words
  { text: 'Yes', phoneme: 'Y', phonemeCode: 'Y', tier: 1, type: 'word', syllables: 1 },
  { text: 'Yellow', phoneme: 'Y', phonemeCode: 'Y', tier: 1, type: 'word', syllables: 2 },
  { text: 'Yesterday', phoneme: 'Y', phonemeCode: 'Y', tier: 1, type: 'word', syllables: 3 },
  { text: 'Yes I can', phoneme: 'Y', phonemeCode: 'Y', tier: 1, type: 'phrase', syllables: 3 },
  { text: 'Yellow and yummy', phoneme: 'Y', phonemeCode: 'Y', tier: 1, type: 'phrase', syllables: 5 },
  { text: 'Yesterday was a yellow sunny day', phoneme: 'Y', phonemeCode: 'Y', tier: 1, type: 'sentence', syllables: 9 },

  // Vowel words (A/E/I/O/U)
  { text: 'Apple', phoneme: 'A', phonemeCode: 'AA', tier: 1, type: 'word', syllables: 2 },
  { text: 'Easy', phoneme: 'E', phonemeCode: 'IY', tier: 1, type: 'word', syllables: 2 },
  { text: 'Ice', phoneme: 'I', phonemeCode: 'AY', tier: 1, type: 'word', syllables: 1 },
  { text: 'Open', phoneme: 'O', phonemeCode: 'OW', tier: 1, type: 'word', syllables: 2 },
  { text: 'Umbrella', phoneme: 'U', phonemeCode: 'UH', tier: 1, type: 'word', syllables: 3 },

  // ============================================================================
  // TIER 2: FRICTION SOUNDS (S, Z, F, V, SH, TH, H)
  // Snake-Compatible: YES
  // ============================================================================

  // S words
  { text: 'Sun', phoneme: 'S', phonemeCode: 'S', tier: 2, type: 'word', syllables: 1 },
  { text: 'Snake', phoneme: 'S', phonemeCode: 'S', tier: 2, type: 'word', syllables: 1 },
  { text: 'Super', phoneme: 'S', phonemeCode: 'S', tier: 2, type: 'word', syllables: 2 },
  { text: 'See the sun', phoneme: 'S', phonemeCode: 'S', tier: 2, type: 'phrase', syllables: 3 },
  { text: 'Super smooth snake', phoneme: 'S', phonemeCode: 'S', tier: 2, type: 'phrase', syllables: 4 },
  { text: 'The snake slides slowly in the sun', phoneme: 'S', phonemeCode: 'S', tier: 2, type: 'sentence', syllables: 8 },

  // Z words
  { text: 'Zoo', phoneme: 'Z', phonemeCode: 'Z', tier: 2, type: 'word', syllables: 1 },
  { text: 'Zebra', phoneme: 'Z', phonemeCode: 'Z', tier: 2, type: 'word', syllables: 2 },
  { text: 'Zipper', phoneme: 'Z', phonemeCode: 'Z', tier: 2, type: 'word', syllables: 2 },
  { text: 'Zebra at zoo', phoneme: 'Z', phonemeCode: 'Z', tier: 2, type: 'phrase', syllables: 4 },
  { text: 'Zip the zipper', phoneme: 'Z', phonemeCode: 'Z', tier: 2, type: 'phrase', syllables: 4 },
  { text: 'The zebra is running at the zoo', phoneme: 'Z', phonemeCode: 'Z', tier: 2, type: 'sentence', syllables: 9 },

  // F words
  { text: 'Fish', phoneme: 'F', phonemeCode: 'F', tier: 2, type: 'word', syllables: 1 },
  { text: 'Five', phoneme: 'F', phonemeCode: 'F', tier: 2, type: 'word', syllables: 1 },
  { text: 'Funny', phoneme: 'F', phonemeCode: 'F', tier: 2, type: 'word', syllables: 2 },
  { text: 'Five funny fish', phoneme: 'F', phonemeCode: 'F', tier: 2, type: 'phrase', syllables: 4 },
  { text: 'Fish in the fountain', phoneme: 'F', phonemeCode: 'F', tier: 2, type: 'phrase', syllables: 5 },
  { text: 'Five fish swim fast in the fountain', phoneme: 'F', phonemeCode: 'F', tier: 2, type: 'sentence', syllables: 8 },

  // V words
  { text: 'Van', phoneme: 'V', phonemeCode: 'V', tier: 2, type: 'word', syllables: 1 },
  { text: 'Very', phoneme: 'V', phonemeCode: 'V', tier: 2, type: 'word', syllables: 2 },
  { text: 'Violet', phoneme: 'V', phonemeCode: 'V', tier: 2, type: 'word', syllables: 3 },
  { text: 'Very nice van', phoneme: 'V', phonemeCode: 'V', tier: 2, type: 'phrase', syllables: 4 },
  { text: 'Violet and velvet', phoneme: 'V', phonemeCode: 'V', tier: 2, type: 'phrase', syllables: 5 },
  { text: 'The van is very violet and pretty', phoneme: 'V', phonemeCode: 'V', tier: 2, type: 'sentence', syllables: 9 },

  // SH words
  { text: 'She', phoneme: 'SH', phonemeCode: 'SH', tier: 2, type: 'word', syllables: 1 },
  { text: 'Shoe', phoneme: 'SH', phonemeCode: 'SH', tier: 2, type: 'word', syllables: 1 },
  { text: 'Shiny', phoneme: 'SH', phonemeCode: 'SH', tier: 2, type: 'word', syllables: 2 },
  { text: 'Shiny new shoes', phoneme: 'SH', phonemeCode: 'SH', tier: 2, type: 'phrase', syllables: 4 },
  { text: 'She sells seashells', phoneme: 'SH', phonemeCode: 'SH', tier: 2, type: 'phrase', syllables: 5 },
  { text: 'She wears her shiny shoes every day', phoneme: 'SH', phonemeCode: 'SH', tier: 2, type: 'sentence', syllables: 9 },

  // TH words
  { text: 'The', phoneme: 'TH', phonemeCode: 'TH', tier: 2, type: 'word', syllables: 1 },
  { text: 'Think', phoneme: 'TH', phonemeCode: 'TH', tier: 2, type: 'word', syllables: 1 },
  { text: 'Thunder', phoneme: 'TH', phonemeCode: 'TH', tier: 2, type: 'word', syllables: 2 },
  { text: 'Think about this', phoneme: 'TH', phonemeCode: 'TH', tier: 2, type: 'phrase', syllables: 4 },
  { text: 'Thunder in the sky', phoneme: 'TH', phonemeCode: 'TH', tier: 2, type: 'phrase', syllables: 5 },
  { text: 'I can hear the thunder rolling far away', phoneme: 'TH', phonemeCode: 'TH', tier: 2, type: 'sentence', syllables: 11 },

  // H words
  { text: 'Hi', phoneme: 'H', phonemeCode: 'H', tier: 2, type: 'word', syllables: 1 },
  { text: 'Happy', phoneme: 'H', phonemeCode: 'H', tier: 2, type: 'word', syllables: 2 },
  { text: 'House', phoneme: 'H', phonemeCode: 'H', tier: 2, type: 'word', syllables: 1 },
  { text: 'Happy little house', phoneme: 'H', phonemeCode: 'H', tier: 2, type: 'phrase', syllables: 5 },
  { text: 'Hi there friend', phoneme: 'H', phonemeCode: 'H', tier: 2, type: 'phrase', syllables: 3 },
  { text: 'I am happy to see my house', phoneme: 'H', phonemeCode: 'H', tier: 2, type: 'sentence', syllables: 8 },

  // ============================================================================
  // TIER 3: STOP SOUNDS (P, B, T, D, K, G, CH, J)
  // Snake-Compatible: NO (cannot prolong stops)
  // ============================================================================

  // P words
  { text: 'Pig', phoneme: 'P', phonemeCode: 'P', tier: 3, type: 'word', syllables: 1 },
  { text: 'Pizza', phoneme: 'P', phonemeCode: 'P', tier: 3, type: 'word', syllables: 2 },
  { text: 'Purple', phoneme: 'P', phonemeCode: 'P', tier: 3, type: 'word', syllables: 2 },
  { text: 'Pink little pig', phoneme: 'P', phonemeCode: 'P', tier: 3, type: 'phrase', syllables: 4 },
  { text: 'Pizza for party', phoneme: 'P', phonemeCode: 'P', tier: 3, type: 'phrase', syllables: 5 },
  { text: 'The pig eats pizza at the party', phoneme: 'P', phonemeCode: 'P', tier: 3, type: 'sentence', syllables: 9 },

  // B words
  { text: 'Ball', phoneme: 'B', phonemeCode: 'B', tier: 3, type: 'word', syllables: 1 },
  { text: 'Banana', phoneme: 'B', phonemeCode: 'B', tier: 3, type: 'word', syllables: 3 },
  { text: 'Butterfly', phoneme: 'B', phonemeCode: 'B', tier: 3, type: 'word', syllables: 3 },
  { text: 'Big blue ball', phoneme: 'B', phonemeCode: 'B', tier: 3, type: 'phrase', syllables: 3 },
  { text: 'Banana and berry', phoneme: 'B', phonemeCode: 'B', tier: 3, type: 'phrase', syllables: 5 },
  { text: 'The butterfly flies over the banana tree', phoneme: 'B', phonemeCode: 'B', tier: 3, type: 'sentence', syllables: 11 },

  // T words
  { text: 'Top', phoneme: 'T', phonemeCode: 'T', tier: 3, type: 'word', syllables: 1 },
  { text: 'Tiger', phoneme: 'T', phonemeCode: 'T', tier: 3, type: 'word', syllables: 2 },
  { text: 'Turtle', phoneme: 'T', phonemeCode: 'T', tier: 3, type: 'word', syllables: 2 },
  { text: 'Tiny tiger tail', phoneme: 'T', phonemeCode: 'T', tier: 3, type: 'phrase', syllables: 4 },
  { text: 'Turtle at the top', phoneme: 'T', phonemeCode: 'T', tier: 3, type: 'phrase', syllables: 5 },
  { text: 'The tiger and turtle race to the top', phoneme: 'T', phonemeCode: 'T', tier: 3, type: 'sentence', syllables: 10 },

  // D words
  { text: 'Dog', phoneme: 'D', phonemeCode: 'D', tier: 3, type: 'word', syllables: 1 },
  { text: 'Door', phoneme: 'D', phonemeCode: 'D', tier: 3, type: 'word', syllables: 1 },
  { text: 'Dinosaur', phoneme: 'D', phonemeCode: 'D', tier: 3, type: 'word', syllables: 3 },
  { text: 'Dog at door', phoneme: 'D', phonemeCode: 'D', tier: 3, type: 'phrase', syllables: 3 },
  { text: 'Dancing dinosaur', phoneme: 'D', phonemeCode: 'D', tier: 3, type: 'phrase', syllables: 5 },
  { text: 'The dog waits at the door for dinner', phoneme: 'D', phonemeCode: 'D', tier: 3, type: 'sentence', syllables: 9 },

  // K words
  { text: 'Cat', phoneme: 'K', phonemeCode: 'K', tier: 3, type: 'word', syllables: 1 },
  { text: 'King', phoneme: 'K', phonemeCode: 'K', tier: 3, type: 'word', syllables: 1 },
  { text: 'Candy', phoneme: 'K', phonemeCode: 'K', tier: 3, type: 'word', syllables: 2 },
  { text: 'King and cat', phoneme: 'K', phonemeCode: 'K', tier: 3, type: 'phrase', syllables: 3 },
  { text: 'Candy for kids', phoneme: 'K', phonemeCode: 'K', tier: 3, type: 'phrase', syllables: 4 },
  { text: 'The cat gave candy to the king', phoneme: 'K', phonemeCode: 'K', tier: 3, type: 'sentence', syllables: 8 },

  // G words
  { text: 'Go', phoneme: 'G', phonemeCode: 'G', tier: 3, type: 'word', syllables: 1 },
  { text: 'Good', phoneme: 'G', phonemeCode: 'G', tier: 3, type: 'word', syllables: 1 },
  { text: 'Garden', phoneme: 'G', phonemeCode: 'G', tier: 3, type: 'word', syllables: 2 },
  { text: 'Go to garden', phoneme: 'G', phonemeCode: 'G', tier: 3, type: 'phrase', syllables: 4 },
  { text: 'Good game today', phoneme: 'G', phonemeCode: 'G', tier: 3, type: 'phrase', syllables: 4 },
  { text: 'Let us go play in the garden', phoneme: 'G', phonemeCode: 'G', tier: 3, type: 'sentence', syllables: 8 },

  // CH words
  { text: 'Chip', phoneme: 'CH', phonemeCode: 'CH', tier: 3, type: 'word', syllables: 1 },
  { text: 'Cheese', phoneme: 'CH', phonemeCode: 'CH', tier: 3, type: 'word', syllables: 1 },
  { text: 'Chicken', phoneme: 'CH', phonemeCode: 'CH', tier: 3, type: 'word', syllables: 2 },
  { text: 'Cheese and chips', phoneme: 'CH', phonemeCode: 'CH', tier: 3, type: 'phrase', syllables: 4 },
  { text: 'Chicken for lunch', phoneme: 'CH', phonemeCode: 'CH', tier: 3, type: 'phrase', syllables: 4 },
  { text: 'I like chicken with cheese and chips', phoneme: 'CH', phonemeCode: 'CH', tier: 3, type: 'sentence', syllables: 9 },

  // J words
  { text: 'Jump', phoneme: 'J', phonemeCode: 'J', tier: 3, type: 'word', syllables: 1 },
  { text: 'Joy', phoneme: 'J', phonemeCode: 'J', tier: 3, type: 'word', syllables: 1 },
  { text: 'Jungle', phoneme: 'J', phonemeCode: 'J', tier: 3, type: 'word', syllables: 2 },
  { text: 'Jump for joy', phoneme: 'J', phonemeCode: 'J', tier: 3, type: 'phrase', syllables: 3 },
  { text: 'Journey through jungle', phoneme: 'J', phonemeCode: 'J', tier: 3, type: 'phrase', syllables: 5 },
  { text: 'We jump with joy in the jungle', phoneme: 'J', phonemeCode: 'J', tier: 3, type: 'sentence', syllables: 8 },
];

/**
 * Seed the content_bank collection
 */
async function seedContentBank() {
  console.log('🌱 Starting content bank seed...\n');

  const batch = db.batch();
  const timestamp = new Date().toISOString();
  let count = 0;

  for (const item of contentDatabase) {
    // Generate unique ID
    const id = `${item.tier}_${item.type}_${item.phonemeCode}_${item.text.toLowerCase().replace(/\s+/g, '_')}`;

    // Calculate compatible games
    const compatibleGames = getCompatibleGames(item.tier, item.phonemeCode, item.syllables);

    // Create full document
    const doc: ContentBankItem = {
      ...item,
      id,
      compatibleGames,
      createdAt: timestamp,
    };

    // Add to batch
    const docRef = db.collection('content_bank').doc(id);
    batch.set(docRef, doc);
    count++;

    // Log progress
    const games = compatibleGames.join(', ');
    console.log(`✓ ${doc.text.padEnd(30)} | Tier ${doc.tier} | ${doc.type.padEnd(8)} | ${games}`);
  }

  // Commit batch
  await batch.commit();

  console.log(`\n✅ Successfully seeded ${count} items to content_bank collection`);

  // Print summary statistics
  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  const typeCounts = { word: 0, phrase: 0, sentence: 0 };
  const snakeCompatible = contentDatabase.filter((item) => {
    tierCounts[item.tier]++;
    typeCounts[item.type]++;
    return item.tier === 1 || item.tier === 2;
  }).length;

  console.log('\n📊 Summary:');
  console.log(`   Total items: ${count}`);
  console.log(`   Tier 1 (Flow): ${tierCounts[1]}`);
  console.log(`   Tier 2 (Friction): ${tierCounts[2]}`);
  console.log(`   Tier 3 (Stops): ${tierCounts[3]}`);
  console.log(`   Words: ${typeCounts.word}`);
  console.log(`   Phrases: ${typeCounts.phrase}`);
  console.log(`   Sentences: ${typeCounts.sentence}`);
  console.log(`   Snake-compatible: ${snakeCompatible} (Tier 1+2 only)`);
}

/**
 * Example query function to demonstrate filtering
 */
async function exampleSnakeQuery() {
  console.log('\n🐍 Example Snake Query (Tier 1, Word):');

  const snapshot = await db
    .collection('content_bank')
    .where('compatibleGames', 'array-contains', 'snake')
    .where('tier', '==', 1)
    .where('type', '==', 'word')
    .limit(5)
    .get();

  snapshot.forEach((doc) => {
    const data = doc.data() as ContentBankItem;
    console.log(`   "${data.text}" - ${data.phoneme} (${data.syllables} syllables)`);
  });
}

// Run the seed script
seedContentBank()
  .then(() => exampleSnakeQuery())
  .then(() => {
    console.log('\n✨ Seed complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
