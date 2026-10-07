import { status } from "@grpc/grpc-js";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { criarCliente, type ClienteBiblioteca } from "../src/client/cliente.js";
import type { DadosIniciais } from "../src/server/dados.js";
import { certificadoDeTeste, esperarErro, HOJE, iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente | undefined;
let cliente: ClienteBiblioteca | undefined;
afterEach(async () => {
  cliente?.fechar();
  cliente = undefined;
  await ambiente?.encerrar();
  ambiente = undefined;
});

const acervo: Partial<DadosIniciais> = {
  usuarios: [{ codigo: "U001", nome: "Ana" }],
  livros: [{ codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 2 }],
};

/** Uma porta livre agora, para subir o servidor nela depois. */
function portaLivre(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

describe("novas tentativas", () => {
  it("a chamada dá certo se o servidor subir logo depois", async () => {
    const porta = await portaLivre();
    cliente = criarCliente(`127.0.0.1:${porta}`, { certificado: (await certificadoDeTeste()).certificado });

    const chamada = cliente.obterHoje();
    await new Promise((r) => setTimeout(r, 500));
    ambiente = await iniciarTeste({}, HOJE, { porta });

    await expect(chamada).resolves.toEqual({ data: HOJE });
  });
});

describe("idempotência", () => {
  it("RealizarEmprestimo repetido com a mesma chave devolve a mesma resposta sem emprestar de novo", async () => {
    ambiente = await iniciarTeste(acervo);
    const opcoes = { chaveIdempotencia: "emprestimo-1" };

    const primeira = await ambiente.cliente.realizarEmprestimo("U001", "L001", HOJE, opcoes);
    const repetida = await ambiente.cliente.realizarEmprestimo("U001", "L001", HOJE, opcoes);

    expect(repetida).toEqual(primeira);
    const { emprestimos } = await ambiente.cliente.consultarEmprestimosUsuario("U001");
    expect(emprestimos).toHaveLength(1);
  });

  it("DevolverLivro repetido com a mesma chave não vira 'Livro já devolvido'", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [{ usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-10-18" }],
    });
    const opcoes = { chaveIdempotencia: "devolucao-1" };

    const primeira = await ambiente.cliente.devolverLivro("U001", "L001", opcoes);
    const repetida = await ambiente.cliente.devolverLivro("U001", "L001", opcoes);

    expect(repetida).toEqual(primeira);
  });

  it("sem a mesma chave, repetir é uma operação nova (e as regras valem)", async () => {
    ambiente = await iniciarTeste(acervo);
    await ambiente.cliente.realizarEmprestimo("U001", "L001", HOJE);

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L001", HOJE),
      status.FAILED_PRECONDITION,
      "Usuário já possui um exemplar deste livro",
    );
  });

  it("recusa reaproveitar uma chave em outra operação", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [{ usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-10-18" }],
    });
    await ambiente.cliente.devolverLivro("U001", "L001", { chaveIdempotencia: "chave-x" });

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L001", HOJE, { chaveIdempotencia: "chave-x" }),
      status.INVALID_ARGUMENT,
      "Chave de idempotência já usada em outra operação",
    );
  });
});
