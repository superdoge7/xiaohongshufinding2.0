import { HashRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { HomePage } from "@/pages/HomePage";
import { SearchPage } from "@/pages/SearchPage";
import { AIAnalysisPage } from "@/pages/AIAnalysisPage";
import { ReportPage } from "@/pages/ReportPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AppProvider } from "@/store/AppContext";
import { CtrlWheelZoom } from "@/components/CtrlWheelZoom";

export default function App() {
  return (
    <AppProvider>
      <CtrlWheelZoom />
      <HashRouter>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/ai" element={<AIAnalysisPage />} />
              <Route path="/reports" element={<ReportPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </AppProvider>
  );
}
