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

export interface EmprestimoDoUsuario {
  codigoLivro: string;
  titulo: string;
  codigoExemplar: string;
  dataEmprestimo: string;
  dataLimite: string;
  atrasado: boolean;
}

export interface EmprestimoDoLivro {
  codigoUsuario: string;
  nomeUsuario: string;
  codigoExemplar: string;
  dataEmprestimo: string;
  /** Vazia enquanto o Empréstimo está ativo. */
  dataDevolucao: string;
}

/** Dias que um Exemplar pode ficar com o Usuário sem Atraso. */
export const PRAZO_EM_DIAS = 7;

/** Máximo de Empréstimos ativos por Usuário. */
export const LIMITE_DE_EMPRESTIMOS = 3;

const SELECT_LIVRO = `
  SELECT livro.codigo, livro.titulo, livro.autor,
         COUNT(exemplar.codigo) AS total,
         COUNT(exemplar.codigo) - COUNT(ativo.id) AS disponiveis
  FROM livro
  LEFT JOIN exemplar ON exemplar.codigo_livro = livro.codigo
  LEFT JOIN emprestimo_ativo ativo ON ativo.codigo_exemplar = exemplar.codigo
`;

/** Regras de negócio da biblioteca, independentes do transporte (gRPC). */
export class Biblioteca {
  constructor(
    private readonly db: Db,
    private readonly relogio: Relogio,
  ) {}

  listarUsuarios(): Usuario[] {
    return this.db.prepare("SELECT codigo, nome FROM usuario ORDER BY codigo").all() as Usuario[];
  }

  listarLivros(): Livro[] {
    return this.db
      .prepare(`${SELECT_LIVRO} GROUP BY livro.codigo ORDER BY livro.codigo`)
      .all() as Livro[];
  }

  consultarLivro(codigoLivro: string): { livro: Livro; exemplares: Exemplar[] } {
    const livro = this.buscarLivro(codigoLivro);
    const exemplares = this.db
      .prepare(
        `SELECT exemplar.codigo,
                ativo.id IS NULL AS disponivel,
                COALESCE(usuario.codigo, '') AS codigoUsuario,
                COALESCE(usuario.nome, '') AS nomeUsuario,
                COALESCE(ativo.data_emprestimo, '') AS dataEmprestimo
         FROM exemplar
         LEFT JOIN emprestimo_ativo ativo ON ativo.codigo_exemplar = exemplar.codigo
         LEFT JOIN usuario ON usuario.codigo = ativo.codigo_usuario
         WHERE exemplar.codigo_livro = ?
         ORDER BY exemplar.numero`,
      )
      .all(codigoLivro) as (Omit<Exemplar, "disponivel"> & { disponivel: number })[];
    return { livro, exemplares: exemplares.map((e) => ({ ...e, disponivel: e.disponivel === 1 })) };
  }

  realizarEmprestimo(codigoUsuario: string, codigoLivro: string, dataEmprestimo: string) {
    const emprestar = this.db.transaction(() => {
      this.buscarUsuario(codigoUsuario);
      this.buscarLivro(codigoLivro);
      if (!ehDataValida(dataEmprestimo) || dataEmprestimo > this.relogio()) {
        throw argumentoInvalido("Data inválida");
      }
      if (this.emprestimoAtivo(codigoUsuario, codigoLivro)) {
        throw precondicao("Usuário já possui um exemplar deste livro");
      }
      if (this.contarEmprestimosAtivos(codigoUsuario) >= LIMITE_DE_EMPRESTIMOS) {
        throw precondicao("Usuário com limite de empréstimos atingido");
      }
      // Exemplar disponível de menor número (L001-2 antes de L001-10).
      const exemplar = this.db
        .prepare(
          `SELECT exemplar.codigo FROM exemplar
           LEFT JOIN emprestimo_ativo ativo ON ativo.codigo_exemplar = exemplar.codigo
           WHERE exemplar.codigo_livro = ? AND ativo.id IS NULL
           ORDER BY exemplar.numero LIMIT 1`,
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
        const jaTeveEmprestimo = this.db
          .prepare(
            `SELECT 1 FROM emprestimo JOIN exemplar ON exemplar.codigo = emprestimo.codigo_exemplar
             WHERE emprestimo.codigo_usuario = ? AND exemplar.codigo_livro = ?`,
          )
          .get(codigoUsuario, codigoLivro);
        throw jaTeveEmprestimo
          ? precondicao("Livro já devolvido")
          : naoEncontrado("Empréstimo não encontrado");
      }
      const dataDevolucao = this.relogio();
      this.db.prepare("UPDATE emprestimo SET data_devolucao = ? WHERE id = ?").run(dataDevolucao, ativo.id);
      return { codigoExemplar: ativo.codigoExemplar, dataDevolucao };
    });
    return devolver();
  }

  consultarEmprestimosUsuario(codigoUsuario: string): EmprestimoDoUsuario[] {
    this.buscarUsuario(codigoUsuario);
    const ativos = this.db
      .prepare(
        `SELECT livro.codigo AS codigoLivro, livro.titulo, exemplar.codigo AS codigoExemplar,
                ativo.data_emprestimo AS dataEmprestimo
         FROM emprestimo_ativo ativo
         JOIN exemplar ON exemplar.codigo = ativo.codigo_exemplar
         JOIN livro ON livro.codigo = exemplar.codigo_livro
         WHERE ativo.codigo_usuario = ?
         ORDER BY ativo.data_emprestimo, exemplar.codigo`,
      )
      .all(codigoUsuario) as Omit<EmprestimoDoUsuario, "dataLimite" | "atrasado">[];
    const hoje = this.relogio();
    return ativos.map((emprestimo) => {
      const dataLimite = somarDias(emprestimo.dataEmprestimo, PRAZO_EM_DIAS);
      return { ...emprestimo, dataLimite, atrasado: hoje > dataLimite };
    });
  }

  consultarEmprestimosLivro(codigoLivro: string): EmprestimoDoLivro[] {
    this.buscarLivro(codigoLivro);
    return this.db
      .prepare(
        `SELECT usuario.codigo AS codigoUsuario, usuario.nome AS nomeUsuario,
                exemplar.codigo AS codigoExemplar, emprestimo.data_emprestimo AS dataEmprestimo,
                COALESCE(emprestimo.data_devolucao, '') AS dataDevolucao
         FROM emprestimo
         JOIN exemplar ON exemplar.codigo = emprestimo.codigo_exemplar
         JOIN usuario ON usuario.codigo = emprestimo.codigo_usuario
         WHERE exemplar.codigo_livro = ?
         ORDER BY emprestimo.data_emprestimo DESC, emprestimo.id DESC`,
      )
      .all(codigoLivro) as EmprestimoDoLivro[];
  }

  private buscarUsuario(codigoUsuario: string): Usuario {
    const usuario = this.db
      .prepare("SELECT codigo, nome FROM usuario WHERE codigo = ?")
      .get(codigoUsuario) as Usuario | undefined;
    if (!usuario) throw naoEncontrado("Usuário não encontrado");
    return usuario;
  }

  private buscarLivro(codigoLivro: string): Livro {
    const livro = this.db
      .prepare(`${SELECT_LIVRO} WHERE livro.codigo = ? GROUP BY livro.codigo`)
      .get(codigoLivro) as Livro | undefined;
    if (!livro) throw naoEncontrado("Livro não encontrado");
    return livro;
  }

  /** O Empréstimo ativo do Usuário para algum Exemplar do Livro, se houver. */
  private emprestimoAtivo(codigoUsuario: string, codigoLivro: string) {
    return this.db
      .prepare(
        `SELECT ativo.id, ativo.codigo_exemplar AS codigoExemplar
         FROM emprestimo_ativo ativo JOIN exemplar ON exemplar.codigo = ativo.codigo_exemplar
         WHERE ativo.codigo_usuario = ? AND exemplar.codigo_livro = ?`,
      )
      .get(codigoUsuario, codigoLivro) as { id: number; codigoExemplar: string } | undefined;
  }

  private contarEmprestimosAtivos(codigoUsuario: string): number {
    const { total } = this.db
      .prepare("SELECT COUNT(*) AS total FROM emprestimo_ativo WHERE codigo_usuario = ?")
      .get(codigoUsuario) as { total: number };
    return total;
  }
}
