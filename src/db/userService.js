/**
 * userService.js
 * All database interactions go through this layer.
 * Handles input sanitization, error normalisation, and guest<->auth migration.
 */

import { supabase } from "./supabase";

// ── Sanitisation helpers ──────────────────────────────────────────────────
const sanitizeText = (s) =>
  typeof s === "string" ? s.replace(/[<>]/g, "").trim().slice(0, 2000) : "";

const sanitizeTopics = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((t) => sanitizeText(t).toLowerCase().slice(0, 100))
        .filter(Boolean)
        .slice(0, 50)
    : [];

const clamp = (n, min, max) =>
  typeof n === "number" && isFinite(n) ? Math.min(Math.max(n, min), max) : min;

// ── Profile ───────────────────────────────────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// ── Study Sessions ────────────────────────────────────────────────────────
/**
 * Save a completed focus session and update profile aggregates atomically.
 * Returns the created session row.
 */
export async function saveStudySession({
  userId,
  material,
  freqKey,
  pomPhase,
  durationSeconds,
  focusRating,
  voiceQuestions,
  weakAreas,
  coveredTopics,
  aiInsight,
  nextFocusTopic,
}) {
  // Validate
  const freq = ["gamma", "beta", "alpha", "theta"].includes(freqKey)
    ? freqKey
    : "beta";
  const phase = ["focus", "shortBreak", "longBreak"].includes(pomPhase)
    ? pomPhase
    : "focus";

  const payload = {
    user_id:          userId,
    material:         sanitizeText(material),
    freq_key:         freq,
    pom_phase:        phase,
    duration_seconds: clamp(Math.round(durationSeconds), 0, 86400),
    focus_rating:     focusRating ? clamp(focusRating, 1, 5) : null,
    voice_questions:  clamp(voiceQuestions, 0, 9999),
    weak_areas:       sanitizeTopics(weakAreas),
    covered_topics:   sanitizeText(coveredTopics),
    ai_insight:       sanitizeText(aiInsight),
    next_focus_topic: sanitizeText(nextFocusTopic),
  };

  const { data: session, error: sessionErr } = await supabase
    .from("study_sessions")
    .insert(payload)
    .select()
    .single();

  if (sessionErr) throw sessionErr;

  // Atomically update profile stats (streak, totals) via server-side function
  const { error: statsErr } = await supabase.rpc("increment_profile_stats", {
    p_user_id:         userId,
    p_study_seconds:   payload.duration_seconds,
    p_voice_questions: payload.voice_questions,
  });

  if (statsErr) console.warn("Profile stats update failed:", statsErr.message);

  return session;
}

// ── Quiz Results ──────────────────────────────────────────────────────────
export async function saveQuizResult({
  userId,
  sessionId,
  material,
  roundNumber,
  difficulty,
  score,
  totalQuestions,
  topicsTested,
}) {
  const diff = ["easy", "medium", "hard"].includes(difficulty)
    ? difficulty
    : "medium";

  const { data, error } = await supabase
    .from("quiz_results")
    .insert({
      user_id:         userId,
      session_id:      sessionId || null,
      material:        sanitizeText(material),
      round_number:    clamp(roundNumber, 1, 999),
      difficulty:      diff,
      score:           clamp(score, 0, totalQuestions),
      total_questions: clamp(totalQuestions, 1, 100),
      topics_tested:   sanitizeTopics(topicsTested),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Learning Progress ─────────────────────────────────────────────────────
/**
 * Batch-upsert topic mastery after a quiz round.
 * Uses a server-side function to prevent race conditions.
 */
export async function updateTopicProgress(userId, topics, isCorrect) {
  const clean = sanitizeTopics(topics);
  if (!clean.length) return;

  const { error } = await supabase.rpc("upsert_topic_progress", {
    p_user_id: userId,
    p_topics:  clean,
    p_correct: !!isCorrect,
  });

  if (error) console.warn("Topic progress update failed:", error.message);
}

/**
 * Fetch topics due for review today (spaced repetition).
 */
export async function getTopicsForReview(userId) {
  const { data, error } = await supabase
    .from("learning_progress")
    .select("topic, mastery_level, encounter_count, correct_count, next_review")
    .eq("user_id", userId)
    .lte("next_review", new Date().toISOString())
    .order("next_review", { ascending: true })
    .limit(20);

  if (error) throw error;
  return data || [];
}

// ── Dashboard data ────────────────────────────────────────────────────────
export async function getDashboardData(userId) {
  const [profileRes, sessionsRes, progressRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase
      .from("study_sessions")
      .select("material, freq_key, duration_seconds, focus_rating, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("learning_progress")
      .select("topic, mastery_level, encounter_count, correct_count")
      .eq("user_id", userId)
      .order("encounter_count", { ascending: false })
      .limit(30),
  ]);

  return {
    profile:  profileRes.data,
    sessions: sessionsRes.data || [],
    progress: progressRes.data || [],
  };
}

// ── Guest → Auth migration ────────────────────────────────────────────────
/**
 * Called once when a guest user signs in.
 * Reads guest data from localStorage and writes it to the DB.
 */
const GUEST_KEY = "focusmind_guest_sessions";

export function saveGuestSession(sessionData) {
  try {
    const existing = JSON.parse(localStorage.getItem(GUEST_KEY) || "[]");
    existing.push({ ...sessionData, timestamp: Date.now() });
    localStorage.setItem(GUEST_KEY, JSON.stringify(existing.slice(-20))); // keep last 20
  } catch (_) {}
}

export async function migrateGuestData(userId) {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return;
    const sessions = JSON.parse(raw);
    if (!sessions.length) return;

    for (const s of sessions) {
      await saveStudySession({ userId, ...s }).catch(() => {});
    }
    localStorage.removeItem(GUEST_KEY);
    console.log(`Migrated ${sessions.length} guest session(s) to account.`);
  } catch (e) {
    console.warn("Guest migration failed:", e.message);
  }
}
