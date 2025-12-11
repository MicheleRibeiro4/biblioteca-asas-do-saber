
import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Loan, WaitlistEntry } from '../../types';
import { Badge, Button, Input, Select } from '../../components/ui/Layouts';
import { Search, Filter, BookOpen, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, MapPin, List, User } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const LoanManagement: React.FC = () => {
    const { addToast } = useToast();
    const { user } = useAuth(); // To get current librarian name
    const [view, setView] = useState<'loans' | 'waitlist'>('loans');
    
    const [loans, setLoans] = useState<Loan[]>([]);
    const [waitlist, setWaitlist] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        if (view === 'loans') loadLoans();
        else loadWaitlist();
    }, [view]);

    const loadLoans = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('emprestimo')
                .select('*, livros(titulo, capa_url, autor, localizacao), aluno(nome, matricula, turma)')
                .order('data_emprestimo', { ascending: false });
            
            if (error) throw error;
            if (data) setLoans(data);
        } catch (e: any) {
            addToast('Erro ao carregar empréstimos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadWaitlist = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('fila_espera')
                .select('*, livros(titulo, capa_url), aluno(nome, matricula, turma)')
                .order('data_entrada', { ascending: true });
            
            if (error) {
                if(error.code !== '42P01') throw error; 
                setWaitlist([]);
            } else {
                setWaitlist(data || []);
            }
        } catch (e: any) {
            console.error(e);
            addToast('Erro ao carregar fila de espera', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: number, status: string, bookId?: number) => {
        const updates: any = { 
            status, 
            bibliotecaria: user?.nome || 'Sistema' // Save who approved/received
        };
        
        if (status === 'concluido' || status === 'rejeitado') {
            updates.data_devolucao_real = new Date().toISOString();
        }
        
        try {
            const { error } = await supabase.from('emprestimo').update(updates).eq('id', id);
            if (error) throw error;

            if (bookId) {
                if (status === 'concluido') {
                    // Check Waitlist
                    try {
                        const { data: queue } = await supabase
                            .from('fila_espera')
                            .select('*')
                            .eq('id_livro', bookId)
                            .order('data_entrada', { ascending: true })
                            .limit(1);

                        if (queue && queue.length > 0) {
                            const nextStudent = queue[0];
                            const dueDate = new Date();
                            dueDate.setDate(dueDate.getDate() + 7);

                            await supabase.from('emprestimo').insert({
                                id_livro: bookId,
                                matricula_aluno: nextStudent.matricula_aluno,
                                data_emprestimo: new Date().toISOString(),
                                devolutiva: dueDate.toISOString(),
                                status: 'solicitado'
                            });

                            await supabase.from('fila_espera').delete().eq('id', nextStudent.id);
                            await supabase.from('notificacoes').insert({
                                matricula_aluno: nextStudent.matricula_aluno,
                                mensagem: `O livro que você esperava foi devolvido! Uma solicitação foi criada automaticamente para você.`,
                                tipo: 'loan_approved',
                                lida: false
                            });
                            addToast(`Livro atribuído ao próximo da fila (Matrícula: ${nextStudent.matricula_aluno})!`, 'info');
                        } else {
                            const { data: book } = await supabase.from('livros').select('quantidade_disponivel').eq('id', bookId).single();
                            if (book) {
                                await supabase.from('livros').update({ quantidade_disponivel: (book.quantidade_disponivel || 0) + 1 }).eq('id', bookId);
                            }
                            addToast('Livro devolvido e estoque atualizado.', 'success');
                        }
                    } catch (err) {
                        const { data: book } = await supabase.from('livros').select('quantidade_disponivel').eq('id', bookId).single();
                        if (book) await supabase.from('livros').update({ quantidade_disponivel: (book.quantidade_disponivel || 0) + 1 }).eq('id', bookId);
                    }
                } else if (status === 'aprovado') {
                     const { data: book } = await supabase.from('livros').select('quantidade_disponivel').eq('id', bookId).single();
                     if (book) {
                         await supabase.from('livros').update({ quantidade_disponivel: Math.max(0, (book.quantidade_disponivel || 0) - 1) }).eq('id', bookId);
                     }
                     addToast('Empréstimo aprovado!', 'success');
                } else {
                    addToast(`Status atualizado para ${status.toUpperCase()}`, 'success');
                }
            }
            setLoans(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
        } catch (e: any) {
            addToast('Erro ao atualizar status: ' + e.message, 'error');
        }
    };

    const removeFromWaitlist = async (id: number) => {
        try {
            await supabase.from('fila_espera').delete().eq('id', id);
            setWaitlist(prev => prev.filter(w => w.id !== id));
            addToast('Removido da fila.', 'success');
        } catch (e) {
            addToast('Erro ao remover.', 'error');
        }
    };

    const getStatusVariant = (loan: Loan) => {
        const isOverdue = loan.status === 'aprovado' && !loan.data_devolucao_real && new Date(loan.devolutiva) < new Date();
        if (isOverdue) return 'danger';
        if (loan.status === 'aprovado') return 'success';
        if (loan.status === 'solicitado') return 'warning';
        if (loan.status === 'rejeitado') return 'danger';
        return 'info';
    };

    const getDisplayStatus = (loan: Loan) => {
        const isOverdue = loan.status === 'aprovado' && !loan.data_devolucao_real && new Date(loan.devolutiva) < new Date();
        if (isOverdue) return 'ATRASADO';
        if (loan.status === 'aprovado') return 'LENDO'; // Changed to LENDO
        return loan.status.toUpperCase();
    };

    const filteredLoans = loans.filter(loan => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
            loan.aluno?.nome?.toLowerCase().includes(searchLower) ||
            loan.aluno?.matricula?.toLowerCase().includes(searchLower) ||
            loan.livros?.titulo.toLowerCase().includes(searchLower);

        const isOverdue = loan.status === 'aprovado' && !loan.data_devolucao_real && new Date(loan.devolutiva) < new Date();
        
        let matchesStatus = true;
        if (statusFilter === 'solicitado') matchesStatus = loan.status === 'solicitado';
        else if (statusFilter === 'aprovado') matchesStatus = loan.status === 'aprovado' && !isOverdue;
        else if (statusFilter === 'atrasado') matchesStatus = isOverdue;
        else if (statusFilter === 'concluido') matchesStatus = loan.status === 'concluido' || !!loan.data_devolucao_real;
        else if (statusFilter === 'rejeitado') matchesStatus = loan.status === 'rejeitado';

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header Tabs */}
            <div className="flex gap-4 border-b border-gray-200 pb-2">
                <button 
                    onClick={() => setView('loans')} 
                    className={`pb-2 px-4 font-medium transition-colors ${view === 'loans' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Empréstimos e Histórico
                </button>
                <button 
                    onClick={() => setView('waitlist')} 
                    className={`pb-2 px-4 font-medium transition-colors ${view === 'waitlist' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Fila de Espera
                </button>
            </div>

            {view === 'loans' && (
                <>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                            <Input placeholder="Buscar por aluno ou livro..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="w-full md:w-64">
                            <Select 
                                options={[
                                    { value: 'all', label: 'Todos os Status' },
                                    { value: 'solicitado', label: 'Solicitações Pendentes' },
                                    { value: 'aprovado', label: 'Em Andamento' },
                                    { value: 'atrasado', label: 'Atrasados' },
                                    { value: 'concluido', label: 'Devolvidos' },
                                    { value: 'rejeitado', label: 'Rejeitados' }
                                ]}
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                            />
                        </div>
                        <Button variant="ghost" onClick={loadLoans}><RefreshCw size={18} /></Button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Solicitante</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Livro</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Prazos</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {loading ? <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Carregando...</td></tr> : 
                                    filteredLoans.length === 0 ? <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Nenhum registro.</td></tr> :
                                    filteredLoans.map((loan) => {
                                        const variant = getStatusVariant(loan);
                                        const displayStatus = getDisplayStatus(loan);
                                        const today = new Date();
                                        const dueDate = new Date(loan.devolutiva);
                                        const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
                                        const isLate = daysDiff < 0 && loan.status === 'aprovado' && !loan.data_devolucao_real;

                                        return (
                                            <tr key={loan.id} className={`hover:bg-gray-50 ${isLate ? 'bg-red-50/30' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3 text-sm">
                                                            {loan.aluno?.nome?.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">{loan.aluno?.nome}</div>
                                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                                <User size={10} /> Aluno • {loan.matricula_aluno} 
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-12 w-9 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                                                            {loan.livros?.capa_url ? <img src={loan.livros.capa_url} className="w-full h-full object-cover" /> : <BookOpen size={14} className="m-auto mt-4 text-gray-400"/>}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium">{loan.livros?.titulo}</div>
                                                            {loan.livros?.localizacao && (
                                                                <div className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded w-fit mt-1 flex items-center gap-1">
                                                                    <MapPin size={10} /> {loan.livros.localizacao}
                                                                </div>
                                                            )}
                                                            {/* Display Approver */}
                                                            {loan.bibliotecaria && (
                                                                <div className="text-[10px] text-gray-400 mt-1 font-medium bg-gray-50 px-2 py-0.5 rounded inline-block border border-gray-100">
                                                                    Resp: {loan.bibliotecaria}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div>Devolução: {new Date(loan.devolutiva).toLocaleDateString()}</div>
                                                    {loan.status === 'aprovado' && !loan.data_devolucao_real && (
                                                        <div className={`text-xs mt-1 font-medium ${isLate ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {isLate ? `${Math.abs(daysDiff)} dia(s) de atraso` : `${daysDiff} dia(s) restantes`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center"><Badge variant={variant}>{displayStatus}</Badge></td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {loan.status === 'solicitado' && (
                                                            <>
                                                                <button onClick={() => updateStatus(loan.id, 'aprovado', loan.id_livro)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"><CheckCircle size={18} /></button>
                                                                <button onClick={() => updateStatus(loan.id, 'rejeitado', loan.id_livro)} className="p-1.5 bg-rose-100 text-rose-700 rounded hover:bg-rose-200"><XCircle size={18} /></button>
                                                            </>
                                                        )}
                                                        {loan.status === 'aprovado' && !loan.data_devolucao_real && (
                                                            <Button size="sm" onClick={() => updateStatus(loan.id, 'concluido', loan.id_livro)}>Receber</Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {view === 'waitlist' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                     {waitlist.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <List size={48} className="mx-auto mb-4 text-gray-300" />
                            <p>A fila de espera está vazia.</p>
                        </div>
                     ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Posição</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Aluno</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Livro Aguardado</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data Entrada</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {waitlist.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-bold text-gray-700">#{idx + 1}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium">{item.aluno?.nome}</div>
                                            <div className="text-xs text-gray-500">{item.matricula_aluno} • {item.aluno?.turma}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-indigo-600">{item.livros?.titulo}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(item.data_entrada).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <Button size="sm" variant="danger" onClick={() => removeFromWaitlist(item.id)}>Remover</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     )}
                </div>
            )}
        </div>
    );
};
