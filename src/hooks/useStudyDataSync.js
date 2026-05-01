/**
 * useStudyDataSync.js
 *
 * Drop this hook into App.jsx with one line:
 *   const { onSessionComplete, onQuizComplete } = useStudyDataSync({ ... });
 *
 * It handles all DB writes transparently.
 * Authenticated users → Supabase.
 * Guests → localStorage (migrated on sign-in via AuthContext).
 */

import { useCallback, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  saveStudySession,
  saveQuizResult,
  updateTopicProgress,
  saveGuestSession,
} from "../db/userService";

export function useStudyDataSync({
  material,
  freqKey,
  weakAreas,
}) {
  const { user, isGuest, refreshProfile } = useAuth();
  const currentSessionIdRef = useRef(null); // track session ID for linking quiz results

  // ── Called when a focus Pomodoro ends ────────────────────────────────────
  const onSessionComplete = useCallback(async ({
    pomPhase,
    durationSeconds,
    focusRating,
    voiceQuestions,
    coveredTopics,
    aiInsight,
    nextFocusTopic,
  }) => {
    const payload = {
      material,
      freqKey,
      pomPhase,
      durationSeconds,
      focusRating,
      voiceQuestions,
      weakAreas: Object.keys(weakAreas),
      coveredTopics,
      aiInsight,
      nextFocusTopic,
    };

    if (user?.id) {
      try {
        const session = await saveStudySession({ userId: user.id, ...payload });
        currentSessionIdRef.current = session?.id || null;
        refreshProfile();
      } catch (e) {
        console.warn("Session save failed:", e.message);
      }
    } else if (isGuest) {
      saveGuestSession(payload);
    }
  }, [user, isGuest, material, freqKey, weakAreas, refreshProfile]);

  // ── Called when a quiz round is fully answered ────────────────────────────
  const onQuizComplete = useCallback(async ({
    roundNumber,
    difficulty,
    score,
    totalQuestions,
    topicsTested,
    quizData,
    answers,
    answerOffset = 0,
  }) => {
    if (!user?.id) return; // quiz data not persisted for guests

    try {
      await saveQuizResult({
        userId:         user.id,
        sessionId:      currentSessionIdRef.current,
        material,
        roundNumber,
        difficulty,
        score,
        totalQuestions,
        topicsTested,
      });

      // Update per-topic mastery based on individual answers
      if (Array.isArray(quizData)) {
        const correctTopics = [];
        const wrongTopics   = [];
        quizData.forEach((q, i) => {
          const topic = q.topic || material;
          if (answers[i + answerOffset] === q.answer) correctTopics.push(topic);
          else wrongTopics.push(topic);
        });
        if (correctTopics.length) await updateTopicProgress(user.id, correctTopics, true);
        if (wrongTopics.length)   await updateTopicProgress(user.id, wrongTopics,   false);
      }
    } catch (e) {
      console.warn("Quiz save failed:", e.message);
    }
  }, [user, material]);

  return { onSessionComplete, onQuizComplete };
}
