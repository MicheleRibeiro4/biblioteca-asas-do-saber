
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
      // ESTRATÉGIA 1: SUPABASE AUTH (Prioritária - RLS Friendly)
      // -----------------------------------------------------------------------
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPass
      });

      if (!authError && authData.user) {
        console.log('[Auth] Autenticação Supabase OK. Buscando perfil...');
        
        const { data: profileData } = await supabase
          .from(type)
          .select('*')
          .or(`email.ilike.${cleanEmail},user_id.eq.${authData.user.id}`)
          .limit(1)
          .maybeSingle();

        if (profileData) {
          finalUser = profileData;
        } else {
            // Fallback plural
            if (type === 'bibliotecario') {
                const { data: pluralData } = await supabase
                    .from('bibliotecarios')
                    .select('*')
                    .or(`email.ilike.${cleanEmail},user_id.eq.${authData.user.id}`)
                    .limit(1)
                    .maybeSingle();
                if (pluralData) finalUser = pluralData;
            }
        }
      }

      // -----------------------------------------------------------------------
      // ESTRATÉGIA 2: LEGADO / TEXTO PURO (Fallback)
      // -----------------------------------------------------------------------
      if (!finalUser) {
        console.log('[Auth] Auth falhou ou perfil não encontrado. Tentando método Legado (Tabela Direta)...');
        
        let { data: tableData, error: tableError } = await supabase
          .from(type)
          .select('*')
          .ilike('email', cleanEmail)
          .limit(1)
          .maybeSingle();

        // Fallback plural para legado
        if (!tableData && type === 'bibliotecario') {
             const { data: pluralData } = await supabase
                .from('bibliotecarios')
                .select('*')
                .ilike('email', cleanEmail)
                .limit(1)
                .maybeSingle();
             if (pluralData) tableData = pluralData;
        }

        if (tableData) {
            const dbPass = tableData.senha ? String(tableData.senha).trim() : '';
            if (dbPass === cleanPass) {
                finalUser = tableData;
            } else {
                setLoading(false);
                return { success: false, message: 'Senha incorreta.' };
            }
        } else {
            // DIAGNÓSTICO DE RLS
            // Se tableError for null, mas tableData também for null, é 99% chance de ser RLS bloqueando.
            if (!tableError) {
                console.warn(`[Auth] ALERTA: A busca na tabela '${type}' retornou vazio sem erro explícito. Isso geralmente indica que o RLS (Row Level Security) está bloqueando a leitura pública. Execute o script db_fix_rls.sql no Supabase.`);
            }

            console.warn('[Auth] Falha total: Email não encontrado em nenhuma estratégia.');
            setLoading(false);
            return { 
                success: false, 
                message: `E-mail não encontrado no perfil de ${type === 'bibliotecario' ? 'Bibliotecário' : 'Aluno/Professor'}. Se você é o administrador, verifique as políticas RLS (Execute db_fix_rls.sql).` 
            };
        }
      }

      // -----------------------------------------------------------------------
      // SUCESSO
      // -----------------------------------------------------------------------
      if (finalUser) {
          const userData: User = {
            id: finalUser.id || finalUser.matricula || finalUser.masp,
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
      return { success: false, message: 'Erro desconhecido ao processar login.' };

    } catch (err: any) {
      console.error('[Auth] Erro crítico:', err);
      setLoading(false);
      return { success: false, message: 'Erro de conexão ou configuração do sistema.' };
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
