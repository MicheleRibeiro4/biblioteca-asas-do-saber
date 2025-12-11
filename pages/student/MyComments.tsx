import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge } from '../../components/ui/Layouts';
import { MessageSquare, BookOpen, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const MyComments: React.FC = () => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { if (user) fetchComments(); }, [user]);

    const fetchComments = async () => {
        setLoading(true);
        try {
            const { data } = await supabase.from('comentarios').select('*, livros(titulo, capa_url)').eq('matricula_aluno', user?.matricula).order('data_comentario', { ascending: false });
            if (data) setComments(data);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir este comentário?')) return;
        try {
            const { error } = await supabase.from('comentarios').delete().eq('id', id);
            if (error) throw error;
            addToast('Comentário excluído!', 'success');
            setComments(prev => prev.filter(c => c.id !== id));
        } catch (e: any) { addToast(e.message, 'error'); }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><MessageSquare className="text-indigo-600" /> Meus Comentários</h2>
            {loading ? <div className="text-center p-8">Carregando...</div> : comments.length === 0 ? <div className="text-center p-12 bg-white rounded-xl border border-gray-200 text-gray-500">Nenhum comentário.</div> : 
            <div className="grid gap-4">
                {comments.map((c) => (
                    <Card key={c.id} className="p-4 flex flex-col md:flex-row gap-4 relative group">
                        <div className="w-16 h-24 bg-gray-100 rounded flex-shrink-0 overflow-hidden">{c.livros?.capa_url ? <img src={c.livros.capa_url} className="w-full h-full object-cover"/> : <BookOpen className="m-auto mt-8 text-gray-400"/>}</div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900">{c.livros?.titulo}</h4>
                            <p className="text-xs text-gray-400 mb-2">{new Date(c.data_comentario).toLocaleDateString()}</p>
                            <p className="text-gray-600 italic bg-gray-50 p-3 rounded-lg border border-gray-100">"{c.comentario}"</p>
                            <div className="flex items-center gap-2 mt-2">
                                {c.aprovado === true ? <Badge variant="success">PUBLICADO</Badge> : c.aprovado === false ? <Badge variant="danger">REJEITADO</Badge> : <Badge variant="warning">EM ANÁLISE</Badge>}
                            </div>
                        </div>
                        <button onClick={() => handleDelete(c.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                    </Card>
                ))}
            </div>}
        </div>
    );
};