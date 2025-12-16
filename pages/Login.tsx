
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext'; // Import Toast
import { supabase } from '../services/supabase';
import { UserType } from '../types';
import { BookOpen, GraduationCap, BookOpenCheck, HelpCircle, Lock, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button, Input, Modal } from '../components/ui/Layouts';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { addToast } = useToast(); // Hook Toast
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedType, setSelectedType] = useState<UserType>('aluno');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // --- Forgot Password States ---
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); // 1: Verify Identity, 2: Reset Password
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [verifiedUserId, setVerifiedUserId] = useState<string | number | null>(null);
  
  // Forgot Form Data
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverId, setRecoverId] = useState(''); // Matricula
  const [recoverClass, setRecoverClass] = useState(''); // Turma
  
  // New Password Data
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    // Pequeno delay para UX
    await new Promise(resolve => setTimeout(resolve, 500));

    const result = await login(email.trim(), password.trim(), selectedType);
    
    if (!result.success) {
      const msg = result.message || 'Credenciais inválidas. Verifique e tente novamente.';
      setError(msg);
      addToast(msg, 'error'); // Dispara o popup no meio da tela
    }
    setIsSubmitting(false);
  };

  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);

    try {
        let query = supabase.from('aluno').select('*').eq('email', recoverEmail.trim()).maybeSingle();
        
        // Execute query first to get user by email
        const { data: user, error } = await query;

        if (error) throw error;
        if (!user) throw new Error("Aluno não encontrado com este email.");

        // Strict check: Matricula AND Turma
        if (String(user.matricula).trim() !== recoverId.trim()) {
            throw new Error("A matrícula informada não confere.");
        }
        if (String(user.turma).trim().toLowerCase() !== recoverClass.trim().toLowerCase()) {
            throw new Error("A turma informada não confere.");
        }
        setVerifiedUserId(user.matricula);

        // Success - Move to step 2
        setForgotStep(2);
    } catch (err: any) {
        setForgotError(err.message || "Dados incorretos.");
        addToast(err.message || "Dados incorretos", 'error');
    } finally {
        setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setForgotError('');
      
      if (newResetPassword.length < 4) {
          setForgotError("A senha deve ter no mínimo 4 caracteres.");
          return;
      }
      if (newResetPassword !== confirmResetPassword) {
          setForgotError("As senhas não coincidem.");
          return;
      }

      setForgotLoading(true);
      try {
          // Update Logic for Aluno
          const { error } = await supabase
            .from('aluno')
            .update({ senha: newResetPassword })
            .eq('matricula', verifiedUserId);

          if (error) throw error;

          // Success - Close everything
          addToast("Senha alterada com sucesso! Você já pode fazer login.", 'success');
          closeForgotModal();

      } catch (err: any) {
          setForgotError("Erro ao atualizar senha: " + err.message);
          addToast("Erro ao atualizar senha", 'error');
      } finally {
          setForgotLoading(false);
      }
  };

  const closeForgotModal = () => {
      setIsForgotModalOpen(false);
      setForgotStep(1);
      setRecoverEmail('');
      setRecoverId('');
      setRecoverClass('');
      setNewResetPassword('');
      setConfirmResetPassword('');
      setForgotError('');
      setVerifiedUserId(null);
  };

  const types: { id: UserType; label: string; icon: React.ReactNode }[] = [
    { id: 'aluno', label: 'Aluno', icon: <GraduationCap className="w-6 h-6" /> },
    { id: 'bibliotecario', label: 'Bibliotecário', icon: <BookOpen className="w-6 h-6" /> },
    { id: 'professor', label: 'Professor', icon: <BookOpenCheck className="w-6 h-6" /> },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-700 p-4 relative overflow-hidden">
      <div className="absolute inset-0 w-full h-full opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>
      
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md relative z-10 border border-white/20">
        <div className="text-center mb-6 md:mb-8">
           <div className="flex justify-center mb-6">
             <img 
                src="https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png" 
                alt="Logo Biblioteca" 
                className="h-32 md:h-40 w-auto object-contain drop-shadow-md hover:scale-105 transition-transform duration-300"
             />
           </div>
           <h1 className="text-xl md:text-2xl font-bold text-gray-800">Biblioteca Asas do Saber</h1>
           <p className="text-indigo-600 mt-2 font-medium text-sm md:text-base">A leitura dá asas à imaginação!</p>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-600 mb-3 text-center">Selecione seu perfil:</p>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {types.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => { setSelectedType(type.id); setError(''); }}
                className={`flex flex-col items-center justify-center p-2 md:p-3 rounded-xl border transition-all duration-200 ${
                  selectedType === type.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md transform scale-105 ring-2 ring-indigo-200'
                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-white hover:border-gray-300'
                }`}
              >
                <div className={`mb-1 ${selectedType === type.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {type.icon}
                </div>
                <span className="text-[10px] md:text-xs font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2 shadow-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                  <span className="font-bold block">Acesso Negado</span>
                  {error}
              </div>
            </div>
          )}

          <Input 
            label="Email" 
            type="email" 
            placeholder="seu@email.com" 
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            required
            className={`bg-gray-50 ${error ? 'border-red-300 focus:ring-red-200' : ''}`}
          />
          
          <div className="relative">
            <Input 
                label="Senha" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••" 
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                required
                className={`bg-gray-50 pr-10 ${error ? 'border-red-300 focus:ring-red-200' : ''}`}
            />
            <button 
                type="button"
                className="absolute right-3 top-9 text-gray-400 hover:text-indigo-600"
                onClick={() => setShowPassword(!showPassword)}
            >
                {showPassword ? (
                    <Lock size={18} />
                ) : (
                    <div className="relative"><Lock size={18} /><div className="absolute inset-0 border-l border-gray-400 rotate-45 left-1/2"></div></div>
                )}
            </button>
          </div>
          
          {/* Only show "Forgot Password" for Students */}
          <div className="flex justify-end min-h-[24px]">
              {selectedType === 'aluno' && (
                  <button 
                    type="button" 
                    onClick={() => setIsForgotModalOpen(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
              )}
          </div>

          <Button type="submit" className="w-full h-12 text-lg shadow-lg shadow-indigo-200" isLoading={isSubmitting}>
            Entrar
          </Button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-400">© 3R25. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal isOpen={isForgotModalOpen} onClose={closeForgotModal} title="Recuperação de Senha (Aluno)">
          {forgotStep === 1 ? (
              <form onSubmit={handleVerifyIdentity} className="space-y-4">
                  <div className="bg-indigo-50 p-3 rounded-lg flex gap-3 items-start border border-indigo-100">
                      <HelpCircle className="text-indigo-600 flex-shrink-0 mt-0.5" size={20} />
                      <p className="text-sm text-indigo-800">
                          Preencha seus dados de aluno para validar sua identidade e redefinir a senha.
                      </p>
                  </div>

                  <Input 
                    label="Email Cadastrado" 
                    type="email" 
                    value={recoverEmail} 
                    onChange={e => setRecoverEmail(e.target.value)} 
                    placeholder="exemplo@email.com"
                    required
                  />

                  <Input 
                    label="Matrícula" 
                    value={recoverId} 
                    onChange={e => setRecoverId(e.target.value)} 
                    placeholder="Digite sua matrícula"
                    required
                  />

                  <Input 
                    label="Turma Atual" 
                    value={recoverClass} 
                    onChange={e => setRecoverClass(e.target.value)} 
                    placeholder="Ex: 3A"
                    required
                  />

                  {forgotError && (
                      <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200 flex items-center gap-2">
                          <AlertCircle size={16} /> {forgotError}
                      </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                      <Button type="button" variant="secondary" onClick={closeForgotModal}>Cancelar</Button>
                      <Button type="submit" isLoading={forgotLoading}>Verificar Dados</Button>
                  </div>
              </form>
          ) : (
              <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in slide-in-from-right-10">
                  <div className="bg-green-50 p-3 rounded-lg flex gap-3 items-center border border-green-100 mb-4">
                      <CheckCircle className="text-green-600" size={20} />
                      <p className="text-sm text-green-800 font-medium">Dados confirmados! Crie sua nova senha.</p>
                  </div>

                  <Input 
                    label="Nova Senha" 
                    type="password" 
                    value={newResetPassword} 
                    onChange={e => setNewResetPassword(e.target.value)} 
                    placeholder="Mínimo 4 caracteres"
                    required
                  />

                  <Input 
                    label="Confirmar Nova Senha" 
                    type="password" 
                    value={confirmResetPassword} 
                    onChange={e => setConfirmResetPassword(e.target.value)} 
                    placeholder="Repita a nova senha"
                    required
                  />

                   {forgotError && (
                      <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200 flex items-center gap-2">
                          <AlertCircle size={16} /> {forgotError}
                      </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                      <Button type="button" variant="secondary" onClick={closeForgotModal}>Cancelar</Button>
                      <Button type="submit" isLoading={forgotLoading} variant="success">Salvar Nova Senha</Button>
                  </div>
              </form>
          )}
      </Modal>
    </div>
  );
};
