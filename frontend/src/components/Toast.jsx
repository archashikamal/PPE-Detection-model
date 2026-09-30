import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, message, type = 'info', duration = 5000 }) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    
    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-compliant-green" />,
    error: <AlertCircle className="w-5 h-5 text-violation-red" />,
    warning: <AlertTriangle className="w-5 h-5 text-safety-yellow" />,
    info: <Info className="w-5 h-5 text-neutral-blue" />
  };

  const bgs = {
    success: 'bg-surface-raised border-compliant-green/20',
    error: 'bg-violation-red border-violation-red text-white',
    warning: 'bg-surface-raised border-safety-yellow/20',
    info: 'bg-surface-raised border-neutral-blue/20'
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border ${bgs[toast.type]} min-w-[300px] max-w-sm animate-slide-in`}>
      {toast.type !== 'error' && <div className="shrink-0">{icons[toast.type]}</div>}
      {toast.type === 'error' && <div className="shrink-0"><AlertTriangle className="w-5 h-5 text-white" /></div>}
      <div className="flex-1">
        <h4 className="font-semibold text-sm">{toast.title}</h4>
        {toast.message && <p className="text-sm opacity-90 mt-1">{toast.message}</p>}
      </div>
      <button onClick={onRemove} className="shrink-0 opacity-70 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const useToast = () => useContext(ToastContext);
