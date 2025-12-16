
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Loan } from '../../types';
import { Badge, Card, Button, Modal } from '../../components/ui/Layouts';
import { useToast } from '../../context/ToastContext';
import { Star, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';

export const LoanHistory: React.FC = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [userReviews, setUserReviews] = useState<Record<number, number>>({}); // Map book_id -> rating

    // Modal
    const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
    const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
    const [commentText, setCommentText] = useState('');
    const [rating, setRating] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!user) return;
        const fetchHistory = async () => {
            setLoading(true);
            // Get loans
            const { data } = await supabase
                .from('emprestimo')
                .select('*, livros(titulo, capa_url)')
                .eq('matricula_aluno', user.matricula)
                .order('data_emprestimo', { ascending: false });
            
            if (data) setLoans(data);

            // Get existing ratings
            const { data: comments } = await supabase
                .from('comentarios')
                .select('id_livro, avaliacao')
                .eq('matricula_aluno', user.matricula);
            
            if (comments) {
                const map: Record<number, number> = {};
                comments.forEach(c => { map[c.id_livro] = c.avaliacao || 0; });
                setUserReviews(map);
            }

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
            
            // Update local state to show review immediately
            setUserReviews(prev => ({ ...prev, [selectedBookId]: rating }));
        } catch (e: any) {
            addToast('Erro: ' + e.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate pending reviews for banner
    const pendingReviews = loans.filter(loan => {
        const isReturned = loan.status === 'concluido' || (loan.data_devolucao_real && loan.status !== 'rejeitado');
        const hasReview = userReviews[loan.id_livro] !== undefined;
        return isReturned && !hasReview;
    });

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando histórico...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Pending Reviews Section - Prominent Banner */}
            {pendingReviews.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-100 p-3 rounded-full text-amber-600 shadow-sm">
                            <Star size={24} className="fill-amber-500 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Você tem {pendingReviews.length} avaliações pendentes!</h3>
                            <p className="text-gray-600 text-sm">Conta pra gente o que você achou das suas últimas leituras.</p>
                        </div>
                    </div>
                </div>
            )}

            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <CheckCircle className="text-indigo-600"/> Meus Empréstimos
            </h2>

            {loans.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                    <p className="text-gray-500">Você ainda não realizou nenhum empréstimo.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {loans.map(loan => {
                        const isOverdue = loan.status === 'aprovado' && !loan.data_devolucao_real && new Date(loan.devolutiva) < new Date();
                        const isReturned = loan.status === 'concluido' || (loan.data_devolucao_real && loan.status !== 'rejeitado');
                        const userRating = userReviews[loan.id_livro];
                        const hasRated = userRating !== undefined;

                        return (
                            <Card key={loan.id} className={`p-4 flex flex-col md:flex-row gap-4 transition-all hover:shadow-md ${isOverdue ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-transparent'}`}>
                                <div className="w-16 h-24 bg-gray-100 rounded flex-shrink-0 shadow-sm overflow-hidden border border-gray-100">
                                    <img src={loan.livros?.capa_url || ''} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/60x80?text=Capa')} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-gray-800">{loan.livros?.titulo}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                                        <p><span className="font-medium">Data Empréstimo:</span> {new Date(loan.data_emprestimo).toLocaleDateString()}</p>
                                        <p><span className="font-medium">Devolução Prevista:</span> {new Date(loan.devolutiva).toLocaleDateString()}</p>
                                        {loan.data_devolucao_real && <p className="text-emerald-700"><span className="font-medium">Devolvido em:</span> {new Date(loan.data_devolucao_real).toLocaleDateString()}</p>}
                                    </div>
                                    
                                    {/* Action Area for Reviews */}
                                    <div className="mt-3">
                                        {isReturned ? (
                                            !hasRated ? (
                                                <Button 
                                                    size="sm" 
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold transition-all hover:scale-105" 
                                                    onClick={() => handleOpenRate(loan.id_livro)}
                                                >
                                                    <MessageSquare size={16} className="mr-2" />
                                                    Avaliar Leitura
                                                </Button>
                                            ) : (
                                                <div className="flex items-center gap-2 bg-yellow-50 w-fit px-3 py-1.5 rounded-lg border border-yellow-100">
                                                    <span className="text-xs font-bold text-yellow-800 uppercase">Sua Avaliação:</span>
                                                    <div className="flex">
                                                        {[1,2,3,4,5].map(s => (
                                                            <Star key={s} size={14} className={s <= userRating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Devolva o livro para poder avaliar.</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Badge variant={
                                        loan.status === 'aprovado' ? 'success' :
                                        loan.status === 'rejeitado' ? 'danger' :
                                        loan.status === 'concluido' ? 'info' : 'warning'
                                    }>
                                        {loan.status === 'aprovado' && !loan.data_devolucao_real ? 'EM LEITURA' : loan.status.toUpperCase()}
                                    </Badge>
                                    {isOverdue && <span className="text-xs font-bold text-red-600 animate-pulse flex items-center gap-1"><AlertCircle size={12}/> ATRASADO</span>}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Modal de Avaliação */}
            <Modal
                isOpen={isCommentModalOpen}
                onClose={() => setIsCommentModalOpen(false)}
                title="Avaliar Livro"
            >
                <form onSubmit={submitComment} className="space-y-6">
                    <div className="text-center bg-gray-50 p-4 rounded-xl">
                        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Classifique sua leitura</label>
                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    className={`transition-transform hover:scale-110 focus:outline-none p-1 ${rating >= star ? 'text-yellow-400 drop-shadow-sm' : 'text-gray-300'}`}
                                >
                                    <Star size={36} fill="currentColor" />
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{rating > 0 ? `${rating} estrela(s)` : 'Toque nas estrelas'}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Deixe um comentário (Opcional)</label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 min-h-[100px] resize-none"
                            placeholder="O que você mais gostou neste livro?"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setIsCommentModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={submitting} disabled={rating === 0}>Enviar Avaliação</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
