import { ehDataValida } from "./datas.js";

/** Fornece a data de "hoje" do servidor, no formato AAAA-MM-DD. */
export type Relogio = () => string;

export function relogioFixo(hoje: string): Relogio {
  return () => hoje;
}

export function relogioDoSistema(): Relogio {
  return () => {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const dia = String(agora.getDate()).padStart(2, "0");
    return `${agora.getFullYear()}-${mes}-${dia}`;
  };
}

/** Usa BIBLIOTECA_HOJE se definida (e válida); senão, a data real do sistema. */
export function relogioDoAmbiente(): Relogio {
  const hoje = process.env.BIBLIOTECA_HOJE;
  if (hoje === undefined || hoje === "") return relogioDoSistema();
  if (!ehDataValida(hoje)) {
    throw new Error(`Data de hoje inválida: BIBLIOTECA_HOJE="${hoje}". Use o formato AAAA-MM-DD (ex.: 2026-10-20).`);
  }
  return relogioFixo(hoje);
}
