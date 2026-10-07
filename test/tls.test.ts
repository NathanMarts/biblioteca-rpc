import { status } from "@grpc/grpc-js";
import { afterEach, describe, expect, it } from "vitest";
import { criarCliente, type ClienteBiblioteca } from "../src/client/cliente.js";
import { gerarCertificado } from "../src/certificados.js";
import { iniciarTeste, type Ambiente } from "./ambiente.js";

let ambiente: Ambiente;
let intruso: ClienteBiblioteca | undefined;
afterEach(async () => {
  intruso?.fechar();
  intruso = undefined;
  await ambiente?.encerrar();
});

describe("TLS", () => {
  it("o cliente que confia no certificado do servidor conversa normalmente", async () => {
    ambiente = await iniciarTeste();

    await expect(ambiente.cliente.obterHoje()).resolves.toBeDefined();
  });

  it("um cliente sem TLS não consegue conversar com o servidor", async () => {
    ambiente = await iniciarTeste();
    intruso = criarCliente(ambiente.endereco);

    await expect(intruso.obterHoje()).rejects.toMatchObject({ code: status.UNAVAILABLE });
  });

  it("um cliente que não confia no certificado do servidor é recusado", async () => {
    ambiente = await iniciarTeste();
    const outroCertificado = await gerarCertificado();
    intruso = criarCliente(ambiente.endereco, { certificado: outroCertificado.certificado });

    await expect(intruso.obterHoje()).rejects.toMatchObject({ code: status.UNAVAILABLE });
  });
});
