import { existsSync, readFileSync } from "node:fs";

/** Configuração compartilhada por servidor e cliente, lida de variáveis de ambiente. */
export const HOST = process.env.BIBLIOTECA_HOST ?? "localhost";
export const PORTA = Number(process.env.BIBLIOTECA_PORTA ?? 50051);
export const BANCO = process.env.BIBLIOTECA_BANCO ?? "biblioteca.db";
export const ENDERECO = `${HOST}:${PORTA}`;

/** TLS fica ligado, a menos que BIBLIOTECA_TLS=desligado. */
export const TLS_LIGADO = process.env.BIBLIOTECA_TLS !== "desligado";
export const ARQUIVO_CERTIFICADO = process.env.BIBLIOTECA_CERTIFICADO ?? "certs/servidor.crt";
export const ARQUIVO_CHAVE = process.env.BIBLIOTECA_CHAVE ?? "certs/servidor.key";

/** Lê um arquivo do TLS, com uma mensagem que diz como gerá-lo se ele não existir. */
export function lerArquivoTls(caminho: string): string {
  if (!existsSync(caminho)) {
    throw new Error(
      `Arquivo de TLS não encontrado: ${caminho}. Gere o certificado com "npm run certificados" ` +
        `(ou desligue o TLS com BIBLIOTECA_TLS=desligado).`,
    );
  }
  return readFileSync(caminho, "utf8");
}
