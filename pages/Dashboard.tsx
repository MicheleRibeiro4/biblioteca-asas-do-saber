
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Book, LayoutDashboard, LogOut, Settings, Users, ClipboardList, MessageSquare, BarChart3, Bell, Edit, ArrowLeft, Menu, X, Mail } from 'lucide-react';
import { Catalog } from './Catalog';
import { StudentHome } from './student/StudentHome';
import { LibrarianDashboard } from './librarian/LibrarianDashboard';
import { TeacherHome } from './teacher/TeacherHome';
import { LoanHistory } from './student/LoanHistory';
import { MyComments } from './student/MyComments';
import { Notifications } from './student/Notifications';
import { ProfileSettings } from '../components/profile/ProfileSettings';
import { Button, Modal } from '../components/ui/Layouts';

type Tab = 'home' | 'catalog' | 'history' | 'profile' | 'student-comments' | 'student-notifications' | 'admin-books' | 'admin-loans' | 'admin-users' | 'admin-reports' | 'admin-comments' | 'admin-emails';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (user) {
        // Verifica se a senha é a padrão "1234". Se for, força a troca imediatamente.
        if (user.senha === '1234') {
            setIsProfileModalOpen(true);
        }
    }
  }, [user]);

  if (!user) return null;

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        if (user.tipo === 'aluno') return <StudentHome onChangeTab={setActiveTab} />;
        if (user.tipo === 'bibliotecario') return <LibrarianDashboard initialTab="overview" />;
        if (user.tipo === 'professor') return <TeacherHome />;
        return <div>Papel de usuário não reconhecido.</div>;
      case 'catalog':
        return <Catalog />;
      case 'history':
        return <LoanHistory />;
      case 'student-comments':
        return <MyComments />;
      case 'student-notifications':
        return <Notifications />;
      // Librarian Routes
      case 'admin-books':
         return <LibrarianDashboard initialTab="books" />;
      case 'admin-loans':
         return <LibrarianDashboard initialTab="loans" />;
      case 'admin-users':
         return <LibrarianDashboard initialTab="users" />;
      case 'admin-comments':
         return <LibrarianDashboard initialTab="comments" />;
      case 'admin-reports':
         return <LibrarianDashboard initialTab="reports" />;
      case 'admin-emails':
         return <LibrarianDashboard initialTab="emails" />;
      default:
        return <StudentHome onChangeTab={setActiveTab} />;
    }
  };

  const getNavItems = () => {
    const common = [
      { id: 'home', label: 'Início', icon: <LayoutDashboard size={20} /> },
      { id: 'catalog', label: 'Catálogo', icon: <Book size={20} /> },
    ];

    if (user.tipo === 'aluno') {
      return [
        ...common,
        { id: 'history', label: 'Meus Empréstimos', icon: <ClipboardList size={20} /> },
        { id: 'student-comments', label: 'Meus Comentários', icon: <MessageSquare size={20} /> },
        { id: 'student-notifications', label: 'Notificações', icon: <Bell size={20} /> },
      ];
    }
    
    if (user.tipo === 'bibliotecario') {
      return [
        { id: 'home', label: 'Visão Geral', icon: <LayoutDashboard size={20} /> },
        { id: 'admin-books', label: 'Livros', icon: <Book size={20} /> },
        { id: 'admin-loans', label: 'Empréstimos', icon: <ClipboardList size={20} /> },
        { id: 'admin-comments', label: 'Comentários', icon: <MessageSquare size={20} /> },
        { id: 'admin-users', label: 'Usuários', icon: <Users size={20} /> },
        { id: 'admin-emails', label: 'Notificações', icon: <Mail size={20} /> },
        { id: 'admin-reports', label: 'Relatórios', icon: <BarChart3 size={20} /> },
      ];
    }

    if (user.tipo === 'professor') {
        return common; // Teachers mainly see dashboard reports
    }

    return common;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row relative">
      
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Mobile: Drawer / Desktop: Static */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col ${
            isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {/* Header da Sidebar */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 font-bold text-indigo-600">
            <img 
              src="https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png" 
              alt="Logo Asas do Saber" 
              className="h-8 w-auto object-contain"
            />
            <span className="text-sm font-bold text-gray-800">Asas do Saber</span>
          </div>
          {/* Close Button Mobile */}
          <button className="md:hidden text-gray-500 hover:text-gray-900" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>

        {/* Content da Sidebar */}
        <div className="p-4 flex-1 overflow-y-auto">
          {/* User Profile Trigger */}
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-3 mb-6 p-3 bg-indigo-50 rounded-xl cursor-pointer hover:bg-indigo-100 transition-colors group relative"
            title="Editar Perfil"
          >
             <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold overflow-hidden border-2 border-indigo-100 group-hover:border-indigo-300 flex-shrink-0">
                {user.foto_perfil_url ? (
                    <img src={user.foto_perfil_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    user.nome.charAt(0)
                )}
             </div>
             <div className="flex-1 min-w-0">
                 <p className="text-sm font-semibold text-gray-900 truncate">{user.nome}</p>
                 <p className="text-xs text-gray-500 capitalize truncate">{user.tipo}</p>
             </div>
             <Edit size={14} className="text-indigo-400 opacity-0 group-hover:opacity-100 absolute right-2 top-2" />
          </div>

          <nav className="space-y-1">
            {getNavItems().map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as Tab); setIsMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Footer da Sidebar */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
             <button 
                onClick={() => setIsLogoutConfirmOpen(true)} 
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
             >
                <LogOut size={20} />
                Sair
             </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        {/* Mobile Header Bar */}
        <header className="md:hidden bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 z-30 flex-shrink-0">
             <div className="flex items-center gap-2">
                 <img src="https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png" alt="Logo" className="h-8 w-auto"/>
                 <span className="font-bold text-gray-800 text-sm">Asas do Saber</span>
             </div>
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                 <Menu size={24} />
             </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative w-full">
            <div className="max-w-6xl mx-auto w-full">
                {/* Global Back Button */}
                {activeTab !== 'home' && (
                <button 
                    onClick={() => setActiveTab('home')}
                    className="mb-6 flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors font-medium group"
                >
                    <div className="p-1.5 rounded-full bg-white border border-gray-200 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors shadow-sm">
                        <ArrowLeft size={16} />
                    </div>
                    Voltar para Início
                </button>
                )}

                {renderContent()}
            </div>
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      <Modal isOpen={isLogoutConfirmOpen} onClose={() => setIsLogoutConfirmOpen(false)} title="Sair do Sistema">
        <div className="space-y-6">
            <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <LogOut className="text-red-600 w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">Tem certeza que deseja sair?</h3>
                <p className="text-gray-500 mt-2">Você precisará fazer login novamente para acessar sua conta.</p>
            </div>
            <div className="flex justify-center gap-4">
                <Button variant="secondary" onClick={() => setIsLogoutConfirmOpen(false)}>Cancelar</Button>
                <Button variant="danger" onClick={logout}>Sim, Sair</Button>
            </div>
        </div>
      </Modal>

      {/* Profile Settings Modal (Handles Mandatory Password Change) */}
      <ProfileSettings 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </div>
  );
};
