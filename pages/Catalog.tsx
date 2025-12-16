
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Book } from '../types';
import { Card, Input, Select, Button, Badge, Modal } from '../components/ui/Layouts';
import { Search, BookOpen, ChevronLeft, ChevronRight, TrendingUp, UserPlus, CheckCircle, MessageSquare, AlertCircle, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ITEMS_PER_PAGE = 12;

interface BookComment {
    id: number;
    comentario: string;
    data_comentario: string;
    aluno: {
        nome: string;
    }
}

export const Catalog: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Data State
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBooks, setTotalBooks] = useState(0);
  const [topBooks, setTopBooks] = useState<Book[]>([]);
  const [bookComments, setBookComments] = useState<BookComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [uniqueGenres, setUniqueGenres] = useState<string[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal State
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [loanDuration, setLoanDuration] = useState('7');
  const [processing, setProcessing] = useState(false);
  
  // Waitlist State
  const [isAlreadyInQueue, setIsAlreadyInQueue] = useState(false);

  useEffect(() => {
    fetchTopBooks();
    fetchGenres();
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [currentPage, searchTerm, genreFilter]);

  // Check waitlist status when modal opens
  useEffect(() => {
    if (isModalOpen && selectedBook) {
        if (user && user.tipo === 'aluno') {
            checkWaitlistStatus();
        }
        fetchBookComments(selectedBook.id);
    }
  }, [isModalOpen, selectedBook, user]);

  const checkWaitlistStatus = async () => {
      if (!selectedBook || !user || !user.matricula) return;
      
      setIsAlreadyInQueue(false); // Reset first

      try {
          const { data, error } = await supabase
              .from('fila_espera')
              .select('id')
              .eq('id_livro', selectedBook.id)
              .eq('matricula_aluno', user.matricula)
              .maybeSingle();
          
          if (!error && data) {
              setIsAlreadyInQueue(true);
          }
      } catch (e) {
          console.error("Erro ao verificar fila", e);
      }
  };

  const fetchBookComments = async (bookId: number) => {
      setLoadingComments(true);
      try {
          const { data } = await supabase
            .from('comentarios')
            .select('id, comentario, data_comentario, aluno(nome)')
            .eq('id_livro', bookId)
            .eq('aprovado', true) // Only show approved comments
            .order('data_comentario', { ascending: false });
          
          if (data) {
              setBookComments(data as any);
          } else {
              setBookComments([]);
          }
      } catch (e) {
          console.error("Erro ao buscar comentários", e);
      } finally {
          setLoadingComments(false);
      }
  };

  const fetchGenres = async () => {
      const { data } = await supabase.from('livros').select('genero');
      if (data) {
          const genres = Array.from(new Set(data.map(b => b.genero).filter(Boolean))).sort() as string[];
          setUniqueGenres(genres);
      }
  };

  const fetchTopBooks = async () => {
      // Logic for top 10 most read: Count loans per book
      const { data: loans } = await supabase.from('emprestimo').select('id_livro');
      if (loans) {
          const counts: Record<number, number> = {};
          loans.forEach(l => counts[l.id_livro] = (counts[l.id_livro] || 0) + 1);
          
          const sortedIds = Object.entries(counts)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 10)
            .map(k => parseInt(k[0]));
          
          if (sortedIds.length > 0) {
              const { data } = await supabase.from('livros').select('*').in('id', sortedIds);
              if (data) {
                  const sortedData = sortedIds.map(id => data.find(b => b.id === id)).filter(Boolean) as Book[];
                  setTopBooks(sortedData);
              }
          }
      }
  };

  const fetchBooks = async () => {
    setLoading(true);
    
    // Construct range
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    try {
        // Try fetching with ratings first
        let query = supabase.from('livros').select('*, comentarios(avaliacao, aprovado)', { count: 'exact' });

        if (searchTerm) {
            query = query.or(`titulo.ilike.%${searchTerm}%,autor.ilike.%${searchTerm}%`);
        }
        
        if (genreFilter) query = query.eq('genero', genreFilter);

        const { data, count, error } = await query.range(from, to).order('titulo');
        
        if (error) throw error;
        
        if (data) {
            const booksWithRating = data.map((book: any) => {
                const approvedRatings = book.comentarios?.filter((c: any) => c.aprovado === true && c.avaliacao > 0) || [];
                const totalRating = approvedRatings.reduce((acc: number, curr: any) => acc + curr.avaliacao, 0);
                const avgRating = approvedRatings.length > 0 ? totalRating / approvedRatings.length : 0;
                
                return {
                    ...book,
                    rating: avgRating,
                    ratingCount: approvedRatings.length
                };
            });
            setBooks(booksWithRating);
        }
        if (count !== null) setTotalBooks(count);
    } catch (error: any) {
        console.warn("Falha ao carregar com avaliações, tentando carregamento simples:", error.message);
        
        // Fallback: Simple query without comments (avoids RLS recursion on joined table if any)
        try {
            let simpleQuery = supabase.from('livros').select('*', { count: 'exact' });

            if (searchTerm) {
                simpleQuery = simpleQuery.or(`titulo.ilike.%${searchTerm}%,autor.ilike.%${searchTerm}%`);
            }
            if (genreFilter) simpleQuery = simpleQuery.eq('genero', genreFilter);

            const { data, count, error: simpleError } = await simpleQuery.range(from, to).order('titulo');
            
            if (simpleError) throw simpleError;

            if (data) {
                // Initialize with 0 rating
                setBooks(data.map((b: any) => ({ ...b, rating: 0, ratingCount: 0 })));
            }
            if (count !== null) setTotalBooks(count);

        } catch (finalError: any) {
            console.error("Erro fatal ao carregar livros:", finalError);
            addToast('Erro ao carregar catálogo. Tente novamente mais tarde.', 'error');
        }
    } finally {
        setLoading(false);
    }
  };

  const handleOpenBook = (book: Book) => {
      setSelectedBook(book);
      setIsModalOpen(true);
  };

  const handleJoinWaitlist = async () => {
      if (!user || !selectedBook) return;
      
      if (user.tipo !== 'aluno' || !user.matricula) {
          addToast('Apenas alunos podem entrar na fila de espera.', 'error');
          return;
      }
      
      setProcessing(true);
      try {
          // Verify duplicate locally first
          if (isAlreadyInQueue) {
              addToast('Você já está na fila deste livro.', 'info');
              setProcessing(false);
              return;
          }

          const { error } = await supabase.from('fila_espera').insert({
              id_livro: selectedBook.id,
              matricula_aluno: user.matricula,
              data_entrada: new Date().toISOString()
          });
          
          if (error) {
              // Code 42P01 means table missing
              if (error.code === '42P01') throw new Error('Sistema Indisponível: Tabela de fila não encontrada. Contate a biblioteca.');
              // Code 23505 means unique constraint violation
              if (error.code === '23505') {
                  setIsAlreadyInQueue(true);
                  throw new Error('Você já está na fila deste livro.');
              }
              throw error;
          }
          
          addToast('Você entrou na fila de espera com sucesso!', 'success');
          setIsAlreadyInQueue(true);
      } catch (e: any) {
          addToast(e.message || 'Erro ao entrar na fila', 'error');
      } finally {
          setProcessing(false);
      }
  };

  const handleBorrowRequest = async () => {
      if (!user || !selectedBook) return;
      
      if (user.tipo !== 'aluno') {
          addToast('Apenas alunos podem solicitar empréstimos.', 'error');
          return;
      }

      const { data: activeLoans } = await supabase
        .from('emprestimo')
        .select('id')
        .eq('matricula_aluno', user.matricula)
        .in('status', ['solicitado', 'aprovado', 'pendente'])
        .is('data_devolucao_real', null);

      if (activeLoans && activeLoans.length > 0) {
          addToast('Você já possui um empréstimo ativo. Devolva o livro atual antes de pegar outro.', 'error');
          setIsBorrowModalOpen(false);
          return;
      }

      setProcessing(true);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(loanDuration));

      try {
          const { error } = await supabase.from('emprestimo').insert({
              id_livro: selectedBook.id,
              matricula_aluno: user.matricula,
              data_emprestimo: new Date().toISOString(),
              devolutiva: dueDate.toISOString(),
              status: 'solicitado'
          });

          if (error) throw error;

          addToast('Solicitação enviada com sucesso!', 'success');
          setIsBorrowModalOpen(false);
          setIsModalOpen(false);
      } catch (e: any) {
          addToast('Erro ao solicitar: ' + e.message, 'error');
      } finally {
          setProcessing(false);
      }
  };

  const totalPages = Math.ceil(totalBooks / ITEMS_PER_PAGE);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top 10 Section */}
      {topBooks.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-indigo-50 to-white p-6 rounded-xl border border-indigo-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="text-indigo-600" />
                  Top 10 - Os Mais Lidos
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent">
                  {topBooks.map((book, idx) => (
                      <div key={book.id} onClick={() => handleOpenBook(book)} className="flex-shrink-0 w-32 cursor-pointer group">
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md mb-2 bg-white transition-transform group-hover:-translate-y-1">
                              <span className={`absolute top-0 left-0 text-xs font-bold px-2 py-1 z-10 rounded-br-lg ${idx < 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-200 text-gray-700'}`}>
                                  #{idx + 1}
                              </span>
                              {book.capa_url ? (
                                  <img src={book.capa_url} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                  <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-300 text-2xl font-bold">
                                      {book.titulo[0]}
                                  </div>
                              )}
                          </div>
                          <p className="text-xs font-semibold text-gray-800 truncate" title={book.titulo}>{book.titulo}</p>
                          <p className="text-[10px] text-gray-500 truncate">{book.autor}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Main Catalog Header - Unified Search */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <h2 className="text-xl font-bold flex items-center gap-2"><BookOpen className="text-indigo-600"/> Catálogo Completo</h2>
        <div className="flex flex-1 w-full md:w-auto gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                <Input 
                    placeholder="Pesquisar por Título ou Autor..." 
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                    className="pl-10 w-full" 
                />
            </div>
            <div className="w-full md:w-64">
                <Select 
                    options={[{value: '', label: 'Todos os Gêneros'}, ...uniqueGenres.map(g => ({value: g, label: g}))]} 
                    value={genreFilter} 
                    onChange={e => { setGenreFilter(e.target.value); setCurrentPage(1); }} 
                />
            </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
          <div className="text-center py-12">Carregando...</div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {books.map(book => (
                  <Card key={book.id} onClick={() => handleOpenBook(book)} className="flex flex-col h-full hover:border-indigo-300 cursor-pointer">
                      <div className="h-48 bg-gray-100 relative overflow-hidden group">
                          {book.capa_url ? (
                              <img src={book.capa_url} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl font-bold">{book.titulo[0]}</div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold">
                              Ver Detalhes
                          </div>
                          {/* Rating Overlay */}
                          {book.rating !== undefined && book.rating > 0 && (
                             <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                                <span className="text-xs font-bold text-gray-700">{book.rating.toFixed(1)}</span>
                             </div>
                          )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                          <h3 className="font-bold text-gray-900 line-clamp-1" title={book.titulo}>{book.titulo}</h3>
                          <p className="text-sm text-gray-500 mb-2 truncate">{book.autor}</p>
                          
                          {/* Rating in Card Body */}
                          <div className="mb-3 flex items-center gap-1">
                             {book.ratingCount && book.ratingCount > 0 ? (
                                <>
                                  <div className="flex">
                                    {[1,2,3,4,5].map(star => (
                                        <Star 
                                            key={star} 
                                            size={12} 
                                            className={`${star <= Math.round(book.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} 
                                        />
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-gray-400 ml-1">({book.ratingCount})</span>
                                </>
                             ) : (
                                <span className="text-[10px] text-gray-400">Sem avaliações</span>
                             )}
                          </div>

                          <div className="mt-auto flex justify-between items-center">
                              <Badge variant="default">{book.genero}</Badge>
                              {book.quantidade_disponivel > 0 ? 
                                <Badge variant="success">Disponível</Badge> : 
                                <Badge variant="danger">Indisponível</Badge>
                              }
                          </div>
                      </div>
                  </Card>
              ))}
          </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-8">
          <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16}/></Button>
          <span className="flex items-center px-4 font-medium text-gray-600">Página {currentPage} de {totalPages}</span>
          <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16}/></Button>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedBook?.titulo || 'Detalhes'}>
          {selectedBook && (
              <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                      <div className="w-32 h-48 bg-gray-100 rounded flex-shrink-0 overflow-hidden shadow-sm mx-auto sm:mx-0">
                          {selectedBook.capa_url ? (
                              <img src={selectedBook.capa_url} className="w-full h-full object-cover"/>
                          ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold text-4xl">{selectedBook.titulo[0]}</div>
                          )}
                      </div>
                      <div className="space-y-3 flex-1">
                          <div>
                              <p className="text-xs text-gray-500 uppercase font-semibold">Autor</p>
                              <p className="text-gray-900 text-lg">{selectedBook.autor}</p>
                          </div>
                          
                          {/* Rating Detail */}
                          <div>
                             <p className="text-xs text-gray-500 uppercase font-semibold">Avaliação</p>
                             <div className="flex items-center gap-2">
                                <div className="flex">
                                    {[1,2,3,4,5].map(star => (
                                        <Star 
                                            key={star} 
                                            size={16} 
                                            className={`${star <= Math.round(selectedBook.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} 
                                        />
                                    ))}
                                </div>
                                <span className="text-sm font-bold text-gray-700">{selectedBook.rating ? selectedBook.rating.toFixed(1) : 'N/A'}</span>
                                <span className="text-sm text-gray-400">({selectedBook.ratingCount || 0} avaliações)</span>
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <p className="text-xs text-gray-500 uppercase font-semibold">Editora</p>
                                  <p className="text-gray-900">{selectedBook.editora || '-'}</p>
                              </div>
                              <div>
                                  <p className="text-xs text-gray-500 uppercase font-semibold">Gênero</p>
                                  <p className="text-gray-900">{selectedBook.genero || '-'}</p>
                              </div>
                          </div>
                          <div>
                              <p className="text-xs text-gray-500 uppercase font-semibold">Status</p>
                              <div className="flex items-center gap-2">
                                  {selectedBook.quantidade_disponivel > 0 ? (
                                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                                          <CheckCircle size={16} /> Disponível
                                      </span>
                                  ) : (
                                      <span className="font-bold text-rose-600 flex items-center gap-1">
                                          <AlertCircle size={16} /> Indisponível (Sem estoque)
                                      </span>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-b border-gray-100 pb-6">
                      {/* Hide borrow button for Professors completely */}
                      {user?.tipo === 'professor' ? null : (
                          selectedBook.quantidade_disponivel > 0 ? (
                            <Button onClick={() => setIsBorrowModalOpen(true)} className="flex-1 justify-center">
                                Solicitar Empréstimo
                            </Button>
                          ) : (
                              user?.tipo === 'aluno' ? (
                                  isAlreadyInQueue ? (
                                      <Button variant="success" disabled className="flex-1 justify-center opacity-80 cursor-not-allowed">
                                          <CheckCircle size={16} className="mr-2" /> Você está na fila
                                      </Button>
                                  ) : (
                                      <Button 
                                        variant="warning" 
                                        onClick={handleJoinWaitlist}
                                        className="flex-1 justify-center bg-amber-500 hover:bg-amber-600 text-white"
                                        isLoading={processing}
                                      >
                                          <UserPlus size={16} className="mr-2" /> Entrar na Fila de Espera
                                      </Button>
                                  )
                              ) : (
                                  <Button disabled variant="secondary" className="flex-1 justify-center opacity-50 cursor-not-allowed">
                                      Indisponível (Fila apenas para alunos)
                                  </Button>
                              )
                          )
                      )}
                      <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Fechar</Button>
                  </div>

                  {/* Comments Section */}
                  <div>
                      <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                          <MessageSquare size={18} className="text-indigo-600" />
                          Comentários de Alunos
                      </h3>
                      
                      <div className="bg-gray-50 rounded-xl p-4 max-h-48 overflow-y-auto space-y-3">
                          {loadingComments ? (
                              <div className="text-center text-gray-400 text-sm py-2">Carregando avaliações...</div>
                          ) : bookComments.length === 0 ? (
                              <div className="text-center text-gray-400 text-sm py-2">Nenhum comentário aprovado para este livro ainda.</div>
                          ) : (
                              bookComments.map(comment => (
                                  <div key={comment.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                      <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                                                  {comment.aluno?.nome?.charAt(0) || 'U'}
                                              </div>
                                              <span className="text-xs font-bold text-gray-700">{comment.aluno?.nome}</span>
                                          </div>
                                          <span className="text-[10px] text-gray-400">{new Date(comment.data_comentario).toLocaleDateString()}</span>
                                      </div>
                                      <p className="text-sm text-gray-600 italic">"{comment.comentario}"</p>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          )}
      </Modal>

      {/* Borrow Confirmation Modal */}
      <Modal isOpen={isBorrowModalOpen} onClose={() => setIsBorrowModalOpen(false)} title="Confirmar Solicitação">
          <div className="space-y-4">
              <div className="flex items-center gap-4 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                  <div className="h-16 w-12 bg-white rounded overflow-hidden shadow-sm">
                      {selectedBook?.capa_url ? (
                          <img src={selectedBook.capa_url} className="w-full h-full object-cover"/>
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-indigo-300 font-bold">{selectedBook?.titulo[0]}</div>
                      )}
                  </div>
                  <div>
                      <p className="font-bold text-indigo-900">{selectedBook?.titulo}</p>
                      <p className="text-sm text-indigo-700">{selectedBook?.autor}</p>
                  </div>
              </div>
              
              <Select 
                  label="Duração do Empréstimo"
                  value={loanDuration}
                  onChange={e => setLoanDuration(e.target.value)}
                  options={[
                      {value: '7', label: '7 Dias'},
                      {value: '15', label: '15 Dias'},
                      {value: '30', label: '30 Dias'}
                  ]}
              />
              
              <div className="bg-gray-50 p-3 rounded text-sm text-gray-600 flex justify-between items-center">
                  <span>Devolução prevista:</span>
                  <span className="font-bold text-gray-900">
                      {new Date(Date.now() + parseInt(loanDuration) * 86400000).toLocaleDateString()}
                  </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setIsBorrowModalOpen(false)}>Cancelar</Button>
                  <Button onClick={handleBorrowRequest} isLoading={processing}>Confirmar</Button>
              </div>
          </div>
      </Modal>
    </div>
  );
};
