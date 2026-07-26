import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import { NEAR_BOTTOM_PX, MESSAGE_PAGE_SIZE } from "../constants.js";

export default function useChatScroll({ activeId, messages, loading, error }) {
  const chatEndRef = useRef(null);
  const chatRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const userDetachedRef = useRef(false);
  const skipScrollRef = useRef(true);
  const jumpToBottomRef = useRef(true);
  const settlingRef = useRef(true);
  const alignNewUserToTopRef = useRef(false);
  const pendingAlignIndexRef = useRef(-1);
  const topSentinelRef = useRef(null);
  const loadingOlderRef = useRef(false);

  const [chatSettling, setChatSettling] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [scrollBtnMounted, setScrollBtnMounted] = useState(false);
  const [scrollBtnLeaving, setScrollBtnLeaving] = useState(false);
  const [visibleMsgCount, setVisibleMsgCount] = useState(MESSAGE_PAGE_SIZE);

  useEffect(() => {
    setVisibleMsgCount(MESSAGE_PAGE_SIZE);
  }, [activeId]);

  const isContentEndVisible = useCallback(() => {
    const el = chatRef.current;
    const end = chatEndRef.current;
    if (!el) return true;
    if (end) {
      const er = end.getBoundingClientRect();
      const cr = el.getBoundingClientRect();
      return er.top <= cr.bottom - 4;
    }
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    return dist < NEAR_BOTTOM_PX;
  }, []);

  const updateNearBottom = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    const near = isContentEndVisible();
    if (near) {
      userDetachedRef.current = false;
      stickToBottomRef.current = true;
    } else {
      stickToBottomRef.current = false;
    }
    setShowScrollBottom(!near && el.scrollHeight > el.clientHeight + 40);
  }, [isContentEndVisible]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return undefined;
    updateNearBottom();
    const onScroll = () => updateNearBottom();
    const onWheel = (e) => {
      if (e.deltaY >= 0) return;
      userDetachedRef.current = true;
      stickToBottomRef.current = false;
    };
    const onTouchMove = () => {
      if (isContentEndVisible()) return;
      userDetachedRef.current = true;
      stickToBottomRef.current = false;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [updateNearBottom, isContentEndVisible]);

  const snapChatToBottom = useCallback(() => {
    if (userDetachedRef.current) return;
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  }, []);

  const smoothScrollToBottom = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    userDetachedRef.current = false;
    stickToBottomRef.current = true;
    setShowScrollBottom(false);
    setScrollBtnLeaving(true);
    setScrollBtnMounted(true);
    const top = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTo({ top, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (showScrollBottom) {
      setScrollBtnLeaving(false);
      setScrollBtnMounted(true);
      return;
    }
    if (scrollBtnMounted && !scrollBtnLeaving) {
      setScrollBtnLeaving(true);
    }
  }, [showScrollBottom, scrollBtnMounted, scrollBtnLeaving]);

  const followStreamHeight = useCallback(() => {
    if (userDetachedRef.current || !stickToBottomRef.current || settlingRef.current) return;
    snapChatToBottom();
  }, [snapChatToBottom]);

  const beginChatSettle = useCallback(() => {
    settlingRef.current = true;
    jumpToBottomRef.current = true;
    stickToBottomRef.current = true;
    setChatSettling(true);
  }, []);

  useLayoutEffect(() => {
    if (!settlingRef.current && !jumpToBottomRef.current) return undefined;
    const el = chatRef.current;
    if (!el) return undefined;

    stickToBottomRef.current = true;
    snapChatToBottom();

    let idleTimer = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      snapChatToBottom();
      settlingRef.current = false;
      jumpToBottomRef.current = false;
      skipScrollRef.current = false;
      setChatSettling(false);
      updateNearBottom();
    };

    const onResize = () => {
      snapChatToBottom();
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(finish, 48);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    onResize();

    const hardCap = window.setTimeout(finish, 280);
    return () => {
      finished = true;
      window.clearTimeout(idleTimer);
      window.clearTimeout(hardCap);
      ro.disconnect();
    };
  }, [activeId, messages, updateNearBottom, snapChatToBottom]);

  useEffect(() => {
    if (skipScrollRef.current || jumpToBottomRef.current || settlingRef.current) {
      if ((settlingRef.current || jumpToBottomRef.current) && !userDetachedRef.current) {
        snapChatToBottom();
      }
      return;
    }

    if (alignNewUserToTopRef.current && pendingAlignIndexRef.current >= 0) {
      const idx = pendingAlignIndexRef.current;
      alignNewUserToTopRef.current = false;
      pendingAlignIndexRef.current = -1;
      requestAnimationFrame(() => {
        const el = chatRef.current?.querySelector(`[data-msg-index="${idx}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        updateNearBottom();
      });
      return;
    }

    if (userDetachedRef.current || !stickToBottomRef.current) {
      updateNearBottom();
      return;
    }
    snapChatToBottom();
  }, [messages, loading, error, updateNearBottom, snapChatToBottom]);

  const msgStartIndex = Math.max(0, messages.length - visibleMsgCount);
  const visibleMessages = messages.slice(msgStartIndex);
  const hasOlderMessages = msgStartIndex > 0;

  const loadOlderMessages = useCallback(() => {
    if (loadingOlderRef.current || !hasOlderMessages) return;
    const el = chatRef.current;
    if (!el) {
      setVisibleMsgCount((n) => Math.min(messages.length, n + MESSAGE_PAGE_SIZE));
      return;
    }
    loadingOlderRef.current = true;
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    setVisibleMsgCount((n) => Math.min(messages.length, n + MESSAGE_PAGE_SIZE));
    requestAnimationFrame(() => {
      const next = chatRef.current;
      if (next) next.scrollTop = prevTop + (next.scrollHeight - prevHeight);
      loadingOlderRef.current = false;
      updateNearBottom();
    });
  }, [hasOlderMessages, messages.length, updateNearBottom]);

  useEffect(() => {
    const root = chatRef.current;
    const sentinel = topSentinelRef.current;
    if (!root || !sentinel || !hasOlderMessages) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadOlderMessages();
      },
      { root, rootMargin: "120px 0px 0px 0px", threshold: 0 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasOlderMessages, loadOlderMessages, activeId, visibleMsgCount]);

  const prepareScrollForNewMessage = useCallback((nextMessages) => {
    const userIdx = nextMessages.length - 1;
    if (userDetachedRef.current || !stickToBottomRef.current) {
      alignNewUserToTopRef.current = true;
      pendingAlignIndexRef.current = userIdx;
      userDetachedRef.current = false;
    } else {
      alignNewUserToTopRef.current = false;
      pendingAlignIndexRef.current = -1;
      stickToBottomRef.current = true;
      userDetachedRef.current = false;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    smoothScrollToBottom();
  }, [smoothScrollToBottom]);

  const resetVisibleMsgCount = useCallback(() => {
    setVisibleMsgCount(MESSAGE_PAGE_SIZE);
  }, []);

  return {
    chatRef,
    chatEndRef,
    topSentinelRef,
    userDetachedRef,
    chatSettling,
    showScrollBottom,
    scrollBtnMounted,
    scrollBtnLeaving,
    setScrollBtnMounted,
    setScrollBtnLeaving,
    visibleMessages,
    hasOlderMessages,
    msgStartIndex,
    followStreamHeight,
    beginChatSettle,
    prepareScrollForNewMessage,
    loadOlderMessages,
    scrollToBottom,
    resetVisibleMsgCount,
  };
}
