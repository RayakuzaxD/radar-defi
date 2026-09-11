/* Em que ciclo o mercado está — e o quanto disso é medida, não palpite.
 *
 * Esta é a última peça do método que faltava, e é a que governa mais coisa.
 *
 * AQUI HAVIA UMA CITAÇÃO QUE EU NÃO CONSIGO ABRIR: "Meta de rendimento: 4-5%
 * ao mês em bear market, 20%+ ao mês em bull", atribuída a um
 * METODOLOGIA_GENESIS que não existe em lugar nenhum — nem nos 44 PDFs, nem
 * nas 84 transcrições, nem no disco dele. Ele perguntou de onde tinha saído,
 * eu procurei, não achei, e ele mandou tirar. A meta saiu do radar inteiro.
 *
 * O ciclo continua importando, e por outro motivo: ele muda a divisão da
 * carteira no B.A.R.C.A. (essa sim está no material, com os números) e muda o
 * que é razoável esperar de uma pool. O que ele NÃO faz mais é comparar
 * rendimento contra um alvo que ninguém sabe de onde veio.
 *
 * O curso trata o ciclo como algo que o aluno JÁ SABE. Ele nunca diz como
 * determinar. Então este arquivo não inventa a regra do curso: ele mede duas
 * coisas verificáveis e diz o que elas mostram — inclusive quando discordam.
 *
 * A decisão continua sendo do Rayakuza. O `/ciclo bull` no Telegram sobrepõe
 * qualquer leitura daqui, e o padrão (`auto`) usa a leitura MARCADA como
 * leitura. Um número que se apresenta como palpite é mais útil que um palpite
 * que se apresenta como número.
 *
 * Nada aqui fala com a rede nem com o banco: entram séries, sai leitura.
 */

/* Os dois eixos, e por que são dois.
 *
 * PREÇO e CAPITAL respondem perguntas diferentes, e é justamente quando
 * discordam que se aprende algo. Preço subindo com capital parado é o começo de
 * uma alta — ou um repique. Nenhum dos dois sozinho sabe qual.
 *
 * Preço: o Bitcoin contra a própria média de 200 dias. A média de 200 dias é
 * convenção de mercado, não regra do curso — está aqui por ser estável: medida
 * de 25/04/2025 a 06/09/2026, com banda morta de ±5%, a linha virou de lado
 * poucas vezes em 300 dias, e as viradas coincidiram com mudanças que qualquer
 * um reconheceria (o topo de novembro de 2025, o fundo de agosto de 2026).
 *
 * Capital: o estoque total de stablecoin no mundo, em 30 dias. É o dinheiro que
 * entrou ou saiu do cripto de verdade — stablecoin não valoriza, então subir só
 * acontece quando alguém depositou.
 *
 * Os cortes do capital saíram da distribuição dos últimos 3 anos:
 *     p10 -0,62%   p25 +0,55%   mediana +2,12%   p75 +3,98%   p90 +6,37%
 *
 * A mediana ser +2,12% é o detalhe que importa: o estoque de stablecoin
 * quase sempre cresce. Então "positivo" não é sinal de nada — o normal é
 * positivo. Só acima do p75 é entrada de verdade, e encolher (abaixo de zero,
 * perto do p10) é raro o bastante pra ser saída de verdade. */
export const CICLO = {
  janelaMedia: 200,     // dias da média móvel do Bitcoin
  banda: 0.05,          // ±5% em volta da média: dentro disso é "nem uma coisa nem outra"
  /* Quantos dias atrás se olha pra saber se a MÉDIA está subindo ou caindo.
   *
   * Este número existe por uma correção do Rayakuza em 08/09/2026, e ela estava
   * certa. Meu eixo dizia "bull" só porque o preço tinha cruzado a média —
   * e ele:
   *
   *     "para bull precisaria ter uma sequência de alta. Caímos, lateralizamos,
   *      mas ainda não teve a sequência de subida. Teve agora uma leve subida e
   *      lateralização nas últimas semanas, mas ainda não se sustentou."
   *
   * Conferi antes de concordar. Naquele dia: preço 13% acima da média, MAS a
   * média caindo (82.753 → 69.816 em quatro meses, -0,58% em 30 dias), topos
   * descendentes (96.027 → 74.687 → 81.638 → 66.232) e fundos descendentes
   * (85.615 → 63.669 → 66.111 → 58.796). Preço acima de média que desce é
   * repique dentro de queda, não virada.
   *
   * 30 dias porque é longo o bastante pra não tremer e curto o bastante pra
   * pegar a virada quando ela vier. */
  janelaDaInclinacao: 30,
  capitalEntrando: 4,   // % em 30 dias — o p75 de 3 anos
  capitalSaindo: 0,     // % em 30 dias — encolher é o p10; é raro e significa algo
  janelaCapital: 30,
};

/* A média dos últimos `n` pontos. */
export function mediaMovel(serie, n) {
  if (!Array.isArray(serie) || !(n > 0) || serie.length < n) return null;
  const fatia = serie.slice(-n).filter((v) => Number.isFinite(v) && v > 0);
  // Exijo a janela cheia: média de 140 pontos apresentada como "média de 200
  // dias" é um número diferente com o nome do original.
  if (fatia.length < n) return null;
  return fatia.reduce((s, v) => s + v, 0) / fatia.length;
}

/* Pra que lado a própria média está andando.
 *
 * É o que separa virada de repique. Numa alta de verdade a média longa vira
 * junto; num repique o preço sobe e a média continua descendo, porque ela ainda
 * está engolindo os preços altos de meses atrás. */
export function inclinacaoDaMedia(precos, lim = CICLO) {
  const agora = mediaMovel(precos, lim.janelaMedia);
  const antes = mediaMovel(precos.slice(0, precos.length - lim.janelaDaInclinacao), lim.janelaMedia);
  if (agora == null || antes == null || !(antes > 0)) return null;
  const variacao = (agora / antes - 1) * 100;
  return {
    variacao,
    // Faixa morta pequena: a média longa se move devagar, e 0,25% em 30 dias
    // já é direção, não ruído.
    sentido: variacao > 0.25 ? "subindo" : variacao < -0.25 ? "caindo" : "parada",
  };
}

/* O eixo do preço: onde o Bitcoin está em relação à média longa — E pra que
 * lado a média anda.
 *
 * São quatro estados e não três, porque "acima da média" quer dizer coisas
 * opostas conforme a média sobe ou desce:
 *
 *   acima  + média subindo → bull      (a sequência que ele descreve)
 *   acima  + média caindo  → REPIQUE   (subiu, mas não se sustentou)
 *   abaixo + média caindo  → bear
 *   abaixo + média subindo → correção  (queda dentro de alta)
 */
export function regimeDePreco(precos, lim = CICLO) {
  const media = mediaMovel(precos, lim.janelaMedia);
  if (media == null) {
    return { estado: "sem-dado", texto: `preciso de ${lim.janelaMedia} dias de preço e não tenho` };
  }
  const hoje = precos[precos.length - 1];
  const dist = hoje / media - 1;
  const pct = (dist * 100).toFixed(1);
  const inc = inclinacaoDaMedia(precos, lim);
  const base = { dist, media, hoje, inclinacao: inc };
  const comoAnda = inc
    ? `, e a média está ${inc.sentido} (${inc.variacao >= 0 ? "+" : ""}${inc.variacao.toFixed(2)}% em ${lim.janelaDaInclinacao} dias)`
    : "";

  if (dist > lim.banda) {
    if (inc && inc.sentido === "caindo") {
      return {
        ...base, estado: "repique",
        texto: `Bitcoin ${pct}% acima da média de ${lim.janelaMedia} dias${comoAnda} — subiu, mas a tendência longa ainda desce`,
      };
    }
    return { ...base, estado: "bull", texto: `Bitcoin ${pct}% acima da média de ${lim.janelaMedia} dias${comoAnda}` };
  }
  if (dist < -lim.banda) {
    if (inc && inc.sentido === "subindo") {
      return {
        ...base, estado: "correcao",
        texto: `Bitcoin ${pct}% abaixo da média de ${lim.janelaMedia} dias${comoAnda} — caiu, mas a tendência longa ainda sobe`,
      };
    }
    return { ...base, estado: "bear", texto: `Bitcoin ${pct}% abaixo da média de ${lim.janelaMedia} dias${comoAnda}` };
  }
  return { ...base, estado: "neutro", texto: `Bitcoin em cima da média de ${lim.janelaMedia} dias (${pct}%)${comoAnda} — sem direção` };
}

/* Qual lado do ciclo um estado de preço representa.
 *
 * Repique é estrutura de BAIXA: o preço subiu mas a tendência longa não virou.
 * Correção é estrutura de ALTA pelo mesmo raciocínio invertido. */
export function ladoDoRegime(estado) {
  if (estado === "bull") return "alta";
  if (estado === "repique" || estado === "bear") return "baixa";
  if (estado === "correcao") return "alta";
  return null;
}

/* Há quantos dias o preço está do lado em que está.
 *
 * Um regime de 3 dias e um de 8 meses não valem o mesmo, e a diferença some se
 * a gente só disser "bull". Devolve null quando a série não alcança a virada:
 * "pelo menos N dias" seria inventar idade que não medi. */
export function idadeDoRegime(precos, lim = CICLO) {
  /* Conta dias do mesmo LADO, não do mesmo estado.
   *
   * Desde que a inclinação da média entrou, "acima da média" virou dois estados
   * (bull e repique) e "abaixo" virou outros dois (bear e correção). Contar por
   * estado faria a idade zerar quando a média muda de sentido — e a pergunta
   * que esta função responde é "há quanto tempo o preço está desse lado", não
   * "há quanto tempo a média inclina assim". */
  const atual = ladoDoRegime(regimeDePreco(precos, lim).estado);
  if (!atual) return null;
  const maximo = precos.length - lim.janelaMedia;
  let dias = 0;
  for (let fim = precos.length; fim > lim.janelaMedia; fim--) {
    const r = regimeDePreco(precos.slice(0, fim), lim);
    const lado = ladoDoRegime(r.estado);
    // O neutro não interrompe: atravessar a banda não é virar de lado.
    if (lado && lado !== atual) break;
    dias++;
  }
  return dias >= maximo ? null : dias;
}

/* Onde o preço está DENTRO da faixa que ele percorreu.
 *
 * A média de 200 dias diz de que lado ele está; isto diz o quanto ele já andou.
 * Duas perguntas diferentes: em 06/09/2026 o Bitcoin estava 14,6% acima da
 * média (lado de alta) e ao mesmo tempo 17,2% abaixo do topo da janela — subiu,
 * mas ainda não voltou onde estava.
 *
 * "Posição" é 0 no fundo da faixa e 100 no topo. É a leitura que o Portal 2 do
 * curso chama de teoria dos ciclos; os INDICADORES dele eu ainda não conheço
 * (a aula não foi transcrita), então aqui vai só o que se mede sem opinião:
 * onde está, contra onde já esteve. */
export function posicaoNoCiclo(precos) {
  if (!Array.isArray(precos) || precos.length < 30) return null;
  const validos = precos.filter((v) => Number.isFinite(v) && v > 0);
  if (validos.length < 30) return null;
  const hoje = validos[validos.length - 1];
  const topo = Math.max(...validos);
  const fundo = Math.min(...validos);
  if (!(topo > fundo)) return null;
  return {
    hoje, topo, fundo,
    dias: validos.length,
    doTopo: (hoje / topo - 1) * 100,     // negativo: quanto falta pro topo
    doFundo: (hoje / fundo - 1) * 100,   // positivo: quanto subiu do fundo
    posicao: ((hoje - fundo) / (topo - fundo)) * 100,
  };
}

export function lerPosicao(p) {
  if (!p) return null;
  const t = p.doTopo, f = p.doFundo;
  const onde =
    p.posicao >= 90 ? "colado no topo da janela"
    : p.posicao >= 65 ? "na parte de cima da faixa"
    : p.posicao >= 35 ? "no meio da faixa"
    : p.posicao >= 10 ? "na parte de baixo da faixa"
    : "colado no fundo da janela";
  return {
    ...p,
    onde,
    texto: `${onde}: ${Math.abs(t).toFixed(0)}% abaixo do topo dos ${p.dias} dias e ${f.toFixed(0)}% acima do fundo`,
  };
}

/* A série reduzida, pra desenhar sem carregar 260 números.
 *
 * O gráfico do painel tem uns 300 pixels de largura — mandar um ponto por dia é
 * mandar detalhe que não cabe na tela. Pega o MÁXIMO de cada fatia, e não a
 * média, porque média achata justamente os topos, que é o que se olha num
 * gráfico de ciclo. */
export function reduzirSerie(precos, quantos = 90) {
  if (!Array.isArray(precos) || !precos.length) return [];
  if (precos.length <= quantos) return precos.slice();
  const passo = precos.length / quantos;
  const out = [];
  for (let i = 0; i < quantos; i++) {
    const a = Math.floor(i * passo), b = Math.max(a + 1, Math.floor((i + 1) * passo));
    out.push(Math.max(...precos.slice(a, b)));
  }
  // O último ponto é sempre o preço de hoje, não o máximo da última fatia:
  // é o número que a pessoa confere contra o que ela vê em qualquer lugar.
  out[out.length - 1] = precos[precos.length - 1];
  return out;
}

/* O eixo do capital: quanto stablecoin entrou ou saiu em 30 dias. */
export function fluxoDeCapital(estoques, lim = CICLO) {
  if (!Array.isArray(estoques) || estoques.length <= lim.janelaCapital) {
    return { estado: "sem-dado", texto: "sem série de stablecoin suficiente" };
  }
  const hoje = estoques[estoques.length - 1];
  const antes = estoques[estoques.length - 1 - lim.janelaCapital];
  if (!(antes > 0) || !(hoje > 0)) {
    return { estado: "sem-dado", texto: "sem série de stablecoin suficiente" };
  }
  const variacao = (hoje / antes - 1) * 100;
  const bilhoes = (hoje / 1e9).toFixed(0);
  const pct = variacao.toFixed(1);
  if (variacao >= lim.capitalEntrando) {
    return {
      estado: "entrando", variacao, estoque: hoje,
      texto: `entrou dinheiro novo: estoque de stablecoin +${pct}% em 30 dias (US$ ${bilhoes} bi)`,
    };
  }
  if (variacao <= lim.capitalSaindo) {
    return {
      estado: "saindo", variacao, estoque: hoje,
      texto: `dinheiro saindo: estoque de stablecoin ${pct}% em 30 dias (US$ ${bilhoes} bi)`,
    };
  }
  return {
    estado: "parado", variacao, estoque: hoje,
    /* O "mas" não é enfeite. O estoque de stablecoin sobe na maioria dos meses,
     * então +1,5% lido sem contexto parece entrada de capital — e é menos que o
     * normal. Sem essa frase o eixo mentiria pro lado otimista. */
    texto: `capital parado: stablecoin ${variacao >= 0 ? "+" : ""}${pct}% em 30 dias — positivo, mas abaixo do mês normal do mercado (US$ ${bilhoes} bi)`,
  };
}

/* A leitura, juntando os dois eixos.
 *
 * A regra é ASSIMÉTRICA de propósito, e a assimetria é a parte importante:
 *
 *   BULL exige os dois: estrutura de alta E capital entrando.
 *   BEAR se contenta com a estrutura de baixa, desde que o capital não
 *        contradiga.
 *
 * Por que não tratar os dois lados igual: errar pra bear custa render menos
 * (mais Bitcoin, mais caixa, menos altcoin). Errar pra bull põe 35% da carteira
 * em altcoin dentro de uma queda — o B.A.R.C.A. muda a parcela de altcoins de
 * 5% pra 35% entre um ciclo e outro. Os dois erros não custam o mesmo, então
 * as duas exigências não podem ser iguais.
 *
 * Antes desta versão a regra era simétrica ("os dois concordam ou nada"), e ela
 * devolvia "indefinido" com o preço em repique e o capital parado — quando a
 * leitura honesta é bear. A correção veio do Rayakuza em 08/09/2026, e conferi a
 * tese dele antes de aceitar: média longa caindo, topos e fundos descendentes. */
/* NAO EXISTE CICLO INDEFINIDO, e isto e um conserto de conceito.
 *
 * Ele disse, em 11/09/2026: "o ciclo ou e bear ou bull, nao existe o ciclo
 * indefinido certo? e vc ta usando muito isso no radar".
 *
 * Esta certo, e o erro era meu de nomear. O mercado ESTA em bear ou em bull.
 * "Indefinido" nunca foi um estado do mercado: era o MEU estado, "nao consigo
 * dizer qual". Por na tela como se fosse um terceiro ciclo troca o mapa pelo
 * territorio — e quem le passa a achar que existe um lugar onde o mercado nao
 * esta em lado nenhum.
 *
 * PIOR: o radar ja tratava tudo como bear em seguida. `cicloParaMeta` mapeava
 * indefinido pra bear com um comentario dizendo isso. O terceiro ciclo so
 * existia na tela — e existia o bastante pra causar um estrago de verdade.
 *
 * O ESTRAGO: o botao "usar referencia" preenche os alvos da carteira com a
 * divisao do ciclo. Com o ciclo "indefinido", a funcao da referencia nao
 * achava divisao nenhuma e caia numa neutra (50/20/15/10/5), enquanto a tela
 * logo acima dizia "trato como bear". Ele clicou esperando o 60/25 de bear,
 * recebeu a neutra, salvou, e os alvos dele foram sobrescritos. Duas partes do
 * programa lendo a mesma palavra de dois jeitos.
 *
 * AGORA: o ciclo e sempre "bear" ou "bull". Quando as medidas nao concordam,
 * vale BEAR — o lado conservador — e a leitura carrega `semConsenso: true`.
 * A duvida continua visivel, e continua sendo dita na tela; o que ela deixa de
 * ser e um ciclo. */
export function lerCiclo(preco, capital) {
  const porque = [preco?.texto, capital?.texto].filter(Boolean);
  const lado = ladoDoRegime(preco?.estado);

  if (preco?.estado === "sem-dado" && capital?.estado === "sem-dado") {
    return { ciclo: "bear", semConsenso: true, firmeza: "sem dado nenhum", porque };
  }

  if (lado === "alta") {
    if (capital?.estado === "entrando") {
      return { ciclo: "bull", firmeza: "estrutura de alta e capital entrando", porque };
    }
    return {
      ciclo: "bear", semConsenso: true,
      firmeza: "o preço virou, o capital ainda não confirmou",
      porque,
    };
  }

  if (lado === "baixa") {
    if (capital?.estado === "entrando") {
      return {
        ciclo: "bear", semConsenso: true,
        firmeza: "o capital está entrando, mas a tendência longa ainda desce",
        porque,
      };
    }
    /* Repique conta como baixa. É o ponto que o Rayakuza levantou: "para bull
     * precisaria ter uma sequência de alta; teve uma leve subida e
     * lateralização, mas ainda não se sustentou". */
    return {
      ciclo: "bear",
      firmeza: preco?.estado === "repique"
        ? "o preço subiu, mas a tendência longa ainda desce — repique, não virada"
        : "estrutura de baixa, e o capital não contradiz",
      porque,
    };
  }

  return { ciclo: "bear", semConsenso: true, firmeza: "sem direção clara no preço", porque };
}

/* Qual ciclo vale, considerando o que o Rayakuza escolheu.
 *
 * `escolhido` vem do banco: "bull", "bear" ou "auto" (o padrão). A leitura
 * automática nunca sobrepõe a escolha dele — se sobrepusesse, o botão seria
 * decorativo. */
/* LEITURA VELHA, TRADUZIDA NA ENTRADA.
 *
 * O ciclo fica guardado no banco, e as leituras gravadas antes de 11/09/2026
 * dizem "indefinido" — um estado que o programa nao produz mais. Sem traduzir,
 * a tela continuaria mostrando "Ciclo indefinido" ate a proxima rodada, e o
 * botao da referencia continuaria preenchendo a divisao neutra. Ou seja: o
 * conserto ficaria pronto e sem efeito, esperando o relogio.
 *
 * Traduzir na LEITURA, e nao no banco: ninguem precisa migrar nada, e um dado
 * de ontem passa a ser lido com o entendimento de hoje. Se um dia sobrar um
 * "indefinido" perdido em qualquer lugar, ele continua virando bear aqui. */
function semIndefinido(leitura) {
  if (!leitura || leitura.ciclo !== "indefinido") return leitura;
  return { ...leitura, ciclo: "bear", semConsenso: true };
}

export function cicloEfetivo(escolhido, leituraCrua) {
  const leitura = semIndefinido(leituraCrua);
  if (escolhido === "bull" || escolhido === "bear") {
    return {
      ciclo: escolhido,
      origem: "escolhido",
      // A leitura continua aparecendo mesmo contrariada: é assim que ele
      // percebe que a escolha envelheceu.
      leitura,
      /* So acusa divergencia quando a medida TEM consenso. Cutucar ele por
         discordar de uma leitura que o proprio radar nao sustenta seria
         transformar duvida minha em cobranca. */
      discorda: !!leitura?.ciclo && !leitura.semConsenso && leitura.ciclo !== escolhido,
      texto: `Ciclo: ${escolhido} — definido por você.`,
    };
  }
  const c = leitura?.ciclo || "bear";
  return {
    ciclo: c,
    origem: "medido",
    leitura,
    discorda: false,
    texto: leitura?.semConsenso
      ? `Mercado ${c} — as duas medidas ainda não concordam (${leitura?.firmeza || "sem leitura"}), e enquanto não concordam vale o lado conservador.`
      : `Ciclo: ${c} — ${leitura?.firmeza}.`,
  };
}

/* O lado que vale, por nome.
 *
 * Continua existindo por seguranca, e agora quase sempre devolve o que
 * recebeu: desde que "indefinido" deixou de existir, o ciclo ja chega bear ou
 * bull. Ela guarda o caso de alguem passar uma palavra estranha — e a escolha
 * dela, nesse caso, e a conservadora. */
export function cicloParaMeta(ciclo) {
  return ciclo === "bull" ? "bull" : "bear";
}
