import { rmSync } from "node:fs";
import { BANCO } from "../config.js";
import { abrirBanco } from "./db.js";
import { relogioDoAmbiente } from "./relogio.js";
import { dadosDeDemonstracao } from "./seed.js";

// Apaga o banco e o recria com os dados de demonstração. Rode com o servidor parado.
for (const sufixo of ["", "-wal", "-shm", "-journal"]) rmSync(`${BANCO}${sufixo}`, { force: true });
abrirBanco(BANCO, dadosDeDemonstracao(relogioDoAmbiente()())).close();
console.log(`Banco ${BANCO} recriado com os dados de demonstração.`);
