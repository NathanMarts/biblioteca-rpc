// Gera o certificado autoassinado do servidor em certs/ (fora do git: a chave privada é secreta).
// Uso: npm run certificados [-- <host ou IP extra> ...]
// Ex.: npm run certificados -- 192.168.0.10   (para clientes que conectam por esse IP)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { gerarCertificado } from "../src/certificados.js";
import { ARQUIVO_CERTIFICADO, ARQUIVO_CHAVE } from "../src/config.js";

const hostsExtras = process.argv.slice(2);
const { certificado, chave } = await gerarCertificado(hostsExtras);
for (const arquivo of [ARQUIVO_CERTIFICADO, ARQUIVO_CHAVE]) mkdirSync(dirname(arquivo), { recursive: true });
writeFileSync(ARQUIVO_CERTIFICADO, certificado);
writeFileSync(ARQUIVO_CHAVE, chave, { mode: 0o600 });
console.log(`Certificado: ${ARQUIVO_CERTIFICADO} (copie para as máquinas dos clientes)`);
console.log(`Chave privada: ${ARQUIVO_CHAVE} (fica só no servidor)`);
console.log(`Válido para: ${["localhost", "127.0.0.1", ...hostsExtras].join(", ")}`);
