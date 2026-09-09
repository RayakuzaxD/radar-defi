/* Onde o radar decide o que merece tocar o celular.
 *
 * Nada aqui fala com a rede nem com o banco: entra dado, sai lista de achados.
 * É de propósito — é o que deixa `testar-sinais.js` provar as regras com casos
 * inventados, sem publicar nada e sem depender de como o mercado está hoje.
 *
 * A regra que atravessa o arquivo inteiro: PORCENTAGEM SOZINHA MENTE. Uma rede
 * que sai de 200 mil pra 400 mil dólares subiu 100%, e não significa nada — é
 * uma pessoa movendo dinheiro. Por isso todo limiar tem duas partes, a
 * porcentagem e o tamanho em dólares, e as duas precisam bater.
 */

export const LIMIARES = {
  // Dinheiro entrando numa rede que já é gente grande.
  entrada: { pisoTvl: 10e6, altaPct: 20, altaAbs: 5e6 },

  // Redes pequenas acelerando. O teto existe porque uma rede de 2 bilhões
  // subindo 40% não é "pequena acelerando", é notícia de primeira página — cai
  // em `entrada`. O piso mata o ruído de rede morta que ninguém usa.
  //
  // 150 milhões e não 300: uma rede desse tamanho já tem gente grande dentro e
  // já apareceu no radar de todo mundo. O valor de chamá-la de "pequena" é
  // justamente ser algo que ainda não é óbvio.
  pequena: { pisoTvl: 2e6, tetoTvl: 150e6, altaPct: 40, altaAbs: 1e6 },

  // Dinheiro saindo. Dois gatilhos: a sangria lenta de 7 dias e o susto de 1 dia.
  fuga: { pisoTvl: 30e6, quedaPct: -20, quedaAbs: -10e6, quedaDiaPct: -12 },

  // Protocolos. Piso mais alto porque protocolo pequeno mexe muito por natureza.
  protocolo: { pisoTvl: 20e6, altaPct: 35, quedaPct: -30 },

  // Stablecoin é o sinal de capital de verdade; por isso o corte é mais baixo.
  stables: { piso: 5e6, altaPct: 15, altaAbs: 3e6 },

  // Quantos dias antes de repetir o mesmo aviso sobre o mesmo alvo.
  esperaDias: 4,
  // ...a não ser que o movimento tenha crescido tanto assim desde o último aviso.
  piorouPontos: 20,
};

/* Variação em porcentagem, com uma recusa embutida.
 *
 * Devolve null quando a base é pequena demais pra porcentagem significar algo.
 * Sem isso, uma rede que sai de quase zero vira +infinito% e encabeça todo
 * ranking — o radar passaria a vida anunciando poeira. */
export function variacao(agora, antes, baseMinima = 1e6) {
  if (!Number.isFinite(agora) || !Number.isFinite(antes)) return null;
  if (antes < baseMinima) return null;
  return (agora / antes - 1) * 100;
}

/* O dado de stablecoin merece confiança hoje?
 *
 * Existe por causa de um susto de 02/09/2026. O endereço de histórico estava
 * errado (`stablecoincharts/all?chain=X` responde 200 e devolve o total do mundo
 * pra qualquer rede que se peça), e o radar concluiu que TODA rede havia perdido
 * 95% das stablecoins na semana. Não parecia bug: parecia um mercado em pânico,
 * com número redondo e tudo. Só ficou óbvio porque estava errado igual em todas.
 *
 * Daí a trava: mercado de verdade não move o estoque de stablecoin de metade das
 * redes grandes em mais de 50% na mesma semana. Se isso aparecer, a fonte quebrou
 * — e é melhor o radar dizer "não sei" do que anunciar pânico inventado.
 *
 * Devolve { confiavel, motivo }. Quando não é confiável, quem chama deve calar
 * sobre stablecoin e falar só de TVL. */
export function stablesConfiaveis(fichas, minimoDeRedes = 8) {
  const olhadas = fichas
    .filter((f) => f.tvl >= 50e6 && f.varStables7d != null)
    .slice(0, 40);
  if (olhadas.length < minimoDeRedes) {
    return { confiavel: false, motivo: `só ${olhadas.length} redes com dado de stablecoin` };
  }
  const absurdas = olhadas.filter((f) => Math.abs(f.varStables7d) > 50).length;
  if (absurdas > olhadas.length / 2) {
    return {
      confiavel: false,
      motivo: `${absurdas} de ${olhadas.length} redes grandes com stablecoin mexendo mais de 50% na semana — isso é a fonte quebrada, não o mercado`,
    };
  }
  return { confiavel: true };
}

/* Junta a foto de hoje com as do passado numa ficha por rede.
 *
 * `hoje` é Map(rede -> {tvl, stables}); `passado` é Map(dias -> Map(rede -> ...)).
 * Rede sem foto antiga não some da lista: o painel ainda quer mostrá-la, só não
 * dá pra dizer se cresceu — e aí a variação fica null, não zero. Zero seria
 * mentira; null é "não sei", e o resto do código sabe respeitar a diferença. */
export function montarFichas(hoje, passado) {
  const fichas = [];
  for (const [rede, agora] of hoje) {
    const ficha = { rede, tvl: agora.tvl || 0, stables: agora.stables || 0 };
    for (const [dias, mapa] of passado) {
      const antes = mapa.get(rede);
      ficha[`tvl${dias}d`] = antes?.tvl ?? null;
      ficha[`stables${dias}d`] = antes?.stables ?? null;
      ficha[`varTvl${dias}d`] = variacao(ficha.tvl, antes?.tvl);
      ficha[`absTvl${dias}d`] = antes?.tvl != null ? ficha.tvl - antes.tvl : null;
      ficha[`varStables${dias}d`] = variacao(ficha.stables, antes?.stables, LIMIARES.stables.piso);
      ficha[`absStables${dias}d`] = antes?.stables != null ? ficha.stables - antes.stables : null;
    }
    fichas.push(ficha);
  }
  return fichas.sort((a, b) => b.tvl - a.tvl);
}

const bateu = (pct, abs, minPct, minAbs) =>
  pct != null && abs != null && pct >= minPct && abs >= minAbs;

/* A varredura das redes.
 *
 * Devolve os achados com uma `forca` — o tamanho do movimento em pontos
 * percentuais. É ela que permite decidir depois se um aviso repetido piorou o
 * bastante pra valer a pena repetir. */
export function sinaisDeRede(fichas, seguidas = new Set(), lim = LIMIARES, stablesOk = true) {
  const achados = [];

  for (const f of fichas) {
    // Rede que o Rayakuza mandou seguir tem o limiar cortado pela metade: nelas ele
    // quis saber de mexida pequena, e não adianta ele pedir e o radar calar.
    const folga = seguidas.has(f.rede) ? 0.5 : 1;

    // Stablecoin subindo junto é o que separa "entrou dinheiro" de "o token
    // valorizou". Sem esta checagem o radar comemoraria alta de preço achando
    // que era capital novo — o erro mais comum de quem olha TVL.
    //
    // Três estados, não dois: sim, não, e `null` = "a fonte está estranha, não
    // vou afirmar nada". Sem o null, uma fonte quebrada viraria um "não é
    // dinheiro novo" categórico — uma afirmação errada dita com confiança, que é
    // pior do que não dizer nada.
    const capitalNovo = stablesOk
      ? bateu(f.varStables7d, f.absStables7d, lim.stables.altaPct, lim.stables.altaAbs)
      : null;

    // 1. Rede pequena acelerando.
    //
    // Vem ANTES de `entrada` porque é o caso específico: é a regra que tem teto,
    // e quem tem teto precisa ter a primeira palavra. Na ordem contrária toda
    // rede pequena que acelerava era engolida por `entrada` — que não tem teto e
    // aceita qualquer tamanho acima do piso — e o Rayakuza nunca via a categoria
    // que ele mais pediu.
    if (
      f.tvl >= lim.pequena.pisoTvl && f.tvl <= lim.pequena.tetoTvl &&
      bateu(f.varTvl7d, f.absTvl7d, lim.pequena.altaPct * folga, lim.pequena.altaAbs * folga)
    ) {
      achados.push({ tipo: "pequena", alvo: f.rede, forca: f.varTvl7d, ficha: f, capitalNovo });
    }

    // 2. Dinheiro entrando numa rede que já é gente grande
    else if (
      f.tvl >= lim.entrada.pisoTvl * folga &&
      bateu(f.varTvl7d, f.absTvl7d, lim.entrada.altaPct * folga, lim.entrada.altaAbs * folga)
    ) {
      achados.push({ tipo: "entrada", alvo: f.rede, forca: f.varTvl7d, ficha: f, capitalNovo });
    }

    // 3. Dinheiro saindo. Fora do else de propósito: uma rede pode ter subido a
    //    semana toda e despencado hoje, e a queda de hoje é a notícia que interessa.
    const sangria =
      f.varTvl7d != null && f.absTvl7d != null &&
      f.varTvl7d <= lim.fuga.quedaPct * folga && f.absTvl7d <= lim.fuga.quedaAbs * folga;
    const susto = f.varTvl1d != null && f.varTvl1d <= lim.fuga.quedaDiaPct * folga;
    if (f.tvl >= lim.fuga.pisoTvl * folga && (sangria || susto)) {
      achados.push({
        tipo: "fuga",
        alvo: f.rede,
        forca: Math.abs(susto && !sangria ? f.varTvl1d : f.varTvl7d),
        ficha: f,
        deUmDia: susto && !sangria,
      });
    }
  }

  return achados.sort((a, b) => b.forca - a.forca);
}

/* A varredura dos protocolos.
 *
 * Aqui o passado vem pronto da própria API, então este sinal funciona mesmo se
 * o nosso histórico estiver vazio — é o único que não depende do semeador. */
export function sinaisDeProtocolo(protocolos, lim = LIMIARES) {
  const achados = [];
  for (const p of protocolos) {
    if (p.tvl < lim.protocolo.pisoTvl) continue;
    const pct = variacao(p.tvl, p.tvl7d);
    if (pct == null) continue;
    const abs = p.tvl - p.tvl7d;
    const pisoAbs = lim.protocolo.pisoTvl / 4;

    if (pct >= lim.protocolo.altaPct && abs >= pisoAbs) {
      achados.push({ tipo: "protocolo-alta", alvo: p.nome, forca: pct, abs, protocolo: p });
    } else if (pct <= lim.protocolo.quedaPct && abs <= -pisoAbs) {
      achados.push({ tipo: "protocolo-queda", alvo: p.nome, forca: Math.abs(pct), abs, protocolo: p });
    }
  }
  return achados.sort((a, b) => b.forca - a.forca);
}

/* Quem puxou o crescimento de uma rede.
 *
 * Responde a pergunta que vem logo depois de "a rede X cresceu": cresceu por
 * quê. Usa o TVL do protocolo NAQUELA rede, não o total dele — um protocolo que
 * vive em vinte redes pode ter crescido em outra, e creditá-lo aqui seria
 * mentira com cara de explicação. */
export function quemPuxou(rede, protocolos, quantos = 5) {
  const donos = [];
  for (const p of protocolos) {
    const naRede = p.porRede?.[rede];
    if (!naRede) continue;
    const agora = Number(naRede.tvl) || 0;
    const antes = Number(naRede.tvlPrevWeek) || 0;
    const delta = agora - antes;
    if (Math.abs(delta) < 1e6) continue;
    donos.push({
      nome: p.nome,
      categoria: p.categoria,
      tvl: agora,
      delta,
      pct: variacao(agora, antes),
    });
  }
  return donos.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, quantos);
}

/* Para onde o dinheiro que saiu de uma rede pode ter ido.
 *
 * Não é rastreamento: ninguém aqui segue transação nenhuma. É a leitura de duas
 * mexidas de mesmo tamanho e sentido contrário na mesma semana, que é o que o
 * Rayakuza quis dizer com "entender que a alta de uma chain veio de outra
 * esvaziando". Por isso o texto que sai daqui fala em "pode ter ido", nunca em
 * "foi" — a coincidência de tamanho não prova origem. */
export function possivelDestino(fugas, entradas, tolerancia = 0.4) {
  const pares = [];
  for (const saiu of fugas) {
    const saldo = Math.abs(saiu.ficha.absTvl7d || 0);
    if (saldo < 1e7) continue;
    for (const entrou of entradas) {
      const ganho = entrou.ficha.absTvl7d || 0;
      if (ganho <= 0) continue;
      const parecido = Math.abs(ganho - saldo) / saldo;
      if (parecido <= tolerancia) {
        pares.push({ de: saiu.alvo, para: entrou.alvo, valor: Math.min(saldo, ganho), parecido });
      }
    }
  }
  return pares.sort((a, b) => a.parecido - b.parecido);
}

/* O que anunciar agora, e o que anotar como visto.
 *
 * Parecem a mesma lista e não são — e essa diferença já custou um bug. A
 * mensagem tem espaço limitado, então mostra um punhado; mas se só o punhado
 * mostrado for anotado, o resto volta na rodada seguinte e o radar entrega a
 * notícia da mesma semana em prestações, tocando o celular de quatro em quatro
 * horas com o próximo lote.
 *
 * A regra, então: **corta-se para mostrar, anota-se tudo**.
 *
 * Mora aqui, e não no worker, porque foi exatamente por estar no worker — fora
 * do alcance dos testes — que o erro passou. */
export function separarParaAvisar(achados, deProtocolo, pares, jaDados, dia, tetoDeProtocolos = 5) {
  const redesNovas = achados.filter((a) => !jaAvisou(a, jaDados, dia));
  const protocolosNovos = deProtocolo.filter((a) => !jaAvisou(a, jaDados, dia));

  // Trocas de lugar não são achados — são a leitura de dois achados juntos — e
  // por isso não passam pelo dedupe. Sem este filtro elas se repetiam inteiras
  // em toda rodada, inclusive nas em que a fuga já tinha sido silenciada: a
  // mensagem comentava uma saída de dinheiro que ela própria não mencionava.
  const anunciadas = new Set(redesNovas.map((a) => a.alvo));
  const paresNovos = pares.filter((p) => anunciadas.has(p.de));

  return {
    mostrar: { redes: redesNovas, protocolos: protocolosNovos.slice(0, tetoDeProtocolos), pares: paresNovos },
    anotar: [...redesNovas, ...protocolosNovos],
    calado: redesNovas.length === 0 && protocolosNovos.length === 0,
  };
}

/* O aviso já foi dado e ainda vale? */
export function jaAvisou(achado, anteriores, hoje, lim = LIMIARES) {
  const antigo = anteriores.get(`${achado.tipo}:${achado.alvo}`);
  if (!antigo) return false;
  const dias = (Date.parse(hoje) - Date.parse(String(antigo.quando).slice(0, 10))) / 86400000;
  if (dias >= lim.esperaDias) return false;
  // Repetir só se o movimento andou bastante desde a última vez — senão o radar
  // vira aquele alarme que toca sozinho, e a gente aprende a ignorar.
  return achado.forca - (antigo.forca || 0) < lim.piorouPontos;
}
