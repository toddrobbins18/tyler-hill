import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SeasonProvider } from "./contexts/SeasonContext";

createRoot(document.getElementById("root")!).render(
  <SeasonProvider>
    <App />
  </SeasonProvider>
);
