
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import Login from './views/Login.tsx';
import Dashboard from './views/Dashboard.tsx';
import Queue from './views/Queue.tsx';
import Clients from './views/Clients.tsx';
import Admin from './views/Admin.tsx';
import Protocols from './views/Protocols.tsx';
import Reports from './views/Reports.tsx';
import MapView from './views/MapView.tsx';
import RoutePlanner from './views/RoutePlanner.tsx';
import Marketing from './views/Marketing.tsx';
import QualityCenter from './views/QualityCenter.tsx';
import { UserRole } from './types.ts';

const App: React.FC = () => {
  const [user, setUser] = React.useState<any>(() => {
    const saved = localStorage.getItem('dreon_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('dreon_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('dreon_user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactElement, allowedRoles: UserRole[] }) => {
    if (!allowedRoles.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/queue" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR_TELEMARKETING]}>
              <Queue user={user} />
            </ProtectedRoute>
          } />
          <Route path="/marketing" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ANALISTA_MARKETING]}>
              <Marketing user={user} />
            </ProtectedRoute>
          } />
          <Route path="/clients" element={<Clients user={user} />} />
          <Route path="/routes" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.VENDEDOR]}>
              <RoutePlanner />
            </ProtectedRoute>
          } />
          <Route path="/map" element={<MapView />} />
          <Route path="/protocols" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR_TELEMARKETING]}>
              <Protocols user={user} />
            </ProtectedRoute>
          } />
          <Route path="/qa" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <QualityCenter />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ANALISTA_MARKETING]}>
              <Reports user={user} />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
