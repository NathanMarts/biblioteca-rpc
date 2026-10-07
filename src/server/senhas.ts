import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const TAMANHO_DO_HASH = 32;

/** Gera "sal:hash" (hex) com scrypt; a senha em si nunca é guardada. */
export function gerarHashDeSenha(senha: string): string {
  const sal = randomBytes(16);
  return `${sal.toString("hex")}:${scryptSync(senha, sal, TAMANHO_DO_HASH).toString("hex")}`;
}

/** Compara em tempo constante a senha informada com o "sal:hash" guardado. */
export function conferirSenha(senha: string, guardado: string): boolean {
  const [sal, hash] = guardado.split(":");
  const esperado = Buffer.from(hash, "hex");
  return timingSafeEqual(scryptSync(senha, Buffer.from(sal, "hex"), esperado.length), esperado);
}

/** Hash de uma senha qualquer, usado para gastar o mesmo tempo quando o login não existe. */
export const HASH_FICTICIO = gerarHashDeSenha("senha-ficticia");
