
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Tempo de exibição: 5 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000); 
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Container Centralizado na Tela */}
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none p-4">
        
        {/* Backdrop/Fundo Escuro para focar a atenção (se houver toasts) */}
        {toasts.length > 0 && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto" />
        )}

        {/* Lista de Notificações */}
        <div className="z-10 flex flex-col gap-4 items-center w-full max-w-md pointer-events-none">
            {toasts.map((toast) => (
            <div
                key={toast.id}
                className={`pointer-events-auto flex items-center w-full p-6 space-x-4 bg-white rounded-2xl shadow-2xl border-l-8 animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 transform transition-all ${
                toast.type === 'success' ? 'border-green-500 ring-4 ring-green-500/20' : 
                toast.type === 'error' ? 'border-red-500 ring-4 ring-red-500/20' : 
                toast.type === 'warning' ? 'border-amber-500 ring-4 ring-amber-500/20' :
                'border-blue-500 ring-4 ring-blue-500/20'
                }`}
                role="alert"
            >
                <div className={`flex-shrink-0 p-3 rounded-full ${
                toast.type === 'success' ? 'bg-green-100 text-green-600' : 
                toast.type === 'error' ? 'bg-red-100 text-red-600' : 
                toast.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                'bg-blue-100 text-blue-600'
                }`}>
                {toast.type === 'success' && <CheckCircle className="w-8 h-8" />}
                {toast.type === 'error' && <AlertCircle className="w-8 h-8" />}
                {toast.type === 'warning' && <AlertTriangle className="w-8 h-8" />}
                {toast.type === 'info' && <Info className="w-8 h-8" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-xl font-bold mb-1 ${
                        toast.type === 'success' ? 'text-green-800' : 
                        toast.type === 'error' ? 'text-red-800' : 
                        toast.type === 'warning' ? 'text-amber-800' :
                        'text-blue-800'
                    }`}>
                        {toast.type === 'success' ? 'Sucesso!' : toast.type === 'error' ? 'Atenção!' : toast.type === 'warning' ? 'Aviso' : 'Informação'}
                    </p>
                    <p className="text-base font-medium text-gray-700 leading-snug">{toast.message}</p>
                </div>
                <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-full p-2 hover:bg-gray-200 transition-colors"
                >
                <X className="w-6 h-6" />
                </button>
            </div>
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
