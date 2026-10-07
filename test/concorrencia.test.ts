import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import { iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
afterEach(() => ambiente?.encerrar());

describe("concorrência", () => {
  it("só um de vários pedidos simultâneos leva o último Exemplar", async () => {
    const usuarios = ["U001", "U002", "U003", "U004", "U005"];
    ambiente = await iniciarTeste({
      usuarios: usuarios.map((codigo) => ({ codigo, nome: codigo })),
      livros: [{ codigo: "L001", titulo: "Dom Casmurro", autor: "Machado de Assis", exemplares: 1 }],
    });

    const resultados = await Promise.allSettled(
      usuarios.map((u) => ambiente.cliente.realizarEmprestimo(u, "L001", "2026-10-20")),
    );

    const sucessos = resultados.filter((r) => r.status === "fulfilled");
    const falhas = resultados.filter((r) => r.status === "rejected").map((r) => r.reason);
    expect(sucessos).toHaveLength(1);
    expect(falhas).toHaveLength(4);
    for (const falha of falhas) {
      expect(falha).toMatchObject({ code: status.FAILED_PRECONDITION, details: "Livro indisponível" });
    }
  });
});
