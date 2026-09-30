import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Save, Info } from 'lucide-react';
import { useToast } from '../components/Toast';
import { CLASS_NAMES } from '../config/constants';
import { getSettings, updateSettings } from '../api/client';

const Settings = () => {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState({
    globalThreshold: 0.40,
    frameSampling: 5,
    classThresholds: {}
  });

  const [expandedClasses, setExpandedClasses] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await getSettings();
        const data = res.data;
        setSettings({
          globalThreshold: data.confidence_threshold ?? 0.4,
          frameSampling: data.frame_sample_rate ?? 5,
          classThresholds: data.per_class_thresholds ?? {},
        });
      } catch (err) {
        console.error('Failed to load settings:', err);
        // Fall back to defaults, which are already set
        addToast({ title: 'Warning', message: 'Could not load settings from backend, using defaults', type: 'warning' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Filter out class thresholds that are 0 (meaning "use global")
      const filteredClassThresholds = {};
      for (const [cls, val] of Object.entries(settings.classThresholds)) {
        if (val > 0) filteredClassThresholds[cls] = val;
      }

      await updateSettings({
        confidence_threshold: settings.globalThreshold,
        frame_sample_rate: settings.frameSampling,
        per_class_thresholds: filteredClassThresholds,
      });
      addToast({ title: 'Settings Saved', message: 'System configuration updated', type: 'success' });
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to save settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-surface-border border-t-safety-yellow rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <h2 className="text-xl font-semibold mb-6">System Settings</h2>

      <div className="space-y-6">
        {/* Global Threshold */}
        <div className="bg-surface-raised rounded-xl border border-surface-border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Global Confidence Threshold</h3>
            <span className="bg-surface px-3 py-1 rounded text-sm font-mono border border-surface-border">
              {settings.globalThreshold.toFixed(2)}
            </span>
          </div>

          <input
            type="range"
            min="0.1" max="0.9" step="0.05"
            value={settings.globalThreshold}
            onChange={(e) => setSettings({...settings, globalThreshold: parseFloat(e.target.value)})}
            className="w-full accent-safety-yellow mb-4"
          />

          <div className="bg-surface border-l-4 border-safety-yellow p-4 rounded-r-md flex gap-3 text-sm text-gray-400">
            <Info className="w-5 h-5 text-safety-yellow shrink-0" />
            <p>Lower thresholds catch more violations but may increase false positives. The model has weaker recall on NO-Hardhat and NO-Safety Vest — lowering the threshold for these classes can help catch real violations that would otherwise be missed.</p>
          </div>
        </div>

        {/* Per-Class Thresholds */}
        <div className="bg-surface-raised rounded-xl border border-surface-border overflow-hidden">
          <button
            className="w-full p-6 flex items-center justify-between hover:bg-surface/50 transition-colors"
            onClick={() => setExpandedClasses(!expandedClasses)}
          >
            <div>
              <h3 className="font-medium text-left">Per-Class Thresholds</h3>
              <p className="text-sm text-gray-400 mt-1">Override global threshold for specific classes</p>
            </div>
            {expandedClasses ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          </button>

          {expandedClasses && (
            <div className="p-6 border-t border-surface-border bg-surface/30 space-y-4">
              <p className="text-xs text-gray-500 mb-4">Leave at 0 to use global threshold.</p>

              {CLASS_NAMES.map(cls => (
                <div key={cls} className="flex items-center gap-4">
                  <div className="w-40 text-sm">{cls}</div>
                  <input
                    type="range"
                    min="0" max="0.9" step="0.05"
                    value={settings.classThresholds[cls] || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setSettings({
                        ...settings,
                        classThresholds: { ...settings.classThresholds, [cls]: val }
                      });
                    }}
                    className="flex-1 accent-safety-yellow"
                  />
                  <div className="w-16 text-right">
                    <span className={`text-xs font-mono px-2 py-1 rounded ${(settings.classThresholds[cls] || 0) > 0 ? 'bg-safety-yellow/20 text-safety-yellow' : 'text-gray-500'}`}>
                      {(settings.classThresholds[cls] || 0) > 0 ? (settings.classThresholds[cls] || 0).toFixed(2) : 'Auto'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Frame Sampling */}
        <div className="bg-surface-raised rounded-xl border border-surface-border p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Frame Sampling Rate</h3>
            <span className="bg-surface px-3 py-1 rounded text-sm font-mono border border-surface-border">
              Every {settings.frameSampling}{settings.frameSampling === 1 ? 'st' : settings.frameSampling === 2 ? 'nd' : settings.frameSampling === 3 ? 'rd' : 'th'} frame
            </span>
          </div>

          <input
            type="range"
            min="1" max="30" step="1"
            value={settings.frameSampling}
            onChange={(e) => setSettings({...settings, frameSampling: parseInt(e.target.value)})}
            className="w-full accent-safety-yellow mb-4"
          />

          <p className="text-sm text-gray-400">
            Higher values = faster processing but may miss short-duration violations. Lower values = more thorough but slower.
          </p>
        </div>
      </div>

      {/* Save Action */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 w-full bg-safety-yellow text-black font-semibold py-3 rounded-lg shadow-lg hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
      >
        {saving ? (
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <><Save className="w-5 h-5" /> Save Configuration</>
        )}
      </button>
    </div>
  );
};

export default Settings;
