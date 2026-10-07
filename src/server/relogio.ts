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

/** Usa BIBLIOTECA_HOJE se definida; senão, a data real do sistema. */
export function relogioDoAmbiente(): Relogio {
  const hoje = process.env.BIBLIOTECA_HOJE;
  return hoje ? relogioFixo(hoje) : relogioDoSistema();
}
