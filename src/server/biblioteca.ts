import type { Db } from "./db.js";
import type { Relogio } from "./relogio.js";

export interface Usuario {
  codigo: string;
  nome: string;
}

/** Regras de negócio da biblioteca, independentes do transporte (gRPC). */
export class Biblioteca {
  constructor(
    private readonly db: Db,
    private readonly hoje: Relogio,
  ) {}

  listarUsuarios(): Usuario[] {
    return this.db.prepare("SELECT codigo, nome FROM usuario ORDER BY codigo").all() as Usuario[];
  }
}
