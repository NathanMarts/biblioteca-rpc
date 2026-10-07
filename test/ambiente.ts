import { status } from "@grpc/grpc-js";
import { expect } from "vitest";
import { criarCliente, type ClienteBiblioteca } from "../src/client/cliente.js";
import type { DadosIniciais } from "../src/server/dados.js";
import { relogioFixo } from "../src/server/relogio.js";
import { iniciarServidor } from "../src/server/servidor.js";

export const HOJE = "2026-10-20";

const BIBLIOTECARIO_PADRAO = { login: "teste", nome: "Bibliotecário de Teste", senha: "senha-teste" };

export interface Ambiente {
  /** Cliente já autenticado com o primeiro bibliotecário dos dados. */
  cliente: ClienteBiblioteca;
  /** Cria um cliente sem login, encerrado junto com o ambiente. */
  novoCliente(): ClienteBiblioteca;
  encerrar(): Promise<void>;
}

/** Sobe um servidor real em porta aleatória, com banco em memória e "hoje" fixo. */
export async function iniciarTeste(
  dados: Partial<DadosIniciais> = {},
  hoje: string = HOJE,
  opcoes: { agora?: () => number } = {},
): Promise<Ambiente> {
  const bibliotecarios = dados.bibliotecarios ?? [BIBLIOTECARIO_PADRAO];
  const servidor = await iniciarServidor({
    banco: ":memory:",
    host: "127.0.0.1",
    porta: 0,
    relogio: relogioFixo(hoje),
    agora: opcoes.agora,
    dadosIniciais: { usuarios: [], livros: [], emprestimos: [], ...dados, bibliotecarios },
    log: false,
  });
  const clientes: ClienteBiblioteca[] = [];
  const novoCliente = () => {
    const cliente = criarCliente(servidor.endereco);
    clientes.push(cliente);
    return cliente;
  };
  const cliente = novoCliente();
  if (bibliotecarios.length > 0) await cliente.entrar(bibliotecarios[0].login, bibliotecarios[0].senha);
  return {
    cliente,
    novoCliente,
    async encerrar() {
      for (const c of clientes) c.fechar();
      await servidor.encerrar();
    },
  };
}

/** Verifica que a chamada falhou com o status gRPC e a mensagem esperados. */
export async function esperarErro(chamada: Promise<unknown>, codigo: status, mensagem: string) {
  await expect(chamada).rejects.toMatchObject({ code: codigo, details: mensagem });
}
