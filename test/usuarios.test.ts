import { afterEach, describe, expect, it } from "vitest";
import { iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

describe("ListarUsuarios", () => {
  it("lista os Usuários cadastrados", async () => {
    ambiente = await iniciarTeste({
      usuarios: [
        { codigo: "U001", nome: "Ana" },
        { codigo: "U002", nome: "Bruno" },
      ],
    });

    const resposta = await ambiente.cliente.listarUsuarios();

    expect(resposta.usuarios).toEqual([
      { codigo: "U001", nome: "Ana" },
      { codigo: "U002", nome: "Bruno" },
    ]);
  });
});
