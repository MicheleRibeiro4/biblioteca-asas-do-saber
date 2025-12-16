
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { User, UserType } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string, type: UserType) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for cached user on mount
    const cached = sessionStorage.getItem('currentUser');
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch (e) {
        sessionStorage.removeItem('currentUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, pass: string, type: UserType): Promise<{ success: boolean; message?: string }> => {
    setLoading(true);
    try {
      console.log(`Tentando login como [${type}] para: ${email}`);
      
      const { data, error } = await supabase
        .from(type)
        .select('*')
        .ilike('email', email.trim()) 
        .maybeSingle();

      if (error) {
        console.error('Erro Supabase:', error);
        setLoading(false);
        
        // Tratamento específico para erro de recursão infinita (RLS Policy Loop)
        if (error.code === '42P17') {
             return { success: false, message: 'Erro Crítico (Recursão Infinita): Peça ao administrador para corrigir as Políticas RLS no banco de dados.' };
        }

        return { success: false, message: 'Erro de conexão com o banco de dados.' };
      }

      if (!data) {
        console.warn('Usuário não encontrado na tabela:', type);
        setLoading(false);
        return { success: false, message: `E-mail não encontrado no perfil de ${type}.` };
      }

      // Verificação de senha simples (texto puro conforme legado)
      if (String(data.senha).trim() !== pass.trim()) {
        console.warn('Senha incorreta');
        setLoading(false);
        return { success: false, message: 'Senha incorreta.' };
      }

      const userData: User = {
        id: data.id || data.matricula,
        nome: data.nome,
        email: data.email,
        tipo: type,
        foto_perfil_url: data.foto_perfil_url,
        turma: data.turma,
        matricula: data.matricula,
        masp: data.masp,
        bio: data.bio,
        localizacao: data.localizacao,
        senha: data.senha
      };

      setUser(userData);
      sessionStorage.setItem('currentUser', JSON.stringify(userData));
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('Erro crítico no login:', err);
      setLoading(false);
      return { success: false, message: err.message || 'Erro inesperado ao entrar.' };
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('currentUser');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
