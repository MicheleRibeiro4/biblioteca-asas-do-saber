
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Card, Button, Badge, StatCard, Modal } from '../../components/ui/Layouts';
import { BookOpen, Clock, MessageSquare, ArrowRight, Calendar, AlertCircle, Search, AlertTriangle, Star } from 'lucide-react';
import { Loan } from '../../types';

export const StudentHome: React.FC<{ onChangeTab: (tab: any) => void }> = ({ onChangeTab }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ loans: 0, active: 0, comments: 0 });
  const [recentLoans, setRecentLoans] = useState<Loan[]>([]);
  const [nextDue, setNextDue] = useState<string | null>(null);
  
  // Overdue & Review Logic
  const [overdueBooks, setOverdueBooks] = useState<Loan[]>([]);
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  useEffect(() => {
    if (user) {
      const fetchStats = async () => {
        try {
            // Stats
            const { count: total } = await supabase.from('emprestimo').select('*', { count: 'exact' }).eq('matricula_aluno', user.matricula);
            const { count: active } = await supabase.from('emprestimo').select('*', { count: 'exact' }).eq('matricula_aluno', user.matricula).eq('status', 'aprovado').is('data_devolucao_real', null);
            
            // Safe comment fetch
            let commentsCount = 0;
            let commentedBookIds: number[] = [];
            try {
                const { data: comments, count } = await supabase.from('comentarios').select('id_livro', { count: 'exact' }).eq('matricula_aluno', user.matricula);
                commentsCount = count || 0;
                if(comments) commentedBookIds = comments.map(c => c.id_livro);
            } catch (e) {
                console.warn("Could not fetch comments count, likely schema issue");
            }
            
            setStats({ loans: total || 0, active: active || 0, comments: commentsCount });

            // Recent Loans
            const { data: recent } = await supabase
            .from('emprestimo')
            .select('*, livros(titulo, capa_url)')
            .eq('matricula_aluno', user.matricula)
            .order('data_emprestimo', { ascending: false })
            .limit(3);
            
            if (recent) {
                setRecentLoans(recent);
                
                // Active loans check
                const activeLoans = recent.filter(l => l.status === 'aprovado' && !l.data_devolucao_real);
                
                // Find next due date
                if (activeLoans.length > 0) {
                    activeLoans.sort((a,b) => new Date(a.devolutiva).getTime() - new Date(b.devolutiva).getTime());
                    setNextDue(activeLoans[0].devolutiva);
                }

                // Check for Overdue Books (Active Loans past Due Date) & Pending Reviews
                const now = new Date();
                
                // Fetch ALL relevant loans
                const { data: allHistory } = await supabase
                    .from('emprestimo')
                    .select('id, id_livro, matricula_aluno, data_emprestimo, status, devolutiva, data_devolucao_real, livros(titulo)')
                    .eq('matricula_aluno', user.matricula);

                if (allHistory) {
                    // Overdue Logic
                    const activeList = allHistory.filter(l => l.status === 'aprovado' && !l.data_devolucao_real);
                    const overdueList = activeList.filter(l => new Date(l.devolutiva) < now);
                    
                    if (overdueList.length > 0) {
                        setOverdueBooks(overdueList as unknown as Loan[]);
                        setIsOverdueModalOpen(true);
                    }

                    // Pending Reviews Logic
                    // Returned (concluido OR has return date) AND Not Rejected AND Not Commented
                    const reviewsNeeded = allHistory.filter(l => 
                        (l.status === 'concluido' || (l.data_devolucao_real && l.status !== 'rejeitado')) 
                        && !commentedBookIds.includes(l.id_livro)
                    );
                    setPendingReviewCount(reviewsNeeded.length);
                }
            }
        } catch (err) {
            console.error("Error fetching student dashboard data", err);
        }
      };

      fetchStats();
    }
  }, [user]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Alerts Container */}
      <div className="space-y-4">
          {/* Overdue Alert Banner (Persistent) */}
          {overdueBooks.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AlertCircle className="text-red-600 w-6 h-6" />
                    <div>
                        <h4 className="text-red-800 font-bold">Atenção! Você possui {overdueBooks.length} livro(s) atrasado(s).</h4>
                        <p className="text-red-700 text-sm">Por favor, regularize sua situação na biblioteca o mais breve possível.</p>
                    </div>
                </div>
                <Button size="sm" variant="danger" onClick={() => onChangeTab('history')}>Ver Detalhes</Button>
            </div>
          )}

          {/* Pending Reviews Banner */}
          {pendingReviewCount > 0 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-100 p-2 rounded-full">
                        <Star className="text-yellow-600 w-5 h-5 fill-yellow-500" />
                    </div>
                    <div>
                        <h4 className="text-yellow-800 font-bold">Você tem {pendingReviewCount} leitura(s) para avaliar!</h4>
                        <p className="text-yellow-700 text-sm">Sua opinião ajuda outros alunos a escolherem bons livros.</p>
                    </div>
                </div>
                <Button 
                    size="sm" 
                    className="bg-yellow-500 hover:bg-yellow-600 text-white border-none shadow-sm"
                    onClick={() => onChangeTab('history')}
                >
                    Avaliar Agora
                </Button>
            </div>
          )}
      </div>

      {/* Overdue Popup Modal */}
      <Modal 
        isOpen={isOverdueModalOpen} 
        onClose={() => setIsOverdueModalOpen(false)} 
        title="⚠️ Pendência Identificada"
      >
        <div className="text-center space-y-4">
            <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="text-red-600 w-8 h-8" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-900">Você tem livros com atraso!</h3>
                <p className="text-gray-600 mt-2">
                    Identificamos que o prazo de devolução dos seguintes livros já expirou:
                </p>
            </div>
            
            <div className="bg-red-50 rounded-lg p-3 text-left space-y-2 border border-red-100">
                {overdueBooks.map(book => (
                    <div key={book.id} className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-red-900">{book.livros?.titulo}</span>
                        <span className="text-red-700">Venceu: {new Date(book.devolutiva).toLocaleDateString()}</span>
                    </div>
                ))}
            </div>

            <p className="text-xs text-gray-500">
                A não devolução pode impedir novos empréstimos. Por favor, devolva-os na biblioteca.
            </p>

            <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => setIsOverdueModalOpen(false)}>
                Entendi, vou devolver
            </Button>
        </div>
      </Modal>

      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-8 shadow-lg text-white flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        
        <div className="relative z-10">
          <div className="w-24 h-24 rounded-full bg-white/20 p-1 backdrop-blur-sm">
             <img 
                src={user?.foto_perfil_url || `https://ui-avatars.com/api/?name=${user?.nome}&background=random&color=fff`} 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover border-2 border-white" 
             />
          </div>
        </div>
        <div className="text-center md:text-left flex-1 relative z-10">
          <h1 className="text-3xl font-bold mb-2">Olá, {user?.nome?.split(' ')[0]}!</h1>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 text-indigo-100 text-sm">
             <span className="bg-white/10 px-3 py-1 rounded-full border border-white/20">Turma: {user?.turma || 'N/A'}</span>
             <span className="bg-white/10 px-3 py-1 rounded-full border border-white/20">Matrícula: {user?.matricula}</span>
          </div>
        </div>
        
        {nextDue && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center md:text-right min-w-[160px]">
                <p className="text-xs text-indigo-200 uppercase tracking-wide font-semibold mb-1">Próxima Devolução</p>
                <div className="flex items-center justify-center md:justify-end gap-2 text-xl font-bold">
                    <Calendar size={20} />
                    {new Date(nextDue).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})}
                </div>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            title="Total Histórico" 
            value={stats.loans} 
            icon={<BookOpen size={24} />} 
            color="indigo"
            onClick={() => onChangeTab('history')}
        />
        <StatCard 
            title="Livros Comigo" 
            value={stats.active} 
            icon={<Clock size={24} />} 
            color="emerald"
            onClick={() => onChangeTab('history')}
        />
        <StatCard 
            title="Minhas Avaliações" 
            value={stats.comments} 
            icon={<MessageSquare size={24} />} 
            color="amber"
            onClick={() => onChangeTab('student-comments')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Atividades Recentes</h2>
            <Button variant="ghost" size="sm" onClick={() => onChangeTab('history')} className="text-indigo-600">
                Ver histórico <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {recentLoans.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-400">Você ainda não pegou nenhum livro.</p>
                    <Button variant="outline" className="mt-4" onClick={() => onChangeTab('catalog')}>Ir para o Catálogo</Button>
                </div>
            ) : (
                recentLoans.map(loan => (
                <Card key={loan.id} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors group">
                    <div className="w-12 h-16 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden shadow-sm border border-gray-200">
                        {loan.livros?.capa_url ? (
                            <img src={loan.livros.capa_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-400 font-bold text-xs">
                                {loan.livros?.titulo?.substring(0, 1)}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="font-semibold text-gray-900 truncate">{loan.livros?.titulo}</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            {loan.status === 'solicitado' ? 'Solicitado em: ' : 'Pego em: '}
                            {new Date(loan.data_emprestimo).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex flex-col justify-center items-end">
                        <Badge variant={loan.status === 'aprovado' && !loan.data_devolucao_real ? 'success' : loan.status === 'solicitado' ? 'warning' : 'default'}>
                            {loan.status === 'aprovado' && !loan.data_devolucao_real ? 'LENDO' : loan.status.toUpperCase()}
                        </Badge>
                    </div>
                </Card>
                ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
            <Card 
                className="bg-white border border-indigo-100 p-0 flex flex-col justify-center relative overflow-hidden min-h-[250px] cursor-pointer group"
                onClick={() => onChangeTab('catalog')}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-white opacity-80 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute -right-8 -bottom-8 text-indigo-100 transform rotate-12 group-hover:scale-110 group-hover:text-indigo-200 transition-all duration-500">
                    <BookOpen size={180} />
                </div>
                
                <div className="relative z-10 p-8">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                        <Search size={24} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Encontre sua próxima leitura</h3>
                    <p className="text-gray-500 mb-6 max-w-xs">Explore nosso acervo completo, veja os mais lidos e faça seus pedidos.</p>
                    
                    <div className="flex items-center gap-2 text-indigo-600 font-bold group-hover:translate-x-2 transition-transform">
                        Acessar Catálogo Completo <ArrowRight size={18} />
                    </div>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};
