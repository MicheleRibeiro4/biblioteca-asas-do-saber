
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Loan } from '../../types';
import { Badge, Card, Button, Modal } from '../../components/ui/Layouts';
import { useToast } from '../../context/ToastContext';

export const LoanHistory: React.FC = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentedBooks, setCommentedBooks] = useState<number[]>([]);

    // Modal
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!user) return;
        const fetchHistory = async () => {
            // Get loans
            const { data } = await supabase
                .from('emprestimo')
                .select('*, livros(titulo, capa_url)')
                .eq('matricula_aluno', user.matricula)
                .order('data_emprestimo', { ascending: false });
            
            if (data) setLoans(data);

            // Get comments to know what can be rated
            const { data: comments } = await supabase
                .from('comentarios')
                .select('id_livro')
                .eq('matricula_aluno', user.matricula);
            
            if (comments) setCommentedBooks(comments.map(c => c.id_livro));

            setLoading(false);
        };
        fetchHistory();
    }, [user]);

    const handleOpenRate = (bookId: number) => {
        setSelectedBookId(bookId);
        setCommentText('');
        setIsCommentModalOpen(true);
    };

    const submitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBookId || !user) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('comentarios').insert([{
                matricula_aluno: user.matricula,
                id_livro: selectedBookId,
                comentario: commentText,
                aprovado: null, // NULL = Pendente/Em Análise
                data_comentario: new Date().toISOString()
            }]);

            if (error) throw error;
            addToast('Comentário enviado!', 'success');
            setIsCommentModalOpen(false);
            setCommentedBooks(prev => [...prev, selectedBookId]);
        } catch (e: any) {
            addToast('Erro: ' + e.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div>Carregando histórico...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Meus Empréstimos</h2>
            {loans.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl">
                    <p className="text-gray-500">Você ainda não realizou nenhum empréstimo.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {loans.map(loan => {
                        const isOverdue = loan.status === 'aprovado' && !loan.data_devolucao_real && new Date(loan.devolutiva) < new Date();
                        
                        // Can rate if: 
                        // 1. Returned (concluido or has return date) 
                        // 2. Not rejected 
                        // 3. Not already commented
                        const canRate = (loan.status === 'concluido' || (loan.data_devolucao_real && loan.status !== 'rejeitado')) 
                                        && !commentedBooks.includes(loan.id_livro);

                        return (
                            <Card key={loan.id} className={`p-4 flex flex-col md:flex-row gap-4 ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
                                <div className="w-16 h-24 bg-gray-100 rounded flex-shrink-0">
                                    <img src={loan.livros?.capa_url || ''} className="w-full h-full object-cover rounded" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/60x80?text=Book')} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">{loan.livros?.titulo}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                                        <p>Empréstimo: {new Date(loan.data_emprestimo).toLocaleDateString()}</p>
                                        <p>Prev. Devolução: {new Date(loan.devolutiva).toLocaleDateString()}</p>
                                        {loan.data_devolucao_real && <p>Devolvido em: {new Date(loan.data_devolucao_real).toLocaleDateString()}</p>}
                                    </div>
                                    
                                    {canRate && (
                                        <Button size="sm" variant="ghost" className="mt-2 text-indigo-600 p-0 hover:bg-transparent" onClick={() => handleOpenRate(loan.id_livro)}>
                                            Avaliar este livro
                                        </Button>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Badge variant={
                                        loan.status === 'aprovado' ? 'success' :
                                        loan.status === 'rejeitado' ? 'danger' :
                                        loan.status === 'concluido' ? 'info' : 'warning'
                                    }>
                                        {loan.status.toUpperCase()}
                                    </Badge>
                                    {isOverdue && <span className="text-xs font-bold text-red-600 animate-pulse">ATRASADO</span>}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Modal
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
                title="Avaliar Livro"
            >
                <form onSubmit={submitComment} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Seu Comentário</label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px]"
                            placeholder="Escreva o que você achou do livro..."
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setIsCommentModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={submitting}>Enviar Avaliação</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
