import { useState, useEffect } from "react";
import SectionHeader from "../components/SectionHeader.jsx";
import RoleCard from "../components/RoleCard.jsx";
import FadeIn from "../components/FadeIn.jsx";
import { ROLE_CARDS } from "../data/hw-app.js";

export default function ExperiencesPage() {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    fetch("/api/experiences")
      .then((r) => r.json())
      .then((data) => {
        if (data.grouped) {
          const next = {};
          for (const [role, list] of Object.entries(data.grouped)) {
            next[role] = list.length;
          }
          setCounts(next);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="hw-page hw-page--experiences">
      <section className="section">
        <div className="container">
          <FadeIn>
            <SectionHeader title="面经入口" />
          </FadeIn>
          <div className="role-grid role-grid--page">
            {ROLE_CARDS.map((role, i) => (
              <RoleCard key={role.role} {...role} count={counts[role.role] ?? 0} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
