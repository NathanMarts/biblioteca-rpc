/** Conteúdo carregado no banco quando ele está vazio. */
export interface DadosIniciais {
  /** Quem opera o balcão; a senha é guardada só como hash. */
  bibliotecarios: { login: string; nome: string; senha: string }[];
  usuarios: { codigo: string; nome: string }[];
  /** Cada Livro recebe `exemplares` Exemplares, com códigos `<livro>-1`, `<livro>-2`, ... */
  livros: { codigo: string; titulo: string; autor: string; exemplares: number }[];
  emprestimos: {
    usuario: string;
    exemplar: string;
    dataEmprestimo: string;
    dataDevolucao?: string;
  }[];
}
