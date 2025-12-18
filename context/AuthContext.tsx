
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
    const cleanEmail = email.trim();
    const cleanPass = pass.trim();
    let finalUser: any = null;

    try {
      console.log(`[Auth] Iniciando login para: ${cleanEmail} como ${type}`);

      // -----------------------------------------------------------------------
      // ESTRATÉGIA 1: SUPABASE AUTH (RLS Friendly)
      // -----------------------------------------------------------------------
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass
      }).catch(() => ({ data: { user: null }, error: null })); // Prevents 400 crash

      if (!authError && authData?.user) {
        const { data: profileData } = await supabase
          .from(type)
          .select('*')
          .or(`email.ilike.${cleanEmail},user_id.eq.${authData.user.id}`)
          .limit(1)
          .maybeSingle();

        if (profileData) {
          finalUser = profileData;
          console.log('[Auth] Logado via Supabase Auth.');
        }
      }

      // -----------------------------------------------------------------------
      // ESTRATÉGIA 2: LEGADO / TEXTO PURO (Fallback)
      // -----------------------------------------------------------------------
      if (!finalUser) {
        let { data: tableData } = await supabase
          .from(type)
          .select('*')
          .ilike('email', cleanEmail)
          .limit(1)
          .maybeSingle();

        if (tableData) {
            const dbPass = tableData.senha ? String(tableData.senha).trim() : '';
            if (dbPass === cleanPass) {
                finalUser = tableData;
                console.log('[Auth] Logado via Tabela Direta (Legado). Atenção: RLS pode bloquear edições.');
            } else {
                setLoading(false);
                return { success: false, message: 'Senha incorreta.' };
            }
        }
      }

      if (finalUser) {
          // Normaliza o ID para que ProfileSettings saiba qual coluna usar
          const userId = type === 'aluno' ? finalUser.matricula : (finalUser.id || finalUser.masp);
          
          const userData: User = {
            id: userId,
            nome: finalUser.nome,
            email: finalUser.email,
            tipo: type,
            foto_perfil_url: finalUser.foto_perfil_url,
            turma: finalUser.turma,
            matricula: finalUser.matricula,
            masp: finalUser.masp,
            bio: finalUser.bio,
            localizacao: finalUser.localizacao,
            senha: finalUser.senha
          };

          setUser(userData);
          sessionStorage.setItem('currentUser', JSON.stringify(userData));
          setLoading(false);
          return { success: true };
      }

      setLoading(false);
      return { success: false, message: 'Usuário não encontrado ou credenciais inválidas.' };

    } catch (err: any) {
      console.error('[Auth] Erro crítico:', err);
      setLoading(false);
      return { success: false, message: 'Erro de conexão com o servidor.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
