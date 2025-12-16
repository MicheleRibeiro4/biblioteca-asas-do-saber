
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
    
    // Tempo de exibição: 4 segundos (um pouco mais rápido para UI não bloqueante)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000); 
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      
      {/* Container de Notificações - Canto Superior Direito */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        
        {/* Lista de Notificações */}
        {toasts.map((toast) => (
        <div
            key={toast.id}
            className={`pointer-events-auto flex items-start w-full p-4 gap-3 bg-white rounded-xl shadow-lg border-l-4 animate-in slide-in-from-right-10 fade-in duration-300 transform transition-all hover:scale-[1.02] ${
            toast.type === 'success' ? 'border-green-500 shadow-green-100' : 
            toast.type === 'error' ? 'border-red-500 shadow-red-100' : 
            toast.type === 'warning' ? 'border-amber-500 shadow-amber-100' :
            'border-blue-500 shadow-blue-100'
            }`}
            role="alert"
        >
            <div className={`flex-shrink-0 mt-0.5 ${
            toast.type === 'success' ? 'text-green-600' : 
            toast.type === 'error' ? 'text-red-600' : 
            toast.type === 'warning' ? 'text-amber-600' :
            'text-blue-600'
            }`}>
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'warning' && <AlertTriangle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
            </div>
            
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${
                    toast.type === 'success' ? 'text-green-800' : 
                    toast.type === 'error' ? 'text-red-800' : 
                    toast.type === 'warning' ? 'text-amber-800' :
                    'text-blue-800'
                }`}>
                    {toast.type === 'success' ? 'Sucesso' : toast.type === 'error' ? 'Erro' : toast.type === 'warning' ? 'Atenção' : 'Info'}
                </p>
                <p className="text-sm text-gray-600 mt-0.5 leading-tight break-words">{toast.message}</p>
            </div>
            
            <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-900 transition-colors -mt-1 -mr-1 p-1 rounded-full hover:bg-gray-100"
            >
            <X size={16} />
            </button>
        </div>
        ))}
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
