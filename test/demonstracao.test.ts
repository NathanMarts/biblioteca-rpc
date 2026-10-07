import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import { Situacao } from "../src/generated/biblioteca.js";
import { dadosDeDemonstracao } from "../src/server/seed.js";
import { esperarErro, HOJE, iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

describe("dados de demonstração", () => {
  it("trazem os cenários usados na apresentação, relativos a hoje", async () => {
    ambiente = await iniciarTeste(dadosDeDemonstracao(HOJE));
    const { cliente } = ambiente;

    const { livros } = await cliente.listarLivros();
    expect(livros.length).toBeGreaterThanOrEqual(10);
    expect(livros.some((l) => l.disponiveis === 0)).toBe(true);

    const { usuarios } = await cliente.listarUsuarios();
    const ativosPorUsuario = await Promise.all(
      usuarios.map((u) => cliente.consultarEmprestimosUsuario(u.codigo)),
    );
    const ativos = ativosPorUsuario.flatMap((r) => r.emprestimos);
    expect(ativos.some((e) => e.situacao === Situacao.ATRASADO)).toBe(true);
    expect(ativos.some((e) => e.situacao === Situacao.NO_PRAZO)).toBe(true);
    expect(ativosPorUsuario.some((r) => r.emprestimos.length === 3)).toBe(true);

    const historicos = await Promise.all(livros.map((l) => cliente.consultarEmprestimosLivro(l.codigo)));
    expect(historicos.flatMap((h) => h.emprestimos).some((e) => e.dataDevolucao !== "")).toBe(true);
  });

  it("deixam um Usuário no limite de Empréstimos", async () => {
    ambiente = await iniciarTeste(dadosDeDemonstracao(HOJE));

    await esperarErro(
      ambiente.cliente.realizarEmprestimo("U001", "L005", HOJE),
      status.FAILED_PRECONDITION,
      "Usuário com limite de empréstimos atingido",
    );
  });
});
