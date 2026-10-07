import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import type { DadosIniciais } from "../src/server/dados.js";
import { esperarErro, HOJE, iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

const acervo: Partial<DadosIniciais> = {
  usuarios: [
    { codigo: "U001", nome: "Ana" },
    { codigo: "U002", nome: "Bruno" },
  ],
  livros: [{ codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 2 }],
};

describe("DevolverLivro", () => {
  it("encerra o Empréstimo na data de hoje do servidor e libera o Exemplar", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [{ usuario: "U001", exemplar: "L001-2", dataEmprestimo: "2026-10-10" }],
    });

    const resposta = await ambiente.cliente.devolverLivro("U001", "L001");

    expect(resposta).toEqual({ codigoExemplar: "L001-2", dataDevolucao: HOJE });
    const { livro, exemplares } = await ambiente.cliente.consultarLivro("L001");
    expect(livro?.disponiveis).toBe(2);
    expect(exemplares.every((e) => e.disponivel)).toBe(true);
  });

  it("permite emprestar de novo o Exemplar devolvido", async () => {
    ambiente = await iniciarTeste({ ...acervo, livros: [{ ...acervo.livros![0], exemplares: 1 }] });
    await ambiente.cliente.realizarEmprestimo("U001", "L001", HOJE);
    await ambiente.cliente.devolverLivro("U001", "L001");

    const resposta = await ambiente.cliente.realizarEmprestimo("U002", "L001", HOJE);

    expect(resposta.codigoExemplar).toBe("L001-1");
  });

  it("recusa Usuário inexistente", async () => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(ambiente.cliente.devolverLivro("U999", "L001"), status.NOT_FOUND, "Usuário não encontrado");
  });

  it("recusa Livro inexistente", async () => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(ambiente.cliente.devolverLivro("U001", "L999"), status.NOT_FOUND, "Livro não encontrado");
  });

  it("informa que o Livro já foi devolvido", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [
        { usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-10-01", dataDevolucao: "2026-10-05" },
      ],
    });

    await esperarErro(
      ambiente.cliente.devolverLivro("U001", "L001"),
      status.FAILED_PRECONDITION,
      "Livro já devolvido",
    );
  });

  it("não encontra Empréstimo quando o Usuário nunca pegou o Livro", async () => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(
      ambiente.cliente.devolverLivro("U001", "L001"),
      status.NOT_FOUND,
      "Empréstimo não encontrado",
    );
  });

  it("não encontra Empréstimo quando o Livro está com outra pessoa", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [{ usuario: "U002", exemplar: "L001-1", dataEmprestimo: "2026-10-10" }],
    });

    await esperarErro(
      ambiente.cliente.devolverLivro("U001", "L001"),
      status.NOT_FOUND,
      "Empréstimo não encontrado",
    );
  });
});
