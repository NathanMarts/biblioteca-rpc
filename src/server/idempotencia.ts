import type { Db } from "./db.js";
import { argumentoInvalido } from "./erros.js";

/** Por quanto tempo uma resposta fica guardada para repetições da mesma chave. */
export const RETENCAO_MS = 24 * 60 * 60 * 1000;

/**
 * Garante que uma operação que altera dados seja aplicada uma única vez por chave de
 * idempotência: se o cliente repetir a chamada (ex.: a resposta se perdeu na rede e houve
 * nova tentativa), recebe a resposta guardada em vez de executar de novo.
 */
export class Idempotencia {
  constructor(
    private readonly db: Db,
    private readonly agora: () => number,
  ) {}

  executar<T>(chave: string | undefined, metodo: string, operacao: () => T): T {
    if (!chave) return operacao();
    const executarUmaVez = this.db.transaction(() => {
      this.db.prepare("DELETE FROM idempotencia WHERE criada_em < ?").run(this.agora() - RETENCAO_MS);
      const anterior = this.db
        .prepare("SELECT metodo, resposta FROM idempotencia WHERE chave = ?")
        .get(chave) as { metodo: string; resposta: string } | undefined;
      if (anterior) {
        if (anterior.metodo !== metodo) {
          throw argumentoInvalido("Chave de idempotência já usada em outra operação");
        }
        return JSON.parse(anterior.resposta) as T;
      }
      // Se a operação falhar, a transação desfaz tudo e nada é guardado: repetir dá o mesmo erro.
      const resposta = operacao();
      this.db
        .prepare("INSERT INTO idempotencia (chave, metodo, resposta, criada_em) VALUES (?, ?, ?, ?)")
        .run(chave, metodo, JSON.stringify(resposta), this.agora());
      return resposta;
    });
    return executarUmaVez.immediate();
  }
}
