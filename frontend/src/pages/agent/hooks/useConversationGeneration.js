import { useState, useRef, useCallback } from "react";

export default function useConversationGeneration(activeId) {
  const [generatingIds, setGeneratingIds] = useState(() => new Set());
  const abortControllersRef = useRef(new Map());
  const genTokensRef = useRef(new Map());

  const loading = Boolean(activeId && generatingIds.has(activeId));

  const setGenerating = useCallback((id, on) => {
    if (!id) return;
    setGeneratingIds((prev) => {
      const has = prev.has(id);
      if (on && has) return prev;
      if (!on && !has) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const abortConversation = useCallback(
    (id, { soft = false } = {}) => {
      if (!id) return;
      const controller = abortControllersRef.current.get(id);
      if (controller) {
        try {
          controller.abort();
        } catch {
          // ignore
        }
        abortControllersRef.current.delete(id);
      }
      if (!soft) {
        const token = (genTokensRef.current.get(id) || 0) + 1;
        genTokensRef.current.set(id, token);
      }
      setGenerating(id, false);
    },
    [setGenerating]
  );

  const beginConversationGeneration = useCallback(
    (id) => {
      const prev = abortControllersRef.current.get(id);
      if (prev) {
        try {
          prev.abort();
        } catch {
          // ignore
        }
      }
      const token = (genTokensRef.current.get(id) || 0) + 1;
      genTokensRef.current.set(id, token);
      const controller = new AbortController();
      abortControllersRef.current.set(id, controller);
      setGenerating(id, true);
      return { controller, token };
    },
    [setGenerating]
  );

  const isConversationGeneration = useCallback((id, token) => {
    return genTokensRef.current.get(id) === token;
  }, []);

  const endConversationGeneration = useCallback(
    (id, token, controller) => {
      if (!isConversationGeneration(id, token)) return;
      if (abortControllersRef.current.get(id) === controller) {
        abortControllersRef.current.delete(id);
      }
      setGenerating(id, false);
    },
    [isConversationGeneration, setGenerating]
  );

  const stopGeneration = useCallback(() => {
    if (!activeId || !generatingIds.has(activeId)) return;
    abortConversation(activeId, { soft: true });
  }, [activeId, generatingIds, abortConversation]);

  return {
    generatingIds,
    loading,
    abortConversation,
    beginConversationGeneration,
    isConversationGeneration,
    endConversationGeneration,
    stopGeneration,
  };
}
