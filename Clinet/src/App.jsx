import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PapersPage from './pages/PapersPage';
import PaperDetailPage from './pages/PaperDetailPage';
import ViewerPage from './pages/ViewerPage';
import MyPurchasesPage from './pages/MyPurchasesPage';
import MyAccountPage from './pages/MyAccountPage';
import AdminSubjectsPage from './pages/admin/AdminSubjectsPage';
import AdminSubjectContentPage from './pages/admin/AdminSubjectContentPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminManualPaymentPage from './pages/admin/AdminManualPaymentPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import FaqPage from './pages/FaqPage';
import './App.css';

function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/papers" element={<PapersPage />} />
          <Route path="/papers/:id" element={<PaperDetailPage />} />
          <Route path="/papers/:id/folders/:folderId" element={<PaperDetailPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/faq" element={<FaqPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/viewer/:id" element={<ViewerPage />} />
            <Route path="/my-purchases" element={<MyPurchasesPage />} />
            <Route path="/my-account" element={<MyAccountPage />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
            <Route path="/admin/subjects/:id/content" element={<AdminSubjectContentPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/manual-payment" element={<AdminManualPaymentPage />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
