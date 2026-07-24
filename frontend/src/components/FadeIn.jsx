import { useRef, useState, useEffect } from "react";

export { FADE_STAGGER, FADE_STAGGER_SM, FADE_HERO_STEP } from "../constants/motion.js";

export default function FadeIn({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(entry.target);
        }
      },
      { threshold: 0.04, rootMargin: "0px 0px -32px 0px" },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fade-in ${visible ? "fade-in--visible" : ""} ${className}`.trim()}
      style={{ "--fade-delay": `${delay}ms` }}
    >
      {children}
    </div>
  );
}
