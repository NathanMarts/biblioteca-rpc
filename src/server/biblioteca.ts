import type { Db } from "./db.js";
import { naoEncontrado } from "./erros.js";
import type { Relogio } from "./relogio.js";

export interface Usuario {
  codigo: string;
  nome: string;
}

export interface Livro {
  codigo: string;
  titulo: string;
  autor: string;
  disponiveis: number;
  total: number;
}

export interface Exemplar {
  codigo: string;
  disponivel: boolean;
  codigoUsuario: string;
  nomeUsuario: string;
  dataEmprestimo: string;
}

const SELECT_LIVRO = `
  SELECT l.codigo, l.titulo, l.autor,
         COUNT(e.codigo) AS total,
         COUNT(e.codigo) - COUNT(ativo.id) AS disponiveis
  FROM livro l
  JOIN exemplar e ON e.codigo_livro = l.codigo
  LEFT JOIN emprestimo ativo ON ativo.codigo_exemplar = e.codigo AND ativo.data_devolucao IS NULL
`;

/** Regras de negócio da biblioteca, independentes do transporte (gRPC). */
export class Biblioteca {
  constructor(
    private readonly db: Db,
    private readonly hoje: Relogio,
  ) {}

  listarUsuarios(): Usuario[] {
    return this.db.prepare("SELECT codigo, nome FROM usuario ORDER BY codigo").all() as Usuario[];
  }

  listarLivros(): Livro[] {
    return this.db
      .prepare(`${SELECT_LIVRO} GROUP BY l.codigo ORDER BY l.codigo`)
      .all() as Livro[];
  }

  consultarLivro(codigoLivro: string): { livro: Livro; exemplares: Exemplar[] } {
    const livro = this.buscarLivro(codigoLivro);
    const exemplares = this.db
      .prepare(
        `SELECT e.codigo,
                ativo.id IS NULL AS disponivel,
                COALESCE(u.codigo, '') AS codigoUsuario,
                COALESCE(u.nome, '') AS nomeUsuario,
                COALESCE(ativo.data_emprestimo, '') AS dataEmprestimo
         FROM exemplar e
         LEFT JOIN emprestimo ativo ON ativo.codigo_exemplar = e.codigo AND ativo.data_devolucao IS NULL
         LEFT JOIN usuario u ON u.codigo = ativo.codigo_usuario
         WHERE e.codigo_livro = ?
         ORDER BY e.numero`,
      )
      .all(codigoLivro) as (Omit<Exemplar, "disponivel"> & { disponivel: number })[];
    return { livro, exemplares: exemplares.map((e) => ({ ...e, disponivel: e.disponivel === 1 })) };
  }

  private buscarLivro(codigoLivro: string): Livro {
    const livro = this.db
      .prepare(`${SELECT_LIVRO} WHERE l.codigo = ? GROUP BY l.codigo`)
      .get(codigoLivro) as Livro | undefined;
    if (!livro) throw naoEncontrado("Livro não encontrado");
    return livro;
  }
}
