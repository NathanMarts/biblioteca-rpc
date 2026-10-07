import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import type { DadosIniciais } from "../src/server/dados.js";
import { esperarErro, iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

// "Hoje" nos testes é 2026-10-20.
const acervo: Partial<DadosIniciais> = {
  usuarios: [
    { codigo: "U001", nome: "Ana" },
    { codigo: "U002", nome: "Bruno" },
  ],
  livros: [
    { codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 2 },
    { codigo: "L002", titulo: "Vidas Secas", autor: "Graciliano Ramos", exemplares: 1 },
    { codigo: "L003", titulo: "O Cortiço", autor: "Aluísio Azevedo", exemplares: 1 },
    { codigo: "L004", titulo: "O Alienista", autor: "Machado de Assis", exemplares: 1 },
  ],
};

describe("RealizarEmprestimo", () => {
  it("empresta um Exemplar e informa a data limite (data do Empréstimo + 7 dias)", async () => {
    ambiente = await iniciarTeste(acervo);

    const resposta = await ambiente.cliente.realizarEmprestimo("U001", "L001", "2026-10-15");

    expect(resposta).toEqual({
      codigoExemplar: "L001-1",
      dataEmprestimo: "2026-10-15",
      dataLimite: "2026-10-22",
    });
    const { exemplares } = await ambiente.cliente.consultarLivro("L001");
    expect(exemplares[0]).toMatchObject({
      codigo: "L001-1",
      disponivel: false,
      codigoUsuario: "U001",
      nomeUsuario: "Ana",
      dataEmprestimo: "2026-10-15",
    });
  });

  it("escolhe o Exemplar disponível de menor código", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [{ usuario: "U002", exemplar: "L001-1", dataEmprestimo: "2026-10-18" }],
    });

    const resposta = await ambiente.cliente.realizarEmprestimo("U001", "L001", "2026-10-20");

    expect(resposta.codigoExemplar).toBe("L001-2");
  });

  it("recusa Usuário inexistente", async () => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U999", "L001", "2026-10-20"),
      status.NOT_FOUND,
      "Usuário não encontrado",
    );
  });

  it("recusa Livro inexistente", async () => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L999", "2026-10-20"),
      status.NOT_FOUND,
      "Livro não encontrado",
    );
  });

  it.each([
    ["no futuro", "2026-10-21"],
    ["em outro formato", "20/10/2026"],
    ["inexistente no calendário", "2026-02-30"],
    ["vazia", ""],
  ])("recusa data %s", async (_, data) => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L001", data),
      status.INVALID_ARGUMENT,
      "Data inválida",
    );
  });

  it("recusa um segundo Exemplar do mesmo Livro para o mesmo Usuário", async () => {
    ambiente = await iniciarTeste(acervo);
    await ambiente.cliente.realizarEmprestimo("U001", "L001", "2026-10-20");

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L001", "2026-10-20"),
      status.FAILED_PRECONDITION,
      "Usuário já possui um exemplar deste livro",
    );
  });

  it("recusa quando o Usuário já tem 3 Empréstimos ativos", async () => {
    ambiente = await iniciarTeste(acervo);
    for (const livro of ["L001", "L002", "L003"]) {
      await ambiente.cliente.realizarEmprestimo("U001", livro, "2026-10-20");
    }

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L004", "2026-10-20"),
      status.FAILED_PRECONDITION,
      "Usuário com limite de empréstimos atingido",
    );
  });

  it("recusa quando todos os Exemplares do Livro estão emprestados", async () => {
    ambiente = await iniciarTeste(acervo);
    await ambiente.cliente.realizarEmprestimo("U002", "L002", "2026-10-20");

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L002", "2026-10-20"),
      status.FAILED_PRECONDITION,
      "Livro indisponível",
    );
  });

  it("não conta Empréstimos encerrados no limite", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [
        { usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-09-01", dataDevolucao: "2026-09-05" },
        { usuario: "U001", exemplar: "L002-1", dataEmprestimo: "2026-09-01", dataDevolucao: "2026-09-05" },
        { usuario: "U001", exemplar: "L003-1", dataEmprestimo: "2026-09-01", dataDevolucao: "2026-09-05" },
      ],
    });

    const resposta = await ambiente.cliente.realizarEmprestimo("U001", "L004", "2026-10-20");

    expect(resposta.codigoExemplar).toBe("L004-1");
  });

  it("verifica o Usuário antes do Livro e da data", async () => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U999", "L999", "data"),
      status.NOT_FOUND,
      "Usuário não encontrado",
    );
  });

  it("verifica o limite antes da disponibilidade", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [
        { usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-10-18" },
        { usuario: "U001", exemplar: "L003-1", dataEmprestimo: "2026-10-18" },
        { usuario: "U001", exemplar: "L004-1", dataEmprestimo: "2026-10-18" },
        { usuario: "U002", exemplar: "L002-1", dataEmprestimo: "2026-10-18" },
      ],
    });

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L002", "2026-10-20"),
      status.FAILED_PRECONDITION,
      "Usuário com limite de empréstimos atingido",
    );
  });
});
