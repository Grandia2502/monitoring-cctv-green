import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { RecordingProvider } from "./contexts/RecordingContext";
import { AppSettingsProvider } from "./contexts/AppSettingsContext";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <AppSettingsProvider>
        <RecordingProvider>
          <App />
        </RecordingProvider>
      </AppSettingsProvider>
    </AuthProvider>
  </ThemeProvider>
);
