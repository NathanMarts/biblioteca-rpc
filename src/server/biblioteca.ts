import { Situacao } from "../generated/biblioteca.js";
import type { Db } from "./db.js";
import { ehDataValida, somarDias } from "./datas.js";
import { argumentoInvalido, naoEncontrado, precondicao } from "./erros.js";
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

/** Dias que um Exemplar pode ficar com o Usuário sem Atraso. */
export const PRAZO_EM_DIAS = 7;

/** Máximo de Empréstimos ativos por Usuário. */
export const LIMITE_DE_EMPRESTIMOS = 3;

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

  realizarEmprestimo(codigoUsuario: string, codigoLivro: string, dataEmprestimo: string) {
    const emprestar = this.db.transaction(() => {
      this.buscarUsuario(codigoUsuario);
      this.buscarLivro(codigoLivro);
      if (!ehDataValida(dataEmprestimo) || dataEmprestimo > this.hoje()) {
        throw argumentoInvalido("Data inválida");
      }
      if (this.emprestimoAtivo(codigoUsuario, codigoLivro)) {
        throw precondicao("Usuário já possui um exemplar deste livro");
      }
      if (this.contarEmprestimosAtivos(codigoUsuario) >= LIMITE_DE_EMPRESTIMOS) {
        throw precondicao("Usuário com limite de empréstimos atingido");
      }
      const exemplar = this.db
        .prepare(
          `SELECT e.codigo FROM exemplar e
           WHERE e.codigo_livro = ?
             AND NOT EXISTS (SELECT 1 FROM emprestimo a
                             WHERE a.codigo_exemplar = e.codigo AND a.data_devolucao IS NULL)
           ORDER BY e.numero LIMIT 1`,
        )
        .get(codigoLivro) as { codigo: string } | undefined;
      if (!exemplar) throw precondicao("Livro indisponível");
      this.db
        .prepare(
          "INSERT INTO emprestimo (codigo_exemplar, codigo_usuario, data_emprestimo) VALUES (?, ?, ?)",
        )
        .run(exemplar.codigo, codigoUsuario, dataEmprestimo);
      return {
        codigoExemplar: exemplar.codigo,
        dataEmprestimo,
        dataLimite: somarDias(dataEmprestimo, PRAZO_EM_DIAS),
      };
    });
    return emprestar();
  }

  devolverLivro(codigoUsuario: string, codigoLivro: string) {
    const devolver = this.db.transaction(() => {
      this.buscarUsuario(codigoUsuario);
      this.buscarLivro(codigoLivro);
      const ativo = this.emprestimoAtivo(codigoUsuario, codigoLivro);
      if (!ativo) {
        const jaTeve = this.db
          .prepare(
            `SELECT 1 FROM emprestimo a JOIN exemplar e ON e.codigo = a.codigo_exemplar
             WHERE a.codigo_usuario = ? AND e.codigo_livro = ?`,
          )
          .get(codigoUsuario, codigoLivro);
        throw jaTeve ? precondicao("Livro já devolvido") : naoEncontrado("Empréstimo não encontrado");
      }
      const dataDevolucao = this.hoje();
      this.db.prepare("UPDATE emprestimo SET data_devolucao = ? WHERE id = ?").run(dataDevolucao, ativo.id);
      return { codigoExemplar: ativo.codigoExemplar, dataDevolucao };
    });
    return devolver();
  }

  consultarEmprestimosUsuario(codigoUsuario: string) {
    this.buscarUsuario(codigoUsuario);
    const ativos = this.db
      .prepare(
        `SELECT l.codigo AS codigoLivro, l.titulo, e.codigo AS codigoExemplar,
                a.data_emprestimo AS dataEmprestimo
         FROM emprestimo a
         JOIN exemplar e ON e.codigo = a.codigo_exemplar
         JOIN livro l ON l.codigo = e.codigo_livro
         WHERE a.codigo_usuario = ? AND a.data_devolucao IS NULL
         ORDER BY a.data_emprestimo, e.codigo`,
      )
      .all(codigoUsuario) as { codigoLivro: string; titulo: string; codigoExemplar: string; dataEmprestimo: string }[];
    const hoje = this.hoje();
    return ativos.map((a) => {
      const dataLimite = somarDias(a.dataEmprestimo, PRAZO_EM_DIAS);
      return { ...a, dataLimite, situacao: hoje > dataLimite ? Situacao.ATRASADO : Situacao.NO_PRAZO };
    });
  }

  private buscarUsuario(codigoUsuario: string): Usuario {
    const usuario = this.db
      .prepare("SELECT codigo, nome FROM usuario WHERE codigo = ?")
      .get(codigoUsuario) as Usuario | undefined;
    if (!usuario) throw naoEncontrado("Usuário não encontrado");
    return usuario;
  }

  /** O Empréstimo ativo do Usuário para algum Exemplar do Livro, se houver. */
  private emprestimoAtivo(codigoUsuario: string, codigoLivro: string) {
    return this.db
      .prepare(
        `SELECT a.id, a.codigo_exemplar AS codigoExemplar
         FROM emprestimo a JOIN exemplar e ON e.codigo = a.codigo_exemplar
         WHERE a.codigo_usuario = ? AND e.codigo_livro = ? AND a.data_devolucao IS NULL`,
      )
      .get(codigoUsuario, codigoLivro) as { id: number; codigoExemplar: string } | undefined;
  }

  private contarEmprestimosAtivos(codigoUsuario: string): number {
    const { total } = this.db
      .prepare(
        "SELECT COUNT(*) AS total FROM emprestimo WHERE codigo_usuario = ? AND data_devolucao IS NULL",
      )
      .get(codigoUsuario) as { total: number };
    return total;
  }

  private buscarLivro(codigoLivro: string): Livro {
    const livro = this.db
      .prepare(`${SELECT_LIVRO} WHERE l.codigo = ? GROUP BY l.codigo`)
      .get(codigoLivro) as Livro | undefined;
    if (!livro) throw naoEncontrado("Livro não encontrado");
    return livro;
  }
}
