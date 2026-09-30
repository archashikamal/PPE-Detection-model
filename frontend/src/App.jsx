import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LiveMonitor from './pages/LiveMonitor';
import ZoneConfig from './pages/ZoneConfig';
import ViolationsLog from './pages/ViolationsLog';
import Settings from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="monitor" element={<LiveMonitor />} />
        <Route path="zones" element={<ZoneConfig />} />
        <Route path="violations" element={<ViolationsLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
