import React, { useState, useEffect } from 'react';
import { Download, ChevronLeft, ChevronRight, AlertTriangle, Trash2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { VIOLATION_CLASSES, API_BASE } from '../config/constants';
import { getViolations, deleteViolation, exportViolations, getZones } from '../api/client';

const ViolationsLog = () => {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [zones, setZonesList] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    className: '',
    zoneId: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { addToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.className) params.class_name = filters.className;
      if (filters.zoneId) params.zone_id = filters.zoneId;

      const res = await getViolations(params);
      setData(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch violations:', err);
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this violation record? This also removes its thumbnail.')) return;
    setDeletingId(id);
    try {
      await deleteViolation(id);
      addToast({ title: 'Deleted', message: 'Violation removed', type: 'info' });
      // If we just deleted the last row on a page beyond the first, step back a page
      if (data.length === 1 && page > 1) {
        setPage(p => p - 1);
      } else {
        await fetchData();
      }
    } catch (err) {
      addToast({ title: 'Error', message: err.response?.data?.detail || 'Failed to delete violation', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const fetchZones = async () => {
    try {
      const res = await getZones();
      setZonesList(res.data || []);
    } catch (err) {
      console.error('Failed to load zones for filter:', err);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  const totalPages = Math.ceil(total / pageSize);

  const handleApply = () => {
    setPage(1);
    fetchData();
  };

  const handleReset = () => {
    setFilters({ dateFrom: '', dateTo: '', className: '', zoneId: '' });
    setPage(1);
    // Refetch after reset
    setTimeout(() => fetchData(), 0);
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.className) params.class_name = filters.className;
      if (filters.zoneId) params.zone_id = filters.zoneId;

      const res = await exportViolations(params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'violations_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Violations Log</h2>

      {/* Filters Bar */}
      <div className="bg-surface-raised p-4 rounded-lg flex flex-wrap items-end gap-4 border border-surface-border">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Date From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => setFilters({ ...filters, dateFrom: e.target.value })}
            className="bg-surface border border-surface-border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Date To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => setFilters({ ...filters, dateTo: e.target.value })}
            className="bg-surface border border-surface-border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Violation Class</label>
          <select
            value={filters.className}
            onChange={e => setFilters({ ...filters, className: e.target.value })}
            className="bg-surface border border-surface-border rounded px-3 py-1.5 text-sm w-40"
          >
            <option value="">All</option>
            {VIOLATION_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Zone</label>
          <select
            value={filters.zoneId}
            onChange={e => setFilters({ ...filters, zoneId: e.target.value })}
            className="bg-surface border border-surface-border rounded px-3 py-1.5 text-sm w-40"
          >
            <option value="">All</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>

        <button onClick={handleApply} className="bg-safety-yellow text-black px-4 py-1.5 rounded text-sm font-medium hover:bg-yellow-400">
          Apply
        </button>
        <button onClick={handleReset} className="bg-surface text-gray-300 border border-surface-border px-4 py-1.5 rounded text-sm hover:bg-surface-border">
          Reset
        </button>

        <div className="ml-auto">
          <button onClick={handleExport} className="flex items-center gap-2 bg-surface text-gray-300 border border-surface-border px-4 py-1.5 rounded text-sm hover:bg-surface-border">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-raised rounded-lg border border-surface-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-4 border-surface-border border-t-safety-yellow rounded-full animate-spin mx-auto mb-3"></div>
            Loading violations...
          </div>
        ) : data.length === 0 ? (
          <div className="p-12">
            <EmptyState title="No violations recorded" description="Violations will appear here after processing videos." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-gray-400 border-b border-surface-border">
                <tr>
                  <th className="px-6 py-3 font-medium">#</th>
                  <th className="px-6 py-3 font-medium">Thumbnail</th>
                  <th className="px-6 py-3 font-medium">Timestamp</th>
                  <th className="px-6 py-3 font-medium">Class</th>
                  <th className="px-6 py-3 font-medium">Zone</th>
                  <th className="px-6 py-3 font-medium">Confidence</th>
                  <th className="px-6 py-3 font-medium">Frame</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {data.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-surface/50">
                    <td className="px-6 py-3 font-mono text-gray-400">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-6 py-3">
                      <div className="w-12 h-12 bg-surface border border-surface-border rounded overflow-hidden flex items-center justify-center">
                        {row.thumbnail_path ? (
                          <img
                            src={`${API_BASE}/thumbnails/${row.thumbnail_path}`}
                            alt="violation"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-gray-600" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 font-mono text-gray-300">{formatTimestamp(row.timestamp)}</td>
                    <td className="px-6 py-3">
                      <span className="bg-violation-red/20 text-violation-red px-2.5 py-1 rounded-md text-xs font-bold border border-violation-red/30">
                        {row.class_name}
                      </span>
                    </td>
                    <td className="px-6 py-3">{row.zone_name || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={row.confidence > 0.85 ? 'text-violation-red' : 'text-safety-yellow'}>
                        {Math.round((row.confidence || 0) * 100)}%
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-gray-400">{row.frame_number ?? '—'}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={deletingId === row.id}
                        title="Delete this violation"
                        className="text-gray-400 hover:text-violation-red p-1.5 rounded hover:bg-violation-red/10 disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="bg-surface p-4 border-t border-surface-border flex items-center justify-between text-sm">
            <div className="text-gray-400">
              Showing <span className="text-white">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="text-white">{Math.min(page * pageSize, total)}</span> of{' '}
              <span className="text-white">{total}</span> results
            </div>
            <div className="flex items-center gap-3">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(parseInt(e.target.value)); setPage(1); }}
                className="bg-surface border border-surface-border rounded px-2 py-1 text-sm"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded bg-surface border border-surface-border disabled:opacity-50 hover:bg-surface-border"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded bg-surface border border-surface-border disabled:opacity-50 hover:bg-surface-border"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViolationsLog;
