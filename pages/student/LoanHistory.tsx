
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Loan } from '../../types';
import { Badge, Card, Button, Modal } from '../../components/ui/Layouts';
import { useToast } from '../../context/ToastContext';
import { Star, MessageSquare } from 'lucide-react';

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
    const [rating, setRating] = useState(0);
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
        setRating(0);
        setIsCommentModalOpen(true);
    };

    const submitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBookId || !user) return;
        
        if (rating === 0) {
            addToast('Por favor, selecione uma nota de 1 a 5 estrelas.', 'warning');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase.from('comentarios').insert([{
                matricula_aluno: user.matricula,
                id_livro: selectedBookId,
                comentario: commentText,
                aprovado: null, // NULL = Pendente/Em Análise
                data_comentario: new Date().toISOString(),
                avaliacao: rating
            }]);

            if (error) throw error;
            addToast('Avaliação enviada com sucesso!', 'success');
            setIsCommentModalOpen(false);
            setCommentedBooks(prev => [...prev, selectedBookId]);
        } catch (e: any) {
            addToast('Erro: ' + e.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate pending reviews
    const pendingReviews = loans.filter(loan => 
        (loan.status === 'concluido' || (loan.data_devolucao_real && loan.status !== 'rejeitado')) 
        && !commentedBooks.includes(loan.id_livro)
    );

    if (loading) return <div>Carregando histórico...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Pending Reviews Section - Prominent */}
            {pendingReviews.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 shadow-sm animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
                            <Star size={24} className="fill-yellow-500 text-yellow-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Você tem avaliações pendentes!</h3>
                            <p className="text-gray-600 text-sm">Conta pra gente o que você achou das suas últimas leituras.</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingReviews.map(loan => (
                            <div key={`pending-${loan.id}`} className="bg-white p-3 rounded-lg border border-yellow-100 flex items-center gap-3 shadow-sm">
                                <div className="h-12 w-9 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                                     <img src={loan.livros?.capa_url || ''} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = '')} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 truncate">{loan.livros?.titulo}</p>
                                    <button 
                                        onClick={() => handleOpenRate(loan.id_livro)}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-1"
                                    >
                                        Avaliar Agora
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                        <Button 
                                            size="sm" 
                                            variant="success"
                                            className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold" 
                                            onClick={() => handleOpenRate(loan.id_livro)}
                                        >
                                            <MessageSquare size={16} className="mr-2" />
                                            Avaliar Leitura
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
                <form onSubmit={submitComment} className="space-y-6">
                    <div className="text-center">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quantas estrelas?</label>
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={`transition-transform hover:scale-110 focus:outline-none ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                                >
                                    <Star size={32} fill="currentColor" />
                                </button>
                            ))}
                        </div>
                    </div>

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
