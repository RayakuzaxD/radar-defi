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

  /* "A FAIXA DE BULL MARKET" - Bull Market Support Band.
   *
   * ESTE CORTE NAO SAIU DE SLIDE: saiu da boca dele, no video de 20/05/2026,
   * e esta transcrito palavra por palavra em Transcricoes-YouTube:
   *
   *     "a faixa de Bull Market... e uma uniao de duas medias. Se voce coloca
   *      aqui indicadores... Bull Market Support Band... essa uniao dessas duas
   *      faixas aqui de 20 semanas e 21 semanas, uma media movel exponencial e
   *      uma media movel simples"
   *
   * E o gatilho, no mesmo video:
   *
   *     "quando a gente caiu para baixo dela, e justamente a sinalizacao de um
   *      bear market comecando, como foi nos ciclos passados"
   *
   * POR QUE ELA IMPORTA MAIS QUE O RESTO. Contei os conceitos em 84 videos do
   * canal dele: a faixa aparece 183 vezes, em 41 deles. O MVRV aparece 5 vezes,
   * em 3. O radar tinha o MVRV e nao tinha a faixa - media o que eu conhecia,
   * nao o que ele usa.
   *
   * EM SEMANAS, e isso e a diferenca dela. A media de 50 DIAS vira rapido e por
   * isso nao entra no veredito. Vinte semanas sao cinco meses: esta faixa e a
   * linha lenta, a que ele chama de estrutura. */
  faixaDeBull: { sma: 20, ema: 21 },

  /* "CRUZ DE OURO" e "CRUZ DA MORTE" - o cruzamento das medias de 50 e 200 dias.
   *
   * Dele, no video de 09/09/2026:
   *
   *     "A cruz da morte e quando nos temos a media de 50 rompendo a media de
   *      200 de cima para baixo. A cruz de ouro e o inverso, quando nos temos a
   *      media de 50 cruzando a media de 200 de baixo para cima."
   *
   * E a parte que quase todo mundo erra, tambem dele:
   *
   *     "no curto prazo, ele e inverso; no medio longo prazo ele e mais
   *      correlacionado (...) a cruz da morte, ela acaba marcando o fundo
   *      daquele momento (...) a cruz de ouro, marcando um topo local, e ai vem
   *      uma quedinha depois"
   *
   * O radar JA TINHA as duas medias - e nunca as cruzou. Tinha as pecas do
   * sinal e nao o sinal. */
  cruz: { rapida: 50, lenta: 200 },
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
    texto = "MVRV em " + um(v) + " — abaixo de 1, a faixa de fundo";
  } else if (v >= c.acumulaBaixo && v <= c.acumulaAlto) {
    zona = "acumulacao";
    texto = "MVRV em " + um(v) + " — dentro da faixa de acumulação (1,4 a 1,5)";
  } else if (v >= c.topo) {
    zona = "topo";
    texto = "MVRV em " + um(v) + " — acima de 3,5, a faixa de topo";
  } else {
    zona = "meio";
    texto = "MVRV em " + um(v) + " — entre as faixas marcadas";
  }
  return { nome: "MVRV", valor: v, zona, texto };
}

export function lerZscore(v, c = CORTES.zscore) {
  const zona = ondeCai(v, c);
  if (!zona) return null;
  return {
    nome: "MVRV Z-Score", valor: v, zona,
    texto: "Z-Score em " + um(v) + " — " + (
      zona === "fundo" ? "abaixo de 0,5: faixa de fundo"
      : zona === "topo" ? "acima de 3: faixa de topo"
      : "entre 0,5 e 3, fora das pontas"),
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
      : "entre 0,5 e 3, fora das pontas"),
  };
}

export function lerVdd(v, c = CORTES.vdd) {
  const zona = ondeCai(v, c);
  if (!zona) return null;
  return {
    nome: "VDD", valor: v, zona,
    texto: "VDD em " + um(v) + " — " + (
      zona === "fundo" ? "abaixo de 0,5: faixa de fundo"
      : zona === "topo" ? "acima de 3: faixa de topo"
      : "entre 0,5 e 3, fora das pontas"),
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
      um(Math.abs(dist), 1) + "%) — o lado de " +
      (hoje >= media ? "bull" : "bear"),
  };
}

/* A serie diaria fechada em SEMANAS, contando de tras pra frente.
 *
 * De tras pra frente porque a semana que importa e a de hoje: o ultimo ponto
 * tem que ser o preco de agora, nao o de um pedaco de semana que sobrou no
 * comeco da serie. Contar do inicio deixaria a ultima "semana" incompleta e
 * variando de tamanho conforme o dia em que a rodada acontece. */
function emSemanas(precos) {
  const s = (precos || []).filter((x) => Number.isFinite(x) && x > 0);
  const semanas = [];
  for (let i = s.length - 1; i >= 0; i -= 7) semanas.push(s[i]);
  return semanas.reverse();
}

/* A FAIXA DE BULL MARKET - SMA de 20 semanas + EMA de 21 semanas.
 *
 * A faixa e o espaco ENTRE as duas medias, e e por isso que ela e faixa e nao
 * linha: as duas quase se tocam, e o que fica entre elas e uma zona de disputa,
 * nao um ponto de virada. Estar dentro dela nao e estar de um lado nem do
 * outro - e o que o radar chama de "na faixa", e dizer isso e mais honesto do
 * que forcar um lado por meio decimo de diferenca.
 *
 * A EMA E SEMEADA COM A MEDIA DAS 21 PRIMEIRAS SEMANAS, e nao com a primeira.
 * Semear com um ponto so faz esse ponto pesar 22% depois de 16 semanas - e o
 * indicador do dia carregaria, calado, o preco de um dia qualquer de um ano
 * atras.
 *
 * QUANTO A SEMENTE AINDA PESA, MEDIDO e nao estimado (10/09/2026, 400 dias de
 * preco real de Bitcoin): cortar 5 semanas do comeco mexe 0,02% na EMA de
 * hoje. Um pico artificial no primeiro ponto entra linear - 2x move 0,14%,
 * 3x move 0,28%, 100x move 13,9%. Ou seja: a semente absorve OSCILACAO DE
 * PRECO e nao absorve LIXO. Cem vezes nao e mercado, e dado corrompido, e
 * nenhum alisamento devia fingir que conserta isso - isso e trabalho da
 * fonte, nao do indicador. */
export function lerFaixaDeBull(precos, corte = CORTES.faixaDeBull) {
  const sem = emSemanas(precos);
  if (sem.length < corte.ema + 4) return null;

  const sma = sem.slice(-corte.sma).reduce((a, b) => a + b, 0) / corte.sma;

  const alfa = 2 / (corte.ema + 1);
  let ema = sem.slice(0, corte.ema).reduce((a, b) => a + b, 0) / corte.ema;
  for (let i = corte.ema; i < sem.length; i++) ema = sem[i] * alfa + ema * (1 - alfa);

  if (!(sma > 0) || !(ema > 0)) return null;

  const diarios = (precos || []).filter((x) => Number.isFinite(x) && x > 0);
  const hoje = diarios[diarios.length - 1];
  const fundo = Math.min(sma, ema);
  const topo = Math.max(sma, ema);

  const acima = hoje > topo;
  const abaixo = hoje < fundo;
  const dist = acima ? ((hoje / topo) - 1) * 100
             : abaixo ? ((hoje / fundo) - 1) * 100
             : 0;

  return {
    nome: "Faixa de Bull Market",
    sma, ema, fundo, topo, hoje, semanas: sem.length,
    /* "topo" = lado de bull, pra somar igual aos outros indicadores. Dentro da
       faixa e "meio", que e o que ela de fato diz. */
    zona: acima ? "topo" : abaixo ? "fundo" : "meio",
    lado: acima ? "bull" : abaixo ? "bear" : "na-faixa",
    texto: acima
      ? "Bitcoin ACIMA da faixa de bull market (" + um(dist, 1) + "% acima do teto dela) - " +
        "nos ciclos de alta ela funciona como suporte"
      : abaixo
      ? "Bitcoin ABAIXO da faixa de bull market (" + um(Math.abs(dist), 1) + "% abaixo do piso) - " +
        "e o que ele chama de sinalizacao de bear market"
      : "Bitcoin DENTRO da faixa de bull market, entre as duas medias - " +
        "a zona de disputa, sem lado definido",
  };
}

/* A CRUZ DE OURO E A CRUZ DA MORTE.
 *
 * Devolve o estado de hoje (qual media esta por cima) e, quando da pra ver, ha
 * quantos dias foi o ultimo cruzamento.
 *
 * O ALCANCE E LIMITADO E A FUNCAO DIZ ISSO. Com 400 dias de preco da pra
 * calcular a media de 200 em 201 dias - entao um cruzamento mais velho que isso
 * e invisivel daqui. `quandoDias` vem null nesse caso, e o texto fala "ha mais
 * de N dias" em vez de inventar uma data. Nao saber a data e diferente de nao
 * ter havido cruzamento, e o numero na tela nao pode confundir as duas. */
export function lerCruzamento(precos, corte = CORTES.cruz) {
  const s = (precos || []).filter((x) => Number.isFinite(x) && x > 0);
  if (s.length < corte.lenta + 2) return null;

  const mediaEm = (fim, n) => {
    let soma = 0;
    for (let i = fim - n + 1; i <= fim; i++) soma += s[i];
    return soma / n;
  };

  /* O sinal de (rapida - lenta) em cada dia em que as duas existem. */
  const sinais = [];
  for (let i = corte.lenta - 1; i < s.length; i++) {
    sinais.push(mediaEm(i, corte.rapida) >= mediaEm(i, corte.lenta) ? 1 : -1);
  }

  const agora = sinais[sinais.length - 1];
  let virouHa = null;
  for (let k = sinais.length - 1; k > 0; k--) {
    if (sinais[k] !== sinais[k - 1]) { virouHa = sinais.length - 1 - k; break; }
  }

  const ouro = agora === 1;
  const visivel = sinais.length - 1;   // quantos dias da pra enxergar pra tras

  const quando = virouHa == null
    ? "ha mais de " + visivel + " dias (nao da pra ver mais fundo com o historico que eu tenho)"
    : virouHa === 0 ? "hoje"
    : "ha " + virouHa + (virouHa === 1 ? " dia" : " dias");

  return {
    nome: ouro ? "Cruz de Ouro" : "Cruz da Morte",
    tipo: ouro ? "ouro" : "morte",
    quandoDias: virouHa,
    diasVisiveis: visivel,
    rapida: mediaEm(s.length - 1, corte.rapida),
    lenta: mediaEm(s.length - 1, corte.lenta),
    zona: ouro ? "topo" : "fundo",
    lado: ouro ? "bull" : "bear",
    texto: (ouro
        ? "Cruz de Ouro: a media de 50 dias esta ACIMA da de 200, " + quando
        : "Cruz da Morte: a media de 50 dias esta ABAIXO da de 200, " + quando) +
      /* A ressalva e dele, e sem ela o sinal engana: o cruzamento vale pro
         medio prazo, e no curto costuma marcar o contrario. Dar o sinal sem a
         ressalva seria dar metade do que ele ensina. */
      " - o cruzamento vale pro medio prazo; no curto ele costuma " +
      (ouro ? "marcar um topo local, com acomodacao depois"
            : "marcar o fundo daquele momento, com repique depois"),
  };
}

/* AS SÉRIES DO GRÁFICO — preço, média de 50, média de 200 e a faixa de bull.
 *
 * POR QUE ISTO EXISTE. O gráfico do painel desenhava a média de 200 dias como
 * uma LINHA RETA, porque só guardava o valor de hoje. Ele olhou e disse: "o
 * eixo do ciclo é estagnado, parece uma foto (...) seria bom um gráfico de
 * verdade com os indicadores verdadeiros".
 *
 * Estava certo, e o defeito era conceitual: uma média móvel desenhada reta não
 * é uma média móvel, é o valor de hoje fingindo ser uma série. Quem olha vê o
 * preço cruzando uma linha horizontal e conclui coisas erradas sobre quando
 * cruzou — porque a linha de verdade estava em outro lugar naquele dia.
 *
 * A JANELA É DE 200 DIAS, e o número não é estético. É o maior pedaço em que
 * as QUATRO linhas existem ao mesmo tempo, dado que a fonte traz 400 dias:
 *
 *   média de 200   precisa de 200 dias antes de cada ponto  -> sobram 200
 *   faixa de bull  precisa de 21 semanas (147 dias)         -> sobram 253
 *   média de 50    precisa de 50                            -> sobram 350
 *
 * Duzentos é o menor dos três, e é onde nenhuma linha começa no meio do
 * gráfico. Linha que aparece do nada no meio faz o leitor achar que o
 * indicador mudou, quando só faltava histórico.
 *
 * CUSTO: as médias saem de soma corrente (uma passada só). A faixa é
 * recalculada em cada ponto DESENHADO, não em cada dia — são ~100 pontos
 * vezes ~50 semanas, uns 5 mil passos. Cabe folgado até nos 10 milissegundos
 * do plano gratuito. */
export function seriesDoGrafico(precos, pontos = 100, corte = CORTES) {
  const s = (precos || []).filter((x) => Number.isFinite(x) && x > 0);
  const lenta = corte.media.lenta;
  if (s.length < lenta + 10) return null;

  /* Quantos dias dá pra mostrar com TODAS as linhas de pé. */
  const janela = Math.min(s.length - lenta, s.length - corte.faixaDeBull.ema * 7);
  if (janela < 20) return null;
  const inicio = s.length - janela;

  /* Média simples em qualquer ponto, por soma corrente: uma passada, não uma
     multiplicação. Com 200 dias de janela e média de 200, a conta ingênua
     faria 40 mil somas; esta faz 400. */
  const medias = (n) => {
    const fora = [];
    let soma = 0;
    for (let i = 0; i < s.length; i++) {
      soma += s[i];
      if (i >= n) soma -= s[i - n];
      fora.push(i >= n - 1 ? soma / n : null);
    }
    return fora;
  };
  const m50 = medias(corte.media.curso);
  const m200 = medias(lenta);

  /* A faixa num dia qualquer: as semanas contadas de trás pra frente A PARTIR
     DAQUELE DIA — a mesma regra de `emSemanas`, só que ancorada no passado.
     Ancorar sempre em hoje daria a faixa de hoje repetida no gráfico inteiro,
     que é o mesmo defeito da linha reta com outro nome. */
  const faixaEm = (fim) => {
    const sem = [];
    for (let i = fim; i >= 0; i -= 7) sem.push(s[i]);
    sem.reverse();
    if (sem.length < corte.faixaDeBull.ema + 2) return null;
    const sma = sem.slice(-corte.faixaDeBull.sma).reduce((a, b) => a + b, 0) / corte.faixaDeBull.sma;
    const alfa = 2 / (corte.faixaDeBull.ema + 1);
    let ema = sem.slice(0, corte.faixaDeBull.ema).reduce((a, b) => a + b, 0) / corte.faixaDeBull.ema;
    for (let i = corte.faixaDeBull.ema; i < sem.length; i++) ema = sem[i] * alfa + ema * (1 - alfa);
    return [Math.min(sma, ema), Math.max(sma, ema)];
  };

  const quantos = Math.max(20, Math.min(pontos, janela));
  const preco = [], media50 = [], media200 = [], faixaBaixa = [], faixaAlta = [], indices = [];
  for (let k = 0; k < quantos; k++) {
    const i = inicio + Math.round((k / (quantos - 1)) * (janela - 1));
    indices.push(i);
    preco.push(s[i]);
    media50.push(m50[i]);
    media200.push(m200[i]);
    const f = faixaEm(i);
    faixaBaixa.push(f ? f[0] : null);
    faixaAlta.push(f ? f[1] : null);
  }

  return {
    dias: janela,
    /* Quantos dias atrás está cada ponto, contando de hoje. A tela usa isto
       pra pôr data no eixo sem eu ter que guardar 100 datas. */
    atrasDe: indices.map((i) => s.length - 1 - i),
    preco, media50, media200, faixaBaixa, faixaAlta,
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
export function juntarLeituras(doCurso, doRadar, media50, estrutura = null) {
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
    recado = "Os indicadores on-chain não foram lidos hoje — vale só a medida de preço e capital.";
  } else if (concordam) {
    recado = "As duas medidas concordam: os indicadores on-chain e a de preço e capital apontam pro mesmo lado.";
  } else if (discordam) {
    recado = "As duas medidas DISCORDAM: os indicadores on-chain leem " + fase +
      " e o preço com o capital lê " + cicloRadar + ". Nenhuma das duas está escolhendo por você.";
  } else {
    recado = "Os indicadores on-chain estão no meio do caminho — nem fundo nem topo." +
      (doCurso.acumulando
        ? " O MVRV está na faixa de acumulação (1,4 a 1,5)."
        : "");
  }

  /* A média de 50 entra como nota separada e não no confronto: ela vira rápido
     por desenho, e misturá-la ao veredito faria o ciclo balançar toda semana.
     A FAIXA DE BULL MARKET é o contrário — ela é semanal, e é a linha que ele
     chama de estrutura. Por isso ela vira a TERCEIRA RÉGUA, e não uma nota. */
  const faixa = estrutura?.faixaDeBull || null;
  const cruz = estrutura?.cruzamento || null;

  /* "a gente sempre vai corroborar os indicadores e eles sempre vão rimar um
     com o outro" — ele, no vídeo de 20/05/2026. É essa a conta aqui: quantas
     das três réguas apontam pro mesmo lado. Dentro da faixa não conta como
     lado nenhum, porque não é. */
  const lados = [
    sugerido,                                        // a régua do curso
    cicloRadar === "indefinido" ? null : cicloRadar, // a régua do radar
    faixa && faixa.lado !== "na-faixa" ? faixa.lado : null,
  ].filter(Boolean);

  const rimam = lados.length >= 2 && lados.every((x) => x === lados[0]);

  let recadoDaFaixa = null;
  if (faixa) {
    recadoDaFaixa = faixa.texto;
    if (rimam && lados.length === 3) {
      recadoDaFaixa += " · as três réguas apontam pro mesmo lado";
    } else if (faixa.lado !== "na-faixa" && sugerido && faixa.lado !== sugerido) {
      recadoDaFaixa += " · e isso é o CONTRÁRIO do que os indicadores on-chain marcam";
    }
  }

  return {
    curso: doCurso || null,
    radar: doRadar || null,
    media50: media50 || null,
    faixaDeBull: faixa,
    cruzamento: cruz,
    /* Quantas réguas puderam ser lidas, e se elas rimam. Duas de duas rimando
       é diferente de três de três, e a tela precisa poder dizer qual foi. */
    quantasReguas: lados.length,
    rimam,
    recadoDaFaixa,
    concordam, discordam, recado,
  };
}
