import Database from "better-sqlite3";
import type { DadosIniciais } from "./dados.js";
import { gerarHashDeSenha } from "./senhas.js";

export type Db = Database.Database;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS bibliotecario (
    login      TEXT PRIMARY KEY,
    nome       TEXT NOT NULL,
    senha_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessao (
    token     TEXT PRIMARY KEY,
    login     TEXT NOT NULL REFERENCES bibliotecario(login),
    expira_em INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS idempotencia (
    chave     TEXT PRIMARY KEY,
    metodo    TEXT NOT NULL,
    resposta  TEXT NOT NULL,
    criada_em INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS usuario (
    codigo TEXT PRIMARY KEY,
    nome   TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS livro (
    codigo TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    autor  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exemplar (
    codigo       TEXT PRIMARY KEY,
    codigo_livro TEXT NOT NULL REFERENCES livro(codigo),
    numero       INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS emprestimo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_exemplar TEXT NOT NULL REFERENCES exemplar(codigo),
    codigo_usuario  TEXT NOT NULL REFERENCES usuario(codigo),
    data_emprestimo TEXT NOT NULL,
    data_devolucao  TEXT
  );
  -- Um Empréstimo é ativo enquanto não tem data de Devolução.
  CREATE VIEW IF NOT EXISTS emprestimo_ativo AS
    SELECT * FROM emprestimo WHERE data_devolucao IS NULL;
  -- Garantia no próprio banco: um Exemplar tem no máximo um Empréstimo ativo.
  CREATE UNIQUE INDEX IF NOT EXISTS um_emprestimo_ativo_por_exemplar
    ON emprestimo (codigo_exemplar) WHERE data_devolucao IS NULL;
`;

/** Abre o banco (arquivo ou ":memory:"), cria o schema e carrega os dados iniciais se estiver vazio. */
export function abrirBanco(caminho: string, dadosIniciais: DadosIniciais): Db {
  const db = new Database(caminho);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Outro processo com o mesmo arquivo segurando a escrita: espera até 5 s em vez de falhar.
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  if (estaVazio(db)) carregarDados(db, dadosIniciais);
  return db;
}

function estaVazio(db: Db): boolean {
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM usuario").get() as { total: number };
  return total === 0;
}

function carregarDados(db: Db, dados: DadosIniciais): void {
  const inserirBibliotecario = db.prepare(
    "INSERT INTO bibliotecario (login, nome, senha_hash) VALUES (?, ?, ?)",
  );
  const inserirUsuario = db.prepare("INSERT INTO usuario (codigo, nome) VALUES (?, ?)");
  const inserirLivro = db.prepare("INSERT INTO livro (codigo, titulo, autor) VALUES (?, ?, ?)");
  const inserirExemplar = db.prepare(
    "INSERT INTO exemplar (codigo, codigo_livro, numero) VALUES (?, ?, ?)",
  );
  const inserirEmprestimo = db.prepare(
    `INSERT INTO emprestimo (codigo_exemplar, codigo_usuario, data_emprestimo, data_devolucao)
     VALUES (?, ?, ?, ?)`,
  );
  db.transaction(() => {
    for (const b of dados.bibliotecarios) inserirBibliotecario.run(b.login, b.nome, gerarHashDeSenha(b.senha));
    for (const u of dados.usuarios) inserirUsuario.run(u.codigo, u.nome);
    for (const l of dados.livros) {
      inserirLivro.run(l.codigo, l.titulo, l.autor);
      for (let n = 1; n <= l.exemplares; n++) inserirExemplar.run(`${l.codigo}-${n}`, l.codigo, n);
    }
    for (const e of dados.emprestimos) {
      inserirEmprestimo.run(e.exemplar, e.usuario, e.dataEmprestimo, e.dataDevolucao ?? null);
    }
  })();
}
