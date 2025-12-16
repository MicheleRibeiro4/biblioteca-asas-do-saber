
import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Modal, Input, Button } from '../ui/Layouts';
import { useToast } from '../../context/ToastContext';
import { User, Lock, Image as ImageIcon, LogOut, Upload, ShieldCheck, AlertTriangle, Check, X } from 'lucide-react';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ isOpen, onClose }) => {
  const { user, updateUser, logout } = useAuth();
  const { addToast } = useToast();
  
  const [photoUrl, setPhotoUrl] = useState(user?.foto_perfil_url || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogoutConfirm, setIsLogoutConfirm] = useState(false);

  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!user) return null;

  // Verifica se é o primeiro acesso (senha padrão)
  const isForcedUpdate = user.senha === '1234';

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) { // 2MB limit
          addToast("A imagem é muito grande. Máximo 2MB.", "error");
          return;
      }

      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onloadend = () => {
          if (typeof reader.result === 'string') {
              setPhotoUrl(reader.result);
              setIsUploading(false);
          }
      };
      reader.onerror = () => {
          addToast("Erro ao processar imagem.", "error");
          setIsUploading(false);
      };
      reader.readAsDataURL(file);
  };

  // Definição de Senha Forte
  const passwordRequirements = [
    { id: 'len', label: "Mínimo 8 caracteres", valid: newPassword.length >= 8 },
    { id: 'upper', label: "Uma letra maiúscula", valid: /[A-Z]/.test(newPassword) },
    { id: 'lower', label: "Uma letra minúscula", valid: /[a-z]/.test(newPassword) },
    { id: 'num', label: "Um número", valid: /[0-9]/.test(newPassword) },
    { id: 'spec', label: "Um caractere especial (!@#$)", valid: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) }
  ];

  const isPasswordStrong = passwordRequirements.every(req => req.valid);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updates: any = {};
      
      // Handle Photo Update
      if (photoUrl !== user.foto_perfil_url) {
        updates.foto_perfil_url = photoUrl;
      }

      // Handle Password Update
      if (newPassword) {
        if (!isPasswordStrong) {
            throw new Error("A senha não atende aos requisitos de segurança.");
        }

        if (newPassword !== confirmPassword) {
          throw new Error("As senhas não coincidem.");
        }
        
        if (newPassword === '1234') {
            throw new Error("Você não pode usar a senha padrão.");
        }

        updates.senha = newPassword;
      } else if (isForcedUpdate) {
          throw new Error("Você deve definir uma nova senha para continuar.");
      }

      if (Object.keys(updates).length === 0) {
        setLoading(false);
        if (!isForcedUpdate) onClose();
        return;
      }

      // Determine Table and ID based on User Type
      const table = user.tipo; 
      
      let query = supabase.from(table).update(updates);
      
      if (user.tipo === 'aluno') {
        query = query.eq('matricula', user.matricula);
      } else {
        query = query.eq('id', user.id);
      }

      const { data, error } = await query.select(); // Add select() to check if row was hit

      if (error) throw error;
      
      // Fallback for Bibliotecario plural table if singular failed to update any row
      if ((!data || data.length === 0) && user.tipo === 'bibliotecario') {
           const { error: pluralError, data: pluralData } = await supabase
                .from('bibliotecarios')
                .update(updates)
                .eq('id', user.id)
                .select();
           
           if (pluralError) throw pluralError;
           if (!pluralData || pluralData.length === 0) {
               // Still failed
               throw new Error("Não foi possível atualizar o perfil. Tabela não encontrada ou permissão negada.");
           }
      } else if (!data || data.length === 0) {
           // Failed for other types (Student/Teacher) - likely RLS or ID mismatch
            throw new Error("Não foi possível atualizar o perfil. Nenhuma alteração realizada (Verifique permissões).");
      }

      // Update Local State
      updateUser({
        ...user,
        foto_perfil_url: updates.foto_perfil_url || user.foto_perfil_url,
        senha: updates.senha || user.senha
      });

      addToast('Perfil atualizado com sucesso!', 'success');
      setNewPassword('');
      setConfirmPassword('');
      onClose();

    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Erro ao atualizar perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={isForcedUpdate ? "Segurança: Atualização Obrigatória" : "Configurações do Perfil"}
        hideClose={isForcedUpdate}
      >
        <form onSubmit={handleUpdate} className="space-y-6">
          
          {isForcedUpdate && (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-r">
                  <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="text-amber-600" size={24} />
                      <h4 className="font-bold text-amber-800">Sua senha expirou</h4>
                  </div>
                  <p className="text-sm text-amber-700 leading-relaxed">
                      Para garantir a segurança da sua conta, você precisa substituir a senha temporária (1234) por uma <strong>senha forte pessoal</strong>.
                  </p>
              </div>
          )}

          {/* Photo Section */}
          <div className="space-y-4 pb-6 border-b border-gray-100">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <ImageIcon size={18} className="text-indigo-500" />
              Foto de Perfil
            </h4>
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-indigo-100 overflow-hidden flex-shrink-0 relative">
                {isUploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                        <div className="animate-spin h-5 w-5 border-2 border-indigo-600 rounded-full border-t-transparent"></div>
                    </div>
                ) : photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.currentTarget.src = ''} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <User size={32} />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept="image/*" 
                        className="hidden" 
                    />
                    <Button 
                        type="button" 
                        size="sm" 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        isLoading={isUploading}
                    >
                        <Upload size={14} className="mr-2" />
                        Carregar Foto
                    </Button>
                    {photoUrl && (
                        <Button 
                            type="button" 
                            size="sm" 
                            variant="ghost" 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => { setPhotoUrl(''); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                        >
                            Remover
                        </Button>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="space-y-4 pb-6 border-b border-gray-100">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Lock size={18} className="text-indigo-500" />
              {isForcedUpdate ? "Definir Senha Forte" : "Alterar Senha"}
            </h4>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                  <Input 
                    type="password"
                    label="Nova Senha"
                    placeholder="Digite sua nova senha"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required={isForcedUpdate}
                    className={newPassword && !isPasswordStrong ? "border-red-300 focus:ring-red-200" : ""}
                  />
                  
                  {/* Password Requirements Checklist */}
                  {(newPassword || isForcedUpdate) && (
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Requisitos da Senha:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                              {passwordRequirements.map(req => (
                                  <div key={req.id} className={`flex items-center gap-2 text-xs transition-colors duration-200 ${req.valid ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                                      {req.valid ? <Check size={12} strokeWidth={3} /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
                                      {req.label}
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>
              
              <Input 
                type="password"
                label="Confirmar Nova Senha"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={newPassword !== confirmPassword && confirmPassword ? "As senhas não coincidem" : undefined}
                required={isForcedUpdate}
                disabled={!isPasswordStrong}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 px-2" onClick={() => setIsLogoutConfirm(true)}>
                <LogOut size={18} className="mr-2" /> Sair da Conta
            </Button>
            <div className="flex gap-3">
                {!isForcedUpdate && (
                    <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                )}
                <Button 
                    type="submit" 
                    isLoading={loading} 
                    disabled={loading || (isForcedUpdate && (!isPasswordStrong || newPassword !== confirmPassword))}
                    variant={isForcedUpdate ? "primary" : "primary"}
                    className={isForcedUpdate && !isPasswordStrong ? "opacity-50 cursor-not-allowed" : ""}
                >
                    <ShieldCheck size={18} className="mr-2" />
                    {isForcedUpdate ? 'Salvar e Continuar' : 'Salvar'}
                </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Logout Confirmation inside Profile Settings */}
      <Modal isOpen={isLogoutConfirm} onClose={() => setIsLogoutConfirm(false)} title="Sair da Conta">
        <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                <LogOut size={32} />
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-800">Tem certeza?</h3>
                <p className="text-gray-500">Você será desconectado e terá que fazer login novamente.</p>
            </div>
            <div className="flex justify-center gap-4 pt-2">
                <Button variant="secondary" onClick={() => setIsLogoutConfirm(false)}>Cancelar</Button>
                <Button variant="danger" onClick={handleLogout}>Sim, Sair</Button>
            </div>
        </div>
      </Modal>
    </>
  );
};
