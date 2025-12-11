
import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Book } from '../../types';
import { Button, Input, Modal, Badge, Select } from '../../components/ui/Layouts';
import { Plus, Edit2, Trash2, Search, BookOpen, ImageIcon, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const ITEMS_PER_PAGE = 10;

export const BookManagement: React.FC = () => {
    const { addToast } = useToast();
    
    // Data State
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalBooks, setTotalBooks] = useState(0);
    
    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [genreFilter, setGenreFilter] = useState('');
    const [uniqueGenres, setUniqueGenres] = useState<string[]>([]);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<Partial<Book>>({});
    const [saving, setSaving] = useState(false);

    // Confirmation Modal
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    // Initial Load
    useEffect(() => {
        const loadGenres = async () => {
            const { data } = await supabase.from('livros').select('genero');
            if(data) {
                const genres = Array.from(new Set(data.map(b => b.genero).filter(Boolean))).sort() as string[];
                setUniqueGenres(genres);
            }
        };
        loadGenres();
    }, []);

    useEffect(() => {
        loadBooks();
    }, [currentPage, searchTerm, genreFilter]);

    const loadBooks = async () => {
        setLoading(true);
        try {
            let query = supabase.from('livros').select('*', { count: 'exact' });

            // Unified Search: Title OR Author
            if (searchTerm) {
                query = query.or(`titulo.ilike.%${searchTerm}%,autor.ilike.%${searchTerm}%`);
            }
            
            if (genreFilter) query = query.eq('genero', genreFilter);

            const from = (currentPage - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data, count, error } = await query.range(from, to).order('titulo');
            
            if (error) throw error;
            
            setBooks(data || []);
            setTotalBooks(count || 0);
        } catch (error) {
            console.error("Error loading books:", error);
            addToast('Erro ao carregar livros', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Default quantity logic
            const payload = {
                ...editingBook,
                quantidade_disponivel: editingBook.quantidade_disponivel ?? editingBook.quantidade_total
            };

            if (editingBook.id) {
                await supabase.from('livros').update(payload).eq('id', editingBook.id);
                addToast('Livro atualizado com sucesso', 'success');
            } else {
                await supabase.from('livros').insert([payload]);
                addToast('Livro criado com sucesso', 'success');
            }
            setIsModalOpen(false);
            loadBooks();
        } catch (error) {
            addToast('Erro ao salvar livro', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (id: number) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Excluir Livro',
            message: 'Tem certeza que deseja excluir este livro permanentemente?',
            onConfirm: () => performDelete(id)
        });
    };

    const performDelete = async (id: number) => {
        const { error } = await supabase.from('livros').delete().eq('id', id);
        if (error) {
            addToast('Erro ao excluir livro (Pode estar em uso)', 'error');
        } else {
            addToast('Livro excluído', 'success');
            loadBooks();
        }
    };

    const totalPages = Math.ceil(totalBooks / ITEMS_PER_PAGE);
    const genreOptions = [{ value: '', label: 'Todos os Gêneros' }, ...uniqueGenres.map(g => ({ value: g, label: g }))];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <BookOpen className="text-indigo-600" />
                    Gerenciar Acervo
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{totalBooks} livros</span>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-end">
                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto flex-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                        <Input 
                            placeholder="Buscar por título ou autor..." 
                            className="pl-10" 
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="w-full sm:w-64">
                        <Select 
                            options={genreOptions}
                            value={genreFilter}
                            onChange={e => { setGenreFilter(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                </div>
                <Button onClick={() => { setEditingBook({}); setIsModalOpen(true); }} className="w-full sm:w-auto whitespace-nowrap">
                    <Plus size={18} className="mr-2" /> Adicionar Livro
                </Button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capa</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Informações</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gênero</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque</th>
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Carregando acervo...</td></tr>
                            ) : books.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhum livro encontrado.</td></tr>
                            ) : (
                                books.map(book => (
                                    <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="h-16 w-12 rounded bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                                                {book.capa_url ? (
                                                    <img src={book.capa_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <ImageIcon className="text-gray-300 w-6 h-6" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold text-gray-900">{book.titulo}</div>
                                            <div className="text-sm text-gray-500">{book.autor}</div>
                                            <div className="text-xs text-gray-400 mt-1">{book.editora}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="default">{book.genero}</Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${book.quantidade_disponivel > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                                <span className="text-sm font-medium text-gray-900">
                                                    {book.quantidade_disponivel}
                                                </span>
                                                <span className="text-xs text-gray-500">/ {book.quantidade_total}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => { setEditingBook(book); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-full hover:bg-indigo-100 transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDeleteClick(book.id)} className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-full hover:bg-red-100 transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            <ChevronLeft size={16} /> Anterior
                        </Button>
                        <span className="text-sm text-gray-600">
                            Página {currentPage} de {totalPages}
                        </span>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            Próxima <ChevronRight size={16} />
                        </Button>
                    </div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBook.id ? "Editar Livro" : "Adicionar Livro"}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Título" value={editingBook.titulo || ''} onChange={e => setEditingBook({...editingBook, titulo: e.target.value})} required />
                    <Input label="Autor" value={editingBook.autor || ''} onChange={e => setEditingBook({...editingBook, autor: e.target.value})} required />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Gênero" value={editingBook.genero || ''} onChange={e => setEditingBook({...editingBook, genero: e.target.value})} required />
                        <Input label="Editora" value={editingBook.editora || ''} onChange={e => setEditingBook({...editingBook, editora: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Qtd Total" type="number" min="1" value={editingBook.quantidade_total || ''} onChange={e => setEditingBook({...editingBook, quantidade_total: parseInt(e.target.value)})} required />
                        <Input label="Qtd Disponível" type="number" min="0" value={editingBook.quantidade_disponivel !== undefined ? editingBook.quantidade_disponivel : (editingBook.quantidade_total || 0)} onChange={e => setEditingBook({...editingBook, quantidade_disponivel: parseInt(e.target.value)})} />
                    </div>
                    <Input label="URL da Capa" placeholder="https://..." value={editingBook.capa_url || ''} onChange={e => setEditingBook({...editingBook, capa_url: e.target.value})} />
                    
                    <div className="grid grid-cols-1 gap-4">
                        <Input label="Localização" placeholder="Estante A1" value={editingBook.localizacao || ''} onChange={e => setEditingBook({...editingBook, localizacao: e.target.value})} />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={saving}>Salvar Livro</Button>
                    </div>
                </form>
            </Modal>

            {/* Custom Confirm Modal */}
            <Modal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} title={confirmConfig.title}>
                <div className="space-y-6">
                    <div className="flex justify-center text-red-500 mb-2"><AlertTriangle size={48} /></div>
                    <p className="text-gray-700 text-center text-lg">{confirmConfig.message}</p>
                    <div className="flex justify-center gap-4">
                        <Button variant="secondary" onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}>Cancelar</Button>
                        <Button variant="danger" onClick={() => { confirmConfig.onConfirm(); setConfirmConfig({ ...confirmConfig, isOpen: false }); }}>Excluir</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
