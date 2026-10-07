import { isIP } from "node:net";
import { generate } from "selfsigned";

export interface CertificadoTls {
  /** Certificado em PEM; o cliente o usa para confiar no servidor. */
  certificado: string;
  /** Chave privada em PEM; fica só com o servidor. */
  chave: string;
}

/**
 * Gera um certificado autoassinado para o servidor, válido para localhost, 127.0.0.1 e os
 * `hostsExtras` (nomes ou IPs pelos quais os clientes vão se conectar).
 */
export async function gerarCertificado(hostsExtras: string[] = []): Promise<CertificadoTls> {
  const hosts = ["localhost", "127.0.0.1", ...hostsExtras];
  const resultado = await generate([{ name: "commonName", value: "Biblioteca RPC" }], {
    keyType: "ec",
    curve: "P-256",
    notAfterDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: hosts.map((host) => (isIP(host) ? { type: 7, ip: host } : { type: 2, value: host })),
      },
    ],
  });
  return { certificado: resultado.cert, chave: resultado.private };
}
