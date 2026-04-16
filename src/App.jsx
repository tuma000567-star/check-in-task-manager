import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import DeviceDetail from './pages/DeviceDetail.jsx';
import Stats from './pages/Stats.jsx';
import Login from './pages/Login.jsx';
import { supabase } from './lib/supabase.js';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';

function AppShell() {
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const configured = Boolean(supabase);

  if (!configured) {
    return (
      <div className="app">
        <div className="env-warning">
          Supabase 環境変数が未設定です。<br />
          <code>.env</code> に <code>VITE_SUPABASE_URL</code> と{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> を設定してください。
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="app">
        <div className="loading" style={{ marginTop: '40vh' }}>認証確認中...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="app">
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/device/:id" element={<DeviceDetail />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          <span className="nav-ico">🏠</span>
          <span>ホーム</span>
        </Link>
        <Link to="/stats" className={location.pathname === '/stats' ? 'active' : ''}>
          <span className="nav-ico">📊</span>
          <span>統計</span>
        </Link>
        <button
          type="button"
          className="nav-logout"
          onClick={async () => {
            try { await signOut(); } catch (e) { alert(e.message); }
          }}
        >
          <span className="nav-ico">🚪</span>
          <span>ログアウト</span>
        </button>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
