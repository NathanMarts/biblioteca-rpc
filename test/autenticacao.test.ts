import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import type { DadosIniciais } from "../src/server/dados.js";
import { esperarErro, HOJE, iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

const OITO_HORAS = 8 * 60 * 60 * 1000;

const acervo: Partial<DadosIniciais> = {
  bibliotecarios: [{ login: "maria", nome: "Maria", senha: "segredo" }],
  usuarios: [{ codigo: "U001", nome: "Ana" }],
  livros: [{ codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 1 }],
  emprestimos: [{ usuario: "U001", exemplar: "L001-1", dataEmprestimo: "2026-10-18" }],
};

describe("Entrar", () => {
  it("devolve um token de sessão para login e senha corretos", async () => {
    ambiente = await iniciarTeste(acervo);
    const cliente = ambiente.novoCliente();

    const resposta = await cliente.entrar("maria", "segredo");

    expect(resposta.nome).toBe("Maria");
    expect(resposta.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ["senha errada", "maria", "errada"],
    ["login inexistente", "joao", "segredo"],
  ])("recusa %s", async (_, login, senha) => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(
      ambiente.novoCliente().entrar(login, senha),
      status.UNAUTHENTICATED,
      "Login ou senha inválidos",
    );
  });
});

describe("métodos protegidos", () => {
  it.each([
    ["RealizarEmprestimo", (c: Ambiente["cliente"]) => c.realizarEmprestimo("U001", "L001", HOJE)],
    ["DevolverLivro", (c: Ambiente["cliente"]) => c.devolverLivro("U001", "L001")],
    ["ListarUsuarios", (c: Ambiente["cliente"]) => c.listarUsuarios()],
    ["ConsultarEmprestimosUsuario", (c: Ambiente["cliente"]) => c.consultarEmprestimosUsuario("U001")],
    ["ConsultarEmprestimosLivro", (c: Ambiente["cliente"]) => c.consultarEmprestimosLivro("L001")],
  ])("%s exige login", async (_, chamar) => {
    ambiente = await iniciarTeste(acervo);

    await esperarErro(chamar(ambiente.novoCliente()), status.UNAUTHENTICATED, "Não autenticado");
  });

  it("recusa um token que o servidor não emitiu", async () => {
    ambiente = await iniciarTeste(acervo);
    const cliente = ambiente.novoCliente();
    cliente.usarToken("f".repeat(64));

    await esperarErro(cliente.listarUsuarios(), status.UNAUTHENTICATED, "Não autenticado");
  });

  it("libera o acesso depois de Entrar", async () => {
    ambiente = await iniciarTeste(acervo);
    const cliente = ambiente.novoCliente();
    await cliente.entrar("maria", "segredo");

    const { usuarios } = await cliente.listarUsuarios();

    expect(usuarios).toEqual([{ codigo: "U001", nome: "Ana" }]);
  });

  it("recusa a sessão depois de 8 horas", async () => {
    let agora = Date.UTC(2026, 9, 20, 9, 0, 0);
    ambiente = await iniciarTeste(acervo, HOJE, { agora: () => agora });
    const cliente = ambiente.novoCliente();
    await cliente.entrar("maria", "segredo");

    agora += OITO_HORAS + 1;

    await esperarErro(cliente.listarUsuarios(), status.UNAUTHENTICATED, "Sessão expirada");
  });
});

describe("métodos públicos", () => {
  it("ListarLivros, ConsultarLivro e ObterHoje funcionam sem login", async () => {
    ambiente = await iniciarTeste(acervo);
    const anonimo = ambiente.novoCliente();

    await expect(anonimo.listarLivros()).resolves.toBeDefined();
    await expect(anonimo.consultarLivro("L001")).resolves.toBeDefined();
    await expect(anonimo.obterHoje()).resolves.toEqual({ data: HOJE });
  });

  it("ConsultarLivro sem login não revela quem pegou o Exemplar", async () => {
    ambiente = await iniciarTeste(acervo);
    const anonimo = ambiente.novoCliente();
    const logado = ambiente.novoCliente();
    await logado.entrar("maria", "segredo");

    const publico = await anonimo.consultarLivro("L001");
    const completo = await logado.consultarLivro("L001");

    expect(publico.exemplares[0]).toEqual({
      codigo: "L001-1",
      disponivel: false,
      codigoUsuario: "",
      nomeUsuario: "",
      dataEmprestimo: "2026-10-18",
    });
    expect(completo.exemplares[0]).toMatchObject({ codigoUsuario: "U001", nomeUsuario: "Ana" });
  });
});
