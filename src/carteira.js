/* As pools em que o Rayakuza JÁ ESTÁ — e o que mudou desde que ele entrou.
 *
 * O radar inteiro, até aqui, respondia "onde vale olhar". Isto responde outra
 * pergunta, e é a que envolve dinheiro que já está na mesa: "o que mudou no que
 * eu já tenho?".
 *
 * A diferença não é de tela, é de referência. Descobrir compara uma pool com as
 * outras pools de hoje. Acompanhar compara a pool com ELA MESMA no dia em que
 * ele entrou — por isso a foto da entrada é guardada, e por isso toda frase
 * daqui tem a forma "era X quando você entrou, hoje é Y".
 *
 * O que este arquivo NÃO faz: dizer o que fazer. Nenhuma frase aqui manda sair,
 * aumentar ou esperar. Ele mostra o que mudou e deixa a decisão onde ela é —
 * eu não sou consultor de investimento dele, e "sai dessa pool" saindo de mim
 * seria palpite com cara de análise.
 *
 * Nada aqui fala com a rede nem com o banco: entram duas fotos, sai uma lista.
 */

/* Os cortes de "mudou o bastante pra te interromper".
 *
 * São escolhas minhas, e a régua foi: o aviso tem que valer o incômodo de o
 * celular tocar. Movimento pequeno em pool é o normal — o chão oscila todo dia,
 * o TVL entra e sai. O que merece aviso é a mudança que altera a razão pela
 * qual ele entrou. */
export const CARTEIRA = {
  // O chão é a medida em que ele se baseou. Cair um terço muda a conta.
  quedaDoChao: 0.33,
  // Incentivo acabando é o evento com prazo do método: "saia antes que terminem".
  incentivoAcabou: 5,      // % do rendimento vindo de incentivo, hoje
  incentivoEraRelevante: 20, // ...tendo sido pelo menos isso na entrada
  // Rendimento que ERA de taxa e virou de incentivo: mudou de natureza.
  incentivoTomouConta: 60,
  // Metade do dinheiro saindo da pool é liquidez indo embora, não oscilação.
  quedaDeTvl: 0.5,
  // Perda por descolamento que já passou de "detalhe".
  ilQueImporta: 5,
};

const num = (v) => (v == null || !Number.isFinite(v) ? null : v);
const pct = (v, casas = 1) => (v == null ? "?" : `${v.toFixed(casas)}%`);
const vezes = (a, b) => (num(a) != null && num(b) > 0 ? a / b : null);

/* O que mudou entre a entrada e hoje.
 *
 * `entrada` é a foto guardada; `hoje` é a medida do dia. Devolve uma lista de
 * mudanças, cada uma com `forca` (pra ordenar) e `texto` (pronto pra ler).
 * Lista vazia quer dizer "nada que valha te interromper" — que é uma resposta,
 * e é a mais comum. */
export function oQueMudouNaMinha(entrada, hoje, lim = CARTEIRA) {
  if (!entrada) return [];

  /* A pool sumiu da medição. Não é o mesmo que "acabou": pode ter caído abaixo
   * do corte de TVL, pode ter mudado de id, pode ser falha da fonte. Dizer
   * "acabou" seria afirmar o que não sei. */
  if (!hoje) {
    return [{
      tipo: "sumiu",
      forca: 100,
      texto: "não encontrei essa pool na medição de hoje. Pode ter encolhido abaixo do corte, mudado de endereço, ou ser falha da fonte — não dá pra saber daqui qual dos três.",
    }];
  }

  const mudancas = [];

  // ---- o chão -------------------------------------------------------------
  const chaoAntes = num(entrada.chao_entrada);
  const chaoHoje = num(hoje.chao);
  if (chaoAntes != null && chaoHoje != null && chaoAntes > 0) {
    const razao = chaoHoje / chaoAntes;
    if (razao <= 1 - lim.quedaDoChao) {
      mudancas.push({
        tipo: "chao-caiu",
        forca: (1 - razao) * 100,
        texto: `o chão caiu de ${pct(chaoAntes)} para ${pct(chaoHoje)} — ${((1 - razao) * 100).toFixed(0)}% menos do que quando você entrou.`,
      });
    } else if (razao >= 1.5) {
      // Subida também é mudança. Um radar que só avisa de coisa ruim ensina a
      // temer a notificação.
      mudancas.push({
        tipo: "chao-subiu",
        forca: (razao - 1) * 50,
        texto: `o chão subiu de ${pct(chaoAntes)} para ${pct(chaoHoje)}.`,
      });
    }
  }

  // ---- o incentivo --------------------------------------------------------
  const incAntes = num(entrada.incentivo_entrada);
  const incHoje = num(hoje.emitido);
  if (incAntes != null && incHoje != null) {
    if (incAntes >= lim.incentivoEraRelevante && incHoje <= lim.incentivoAcabou) {
      /* O evento que o Guia 3 nomeia: "entre cedo quando os incentivos
       * começarem, saia antes que terminem". O radar não diz pra sair — diz
       * que terminou, que é o fato que ele precisa pra decidir. */
      mudancas.push({
        tipo: "incentivo-acabou",
        forca: incAntes,
        texto: `o incentivo acabou: era ${pct(incAntes, 0)} do rendimento quando você entrou, hoje é ${pct(incHoje, 0)}.`,
      });
    } else if (incHoje >= lim.incentivoTomouConta && incAntes < lim.incentivoTomouConta) {
      mudancas.push({
        tipo: "incentivo-tomou-conta",
        forca: incHoje - incAntes,
        texto: `o rendimento mudou de natureza: era ${pct(incAntes, 0)} de incentivo quando você entrou, hoje é ${pct(incHoje, 0)}. O que sobra de taxa é menos do que parecia.`,
      });
    }
  }

  // ---- o tamanho da pool --------------------------------------------------
  const tvlAntes = num(entrada.tvl_entrada);
  const tvlHoje = num(hoje.tvl);
  if (tvlAntes > 0 && tvlHoje != null) {
    const r = tvlHoje / tvlAntes;
    if (r <= lim.quedaDeTvl) {
      mudancas.push({
        tipo: "tvl-caiu",
        forca: (1 - r) * 100,
        texto: `${((1 - r) * 100).toFixed(0)}% do dinheiro saiu da pool desde que você entrou (de ${dinheiroCurto(tvlAntes)} para ${dinheiroCurto(tvlHoje)}). Pool menor tem menos taxa pra dividir, e é mais difícil sair sem mexer no preço.`,
      });
    }
  }

  // ---- os portões do método ----------------------------------------------
  if (entrada.passava_entrada === 1 && hoje.portao_passa === 0) {
    let motivos = [];
    try { motivos = JSON.parse(hoje.portao_motivos || "[]"); } catch { /* motivo ilegível não vira aviso mudo */ }
    mudancas.push({
      tipo: "saiu-dos-portoes",
      forca: 60,
      texto: `hoje ela não passaria nos portões do método${motivos.length ? `: ${motivos[0]}` : ""}. Passava quando você entrou.`,
    });
  }

  // ---- a correlação do par ------------------------------------------------
  const corrAntes = num(entrada.correlacao_entrada);
  const corrHoje = num(hoje.correlacao);
  if (corrAntes != null && corrHoje != null && corrAntes >= 0.8 && corrHoje < 0.5) {
    mudancas.push({
      tipo: "correlacao-quebrou",
      forca: (corrAntes - corrHoje) * 100,
      texto: `os dois tokens do par se soltaram: andavam colados (${corrAntes.toFixed(2)}) quando você entrou, hoje andam quase independentes (${corrHoje.toFixed(2)}). É a condição que o método pede num par volátil.`,
    });
  }

  // ---- a classe -----------------------------------------------------------
  if (entrada.classe_entrada && hoje.classe && entrada.classe_entrada !== hoje.classe) {
    const nome = { firme: "firme (vive de taxas)", alugada: "incentivada", loteria: "loteria", nova: "nova", "sem-dado": "sem dado" };
    mudancas.push({
      tipo: "mudou-de-classe",
      forca: 40,
      texto: `mudou de caixa: entrou como ${nome[entrada.classe_entrada] || entrada.classe_entrada}, hoje está como ${nome[hoje.classe] || hoje.classe}.`,
    });
  }

  return mudancas.sort((a, b) => b.forca - a.forca);
}

/* Dinheiro curto, pra caber na frase. Duplicado de telegram.js de propósito:
 * este arquivo não depende de como o radar fala, só do que ele mede. */
function dinheiroCurto(v) {
  if (v == null || !Number.isFinite(v)) return "?";
  const n = Math.abs(v), s = v < 0 ? "-" : "";
  if (n >= 1e9) return `${s}$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${s}$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${s}$${(n / 1e3).toFixed(0)}k`;
  return `${s}$${n.toFixed(0)}`;
}

/* O panorama de uma posição, mudando ou não.
 *
 * Serve pro /minhas, que ele abre quando QUER olhar — diferente do aviso, que
 * chega sem ele pedir. Aqui a ausência de mudança também é informação, e por
 * isso a função nunca devolve vazio. */
export function situacaoDaMinha(entrada, hoje, lim = CARTEIRA) {
  const mudancas = oQueMudouNaMinha(entrada, hoje, lim);
  const dias = diasEntre(entrada?.desde, hoje?.dia);

  return {
    id: entrada.id,
    projeto: entrada.projeto,
    simbolo: entrada.simbolo,
    rede: entrada.rede,
    desde: entrada.desde,
    dias,
    achada: !!hoje,
    chaoEntrada: num(entrada.chao_entrada),
    chaoHoje: hoje ? num(hoje.chao) : null,
    incentivoEntrada: num(entrada.incentivo_entrada),
    incentivoHoje: hoje ? num(hoje.emitido) : null,
    tvlEntrada: num(entrada.tvl_entrada),
    tvlHoje: hoje ? num(hoje.tvl) : null,
    mudancas,
    // "Sem mudança" é resposta, não silêncio.
    resumo: !hoje
      ? "não encontrei a pool na medição de hoje"
      : mudancas.length === 0
        ? `sem mudança relevante${dias != null ? ` em ${dias} dia${dias === 1 ? "" : "s"}` : ""} — continua parecida com o dia em que você entrou`
        : mudancas[0].texto,
  };
}

export function diasEntre(a, b) {
  if (!a || !b) return null;
  const d = (Date.parse(b) - Date.parse(a)) / 86400000;
  return Number.isFinite(d) ? Math.max(0, Math.round(d)) : null;
}

/* A foto da entrada, montada a partir da medida do dia.
 *
 * Guardada e não recalculada porque é justamente o passado que não se pode
 * remedir: daqui a dois meses o radar não tem como saber qual era o chão no dia
 * em que ele entrou se ninguém anotou. */
export function fotoDaEntrada(medida, dia) {
  if (!medida) return null;
  return {
    id: medida.id,
    rede: medida.rede,
    projeto: medida.projeto,
    simbolo: medida.simbolo,
    desde: dia,
    chao_entrada: num(medida.chao),
    cartaz_entrada: num(medida.cartaz),
    apy_base_entrada: num(medida.apy_base),
    incentivo_entrada: num(medida.emitido),
    tvl_entrada: num(medida.tvl),
    correlacao_entrada: num(medida.correlacao),
    classe_entrada: medida.classe || null,
    passava_entrada: medida.portao_passa == null ? null : (medida.portao_passa ? 1 : 0),
  };
}
