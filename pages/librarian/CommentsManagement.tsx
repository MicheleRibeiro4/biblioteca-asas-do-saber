import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Comment } from '../../types';
import { Badge, Button, Modal } from '../../components/ui/Layouts';
import { Check, X, MessageSquare, Trash2, AlertTriangle, BookOpen } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const CommentsManagement: React.FC = () => {
    const { addToast } = useToast();
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado'>('todos');
    const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void;}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

    useEffect(() => { loadComments(); }, []);

    const loadComments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from('comentarios').select('*, livros(titulo, capa_url), aluno(nome, matricula, turma)').order('data_comentario', { ascending: false });
            if (error) throw error;
            setComments(data || []);
        } catch (error: any) { addToast('Erro ao carregar', 'error'); } finally { setLoading(false); }
    };

    const handleApproval = async (id: number, approved: boolean) => {
        try {
            const { error } = await supabase.from('comentarios').update({ aprovado: approved, data_aprovacao: approved ? new Date().toISOString() : null }).eq('id', id);
            if (error) throw error;
            addToast(`Comentário ${approved ? 'aprovado' : 'rejeitado'}!`, 'success');
            setComments(prev => prev.map(c => c.id === id ? { ...c, aprovado: approved } : c));
        } catch (error: any) { addToast('Erro: ' + error.message, 'error'); }
    };

    const handleDeleteClick = (id: number) => {
        setConfirmConfig({ isOpen: true, title: 'Excluir Comentário', message: 'Excluir permanentemente?', onConfirm: () => performDelete(id) });
    };

    const performDelete = async (id: number) => {
        try {
            const { error } = await supabase.from('comentarios').delete().eq('id', id);
            if (error) throw error;
            addToast('Excluído.', 'success');
            setComments(prev => prev.filter(c => c.id !== id));
        } catch (error: any) { addToast('Erro: ' + error.message, 'error'); }
    };

    const filteredComments = comments.filter(c => {
        if (filter === 'todos') return true;
        if (filter === 'pendente') return c.aprovado === null;
        if (filter === 'aprovado') return c.aprovado === true;
        if (filter === 'rejeitado') return c.aprovado === false;
        return true;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><MessageSquare className="text-indigo-600" /> Moderação de Comentários</h3>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {['todos', 'pendente', 'aprovado', 'rejeitado'].map((f) => (
                        <button key={f} onClick={() => setFilter(f as any)} className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize ${filter === f ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>{f}</button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livro</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aluno</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/3">Comentário</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? <tr><td colSpan={5} className="p-8 text-center">Carregando...</td></tr> : filteredComments.length === 0 ? <tr><td colSpan={5} className="p-8 text-center">Sem comentários.</td></tr> : filteredComments.map((c) => (
                            <tr key={c.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-9 bg-gray-200 rounded flex-shrink-0 overflow-hidden shadow-sm">
                                            {c.livros?.capa_url ? <img src={c.livros.capa_url} className="w-full h-full object-cover" /> : <BookOpen size={14} className="m-auto mt-4 text-gray-400"/>}
                                        </div>
                                        <span className="text-sm font-medium text-gray-900">{c.livros?.titulo}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{c.aluno?.nome}</td>
                                <td className="px-6 py-4 text-sm italic text-gray-600">"{c.comentario}"</td>
                                <td className="px-6 py-4"><Badge variant={c.aprovado === true ? 'success' : c.aprovado === false ? 'danger' : 'warning'}>{c.aprovado === true ? 'APROVADO' : c.aprovado === false ? 'REJEITADO' : 'PENDENTE'}</Badge></td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        {c.aprovado === null && (
                                            <>
                                                <button onClick={() => handleApproval(c.id, true)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"><Check size={18}/></button>
                                                <button onClick={() => handleApproval(c.id, false)} className="text-red-600 hover:bg-red-50 p-1 rounded"><X size={18}/></button>
                                            </>
                                        )}
                                        <button onClick={() => handleDeleteClick(c.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={18}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} title={confirmConfig.title}>
                <div className="space-y-6 text-center">
                    <p>{confirmConfig.message}</p>
                    <div className="flex justify-center gap-4">
                        <Button variant="secondary" onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}>Cancelar</Button>
                        <Button variant="danger" onClick={() => { confirmConfig.onConfirm(); setConfirmConfig({ ...confirmConfig, isOpen: false }); }}>Excluir</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};