import { randomBytes } from "node:crypto";
import type { Db } from "./db.js";
import { naoAutenticado } from "./erros.js";
import { conferirSenha, HASH_FICTICIO } from "./senhas.js";

/** Por quanto tempo uma Sessão vale depois de Entrar. */
export const DURACAO_DA_SESSAO_MS = 8 * 60 * 60 * 1000;

export type Sessao =
  | { situacao: "valida"; login: string; nome: string }
  | { situacao: "expirada" }
  | { situacao: "inexistente" };

/** Login de Bibliotecários e validação de Sessões (tokens). */
export class Autenticacao {
  constructor(
    private readonly db: Db,
    /** Instante atual em ms; injetável para testar a expiração. */
    private readonly agora: () => number,
  ) {}

  entrar(login: string, senha: string) {
    const bibliotecario = this.db
      .prepare("SELECT login, nome, senha_hash AS senhaHash FROM bibliotecario WHERE login = ?")
      .get(login) as { login: string; nome: string; senhaHash: string } | undefined;
    // Confere a senha mesmo sem Bibliotecário, para não revelar pelo tempo quais logins existem.
    const senhaConfere = conferirSenha(senha, bibliotecario?.senhaHash ?? HASH_FICTICIO);
    if (!bibliotecario || !senhaConfere) throw naoAutenticado("Login ou senha inválidos");

    const token = randomBytes(32).toString("hex");
    const expiraEm = this.agora() + DURACAO_DA_SESSAO_MS;
    this.db
      .prepare("INSERT INTO sessao (token, login, expira_em) VALUES (?, ?, ?)")
      .run(token, login, expiraEm);
    return { token, nome: bibliotecario.nome, expiraEm: new Date(expiraEm).toISOString() };
  }

  validar(token: string): Sessao {
    const sessao = this.db
      .prepare(
        `SELECT bibliotecario.login, bibliotecario.nome, sessao.expira_em AS expiraEm
         FROM sessao JOIN bibliotecario ON bibliotecario.login = sessao.login
         WHERE sessao.token = ?`,
      )
      .get(token) as { login: string; nome: string; expiraEm: number } | undefined;
    if (!sessao) return { situacao: "inexistente" };
    if (this.agora() > sessao.expiraEm) return { situacao: "expirada" };
    return { situacao: "valida", login: sessao.login, nome: sessao.nome };
  }
}
