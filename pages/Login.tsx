
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserType } from '../types';
import { BookOpen, GraduationCap, BookOpenCheck } from 'lucide-react';
import { Button, Input } from '../components/ui/Layouts';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedType, setSelectedType] = useState<UserType>('aluno');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle Password Visibility
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    // Trim inputs to avoid whitespace errors
    const result = await login(email.trim(), password.trim(), selectedType);
    if (!result.success) {
      setError(result.message || 'Erro ao entrar');
    }
    setIsSubmitting(false);
  };

  const types: { id: UserType; label: string; icon: React.ReactNode }[] = [
    { id: 'aluno', label: 'Aluno', icon: <GraduationCap className="w-6 h-6" /> },
    { id: 'bibliotecario', label: 'Bibliotecário', icon: <BookOpen className="w-6 h-6" /> },
    { id: 'professor', label: 'Professor', icon: <BookOpenCheck className="w-6 h-6" /> },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-700 p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 w-full h-full opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>
      
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10 border border-white/20">
        <div className="text-center mb-8">
           <div className="flex justify-center mb-6">
             {/* LOGO MAIOR (h-40) */}
             <img 
                src="https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png" 
                alt="Logo Biblioteca" 
                className="h-40 w-auto object-contain drop-shadow-md hover:scale-105 transition-transform duration-300"
             />
           </div>
           <h1 className="text-2xl font-bold text-gray-800">Biblioteca Asas do Saber</h1>
           {/* FRASE ALTERADA */}
           <p className="text-indigo-600 mt-2 font-medium">A leitura dá asas à imaginação!</p>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-600 mb-3 text-center">Selecione seu perfil:</p>
          <div className="grid grid-cols-3 gap-3">
            {types.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${
                  selectedType === type.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md transform scale-105 ring-2 ring-indigo-200'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-white hover:border-gray-300'
                }`}
              >
                <div className={`mb-1 ${selectedType === type.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {type.icon}
                </div>
                <span className="text-xs font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Email" 
            type="email" 
            placeholder="seu@email.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-gray-50"
          />
          
          <div className="relative">
            <Input 
                label="Senha" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-gray-50 pr-10"
            />
            <button 
                type="button"
                className="absolute right-3 top-9 text-gray-400 hover:text-indigo-600"
                onClick={() => setShowPassword(!showPassword)}
            >
                {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1 2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
            </button>
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded flex items-center animate-in slide-in-from-top-1">
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full h-12 text-lg shadow-lg shadow-indigo-200" isLoading={isSubmitting}>
            Entrar
          </Button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400">© 3R25. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
};
