import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { applyThemeFromStorage } from "./styles/applyTheme.js";
import App from "./App.jsx";
import "katex/dist/katex.min.css";
import "./styles/typography.css";
import "./styles/cf-landing.css";
import "./styles/problem-page.css";
import "./styles/hw-app.css";

applyThemeFromStorage();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
