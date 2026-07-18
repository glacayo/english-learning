import type { Exercise } from '../domain/types';

/**
 * Fixed 100-exercise catalog — the single source of truth for the app
 * (exercise-bank spec).
 *
 * Distribution: 8 approved topics, four with 13 and four with 12, summing to
 * exactly 100. The catalog is validated at build/test time by
 * `validateCatalog` (see `src/domain/catalog.ts`).
 *
 * Each record has a unique `id` (`{topic-slug}-{nn}`), an approved `topic`, a
 * non-empty `prompt`, a non-empty `acceptedAnswers` list, and a `difficulty`
 * value in 1–10. Alternate answers (contractions, synonyms) are included where
 * appropriate to keep grading fair.
 *
 * `difficulty === levelId` (design.md): the 100 records partition into exactly
 * 10 levels of 10 by `difficulty`, ordered easiest (Level 1) to hardest
 * (Level 10). The difficulty rubric follows a pedagogical gradient
 * (present-simple → daily routine / like-dislike → present-progressive →
 * simple-past → present-simple-3rd → simple-past-3rd → present-progressive-3rd)
 * and is intentionally authored per-record here as a reviewable content diff;
 * it is NOT auto-derived and is adjustable after feedback (see design.md
 * "Difficulty rubric → 10 buckets"). Each difficulty bucket contains exactly
 * 10 exercises; `validateCatalog` enforces this at build/test time.
 */
export const EXERCISES: readonly Exercise[] = [
  // ============================================================
  // present-simple — 13 exercises
  // ============================================================
  { id: 'present-simple-01', topic: 'present-simple', prompt: 'I ___ to school every day. (go)', acceptedAnswers: ['go'], difficulty: 1 },
  { id: 'present-simple-02', topic: 'present-simple', prompt: 'She ___ apples. (like)', acceptedAnswers: ['likes'], difficulty: 1 },
  { id: 'present-simple-03', topic: 'present-simple', prompt: 'We ___ TV in the evening. (watch)', acceptedAnswers: ['watch'], difficulty: 1 },
  { id: 'present-simple-04', topic: 'present-simple', prompt: 'They ___ in London. (live)', acceptedAnswers: ['live'], difficulty: 1 },
  { id: 'present-simple-05', topic: 'present-simple', prompt: 'He ___ his teeth every morning. (brush)', acceptedAnswers: ['brushes'], difficulty: 1 },
  { id: 'present-simple-06', topic: 'present-simple', prompt: 'My mom ___ pizza on Fridays. (make)', acceptedAnswers: ['makes'], difficulty: 1 },
  { id: 'present-simple-07', topic: 'present-simple', prompt: 'I ___ water after running. (drink)', acceptedAnswers: ['drink'], difficulty: 1 },
  { id: 'present-simple-08', topic: 'present-simple', prompt: 'The dog ___ fast. (run)', acceptedAnswers: ['runs'], difficulty: 1 },
  { id: 'present-simple-09', topic: 'present-simple', prompt: 'You ___ a nice bike. (have)', acceptedAnswers: ['have'], difficulty: 1 },
  { id: 'present-simple-10', topic: 'present-simple', prompt: 'My sister ___ English at school. (study)', acceptedAnswers: ['studies'], difficulty: 1 },
  { id: 'present-simple-11', topic: 'present-simple', prompt: 'I ___ my homework after dinner. (do)', acceptedAnswers: ['do'], difficulty: 2 },
  { id: 'present-simple-12', topic: 'present-simple', prompt: 'The train ___ at 7 o\'clock. (arrive)', acceptedAnswers: ['arrives'], difficulty: 2 },
  { id: 'present-simple-13', topic: 'present-simple', prompt: 'We ___ happy. (be)', acceptedAnswers: ['are'], difficulty: 2 },

  // ============================================================
  // simple-past — 13 exercises
  // ============================================================
  { id: 'simple-past-01', topic: 'simple-past', prompt: 'Yesterday I ___ to the park. (go)', acceptedAnswers: ['went'], difficulty: 6 },
  { id: 'simple-past-02', topic: 'simple-past', prompt: 'She ___ a sandwich for lunch. (eat)', acceptedAnswers: ['ate'], difficulty: 6 },
  { id: 'simple-past-03', topic: 'simple-past', prompt: 'We ___ a fun movie. (see)', acceptedAnswers: ['saw'], difficulty: 6 },
  { id: 'simple-past-04', topic: 'simple-past', prompt: 'They ___ football after school. (play)', acceptedAnswers: ['played'], difficulty: 6 },
  { id: 'simple-past-05', topic: 'simple-past', prompt: 'He ___ a letter to his friend. (write)', acceptedAnswers: ['wrote'], difficulty: 6 },
  { id: 'simple-past-06', topic: 'simple-past', prompt: 'I ___ my room yesterday. (clean)', acceptedAnswers: ['cleaned'], difficulty: 6 },
  { id: 'simple-past-07', topic: 'simple-past', prompt: 'My dad ___ the car. (drive)', acceptedAnswers: ['drove'], difficulty: 6 },
  { id: 'simple-past-08', topic: 'simple-past', prompt: 'We ___ a lot at the party. (dance)', acceptedAnswers: ['danced'], difficulty: 6 },
  { id: 'simple-past-09', topic: 'simple-past', prompt: 'She ___ a new song. (sing)', acceptedAnswers: ['sang'], difficulty: 6 },
  { id: 'simple-past-10', topic: 'simple-past', prompt: 'I ___ a great book last night. (read)', acceptedAnswers: ['read'], difficulty: 6 },
  { id: 'simple-past-11', topic: 'simple-past', prompt: 'They ___ to the zoo. (go)', acceptedAnswers: ['went'], difficulty: 7 },
  { id: 'simple-past-12', topic: 'simple-past', prompt: 'He ___ his hand. (wash)', acceptedAnswers: ['washed'], difficulty: 7 },
  { id: 'simple-past-13', topic: 'simple-past', prompt: 'We ___ tired after the trip. (be)', acceptedAnswers: ['were'], difficulty: 7 },

  // ============================================================
  // present-progressive — 13 exercises
  // ============================================================
  { id: 'present-progressive-01', topic: 'present-progressive', prompt: 'I ___ right now. (read)', acceptedAnswers: ['am reading'], difficulty: 4 },
  { id: 'present-progressive-02', topic: 'present-progressive', prompt: 'She ___ a picture. (draw)', acceptedAnswers: ['is drawing'], difficulty: 4 },
  { id: 'present-progressive-03', topic: 'present-progressive', prompt: 'They ___ in the pool. (swim)', acceptedAnswers: ['are swimming'], difficulty: 4 },
  { id: 'present-progressive-04', topic: 'present-progressive', prompt: 'He ___ a book. (read)', acceptedAnswers: ['is reading'], difficulty: 5 },
  { id: 'present-progressive-05', topic: 'present-progressive', prompt: 'We ___ to music now. (listen)', acceptedAnswers: ['are listening'], difficulty: 5 },
  { id: 'present-progressive-06', topic: 'present-progressive', prompt: 'The cat ___ on the sofa. (sleep)', acceptedAnswers: ['is sleeping'], difficulty: 5 },
  { id: 'present-progressive-07', topic: 'present-progressive', prompt: 'I ___ a cake. (bake)', acceptedAnswers: ['am baking'], difficulty: 5 },
  { id: 'present-progressive-08', topic: 'present-progressive', prompt: 'You ___ fast. (run)', acceptedAnswers: ['are running'], difficulty: 5 },
  { id: 'present-progressive-09', topic: 'present-progressive', prompt: 'She ___ a letter. (write)', acceptedAnswers: ['is writing'], difficulty: 5 },
  { id: 'present-progressive-10', topic: 'present-progressive', prompt: 'They ___ a fort. (build)', acceptedAnswers: ['are building'], difficulty: 5 },
  { id: 'present-progressive-11', topic: 'present-progressive', prompt: 'He ___ the door. (open)', acceptedAnswers: ['is opening'], difficulty: 5 },
  { id: 'present-progressive-12', topic: 'present-progressive', prompt: 'We ___ dinner. (cook)', acceptedAnswers: ['are cooking'], difficulty: 5 },
  { id: 'present-progressive-13', topic: 'present-progressive', prompt: 'It ___ outside. (rain)', acceptedAnswers: ['is raining'], difficulty: 5 },

  // ============================================================
  // simple-past-3rd — 13 exercises
  // ============================================================
  { id: 'simple-past-3rd-01', topic: 'simple-past-3rd', prompt: 'He ___ to school yesterday. (go)', acceptedAnswers: ['went'], difficulty: 8 },
  { id: 'simple-past-3rd-02', topic: 'simple-past-3rd', prompt: 'She ___ an apple. (eat)', acceptedAnswers: ['ate'], difficulty: 8 },
  { id: 'simple-past-3rd-03', topic: 'simple-past-3rd', prompt: 'He ___ a story. (write)', acceptedAnswers: ['wrote'], difficulty: 8 },
  { id: 'simple-past-3rd-04', topic: 'simple-past-3rd', prompt: 'She ___ the bus. (take)', acceptedAnswers: ['took'], difficulty: 8 },
  { id: 'simple-past-3rd-05', topic: 'simple-past-3rd', prompt: 'He ___ his friend. (call)', acceptedAnswers: ['called'], difficulty: 8 },
  { id: 'simple-past-3rd-06', topic: 'simple-past-3rd', prompt: 'She ___ a picture. (paint)', acceptedAnswers: ['painted'], difficulty: 9 },
  { id: 'simple-past-3rd-07', topic: 'simple-past-3rd', prompt: 'He ___ the ball. (kick)', acceptedAnswers: ['kicked'], difficulty: 9 },
  { id: 'simple-past-3rd-08', topic: 'simple-past-3rd', prompt: 'She ___ a gift. (give)', acceptedAnswers: ['gave'], difficulty: 9 },
  { id: 'simple-past-3rd-09', topic: 'simple-past-3rd', prompt: 'He ___ his shoes. (tie)', acceptedAnswers: ['tied'], difficulty: 9 },
  { id: 'simple-past-3rd-10', topic: 'simple-past-3rd', prompt: 'She ___ the door. (close)', acceptedAnswers: ['closed'], difficulty: 9 },
  { id: 'simple-past-3rd-11', topic: 'simple-past-3rd', prompt: 'He ___ a song. (sing)', acceptedAnswers: ['sang'], difficulty: 9 },
  { id: 'simple-past-3rd-12', topic: 'simple-past-3rd', prompt: 'She ___ to the teacher. (talk)', acceptedAnswers: ['talked'], difficulty: 9 },
  { id: 'simple-past-3rd-13', topic: 'simple-past-3rd', prompt: 'He ___ a big fish. (catch)', acceptedAnswers: ['caught'], difficulty: 9 },

  // ============================================================
  // present-simple-3rd — 12 exercises
  // ============================================================
  { id: 'present-simple-3rd-01', topic: 'present-simple-3rd', prompt: 'He ___ soccer on Saturdays. (play)', acceptedAnswers: ['plays'], difficulty: 7 },
  { id: 'present-simple-3rd-02', topic: 'present-simple-3rd', prompt: 'She ___ in a big house. (live)', acceptedAnswers: ['lives'], difficulty: 7 },
  { id: 'present-simple-3rd-03', topic: 'present-simple-3rd', prompt: 'He ___ every morning. (run)', acceptedAnswers: ['runs'], difficulty: 7 },
  { id: 'present-simple-3rd-04', topic: 'present-simple-3rd', prompt: 'She ___ her room. (clean)', acceptedAnswers: ['cleans'], difficulty: 7 },
  { id: 'present-simple-3rd-05', topic: 'present-simple-3rd', prompt: 'He ___ to pop music. (listen)', acceptedAnswers: ['listens'], difficulty: 7 },
  { id: 'present-simple-3rd-06', topic: 'present-simple-3rd', prompt: 'She ___ her dog. (love)', acceptedAnswers: ['loves'], difficulty: 7 },
  { id: 'present-simple-3rd-07', topic: 'present-simple-3rd', prompt: 'He ___ a bike to school. (ride)', acceptedAnswers: ['rides'], difficulty: 7 },
  { id: 'present-simple-3rd-08', topic: 'present-simple-3rd', prompt: 'She ___ with her friends. (study)', acceptedAnswers: ['studies'], difficulty: 8 },
  { id: 'present-simple-3rd-09', topic: 'present-simple-3rd', prompt: 'He ___ a lot of water. (drink)', acceptedAnswers: ['drinks'], difficulty: 8 },
  { id: 'present-simple-3rd-10', topic: 'present-simple-3rd', prompt: 'She ___ her grandma. (visit)', acceptedAnswers: ['visits'], difficulty: 8 },
  { id: 'present-simple-3rd-11', topic: 'present-simple-3rd', prompt: 'He ___ his face. (wash)', acceptedAnswers: ['washes'], difficulty: 8 },
  { id: 'present-simple-3rd-12', topic: 'present-simple-3rd', prompt: 'She ___ a cat. (have)', acceptedAnswers: ['has'], difficulty: 8 },

  // ============================================================
  // present-progressive-3rd — 12 exercises
  // ============================================================
  { id: 'present-progressive-3rd-01', topic: 'present-progressive-3rd', prompt: 'He ___ right now. (run)', acceptedAnswers: ['is running'], difficulty: 9 },
  { id: 'present-progressive-3rd-02', topic: 'present-progressive-3rd', prompt: 'She ___ a book. (read)', acceptedAnswers: ['is reading'], difficulty: 9 },
  { id: 'present-progressive-3rd-03', topic: 'present-progressive-3rd', prompt: 'He ___ a song. (sing)', acceptedAnswers: ['is singing'], difficulty: 10 },
  { id: 'present-progressive-3rd-04', topic: 'present-progressive-3rd', prompt: 'She ___ her hair. (brush)', acceptedAnswers: ['is brushing'], difficulty: 10 },
  { id: 'present-progressive-3rd-05', topic: 'present-progressive-3rd', prompt: 'He ___ a sandcastle. (build)', acceptedAnswers: ['is building'], difficulty: 10 },
  { id: 'present-progressive-3rd-06', topic: 'present-progressive-3rd', prompt: 'She ___ her dog. (walk)', acceptedAnswers: ['is walking'], difficulty: 10 },
  { id: 'present-progressive-3rd-07', topic: 'present-progressive-3rd', prompt: 'He ___ a letter. (write)', acceptedAnswers: ['is writing'], difficulty: 10 },
  { id: 'present-progressive-3rd-08', topic: 'present-progressive-3rd', prompt: 'She ___ a star. (draw)', acceptedAnswers: ['is drawing'], difficulty: 10 },
  { id: 'present-progressive-3rd-09', topic: 'present-progressive-3rd', prompt: 'He ___ the stairs. (climb)', acceptedAnswers: ['is climbing'], difficulty: 10 },
  { id: 'present-progressive-3rd-10', topic: 'present-progressive-3rd', prompt: 'She ___ to her mom. (talk)', acceptedAnswers: ['is talking'], difficulty: 10 },
  { id: 'present-progressive-3rd-11', topic: 'present-progressive-3rd', prompt: 'He ___ his car. (wash)', acceptedAnswers: ['is washing'], difficulty: 10 },
  { id: 'present-progressive-3rd-12', topic: 'present-progressive-3rd', prompt: 'She ___ a juice. (drink)', acceptedAnswers: ['is drinking'], difficulty: 10 },

  // ============================================================
  // daily-routine — 12 exercises
  // ============================================================
  { id: 'daily-routine-01', topic: 'daily-routine', prompt: 'I ___ up at 7 o\'clock. (wake)', acceptedAnswers: ['wake', 'get'], difficulty: 2 },
  { id: 'daily-routine-02', topic: 'daily-routine', prompt: 'I ___ my teeth every morning. (brush)', acceptedAnswers: ['brush'], difficulty: 2 },
  { id: 'daily-routine-03', topic: 'daily-routine', prompt: 'I ___ breakfast at 8. (eat)', acceptedAnswers: ['eat', 'have'], difficulty: 2 },
  { id: 'daily-routine-04', topic: 'daily-routine', prompt: 'I ___ to school by bus. (go)', acceptedAnswers: ['go'], difficulty: 2 },
  { id: 'daily-routine-05', topic: 'daily-routine', prompt: 'I ___ lunch at noon. (eat)', acceptedAnswers: ['eat', 'have'], difficulty: 2 },
  { id: 'daily-routine-06', topic: 'daily-routine', prompt: 'I ___ my homework in the afternoon. (do)', acceptedAnswers: ['do'], difficulty: 2 },
  { id: 'daily-routine-07', topic: 'daily-routine', prompt: 'I ___ dinner with my family. (eat)', acceptedAnswers: ['eat', 'have'], difficulty: 2 },
  { id: 'daily-routine-08', topic: 'daily-routine', prompt: 'I ___ TV before bed. (watch)', acceptedAnswers: ['watch'], difficulty: 3 },
  { id: 'daily-routine-09', topic: 'daily-routine', prompt: 'I ___ to bed at 9 o\'clock. (go)', acceptedAnswers: ['go'], difficulty: 3 },
  { id: 'daily-routine-10', topic: 'daily-routine', prompt: 'I ___ my face in the morning. (wash)', acceptedAnswers: ['wash'], difficulty: 3 },
  { id: 'daily-routine-11', topic: 'daily-routine', prompt: 'I ___ my clothes for school. (wear)', acceptedAnswers: ['wear', 'put on'], difficulty: 3 },
  { id: 'daily-routine-12', topic: 'daily-routine', prompt: 'I ___ a shower. (take)', acceptedAnswers: ['take', 'have'], difficulty: 3 },

  // ============================================================
  // like-dislike — 12 exercises
  // ============================================================
  { id: 'like-dislike-01', topic: 'like-dislike', prompt: 'I ___ pizza. (positive) (like)', acceptedAnswers: ['like', 'love'], difficulty: 3 },
  { id: 'like-dislike-02', topic: 'like-dislike', prompt: 'I ___ broccoli. (negative) (like)', acceptedAnswers: ["don't like", 'do not like', 'hate'], difficulty: 3 },
  { id: 'like-dislike-03', topic: 'like-dislike', prompt: 'She ___ ice cream. (positive) (like)', acceptedAnswers: ['likes', 'loves'], difficulty: 3 },
  { id: 'like-dislike-04', topic: 'like-dislike', prompt: 'He ___ math. (negative) (like)', acceptedAnswers: ["doesn't like", 'does not like', 'hates'], difficulty: 3 },
  { id: 'like-dislike-05', topic: 'like-dislike', prompt: 'I ___ swimming. (positive) (like)', acceptedAnswers: ['like', 'love'], difficulty: 3 },
  { id: 'like-dislike-06', topic: 'like-dislike', prompt: 'They ___ vegetables. (negative) (like)', acceptedAnswers: ["don't like", 'do not like'], difficulty: 4 },
  { id: 'like-dislike-07', topic: 'like-dislike', prompt: 'We ___ reading books. (positive) (like)', acceptedAnswers: ['like', 'love'], difficulty: 4 },
  { id: 'like-dislike-08', topic: 'like-dislike', prompt: 'I ___ running. (negative) (like)', acceptedAnswers: ["don't like", 'do not like', 'hate'], difficulty: 4 },
  { id: 'like-dislike-09', topic: 'like-dislike', prompt: 'She ___ dancing. (positive) (like)', acceptedAnswers: ['likes', 'loves'], difficulty: 4 },
  { id: 'like-dislike-10', topic: 'like-dislike', prompt: 'He ___ homework. (negative) (like)', acceptedAnswers: ["doesn't like", 'does not like', 'hates'], difficulty: 4 },
  { id: 'like-dislike-11', topic: 'like-dislike', prompt: 'I ___ music. (positive) (like)', acceptedAnswers: ['like', 'love'], difficulty: 4 },
  { id: 'like-dislike-12', topic: 'like-dislike', prompt: 'We ___ rainy days. (negative) (like)', acceptedAnswers: ["don't like", 'do not like', 'hate'], difficulty: 4 },
];

/**
 * Convenience: the catalog validated once and frozen. Importing this constant
 * runs `assertValidCatalog` so a malformed catalog fails loudly at startup or
 * test time rather than producing confusing grading behavior.
 */
import { assertValidCatalog } from '../domain/catalog';

assertValidCatalog(EXERCISES);