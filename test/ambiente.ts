import { criarCliente, type ClienteBiblioteca } from "../src/client/cliente.js";
import type { DadosIniciais } from "../src/server/dados.js";
import { relogioFixo } from "../src/server/relogio.js";
import { iniciarServidor } from "../src/server/servidor.js";

export const HOJE = "2026-10-20";

export interface Ambiente {
  cliente: ClienteBiblioteca;
  encerrar(): Promise<void>;
}

/** Sobe um servidor real em porta aleatória, com banco em memória e "hoje" fixo. */
export async function iniciarTeste(
  dados: Partial<DadosIniciais> = {},
  hoje: string = HOJE,
): Promise<Ambiente> {
  const servidor = await iniciarServidor({
    banco: ":memory:",
    host: "127.0.0.1",
    porta: 0,
    relogio: relogioFixo(hoje),
    dadosIniciais: { usuarios: [], livros: [], emprestimos: [], ...dados },
    log: false,
  });
  const cliente = criarCliente(servidor.endereco);
  return {
    cliente,
    async encerrar() {
      cliente.fechar();
      await servidor.encerrar();
    },
  };
}
