import { describe, expect, it } from "vitest";
import { iniciarTeste } from "./ambiente.js";

describe("ObterHoje", () => {
  it("informa a data de hoje do servidor", async () => {
    const ambiente = await iniciarTeste({}, "2026-03-15");
    try {
      expect(await ambiente.cliente.obterHoje()).toEqual({ data: "2026-03-15" });
    } finally {
      await ambiente.encerrar();
    }
  });
});

describe("inicialização do servidor", () => {
  it.each(["20/10/2026", "2026-02-30", "hoje"])("recusa 'hoje' inválido (%s)", async (hoje) => {
    await expect(iniciarTeste({}, hoje)).rejects.toThrow(/data de hoje inválida/i);
  });
});
