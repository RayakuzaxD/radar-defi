/* Prova que as caixas separam o que precisa ser separado.
 *
 *   node testar-divisoes.js
 */

import { DIVISOES, dividirRedes, porqueDaRede, dividirPools, oQueMudou } from "./src/divisoes.js";

let passou = 0, falhou = 0;
const M = 1e6, B = 1e9;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

/* fichas já vêm ordenadas por TVL, igual ao que montarFichas devolve */
const ficha = (rede, tvl, pct, extras = {}) => ({
  rede, tvl,
  varTvl7d: pct,
  absTvl7d: tvl * (pct / (100 + pct)),
  ...extras,
});

// ---------------------------------------------------------------------------
titulo("Rede grande e rede pequena não competem na mesma lista");

{
  const fichas = [
    ...Array.from({ length: 10 }, (_, i) => ficha(`Gigante${i}`, (50 - i * 4) * B, i === 0 ? 8 : 1)),
    ficha("Pequena", 40 * M, 60),
    ficha("Poeira", 0.5 * M, 400),
  ];
  const d = dividirRedes(fichas);

  conferir("a gigante que subiu 8% entra na caixa das grandes",
    d.grandes.subiram.some((f) => f.rede === "Gigante0"));
  conferir("a pequena que subiu 60% NÃO entra na caixa das grandes",
    !d.grandes.subiram.some((f) => f.rede === "Pequena"));
  conferir("a pequena entra na caixa dela", d.pequenas.subiram.some((f) => f.rede === "Pequena"));
  conferir("rede de brinquedo não entra em lugar nenhum",
    !d.pequenas.subiram.some((f) => f.rede === "Poeira"),
    "+400% de 500 mil dólares é uma pessoa, não tendência");
  conferir("uma gigante subindo 1% não vira notícia",
    !d.grandes.subiram.some((f) => f.rede === "Gigante3"));
}

{
  // O corte de rede grande é MENOR em porcentagem, e isso é proposital.
  const fichas = [
    ...Array.from({ length: 9 }, (_, i) => ficha(`Big${i}`, (40 - i) * B, 0)),
    ficha("Big9", 5 * B, 6),         // grande: 6% já é evento
    ficha("Media", 100 * M, 6),      // pequena: 6% é ruído
  ];
  const d = dividirRedes(fichas);
  conferir("6% numa rede grande é notícia", d.grandes.subiram.some((f) => f.rede === "Big9"));
  conferir("6% numa rede pequena não é", !d.pequenas.subiram.some((f) => f.rede === "Media"));
}

// ---------------------------------------------------------------------------
titulo("Quedas têm caixa própria");

{
  const fichas = [
    ...Array.from({ length: 9 }, (_, i) => ficha(`B${i}`, (40 - i) * B, 0)),
    ficha("BigCaindo", 5 * B, -9),
    ficha("PequenaCaindo", 80 * M, -35),
  ];
  const d = dividirRedes(fichas);
  conferir("grande caindo aparece", d.grandes.cairam.some((f) => f.rede === "BigCaindo"));
  conferir("pequena caindo aparece", d.pequenas.cairam.some((f) => f.rede === "PequenaCaindo"));
  conferir("quem cai não aparece na caixa de quem sobe",
    !d.grandes.subiram.some((f) => f.rede === "BigCaindo"));
}

// ---------------------------------------------------------------------------
titulo("Cada caixa é curta");

{
  const fichas = [
    ...Array.from({ length: 10 }, (_, i) => ficha(`G${i}`, (50 - i) * B, 20)),
    ...Array.from({ length: 30 }, (_, i) => ficha(`P${i}`, 100 * M, 50)),
  ];
  const d = dividirRedes(fichas);
  conferir("no máximo 5 grandes", d.grandes.subiram.length <= DIVISOES.porCaixa);
  conferir("no máximo 5 pequenas", d.pequenas.subiram.length <= DIVISOES.porCaixa);
  conferir("30 candidatas viram 5 linhas", d.pequenas.subiram.length === 5,
    "o valor está em ser um punhado que dá pra ler");
}

{
  // Dentro da caixa, ordena por DINHEIRO movido, não por porcentagem.
  const fichas = [
    ...Array.from({ length: 10 }, (_, i) => ficha(`G${i}`, (60 - i) * B, 0)),
    ficha("MuitoPct", 10 * M, 200),    // 200% mas move ~6,7M
    ficha("MuitoDinheiro", 900 * M, 30), // 30% mas move ~207M
  ];
  const d = dividirRedes(fichas);
  conferir("quem moveu mais dinheiro vem primeiro",
    d.pequenas.subiram[0]?.rede === "MuitoDinheiro",
    "todos já passaram do corte percentual; o que separa é o tamanho");
}

// ---------------------------------------------------------------------------
titulo("A frase escrita em cada linha");

{
  const comDinheiro = ficha("Real", 200 * M, 40, { varStables7d: 25, varTvl1d: 2, varTvl90d: 50 });
  conferir("diz quando é dinheiro de verdade",
    porqueDaRede(comDinheiro).includes("dinheiro de verdade chegando"));

  const soPreco = ficha("Preco", 200 * M, 40, { varStables7d: 1, varTvl1d: 2, varTvl90d: 50 });
  conferir("diz quando é mais preço que depósito",
    porqueDaRede(soPreco).includes("mais preço que depósito"));

  const salto = ficha("Salto", 200 * M, 40, { varTvl1d: 39, varStables7d: 0 });
  conferir("avisa quando tudo aconteceu em 24h",
    porqueDaRede(salto).includes("últimas 24h"));

  const recuperando = ficha("Volta", 200 * M, 30, { varTvl1d: 1, varTvl90d: -40, varStables7d: 0 });
  conferir("avisa quando é recuperação e não crescimento",
    porqueDaRede(recuperando).includes("recuperação"));

  const alugada = ficha("Alugada", 200 * M, 40, { varStables7d: 20, varTvl1d: 2 });
  conferir("avisa quando a rede paga pra ter o dinheiro",
    porqueDaRede(alugada, { qualidade: { alugado: 85 } }).includes("pago pra ficar"));

  const mini = ficha("Mini", 8 * M, 40, { varStables7d: 20, varTvl1d: 2 });
  conferir("avisa que rede pequena move fácil",
    porqueDaRede(mini).includes("um único depósito"));

  conferir("sem stablecoin, a frase não inventa nada",
    !porqueDaRede(ficha("Sem", 200 * M, 40, { varTvl1d: 2 })).includes("Stablecoin"));
}

// ---------------------------------------------------------------------------
titulo("As pools se dividem por comportamento, não por tamanho");

{
  const pools = [
    { id: "a", classe: "firme", chao: 9, abismo: 1, tvl: 50 * M },
    { id: "b", classe: "firme", chao: 12, abismo: 0, tvl: 5 * M },
    { id: "c", classe: "alugada", chao: 21, abismo: 0, tvl: 30 * M },
    { id: "d", classe: "loteria", chao: 8, abismo: 66, tvl: 900 * M },
    { id: "e", classe: "loteria", chao: 2, abismo: 20, tvl: 100 * M },
    { id: "f", classe: "nova", chao: null, abismo: null, tvl: 400 * M },
  ];
  const d = dividirPools(pools);
  conferir("firmes ordenadas pelo chão", d.firmes[0].id === "b");
  conferir("a alugada não se mistura com as firmes",
    d.firmes.every((x) => x.id !== "c") && d.alugadas[0].id === "c",
    "chão 21 é o maior de todos, e ela ainda assim não pode encabeçar as firmes");
  conferir("loterias ordenadas pela promessa não cumprida", d.loterias[0].id === "d");
  conferir("novas aparecem, ordenadas por tamanho", d.novas[0].id === "f");
}

// ---------------------------------------------------------------------------
titulo("O que mudou desde ontem");

{
  const ontem = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const hoje = [{ id: "b" }, { id: "c" }, { id: "d" }];
  const m = oQueMudou(hoje, ontem);
  conferir("acha quem entrou", m.entraram.length === 1 && m.entraram[0].id === "d");
  conferir("acha quem saiu", m.sairam.length === 1 && m.sairam[0].id === "a");
  conferir("sem lista de ontem, tudo é novidade",
    oQueMudou(hoje, null).entraram.length === 3);
  conferir("sem nada hoje, nada quebra", oQueMudou(null, ontem).sairam.length === 3);
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
