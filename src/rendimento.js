/* O que uma pool REALMENTE paga — e o que dela dá pra contar.
 *
 * Este arquivo existe por causa de um número. Em 05/09/2026, medindo 43 pools
 * grandes de verdade:
 *
 *   uniswap-v3/WETH-USDC   cartaz 74,0%   chão 7,9%   → somem 66 pontos
 *   orca-dex/SOL-USDC      cartaz 65,8%   chão 22,5%  → somem 43 pontos
 *   raydium-amm/WSOL-USDC  cartaz 74,8%   chão 31,9%  → somem 43 pontos
 *
 * Ranquear pelo APY anunciado e ranquear pelo que a pool garante dão listas
 * quase disjuntas: 3 nomes em comum de 8. Quem escolhe pool pelo cartaz está
 * escolhendo por um número que a pool não se comprometeu a pagar.
 *
 * Daí a medida central não ser a média, e sim o CHÃO: o rendimento que a pool
 * superou em 9 de cada 10 dias. Pra quem vive de renda, o que importa não é o
 * teto — é o que entra no pior mês.
 *
 * Nada aqui fala com a rede nem com o banco: entra série, sai medida.
 */

export const LIMIARES_POOL = {
  // Abaixo disso não dá pra dizer nada: 20 dias é o mínimo pra um chão
  // significar alguma coisa, e a própria pool ainda está se acomodando.
  diasMinimos: 20,
  // Emissão acima disso quer dizer que o rendimento tem prazo de validade.
  emitidoAlto: 60,
  // Distância entre cartaz e chão que já configura promessa que não se cumpre.
  abismoGrave: 10,
  // Oscilação que separa "renda" de "aposta".
  oscilacaoAlta: 8,
  // Pool com menos dias que isto é obra recente, sem histórico pra julgar.
  idadeNova: 21,
};

const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

/* Volume abaixo disso não diz nada.
 *
 * A razão "volume de ontem contra a média da semana" vira ruído puro quando o
 * volume é de trocados: em 05/09/2026 as maiores quedas e altas do mercado eram
 * todas pools com volume de ~$0, oscilando entre 0% e 700% sem significar nada.
 * Com $1M na semana a razão passa a medir movimento de verdade. */
export const VOLUME_MINIMO = 1e6;

/* O volume está caindo, subindo, ou parado?
 *
 * Compara o volume de ontem com a média diária da semana. Numa pool de troca o
 * rendimento VEM do volume, então esta é a única medida do radar que enxerga o
 * futuro: o volume cai primeiro, o rendimento cai depois.
 *
 * Devolve null em dois casos diferentes que não podem ser confundidos:
 * pool sem volume nenhum (empréstimo, staking — não negociam, e dizer "volume
 * caindo" nelas seria besteira) e volume pequeno demais pra razão significar. */
export function tendenciaDeVolume(volume1d, volume7d, minimo = VOLUME_MINIMO) {
  if (volume1d == null || volume7d == null) return { aplica: false, motivo: "não negocia" };
  if (volume7d < minimo) return { aplica: false, motivo: "volume pequeno demais pra medir" };
  const mediaDiaria = volume7d / 7;
  if (!(mediaDiaria > 0)) return { aplica: false, motivo: "sem volume na semana" };
  const razao = (volume1d / mediaDiaria) * 100;
  return {
    aplica: true,
    volume1d,
    mediaDiaria,
    razao,
    // 20 pontos de folga pros dois lados: volume de fim de semana varia sozinho,
    // e chamar isso de tendência encheria a tela de alarme falso.
    direcao: razao >= 120 ? "subindo" : razao <= 80 ? "caindo" : "parado",
  };
}

/* O valor que a série supera em (1-p) dos dias.
 *
 * Interpolação nenhuma de propósito: com 30 pontos, escolher o elemento real
 * mais próximo é mais honesto que inventar um valor entre dois dias que
 * existiram. O número que sai daqui é um rendimento que a pool de fato pagou
 * num dia de verdade. */
export function percentil(serie, p) {
  if (!serie?.length) return null;
  const s = [...serie].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(s.length * p)))];
}

export function desvio(serie) {
  if (!serie || serie.length < 2) return null;
  const m = media(serie);
  return Math.sqrt(media(serie.map((x) => (x - m) ** 2)));
}

/* Mede uma pool a partir da série diária dela.
 *
 * `serie` são pontos {dia, apy, tvl} em ordem crescente de data. `cartaz` é o
 * APY que a pool anuncia agora — vem da lista de pools, não da série, porque é
 * exatamente o número que o Rayakuza veria no site e é dele que queremos medir a
 * distância. */
export function medirPool(serie, {
  cartaz = null, emitidoPct = null, idade = null,
  volume1d = null, volume7d = null,
} = {}) {
  const pontos = (serie || []).filter((p) => Number.isFinite(p?.apy));
  const dias = pontos.length;
  if (dias < LIMIARES_POOL.diasMinimos) {
    // Sem série não se inventa medida. Só se diz que não dá pra julgar — e a
    // classe `nova` existe justamente pra essas não sumirem da tela nem
    // aparecerem com números que não existem.
    return {
      dias, medivel: false, classe: idade != null && idade <= LIMIARES_POOL.idadeNova ? "nova" : "sem-dado",
      cartaz, emitido: emitidoPct, idade, chao: null, realizado: null,
      oscilacao: null, pior: null, abismo: null, tendencia: null,
      apyOntem: null, apySemana: null, apyMes: null, trajetoria: null,
      volume: tendenciaDeVolume(volume1d, volume7d),
    };
  }

  const apys = pontos.map((p) => p.apy);
  const ultimos30 = apys.slice(-30);

  const chao = percentil(ultimos30, 0.1);
  const realizado = media(ultimos30);
  const oscilacao = desvio(ultimos30);
  const pior = Math.min(...ultimos30);

  /* A trajetória: ontem, a semana, o mês.
   *
   * Uma foto parada não responde a pergunta que se faz antes de entrar — isto
   * está começando a subir, ou já passou o melhor? Três médias em janelas
   * diferentes respondem de relance: se ontem > semana > mês, está acelerando;
   * na ordem inversa, murchando.
   *
   * São médias e não valores pontuais de propósito: o APY de um dia específico
   * balança demais pra servir de comparação. */
  const janela = (n) => (apys.length ? media(apys.slice(-n)) : null);
  const apyOntem = janela(1);
  const apySemana = janela(7);
  const apyMes = janela(30);

  /* A distância entre o que a pool anuncia e o que ela garante.
   * É o número que responde "quanto desse cartaz eu posso contar?". */
  const abismo = cartaz != null && chao != null ? cartaz - chao : null;

  /* Subindo ou caindo: a última semana contra as três anteriores.
   * Serve pro Rayakuza ver movimento sem precisar de gráfico. */
  const semana = ultimos30.slice(-7);
  const antes = ultimos30.slice(0, -7);
  const tendencia = semana.length >= 3 && antes.length >= 5
    ? media(semana) - media(antes)
    : null;

  return {
    dias, medivel: true, idade,
    cartaz, chao, realizado, oscilacao, pior, abismo, tendencia,
    apyOntem, apySemana, apyMes,
    // "acelerando" e "murchando" só quando as TRÊS janelas concordam. Duas
    // concordando e uma discordando é oscilação, não trajetória.
    trajetoria:
      apyOntem > apySemana && apySemana > apyMes ? "acelerando"
      : apyOntem < apySemana && apySemana < apyMes ? "murchando"
      : "estável",
    volume: tendenciaDeVolume(volume1d, volume7d),
    emitido: emitidoPct,
    classe: classificar({ chao, oscilacao, abismo, emitido: emitidoPct, idade }),
  };
}

/* Separa o par nos tokens que o compõem.
 *
 * O DefiLlama entrega tudo amassado num campo só ("USDCAD-USDC", "WSOL-USELESS",
 * "STEAKUSDG"), e amassado não dá pra ler: o Rayakuza pediu pra "saber qual a pool
 * e onde estão usando". Quais tokens estão dentro é a primeira coisa que decide
 * se ele entra — um par de duas stablecoins e um par com um token desconhecido
 * são riscos completamente diferentes.
 *
 * Devolve também se é par ou posição única, porque isso muda o risco: em par,
 * se um token andar diferente do outro, você perde valor mesmo com a pool
 * pagando (é a tal perda impermanente). */
export function separarPar(simbolo) {
  const bruto = String(simbolo || "").trim();
  if (!bruto) return { tokens: [], tipo: "?", texto: "" };

  // Os separadores que aparecem na prática. O hífen é o comum; a barra e o
  // espaço aparecem em alguns protocolos.
  const tokens = bruto.split(/[-/\s]+/).map((t) => t.trim()).filter(Boolean);

  return {
    tokens,
    tipo: tokens.length >= 2 ? "par" : "único",
    texto: tokens.join(" + "),
  };
}

/* As stablecoins mais comuns, pra reconhecer par estável sem depender de a API
 * marcar. A lista é curta e incompleta de propósito: ela só é usada pra dizer
 * "os dois lados parecem stablecoin", nunca pra afirmar que é seguro. */
const ESTAVEIS = /^(USDC|USDT|DAI|USDS|FRAX|FRXUSD|USDE|SUSDE|PYUSD|USDA|GHO|LUSD|CRVUSD|USDD|TUSD|USDP|MSUSD|PMUSD|USDG|AUSD|USDAI|SUSDAI|USDCAD)$/i;

/* Que tipo de risco esse par carrega, pelos tokens que tem dentro. */
export function riscoDoPar(simbolo, ilRisk = null) {
  const { tokens, tipo } = separarPar(simbolo);
  if (!tokens.length) return { rotulo: "?", explica: null };

  const estaveis = tokens.filter((t) => ESTAVEIS.test(t)).length;

  if (tipo === "único") {
    return estaveis === 1
      ? { rotulo: "stablecoin", explica: "posição única em stablecoin — não tem perda por variação de preço entre tokens" }
      : { rotulo: "token único", explica: "posição única: você fica exposto ao preço desse token" };
  }
  if (estaveis === tokens.length) {
    return { rotulo: "par estável", explica: "os dois lados são stablecoin — pouca perda por descolamento" };
  }
  if (estaveis > 0) {
    return { rotulo: "meio estável", explica: "um lado é stablecoin e o outro não: se o outro andar, você perde valor mesmo a pool pagando" };
  }
  return {
    rotulo: ilRisk === "no" ? "par ligado" : "par volátil",
    explica: ilRisk === "no"
      ? "os dois tokens andam juntos, então a perda por descolamento é pequena"
      : "os dois lados variam de preço: dá pra perder valor mesmo com a pool pagando bem",
  };
}

/* Em que categoria essa pool cai, do ponto de vista de quem vive de renda.
 *
 * A ordem importa: `loteria` vem antes de `alugada` porque uma pool que não
 * cumpre o que anuncia é um problema maior que uma que cumpre mas tem prazo.
 * E `nova` vem primeiro de todas — sem histórico, nenhuma outra classe pode ser
 * afirmada. */
export function classificar({ chao, oscilacao, abismo, emitido, idade }, lim = LIMIARES_POOL) {
  if (idade != null && idade <= lim.idadeNova) return "nova";
  if (chao == null) return "sem-dado";

  const instavel = (oscilacao != null && oscilacao >= lim.oscilacaoAlta) ||
                   (abismo != null && abismo >= lim.abismoGrave);
  if (instavel) return "loteria";

  if (emitido != null && emitido >= lim.emitidoAlto) return "alugada";
  return "firme";
}

export const EXPLICACAO = {
  firme:
    "paga de forma parecida todo dia, e o rendimento vem de taxas",
  alugada:
    "paga de forma parecida todo dia, mas com incentivo — tem prazo, e acaba sem aviso",
  loteria:
    "o número grande é média de dias muito bons com dias muito ruins",
  nova:
    "montada há pouco tempo: ainda não pagou o suficiente pra se saber o que ela paga",
  "sem-dado":
    "sem histórico suficiente pra medir",
};

/* A frase que vai na linha, escrita com os números daquela pool.
 *
 * Existe porque o Rayakuza pediu "o porquê escrito em cada linha". Uma tabela de
 * números obriga a fazer a leitura de cabeça toda vez; a frase faz a leitura
 * uma vez e deixa escrita. */
export function porque(m) {
  const p = (v, d = 1) => (v == null ? "?" : v.toFixed(d));

  if (m.classe === "nova") {
    /* A idade vem do DefiLlama, não do tamanho da nossa série.
     *
     * Usar `m.dias` daria a idade errada em dois casos: uma pool velha que
     * entrou no nosso universo ontem apareceria como recém-nascida, e uma pool
     * nova semeada com o gráfico inteiro apareceria mais velha do que é. A
     * idade é uma propriedade dela, não do nosso banco. */
    const d = m.idade ?? m.dias;
    const quando = d == null ? "há poucos dias"
      : d === 1 ? "ontem"
      : `há ${d} dias`;
    // Anunciar 0% e chamar isso de "anuncia" fica esquisito: a pool não está
    // prometendo nada, e a frase precisa dizer isso em vez de fingir promessa.
    const oQueDiz = (m.cartaz ?? 0) < 0.05
      ? "Ainda não declara rendimento"
      : `Anuncia ${p(m.cartaz)}%, mas não existe histórico pra saber se paga isso`;
    return `Montada ${quando}. ${oQueDiz}.`;
  }
  if (!m.medivel) return "Sem histórico suficiente pra medir.";

  const partes = [];

  if (m.abismo != null && m.abismo >= LIMIARES_POOL.abismoGrave) {
    partes.push(`Anuncia ${p(m.cartaz)}% mas em 9 de cada 10 dias pagou ${p(m.chao)}% ou mais — ${p(m.abismo)} pontos do cartaz não dá pra contar.`);
  } else {
    partes.push(`Anuncia ${p(m.cartaz)}% e sustenta: em 9 de cada 10 dias pagou ${p(m.chao)}% ou mais.`);
  }

  if (m.pior != null) partes.push(`Pior dia: ${p(m.pior)}%.`);

  if (m.emitido != null && m.emitido >= LIMIARES_POOL.emitidoAlto) {
    partes.push(`${p(m.emitido, 0)}% disso é incentivo — quando o incentivo parar, o rendimento vai junto.`);
  }

  if (m.trajetoria === "acelerando") {
    partes.push(`Vem acelerando: ${p(m.apyMes)}% no mês, ${p(m.apySemana)}% na semana, ${p(m.apyOntem)}% ontem.`);
  } else if (m.trajetoria === "murchando") {
    partes.push(`Vem murchando: ${p(m.apyMes)}% no mês, ${p(m.apySemana)}% na semana, ${p(m.apyOntem)}% ontem.`);
  } else if (m.tendencia != null && Math.abs(m.tendencia) >= 1) {
    partes.push(m.tendencia > 0
      ? `A última semana pagou ${p(m.tendencia)} pontos a mais que as anteriores.`
      : `A última semana pagou ${p(-m.tendencia)} pontos a menos que as anteriores.`);
  }

  /* O volume vem por último porque é o aviso que chega ANTES do rendimento cair.
   * Numa pool de troca o rendimento vem do volume: ele cai primeiro, o
   * rendimento segue. É a única leitura do radar que olha pra frente. */
  if (m.volume?.aplica && m.volume.direcao !== "parado") {
    partes.push(m.volume.direcao === "caindo"
      ? `⚠️ O volume de negociação caiu pra ${p(m.volume.razao, 0)}% da média da semana — o rendimento costuma seguir.`
      : `O volume subiu pra ${p(m.volume.razao, 0)}% da média da semana.`);
  }

  return partes.join(" ");
}

/* Ordena pelo que interessa a quem vive de renda: o chão, penalizado pela
 * oscilação. Duas pools com o mesmo chão, ganha a que balança menos. */
export function ordenarPorConfianca(medidas) {
  return [...medidas].sort((a, b) => nota(b) - nota(a));
}

export function nota(m) {
  if (!m.medivel || m.chao == null) return -1;
  return m.chao / (1 + (m.oscilacao ?? 0) / 10);
}
