import { BANCO, HOST, PORTA } from "../config.js";
import { relogioDoAmbiente } from "./relogio.js";
import { dadosDeDemonstracao } from "./seed.js";
import { iniciarServidor } from "./servidor.js";

const relogio = relogioDoAmbiente();
const servidor = await iniciarServidor({
  banco: BANCO,
  host: HOST,
  porta: PORTA,
  relogio,
  dadosIniciais: dadosDeDemonstracao(),
  log: true,
});

console.log(`Servidor da Biblioteca escutando em ${servidor.endereco}`);
console.log(`Banco: ${BANCO} | Hoje: ${relogio()}`);

process.on("SIGINT", async () => {
  console.log("\nEncerrando...");
  await servidor.encerrar();
  process.exit(0);
});
