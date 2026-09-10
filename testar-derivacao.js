/* A derivação de endereço na Solana.
 *
 *   node testar-derivacao.js
 *
 * ---------------------------------------------------------------------------
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * Ele perguntou "cadê as taxas acumuladas de SOL/ETH?". A tela dizia "as taxas
 * ainda não entram nesta conta", e a causa era daqui.
 *
 * O radar derivava endereços gerando os hashes de 5 bumps (255 a 251) e
 * perguntando à cadeia qual existia. O array de tick do topo daquela posição
 * mora no bump 248 — fora da janela. Nunca era encontrado, e sem os dois
 * arrays a conta de taxas não fecha.
 *
 * E não era uma posição: na Solana o bump canônico desce de 255 até achar um
 * hash que NÃO caia na curva ed25519, e cada passo tem ~50% de chance de
 * cair. Parar em 5 erra sempre que o bump é 250 ou menor — 3,1% de tudo o que
 * o radar deriva. Arrays de tick, posições da Orca, obrigações da Kamino.
 *
 * Uma posição inteira dele podia estar invisível, e a tela diria "você não
 * tem" — que é diferente de "não consegui perguntar".
 *
 * ---------------------------------------------------------------------------
 * O QUE ESTE TESTE GUARDA
 *
 * Que a derivação é EXATA e não estatística. Um teste que só rodasse contra a
 * posição dele passaria mesmo com a versão de 5 bumps quebrada — porque o
 * array do fundo dela está no 255. O caso ruim tem que estar escrito.
 */

import { enderecoDerivado, pontoDaCurva, deBase58 } from "./src/solana.js";
import { sementesDoTickArray, PROGRAMA_ORCA } from "./src/orca.js";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log("  ok   " + oQue); }
  else { falhou++; console.log("  FALHOU  " + oQue + (det ? " — " + det : "")); }
}
const titulo = (t) => console.log("\n" + t);

/* ------------------------------------------------------------------------ */
titulo("O teste da curva, contra chaves que existem de verdade");
{
  /* Chave pública é ponto da curva por construção: ela vem de uma chave
     privada. Se o teste dissesse que uma delas está fora, ele estaria
     dizendo que um endereço real poderia ser um endereço derivado. */
  const NA_CURVA = [
    ["System Program", "11111111111111111111111111111111"],
    ["Token Program", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"],
    ["Token-2022", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"],
    ["Orca Whirlpool", "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"],
  ];
  for (const [nome, chave] of NA_CURVA) {
    conferir(nome + " está NA curva", pontoDaCurva(deBase58(chave)) === true,
      "chave pública vem de chave privada; fora da curva ela não poderia existir");
  }

  /* E o contrário: um endereço DERIVADO tem que estar fora. Se o teste
     dissesse que está dentro, nenhum bump seria aceito e a derivação
     devolveria null pra tudo. */
  const derivado = await enderecoDerivado(
    [new TextEncoder().encode("teste")], "11111111111111111111111111111111");
  conferir("um endereço derivado está FORA da curva",
    derivado != null && pontoDaCurva(deBase58(derivado.endereco)) === false);
}

/* ------------------------------------------------------------------------ */
titulo("O caso que quebrava: bump 248");
{
  /* Os dois arrays de tick da posição SOL/ETH dele, medidos na cadeia em
     10/09/2026. O do fundo está no bump 255 — encontrado até pela versão
     quebrada. O do topo está no 248, e é ele que provava o defeito.
     Os endereços estão escritos aqui porque são o gabarito, E ELES VIERAM DA
     CADEIA, não desta função. Na primeira versão deste teste eu escrevi os
     endereços de cabeça, a partir dos 12 primeiros caracteres que tinha visto
     num diagnóstico — e inventei o resto. O teste falhou e me disse os
     verdadeiros, que eu então confirmei perguntando à Solana se existiam.
     Copiar a saída da função pro teste teria fechado o círculo: a função
     conferindo a si mesma, verde pra sempre, provando nada. */
  const pool = deBase58("HktfL7iwGKT5QHjywQkcDnZXScoh811k7akrMZJkCcEF");

  const fundo = await enderecoDerivado(sementesDoTickArray(pool, -55616), PROGRAMA_ORCA);
  conferir("o array do fundo sai no bump 255", fundo.bump === 255, String(fundo.bump));
  conferir("e no endereço que existe na cadeia",
    fundo.endereco === "82KppHH5eWWHhhiPhwenZDFrd5eMKn3882UxusXRMvcb",
    fundo.endereco);

  const topo = await enderecoDerivado(sementesDoTickArray(pool, -54912), PROGRAMA_ORCA);
  conferir("o array do topo sai no bump 248 — o que a busca de 5 nunca via",
    topo.bump === 248, String(topo.bump));
  conferir("e no endereço que existe na cadeia",
    topo.endereco === "GDMZX9npyh66UhMP2E8dSEfGc5pJBHTwUDsxYZb8CT9Z",
    topo.endereco);

  conferir("248 está fora da janela de 5 bumps (255 a 251)", 248 < 251,
    "é por isso que a versão antiga não achava");
}

/* ------------------------------------------------------------------------ */
titulo("A derivação é determinística e dá UM endereço");
{
  const a = await enderecoDerivado([new TextEncoder().encode("x")], PROGRAMA_ORCA);
  const b = await enderecoDerivado([new TextEncoder().encode("x")], PROGRAMA_ORCA);
  conferir("as mesmas sementes dão o mesmo endereço",
    a.endereco === b.endereco && a.bump === b.bump);

  const c = await enderecoDerivado([new TextEncoder().encode("y")], PROGRAMA_ORCA);
  conferir("sementes diferentes dão endereços diferentes", a.endereco !== c.endereco);

  /* O programa entra na conta: as mesmas sementes em outro programa são outro
     endereço. Sem isso, qualquer programa poderia derivar o endereço alheio. */
  const d = await enderecoDerivado([new TextEncoder().encode("x")],
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  conferir("o programa muda o endereço", a.endereco !== d.endereco);

  conferir("devolve um objeto, não uma lista",
    !Array.isArray(a) && typeof a.endereco === "string" && typeof a.bump === "number",
    "cinco chutes viraram um endereço — e cinco consultas à cadeia viraram uma");
}

/* ------------------------------------------------------------------------ */
titulo("Bumps baixos aparecem mesmo, e não são raridade de laboratório");
{
  /* A conta: cada bump tem ~50% de cair na curva, então P(bump <= 250) =
     (1/2)^5 = 3,1%. Aqui isso é MEDIDO em vez de argumentado — num punhado de
     derivações quaisquer, alguma cai abaixo de 251.
     Se este teste parar de achar, ou a curva mudou ou a derivação quebrou. */
  const bumps = [];
  for (let i = 0; i < 120; i++) {
    const r = await enderecoDerivado([new TextEncoder().encode("semente-" + i)], PROGRAMA_ORCA);
    bumps.push(r.bump);
  }
  const abaixoDe251 = bumps.filter((b) => b < 251).length;
  conferir("em 120 derivações, pelo menos uma tem bump abaixo de 251",
    abaixoDe251 >= 1, abaixoDe251 + " de 120 (a versão antiga erraria essas)");

  const media = bumps.reduce((a, b) => a + b, 0) / bumps.length;
  conferir("a média fica perto de 254 (a distribuição esperada)",
    media > 252 && media < 255, media.toFixed(2));
}

console.log("\n" + "-".repeat(60));
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
