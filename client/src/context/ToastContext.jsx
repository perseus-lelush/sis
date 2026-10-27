import { createContext, useCallback, useContext, useState } from 'react';
import { AlertIcon, CheckCircleIcon, InfoIcon } from '../components/Icons.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const icons = {
    success: <CheckCircleIcon size={18} />,
    error: <AlertIcon size={18} />,
    info: <InfoIcon size={18} />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast-${item.type}`}>
            <span className="toast-icon">{icons[item.type] || icons.info}</span>
            <span>{item.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() =>
                setToasts((current) => current.filter((entry) => entry.id !== item.id))
              }
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
