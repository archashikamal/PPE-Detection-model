import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { getComplianceSummary } from '../api/client';
import { API_BASE } from '../config/constants';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const res = await getComplianceSummary();
      const d = res.data;
      setData({
        complianceRate: Math.round(d.overall_compliance_rate || 0),
        workersDetected: d.total_workers_detected || 0,
        violationsToday: d.total_violations || 0,
        mostViolatedZone: d.most_violated_zone || null,
        trendData: (d.compliance_trend || []).map(t => ({
          time: t.period || t.hour || '',
          violations: t.rate || t.violations || 0,
        })),
        violationClasses: (d.compliance_by_class || []).map(c => ({
          name: c.class_name,
          count: c.count,
        })),
        recentViolations: (d.recent_violations || []).map((v, idx) => ({
          id: v.id || idx,
          type: v.class_name,
          zone: v.zone_name || '—',
          // Always show the date too — this feed isn't limited to "today", so a
          // time-only label could misleadingly look like it just happened.
          time: v.timestamp ? new Date(v.timestamp).toLocaleString() : '',
          conf: v.confidence ? Math.round(v.confidence * 100) : 0,
          thumbnail_path: v.thumbnail_path,
        })),
      });
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      // On first load failure, show empty state; on refresh failure, keep stale data
      if (!data) setError('Could not connect to backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-surface-border border-t-safety-yellow rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        title="No compliance data yet"
        description="Upload a video in Live Monitor to start detecting. Make sure the backend is running on port 8000."
      />
    );
  }

  if (!data || (data.workersDetected === 0 && data.violationsToday === 0)) {
    return (
      <EmptyState
        title="No compliance data yet"
        description="Upload a video in Live Monitor to start detecting."
      />
    );
  }

  const getComplianceColor = (rate) => {
    if (rate >= 90) return 'text-compliant-green';
    if (rate >= 70) return 'text-safety-yellow';
    return 'text-violation-red';
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-6">Dashboard</h2>

      {/* Top row - Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Compliance Rate"
          value={`${data.complianceRate}%`}
          colorClass={getComplianceColor(data.complianceRate)}
          icon={ShieldCheck}
        />
        <StatCard
          title="Person Detections Today"
          value={data.workersDetected}
          icon={Users}
        />
        <StatCard
          title="Violations Today"
          value={data.violationsToday}
          colorClass="text-violation-red"
          icon={AlertTriangle}
        />
        <StatCard
          title="Most Violated Zone"
          value={data.mostViolatedZone || '—'}
          icon={MapPin}
        />
      </div>

      {/* Middle row - Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface-raised rounded-lg p-6 border border-surface-border">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Violations by Hour (Today)</h3>
          <div className="h-64">
            {data.trendData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">No trend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3A3A4C" vertical={false} />
                  <XAxis dataKey="time" stroke="#6B7280" tick={{fill: '#6B7280'}} />
                  <YAxis stroke="#6B7280" tick={{fill: '#6B7280'}} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E1E2E', borderColor: '#3A3A4C', color: '#fff' }}
                    itemStyle={{ color: '#F59E0B' }}
                  />
                  <Line type="monotone" dataKey="violations" stroke="#F59E0B" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-surface-raised rounded-lg p-6 border border-surface-border">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Violations by Class</h3>
          <div className="h-64">
            {data.violationClasses.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">No violation data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.violationClasses} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3A3A4C" horizontal={false} />
                  <XAxis type="number" stroke="#6B7280" tick={{fill: '#6B7280'}} />
                  <YAxis dataKey="name" type="category" stroke="#6B7280" tick={{fill: '#6B7280'}} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E1E2E', borderColor: '#3A3A4C', color: '#fff' }}
                  />
                  <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row - Recent Violations Feed */}
      <div className="bg-surface-raised rounded-lg p-6 border border-surface-border">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Recent Violations</h3>
        {data.recentViolations.length === 0 ? (
          <p className="text-gray-500 text-sm">No violations recorded yet.</p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
            {data.recentViolations.map((v) => (
              <div key={v.id} className="flex items-center gap-4 bg-surface p-3 rounded-md border border-surface-border">
                <div className="w-10 h-10 bg-surface-raised rounded overflow-hidden shrink-0 flex items-center justify-center">
                  {v.thumbnail_path ? (
                    <img
                      src={`${API_BASE}/thumbnails/${v.thumbnail_path}`}
                      alt="violation"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-violation-red/20 text-violation-red px-2 py-0.5 rounded text-xs font-bold border border-violation-red/30">
                      {v.type}
                    </span>
                    <span className="text-sm font-mono text-gray-400">{v.time}</span>
                  </div>
                  <div className="text-sm mt-1">
                    Zone: <span className="text-gray-300 font-medium">{v.zone}</span> • Conf: {v.conf}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
