import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import type { DadosIniciais } from "../src/server/dados.js";
import { esperarErro, iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

const acervo: Partial<DadosIniciais> = {
  usuarios: [
    { codigo: "U001", nome: "Ana" },
    { codigo: "U002", nome: "Bruno" },
  ],
  livros: [
    { codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 2 },
    { codigo: "L002", titulo: "Vidas Secas", autor: "Graciliano Ramos", exemplares: 1 },
  ],
};

describe("ConsultarEmprestimosLivro", () => {
  it("lista o histórico de todos os Exemplares, do mais recente para o mais antigo", async () => {
    ambiente = await iniciarTeste({
      ...acervo,
      emprestimos: [
        { usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-09-01", dataDevolucao: "2026-09-06" },
        { usuario: "U002", exemplar: "L001-2", dataEmprestimo: "2026-10-15" },
        { usuario: "U002", exemplar: "L001-1", dataEmprestimo: "2026-09-10", dataDevolucao: "2026-09-12" },
        { usuario: "U001", exemplar: "L002-1", dataEmprestimo: "2026-10-01" },
      ],
    });

    const { emprestimos } = await ambiente.cliente.consultarEmprestimosLivro("L001");

    expect(emprestimos).toEqual([
      {
        codigoUsuario: "U002",
        nomeUsuario: "Bruno",
        codigoExemplar: "L001-2",
        dataEmprestimo: "2026-10-15",
        dataDevolucao: "",
      },
      {
        codigoUsuario: "U002",
        nomeUsuario: "Bruno",
        codigoExemplar: "L001-1",
        dataEmprestimo: "2026-09-10",
        dataDevolucao: "2026-09-12",
      },
      {
        codigoUsuario: "U001",
        nomeUsuario: "Ana",
        codigoExemplar: "L001-1",
        dataEmprestimo: "2026-09-01",
        dataDevolucao: "2026-09-06",
      },
    ]);
  });

  it("inclui Empréstimos e Devoluções feitos pela API", async () => {
    ambiente = await iniciarTeste(acervo);
    await ambiente.cliente.realizarEmprestimo("U001", "L002", "2026-10-18");
    await ambiente.cliente.devolverLivro("U001", "L002");

    const { emprestimos } = await ambiente.cliente.consultarEmprestimosLivro("L002");

    expect(emprestimos).toEqual([
      {
        codigoUsuario: "U001",
        nomeUsuario: "Ana",
        codigoExemplar: "L002-1",
        dataEmprestimo: "2026-10-18",
        dataDevolucao: "2026-10-20",
      },
    ]);
  });

  it("retorna lista vazia quando o Livro nunca foi emprestado", async () => {
    ambiente = await iniciarTeste(acervo);

    const { emprestimos } = await ambiente.cliente.consultarEmprestimosLivro("L001");

    expect(emprestimos).toEqual([]);
  });

  it("recusa Livro inexistente", async () => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(
      ambiente.cliente.consultarEmprestimosLivro("L999"),
      status.NOT_FOUND,
      "Livro não encontrado",
    );
  });
});
