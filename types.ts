
export type UserType = 'aluno' | 'bibliotecario' | 'professor';

export interface User {
  id: number | string;
  nome: string;
  email: string;
  tipo: UserType;
  foto_perfil_url?: string;
  turma?: string; // Aluno/Professor
  matricula?: string; // Aluno
  masp?: string; // Bibliotecario
  bio?: string;
  localizacao?: string;
  turno?: string; // Bibliotecario
  status?: string;
  senha?: string;
}

export interface Book {
  id: number;
  titulo: string;
  autor: string;
  genero: string;
  editora?: string;
  quantidade_total: number;
  quantidade_disponivel: number;
  capa_url?: string;
  localizacao?: string;
  ano_publicacao?: string;
  paginas?: string;
  descricao?: string;
}

export interface Loan {
  id: number;
  id_livro: number;
  matricula_aluno: string; // In table 'emprestimo', sometimes mapped to student ID depending on schema
  data_emprestimo: string;
  devolutiva: string;
  data_devolucao_real?: string;
  status: 'solicitado' | 'aprovado' | 'rejeitado' | 'concluido' | 'pendente';
  bibliotecaria?: string; // Name of the person who approved/received
  livros?: Book;
  aluno?: {
    nome: string;
    matricula: string;
    turma: string;
  };
}

export interface Comment {
  id: number;
  id_livro: number;
  matricula_aluno: string;
  comentario: string;
  data_comentario: string;
  // Refactored to match DB schema: aprovado boolean (null=pending, true=approved, false=rejected)
  aprovado: boolean | null; 
  avaliacao?: number;
  livros?: Book;
  aluno?: {
    nome: string;
  };
}

export interface WaitlistEntry {
  id: number;
  id_livro: number;
  matricula_aluno: string;
  data_entrada: string;
}