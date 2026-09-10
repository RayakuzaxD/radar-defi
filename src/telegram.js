/* Como o radar fala.
 *
 * Duas partes: transformar achado em texto (funções puras, testáveis) e mandar
 * o texto (fetch). Ficam juntas porque quem mexe numa costuma mexer na outra,
 * mas nada aqui que forma texto precisa de rede — `ensaiar.js` usa este arquivo
 * inteiro sem token nenhum, e é assim que dá pra ler a mensagem antes de ela
 * existir de verdade.
 *
 * A regra de escrita: o Rayakuza lê isso no celular, no meio de outra coisa. Toda
 * linha tem que caber na tela e dizer tamanho junto com porcentagem — sem o
 * tamanho, "+80%" pode ser uma fortuna ou pode ser troco.
 */

/* Dinheiro em tamanho de gente. $1.24B, $340M, $5.6M, $890k. */
export function dinheiro(v) {
  if (v == null || !Number.isFinite(v)) return "?";
  const sinal = v < 0 ? "-" : "";
  const n = Math.abs(v);
  if (n >= 1e9) return `${sinal}$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${sinal}$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `${sinal}$${(n / 1e3).toFixed(0)}k`;
  return `${sinal}$${n.toFixed(0)}`;
}

export function pct(v) {
  if (v == null || !Number.isFinite(v)) return "?";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/* O Telegram engasga com < > & quando a mensagem vai em HTML. */
export const escapar = (t) =>
  String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Uma linha por rede: nome, tamanho, quanto mudou em porcentagem e em dólares.
 *
 * Os três juntos, sempre. Porcentagem sozinha esconde o tamanho, tamanho
 * sozinho esconde a velocidade, e o tamanho da rede é o que diz se aquilo é
 * uma tendência ou uma pessoa. */
function linhaDeRede(f) {
  const partes = [
    `<b>${escapar(f.rede)}</b>`,
    dinheiro(f.tvl),
    `${pct(f.varTvl7d)} em 7d`,
  ];
  if (f.absTvl7d != null) partes.push(`(${dinheiro(f.absTvl7d)})`);
  return partes.join(" · ");
}

const CABECALHOS = {
  entrada: "📈 Dinheiro entrando",
  pequena: "🌱 Pequena acelerando",
  fuga: "🩸 Dinheiro saindo",
  "protocolo-alta": "🔼 Protocolo crescendo",
  "protocolo-queda": "🔽 Protocolo encolhendo",
};

/* Um achado de rede, com o porquê embaixo. */
export function textoDeAchado(achado, puxadores = []) {
  const f = achado.ficha;
  const linhas = [`${CABECALHOS[achado.tipo]} — ${linhaDeRede(f)}`];

  if (achado.tipo === "fuga" && achado.deUmDia) {
    linhas.push(`   caiu ${pct(f.varTvl1d)} só nas últimas 24h`);
  }

  // A distinção que dá sentido a tudo: subiu porque entrou dinheiro, ou subiu
  // porque o token da rede valorizou e o mesmo dinheiro passou a valer mais?
  if (achado.tipo === "entrada" || achado.tipo === "pequena") {
    if (achado.capitalNovo === null) {
      // A fonte de stablecoin está estranha hoje. Calar sobre ela é a única
      // saída honesta: afirmar "não é dinheiro novo" com dado quebrado seria
      // errar com confiança.
      linhas.push(`   (o dado de stablecoin está fora do ar hoje — só dá pra falar do valor parado)`);
    } else if (achado.capitalNovo) {
      linhas.push(`   💵 stablecoins ${pct(f.varStables7d)} (${dinheiro(f.absStables7d)}) — é dinheiro novo chegando`);
    } else if (f.varStables7d != null) {
      linhas.push(`   ⚠️ stablecoins só ${pct(f.varStables7d)} — pode ser o token valorizando, não depósito`);
    } else {
      linhas.push(`   (sem dado de stablecoin nessa rede — não dá pra saber se é dinheiro novo)`);
    }
  }

  if (puxadores.length) {
    linhas.push("   quem puxou:");
    for (const p of puxadores.slice(0, 3)) {
      linhas.push(`   · ${escapar(p.nome)} ${dinheiro(p.delta)} (${pct(p.pct)}) — ${escapar(p.categoria || "?")}`);
    }
  }

  return linhas.join("\n");
}

export function textoDeProtocolo(achado) {
  const p = achado.protocolo;
  const onde = p.redes.length === 1 ? p.redes[0] : `${p.redes.length} redes`;
  return `${CABECALHOS[achado.tipo]} — <b>${escapar(p.nome)}</b> · ${dinheiro(p.tvl)} · ` +
    `${pct(achado.tipo === "protocolo-alta" ? achado.forca : -achado.forca)} em 7d ` +
    `(${dinheiro(achado.abs)}) · ${escapar(p.categoria || "?")} · ${escapar(onde)}`;
}

/* O apanhado que sai de manhã. */
export function textoDoResumo({ dia, achados, protocolos, pares, puxadoresPor = {} }) {
  const blocos = [`<b>Radar DeFi — ${dia}</b>`];

  const porTipo = (t) => achados.filter((a) => a.tipo === t);
  const secoes = [
    ["pequena", "🌱 <b>Pequenas acelerando</b>"],
    ["entrada", "📈 <b>Dinheiro entrando</b>"],
    ["fuga", "🩸 <b>Dinheiro saindo</b>"],
  ];

  for (const [tipo, titulo] of secoes) {
    const lista = porTipo(tipo);
    if (!lista.length) continue;
    blocos.push(`\n${titulo}`);
    for (const a of lista.slice(0, 6)) {
      blocos.push(textoDeAchado(a, puxadoresPor[a.alvo] || []));
    }
  }

  if (protocolos?.length) {
    blocos.push("\n<b>Protocolos que mais mexeram</b>");
    for (const a of protocolos.slice(0, 5)) blocos.push(textoDeProtocolo(a));
  }

  if (pares?.length) {
    blocos.push("\n<b>Pode ter havido troca de lugar</b>");
    for (const p of pares.slice(0, 3)) {
      // "pode ter": ninguém aqui seguiu transação nenhuma. É coincidência de
      // tamanho na mesma semana, e o texto não tem direito de dizer mais que isso.
      blocos.push(`↔️ ${escapar(p.de)} perdeu ~${dinheiro(p.valor)} e ${escapar(p.para)} ganhou parecido — <i>pode</i> ser o mesmo dinheiro`);
    }
  }

  if (blocos.length === 1) {
    blocos.push("\nNada fora do normal hoje. O mercado está parado o bastante pra não valer a pena te acordar.");
  }

  return blocos.join("\n");
}

/* A ficha de uma rede só, pro /rede Base. */
export function textoDaRede(f, puxadores, qualidade = null, notas = []) {
  if (!f) return "Não conheço essa rede. Confere o nome — tem que ser igual ao do DefiLlama (ex.: Base, Arbitrum, Hyperliquid L1).";
  const l = [
    `<b>${escapar(f.rede)}</b>`,
    `Dinheiro parado: ${dinheiro(f.tvl)}`,
    `  24 horas:  ${pct(f.varTvl1d)}  (${dinheiro(f.absTvl1d)})`,
    `  7 dias:    ${pct(f.varTvl7d)}  (${dinheiro(f.absTvl7d)})`,
    `  1 mês:     ${pct(f.varTvl30d)}  (${dinheiro(f.absTvl30d)})`,
    `  3 meses:   ${pct(f.varTvl90d)}  (${dinheiro(f.absTvl90d)})`,
    "",
    `Stablecoins: ${dinheiro(f.stables)}`,
    `  7 dias:    ${pct(f.varStables7d)}  (${dinheiro(f.absStables7d)})`,
    `  1 mês:     ${pct(f.varStables30d)}  (${dinheiro(f.absStables30d)})`,
    `  3 meses:   ${pct(f.varStables90d)}  (${dinheiro(f.absStables90d)})`,
  ];
  /* A leitura que os quatro períodos juntos permitem e nenhum sozinho permite:
   * uma rede que sobe na semana mas está no vermelho no trimestre não está
   * crescendo — está se recuperando de um tombo, e é fácil confundir as duas
   * quando se olha só a semana. */
  if (f.varTvl1d != null && f.varTvl7d != null && f.varTvl1d > 40 && f.varTvl1d >= f.varTvl7d * 0.9) {
    l.push("", "⚡ O salto inteiro foi nas últimas 24h — a rede estava parada antes. É um evento, não tendência; pode ser um depósito só.");
  } else if (f.varTvl7d > 15 && f.varTvl90d != null && f.varTvl90d < 0) {
    l.push("", "↩️ Sobe na semana mas está negativa no trimestre: parece recuperação de queda, não crescimento novo.");
  } else if (f.varTvl7d > 15 && f.varTvl30d != null && f.varTvl7d > f.varTvl30d) {
    l.push("", "🚀 A semana cresceu mais que o mês inteiro: o movimento é recente.");
  } else if (f.varTvl90d != null && f.varTvl30d != null && f.varTvl7d != null &&
             f.varTvl90d > f.varTvl30d && f.varTvl30d > f.varTvl7d && f.varTvl7d > 15) {
    l.push("", "📉 Cresce há meses, mas cada vez menos: o ritmo está desacelerando.");
  }
  // A leitura que o Rayakuza teria que fazer de cabeça toda vez, feita por escrito.
  if (f.varTvl7d != null && f.varStables7d != null) {
    l.push("", f.varTvl7d > 10 && f.varStables7d < 3
      ? "⚠️ O valor subiu mas a stablecoin não: parece valorização de token, não dinheiro novo."
      : f.varStables7d > 10
        ? "💵 Stablecoin subindo: tem dinheiro de verdade entrando aqui."
        : "Nada de estranho entre o valor e a stablecoin.");
  }
  if (puxadores?.length) {
    l.push("", "<b>Quem mais mexeu na semana</b>");
    for (const p of puxadores) {
      l.push(`· ${escapar(p.nome)} ${dinheiro(p.delta)} (${pct(p.pct)}) — ${escapar(p.categoria || "?")}`);
    }
  }

  /* As três medidas que dizem se esse dinheiro tem motivo pra ficar.
   *
   * Vêm depois dos números de crescimento porque é essa a ordem da pergunta:
   * primeiro "o que aconteceu", depois "isso se sustenta". E cada observação
   * termina em o que ESTUDAR, nunca em o que fazer — o radar mostra e nomeia; a
   * decisão é de quem lê. */
  if (qualidade) {
    l.push("", "<b>Esse dinheiro tem motivo pra ficar?</b>");
    l.push(qualidade.alugado == null
      ? "Rendimento alugado: sem dado"
      : `Rendimento de incentivo: <b>${qualidade.alugado.toFixed(0)}%</b> vem de token impresso, não de taxas`);
    if (qualidade.taxas24h != null) {
      l.push(`Arrecadação: ${dinheiro(qualidade.taxas24h)}/dia · <b>$${(qualidade.taxaPorMilhao ?? 0).toFixed(0)}</b> por $1M parado`);
    }
    if (qualidade.concentracao != null) {
      l.push(`Concentração: <b>${qualidade.concentracao.toFixed(0)}%</b> num protocolo só (${escapar(qualidade.maiorProtocolo || "?")})`);
    }
    if (qualidade.dia) l.push(`<i>medido em ${qualidade.dia}</i>`);
  }

  if (notas?.length) {
    l.push("", "<b>O que investigar</b>");
    for (const n of notas) {
      l.push(`${n.peso === "cuidado" ? "⚠️" : "✅"} ${escapar(n.texto)}`);
      l.push(`   → ${escapar(n.estudar)}`);
    }
  }

  return l.join("\n");
}

/* As piscinas, na tela do celular.
 *
 * Uma piscina ocupa três linhas e não mais: nome, tamanho, e a DIVISÃO do
 * rendimento. A divisão é a informação — o APY total sozinho é justamente o
 * número que faz 20% de token emitido parecer melhor que 6% de uso real. */
/* A etiqueta é o que ele LÊ; a chave é o que o banco guarda.
 *
 * "alugada" continua sendo o valor gravado — trocar dado por causa de palavra
 * exigiria remedir tudo — mas na tela está escrito "incentivada", que é o termo
 * do Guia 3 do Predador: "Incentivos/Earnings", ao lado de "Taxas/fees". Eu
 * tinha inventado "alugada" e "emitido" tendo as palavras dele à mão. */
/* Onde encontrar a pool de verdade.
 *
 * O nome do protocolo e a rede sempre estiveram na mensagem, mas dizer onde não
 * é o mesmo que levar até lá: no celular, "brix · Ethereum · WITRY" obriga a
 * copiar, abrir o navegador e procurar — e nome de projeto no DeFi se repete.
 *
 * A página da pool no DefiLlama já reúne tudo o que ele procuraria: o gráfico,
 * a rede, o protocolo, os dois tokens do par, o explorer, e um botão que aponta
 * pra tela de adicionar liquidez DAQUELA pool no protocolo. Por isso é um link
 * só e não três. */
export function enderecoDaPool(id) {
  return id ? `https://defillama.com/yields/pool/${encodeURIComponent(id)}` : null;
}

const ETIQUETA_POOL = {
  firme: "🟢 taxas", alugada: "🟡 incentivada", loteria: "🔴 loteria",
  nova: "🆕 nova", "sem-dado": "sem dado",
};

/* As pools no celular, com a medida que decide: o chão.
 *
 * A versão anterior mostrava o APY anunciado e a divisão dele. Faltava a coisa
 * mais importante — se a pool de fato paga aquilo. Em 05/09/2026 uma pool
 * anunciava 74% e garantia 7,9%; mostrar só a divisão do cartaz não teria
 * revelado isso. */
export function textoDasPiscinas(linhas, { rede = null, novas = false, classe = null } = {}) {
  if (!linhas.length) {
    return novas
      ? `Nenhuma pool montada nos últimos 21 dias${rede ? ` em ${escapar(rede)}` : ""}.`
      : classe
        ? `Nenhuma pool ${escapar(classe)}${rede ? ` em ${escapar(rede)}` : ""} hoje.`
        : `Não tenho pool medida${rede ? ` em ${escapar(rede)}` : ""} ainda. A medição roda às 8h e precisa da semeadura do histórico.`;
  }

  const TITULO_CLASSE = {
    firme: "🟢 <b>Firmes</b> — pagam parecido todo dia, e vem de TAXAS",
    alugada: "🟡 <b>Incentivadas</b> — pagam bem, mas com INCENTIVO (tem prazo)",
    loteria: "🔴 <b>Loterias</b> — cartaz grande, chão baixo",
  };
  const titulo = novas
    ? `🆕 <b>Montadas nos últimos 21 dias</b>${rede ? ` — ${escapar(rede)}` : ""}`
    : (TITULO_CLASSE[classe] || "💧 <b>Onde vale pôr dinheiro pra render</b>") +
      (rede ? ` — ${escapar(rede)}` : "");

  const l = [titulo];
  if (!novas) {
    /* A legenda vai em toda lista, e não só uma vez.
     *
     * O Rayakuza lê isso no celular, muitas vezes dias depois da última. "Chão" é
     * palavra minha — não existe no curso, porque o curso não calcula essa
     * medida — então ela não pode aparecer sozinha esperando que ele lembre. */
    l.push("<i>cartaz = o que anuncia · chão = o que pagou em 9 de cada 10 dias</i>");
    l.push("<i>ordenado pelo chão</i>");
  }
  l.push("");

  for (const p of linhas) {
    l.push(`<b>${escapar(p.projeto || "?")}</b> ${escapar(p.simbolo || "")} · ${ETIQUETA_POOL[p.classe] || p.classe || ""}`);
    l.push(`   ${escapar(p.rede)} · ${dinheiro(p.tvl)}${p.idade_dias != null ? ` · ${p.idade_dias} dias de vida` : ""}`);

    if (p.chao != null) {
      // Cartaz e chão sempre juntos: é a distância entre os dois que informa, e
      // nenhum dos dois sozinho diz o que a pool paga.
      l.push(`   cartaz ${Number(p.cartaz ?? 0).toFixed(1)}% · <b>chão ${Number(p.chao).toFixed(1)}%</b>` +
        (p.pior != null ? ` · pior dia ${Number(p.pior).toFixed(1)}%` : ""));
    } else {
      l.push(`   anuncia ${Number(p.cartaz ?? 0).toFixed(1)}% · <i>sem histórico pra saber se paga isso</i>`);
    }

    if (p.porque) l.push(`   ${escapar(p.porque)}`);
    const onde = enderecoDaPool(p.id);
    if (onde) l.push(`   <a href="${onde}">onde encontrar ↗</a>`);
    l.push("");
  }

  l.push("<i>Chão = o que dá pra contar. O cartaz é o melhor caso, e some quando você precisa dele.</i>");
  return l.join("\n");
}

/* O apanhado do dia, nas mesmas quatro caixas do painel.
 *
 * Curto por obrigação (o Telegram corta em 4096) e por escolha: a mensagem que
 * chega às 8h precisa caber numa olhada. Três linhas por caixa. Quem quiser
 * mais abre o painel — o link vai no fim.
 *
 * A ordem é a do jogo do Rayakuza: pools primeiro, redes depois. A versão anterior
 * abria com redes e ele lia o que menos usa.
 */
export function textoDoRadar({ dia, pools, redes, mudou, endereco }, porCaixa = 3) {
  const l = [`<b>Radar DeFi — ${dia}</b>`];

  const poolLinha = (p) => {
    /* Aqui o LINK É O NOME, e não uma linha própria.
     *
     * O apanhado das 8h tem quatro caixas de três pools: uma linha "onde
     * encontrar" em cada uma seriam doze linhas a mais numa mensagem que
     * precisa caber numa olhada. Pendurar o link no nome custa zero linha e
     * chega no mesmo lugar. Na lista do /pools, que é onde ele já foi procurar,
     * o link ganha linha própria. */
    const onde = enderecoDaPool(p.id);
    const nome = onde
      ? `<a href="${onde}"><b>${escapar(p.projeto)}</b></a>`
      : `<b>${escapar(p.projeto)}</b>`;
    const cabeca = `${nome} ${escapar(p.simbolo || "")} · ${escapar(p.rede)} · ${dinheiro(p.tvl)}`;
    // Cartaz e chão sempre juntos: é a distância entre os dois que informa.
    const nums = p.chao != null
      ? `   cartaz ${p.cartaz?.toFixed(1)}% · <b>chão ${p.chao.toFixed(1)}%</b>` +
        (p.pior != null ? ` · pior dia ${p.pior.toFixed(1)}%` : "")
      : `   anuncia ${p.cartaz?.toFixed(1)}% · sem histórico pra medir`;
    return `${cabeca}\n${nums}`;
  };

  const caixaDePool = (titulo, lista, vazio) => {
    if (!lista?.length) { l.push(`\n${titulo}\n<i>${vazio}</i>`); return; }
    l.push(`\n${titulo}`);
    for (const p of lista.slice(0, porCaixa)) l.push(poolLinha(p));
  };

  if (pools) {
    caixaDePool("🟢 <b>Firmes</b> — pagam parecido todo dia, e vem de TAXAS",
      pools.firmes, "nenhuma no corte de hoje");
    caixaDePool("🟡 <b>Incentivadas</b> — pagam bem, mas com INCENTIVO (tem prazo)",
      pools.alugadas, "nenhuma");
    caixaDePool("🔴 <b>Loterias</b> — cartaz grande, chão baixo",
      pools.loterias, "nenhuma, o que é bom sinal");
    if (pools.novas?.length) {
      l.push("\n🆕 <b>Montadas agora</b> — sem histórico ainda");
      for (const p of pools.novas.slice(0, porCaixa)) {
        l.push(`<b>${escapar(p.projeto)}</b> ${escapar(p.simbolo || "")} · ${escapar(p.rede)} · ${dinheiro(p.tvl)} · ${p.idade ?? "?"} dias`);
      }
    }
  }

  const redeLinha = (r) => `<b>${escapar(r.rede)}</b> ${dinheiro(r.tvl)} · ${pct(r.var7d)} (${dinheiro(r.abs7d)})`;
  const caixaDeRede = (titulo, lista) => {
    if (!lista?.length) return;
    l.push(`\n${titulo}`);
    for (const r of lista.slice(0, porCaixa)) l.push(redeLinha(r));
  };

  if (redes) {
    caixaDeRede("🐋 <b>Grandes recebendo</b>", redes.grandes?.subiram);
    caixaDeRede("🐋 <b>Grandes perdendo</b>", redes.grandes?.cairam);
    caixaDeRede("🌱 <b>Pequenas acelerando</b>", redes.pequenas?.subiram);
    caixaDeRede("🌱 <b>Pequenas esvaziando</b>", redes.pequenas?.cairam);
  }

  if (mudou?.entraram?.length || mudou?.sairam?.length) {
    l.push("\n🔄 <b>Mudou desde ontem</b>");
    if (mudou.entraram?.length) {
      l.push(`entraram: ${mudou.entraram.slice(0, 4).map((x) => escapar(x.projeto || x.id)).join(", ")}`);
    }
    if (mudou.sairam?.length) {
      l.push(`saíram: ${mudou.sairam.slice(0, 4).map((x) => escapar(x.projeto || x.id)).join(", ")}`);
    }
  }

  if (endereco) l.push(`\n<a href="${endereco}">abrir o painel</a>`);
  l.push("\n<i>Cartaz = o que ela anuncia (fotografia do momento, não contrato). Chão = o que pagou em 9 de cada 10 dias — a parte em que dá pra contar. Taxas vêm de quem negocia; incentivo é token impresso, e tem prazo.</i>");
  return l.join("\n");
}

/* O ciclo, escrito.
 *
 * A ordem das linhas é deliberada: primeiro o que vale (é o que ele veio
 * perguntar), depois de onde saiu, e só então o que fazer a respeito. E os dois
 * eixos aparecem SEMPRE, mesmo quando ele fixou o ciclo na mão — é assim que
 * ele descobre que a escolha dele envelheceu, sem que o radar a desfaça. */
export function textoDoCiclo(c, { acabouDeMudar = false } = {}) {
  const emoji = c.ciclo === "bull" ? "🟢" : c.ciclo === "bear" ? "🔻" : "🟡";
  const linhas = [];

  linhas.push(`${emoji} <b>${c.texto}</b>`);

  const eixos = c.leitura?.porque || [];
  if (eixos.length) {
    linhas.push("");
    linhas.push(c.origem === "escolhido" ? "<i>O que eu estou medindo:</i>" : "<i>Por quê:</i>");
    for (const e of eixos) linhas.push(`· ${e}`);
    if (c.leitura?.diasNoRegime != null) {
      linhas.push(`· o preço está desse lado há <b>${c.leitura.diasNoRegime} dias</b>`);
    }
    if (c.medidoEm) linhas.push(`<i>medido em ${c.medidoEm}</i>`);
  } else {
    linhas.push("");
    linhas.push("<i>Ainda não medi os eixos — a leitura é feita na rodada das 8h.</i>");
  }

  /* Discordância anunciada, escolha preservada. O radar não desfaz o que ele
   * decidiu; só não deixa a decisão passar em branco quando a medida mudou. */
  if (c.discorda) {
    linhas.push("");
    linhas.push(`⚠️ Você fixou <b>${c.ciclo}</b>, mas o que eu meço hoje dá <b>${c.leitura.ciclo}</b>. Continua valendo o seu — <code>/ciclo auto</code> devolve pra medida.`);
  }

  linhas.push("");
  linhas.push(acabouDeMudar
    ? "<i>Pronto. Vale a partir da próxima leitura do painel.</i>"
    : "<i>/ciclo bull · /ciclo bear · /ciclo auto</i>");
  return linhas.join("\n");
}

/* O aviso de quebra da rodada.
 *
 * O aviso já existia e já funcionava: em 05/09/2026 o Rayakuza recebeu, às 17h,
 * "⚠️ O radar quebrou nesta rodada: D1_ERROR: Your account has exceeded D1's
 * free tier daily row write limit. Upgrade to a paid plan or wait until
 * tomorrow (midnight UTC) to continue. See https://developers.cloudflare.com/…"
 *
 * Ou seja: chegou a informação certa, na hora certa, em inglês técnico, com
 * link de documentação de desenvolvedor. Ele leu e resolveu — mas teve que
 * traduzir sozinho o que aquilo queria dizer pro radar dele.
 *
 * Erro de programa não é conversa. A mensagem crua fica no fim, pra quando
 * alguém precisar procurar; na frente vai o que aconteceu e o que fazer. */
export function textoDaQuebra(erro) {
  const cru = String(erro?.message || erro || "sem detalhe");

  const conhecidos = [
    {
      quando: /daily row write limit|exceeded .*D1/i,
      titulo: "O banco chegou ao limite de escrita do dia.",
      recado: "As contas de hoje não foram gravadas. O limite zera à meia-noite de Londres (21h de Brasília) e a rodada da manhã se recompõe sozinha. Se estiver acontecendo todo dia, é sinal de que o plano do banco ficou pequeno.",
    },
    {
      quando: /429|rate limit/i,
      titulo: "O DefiLlama recusou as chamadas por excesso de pedidos.",
      recado: "Nada quebrado do nosso lado: é a fonte pedindo calma. A próxima rodada costuma passar.",
    },
    {
      quando: /D1_ERROR|no such (table|column)/i,
      titulo: "O banco recusou uma gravação.",
      recado: "Isso é defeito nosso, não do mercado — alguma tabela não está como o código espera.",
    },
    {
      quando: /respondeu 5\d\d|fetch failed|network/i,
      titulo: "Não consegui falar com o DefiLlama.",
      recado: "Pode ser instabilidade deles. Se repetir na próxima rodada, aí é pra investigar.",
    },
  ];

  const achado = conhecidos.find((c) => c.quando.test(cru));
  if (!achado) {
    return `⚠️ <b>O radar quebrou nesta rodada.</b>

Não reconheci o motivo, então vai cru:
<code>${escapar(cru).slice(0, 500)}</code>`;
  }
  return [
    `⚠️ <b>${achado.titulo}</b>`,
    "",
    achado.recado,
    "",
    `<i>Motivo técnico: ${escapar(cru).slice(0, 300)}</i>`,
  ].join("\n");
}

/* ---------------------------------------------------------------------------
 * A CARTEIRA — o que ele já tem.
 *
 * Regra de escrita desta seção: nenhuma frase manda fazer nada. Nem "saia", nem
 * "aumente", nem "fique de olho". O radar mostra o que mudou desde o dia em que
 * ele entrou, com os dois números lado a lado, e a decisão fica onde ela é.
 * ------------------------------------------------------------------------- */

export function textoDaCarteira(situacoes) {
  if (!situacoes.length) {
    return [
      "Você não está acompanhando nenhuma pool ainda.",
      "",
      "Quando entrar numa, me diz: <code>/entrei raydium RAY-USDC</code>",
      "",
      "Eu guardo a foto daquele dia — chão, incentivo, tamanho, correlação do par — e passo a te avisar quando algum deles mudar de verdade. Sem isso, daqui a dois meses não tem como saber como a pool estava quando você entrou.",
    ].join("\n");
  }

  const l = [`<b>Suas pools</b> — ${situacoes.length}`];
  const comMudanca = situacoes.filter((s) => s.mudancas.length).length;
  l.push(comMudanca
    ? `<i>${comMudanca} com mudança desde a entrada</i>`
    : "<i>nenhuma mudou de forma relevante</i>");
  l.push("");

  for (const s of situacoes) {
    const onde = enderecoDaPool(s.id);
    const nome = onde
      ? `<a href="${onde}"><b>${escapar(s.projeto)}</b></a>`
      : `<b>${escapar(s.projeto)}</b>`;
    l.push(`${nome} ${escapar(s.simbolo || "")} · ${escapar(s.rede)}`);
    l.push(`   desde ${s.desde}${s.dias != null ? ` (${s.dias} dia${s.dias === 1 ? "" : "s"})` : ""}`);

    /* Os dois números lado a lado, sempre. "Chão 12%" sozinho não diz nada a
     * quem entrou quando era 30%. */
    if (s.chaoEntrada != null && s.chaoHoje != null) {
      const seta = s.chaoHoje > s.chaoEntrada ? "↑" : s.chaoHoje < s.chaoEntrada ? "↓" : "=";
      l.push(`   chão: ${s.chaoEntrada.toFixed(1)}% na entrada ${seta} <b>${s.chaoHoje.toFixed(1)}% hoje</b>`);
    }
    if (s.incentivoEntrada != null && s.incentivoHoje != null) {
      l.push(`   incentivo: ${s.incentivoEntrada.toFixed(0)}% → ${s.incentivoHoje.toFixed(0)}% do rendimento`);
    }

    if (s.mudancas.length) {
      for (const m of s.mudancas.slice(0, 3)) l.push(`   ⚠️ ${escapar(m.texto)}`);
    } else {
      l.push(`   ✅ ${escapar(s.resumo)}`);
    }
    l.push("");
  }

  l.push("<i>Isto é o que mudou, não o que fazer. /sai &lt;pool&gt; pra parar de acompanhar.</i>");
  return l.join("\n");
}

/* Quando a busca dele bate em mais de uma pool.
 *
 * Devolvo o comando pronto com o id, e não um número de lista: número de lista
 * exigiria eu guardar "a última lista que mandei pra ele", e uma lista guardada
 * envelhece — ele responde "3" amanhã e entra na pool errada. */
export function textoDeCandidatas(achadas, busca) {
  const l = [`Achei ${achadas.length} pools com "${escapar(busca)}". Qual delas?`, ""];
  for (const p of achadas) {
    l.push(`<b>${escapar(p.projeto)}</b> ${escapar(p.simbolo || "")} · ${escapar(p.rede)} · ${dinheiro(p.tvl)}`);
    if (p.chao != null) l.push(`   cartaz ${Number(p.cartaz ?? 0).toFixed(1)}% · chão ${p.chao.toFixed(1)}%`);
    l.push(`   <code>/entrei ${p.id}</code>`);
    l.push("");
  }
  l.push("<i>Toca no código da que for a sua.</i>");
  return l.join("\n");
}

export function textoDaEntradaGuardada(foto, medida) {
  const l = [
    `✅ Acompanhando <b>${escapar(foto.projeto)} ${escapar(foto.simbolo || "")}</b> · ${escapar(foto.rede)}`,
    "",
    "<b>A foto de hoje, que fica guardada:</b>",
  ];
  if (foto.chao_entrada != null) {
    l.push(`· chão ${foto.chao_entrada.toFixed(1)}% (cartaz ${Number(foto.cartaz_entrada ?? 0).toFixed(1)}%)`);
  }
  if (foto.incentivo_entrada != null) {
    l.push(`· ${foto.incentivo_entrada.toFixed(0)}% do rendimento vem de incentivo`);
  }
  if (foto.tvl_entrada != null) l.push(`· ${dinheiro(foto.tvl_entrada)} parados na pool`);
  if (foto.correlacao_entrada != null) {
    l.push(`· os dois tokens do par andam a ${foto.correlacao_entrada.toFixed(2)} de correlação`);
  }

  l.push("");
  l.push("Vou te avisar se o chão cair um terço, se o incentivo acabar, se metade do dinheiro sair da pool, se o par se soltar, ou se ela deixar de passar nos portões do método.");
  const onde = enderecoDaPool(foto.id);
  if (onde) l.push(`\n<a href="${onde}">abrir a pool ↗</a>`);
  return l.join("\n");
}

/* O aviso que chega sem ele pedir. Só o que mudou, e só das que mudaram. */
export function textoDeAvisoDaCarteira(situacoes) {
  const mudaram = situacoes.filter((s) => s.mudancas.length);
  if (!mudaram.length) return null;

  const l = ["<b>⚠️ Mudou nas suas pools</b>", ""];
  for (const s of mudaram) {
    const onde = enderecoDaPool(s.id);
    const nome = onde
      ? `<a href="${onde}"><b>${escapar(s.projeto)}</b></a>`
      : `<b>${escapar(s.projeto)}</b>`;
    l.push(`${nome} ${escapar(s.simbolo || "")} · ${escapar(s.rede)}`);
    for (const m of s.mudancas.slice(0, 2)) l.push(`   ${escapar(m.texto)}`);
    l.push("");
  }
  l.push("<i>É o que mudou desde o dia em que você entrou. O que fazer é com você.</i>");
  return l.join("\n");
}

/* O mesmo par, em toda parte — no celular.
 *
 * A tela do painel mostra os pares que MAIS variam; aqui ele pergunta por um
 * específico, que é como a aula faz: "eu quero ETH-USDC, onde abro?". */
export function textoDaComparacao(c, busca) {
  if (!c) {
    return [
      `Não achei "${escapar(busca)}" em mais de um lugar hoje.`,
      "",
      "Só dá pra comparar par que existe em duas redes ou protocolos ao mesmo tempo — e só entre as pools que passam nos portões do método.",
      "",
      "Tenta assim: <code>/par ETH-USDC</code> · <code>/par SOL-USDC</code>",
    ].join("\n");
  }

  const l = [`<b>${escapar(c.par)}</b> — onde paga mais`];
  if (c.espalhamento >= 1.5) {
    l.push(`<i>${c.espalhamento.toFixed(1)}x de diferença entre o melhor e o pior lugar</i>`);
  }
  l.push("");

  for (const [i, o] of c.opcoes.entries()) {
    const marca = i === 0 ? "🥇" : "  ";
    l.push(`${marca} <b>${o.multiplicador.toFixed(3)}%/dia</b> · ${escapar(o.projeto)} na ${escapar(o.rede)}`);
    l.push(`      ${dinheiro(o.tvl)} parados${o.chao != null ? ` · chão ${o.chao.toFixed(1)}%` : ""}`);
  }

  if (c.notaDoTvl) {
    l.push("");
    l.push(`💡 ${escapar(c.notaDoTvl.texto)}`);
  }

  l.push("");
  l.push("<i>Ordenado pelo multiplicador do método: taxas 24h ÷ TVL. O que fazer com isso é com você.</i>");
  return l.join("\n");
}

export const AJUDA = [
  "<b>Radar DeFi</b> — o que dá pra pedir:",
  "",
  "/minhas — as pools em que você já está, e o que mudou",
  "/entrei raydium RAY-USDC — passar a acompanhar uma",
  "/sai raydium — parar de acompanhar",
  "",
  "/par ETH-USDC — onde esse par paga mais",
  "/radar — o panorama de agora",
  "/ciclo — bull ou bear, e a meta que sai disso",
  "/entrando — redes recebendo dinheiro",
  "/pequenas — redes pequenas acelerando",
  "/saindo — de onde está saindo dinheiro",
  "/rede Base — a ficha de uma rede",
  "/pools — onde o dinheiro está rendendo",
  "/pools Base — só nessa rede",
  "/novas — pools montadas nos últimos 21 dias",
  "/firmes — as que vivem de taxas",
  "/incentivadas — as que vivem de incentivo (tem prazo)",
  "/loterias — cartaz grande, chão baixo",
  "/seguir Base — avisar de qualquer mexida nessa rede",
  "/parar Base — parar de seguir",
  "/seguindo — quais estou seguindo",
  "/painel — o endereço do painel",
  "/copia — a cópia de segurança da sua carteira, agora",
  "",
  "<i>Ele fala sozinho três vezes por dia (8h, 12h e 18h) e faz um apanhado nas segundas.</i>",
].join("\n");

/* Manda a mensagem. Devolve o chat_id usado, que é o que permite descobrir o
 * chat na primeira conversa e guardá-lo. */
/* MANDAR UM ARQUIVO, e nao um texto.
 *
 * Pedido dele em 09/09/2026: "preciso que seja automatico, nao vou lembrar
 * sempre". O bot ja tem o chat aberto com ele e ja tem permissao de mandar
 * coisa — entao a copia de seguranca chega por onde nada precisa ser
 * configurado. O arquivo fica no Telegram dele, que esta no celular dele.
 *
 * Nao substitui a copia no Drive: soma. Uma copia so nao e copia. */
export async function mandarArquivo(env, chat, nome, conteudo, legenda) {
  const destino = chat || env.TELEGRAM_CHAT;
  if (!destino) throw new Error("não sei pra qual chat falar");

  const forma = new FormData();
  forma.append("chat_id", String(destino));
  if (legenda) forma.append("caption", legenda.slice(0, 1000));
  forma.append("document", new Blob([conteudo], { type: "application/json" }), nome);

  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendDocument`, {
    method: "POST",
    body: forma,
  });
  if (!r.ok) throw new Error(`o Telegram recusou o arquivo (${r.status}): ${(await r.text()).slice(0, 160)}`);
  return destino;
}

export async function falar(env, texto, chat) {
  const destino = chat || env.TELEGRAM_CHAT;
  if (!destino) throw new Error("não sei pra qual chat falar");
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: destino,
      text: texto.slice(0, 4000), // o Telegram corta em 4096; sobra pra margem
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!r.ok) throw new Error(`o Telegram recusou (${r.status}): ${await r.text()}`);
  return destino;
}
