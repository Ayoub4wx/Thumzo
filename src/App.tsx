import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import PricingPage from "./pages/PricingPage";
import PrivacyPage from "./pages/PrivacyPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

import DashboardLayout from "./layouts/DashboardLayout";
import StudioDashboard from "./pages/dashboard/StudioDashboard";
import StudioEditor from "./pages/dashboard/StudioEditor";
import TemplatesDashboard from "./pages/dashboard/TemplatesDashboard";
import BulkEditsDashboard from "./pages/dashboard/BulkEditsDashboard";
import AssetsDashboard from "./pages/dashboard/AssetsDashboard";
import SettingsDashboard from "./pages/dashboard/SettingsDashboard";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
            <Routes>
              {/* Public Routes with Navbar */}
              <Route path="/" element={<><Navbar /><main><LandingPage /></main></>} />
              <Route path="/pricing" element={<><Navbar /><main><PricingPage /></main></>} />
              <Route path="/privacy" element={<><Navbar /><main><PrivacyPage /></main></>} />
              <Route path="/docs" element={<><Navbar /><main><ApiDocsPage /></main></>} />

              {/* Dashboard Routes */}
              <Route path="/studio" element={<DashboardLayout><StudioDashboard /></DashboardLayout>} />
              <Route path="/studio/editor" element={<DashboardLayout><StudioEditor /></DashboardLayout>} />
              <Route path="/templates" element={<DashboardLayout><TemplatesDashboard /></DashboardLayout>} />
              <Route path="/bulk-edits" element={<DashboardLayout><BulkEditsDashboard /></DashboardLayout>} />
              <Route path="/assets" element={<DashboardLayout><AssetsDashboard /></DashboardLayout>} />
              <Route path="/settings/*" element={<DashboardLayout><SettingsDashboard /></DashboardLayout>} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
