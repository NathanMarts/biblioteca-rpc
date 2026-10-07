import { BANCO, HOST, PORTA } from "../config.js";
import { relogioDoAmbiente, type Relogio } from "./relogio.js";
import { dadosDeDemonstracao } from "./seed.js";
import { iniciarServidor, type ServidorEmExecucao } from "./servidor.js";

let servidor: ServidorEmExecucao;
let relogio: Relogio;
try {
  relogio = relogioDoAmbiente();
  servidor = await iniciarServidor({
    banco: BANCO,
    host: HOST,
    porta: PORTA,
    relogio,
    dadosIniciais: dadosDeDemonstracao(relogio()),
    log: true,
  });
} catch (erro) {
  console.error(`Não foi possível iniciar o servidor: ${erro instanceof Error ? erro.message : erro}`);
  process.exit(1);
}

console.log(`Servidor da Biblioteca escutando em ${servidor.endereco}`);
console.log(`Banco: ${BANCO} | Hoje: ${relogio()}`);

process.on("SIGINT", async () => {
  console.log("\nEncerrando...");
  await servidor.encerrar();
  process.exit(0);
});
