/* O método do Rayakuza, em código.
 *
 * Não é um método que eu inventei: é o do curso Defiverso, que é onde ele
 * aprendeu e no que ele baseia os investimentos dele. Antes disto o radar
 * ranqueava pelo que EU achava que importava (o chão do rendimento). Ranqueava
 * bem, e respondia a pergunta errada.
 *
 * As regras abaixo estão nos módulos, com estes números:
 *
 *   Módulo 8, "Como escolher uma Pool", passo 3 — a REGRA DO 3:
 *       TVL baixo · Volume alto · Par bom
 *
 *   Módulo 8, página 17 — a tabela de perda impermanente:
 *       1,25x → 0,6%   1,5x → 2,0%   1,75x → 3,8%   2x → 5,7%
 *       3x → 13,4%     4x → 20,0%    5x → 25,5%
 *
 *   Módulo 4, página 19 — atividade de mercado:
 *       "O volume deve ser entre 2%-4% nas últimas 24 horas e de 10%-20% nos
 *        últimos 7 dias"
 *
 *   Módulo 4, página 28 — preço contra valor:
 *       FDV/TVL e FDV/Receita Anualizada
 *       < 0,5 muito barato · < 1 barato · até 1,5 justo · > 2 caro
 *
 * Nada aqui fala com a rede nem com o banco.
 */

/* `separarPar` mora em rendimento.js porque é medida da pool, não do método;
 * aqui ela serve pra saber quais tokens o portão precisa julgar. */
import { separarPar } from "./rendimento.js";


/* A REGRA DO 3, parte mensurável: quanto de negociação cada dólar depositado
 * gera por semana.
 *
 * "TVL baixo, volume alto" é uma razão, não dois números soltos — e é ela que
 * diz quanta taxa cada dólar seu vai catar. Uma pool de $500 mil girando $121
 * milhões na semana trabalha 246 vezes o próprio tamanho; uma de $500 milhões
 * girando $50 milhões trabalha um décimo dele.
 *
 * A mediana do mercado em 05/09/2026 era 0,87x, o percentil 90 era 9,9x e o 99
 * era 52x. É por isso que os cortes abaixo são onde estão. */
export const GIRO = { excelente: 20, bom: 5, medio: 1 };

/* O MULTIPLICADOR SIMPLES: volume / TVL.
 *
 * É a conta da primeira tabela da ferramenta "POOLS Defiverso" (a base do Notion
 * do curso), conferida em 07/09/2026 contra três linhas dela, batendo na 12ª
 * casa decimal:
 *
 *     7,7 / 10,85 = 0,709677419355 · 20,8 / 10,85 = 1,917050691244
 *     150,2 / 10,85 = 13,84331797235
 *
 * É também o que a Uniswap mostra na coluna "volume por TVL", e o Lucas ensina
 * a ler na aula "Como Escolher uma Pool":
 *
 *     "1 milhão de TVL e 1 milhão de volume. Não é muito legal. O que eu
 *      gostaria de ver? 1 milhão de TVL e 5 milhões de volume, 6 milhões de
 *      volume. A gente quer ver mais volume do que o TVL."
 *
 * É de onde vem o corte de `bom: 5` aqui embaixo — sorte minha, eu o tinha
 * derivado da distribuição do mercado antes de ouvir a aula, e caiu no mesmo
 * lugar. */
export function giro(volume, tvl) {
  if (!(tvl > 0) || volume == null || !(volume >= 0)) return null;
  return volume / tvl;
}

/* A FAIXA DE TAXA da pool, tirada do texto solto que o DefiLlama entrega.
 *
 * O campo vem de jeitos diferentes conforme o protocolo: "0.3%", "0.30%",
 * "1%", "Standard - 0.25%", "Concentrated - 0.1%", "CL10 - 0.05%". Todos têm o
 * número seguido de %, então é isso que se procura. Falta em ~27% das pools.
 *
 * Por que mostrar: a aula manda olhar.
 *
 *     "E aqui ele deu o de 0,3%, que é normalmente onde a maioria das pools
 *      estão sendo abertas. Atenção a isso, né? Se você está vendo uma pool no
 *      swap que está com 0.05%, não."
 *
 * E porque ela FECHA A CONTA do multiplicador. Conferido em 07/09/2026 contra
 * 14 pools reais:
 *
 *     giro (volume/TVL) × faixa = taxas/TVL ao dia = apyBase/365
 *
 * Bateu exato em 11 das 14 (erro 0% na casa impressa). As três que fugiram são
 * todas aerodrome-slipstream, cuja taxa é dinâmica — a faixa declarada não é a
 * que foi cobrada no dia. Não vira aviso na tela: 3 em 14 é ruído demais pra
 * acusar pool, e a explicação é do protocolo, não um erro de dado.
 *
 * A identidade é a prova aritmética de por que Taxas/TVL ganha de Volume/TVL:
 * a faixa é exatamente o fator que o segundo joga fora. */
export function faixaDeTaxa(meta) {
  if (!meta) return null;
  const m = String(meta).match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  /* Teto de 2%.
   *
   * As faixas reais das AMMs vão de 0,0085% (aerodrome CL1) a 1,5% (CL2000);
   * 2% cobre com folga. Acima disso o número casado quase sempre é outra coisa
   * — apareceu um "5.09%" numa uniswap-v4 cujo apyBase é 317%, e sem volume
   * declarado não dá pra conferir pela identidade (giro × faixa = apyBase/365).
   *
   * Diante de "pode ser uma faixa exótica de hook do V4" e "pode ser um APY
   * que veio no campo errado", não mostrar é melhor que mostrar. Faixa errada
   * na tela vira conta errada na cabeça de quem lê. */
  return Number.isFinite(v) && v > 0 && v <= 2 ? v : null;
}

export function lerFaixa(f) {
  if (f == null) return null;
  if (f <= 0.05) return { faixa: f, nivel: "baixa", texto: `faixa de ${f}% — cobra pouco de quem negocia, então precisa de muito volume pra pagar` };
  if (f < 0.25) return { faixa: f, nivel: "media", texto: `faixa de ${f}%` };
  if (f <= 0.4) return { faixa: f, nivel: "comum", texto: `faixa de ${f}% — é onde a maioria das pools é aberta` };
  return { faixa: f, nivel: "alta", texto: `faixa de ${f}% — cobra caro por troca; costuma ser par volátil ou de pouca liquidez` };
}

/* O MULTIPLICADOR BOM: Taxas 24h / TVL. O que ele chama de "pulo do gato".
 *
 * É o critério principal do método ("Sempre entrar no pool com o maior
 * multiplicador, independente da rede ou par").
 *
 * A conta se reduz: taxa24h = apyBase% × TVL / 365, então
 *
 *     Taxas24h / TVL = apyBase / 36500
 *
 * Ou seja, o multiplicador é o apyBase reescalado. Conferido em 05/09/2026
 * contra pools reais, batendo em 8 casas decimais — e o "tier implícito"
 * (taxa/volume) reproduziu o tier declarado no poolMeta (0,300% vs "0,3%").
 *
 * A consequência prática é grande: o multiplicador NÃO precisa do volume, que
 * só existe em 22% das pools. Toda pool com apyBase tem multiplicador. Foi por
 * ter ranqueado por volume/TVL que três quartos da lista apareciam sem nota.
 *
 * Devolvo em % ao dia porque é a unidade que o método usa pra bater contra a
 * meta mensal (4-5% em bear, 20%+ em bull). */
/* Confirmado pela própria aula, em 07/09/2026. O Lucas ensina os dois e diz
 * qual é melhor:
 *
 *     "Essa questão do TVL por volume [...] Só que para ficar mais eficiente,
 *      nós podemos pegar quanto de taxa foi gerado nessa pool nas últimas 24
 *      horas e dividir pelo TVL, para eu saber quanto está sendo gerado em taxa
 *      para cada dólar investido. ESSE É O PULO DO GATO."
 *
 * Por que é melhor: volume/TVL ignora a faixa de taxa. Duas pools com o mesmo
 * volume, uma cobrando 0,05% e outra 0,30%, têm o mesmo volume/TVL e pagam seis
 * vezes diferente. Taxas/TVL já embute a faixa.
 *
 * Ele também explica por que NÃO ordenar pelo APY anunciado, e é a mesma razão
 * do "chão" existir neste radar — nas palavras dele:
 *
 *     "Esse yield pode ser um pouco ilusório, porque ele está pegando o que
 *      está acontecendo AGORA." */
export function multiplicador(apyBase) {
  if (apyBase == null || !Number.isFinite(apyBase) || apyBase < 0) return null;
  return apyBase / 365;
}

/* O CARTAZ CONTRA O CHÃO — o que a pool anuncia contra o que ela sustentou.
 *
 * ------------------------------------------------------------------------
 * ISTO AQUI ERA UMA META MENSAL, E A META FOI REMOVIDA.
 *
 * Havia neste arquivo `META_MENSAL = { bear: 4, bull: 20 }`, citando
 * "METODOLOGIA_GENESIS, seção 2" — e a tela estampava "meta do método: 4% ao
 * mês". Em 10/09/2026 ele perguntou de onde tinha saído aquilo, porque não
 * reconhecia.
 *
 * Fui procurar o documento: não está nos 44 PDFs do curso, não está nas 84
 * transcrições do canal, não está no disco dele e nunca esteve no
 * repositório. Procurei o NÚMERO também — "4% ao mês", "20% ao mês" — e não
 * achei em nada. Ele decidiu: tira da tela.
 *
 * A LIÇÃO, e ela é sobre mim: uma citação com nome de documento e número de
 * seção PARECE procedência. Aquela linha sobreviveu a semanas de leitura minha
 * porque tinha cara de coisa conferida. Citação que não dá pra abrir não é
 * fonte — é uma afirmação com roupa de fonte, e é pior que nenhuma, porque
 * desliga a desconfiança.
 *
 * ------------------------------------------------------------------------
 * O QUE FICOU, E POR QUE ELE NÃO PRECISA DE RÉGUA NENHUMA
 *
 * A parte útil daquilo nunca foi a meta: era o DESENCONTRO entre o que a pool
 * anuncia e o que ela de fato pagou. Isso é fato sobre a pool, medido nela
 * mesma, e não precisa de alvo externo pra significar alguma coisa.
 *
 * O CORTE DE DUAS VEZES É MEU, e está dito. Anunciar o dobro do que se
 * sustentou é a diferença entre uma oscilação normal e um número que não se
 * segura em pé. */
export const CARTAZ_INFLADO_MEU = 2;

export function cartazContraChao(chao, cartaz, vezes = CARTAZ_INFLADO_MEU) {
  const aoMes = (v) => (v == null ? null : v / 12);
  const doChao = aoMes(chao);
  const doCartaz = aoMes(cartaz);
  const inflado = doChao != null && doCartaz != null && doChao > 0 &&
                  doCartaz >= doChao * vezes;
  return {
    aoMesGarantido: doChao,
    aoMesAnunciado: doCartaz,
    quantasVezes: (doChao > 0 && doCartaz != null) ? doCartaz / doChao : null,
    inflado,
  };
}

export function lerGiro(g) {
  if (g == null) return { nivel: "sem-dado", texto: "não dá pra medir o giro (a pool não informa volume)" };
  if (g >= GIRO.excelente) return { nivel: "excelente", texto: `gira ${g.toFixed(0)}x o próprio tamanho por semana` };
  if (g >= GIRO.bom) return { nivel: "bom", texto: `gira ${g.toFixed(1)}x o próprio tamanho por semana` };
  if (g >= GIRO.medio) return { nivel: "médio", texto: `gira ${g.toFixed(1)}x por semana — na média do mercado` };
  return { nivel: "fraco", texto: `gira só ${g.toFixed(2)}x por semana: muito capital parado pra pouca negociação` };
}

/* ---------------------------------------------------------------------------
 * OS PORTÕES — os cortes binários do método, aplicados ANTES do multiplicador.
 *
 * "Filtros Obrigatórios ANTES do multiplicador" (METODOLOGIA_GENESIS, seção 2).
 * A ordem importa: descartar cedo é o que impede uma pool armadilha de chegar
 * ao topo por ter o maior número.
 * ------------------------------------------------------------------------- */

export const PORTOES = {
  /* TVL mínimo: $500.000.
   *
   * As fontes DISCORDAM: a metodologia escrita diz $500k, o filtro duro do
   * autonomous.py usa $150k, e a persona chama $1M de "blue chip". Fiquei com
   * os $500k porque é o número do documento que se declara "as regras EXATAS"
   * — mas isto é uma escolha entre fontes, não um fato, e o Rayakuza precisa
   * saber que existe a divergência. */
  tvlMinimo: 500e3,

  // Abaixo disso a pool não negocia o suficiente pra gerar taxa que preste.
  volumeMinimo24h: 10e3,

  /* Piso de rendimento, em % ao ano de apyBase.
   *
   * 18,25 é o corte de DESCARTE (multiplicador diário 0,0005). 20 é o "mínimo
   * aceitável" da tabela de classificação. A faixa entre os dois existe e fica
   * marcada como abaixo do mínimo em vez de sumir. */
  rendimentoDescarte: 18.25,
  rendimentoMinimo: 20,

  /* Volume que passa de 5x o TVL num dia é quase sempre spike, não uso.
   * Nesses casos a nota é limitada, e a linha diz que foi limitada e por quê —
   * um número teto sem explicação seria só outro número mentindo. */
  spikeRazao: 5,
  spikeTeto: 365, // % ao ano

  // Nome que contém isso não passa por cálculo nenhum.
  nomesProibidos: ["TEST", "FAKE", "SCAM", "RUG", "HONEYPOT"],
};

/* As listas do método. Fechadas de propósito: são as que o curso usa. */
export const TOKENS = {
  ancoras: ["SOL", "WSOL", "USDC", "USDT", "WBTC", "WETH", "ETH", "BTC", "DAI", "FRAX"],
  blueChips: ["SOL", "WSOL", "ETH", "WETH", "BTC", "WBTC", "JUP", "RAY", "ORCA", "JTO", "PYTH"],
  memecoins: ["BONK", "WIF", "FARTCOIN", "GRIFFAIN", "POPCAT", "TRUMP", "MELANIA", "BOME", "SAMO"],
  estaveis: ["USDC", "USDT", "DAI", "FRAX", "BUSD", "USDS"],
};

const eh = (lista, t) => lista.includes(String(t || "").toUpperCase());

export function classificarToken(simbolo) {
  const t = String(simbolo || "").toUpperCase();
  if (eh(TOKENS.estaveis, t)) return "estável";
  if (eh(TOKENS.blueChips, t)) return "blue-chip";
  if (eh(TOKENS.memecoins, t)) return "memecoin";
  return "desconhecido";
}

/* A escala de nota do método, sobre o rendimento anual de USO (apyBase). */
export function notaDoMetodo(apyBaseAnual) {
  if (apyBaseAnual == null || !Number.isFinite(apyBaseAnual)) return null;
  if (apyBaseAnual >= 200) return { nivel: "excelente", selo: "🔥", texto: "excelente" };
  if (apyBaseAnual >= 100) return { nivel: "muito-bom", selo: "✅", texto: "muito bom" };
  if (apyBaseAnual >= 50) return { nivel: "bom", selo: "👍", texto: "bom" };
  if (apyBaseAnual >= PORTOES.rendimentoMinimo) return { nivel: "razoavel", selo: "⚠️", texto: "razoável — o mínimo aceitável" };
  return { nivel: "reprovado", selo: "❌", texto: "abaixo do mínimo do método" };
}

/* Passa nos portões?
 *
 * Devolve os motivos de reprovação e os avisos separados: reprovar é binário,
 * avisar é contexto. Uma pool que passa com três avisos não é a mesma coisa que
 * uma que passa limpa, e juntar as duas coisas numa flag só apagaria isso.
 */
export function passaNosPortoes(pool, lim = PORTOES) {
  const motivos = [];
  const avisos = [];

  const tokens = separarPar(pool.simbolo).tokens;
  const classes = tokens.map(classificarToken);

  // Nome proibido: antes de qualquer conta.
  const sujo = tokens.find((t) =>
    lim.nomesProibidos.some((p) => String(t).toUpperCase().includes(p)));
  if (sujo) motivos.push(`o token "${sujo}" tem nome de armadilha`);

  if (pool.tvl == null || pool.tvl < lim.tvlMinimo) {
    motivos.push(`TVL abaixo de $${(lim.tvlMinimo / 1e3).toFixed(0)}k`);
  }

  /* Memecoin com memecoin: bloqueio duro, sem exceção de ciclo.
   *
   * Vem ANTES da checagem de âncora porque um par assim reprova nas duas, e
   * "duas memecoins" explica o problema enquanto "sem âncora" só descreve o
   * sintoma. Quem lê o motivo tem que entender por que aquilo é ruim. */
  if (classes.filter((c) => c === "memecoin").length >= 2) {
    motivos.push("par de duas memecoins — a perda por descolamento não tem teto");
  } else if (tokens.length >= 2 && !tokens.some((t) => eh(TOKENS.ancoras, t))) {
    /* Pelo menos uma perna âncora.
     *
     * Só se aplica a par: posição única em token âncora já é âncora, e posição
     * única em token exótico é outro risco, não este. */
    motivos.push("nenhuma perna em token âncora");
  }

  const base = pool.apyBase;
  if (base != null && base < lim.rendimentoDescarte) {
    motivos.push(`rende ${base.toFixed(1)}% ao ano de uso, abaixo do piso de ${lim.rendimentoDescarte}%`);
  } else if (base != null && base < lim.rendimentoMinimo) {
    avisos.push(`${base.toFixed(1)}% ao ano está entre o piso de descarte e o mínimo aceitável do método`);
  }

  if (pool.volume1d != null && pool.volume1d < lim.volumeMinimo24h) {
    motivos.push(`negociou menos de $${(lim.volumeMinimo24h / 1e3).toFixed(0)}k em 24h`);
  }

  /* Pool ativa: volume 24h acima de 10% do TVL.
   * Não reprova — informa. Pool grande e parada ainda pode ser boa renda. */
  if (pool.volume1d != null && pool.tvl > 0) {
    const razao = pool.volume1d / pool.tvl;
    if (razao > lim.spikeRazao) {
      avisos.push(`negociou ${razao.toFixed(1)}x o próprio TVL num dia — isso costuma ser spike, não uso; a nota foi limitada`);
    } else if (razao < 0.1) {
      avisos.push("negociou menos de 10% do TVL no dia: pool parada");
    }
  }

  /* Rendimento alto demais em par de blue-chips é sinal de subsídio.
   *
   * O método é explícito: "APR > 200% em par blue-chip = red flag de subsídio,
   * não oportunidade". É o contrário do que uma ordenação por rendimento faria
   * sozinha, e por isso precisa estar escrito. */
  const soBlueChip = tokens.length >= 2 &&
    classes.every((c) => c === "blue-chip" || c === "estável");
  if (soBlueChip && (pool.apy ?? 0) > 200) {
    avisos.push("mais de 200% ao ano num par de blue-chips: isso é subsídio, não oportunidade");
  }

  if (pool.tvl >= 5e6) avisos.push("TVL acima de $5M: muito sólida");
  else if (pool.tvl >= 1e6) avisos.push("TVL acima de $1M: blue chip pelo critério do método");

  return {
    passa: motivos.length === 0,
    motivos,
    avisos,
    tokens,
    classes,
    // A nota, já com o teto de spike aplicado quando for o caso.
    nota: notaDoMetodo(
      pool.volume1d != null && pool.tvl > 0 && pool.volume1d / pool.tvl > lim.spikeRazao
        ? Math.min(base ?? 0, lim.spikeTeto)
        : base,
    ),
  };
}

/* A perda impermanente, pela fórmula clássica de pool 50/50.
 *
 * Conferida contra a tabela do Módulo 8: reproduz as sete linhas exatas
 * (1,25x → 0,6% ... 5x → 25,5%). `razao` é quanto um token andou em relação ao
 * outro — 2 quer dizer que um dobrou contra o outro.
 *
 * O sinal é negativo porque é perda. E o nome "impermanente" engana: ela só
 * deixa de ser impermanente quando você tira o dinheiro, que é exatamente o
 * que o Módulo 8 avisa em "NUNCA VENDA". */
export function perdaImpermanente(razao) {
  if (!(razao > 0)) return null;
  return (2 * Math.sqrt(razao) / (1 + razao) - 1) * 100;
}

/* Quanto o par teria que se descolar pra a perda comer o rendimento.
 *
 * Responde a pergunta prática que o curso faz de outro jeito: esse rendimento
 * paga o risco? Se a pool rende 20% ao ano e o par se descolar 2x, a perda de
 * 5,7% ainda cabe; se render 3%, não cabe. */
export function descolamentoQueZera(apy) {
  if (!(apy > 0)) return null;
  /* Anda de centésimo em centésimo, contando em INTEIRO e dividindo na hora.
   *
   * Somar 0.01 repetidamente acumula erro de ponto flutuante: a busca devolvia
   * 1.5000000000000004 no lugar de 1.5, e um número que deveria bater exato com
   * a tabela do curso passava a não bater. Some na tela, mas é o tipo de sujeira
   * que vira bug quando alguém compara dois desses valores. */
  for (let centesimos = 101; centesimos <= 1000; centesimos++) {
    const r = centesimos / 100;
    if (Math.abs(perdaImpermanente(r)) >= apy) return r;
  }
  return null;
}

/* Atividade de mercado — Módulo 4, página 19.
 *
 * "O volume deve ser entre 2%-4% nas últimas 24 horas e de 10%-20% nos últimos
 * 7 dias." A regra é sobre o token contra o valor de mercado dele: volume de
 * menos é falta de liquidez (não dá pra sair), volume de mais costuma ser
 * agitação especulativa. */
export function atividadeDeMercado(volume24h, volume7d, valorDeMercado) {
  if (!(valorDeMercado > 0)) return { aplica: false, motivo: "sem valor de mercado" };
  const dia = volume24h != null ? (volume24h / valorDeMercado) * 100 : null;
  const semana = volume7d != null ? (volume7d / valorDeMercado) * 100 : null;
  const dentro = (v, min, max) => (v == null ? null : v >= min && v <= max);
  return {
    aplica: true,
    pctDia: dia, pctSemana: semana,
    diaOk: dentro(dia, 2, 4),
    semanaOk: dentro(semana, 10, 20),
    leitura:
      dia == null ? "sem dado de volume"
      : dia < 2 ? "volume baixo pro tamanho: pode faltar liquidez na hora de sair"
      : dia > 4 ? "volume acima do normal: costuma ser agitação, não uso"
      : "volume dentro da faixa saudável do método",
  };
}

/* Preço contra valor — Módulo 4, página 28.
 *
 * As faixas são as do curso, não minhas: <0,5 muito barato, <1 barato, até 1,5
 * preço justo, >2 caro. Vale tanto pra FDV/TVL quanto pra FDV/Receita. */
export function lerMultiplo(multiplo) {
  if (multiplo == null || !Number.isFinite(multiplo) || multiplo < 0) return null;
  if (multiplo < 0.5) return { faixa: "muito barato", valor: multiplo };
  if (multiplo < 1) return { faixa: "barato", valor: multiplo };
  if (multiplo <= 1.5) return { faixa: "preço justo", valor: multiplo };
  if (multiplo <= 2) return { faixa: "esticado", valor: multiplo };
  return { faixa: "caro", valor: multiplo };
}

export function precoValor({ fdv, tvl, receitaAnual }) {
  const porTvl = fdv > 0 && tvl > 0 ? fdv / tvl : null;
  const porReceita = fdv > 0 && receitaAnual > 0 ? fdv / receitaAnual : null;
  return {
    fdvSobreTvl: lerMultiplo(porTvl),
    fdvSobreReceita: lerMultiplo(porReceita),
  };
}

/* "Receita maior que incentivo" — Módulos 4 e 8.
 *
 * O curso repete isso em três lugares porque é o que separa negócio de
 * subsídio: se o protocolo paga mais em token emitido do que arrecada, ele está
 * comprando o próprio crescimento, e isso tem prazo. */
export function receitaCobreIncentivo(apyBase, apyReward) {
  const base = Number(apyBase) || 0;
  const premio = Number(apyReward) || 0;
  if (base + premio <= 0) return { aplica: false };
  return {
    aplica: true,
    cobre: base > premio,
    fatiaDeUso: (base / (base + premio)) * 100,
  };
}

/* A ficha no formato do estudo de caso do Módulo 4 (página 29, o caso Lido):
 * uma lista de perguntas com resposta curta.
 *
 * O formato importa tanto quanto o conteúdo — é como o Rayakuza já lê, e uma
 * tabela de números novos exigiria que ele traduzisse tudo de cabeça antes de
 * decidir. */
export function fichaDefiverso(pool) {
  const g = giro(pool.volume7d, pool.tvl);
  const leituraGiro = lerGiro(g);
  const real = receitaCobreIncentivo(pool.apyBase, pool.apyReward);
  const zera = descolamentoQueZera(pool.chao ?? pool.apy);

  const itens = [];

  // Regra do 3, na ordem do curso.
  itens.push({
    pergunta: "TVL baixo, volume alto?",
    resposta: leituraGiro.nivel === "sem-dado" ? "sem dado"
      : leituraGiro.nivel === "excelente" || leituraGiro.nivel === "bom" ? "sim"
      : leituraGiro.nivel === "médio" ? "na média" : "não",
    detalhe: leituraGiro.texto,
    peso: leituraGiro.nivel === "excelente" || leituraGiro.nivel === "bom" ? "bom"
      : leituraGiro.nivel === "fraco" ? "ruim" : "neutro",
  });

  itens.push({
    pergunta: "Par bom?",
    resposta: pool.parRisco || "?",
    detalhe: pool.parExplica || "",
    peso: /estável|ligado/.test(pool.parRisco || "") ? "bom"
      : /volátil/.test(pool.parRisco || "") ? "ruim" : "neutro",
  });

  if (real.aplica) {
    itens.push({
      pergunta: "Receita maior que incentivo?",
      resposta: real.cobre ? "sim" : "não",
      /* Sem o caso do 100% a frase se contradizia: "100% vem de taxas, o resto
       * é incentivo" — não existe resto. Frase que não fecha faz o leitor
       * desconfiar do número, e o número estava certo. */
      detalhe: real.fatiaDeUso >= 99.5
        ? "todo o rendimento vem de TAXAS — nada de incentivo"
        : real.fatiaDeUso <= 0.5
          ? "todo o rendimento é INCENTIVO — nenhuma taxa"
          : `${real.fatiaDeUso.toFixed(0)}% do rendimento vem de TAXAS, o resto é INCENTIVO`,
      peso: real.cobre ? "bom" : "ruim",
    });
  }

  if (zera != null) {
    itens.push({
      pergunta: "O rendimento paga o risco de descolamento?",
      resposta: zera >= 2 ? "sim" : "apertado",
      detalhe: `o par teria que se descolar ${zera.toFixed(2)}x pra a perda comer um ano de rendimento`,
      peso: zera >= 2 ? "bom" : "neutro",
    });
  }

  return { giro: g, leituraGiro, itens, zera };
}

/* A frase da pool, escrita na linguagem do método. */
export function porqueDefiverso(pool, ficha) {
  const partes = [];
  const g = ficha.giro;

  if (g != null) {
    const d = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${(v / 1e3).toFixed(0)}k`);
    partes.push(
      `${d(pool.tvl)} parados girando ${d(pool.volume7d)} na semana — ${ficha.leituraGiro.texto}.`,
    );
  }

  if (pool.parExplica) partes.push(`${pool.parRisco}: ${pool.parExplica}.`);

  const real = receitaCobreIncentivo(pool.apyBase, pool.apyReward);
  if (real.aplica && !real.cobre) {
    partes.push(`Atenção: só ${real.fatiaDeUso.toFixed(0)}% do rendimento vem de taxas — o resto é incentivo, e isso tem prazo.`);
  }

  if (ficha.zera != null && ficha.zera < 1.5) {
    partes.push(`O rendimento é fino pro risco: bastaria o par se descolar ${ficha.zera.toFixed(2)}x pra a perda comer um ano.`);
  }

  return partes.join(" ");
}
