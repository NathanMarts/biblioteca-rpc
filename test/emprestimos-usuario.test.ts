import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import { Situacao } from "../src/generated/biblioteca.js";
import type { DadosIniciais } from "../src/server/dados.js";
import { esperarErro, iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

// "Hoje" nos testes é 2026-10-20; o Prazo é de 7 dias.
const acervo: Partial<DadosIniciais> = {
  usuarios: [
    { codigo: "U001", nome: "Ana" },
    { codigo: "U002", nome: "Bruno" },
  ],
  livros: [
    { codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 1 },
    { codigo: "L002", titulo: "Vidas Secas", autor: "Graciliano Ramos", exemplares: 1 },
    { codigo: "L003", titulo: "O Cortiço", autor: "Aluísio Azevedo", exemplares: 1 },
  ],
};

describe("ConsultarEmprestimosUsuario", () => {
  it("lista os Empréstimos ativos com data limite e situação", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [
        { usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-10-18" },
        { usuario: "U001", exemplar: "L002-1", dataEmprestimo: "2026-10-01" },
      ],
    });

    const { emprestimos } = await ambiente.cliente.consultarEmprestimosUsuario("U001");

    expect(emprestimos).toEqual([
      {
        codigoLivro: "L002",
        titulo: "Vidas Secas",
        codigoExemplar: "L002-1",
        dataEmprestimo: "2026-10-01",
        dataLimite: "2026-10-08",
        situacao: Situacao.ATRASADO,
      },
      {
        codigoLivro: "L001",
        titulo: "Dom Casmurro",
        codigoExemplar: "L001-1",
        dataEmprestimo: "2026-10-18",
        dataLimite: "2026-10-25",
        situacao: Situacao.NO_PRAZO,
      },
    ]);
  });

  it("considera no prazo até a data limite, inclusive, e atrasado no dia seguinte", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [
        { usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-10-13" }, // limite = hoje
        { usuario: "U001", exemplar: "L002-1", dataEmprestimo: "2026-10-12" }, // limite = ontem
      ],
    });

    const { emprestimos } = await ambiente.cliente.consultarEmprestimosUsuario("U001");

    expect(emprestimos.map((e) => [e.codigoExemplar, e.dataLimite, e.situacao])).toEqual([
      ["L002-1", "2026-10-19", Situacao.ATRASADO],
      ["L001-1", "2026-10-20", Situacao.NO_PRAZO],
    ]);
  });

  it("não inclui Empréstimos encerrados nem de outros Usuários", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [
        { usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-10-01", dataDevolucao: "2026-10-03" },
        { usuario: "U002", exemplar: "L002-1", dataEmprestimo: "2026-10-18" },
        { usuario: "U001", exemplar: "L003-1", dataEmprestimo: "2026-10-19" },
      ],
    });

    const { emprestimos } = await ambiente.cliente.consultarEmprestimosUsuario("U001");

    expect(emprestimos.map((e) => e.codigoExemplar)).toEqual(["L003-1"]);
  });

  it("retorna lista vazia quando o Usuário não tem Empréstimos ativos", async () => {
    ambiente = await iniciarTeste(acervo);

    const { emprestimos } = await ambiente.cliente.consultarEmprestimosUsuario("U001");

    expect(emprestimos).toEqual([]);
  });

  it("recusa Usuário inexistente", async () => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(
      ambiente.cliente.consultarEmprestimosUsuario("U999"),
      status.NOT_FOUND,
      "Usuário não encontrado",
    );
  });
});
