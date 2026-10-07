import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import { esperarErro, iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

const livros = [
  { codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 2 },
  { codigo: "L002", titulo: "Vidas Secas", autor: "Graciliano Ramos", exemplares: 1 },
];

describe("ListarLivros", () => {
  it("lista os Livros com a quantidade de Exemplares disponíveis", async () => {
    ambiente = await iniciarTeste({ livros });

    const resposta = await ambiente.cliente.listarLivros();

    expect(resposta.livros).toEqual([
      { codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", disponiveis: 2, total: 2 },
      { codigo: "L002", titulo: "Vidas Secas", autor: "Graciliano Ramos", disponiveis: 1, total: 1 },
    ]);
  });
});

describe("ConsultarLivro", () => {
  it("mostra o resumo e a situação de cada Exemplar", async () => {
    ambiente = await iniciarTeste({ livros });

    const resposta = await ambiente.cliente.consultarLivro("L001");

    expect(resposta.livro).toEqual({
      codigo: "L001",
      titulo: "Dom Casmurro",
      autor: "Machado de Assis",
      disponiveis: 2,
      total: 2,
    });
    expect(resposta.exemplares.map((e) => [e.codigo, e.disponivel])).toEqual([
      ["L001-1", true],
      ["L001-2", true],
    ]);
  });

  it("recusa código de Livro inexistente", async () => {
    ambiente = await iniciarTeste({ livros });

    await esperarErro(ambiente.cliente.consultarLivro("L999"), status.NOT_FOUND, "Livro não encontrado");
  });
});

describe("Livro sem Exemplares", () => {
  it("aparece no acervo como indisponível, sem ser tratado como inexistente", async () => {
    ambiente = await iniciarTeste({
      livros: [{ codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 0 }],
    });

    const { livros } = await ambiente.cliente.listarLivros();
    const consulta = await ambiente.cliente.consultarLivro("L001");

    expect(livros).toEqual([
      { codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", disponiveis: 0, total: 0 },
    ]);
    expect(consulta.exemplares).toEqual([]);
  });
});
