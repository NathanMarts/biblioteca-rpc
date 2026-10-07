/** Datas do domínio são strings AAAA-MM-DD (só o dia importa); comparáveis lexicograficamente. */

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

/** true se `data` está no formato AAAA-MM-DD e é um dia que existe no calendário. */
export function ehDataValida(data: string): boolean {
  if (!FORMATO.test(data)) return false;
  const d = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
