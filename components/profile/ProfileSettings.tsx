
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Modal, Input, Button } from '../ui/Layouts';
import { useToast } from '../../context/ToastContext';
import { User, Lock, Image as ImageIcon, Save, LogOut } from 'lucide-react';

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

  if (!user) return null;

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
        if (newPassword.length < 4) { 
          throw new Error("A nova senha deve ter pelo menos 4 caracteres.");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("As senhas não coincidem.");
        }
        updates.senha = newPassword;
      }

      if (Object.keys(updates).length === 0) {
        setLoading(false);
        onClose();
        return;
      }

      // Determine Table and ID based on User Type
      const table = user.tipo; // 'aluno', 'professor', 'bibliotecario'
      
      // Alunos use 'matricula' as PK (usually), others use 'id'
      let query = supabase.from(table).update(updates);
      
      if (user.tipo === 'aluno') {
        query = query.eq('matricula', user.matricula);
      } else {
        query = query.eq('id', user.id);
      }

      const { error } = await query;

      if (error) throw error;

      // Update Local State
      updateUser({
        ...user,
        foto_perfil_url: updates.foto_perfil_url || user.foto_perfil_url
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
      <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Perfil">
        <form onSubmit={handleUpdate} className="space-y-6">
          
          {/* Photo Section */}
          <div className="space-y-4 pb-6 border-b border-gray-100">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <ImageIcon size={18} className="text-indigo-500" />
              Foto de Perfil
            </h4>
            
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-indigo-100 overflow-hidden flex-shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.currentTarget.src = ''} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <User size={32} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Input 
                  label="URL da Imagem" 
                  placeholder="https://exemplo.com/minha-foto.jpg"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Cole o link de uma imagem pública.</p>
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="space-y-4 pb-6 border-b border-gray-100">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Lock size={18} className="text-indigo-500" />
              Alterar Senha
            </h4>
            
            <div className="grid grid-cols-1 gap-4">
              <Input 
                type="password"
                label="Nova Senha"
                placeholder="Mínimo 4 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input 
                type="password"
                label="Confirmar Nova Senha"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={newPassword !== confirmPassword && confirmPassword ? "As senhas não coincidem" : undefined}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 px-2" onClick={() => setIsLogoutConfirm(true)}>
                <LogOut size={18} className="mr-2" /> Sair da Conta
            </Button>
            <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button type="submit" isLoading={loading} disabled={loading}>
                    <Save size={18} className="mr-2" />
                    Salvar
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
                <p className="text-gray-500">Você será desconectado do sistema.</p>
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
