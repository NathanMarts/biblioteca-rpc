import {
  createPrompt,
  isBackspaceKey,
  isDownKey,
  isEnterKey,
  isTabKey,
  isUpKey,
  makeTheme,
  useEffect,
  useKeypress,
  usePrefix,
  useState,
} from "@inquirer/core";

/**
 * Prompts do CLI em que Esc (e Backspace, nas listas) significa "voltar ao menu".
 *
 * No Windows, se um prompt do inquirer termina fora de um evento de entrada do terminal
 * (por exemplo, cancelado por AbortSignal ou dentro de um timer), o terminal para de entregar
 * teclas a partir do segundo prompt seguinte. Por isso "voltar" é uma resposta comum do prompt,
 * sempre dada dentro de um evento de entrada.
 */
export const VOLTAR = Symbol("voltar");

const DICA = "↑↓ navegar • ⏎ escolher • Esc voltar";
const ESC = "\x1b";

/**
 * Chama `aoPressionarEsc` quando chega um Esc isolado, já no evento "data" do terminal.
 * O readline só emite a tecla "escape" depois de um timer de 500 ms; terminar o prompt
 * dentro desse timer quebra a leitura do terminal no Windows a partir do prompt seguinte.
 */
function useEsc(aoPressionarEsc: () => void) {
  useEffect((rl) => {
    const aoReceber = (dados: Buffer | string) => {
      if (dados.toString() === ESC) aoPressionarEsc();
    };
    rl.input.on("data", aoReceber);
    return () => {
      rl.input.off("data", aoReceber);
    };
  }, []);
}

export const selecionar = createPrompt<
  string | typeof VOLTAR,
  { message: string; choices: { name: string; value: string }[] }
>((config, done) => {
  const theme = makeTheme({});
  const [status, setStatus] = useState<"idle" | "done">("idle");
  const [ativo, setAtivo] = useState(0);
  const prefix = usePrefix({ status, theme });
  const total = config.choices.length;

  useEsc(() => {
    setStatus("done");
    done(VOLTAR);
  });
  useKeypress((tecla) => {
    if (isEnterKey(tecla)) {
      setStatus("done");
      done(config.choices[ativo].value);
    } else if (isBackspaceKey(tecla)) {
      setStatus("done");
      done(VOLTAR);
    } else if (isUpKey(tecla)) {
      setAtivo((ativo - 1 + total) % total);
    } else if (isDownKey(tecla)) {
      setAtivo((ativo + 1) % total);
    }
  });

  const mensagem = theme.style.message(config.message, status);
  if (status === "done") return `${prefix} ${mensagem}`;
  const linhas = config.choices.map((opcao, i) =>
    i === ativo ? theme.style.highlight(`❯ ${opcao.name}`) : `  ${opcao.name}`,
  );
  return [`${prefix} ${mensagem}\n${linhas.join("\n")}`, theme.style.help(DICA)];
});

/** Campo de texto já preenchido com `default`, editável; Esc volta ao menu. */
export const perguntar = createPrompt<string | typeof VOLTAR, { message: string; default: string }>(
  (config, done) => {
    const theme = makeTheme({});
    const [status, setStatus] = useState<"idle" | "done">("idle");
    const [valor, setValor] = useState("");
    const prefix = usePrefix({ status, theme });

    useEffect((rl) => {
      rl.write(config.default);
      setValor(config.default);
    }, []);

    useEsc(() => {
      setStatus("done");
      done(VOLTAR);
    });
    useKeypress((tecla, rl) => {
      if (isEnterKey(tecla)) {
        setStatus("done");
        done(valor);
      } else if (tecla.name !== "escape" && !isTabKey(tecla)) {
        setValor(rl.line);
      }
    });

    const mensagem = theme.style.message(config.message, status);
    if (status === "done") return `${prefix} ${mensagem} ${theme.style.answer(valor)}`;
    return [`${prefix} ${mensagem} ${valor}`, theme.style.help("⏎ confirmar • Esc voltar")];
  },
);
