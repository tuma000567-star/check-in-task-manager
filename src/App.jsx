import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import DeviceDetail from './pages/DeviceDetail.jsx';
import Stats from './pages/Stats.jsx';
import { supabase } from './lib/supabase.js';

export default function App() {
  const location = useLocation();
  const configured = Boolean(supabase);

  return (
    <div className="app">
      {!configured && (
        <div className="env-warning">
          Supabase 環境変数が未設定です。<br />
          <code>.env</code> に <code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_ANON_KEY</code> を設定してください。
        </div>
      )}
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
      </nav>
    </div>
  );
}
