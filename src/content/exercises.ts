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
 * non-empty `prompt`, and a non-empty `acceptedAnswers` list. Alternate answers
 * (contractions, synonyms) are included where appropriate to keep grading fair.
 */
export const EXERCISES: readonly Exercise[] = [
  // ============================================================
  // present-simple — 13 exercises
  // ============================================================
  { id: 'present-simple-01', topic: 'present-simple', prompt: 'I ___ to school every day. (go)', acceptedAnswers: ['go'] },
  { id: 'present-simple-02', topic: 'present-simple', prompt: 'She ___ apples. (like)', acceptedAnswers: ['likes'] },
  { id: 'present-simple-03', topic: 'present-simple', prompt: 'We ___ TV in the evening. (watch)', acceptedAnswers: ['watch'] },
  { id: 'present-simple-04', topic: 'present-simple', prompt: 'They ___ in London. (live)', acceptedAnswers: ['live'] },
  { id: 'present-simple-05', topic: 'present-simple', prompt: 'He ___ his teeth every morning. (brush)', acceptedAnswers: ['brushes'] },
  { id: 'present-simple-06', topic: 'present-simple', prompt: 'My mom ___ pizza on Fridays. (make)', acceptedAnswers: ['makes'] },
  { id: 'present-simple-07', topic: 'present-simple', prompt: 'I ___ water after running. (drink)', acceptedAnswers: ['drink'] },
  { id: 'present-simple-08', topic: 'present-simple', prompt: 'The dog ___ fast. (run)', acceptedAnswers: ['runs'] },
  { id: 'present-simple-09', topic: 'present-simple', prompt: 'You ___ a nice bike. (have)', acceptedAnswers: ['have'] },
  { id: 'present-simple-10', topic: 'present-simple', prompt: 'My sister ___ English at school. (study)', acceptedAnswers: ['studies'] },
  { id: 'present-simple-11', topic: 'present-simple', prompt: 'I ___ my homework after dinner. (do)', acceptedAnswers: ['do'] },
  { id: 'present-simple-12', topic: 'present-simple', prompt: 'The train ___ at 7 o\'clock. (arrive)', acceptedAnswers: ['arrives'] },
  { id: 'present-simple-13', topic: 'present-simple', prompt: 'We ___ happy. (be)', acceptedAnswers: ['are'] },

  // ============================================================
  // simple-past — 13 exercises
  // ============================================================
  { id: 'simple-past-01', topic: 'simple-past', prompt: 'Yesterday I ___ to the park. (go)', acceptedAnswers: ['went'] },
  { id: 'simple-past-02', topic: 'simple-past', prompt: 'She ___ a sandwich for lunch. (eat)', acceptedAnswers: ['ate'] },
  { id: 'simple-past-03', topic: 'simple-past', prompt: 'We ___ a fun movie. (see)', acceptedAnswers: ['saw'] },
  { id: 'simple-past-04', topic: 'simple-past', prompt: 'They ___ football after school. (play)', acceptedAnswers: ['played'] },
  { id: 'simple-past-05', topic: 'simple-past', prompt: 'He ___ a letter to his friend. (write)', acceptedAnswers: ['wrote'] },
  { id: 'simple-past-06', topic: 'simple-past', prompt: 'I ___ my room yesterday. (clean)', acceptedAnswers: ['cleaned'] },
  { id: 'simple-past-07', topic: 'simple-past', prompt: 'My dad ___ the car. (drive)', acceptedAnswers: ['drove'] },
  { id: 'simple-past-08', topic: 'simple-past', prompt: 'We ___ a lot at the party. (dance)', acceptedAnswers: ['danced'] },
  { id: 'simple-past-09', topic: 'simple-past', prompt: 'She ___ a new song. (sing)', acceptedAnswers: ['sang'] },
  { id: 'simple-past-10', topic: 'simple-past', prompt: 'I ___ a great book last night. (read)', acceptedAnswers: ['read'] },
  { id: 'simple-past-11', topic: 'simple-past', prompt: 'They ___ to the zoo. (go)', acceptedAnswers: ['went'] },
  { id: 'simple-past-12', topic: 'simple-past', prompt: 'He ___ his hand. (wash)', acceptedAnswers: ['washed'] },
  { id: 'simple-past-13', topic: 'simple-past', prompt: 'We ___ tired after the trip. (be)', acceptedAnswers: ['were'] },

  // ============================================================
  // present-progressive — 13 exercises
  // ============================================================
  { id: 'present-progressive-01', topic: 'present-progressive', prompt: 'I ___ right now. (read)', acceptedAnswers: ['am reading'] },
  { id: 'present-progressive-02', topic: 'present-progressive', prompt: 'She ___ a picture. (draw)', acceptedAnswers: ['is drawing'] },
  { id: 'present-progressive-03', topic: 'present-progressive', prompt: 'They ___ in the pool. (swim)', acceptedAnswers: ['are swimming'] },
  { id: 'present-progressive-04', topic: 'present-progressive', prompt: 'He ___ a book. (read)', acceptedAnswers: ['is reading'] },
  { id: 'present-progressive-05', topic: 'present-progressive', prompt: 'We ___ to music now. (listen)', acceptedAnswers: ['are listening'] },
  { id: 'present-progressive-06', topic: 'present-progressive', prompt: 'The cat ___ on the sofa. (sleep)', acceptedAnswers: ['is sleeping'] },
  { id: 'present-progressive-07', topic: 'present-progressive', prompt: 'I ___ a cake. (bake)', acceptedAnswers: ['am baking'] },
  { id: 'present-progressive-08', topic: 'present-progressive', prompt: 'You ___ fast. (run)', acceptedAnswers: ['are running'] },
  { id: 'present-progressive-09', topic: 'present-progressive', prompt: 'She ___ a letter. (write)', acceptedAnswers: ['is writing'] },
  { id: 'present-progressive-10', topic: 'present-progressive', prompt: 'They ___ a fort. (build)', acceptedAnswers: ['are building'] },
  { id: 'present-progressive-11', topic: 'present-progressive', prompt: 'He ___ the door. (open)', acceptedAnswers: ['is opening'] },
  { id: 'present-progressive-12', topic: 'present-progressive', prompt: 'We ___ dinner. (cook)', acceptedAnswers: ['are cooking'] },
  { id: 'present-progressive-13', topic: 'present-progressive', prompt: 'It ___ outside. (rain)', acceptedAnswers: ['is raining'] },

  // ============================================================
  // simple-past-3rd — 13 exercises
  // ============================================================
  { id: 'simple-past-3rd-01', topic: 'simple-past-3rd', prompt: 'He ___ to school yesterday. (go)', acceptedAnswers: ['went'] },
  { id: 'simple-past-3rd-02', topic: 'simple-past-3rd', prompt: 'She ___ an apple. (eat)', acceptedAnswers: ['ate'] },
  { id: 'simple-past-3rd-03', topic: 'simple-past-3rd', prompt: 'He ___ a story. (write)', acceptedAnswers: ['wrote'] },
  { id: 'simple-past-3rd-04', topic: 'simple-past-3rd', prompt: 'She ___ the bus. (take)', acceptedAnswers: ['took'] },
  { id: 'simple-past-3rd-05', topic: 'simple-past-3rd', prompt: 'He ___ his friend. (call)', acceptedAnswers: ['called'] },
  { id: 'simple-past-3rd-06', topic: 'simple-past-3rd', prompt: 'She ___ a picture. (paint)', acceptedAnswers: ['painted'] },
  { id: 'simple-past-3rd-07', topic: 'simple-past-3rd', prompt: 'He ___ the ball. (kick)', acceptedAnswers: ['kicked'] },
  { id: 'simple-past-3rd-08', topic: 'simple-past-3rd', prompt: 'She ___ a gift. (give)', acceptedAnswers: ['gave'] },
  { id: 'simple-past-3rd-09', topic: 'simple-past-3rd', prompt: 'He ___ his shoes. (tie)', acceptedAnswers: ['tied'] },
  { id: 'simple-past-3rd-10', topic: 'simple-past-3rd', prompt: 'She ___ the door. (close)', acceptedAnswers: ['closed'] },
  { id: 'simple-past-3rd-11', topic: 'simple-past-3rd', prompt: 'He ___ a song. (sing)', acceptedAnswers: ['sang'] },
  { id: 'simple-past-3rd-12', topic: 'simple-past-3rd', prompt: 'She ___ to the teacher. (talk)', acceptedAnswers: ['talked'] },
  { id: 'simple-past-3rd-13', topic: 'simple-past-3rd', prompt: 'He ___ a big fish. (catch)', acceptedAnswers: ['caught'] },

  // ============================================================
  // present-simple-3rd — 12 exercises
  // ============================================================
  { id: 'present-simple-3rd-01', topic: 'present-simple-3rd', prompt: 'He ___ soccer on Saturdays. (play)', acceptedAnswers: ['plays'] },
  { id: 'present-simple-3rd-02', topic: 'present-simple-3rd', prompt: 'She ___ in a big house. (live)', acceptedAnswers: ['lives'] },
  { id: 'present-simple-3rd-03', topic: 'present-simple-3rd', prompt: 'He ___ every morning. (run)', acceptedAnswers: ['runs'] },
  { id: 'present-simple-3rd-04', topic: 'present-simple-3rd', prompt: 'She ___ her room. (clean)', acceptedAnswers: ['cleans'] },
  { id: 'present-simple-3rd-05', topic: 'present-simple-3rd', prompt: 'He ___ to pop music. (listen)', acceptedAnswers: ['listens'] },
  { id: 'present-simple-3rd-06', topic: 'present-simple-3rd', prompt: 'She ___ her dog. (love)', acceptedAnswers: ['loves'] },
  { id: 'present-simple-3rd-07', topic: 'present-simple-3rd', prompt: 'He ___ a bike to school. (ride)', acceptedAnswers: ['rides'] },
  { id: 'present-simple-3rd-08', topic: 'present-simple-3rd', prompt: 'She ___ with her friends. (study)', acceptedAnswers: ['studies'] },
  { id: 'present-simple-3rd-09', topic: 'present-simple-3rd', prompt: 'He ___ a lot of water. (drink)', acceptedAnswers: ['drinks'] },
  { id: 'present-simple-3rd-10', topic: 'present-simple-3rd', prompt: 'She ___ her grandma. (visit)', acceptedAnswers: ['visits'] },
  { id: 'present-simple-3rd-11', topic: 'present-simple-3rd', prompt: 'He ___ his face. (wash)', acceptedAnswers: ['washes'] },
  { id: 'present-simple-3rd-12', topic: 'present-simple-3rd', prompt: 'She ___ a cat. (have)', acceptedAnswers: ['has'] },

  // ============================================================
  // present-progressive-3rd — 12 exercises
  // ============================================================
  { id: 'present-progressive-3rd-01', topic: 'present-progressive-3rd', prompt: 'He ___ right now. (run)', acceptedAnswers: ['is running'] },
  { id: 'present-progressive-3rd-02', topic: 'present-progressive-3rd', prompt: 'She ___ a book. (read)', acceptedAnswers: ['is reading'] },
  { id: 'present-progressive-3rd-03', topic: 'present-progressive-3rd', prompt: 'He ___ a song. (sing)', acceptedAnswers: ['is singing'] },
  { id: 'present-progressive-3rd-04', topic: 'present-progressive-3rd', prompt: 'She ___ her hair. (brush)', acceptedAnswers: ['is brushing'] },
  { id: 'present-progressive-3rd-05', topic: 'present-progressive-3rd', prompt: 'He ___ a sandcastle. (build)', acceptedAnswers: ['is building'] },
  { id: 'present-progressive-3rd-06', topic: 'present-progressive-3rd', prompt: 'She ___ her dog. (walk)', acceptedAnswers: ['is walking'] },
  { id: 'present-progressive-3rd-07', topic: 'present-progressive-3rd', prompt: 'He ___ a letter. (write)', acceptedAnswers: ['is writing'] },
  { id: 'present-progressive-3rd-08', topic: 'present-progressive-3rd', prompt: 'She ___ a star. (draw)', acceptedAnswers: ['is drawing'] },
  { id: 'present-progressive-3rd-09', topic: 'present-progressive-3rd', prompt: 'He ___ the stairs. (climb)', acceptedAnswers: ['is climbing'] },
  { id: 'present-progressive-3rd-10', topic: 'present-progressive-3rd', prompt: 'She ___ to her mom. (talk)', acceptedAnswers: ['is talking'] },
  { id: 'present-progressive-3rd-11', topic: 'present-progressive-3rd', prompt: 'He ___ his car. (wash)', acceptedAnswers: ['is washing'] },
  { id: 'present-progressive-3rd-12', topic: 'present-progressive-3rd', prompt: 'She ___ a juice. (drink)', acceptedAnswers: ['is drinking'] },

  // ============================================================
  // daily-routine — 12 exercises
  // ============================================================
  { id: 'daily-routine-01', topic: 'daily-routine', prompt: 'I ___ up at 7 o\'clock. (wake)', acceptedAnswers: ['wake', 'get'] },
  { id: 'daily-routine-02', topic: 'daily-routine', prompt: 'I ___ my teeth every morning. (brush)', acceptedAnswers: ['brush'] },
  { id: 'daily-routine-03', topic: 'daily-routine', prompt: 'I ___ breakfast at 8. (eat)', acceptedAnswers: ['eat', 'have'] },
  { id: 'daily-routine-04', topic: 'daily-routine', prompt: 'I ___ to school by bus. (go)', acceptedAnswers: ['go'] },
  { id: 'daily-routine-05', topic: 'daily-routine', prompt: 'I ___ lunch at noon. (eat)', acceptedAnswers: ['eat', 'have'] },
  { id: 'daily-routine-06', topic: 'daily-routine', prompt: 'I ___ my homework in the afternoon. (do)', acceptedAnswers: ['do'] },
  { id: 'daily-routine-07', topic: 'daily-routine', prompt: 'I ___ dinner with my family. (eat)', acceptedAnswers: ['eat', 'have'] },
  { id: 'daily-routine-08', topic: 'daily-routine', prompt: 'I ___ TV before bed. (watch)', acceptedAnswers: ['watch'] },
  { id: 'daily-routine-09', topic: 'daily-routine', prompt: 'I ___ to bed at 9 o\'clock. (go)', acceptedAnswers: ['go'] },
  { id: 'daily-routine-10', topic: 'daily-routine', prompt: 'I ___ my face in the morning. (wash)', acceptedAnswers: ['wash'] },
  { id: 'daily-routine-11', topic: 'daily-routine', prompt: 'I ___ my clothes for school. (wear)', acceptedAnswers: ['wear', 'put on'] },
  { id: 'daily-routine-12', topic: 'daily-routine', prompt: 'I ___ a shower. (take)', acceptedAnswers: ['take', 'have'] },

  // ============================================================
  // like-dislike — 12 exercises
  // ============================================================
  { id: 'like-dislike-01', topic: 'like-dislike', prompt: 'I ___ pizza. (positive) (like)', acceptedAnswers: ['like', 'love'] },
  { id: 'like-dislike-02', topic: 'like-dislike', prompt: 'I ___ broccoli. (negative) (like)', acceptedAnswers: ["don't like", 'do not like', 'hate'] },
  { id: 'like-dislike-03', topic: 'like-dislike', prompt: 'She ___ ice cream. (positive) (like)', acceptedAnswers: ['likes', 'loves'] },
  { id: 'like-dislike-04', topic: 'like-dislike', prompt: 'He ___ math. (negative) (like)', acceptedAnswers: ["doesn't like", 'does not like', 'hates'] },
  { id: 'like-dislike-05', topic: 'like-dislike', prompt: 'I ___ swimming. (positive) (like)', acceptedAnswers: ['like', 'love'] },
  { id: 'like-dislike-06', topic: 'like-dislike', prompt: 'They ___ vegetables. (negative) (like)', acceptedAnswers: ["don't like", 'do not like'] },
  { id: 'like-dislike-07', topic: 'like-dislike', prompt: 'We ___ reading books. (positive) (like)', acceptedAnswers: ['like', 'love'] },
  { id: 'like-dislike-08', topic: 'like-dislike', prompt: 'I ___ running. (negative) (like)', acceptedAnswers: ["don't like", 'do not like', 'hate'] },
  { id: 'like-dislike-09', topic: 'like-dislike', prompt: 'She ___ dancing. (positive) (like)', acceptedAnswers: ['likes', 'loves'] },
  { id: 'like-dislike-10', topic: 'like-dislike', prompt: 'He ___ homework. (negative) (like)', acceptedAnswers: ["doesn't like", 'does not like', 'hates'] },
  { id: 'like-dislike-11', topic: 'like-dislike', prompt: 'I ___ music. (positive) (like)', acceptedAnswers: ['like', 'love'] },
  { id: 'like-dislike-12', topic: 'like-dislike', prompt: 'We ___ rainy days. (negative) (like)', acceptedAnswers: ["don't like", 'do not like', 'hate'] },
];

/**
 * Convenience: the catalog validated once and frozen. Importing this constant
 * runs `assertValidCatalog` so a malformed catalog fails loudly at startup or
 * test time rather than producing confusing grading behavior.
 */
import { assertValidCatalog } from '../domain/catalog';

assertValidCatalog(EXERCISES);