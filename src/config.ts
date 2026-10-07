/** Configuração compartilhada por servidor e cliente, lida de variáveis de ambiente. */
export const HOST = process.env.BIBLIOTECA_HOST ?? "localhost";
export const PORTA = Number(process.env.BIBLIOTECA_PORTA ?? 50051);
export const BANCO = process.env.BIBLIOTECA_BANCO ?? "biblioteca.db";
export const ENDERECO = `${HOST}:${PORTA}`;
