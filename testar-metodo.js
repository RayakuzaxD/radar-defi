/* Prova o método do Defiverso contra os números do próprio curso.
 *
 *   node testar-metodo.js
 *
 * Os casos com número vêm dos módulos, não de mim. Se um destes ficar vermelho,
 * o radar deixou de seguir o método em que o Rayakuza baseia os investimentos —
 * que é um erro pior que qualquer bug de tela.
 */

import {
  GIRO, giro, lerGiro, perdaImpermanente, descolamentoQueZera,
  atividadeDeMercado, lerMultiplo, precoValor, receitaCobreIncentivo,
  fichaDefiverso, porqueDefiverso, multiplicador, cartazContraChao, CARTAZ_INFLADO_MEU,
  faixaDeTaxa, lerFaixa,
  PORTOES, TOKENS, classificarToken, notaDoMetodo, passaNosPortoes,
} from "./src/metodo.js";

let passou = 0, falhou = 0;
const M = 1e6;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

// ---------------------------------------------------------------------------
titulo("Perda impermanente — a tabela do Módulo 8, página 17");

{
  // Os sete pares que o curso lista. Tolerância de 0,15 ponto porque a tabela
  // do curso está arredondada a uma casa.
  const tabela = [[1.25, -0.6], [1.5, -2.0], [1.75, -3.8], [2, -5.7],
                  [3, -13.4], [4, -20.0], [5, -25.5]];
  for (const [razao, esperado] of tabela) {
    conferir(`${razao}x de descolamento dá ${esperado}%`,
      Math.abs(perdaImpermanente(razao) - esperado) < 0.15,
      `saiu ${perdaImpermanente(razao)?.toFixed(2)}%`);
  }
  conferir("sem descolamento, não há perda", Math.abs(perdaImpermanente(1)) < 0.001);
  conferir("razão inválida devolve null", perdaImpermanente(0) === null);
}

// ---------------------------------------------------------------------------
titulo("A regra do 3: TVL baixo, volume alto");

{
  // uniswap-v4 ETH-USDT em 05/09/2026: $0,5M parados, $121M girados na semana.
  const excelente = giro(121 * M, 0.5 * M);
  conferir("pool que gira 240x é reconhecida", excelente > 200);
  conferir("e é lida como excelente", lerGiro(excelente).nivel === "excelente");

  // A mediana do mercado naquele dia era 0,87x.
  conferir("a mediana do mercado não é elogiada", lerGiro(0.87).nivel === "fraco",
    "girar menos que o próprio tamanho na semana é capital parado");
  conferir("giro médio é chamado de médio", lerGiro(2).nivel === "médio");

  conferir("pool sem volume não recebe nota", giro(null, 10 * M) === null);
  conferir("TVL zero não divide por zero", giro(100, 0) === null);
  conferir("e a leitura de null explica o motivo",
    lerGiro(null).texto.includes("não informa volume"));
}

// ---------------------------------------------------------------------------
titulo("O multiplicador do Genesis — Taxas 24h / TVL");

{
  /* A álgebra: taxa24h = apyBase% * TVL / 365, entao Taxas24h/TVL = apyBase/36500.
   * Em % ao dia isso e apyBase/365. Conferido contra pools reais em 05/09/2026,
   * batendo em 8 casas. */
  const tvl = 10 * M, apyBase = 36.5;
  const taxa24 = (apyBase / 100) * tvl / 365;
  const multBruto = taxa24 / tvl;
  conferir("o multiplicador reproduz Taxas24h/TVL",
    Math.abs(multiplicador(apyBase) / 100 - multBruto) < 1e-12,
    `mult=${multiplicador(apyBase)}%/dia vs bruto=${multBruto}`);
  conferir("36,5% ao ano dá 0,1% ao dia", Math.abs(multiplicador(36.5) - 0.1) < 1e-9);

  conferir("NÃO depende de volume",
    multiplicador(20) != null,
    "so 22% das pools tem volume; ranquear por volume/TVL deixava 3/4 sem nota");
  conferir("sem apyBase não há multiplicador", multiplicador(null) === null);
  conferir("apyBase negativo é recusado", multiplicador(-5) === null);
  conferir("maior apyBase, maior multiplicador", multiplicador(50) > multiplicador(20));

  /* O bug que passou despercebido e foi pro ar: o multiplicador vinha do APY
   * TOTAL, com a emissão dentro. Taxa é o que a pool COBRA de quem negocia;
   * emissão é o oposto — é a pool pagando pra atrair. Somar os dois apaga a
   * distinção que o método inteiro existe pra fazer.
   *
   * Este caso fixa que dois pools com o mesmo APY total mas composições
   * opostas NÃO podem ter o mesmo multiplicador. */
  const deUso = { apyBase: 30, apyReward: 0 };
  const alugada = { apyBase: 2, apyReward: 28 };
  conferir(
    "duas pools de 30% total, uma de uso e outra emitida, têm multiplicadores diferentes",
    multiplicador(deUso.apyBase) !== multiplicador(alugada.apyBase),
    "se forem iguais, o multiplicador está vindo do APY total e conta emissão como taxa",
  );
  conferir(
    "e a de uso real vale mais de dez vezes a alugada",
    multiplicador(deUso.apyBase) > multiplicador(alugada.apyBase) * 10,
  );
}

// ---------------------------------------------------------------------------
titulo("O cartaz contra o chão — a pool comparada com ela mesma");

{
  /* ESTE BLOCO ERA SOBRE UMA META MENSAL, E A META FOI REMOVIDA.
   *
   * Havia aqui `META_MENSAL.bear === 4 && META_MENSAL.bull === 20`, citando um
   * METODOLOGIA_GENESIS que, procurado em 10/09/2026, não existe: nem nos 44
   * PDFs do curso, nem nas 84 transcrições do canal, nem no disco dele. Ele
   * perguntou de onde tinha saído aquele "4% ao mês" na tela, e a resposta
   * honesta foi "não sei". Mandou tirar.
   *
   * O teste antigo era exemplar no formato e vazio no conteúdo: travava um
   * número contra ele mesmo. Um teste só vale o quanto vale a fonte do número
   * que ele guarda — e este guardava um número sem fonte, com toda a
   * aparência de rigor.
   *
   * O QUE FICOU não precisa de fonte externa nenhuma: o que a pool anuncia
   * contra o que ela pagou. Fato medido nela mesma. */
  const inflada = cartazContraChao(24, 300);
  conferir("cartaz muito acima do chão é marcado", inflada.inflado === true,
    inflada.quantasVezes.toFixed(1) + " vezes");
  conferir("e ela diz quantas vezes", Math.abs(inflada.quantasVezes - 12.5) < 1e-9);

  const honesta = cartazContraChao(60, 66);
  conferir("cartaz perto do chão não é marcado", honesta.inflado === false);
  conferir("os dois em % ao mês", Math.abs(honesta.aoMesGarantido - 5) < 1e-9 &&
    Math.abs(honesta.aoMesAnunciado - 5.5) < 1e-9);

  /* Exatamente no corte não é "inflado por pouco": o corte é >=, e isso está
     escrito no teste pra ninguém trocar por > sem perceber. */
  const noCorte = cartazContraChao(10, 10 * CARTAZ_INFLADO_MEU);
  conferir("exatamente no corte conta como inflado", noCorte.inflado === true);

  conferir("sem chão não se afirma nada",
    cartazContraChao(null, 300).inflado === false,
    "sem o que comparar, a resposta é 'não sei', e não sei não vira aviso");
  conferir("chão zero não vira divisão por zero",
    cartazContraChao(0, 300).quantasVezes === null);
}

// ---------------------------------------------------------------------------
titulo("A faixa de taxa, tirada do texto solto do DefiLlama");

{
  // Os formatos que aparecem de verdade no banco, em 07/09/2026.
  conferir("0.3% simples", faixaDeTaxa("0.3%") === 0.3);
  conferir("com zero à direita dá o mesmo", faixaDeTaxa("0.30%") === 0.3);
  conferir("prefixo do protocolo não atrapalha", faixaDeTaxa("Standard - 0.25%") === 0.25);
  conferir("nem o tick spacing", faixaDeTaxa("CL10 - 0.05%") === 0.05);
  conferir("faixa dinâmica baixíssima é aceita", faixaDeTaxa("CL1 - 0.0085%") === 0.0085,
    "aerodrome CL1 cobra isso mesmo");
  conferir("faixa alta real é aceita", faixaDeTaxa("CL2000 - 1.5%") === 1.5);

  conferir("meta sem % não vira faixa", faixaDeTaxa("Senior Pool") === null);
  conferir("nem texto de vencimento", faixaDeTaxa("For LP | Maturity 17DEC2026") === null);
  conferir("nem vazio", faixaDeTaxa(null) === null && faixaDeTaxa("") === null);

  /* O caso que motivou o teto: uma uniswap-v4 com meta "5.09%" e apyBase 317%.
   * Pode ser hook de taxa dinâmica, pode ser um APY no campo errado — e sem
   * volume declarado não dá pra decidir pela identidade. Não mostrar. */
  conferir("acima de 2% não é tratado como faixa", faixaDeTaxa("5.09%") === null,
    "mostrar faixa que não dá pra conferir é apresentar palpite como fato");

  conferir("0,3% é lido como o normal do mercado", lerFaixa(0.3).nivel === "comum");
  conferir("0,05% é lido como baixa", lerFaixa(0.05).nivel === "baixa");
  conferir("e a leitura de baixa explica a consequência",
    lerFaixa(0.05).texto.includes("muito volume"));
  conferir("1% é lido como alta", lerFaixa(1).nivel === "alta");
  conferir("sem faixa não há leitura", lerFaixa(null) === null);
}

// ---------------------------------------------------------------------------
titulo("Preço contra valor — Módulo 4, página 28");

{
  conferir("abaixo de 0,5 é muito barato", lerMultiplo(0.4).faixa === "muito barato");
  conferir("abaixo de 1 é barato", lerMultiplo(0.8).faixa === "barato");
  conferir("até 1,5 é preço justo", lerMultiplo(1.4).faixa === "preço justo");
  conferir("acima de 2 é caro", lerMultiplo(3).faixa === "caro");
  conferir("sem número não inventa faixa", lerMultiplo(null) === null);

  const p = precoValor({ fdv: 800 * M, tvl: 2000 * M, receitaAnual: 600 * M });
  conferir("FDV/TVL é calculado", p.fdvSobreTvl.faixa === "muito barato");
  conferir("FDV/receita é calculado", p.fdvSobreReceita.faixa === "preço justo");
  // O curso define "até 1,5 justo" e "maior que 2 caro", e deixa o meio sem
  // nome. Chamei de "esticado" — e o teste fixa que 2,0 NÃO vira "caro", que é
  // o que o texto diz.
  conferir("exatamente 2,0 ainda não é 'caro'", lerMultiplo(2).faixa === "esticado");
  conferir("sem receita, o múltiplo dela fica null",
    precoValor({ fdv: 100, tvl: 100, receitaAnual: 0 }).fdvSobreReceita === null,
    "dividir por zero receita daria infinito e pareceria 'caríssimo'");
}

// ---------------------------------------------------------------------------
titulo("Atividade de mercado — Módulo 4, página 19");

{
  // "2%-4% em 24h e 10%-20% em 7 dias"
  const saudavel = atividadeDeMercado(3 * M, 15 * M, 100 * M);
  conferir("3% no dia está na faixa", saudavel.diaOk === true);
  conferir("15% na semana está na faixa", saudavel.semanaOk === true);
  conferir("e a leitura confirma", saudavel.leitura.includes("faixa saudável"));

  const seco = atividadeDeMercado(0.5 * M, 3 * M, 100 * M);
  conferir("volume baixo é reprovado", seco.diaOk === false);
  conferir("e avisa do risco de não conseguir sair",
    seco.leitura.includes("faltar liquidez"));

  const agitado = atividadeDeMercado(12 * M, 60 * M, 100 * M);
  conferir("volume alto demais também é reprovado", agitado.diaOk === false);
  conferir("e é chamado de agitação, não de uso",
    agitado.leitura.includes("agitação"));

  conferir("sem valor de mercado, não se avalia",
    atividadeDeMercado(1, 1, 0).aplica === false);
}

// ---------------------------------------------------------------------------
titulo("Receita maior que incentivo");

{
  const boa = receitaCobreIncentivo(18, 2);
  conferir("rendimento majoritariamente de uso passa", boa.cobre === true);
  conferir("e a fatia é medida", Math.round(boa.fatiaDeUso) === 90);

  const subsidiada = receitaCobreIncentivo(3, 17);
  conferir("rendimento majoritariamente emitido reprova", subsidiada.cobre === false);

  conferir("sem rendimento nenhum não se avalia",
    receitaCobreIncentivo(0, 0).aplica === false);
}

// ---------------------------------------------------------------------------
titulo("O rendimento paga o risco?");

{
  const gordo = descolamentoQueZera(20);
  conferir("20% ao ano aguenta um descolamento grande", gordo > 2.5);
  const fino = descolamentoQueZera(2);
  // A perda em 1,5x é exatamente 2,0% na tabela do curso, então 1,50 é a
  // resposta certa — e o limite do teste tem que incluí-la.
  conferir("2% ao ano some com 1,5x de descolamento", fino <= 1.5 && fino >= 1.49);
  conferir("a ordem é a esperada", gordo > fino);
  conferir("sem rendimento não há conta", descolamentoQueZera(0) === null);
}

// ---------------------------------------------------------------------------
titulo("A ficha, no formato do estudo de caso do Módulo 4");

{
  const boa = {
    tvl: 0.5 * M, volume7d: 121 * M, apy: 21, apyBase: 21, apyReward: 0,
    chao: 18, parRisco: "meio estável",
    parExplica: "um lado é stablecoin e o outro não: se o outro andar, você perde valor mesmo a pool pagando",
  };
  const f = fichaDefiverso(boa);
  const item = (p) => f.itens.find((i) => i.pergunta.includes(p));

  conferir("a ficha responde a regra do 3", item("TVL baixo").resposta === "sim");
  conferir("responde sobre o par", !!item("Par bom"));
  conferir("responde sobre receita x incentivo", item("Receita maior").resposta === "sim");
  conferir("e sobre o risco de descolamento", !!item("paga o risco"));
  conferir("cada item traz o detalhe que explica",
    f.itens.every((i) => typeof i.detalhe === "string"));
  conferir("e um peso pra colorir na tela",
    f.itens.every((i) => ["bom", "ruim", "neutro"].includes(i.peso)));

  const frase = porqueDefiverso(boa, f);
  conferir("a frase fala em giro", frase.includes("girando"));

  const ruim = {
    tvl: 500 * M, volume7d: 20 * M, apy: 12, apyBase: 2, apyReward: 10,
    chao: 11, parRisco: "par volátil", parExplica: "os dois lados variam de preço",
  };
  const f2 = fichaDefiverso(ruim);
  conferir("pool de muito capital parado reprova na regra do 3",
    f2.itens.find((i) => i.pergunta.includes("TVL baixo")).resposta === "não");
  /* "incentivo" e não "token emitido": a palavra é do Guia 3 do Predador
   * ("Incentivos/Earnings", ao lado de "Taxas/fees"). Eu tinha inventado a
   * minha tendo a dele à mão, e o Rayakuza lê o radar com o vocabulário do curso. */
  conferir("e a frase avisa do incentivo, na palavra do curso",
    porqueDefiverso(ruim, f2).includes("incentivo"));

  /* A frase precisa FECHAR nos extremos.
   *
   * "100% do rendimento vem de TAXAS, o resto é INCENTIVO" não existe: se são
   * 100%, não há resto. Frase que se contradiz faz duvidar do número, e o
   * número estava certo. */
  const soTaxa = fichaDefiverso({ ...ruim, apy: 12, apyBase: 12, apyReward: 0 });
  const linhaTaxa = soTaxa.itens.find((i) => i.pergunta.includes("Receita maior"));
  conferir("com 100% de taxas a frase não inventa um resto",
    linhaTaxa && !linhaTaxa.detalhe.includes("o resto"),
    linhaTaxa && linhaTaxa.detalhe);

  const soIncentivo = fichaDefiverso({ ...ruim, apy: 12, apyBase: 0, apyReward: 12 });
  const linhaInc = soIncentivo.itens.find((i) => i.pergunta.includes("Receita maior"));
  conferir("com 0% de taxas também não", linhaInc && !linhaInc.detalhe.includes("o resto"),
    linhaInc && linhaInc.detalhe);

  const meio = fichaDefiverso({ ...ruim, apy: 12, apyBase: 6, apyReward: 6 });
  const linhaMeio = meio.itens.find((i) => i.pergunta.includes("Receita maior"));
  conferir("no meio do caminho o resto continua sendo dito",
    linhaMeio && linhaMeio.detalhe.includes("o resto"), linhaMeio && linhaMeio.detalhe);
}

// ---------------------------------------------------------------------------
titulo("Os portões — os cortes binários, antes do multiplicador");

const pool = (extra) => ({
  simbolo: "SOL-USDC", tvl: 2 * M, apyBase: 60, apy: 62, volume1d: 500e3, ...extra,
});

{
  conferir("pool boa passa", passaNosPortoes(pool({})).passa === true);

  const pequena = passaNosPortoes(pool({ tvl: 300e3 }));
  conferir("TVL abaixo de $500k é barrado", pequena.passa === false);
  conferir("e o motivo diz o número", pequena.motivos[0].includes("500k"));

  conferir("volume 24h abaixo de $10k é barrado",
    passaNosPortoes(pool({ volume1d: 5e3 })).passa === false);

  conferir("rendimento abaixo do piso de 18,25% é barrado",
    passaNosPortoes(pool({ apyBase: 10, apy: 10 })).passa === false);

  // A faixa entre o piso de descarte e o mínimo aceitável existe e não some.
  const meio = passaNosPortoes(pool({ apyBase: 19, apy: 19 }));
  conferir("entre 18,25% e 20% a pool passa, mas com aviso", meio.passa === true);
  conferir("e o aviso nomeia a faixa",
    meio.avisos.some((a) => a.includes("mínimo aceitável")));
}

{
  conferir("nome de armadilha barra antes de qualquer conta",
    passaNosPortoes(pool({ simbolo: "TESTCOIN-USDC" })).motivos
      .some((m) => m.includes("nome de armadilha")));
  conferir("a checagem de nome é por conteúdo, não igualdade",
    passaNosPortoes(pool({ simbolo: "SAFERUGPULL-USDC" })).passa === false,
    "RUG dentro do nome tem que pegar");

  conferir("par sem nenhuma perna âncora é barrado",
    passaNosPortoes(pool({ simbolo: "AAA-BBB" })).passa === false);
  conferir("posição única exótica NÃO é barrada por falta de âncora",
    !passaNosPortoes(pool({ simbolo: "AAA" })).motivos.some((m) => m.includes("âncora")),
    "posição única é outro risco, não o da âncora");

  const duasMeme = passaNosPortoes(pool({ simbolo: "BONK-WIF" }));
  conferir("par de duas memecoins é bloqueio duro", duasMeme.passa === false);
  conferir("e o motivo explica o porquê, não só o sintoma",
    duasMeme.motivos[0].includes("duas memecoins"),
    "'sem âncora' também é verdade, mas não ensina nada");
  conferir("memecoin com âncora não é bloqueada",
    passaNosPortoes(pool({ simbolo: "BONK-USDC" })).passa === true);
}

{
  conferir("blue-chip é reconhecido", classificarToken("WETH") === "blue-chip");
  conferir("stablecoin é reconhecida", classificarToken("USDC") === "estável");
  conferir("memecoin é reconhecida", classificarToken("POPCAT") === "memecoin");
  conferir("o resto é desconhecido", classificarToken("ZZZQQ") === "desconhecido");
  conferir("a comparação ignora maiúsculas", classificarToken("weth") === "blue-chip");
}

{
  conferir("200%+ é excelente", notaDoMetodo(250).nivel === "excelente");
  conferir("100-200% é muito bom", notaDoMetodo(150).nivel === "muito-bom");
  conferir("50-100% é bom", notaDoMetodo(60).nivel === "bom");
  conferir("20-50% é razoável", notaDoMetodo(30).nivel === "razoavel");
  conferir("abaixo de 20% é reprovado", notaDoMetodo(15).nivel === "reprovado");
  conferir("sem número não há nota", notaDoMetodo(null) === null);
}

{
  // O caso que uma ordenação por rendimento faria errado sozinha.
  const subsidiada = passaNosPortoes(pool({ simbolo: "ETH-WBTC", apyBase: 300, apy: 300 }));
  conferir("300% num par de blue-chips vira aviso de subsídio",
    subsidiada.avisos.some((a) => a.includes("subsídio")),
    "o método diz explicitamente que isso é red flag, não oportunidade");

  const spike = passaNosPortoes(pool({ tvl: 1e6, volume1d: 8e6, apyBase: 900, apy: 900 }));
  conferir("volume acima de 5x o TVL é avisado como spike",
    spike.avisos.some((a) => a.includes("spike")));

  const parada = passaNosPortoes(pool({ tvl: 10 * M, volume1d: 100e3 }));
  conferir("pool que negocia menos de 10% do TVL é avisada",
    parada.avisos.some((a) => a.includes("parada")));
}

// ---------------------------------------------------------------------------
console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
