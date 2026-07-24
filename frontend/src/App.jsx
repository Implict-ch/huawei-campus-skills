import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav.jsx";
import Footer from "./components/Footer.jsx";
import HomePage from "./pages/HomePage.jsx";
import ExperiencesPage from "./pages/ExperiencesPage.jsx";
import ExperienceListPage from "./pages/ExperienceListPage.jsx";
import ExperienceDetailPage from "./pages/ExperienceDetailPage.jsx";
import AgentPage from "./pages/AgentPage.jsx";
import HandTearPage from "./pages/HandTearPage.jsx";
import HandTearCategoryPage from "./pages/HandTearCategoryPage.jsx";
import { HW_APP_NAV } from "./data/hw-app.js";

export default function App() {
  return (
    <div className="cf-landing">
      <Nav
        homeHref="/"
        links={HW_APP_NAV}
        showCta={false}
      />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/experiences" element={<ExperiencesPage />} />
          <Route path="/experiences/:role" element={<ExperienceListPage />} />
          <Route path="/experiences/:role/:id" element={<ExperienceDetailPage />} />
          <Route path="/hand-tear" element={<HandTearPage />} />
          <Route path="/hand-tear/:category" element={<HandTearCategoryPage />} />
          <Route path="/agent" element={<AgentPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
