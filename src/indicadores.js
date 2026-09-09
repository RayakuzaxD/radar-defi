/* Os indicadores de ciclo QUE O CURSO ENSINA — com os cortes do curso.
 *
 * Este arquivo nasceu de uma correção, e a correção foi dele. Em 08/09/2026 ele
 * perguntou se eu tinha pegado todo o material do curso, fui conferir, e achei
 * escrito no meu próprio `ciclo.js`:
 *
 *     "O curso trata o ciclo como algo que o aluno JÁ SABE. Ele nunca diz como
 *      determinar."
 *
 * **Está errado.** O Portal 2 — Teoria dos Ciclos ensina como determinar, com
 * os indicadores nomeados E com os cortes numéricos. Eu não tinha lido o Portal
 * 2; tinha lido os Módulos 4 e 8 e concluído do que faltava.
 *
 * A lição, que vale além deste arquivo: **"o curso não diz" é uma afirmação
 * sobre o curso inteiro, e eu só tinha lido um pedaço dele.** A frase honesta
 * teria sido "não achei no que li".
 *
 * ------------------------------------------------------------------------
 * O QUE MUDA NO RADAR
 *
 * Antes, o ciclo saía de régua minha: Bitcoin contra a média de 200 dias (uma
 * convenção de mercado) e o estoque global de stablecoin. São boas medidas — e
 * continuam, como confirmação. Mas o veredito passa a sair da régua DELE: a que
 * ele estudou, com os números que ele reconhece.
 *
 * Quando as duas discordam, o radar diz que discordam. Isso não é fraqueza da
 * ferramenta: duas medidas independentes que apontam para lados opostos são a
 * informação mais útil que existe sobre um mercado.
 *
 * ------------------------------------------------------------------------
 * DE ONDE VÊM OS NÚMEROS
 *
 * bitcoin-data.com — aberto, sem chave, com histórico diário desde 2022. Cada
 * indicador tem um endereço próprio.
 *
 * O curso ensina a olhar esses mesmos indicadores em CheckOnChain, Glassnode e
 * Bitcoin Magazine. Nenhum dos três dá API gratuita, e o radar não pede senha
 * de ninguém — então a fonte é outra, e o número é o mesmo.
 *
 * Nada aqui fala com a rede: entram leituras, sai um veredito.
 */

/* Os cortes, copiados do Portal 2 — Teoria dos Ciclos, seção "Indicadores".
 *
 * NÃO SÃO MEUS, e é por isso que estão todos num lugar só, com a citação ao
 * lado. Se um dia alguém quiser mexer, tem que estar mexendo contra o curso
 * conscientemente — não por engano de leitura. */
export const CORTES = {
  /* "MVRV — Market Value / Realized Value.
   *  Comprar abaixo de 1 (Fundo) · Acumulação (1.4 - 1.5) · Vender acima de 3.5 (Topo)" */
  mvrv: { fundo: 1.0, acumulaBaixo: 1.4, acumulaAlto: 1.5, topo: 3.5 },

  /* "MVRV - Z SCORE — Fundo normalmente - de 0,5 · Topo normalmente + de 3" */
  zscore: { fundo: 0.5, topo: 3.0 },

  /* "The Puell Multiple — Múltiplo dos Mineradores" com os marcos 0,5 / 1 / 2 / 3
   *  no slide. O 0,5 e o 3 são as pontas; 1 e 2 são passagem. */
  puell: { fundo: 0.5, topo: 3.0 },

  /* "Value Days Destroyed (VDD) — Abaixo de 0,5 - Fundo · Acima de 3 - Topo" */
  vdd: { fundo: 0.5, topo: 3.0 },

  /* "SMA 50 — Abaixo = Bear market · Acima = Bull Market"
   *
   * O radar já usava a média de 200 dias, que é convenção de mercado e não do
   * curso. As duas ficam: a de 50 é a do curso e vira mais rápido; a de 200 é o
   * eixo lento que impede repique de virar "bull". */
  media: { curso: 50, lenta: 200 },
};

/* Onde um número cai, entre fundo e topo. Devolve "fundo", "topo", "acumulacao"
 * ou "meio" — e null quando não há leitura, que é diferente de "no meio". */
function ondeCai(v, corte) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v <= corte.fundo) return "fundo";
  if (v >= corte.topo) return "topo";
  return "meio";
}

const um = (v, casas = 2) =>
  (v == null || !Number.isFinite(v) ? "?" : Number(v).toFixed(casas).replace(".", ","));

/* MVRV é o único com três faixas, porque o curso deu nome à do meio. */
export function lerMvrv(v, c = CORTES.mvrv) {
  if (v == null || !Number.isFinite(v)) return null;
  let zona, texto;
  if (v < c.fundo) {
    zona = "fundo";
    texto = "MVRV em " + um(v) + " — abaixo de 1, a faixa que o curso chama de fundo";
  } else if (v >= c.acumulaBaixo && v <= c.acumulaAlto) {
    zona = "acumulacao";
    texto = "MVRV em " + um(v) + " — dentro da faixa de acumulação do curso (1,4 a 1,5)";
  } else if (v >= c.topo) {
    zona = "topo";
    texto = "MVRV em " + um(v) + " — acima de 3,5, a faixa de topo do curso";
  } else {
    zona = "meio";
    texto = "MVRV em " + um(v) + " — entre as faixas que o curso marca";
  }
  return { nome: "MVRV", valor: v, zona, texto };
}

export function lerZscore(v, c = CORTES.zscore) {
  const zona = ondeCai(v, c);
  if (!zona) return null;
  return {
    nome: "MVRV Z-Score", valor: v, zona,
    texto: "Z-Score em " + um(v) + " — " + (
      zona === "fundo" ? "abaixo de 0,5, onde o curso marca fundo"
      : zona === "topo" ? "acima de 3, onde o curso marca topo"
      : "entre 0,5 e 3, sem marca do curso"),
  };
}

export function lerPuell(v, c = CORTES.puell) {
  const zona = ondeCai(v, c);
  if (!zona) return null;
  return {
    nome: "Puell Multiple", valor: v, zona,
    texto: "Puell em " + um(v) + " — " + (
      zona === "fundo" ? "abaixo de 0,5: o que os mineradores recebem está apertado, marca de fundo"
      : zona === "topo" ? "acima de 3: mineradores recebendo muito, marca de topo"
      : "entre 0,5 e 3, sem marca do curso"),
  };
}

export function lerVdd(v, c = CORTES.vdd) {
  const zona = ondeCai(v, c);
  if (!zona) return null;
  return {
    nome: "VDD", valor: v, zona,
    texto: "VDD em " + um(v) + " — " + (
      zona === "fundo" ? "abaixo de 0,5, onde o curso marca fundo"
      : zona === "topo" ? "acima de 3, onde o curso marca topo"
      : "entre 0,5 e 3, sem marca do curso"),
  };
}

/* A SMA 50, que é a média do curso.
 *
 * Recebe a série de preços (a mesma que o resto do ciclo usa) e devolve o lado.
 * Sem banda morta de propósito: o curso é categórico — "Abaixo = Bear market,
 * Acima = Bull Market". A banda morta mora na média de 200, que é minha. */
export function lerMedia50(precos, n = CORTES.media.curso) {
  const s = (precos || []).filter((x) => Number.isFinite(x) && x > 0);
  if (s.length < n) return null;
  const janela = s.slice(-n);
  const media = janela.reduce((a, b) => a + b, 0) / n;
  const hoje = s[s.length - 1];
  if (!(media > 0)) return null;
  const dist = ((hoje / media) - 1) * 100;
  return {
    nome: "SMA 50", valor: media, hoje,
    zona: hoje >= media ? "topo" : "fundo",   // "topo" = lado de bull, pra somar igual aos outros
    lado: hoje >= media ? "bull" : "bear",
    texto: "Bitcoin " + (dist >= 0 ? "acima" : "abaixo") + " da média de 50 dias (" +
      um(Math.abs(dist), 1) + "%) — o curso lê isso como " +
      (hoje >= media ? "bull" : "bear"),
  };
}

/* A temporada das altcoins, pela fórmula do curso: ALTS/BTC.
 *
 * "A fórmula mágica: ALTS/BTC" — o Portal 2 mostra o dinheiro descendo de
 * Bitcoin para Ethereum e daí para as altcoins. O que dá pra medir sem
 * assinatura é a razão ETH/BTC, que é o primeiro degrau dessa descida.
 *
 * TRINTA DIAS, e não um: a razão balança todo dia, e o curso fala de uma
 * ESTAÇÃO. Um dia de ETH forte não é temporada de altcoin nenhuma.
 *
 * O corte de 5% é MEU, não do curso — o curso mostra o gráfico e não dá número.
 * Está marcado como meu justamente por isso. */
export function lerAltseason(razaoHoje, razaoAntes, corteMeu = 5) {
  if (!(razaoHoje > 0) || !(razaoAntes > 0)) return null;
  const varia = ((razaoHoje / razaoAntes) - 1) * 100;
  const lado = varia >= corteMeu ? "alts" : (varia <= -corteMeu ? "btc" : "parado");
  return {
    nome: "ETH/BTC", valor: razaoHoje, variacao: varia, lado,
    texto: "ETH/BTC " + (varia >= 0 ? "subiu " : "caiu ") + um(Math.abs(varia), 1) +
      "% em 30 dias — " + (
        lado === "alts" ? "o dinheiro está descendo do Bitcoin, que é como a temporada das altcoins começa"
        : lado === "btc" ? "o dinheiro está voltando pro Bitcoin"
        : "sem movimento claro entre os dois"),
  };
}

/* O VEREDITO DO CURSO: junta os quatro indicadores de fundo/topo.
 *
 * POR CONTAGEM, e não por média: os indicadores têm escalas diferentes (MVRV
 * anda entre 0,5 e 4; Puell entre 0,3 e 6) e uma média entre eles seria um
 * número sem significado nenhum, com cara de precisão.
 *
 * A regra da MAIORIA existe pelo mesmo motivo do resto do radar: um indicador
 * sozinho grita, quatro juntos raramente concordam por acaso. Empate não vira
 * veredito — vira "sem consenso", que é uma resposta. */
export function vereditoDoCurso(lidos) {
  const bons = (lidos || []).filter(Boolean);
  if (!bons.length) return { fase: "sem-dado", firmeza: "nenhum indicador foi lido", quantos: 0, porque: [] };

  const conta = { fundo: 0, topo: 0, meio: 0, acumulacao: 0 };
  bons.forEach((x) => { if (conta[x.zona] != null) conta[x.zona]++; });

  const porque = bons.map((x) => x.texto);
  const total = bons.length;

  /* Acumulação conta pro lado do fundo: o curso a descreve como a faixa em que
     se compra, logo acima do fundo — não como uma terceira direção. */
  const baixo = conta.fundo + conta.acumulacao;

  /* ACUMULAÇÃO É BANDEIRA, NÃO FASE — e isto foi um conserto de desenho.
   *
   * Só o MVRV tem faixa de acumulação; os outros três não têm zona equivalente.
   * Então "a maioria marca acumulação" era um estado que nunca aconteceria: no
   * melhor caso é 1 de 4, que a regra da maioria descarta. Era código morto com
   * cara de regra.
   *
   * Agora ela viaja como bandeira ao lado da fase. Assim a tela consegue dizer
   * "o meio do caminho, MAS o MVRV está na faixa de acumulação" — que é
   * exatamente o que o mercado marcava em 08/09/2026, e que a fase sozinha
   * jogaria fora. */
  const acumulando = conta.acumulacao > 0;

  const base = { quantos: total, contagem: conta, acumulando, porque };

  if (conta.topo > baixo && conta.topo > conta.meio) {
    return { ...base, fase: "topo",
             firmeza: conta.topo + " de " + total + " indicadores marcam topo" };
  }
  if (baixo > conta.topo && baixo > conta.meio) {
    return { ...base, fase: "fundo",
             firmeza: baixo + " de " + total + " indicadores marcam fundo" };
  }
  return {
    ...base, fase: "meio",
    firmeza: "os indicadores não estão nas pontas: " + conta.meio + " de " + total +
      " no meio do caminho" + (acumulando ? ", com o MVRV na faixa de acumulação" : ""),
  };
}

/* O CONFRONTO: a régua do curso contra a régua do radar.
 *
 * As duas continuam existindo, e é de propósito. Quando concordam, a leitura
 * fica mais firme do que qualquer uma sozinha. Quando discordam, o radar DIZ
 * que discordam — porque a discordância é a informação, e escolher uma delas
 * calado seria esconder o que mais importa saber. */
export function juntarLeituras(doCurso, doRadar, media50) {
  const fase = doCurso?.fase;
  const cicloRadar = doRadar?.ciclo;

  /* O que cada fase do curso sugere sobre o ciclo, para poder comparar. */
  const sugerido =
    fase === "topo" ? "bull" :
    fase === "fundo" ? "bear" : null;

  const concordam = sugerido != null && cicloRadar != null && sugerido === cicloRadar;
  const discordam = sugerido != null && cicloRadar != null &&
    cicloRadar !== "indefinido" && sugerido !== cicloRadar;

  let recado;
  if (!doCurso || fase === "sem-dado") {
    recado = "Os indicadores do curso não foram lidos hoje — vale só a medida do radar.";
  } else if (concordam) {
    recado = "As duas réguas concordam: a do curso e a do radar apontam pro mesmo lado.";
  } else if (discordam) {
    recado = "As duas réguas DISCORDAM. O curso lê " + fase +
      " e o radar lê " + cicloRadar + ". Nenhuma das duas está escolhendo por você.";
  } else {
    recado = "Os indicadores do curso estão no meio do caminho — nem fundo nem topo." +
      (doCurso.acumulando
        ? " O MVRV está na faixa que o curso chama de acumulação (1,4 a 1,5)."
        : "");
  }

  /* A média de 50 entra como nota separada e não no confronto: ela vira rápido
     por desenho, e misturá-la ao veredito faria o ciclo balançar toda semana. */
  return {
    curso: doCurso || null,
    radar: doRadar || null,
    media50: media50 || null,
    concordam, discordam, recado,
  };
}
