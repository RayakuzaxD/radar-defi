/* O painel. Uma página só, servida pelo próprio Worker.
 *
 * Reescrito em 05/09/2026. A versão anterior tinha seis abas e mostrava 120
 * redes e 2.690 pools — informação demais, decisão nenhuma. O Rayakuza resumiu
 * assim: "informações bagunçadas, nada relevante". Ele estava certo.
 *
 * O que mudou, e por quê:
 *
 *   - Quatro caixas, não seis abas. Cada uma só compara com ela mesma: rede
 *     grande com rede grande, pool firme com pool firme. Ethereum caindo 3% e
 *     uma rede de $8M subindo 300% não são o mesmo tipo de evento e não podem
 *     dividir a mesma lista.
 *
 *   - Cada linha traz a FRASE que liga os números. Uma tabela obriga a fazer a
 *     leitura de cabeça toda vez; a frase faz a leitura uma vez e deixa escrita.
 *
 *   - As pools são ordenadas pelo CHÃO (o que pagaram em 9 de cada 10 dias), não
 *     pelo APY anunciado. Medindo 43 pools grandes em 05/09/2026, as duas
 *     ordenações coincidiram em 3 nomes de 8: uma pool anunciava 74% e garantia
 *     7,9%.
 *
 * Continua sendo uma string sem build, como os PWAs do Caderno, pra o projeto
 * inteiro caber num `wrangler deploy`.
 */

import { VERSAO } from "./versao.js";
import { OLHO_ABERTO, OLHO_FECHADO } from "./olho-alien.js";

export function paginaDoPainel() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Radar DeFi</title>

<link rel="manifest" href="/manifest.json">
<link rel="icon" type="image/png" sizes="32x32" href="/icone-32.png?v=${VERSAO}">
<link rel="icon" type="image/png" sizes="64x64" href="/icone-64.png?v=${VERSAO}">
<link rel="icon" type="image/png" sizes="128x128" href="/icone-128.png?v=${VERSAO}">
<link rel="icon" type="image/png" sizes="192x192" href="/icone-192.png?v=${VERSAO}">
<link rel="icon" type="image/png" sizes="512x512" href="/icone-512.png?v=${VERSAO}">
<link rel="apple-touch-icon" href="/icone-192.png?v=${VERSAO}">
<meta name="theme-color" content="#0e1013">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>
  /* Estética alien.
   *
   * O Defiverso se identifica como alienígena e o curso inteiro fala em
   * universos e portais — então o painel deixou de ser um dashboard cinza e
   * passou a parecer um instrumento de bordo. O cuidado: continua sendo
   * ferramenta de decisão sobre dinheiro real, então a legibilidade dos
   * números manda em cima do tema. Nada de neon sobre neon; o brilho fica só
   * onde ajuda a achar o número que importa.
   */
  :root {
    color-scheme: dark light;
    --fundo: #f4f7f6; --papel: #fff; --linha: #dbe4e2; --fundo2: #eaf0ee;
    --texto: #0d1614; --fraco: #5a6b67;
    --sobe: #0a7d55; --desce: #b81d52; --realce: #0a6d8a; --alerta: #96610a;
    --okBg: #e2f5ec; --ruimBg: #fdeaf0; --avisoBg: #fdf2e0; --novoBg: #e6f3f8;
    --nebulosa: transparent;
    --brilho: none;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      /* Espaço profundo, com um tom azul-esverdeado em vez de cinza puro. */
      --fundo: #05080c; --papel: #0b1118; --linha: #16232c; --fundo2: #101a22;
      --texto: #dfeae8; --fraco: #7b8f92;
      /* Bioluminescente: verde de água-viva, ciano de sinal, magenta de plasma.
         O magenta substitui o vermelho porque vermelho puro em fundo preto
         vibra e cansa a vista em leitura longa. */
      --sobe: #5ff2a8; --desce: #ff5d8f; --realce: #5ad6ff; --alerta: #ffc46b;
      --okBg: #0c2a1e; --ruimBg: #2b0f1c; --avisoBg: #2a1f0d; --novoBg: #0c202c;
      /* Uma nebulosa muito discreta atrás de tudo — some se o aparelho for
         fraco, e nenhum dado depende dela. */
      --nebulosa: radial-gradient(1100px 620px at 18% -8%, #0d2b33 0%, transparent 62%),
                  radial-gradient(900px 520px at 92% 4%, #16172e 0%, transparent 58%);
      --brilho: 0 0 14px;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fundo); background-image: var(--nebulosa);
    background-attachment: fixed; color: var(--texto);
    font: 15px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased; }
  .caixa { max-width: 860px; margin: 0 auto; padding: 18px 14px 70px; }
  h1 { font-size: 21px; margin: 0 0 2px; letter-spacing: .16em; text-transform: uppercase;
    font-weight: 700; }
  h1 .sinal { color: var(--sobe); text-shadow: var(--brilho) var(--sobe); }
  .sub { color: var(--fraco); font-size: 13px; margin-bottom: 16px; }
  .aviso { background: var(--ruimBg); border: 1px solid var(--desce); color: var(--desce);
    padding: 10px 12px; border-radius: 9px; font-size: 13px; margin-bottom: 14px; }
  .instalar { display: none; width: 100%; margin-bottom: 14px; padding: 11px;
    font: inherit; font-weight: 600; cursor: pointer;
    background: var(--texto); color: var(--fundo); border: 0; border-radius: 9px; }

  /* A faixa do ciclo. Fica no topo porque o número que ela define (a meta
     mensal) é o que todas as pools abaixo estão sendo comparadas contra — ler
     a lista sem saber a régua é ler errado. */
  .ciclo { border: 1px solid var(--linha); background: var(--papel); border-radius: 11px;
    padding: 12px 13px; margin-bottom: 16px; }
  .cicloTopo { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
  .cicloNome { font-size: 15px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .c-bull .cicloNome { color: var(--sobe); }
  .c-bear .cicloNome { color: var(--desce); }
  .c-indefinido .cicloNome { color: var(--alerta); }
  .cicloMeta { font-size: 13px; color: var(--fraco); }
  .cicloMeta b { color: var(--texto); }
  .cicloEixos { margin-top: 9px; font-size: 12.5px; color: var(--fraco); line-height: 1.6; }
  .cicloEixos div { display: flex; gap: 7px; }
  .cicloEixos .ponto { color: var(--realce); }
  .cicloComo { margin-top: 9px; font-size: 12px; color: var(--fraco);
    border-top: 1px solid var(--linha); padding-top: 8px; }
  .cicloComo code { background: var(--fundo2); padding: 1px 5px; border-radius: 4px;
    color: var(--texto); font-size: 11.5px; }
  .cicloBriga { margin-top: 8px; font-size: 12.5px; color: var(--alerta); }

  /* As pools dele. Ficam no topo do "Hoje" e não numa aba própria: aba é coisa
     que se escolhe abrir, e isto é o que ele precisa ver sem escolher. */
  .minha { background: var(--papel); border: 1px solid var(--linha); border-radius: 11px;
    padding: 13px 14px; margin-bottom: 9px; border-left: 3px solid var(--realce); }
  .minha.mexeu { border-left-color: var(--alerta); }
  .minhaTopo { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .minhaNome { font-weight: 650; font-size: 15px; }
  .minhaDesde { color: var(--fraco); font-size: 12px; margin-left: auto; }
  .antesDepois { display: flex; gap: 16px; flex-wrap: wrap; margin: 9px 0 7px;
    font-size: 12.5px; color: var(--fraco); }
  .antesDepois b { color: var(--texto); }
  .minhaMudou { font-size: 12.5px; line-height: 1.5; color: var(--alerta);
    background: var(--avisoBg); border-radius: 7px; padding: 7px 9px; margin-top: 5px; }
  .minhaCalma { font-size: 12.5px; color: var(--sobe); }

  /* A legenda dos quatro números.
     Fica NO TOPO da aba de pools, e não só no rodapé: quem está lendo "chão
     1,8%" precisa da explicação ali, não trinta cartões abaixo. */
  /* O comparador: uma linha por lugar onde o mesmo par existe. */
  .comp { background: var(--papel); border: 1px solid var(--linha); border-radius: 11px;
    padding: 13px 14px; margin-bottom: 9px; }
  .compTopo { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; margin-bottom: 8px; }
  .compPar { font-weight: 700; font-size: 15.5px; letter-spacing: .03em; }
  .compVezes { font-size: 12px; font-weight: 700; color: var(--sobe);
    background: var(--okBg); padding: 2px 8px; border-radius: 999px; }
  .compOnde { color: var(--fraco); font-size: 12.5px; margin-left: auto; }
  .compLinha { display: grid; grid-template-columns: 1fr auto auto; gap: 10px;
    align-items: baseline; padding: 6px 0; border-top: 1px solid var(--linha);
    font-size: 13px; }
  .compLinha.top .compMult { color: var(--sobe); font-weight: 700; }
  .compLinha.fundo { opacity: .55; }
  .compMult { font-variant-numeric: tabular-nums; font-weight: 600; }
  .compTvl { color: var(--fraco); font-size: 12px; font-variant-numeric: tabular-nums; }
  .compNota { margin-top: 9px; font-size: 12.5px; line-height: 1.5; color: var(--alerta);
    background: var(--avisoBg); border-radius: 7px; padding: 8px 10px; }

  /* O Bitcoin: gráfico, régua da faixa e alvos de preço. */
  .btcCartao .numeros { margin-top: 0; }
  .janelaBtc { display: flex; gap: 4px; margin: 8px 0 2px; }
  .jbOp { background: transparent; border: 1px solid var(--linha); color: var(--fraco);
          border-radius: 999px; padding: 3px 11px; font-size: 11px; cursor: pointer;
          font-family: inherit; }
  .jbOp.ativo { border-color: var(--realce); color: var(--realce); }
  .grafEsperando { color: var(--fraco); font-size: 12px; padding: 34px 0; text-align: center; }
  .grafLegenda { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 5px 2px 0;
                 font-size: 10px; color: var(--fraco); }
  .grafLegenda span { display: inline-flex; align-items: center; gap: 4px; }
  .grafLegenda i { width: 11px; height: 2px; border-radius: 2px; display: inline-block; }
  .lgPreco { background: var(--realce); height: 2.5px !important; }
  .lgFaixa { background: var(--sobe); opacity: .45; height: 7px !important; border-radius: 2px; }
  .lg200 { background: var(--alerta); }
  .lg50 { background: var(--fraco); }
  /* ALTURA AUTOMATICA, e o motivo e o texto.
     Com altura fixa e viewBox estreito, o SVG ficava centralizado numa caixa
     larga, deixando tarja preta dos dois lados. A saida obvia seria
     preserveAspectRatio="none", que estica tudo — inclusive as datas do eixo,
     que sairiam achatadas. Entao a proporcao mora no viewBox (720x150) e a
     altura segue a largura. */
  .btcGraf { width: 100%; height: auto; display: block; margin: 4px 0 2px; }
  .faixaRegua { margin: 8px 0 10px; }
  .faixaBarra { position: relative; height: 6px; border-radius: 999px;
    background: linear-gradient(90deg, var(--desce), var(--alerta), var(--sobe)); opacity: .55; }
  .faixaMarca { position: absolute; top: -4px; width: 3px; height: 14px; border-radius: 2px;
    background: var(--texto); transform: translateX(-1.5px); }
  .faixaPontas { display: flex; justify-content: space-between; font-size: 11.5px;
    color: var(--texto); margin-top: 5px; line-height: 1.3; }
  .alertasBtc { margin-top: 11px; border-top: 1px solid var(--linha); padding-top: 9px; }
  .alertaLinha.avisado { opacity: .55; }
  .alertaNota { font-size: 10.5px; line-height: 1.45; color: var(--fraco);
                margin-top: 7px; }
  .alertasTit { font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
    color: var(--fraco); margin-bottom: 5px; }
  .alertaLinha { display: flex; justify-content: space-between; font-size: 12.5px;
    padding: 3px 0; color: var(--fraco); }
  .alertaLinha.perto { color: var(--alerta); }
  .alertaLinha.bateu { color: var(--sobe); font-weight: 650; }

  /* A carteira: login e alocação. Único lugar do painel com dado pessoal. */
  .conta { background: var(--papel); border: 1px solid var(--linha); border-radius: 11px;
    padding: 16px; margin-bottom: 14px; max-width: 420px; }
  .conta h3 { margin: 0 0 4px; font-size: 15px; }
  .conta p { margin: 0 0 14px; font-size: 12.5px; color: var(--fraco); line-height: 1.5; }
  .campo { display: block; margin-bottom: 10px; }
  .campo span { display: block; font-size: 11.5px; text-transform: uppercase;
    letter-spacing: .06em; color: var(--fraco); margin-bottom: 4px; }
  .campo input { width: 100%; font: inherit; font-size: 14px; padding: 10px 11px;
    border-radius: 8px; border: 1px solid var(--linha); background: var(--fundo2);
    color: var(--texto); }
  .campo input:focus { outline: none; border-color: var(--realce); }
  .botao { font: inherit; font-size: 13.5px; font-weight: 650; padding: 11px 16px;
    border-radius: 8px; border: 0; cursor: pointer; background: var(--sobe); color: #04120c; }
  .botao.fraco { background: transparent; color: var(--fraco); border: 1px solid var(--linha); }
  .botao:disabled { opacity: .5; cursor: default; }
  .recadoConta { margin-top: 11px; font-size: 12.5px; line-height: 1.5; }
  .recadoConta.ruim { color: var(--desce); }
  .recadoConta.bom { color: var(--sobe); }

  /* ---------------------------------------------------------------------
     AS CINCO CAIXINHAS.

     Duas telas no mesmo lugar: VER, que é o padrão e não tem um único campo
     de digitar, e EDITAR, que aparece só na caixinha em que ele apertou o
     lápis. A primeira versão era só a segunda — tudo campo, o tempo todo — e
     seis lançamentos viravam quatro telas de rolagem no celular.
     --------------------------------------------------------------------- */
  .cx { border: 1px solid var(--linha); border-radius: 12px; padding: 9px 11px;
    margin-top: 8px; background: var(--fundo); }
  .cx.aberta { border-color: var(--sobe); }
  .cx.semCaixa { border-color: var(--desce); }
  .cxTopo { display: grid; grid-template-columns: 22px 1fr auto 26px; gap: 8px; align-items: center; }
  .cxLetra { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center;
    background: var(--fundo2); border: 1px solid var(--linha); font-weight: 800; font-size: 12px; }
  .cxNome { font-size: 13.5px; font-weight: 650; }
  .cxHoje { font-size: 15px; font-weight: 750; font-variant-numeric: tabular-nums; }
  .cxEditar { background: none; border: 0; color: var(--fraco); cursor: pointer;
    font-size: 14px; padding: 3px; }
  .cxBarra { position: relative; height: 5px; border-radius: 3px; background: var(--fundo2);
    margin: 7px 0 5px; }
  .cxBarra i { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: var(--sobe); }
  /* O alvo é um risco em cima da barra, não outra barra: ele marca ONDE
     deveria estar, e a barra mostra onde está. Duas barras se somariam na
     leitura; risco e barra não. O traço fino e apagado é a referência do
     método — fica atrás do dele, porque o alvo que vale é o dele. */
  .cxBarra b { position: absolute; top: -3px; width: 2px; height: 11px;
    background: var(--texto); border-radius: 1px; }
  .cxBarra u { position: absolute; top: -1px; width: 1px; height: 7px;
    background: var(--fraco); }
  .cxSoma { font-size: 11.5px; color: var(--fraco); }
  .cxMais { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .cxRodape { margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap; }
  .btMoverCaixa { font: inherit; font-size: 11.5px; padding: 5px 9px; border-radius: 7px;
    border: 1px dashed var(--linha); background: none; color: var(--fraco); cursor: pointer; }
  .btPronto { font: inherit; font-size: 12px; padding: 6px 14px; border-radius: 7px;
    border: 1px solid var(--linha); background: var(--fundo2); color: var(--texto); cursor: pointer; }

  /* Uma linha em modo VER: texto, não formulário. */
  .lv { display: grid; grid-template-columns: 1fr auto auto 34px; gap: 8px;
    align-items: baseline; font-size: 13px; padding: 4px 0 4px 30px; }
  .lvNome { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lvValor { font-variant-numeric: tabular-nums; }
  .lvVar { font-size: 11.5px; font-variant-numeric: tabular-nums; }
  .lvPct { font-size: 11.5px; color: var(--fraco); text-align: right;
    font-variant-numeric: tabular-nums; }
  .lvLink { grid-column: 1 / -1; font-size: 11px; }
  .lvAviso { font-size: 11px; color: var(--texto); padding: 0 0 5px 30px; }

  /* LANÇAR: um lugar só, três perguntas. Antes eram onze botões espalhados. */
  .lancarLinha { margin: 12px 0 4px; }
  .lancar { border: 1px solid var(--sobe); border-radius: 12px; padding: 12px;
    margin: 12px 0 4px; background: var(--fundo); }
  .lcTopo { display: flex; justify-content: space-between; align-items: center; }
  .lcTit { font-size: 14px; font-weight: 700; }
  .lcFechar { background: none; border: 0; color: var(--fraco); cursor: pointer; font-size: 18px; }
  .lcTipos, .lcCaixas { display: flex; gap: 5px; flex-wrap: wrap; margin: 8px 0 4px; }
  .chip { font: inherit; font-size: 12px; padding: 5px 11px; border-radius: 8px;
    border: 1px solid var(--linha); background: var(--fundo2); color: var(--fraco); cursor: pointer; }
  .chip.ativo { background: var(--sobe); border-color: var(--sobe); color: #04120c; font-weight: 650; }
  .lcRot { font-size: 11px; color: var(--fraco); margin: 10px 0 4px; }
  .lancar input { font: inherit; font-size: 14px; padding: 9px 10px; border-radius: 8px;
    border: 1px solid var(--linha); background: var(--fundo2); color: var(--texto); width: 100%; }
  .lcTok { text-transform: uppercase; font-weight: 700; }
  .lcDica { font-size: 11px; color: var(--fraco); margin-top: 4px; }
  .lcQuanto { display: flex; gap: 6px; align-items: center; }
  .lcQuanto input { flex: 1; }
  .lcUn { font-size: 12px; color: var(--fraco); }
  /* A prévia existe porque somar na linha errada é invisível: o total muda,
     fica plausível, e ninguém confere. Escrever o que vai acontecer transforma
     um erro silencioso num erro que se lê antes de apertar. */
  .lcPrevia { font-size: 12px; color: var(--texto); background: var(--fundo2);
    border-radius: 8px; padding: 9px 11px; margin: 12px 0; line-height: 1.5; }
  .lcPrevia.ruim { color: var(--desce); }

  /* Uma linha em modo EDITAR. */
  .lin { display: grid; grid-template-columns: 1fr 100px auto; gap: 6px;
    align-items: center; padding: 6px 0; border-top: 1px solid var(--linha); }
  .lin input { font: inherit; font-size: 13.5px; padding: 8px 9px; border-radius: 7px;
    border: 1px solid var(--linha); background: var(--fundo2); color: var(--texto); width: 100%; }
  .lin .eTok { text-transform: uppercase; font-weight: 700; }
  .lin .lixo { background: none; border: 0; color: var(--fraco); cursor: pointer;
    font-size: 15px; padding: 4px 6px; }
  /* Pequeno e cinza, para não se confundir com os botões verdes do ±: aquele
     par troca a moeda do MOVIMENTO, este diz a moeda em que a linha foi
     lançada. Dois pares idênticos na mesma linha seria armadilha. */
  .eMoedaBt { font: inherit; font-size: 11px; padding: 4px 7px; border-radius: 6px;
    border: 1px solid var(--linha); background: none; color: var(--fraco); cursor: pointer; }
  .eMoedaBt.ativo { color: var(--texto); border-color: var(--fraco); font-weight: 650; }
  .cxAlvoCampo { font-size: 11px; color: var(--fraco); margin: 8px 0 4px; }
  .cxAlvoCampo input { font: inherit; font-size: 13px; width: 52px; text-align: center;
    padding: 5px 4px; border-radius: 7px; border: 1px solid var(--linha);
    background: var(--fundo2); color: var(--texto); margin: 0 2px; }
  .linCampos { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .linNota { grid-column: 1 / -1; font-size: 11px; color: var(--fraco); }

  /* Somar, tirar e mover. Escondido até ele apertar o ±. */
  .acoes { display: flex; gap: 2px; align-items: center; }
  .mexerAbre { background: none; border: 0; color: var(--fraco); cursor: pointer;
    font-size: 16px; font-weight: 700; padding: 4px 6px; }
  .mexer { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
    background: var(--fundo2); border: 1px solid var(--linha); border-radius: 9px;
    padding: 8px; margin-top: 6px; }
  .mexer[hidden] { display: none; }
  .lin .mexer input { width: 104px; }
  .mexer select { font: inherit; font-size: 13px; padding: 7px 4px; border-radius: 7px;
    border: 1px solid var(--linha); background: var(--fundo); color: var(--texto); width: auto; }
  /* Classe própria, NÃO .mBt: aquela troca a moeda da tela inteira e tem um
     onclick global. Duas coisas parecidas com efeitos diferentes. */
  .mBt2 { font: inherit; font-size: 12.5px; font-weight: 650; padding: 6px 10px;
    border-radius: 7px; border: 1px solid var(--linha); background: var(--fundo);
    color: var(--texto); cursor: pointer; }
  .mBt2.ativo { background: var(--sobe); border-color: var(--sobe); color: #04120c; }
  .mSeta { font-size: 12px; color: var(--fraco); }

  @media (max-width: 560px) {
    /* Quatro colunas não cabem em 375px. Em vez de deixar quebrar sozinho e
       cair torto, a linha vira duas: nome e valor em cima, e embaixo a fatia
       da caixinha alinhada ao nome e a variação alinhada ao valor. Cada
       número fica debaixo daquilo a que ele se refere. */
    .lv { grid-template-columns: 1fr auto; padding-left: 22px; row-gap: 1px; }
    .lvNome { grid-column: 1; grid-row: 1; }
    .lvValor { grid-column: 2; grid-row: 1; text-align: right; }
    .lvPct { grid-column: 1; grid-row: 2; text-align: left; }
    .lvVar { grid-column: 2; grid-row: 2; text-align: right; font-size: 11px; }
    .lin { grid-template-columns: 1fr 88px auto; }
    .linCampos { grid-template-columns: 1fr; }
  }

  /* Achar a pool. O resultado é um botão inteiro, não uma linha com um botão
     ao lado: no celular o alvo de toque tem que ser a coisa toda. */
  .buscaPool { margin-top: 6px; }
  .btBuscarPool { font: inherit; font-size: 12px; padding: 7px 12px; border-radius: 8px;
    border: 1px dashed var(--linha); background: none; color: var(--fraco); cursor: pointer; }
  .btBuscarPool:hover { color: var(--texto); border-style: solid; }
  .achados { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
  .achado { font: inherit; text-align: left; font-size: 12.5px; padding: 8px 10px;
    border-radius: 8px; border: 1px solid var(--linha); background: var(--fundo2);
    color: var(--texto); cursor: pointer; width: 100%; }
  .achado:hover { border-color: var(--sobe); }
  .poolLigada { display: flex; justify-content: space-between; align-items: flex-start;
    gap: 8px; font-size: 12.5px; background: var(--fundo2); border: 1px solid var(--linha);
    border-radius: 8px; padding: 8px 10px; margin-top: 6px; }
  .poolLigada button { font: inherit; font-size: 11px; padding: 4px 9px; border-radius: 6px;
    border: 1px solid var(--linha); background: none; color: var(--fraco); cursor: pointer;
    white-space: nowrap; }

  /* A faixa de uma posição concentrada.
     Verde dentro, âmbar na borda, vermelho fora. O losango é o preço agora.
     É o mesmo desenho que a Orca faz, e pelo mesmo motivo: numa posição
     concentrada o que decide o dia não é quanto vale, é estar dentro. */
  .faixa { padding: 2px 0 6px 30px; }
  .faixaPontas { display: flex; justify-content: space-between; font-size: 10.5px;
    color: var(--fraco); font-variant-numeric: tabular-nums; }
  .faixaPontas span:nth-child(2) { font-weight: 700; color: var(--texto); }
  .faixaBarra { position: relative; height: 4px; border-radius: 3px;
    background: var(--sobe); margin: 3px 0 4px; opacity: .85; }
  .faixa.perto .faixaBarra { background: linear-gradient(90deg, var(--sobe), var(--sobe)); }
  .faixa.fora .faixaBarra { background: var(--linha); }
  .faixaBarra i { position: absolute; top: -4px; width: 10px; height: 10px;
    margin-left: -5px; background: var(--texto); border-radius: 2px;
    transform: rotate(45deg); }
  .faixa.fora .faixaBarra i { background: var(--desce); }
  .faixaTexto { font-size: 11px; color: var(--fraco); }
  .faixa.fora .faixaTexto { color: var(--desce); }
  .faixa.perto .faixaTexto { color: var(--texto); }
  .lvAviso.sobe { color: var(--sobe); }
  .lvAviso.desce { color: var(--desce); }
  .lcDica.ruim { color: var(--desce); }
  /* As cópias de segurança. */
  .copias { border: 1px solid var(--linha); border-radius: 12px; padding: 12px;
    margin-top: 6px; background: var(--fundo); width: 100%; }
  .copiaLinha { display: flex; justify-content: space-between; align-items: center;
    gap: 10px; padding: 9px 0; border-top: 1px solid var(--linha); font-size: 13px; }

  /* Encolher e expandir. A seta é o único enfeite: ela diz que dá pra tocar. */
  .seta { font-size: 10px; color: var(--fraco); }
  .cxVirar { cursor: pointer; user-select: none; }
  .cx.fechada .cxSoma { margin-bottom: 0; }
  .importar.encolhido { cursor: pointer; padding: 10px 12px; }
  .importar.encolhido .impCabeca { margin-bottom: 0; font-weight: 650; font-size: 13px; }
  .abreImportar { cursor: pointer; user-select: none; }

  /* Importar a carteira. Lista, não formulário: ele marca o que quer. */
  .importar { border: 1px solid var(--linha); border-radius: 12px; padding: 12px;
    margin: 12px 0 4px; background: var(--fundo); }
  .impCabeca { font-size: 14px; font-weight: 700; margin-bottom: 8px; }

  /* O RESUMO — a sub-aba de olhar. */
  .subAbas { display: flex; gap: 6px; margin: 12px 0 4px; }
  .sbBt { flex: 1; padding: 8px 10px; border-radius: 10px; cursor: pointer;
    border: 1px solid var(--linha); background: transparent; color: var(--fraco);
    font: inherit; font-size: 13px; font-weight: 650; }
  .sbBt.ativo { background: var(--sobe); border-color: var(--sobe); color: #04120b; }

  .resumoCaixa { margin-top: 14px; padding: 14px; border-radius: 12px;
    border: 1px solid var(--linha); background: var(--fundo2); }
  .cortes { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .btCorte.escolhido { border-color: var(--sobe); color: var(--texto); }

  /* A rosca e a legenda lado a lado quando cabe; empilhadas quando não cabe.
     No celular a legenda embaixo é mais legível que duas colunas espremidas. */
  .pizzaEnvolta { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
  .pizza { width: 180px; height: 180px; flex: 0 0 auto; margin: 0 auto; }
  .pzTotal { fill: var(--texto); font-size: 15px; font-weight: 700;
    text-anchor: middle; font-family: inherit; }
  .pzSub { fill: var(--fraco); font-size: 10px; text-anchor: middle; font-family: inherit; }

  .legenda { flex: 1 1 220px; min-width: 200px; display: flex; flex-direction: column; gap: 6px; }
  .legLinha { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .legCor { width: 12px; height: 12px; border-radius: 3px; flex: 0 0 auto; }
  .legNome { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .legPct { font-weight: 700; }
  .legVal { color: var(--fraco); font-size: 12px; min-width: 78px; text-align: right; }

  .rkLinha { margin-top: 10px; }
  .rkBarra { height: 6px; border-radius: 4px; background: var(--linha); overflow: hidden; }
  .rkBarra span { display: block; height: 100%; background: var(--sobe); }
  .rkTexto { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; font-size: 13px; }
  .rkPct { font-weight: 700; }
  .rkNota { color: var(--fraco); font-size: 12px; }

  /* As posições encerradas: presentes, e fora do caminho. */
  /* O pontinho que diz "isto está vivo". Discreto: quem olha o preço não pode
     ser puxado pelo enfeite ao lado dele. */
  .pulso { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--sobe); margin-right: 5px; vertical-align: middle;
    animation: baterPulso 2.4s ease-in-out infinite; }
  @keyframes baterPulso { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }
  @media (prefers-reduced-motion: reduce) { .pulso { animation: none } }

  .assinatura { opacity: 0.5; font-size: 11px; text-align: center; margin: 26px 0 14px; color: var(--fraco); }
  .fim { margin-top: 10px; border-top: 1px dashed var(--linha); padding-top: 8px; }
  .fimTopo { width: 100%; display: flex; align-items: center; gap: 7px; cursor: pointer;
    background: transparent; border: 0; padding: 5px 0; color: var(--fraco);
    font: inherit; font-size: 12px; text-align: left; }
  .fimSoma { margin-left: auto; font-weight: 700; }
  .fim .onde { color: var(--fraco); }
  .fimCorpo { margin-top: 4px; }
  .cicloCurso { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--linha); }
  .cursoTopo { display: flex; justify-content: space-between; align-items: baseline;
    gap: 10px; font-size: 13px; }
  .cursoFase { font-weight: 700; text-transform: lowercase; }
  .cursoFirmeza { color: var(--fraco); font-size: 12px; margin: 3px 0 7px; }
  .indLinha { display: flex; gap: 6px; font-size: 12px; line-height: 1.5; margin-bottom: 2px; }
  .indLinha.destaque { font-weight: 600; }
  .indVelho { color: var(--alerta); font-style: normal; font-size: 11px; }
  .cursoRecado { margin-top: 8px; font-size: 12px; }
  .cursoRecado.briga { color: var(--alerta); font-weight: 650; }
  .cursoNota { margin-top: 6px; color: var(--fraco); font-size: 11px; }
  .fatoLinha { display: flex; justify-content: space-between; align-items: baseline;
    gap: 12px; padding: 7px 0; border-top: 1px solid var(--linha); font-size: 13px; }
  .fatoLinha span { color: var(--fraco); }
  .fatoLinha b { text-align: right; }
  .fatoNota { color: var(--fraco); font-size: 12px; line-height: 1.45; margin: 2px 0 6px; }
  /* O bloco do dinheiro DELE, destacado do bloco do mercado: são duas coisas
     diferentes na mesma caixa, e o olho precisa saber onde uma acaba. */
  .fatoSeu { margin-top: 10px; padding: 8px 10px; border-radius: 10px;
    background: var(--novoBg); }
  .fatoSeu .fatoLinha:first-child { border-top: none; }
  .fatoQuando { margin-top: 10px; color: var(--fraco); font-size: 11px; }

  .protoLinha { padding: 10px 0; border-top: 1px solid var(--linha); }
  .protoTopo { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
  .protoCat { color: var(--fraco); font-size: 12px; }
  .protoNums { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px;
    color: var(--fraco); font-size: 12px; }
  .impEndereco { font: inherit; font-size: 12px; padding: 9px 10px; border-radius: 8px;
    border: 1px solid var(--linha); background: var(--fundo2); color: var(--texto); width: 100%; }
  .impTitulo { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em;
    color: var(--fraco); margin: 14px 0 2px; }
  /* Alvo de toque grande no celular: a caixinha de marcar sozinha teria 13px. */
  .impLinha { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px;
    align-items: center; padding: 8px 0; border-top: 1px solid var(--linha); }
  .impLinha input[type=checkbox] { width: 20px; height: 20px; accent-color: var(--sobe); }
  .impMeio { font-size: 13px; min-width: 0; }
  .impNota { font-size: 11px; color: var(--fraco); }
  .impCaixa { font: inherit; font-size: 11.5px; padding: 6px 4px; border-radius: 7px;
    border: 1px solid var(--linha); background: var(--fundo2); color: var(--texto); max-width: 116px; }
  .impBotoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .impBotoes button[disabled] { opacity: .45; cursor: default; }
  .impRodape { font-size: 11px; color: var(--fraco); margin-top: 10px; line-height: 1.5; }

  .lcSep { font-size: 11px; color: var(--fraco); border-top: 1px solid var(--linha);
    margin: 14px 0 2px; padding-top: 10px; }
  .btDeNovo { font: inherit; font-size: 10.5px; padding: 2px 8px; border-radius: 6px;
    border: 1px solid var(--linha); background: none; color: var(--fraco); cursor: pointer;
    margin-left: 6px; }

  /* O campo de repartir um valor entre as caixinhas. */
  .repBarra { margin: 8px 0 4px; }
  .btRepartir { font: inherit; font-size: 11px; padding: 4px 10px; border-radius: 7px;
    border: 1px solid var(--linha); background: none; color: var(--texto); cursor: pointer; }
  .repCaixa { border: 1px solid var(--linha); border-radius: 9px; padding: 10px;
    margin-bottom: 8px; background: var(--fundo); }
  .repCampos { display: flex; align-items: center; gap: 7px; }
  .repValor { flex: 1; min-width: 0; font: inherit; font-size: 14px; padding: 6px 8px;
    border-radius: 7px; border: 1px solid var(--linha); background: var(--papel); color: var(--texto); }
  .repMoeda { font-size: 12px; color: var(--fraco); }
  .repModos { display: flex; gap: 6px; margin-top: 7px; }
  .repModo { flex: 1; font: inherit; font-size: 11px; padding: 5px 6px; border-radius: 7px;
    border: 1px solid var(--linha); background: none; color: var(--fraco); cursor: pointer; }
  .repModo.ativo { color: var(--texto); border-color: var(--texto); }
  .repTit { font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
    color: var(--fraco); margin: 10px 0 3px; }
  .repLinha { display: flex; align-items: baseline; gap: 7px; font-size: 12px; padding: 2px 0; }
  .repLinha span:first-child { flex: 1; }
  .repDe { color: var(--fraco); font-size: 11px; }
  .repNota { font-size: 11px; color: var(--fraco); margin-top: 9px; line-height: 1.45; }

  .rebalancoDuas { font-size: 11px; color: var(--fraco); margin: 2px 0 6px 12px; }
  .rebalancoDuas b { color: var(--texto); }

  .btApelido { font: inherit; font-size: inherit; color: inherit; background: none;
    border: 0; border-bottom: 1px dashed var(--linha); padding: 0 0 1px; cursor: pointer; }
  .btApelido:hover { border-bottom-color: var(--texto); }
  .inApelido { font: inherit; font-size: inherit; padding: 2px 7px; border-radius: 6px;
    border: 1px solid var(--linha); background: var(--fundo); color: var(--texto);
    width: 150px; max-width: 55vw; }
  .btApelidoOk { font: inherit; font-size: 11px; padding: 3px 9px; border-radius: 6px;
    border: 1px solid var(--linha); background: none; color: var(--texto);
    cursor: pointer; margin-left: 5px; }
  /* Sem borda: a arte ja tem a propria moldura redonda, e uma caixinha
     quadrada em volta brigaria com ela. O alvo de toque continua grande. */
  .btOlho { line-height: 0; background: none; border: 0; padding: 2px;
    cursor: pointer; margin-right: 4px; border-radius: 50%; }
  .btOlho:hover .olhoAlien { transform: scale(1.06); }
  .btOlho:active .olhoAlien { transform: scale(.96); }
  .olhoAlien { width: 44px; height: 44px; display: block;
    transition: transform .12s ease; }

  /* O aviso de que há coisa não salva. Grudado no alto: é o único momento em
     que este texto importa, e ele não pode rolar pra fora da tela. */
  .naoSalvo { position: sticky; top: 0; z-index: 5;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    background: var(--fundo2); border: 1px solid var(--alerta); border-radius: 9px;
    padding: 9px 11px; margin-bottom: 10px; font-size: 12.5px; }
  .naoSalvo span { flex: 1; min-width: 150px; }
  .btSalvarAgora, .btDescartar { font: inherit; font-size: 11.5px; padding: 5px 12px;
    border-radius: 7px; border: 1px solid var(--linha); cursor: pointer; }
  .btSalvarAgora { background: var(--sobe); color: #05080c; border-color: var(--sobe); font-weight: 600; }
  .btDescartar { background: none; color: var(--fraco); }
  .btDescartar.perguntando { color: var(--desce); border-color: var(--desce); }

  .lv.fechada { opacity: .72; }
  .lv.fechada .lvNome { text-decoration: line-through; text-decoration-color: var(--fraco); }
  /* Os lançamentos que ficaram sem linha. Em destaque, porque é dado dele
     esperando um destino — e dado esperando some da vista se ficar discreto. */
  .orfaos { border: 1px solid var(--alerta); border-radius: 10px; padding: 10px 12px;
    margin-bottom: 10px; background: var(--papel); }
  .orfaosTit { font-size: 12.5px; font-weight: 600; }
  .orfaosNota { font-size: 11px; color: var(--fraco); margin: 4px 0 8px; line-height: 1.45; }
  .orfaoLinha { display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: 12px; padding: 4px 0; }
  .orfaoLinha > span { flex: 1; min-width: 160px; }
  .orfaoAlvo { font: inherit; font-size: 11.5px; padding: 4px 6px; border-radius: 6px;
    border: 1px solid var(--linha); background: var(--fundo); color: var(--texto); }
  .btReligar { font: inherit; font-size: 11.5px; padding: 4px 11px; border-radius: 7px;
    border: 1px solid var(--sobe); background: none; color: var(--sobe); cursor: pointer; }

  .lixo.perguntando { color: var(--desce); border-color: var(--desce);
    width: auto; padding: 0 8px; font-size: 10.5px; }
  .btReabrir { font: inherit; font-size: 10.5px; padding: 2px 8px; border-radius: 6px;
    border: 1px solid var(--linha); background: none; color: var(--fraco); cursor: pointer; }

  /* As três linhas do IL: segurar, a pool, e quem ganhou. */
  .ilBloco { border: 1px solid var(--linha); border-radius: 9px; padding: 8px 10px;
    margin: 6px 0 2px; background: var(--fundo); }
  .ilLinha { display: flex; justify-content: space-between; gap: 10px;
    font-size: 11.5px; padding: 2px 0; }
  .ilLinha span { color: var(--fraco); }
  .ilLinha.total { border-top: 1px solid var(--linha); margin-top: 4px; padding-top: 5px;
    font-size: 12.5px; }
  .ilLinha.total span { color: var(--texto); }
  .ilLinha.miudo span { font-size: 10.5px; }
  .ilNota { font-size: 10.5px; color: var(--fraco); margin-top: 6px; line-height: 1.4; }

  /* A pergunta de quando a posição mudou de tamanho. */
  .mudanca2 { border: 1px solid var(--alerta); border-radius: 9px; padding: 9px 10px;
    margin: 6px 0; background: var(--papel); }
  .mudTxt { font-size: 12px; line-height: 1.45; }
  .mudNota { font-size: 10.5px; color: var(--fraco); margin-top: 4px; }
  .mudBotoes { display: flex; gap: 6px; margin-top: 8px; }
  .btMudSim, .btMudNao { font: inherit; font-size: 11px; padding: 5px 11px;
    border-radius: 7px; border: 1px solid var(--linha); cursor: pointer; }
  .btMudSim { background: var(--texto); color: var(--fundo); border-color: var(--texto); }
  .btMudNao { background: none; color: var(--fraco); }
  .btMudSim[disabled], .btMudNao[disabled] { opacity: .5; cursor: default; }

  /* O cadeado: de onde vem a quantidade desta linha. */
  .cadeado { font: inherit; font-size: 10.5px; padding: 2px 8px; border-radius: 6px;
    border: 1px solid var(--linha); background: none; color: var(--fraco);
    cursor: pointer; margin-left: 6px; }
  .cadeado.fixo { cursor: default; opacity: .75; }
  .cadeado.segue { color: var(--sobe); border-color: var(--sobe); opacity: .85; }

  /* O extrato de aportes, saques e colheitas. Fechado por padrão. */
  .mvBarra { margin: 4px 0 0; }
  .btMov { font: inherit; font-size: 10.5px; padding: 2px 8px; border-radius: 6px;
    border: 1px solid var(--linha); background: none; color: var(--fraco); cursor: pointer; }
  .mvCaixa { border: 1px solid var(--linha); border-radius: 9px; padding: 8px 9px;
    margin: 6px 0 2px; background: var(--papel); }
  .mvItem { display: flex; align-items: center; gap: 7px; font-size: 11.5px;
    padding: 3px 0; border-bottom: 1px solid var(--linha); }
  .mvItem:last-of-type { border-bottom: 0; }
  .mvSinal { width: 15px; text-align: center; font-weight: 700; }
  .mvSinal.aporte { color: var(--sobe); }
  .mvSinal.saque { color: var(--desce); }
  .mvSinal.colheita { color: var(--sobe); }
  .mvQuanto { flex: 1; }
  .mvQuando, .mvTipo { color: var(--fraco); font-size: 10.5px; }
  .btMovApagar { font: inherit; font-size: 10px; padding: 1px 6px; border-radius: 5px;
    border: 1px solid var(--linha); background: none; color: var(--fraco); cursor: pointer; }
  .mvBotoes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .btMovNovo { font: inherit; font-size: 11px; padding: 4px 10px; border-radius: 7px;
    border: 1px solid var(--linha); background: none; color: var(--texto); cursor: pointer; }
  .mvForm { margin-top: 8px; border-top: 1px solid var(--linha); padding-top: 8px; }
  .mvExplica { font-size: 10.5px; color: var(--fraco); margin-bottom: 6px; }
  .mvCampos { display: flex; gap: 6px; align-items: center; }
  .mvValor { flex: 1; min-width: 0; font: inherit; font-size: 12px; padding: 5px 7px;
    border-radius: 7px; border: 1px solid var(--linha); background: var(--fundo); color: var(--texto); }
  .mvData { font: inherit; font-size: 11px; padding: 5px 6px; border-radius: 7px;
    border: 1px solid var(--linha); background: var(--fundo); color: var(--texto); }
  .mvMoeda { font: inherit; font-size: 11px; padding: 5px 9px; border-radius: 7px;
    border: 1px solid var(--linha); background: none; color: var(--texto); cursor: pointer; }
  .mvAcoes { display: flex; gap: 6px; margin-top: 7px; }
  .btMovGravar, .btMovCancelar { font: inherit; font-size: 11px; padding: 5px 12px;
    border-radius: 7px; border: 1px solid var(--linha); cursor: pointer; }
  .btMovGravar { background: var(--texto); color: var(--fundo); border-color: var(--texto); }
  .btMovCancelar { background: none; color: var(--fraco); }
  .mvRecado { font-size: 11px; margin-top: 7px; }
  .mvRecado.ruim { color: var(--desce); }
  .mvRecado.bom { color: var(--sobe); }
  .lvAviso.miudo { font-size: 10.5px; color: var(--fraco); }

  /* A referência do B.A.R.C.A. e o recado de rebalanceamento. */
  .barcaRef { background: var(--papel); border: 1px solid var(--linha); border-radius: 11px;
    padding: 13px 14px; margin-top: 12px; }
  .barcaTopo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 9px; }
  .barcaTit { font-weight: 700; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
  .barcaTopo .botao { margin-left: auto; }
  .barcaL { display: grid; grid-template-columns: 22px 1fr auto; gap: 9px; align-items: baseline;
    padding: 5px 0; border-top: 1px solid var(--linha); font-size: 13px; }
  .barcaLetra { font-weight: 700; color: var(--realce); text-align: center; }
  .barcaPct { font-weight: 650; font-variant-numeric: tabular-nums; }
  .barcaNota { margin-top: 9px; font-size: 12px; color: var(--fraco); line-height: 1.5; }

  .rebalanco { margin-top: 12px; background: var(--avisoBg); border-radius: 8px;
    padding: 10px 12px; font-size: 12.5px; line-height: 1.6; color: var(--alerta); }
  .rebalancoTit { font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
    margin-bottom: 5px; font-weight: 700; }
  .rebalanco b { color: var(--texto); }
  .rebalancoPar { margin-top: 7px; color: var(--fraco); font-style: italic; }

  /* O total, no topo da carteira: é o número que ele abre o app pra ver. */
  .totalCarteira { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
    padding: 10px 0 12px; }
  .totalValor { font-size: 25px; font-weight: 700; letter-spacing: -.01em;
    font-variant-numeric: tabular-nums; }
  .totalOutro { font-size: 13px; color: var(--fraco); font-variant-numeric: tabular-nums; }
  .moedaBotoes { margin-left: auto; display: flex; gap: 4px; }
  .mBt { font: inherit; font-size: 12.5px; font-weight: 650; padding: 6px 12px;
    border-radius: 999px; cursor: pointer; border: 1px solid var(--linha);
    background: var(--fundo2); color: var(--fraco); }
  .mBt.ativo { background: var(--sobe); border-color: var(--sobe); color: #04120c; }

  .legenda { border: 1px solid var(--linha); background: var(--papel); border-radius: 11px;
    padding: 11px 13px; margin-bottom: 14px; font-size: 12.5px; line-height: 1.55; }
  .legenda dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; }
  .legenda dt { font-weight: 700; color: var(--texto); text-transform: uppercase;
    letter-spacing: .05em; font-size: 11px; padding-top: 2px; white-space: nowrap; }
  .legenda dd { margin: 0; color: var(--fraco); }
  .legenda .fonte { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--linha);
    color: var(--fraco); font-style: italic; font-size: 12px; }

  .abas { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; }
  .abas button { font: inherit; font-size: 13px; padding: 8px 13px; border-radius: 999px;
    border: 1px solid var(--linha); background: var(--papel); color: var(--texto); cursor: pointer; }
  .abas button[aria-selected="true"] { background: var(--sobe); color: #04120c;
    border-color: var(--sobe); font-weight: 650; box-shadow: var(--brilho) rgba(95,242,168,.35); }

  .grupo { margin-bottom: 26px; }
  .grupoTitulo { font-size: 13px; font-weight: 700; margin-bottom: 3px; display: flex;
    align-items: center; gap: 7px; letter-spacing: .08em; text-transform: uppercase; }
  .grupoNota { font-size: 12.5px; color: var(--fraco); margin-bottom: 10px; line-height: 1.45; }

  .cartao { background: var(--papel); border: 1px solid var(--linha); border-radius: 11px;
    padding: 13px 14px; margin-bottom: 9px; position: relative; }
  /* Um fio de luz na borda de cima: dá o ar de painel de instrumento sem
     atrapalhar leitura nenhuma. */
  .cartao::before { content: ""; position: absolute; inset: 0 14px auto; height: 1px;
    background: linear-gradient(90deg, transparent, var(--linha) 22%, var(--linha) 78%, transparent); }
  .topo { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
  .nome { font-weight: 650; font-size: 15.5px; }
  .onde { color: var(--fraco); font-size: 12.5px; }
  .etiqueta { font-size: 10.5px; padding: 2px 8px; border-radius: 999px; font-weight: 650;
    margin-left: auto; white-space: nowrap; }
  .et-firme { background: var(--okBg); color: var(--sobe); }
  .et-alugada { background: var(--avisoBg); color: var(--alerta); }
  .et-loteria { background: var(--ruimBg); color: var(--desce); }
  .et-nova { background: var(--novoBg); color: var(--realce); }

  .numeros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin: 10px 0 9px; }
  .num { background: var(--fundo2); border-radius: 7px; padding: 6px 3px; text-align: center; }
  .num.destaque { outline: 1px solid var(--sobe); outline-offset: -1px; }
  .numRot { font-size: 9.5px; color: var(--fraco); text-transform: uppercase; letter-spacing: .1em; }
  .numVal { font-size: 15px; font-weight: 650; margin-top: 1px;
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace; }
  .num.destaque .numVal { text-shadow: var(--brilho) currentColor; }
  .sobe { color: var(--sobe); } .desce { color: var(--desce); } .vazio2 { opacity: .4; }

  .recado { margin-top: 9px; padding: 8px 10px; border-radius: 8px;
    background: var(--ruimBg); border: 1px solid var(--desce); color: var(--desce);
    font-size: 12.5px; line-height: 1.45; }
  /* O recado nasce vermelho (magenta) porque a maioria dos recados é aviso.
     As duas variantes existem pra que "aprovado" e "não medi" não cheguem
     pintados de problema — cor errada é uma frase que ninguém lê. */
  .recado.bom { background: var(--okBg); border-color: var(--sobe); color: var(--sobe); }
  .recado.naoSei { background: var(--fundo2); border-color: var(--linha); color: var(--fraco); }
  /* O link de ir até a pool. Discreto até ser tocado: ele não é a informação,
     é o que se faz DEPOIS de ler a informação. No celular tem altura de alvo
     de dedo (44px é o mínimo decente). */
  .irPara { display: inline-flex; align-items: center; margin-top: 10px;
    min-height: 40px; padding: 8px 13px; border-radius: 8px; font-size: 12.5px;
    font-weight: 600; text-decoration: none; color: var(--realce);
    border: 1px solid var(--linha); background: var(--fundo2); }
  .irPara:hover { border-color: var(--realce); }
  .frase { font-size: 13px; color: var(--fraco); line-height: 1.5; }
  .frase b { color: var(--texto); font-weight: 600; }
  .puxa { font-size: 12px; color: var(--fraco); margin-top: 6px; }
  .chips { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
  /* A faixa de taxa: 0,3% é o normal do mercado, então só as pontas ganham cor.
     Pintar a faixa comum de verde ensinaria a procurar cor onde não há sinal. */
  .chip.faixa { border-color: var(--linha); }
  .chip.f-baixa { color: var(--alerta); border-color: var(--alerta); }
  .chip.f-alta { color: var(--realce); border-color: var(--realce); }
  .chip { font-size: 11px; padding: 2px 8px; border-radius: 6px; background: var(--fundo2);
    font-weight: 600; }
  .chip.fraco { font-weight: 400; color: var(--fraco); }
  .chip.nota { margin-left: auto; background: transparent; font-size: 15px; padding: 0; }
  .portoes { border-color: var(--fraco); }
  .pmotivo { font-size: 13px; color: var(--fraco); padding: 3px 0; }
  .pmotivo b { color: var(--desce); font-variant-numeric: tabular-nums; }
  .pavisos { margin-top: 8px; font-size: 12px; color: var(--alerta); line-height: 1.5; }
  .ficha { margin-top: 11px; border-top: 1px solid var(--linha); padding-top: 9px; }
  .fichaLinha { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px;
    font-size: 12.5px; padding: 4px 0; }
  .fichaP { color: var(--fraco); }
  .fichaR { font-weight: 650; text-align: right; }
  .fichaLinha.bom .fichaR { color: var(--sobe); }
  .fichaLinha.ruim .fichaR { color: var(--desce); }
  .fichaD { grid-column: 1 / -1; font-size: 11.5px; color: var(--fraco); opacity: .85; }

  .nada { color: var(--fraco); padding: 16px 0; font-size: 13.5px; }
  .mudanca { display: flex; gap: 8px; align-items: baseline; padding: 7px 0;
    border-bottom: 1px solid var(--linha); font-size: 13.5px; }
  .seta { font-weight: 700; }
  .rodape { margin-top: 30px; font-size: 12px; color: var(--fraco); line-height: 1.65;
    border-top: 1px solid var(--linha); padding-top: 14px; }
  /* ---------------------------------------------------------------------
     A ABERTURA.

     Pedido dele em 08/09/2026, copiando o caderno de entregas: uma barrinha
     de videogame que confere se saiu versão nova antes de abrir.

     No radar isso não é enfeite. O painel é um app instalado, com service
     worker guardando a casca, e a noite de 08/09 terminou em "recarregue o
     app, o cache subiu para a v17" — ele olhando tela velha enquanto o
     conserto já estava no ar. Esta tela existe pra essa frase não voltar.

     E é a mesma razão de jogo segurar a abertura por um instante: a pessoa
     precisa REGISTRAR que algo foi conferido. Fechar em 80ms pareceria que
     nada aconteceu.
     --------------------------------------------------------------------- */
  /* Escura SEMPRE, nos dois temas.
     O alien tem fundo preto próprio; no tema claro ele viraria um quadrado
     escuro no meio de uma tela branca. Tela de abertura é momento de marca, e
     marca não muda de cor conforme o celular do dono. */
  #abertura { position: fixed; inset: 0; z-index: 9999; background: #05080c;
    color: #e8f0ee;
    display: grid; place-items: center; padding: 24px; transition: opacity .35s ease; }
  #abertura.saindo { opacity: 0; pointer-events: none; }
  .abMiolo { width: 100%; max-width: 300px; text-align: center; }
  .abAlien { width: 118px; height: 118px; margin: 0 auto 16px; display: block;
    border-radius: 50%; animation: abFlutua 2.6s ease-in-out infinite; }
  @keyframes abFlutua {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-7px); }
  }
    95% { transform: scaleY(.08); }
  }
  .abNome { font-size: 17px; font-weight: 800; letter-spacing: .04em; margin-bottom: 4px; }
  .abRecado { font-size: 12.5px; color: #8aa39c; min-height: 34px; line-height: 1.5; }
  .abTrilho { position: relative; height: 7px; border-radius: 4px; background: #101a22;
    overflow: hidden; margin: 16px 0 14px; }
  .abTrilho i { position: absolute; top: 0; bottom: 0; width: 40%; border-radius: 4px;
    background: #5ff2a8; animation: abCorre 1.1s ease-in-out infinite; }
  @keyframes abCorre {
    0% { left: -40%; } 100% { left: 100%; }
  }
  /* Cheia e parada: acabou de conferir e está tudo certo. */
  .abTrilho.pronto i { animation: none; left: 0; width: 100%; }
  .abTrilho.parado i { animation: none; left: 0; width: 100%; background: #16232c; }
  .abVersao { font-size: 10.5px; color: #2c4049; letter-spacing: .05em; margin-top: 18px; }
  .abBotao { font: inherit; font-size: 14px; font-weight: 700; width: 100%; padding: 12px;
    border-radius: 10px; border: 0; background: var(--sobe); color: #04120c; cursor: pointer; }

  /* A marca discreta, no rodapé. Some no meio do resto de propósito: serve
     pra ele conferir quando desconfia, não pra competir com o mercado. */
  .versaoCanto { color: var(--linha); letter-spacing: .05em; }
</style>
</head>
<body>
<div id="abertura">
  <div class="abMiolo">
    <img class="abAlien" src="/icone-512.png?v=${VERSAO}" alt="" width="512" height="512">
    <div class="abNome">RADAR DEFI</div>
    <div class="abTrilho" id="abTrilho"><i></i></div>
    <div class="abRecado" id="abRecado">procurando versão nova…</div>
    <div id="abAcao"></div>
    <div class="abVersao">${VERSAO}</div>
  </div>
</div>

<div class="caixa">
  <h1>Radar <span class="sinal">DeFi</span></h1>
  <div class="sub" id="sub">carregando…</div>
  <button class="instalar" id="instalar">📲 Instalar na tela inicial</button>
  <div id="alertas"></div>
  <div id="ciclo"></div>

  <div class="abas" role="tablist">
    <button role="tab" data-aba="hoje" aria-selected="true">🗺️ Hoje</button>
    <button role="tab" data-aba="pools" aria-selected="false">💧 Pools</button>
    <button role="tab" data-aba="grandes" aria-selected="false">🐋 Redes grandes</button>
    <button role="tab" data-aba="pequenas" aria-selected="false">🌱 Pequenas e novas</button>
    <button role="tab" data-aba="mudou" aria-selected="false">🔄 Mudou hoje</button>
    <button role="tab" data-aba="carteira" aria-selected="false">💼 Carteira</button>
  </div>

  <div id="conteudo"><div class="nada">carregando…</div></div>
  <div class="assinatura">criado por Rayakuza</div>

  <div class="rodape">
    <span class="versaoCanto">${VERSAO}</span> ·
    Dados do <a href="https://defillama.com" style="color:var(--realce)">DefiLlama</a>.
    <b>Cartaz</b> é o APY que a pool anuncia — <i>"o número que você vê hoje é uma
    fotografia do momento, não um contrato"</i> (Defiverso, APR vs APY).
    <b>Chão</b> é o que ela pagou nos dias ruins: o rendimento que superou em 9 de
    cada 10 dias do último mês. É a parte em que dá pra confiar.
    <b>Taxas</b> é o rendimento que vem de quem negocia (o Guia 3 chama de "menos
    fraudável"); <b>incentivos</b> é o token que o protocolo imprime pra atrair —
    funciona enquanto durar.
    <br><br>
    Isto mostra para onde o dinheiro está indo e o que há de estranho nisso.
    Não é recomendação de investimento, e crescimento rápido em coisa pequena é
    exatamente o formato que golpe tem.
  </div>
</div>

<script>
const fmt = (v) => {
  if (v == null || !isFinite(v)) return "—";
  const s = v < 0 ? "-" : "", n = Math.abs(v);
  if (n >= 1e9) return s + "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return s + "$" + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + "M";
  if (n >= 1e3) return s + "$" + (n / 1e3).toFixed(0) + "k";
  return s + "$" + n.toFixed(0);
};
const pc = (v, d = 1) => (v == null || !isFinite(v)) ? "—" : (v >= 0 ? "+" : "") + v.toFixed(d) + "%";
const nu = (v, d = 1) => (v == null || !isFinite(v)) ? "—" : v.toFixed(d) + "%";
const cor = (v) => v == null ? "" : v >= 0 ? "sobe" : "desce";
const esc = (t) => String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

let dados = null, aba = "hoje";

function celula(rot, valor, classe = "", destaque = false) {
  return '<div class="num' + (destaque ? " destaque" : "") + (valor === "—" ? " vazio2" : "") + '">' +
    '<div class="numRot">' + rot + '</div>' +
    '<div class="numVal ' + classe + '">' + valor + '</div></div>';
}

/* A etiqueta é o que ele LÊ; a classe é o que o banco guarda.
 *
 * São coisas separadas de propósito. "alugada" continua sendo o valor gravado
 * (mudar dado guardado por causa de palavra exigiria remedir tudo), mas na tela
 * está escrito "incentivada", que é o termo do Guia 3 do Predador —
 * "Incentivos/Earnings", ao lado de "Taxas/fees". O Rayakuza lê a palavra do curso
 * dele; o banco continua falando o que sempre falou. */
const ETIQUETA = { firme: "🟢 taxas", alugada: "🟡 incentivada", loteria: "🔴 loteria", nova: "🆕 nova" };

/* Os avisos dos portões — contexto, não reprovação.
 *
 * Ficam separados do motivo de reprovação de propósito: uma pool que passa com
 * três avisos não é a mesma coisa que uma que passa limpa, e juntar as duas
 * coisas apagaria a diferença. */
function avisosDoPortao(p) {
  if (!p.avisos || !p.avisos.length) return "";
  return '<div class="pavisos">' + p.avisos.map((a) =>
    '<div>· ' + esc(a) + '</div>').join("") + '</div>';
}

function cartaoDePool(p) {
  /* Os quatro números da REGRA DO 3 (Módulo 8) na frente, e o chão logo atrás.
   *
   * O giro vem destacado porque é o que manda na ordem: "TVL baixo, volume
   * alto" é a regra do curso, e é ela que diz quanta taxa cada dólar cata. */
  /* O MULTIPLICADOR na frente — é o critério do método (Taxas24h/TVL).
   *
   * Ao lado dele, o chão: a distância entre os dois é onde o radar acrescenta
   * ao método, porque o multiplicador é do dia e o chão é o que a pool de fato
   * sustentou. */
  const numeros = '<div class="numeros">' +
    celula("mult/dia", p.multiplicador == null ? "—" : p.multiplicador.toFixed(3) + "%",
           p.cartazVsChao?.inflado ? "desce" : "sobe", true) +
    celula("chão", nu(p.chao), cor(p.chao)) +
    celula("cartaz", nu(p.cartaz)) +
    celula("incentivos", p.emitido == null ? "—" : p.emitido.toFixed(0) + "%",
           p.emitido >= 60 ? "desce" : "") +
  '</div>';

  // O aviso que o método sozinho não daria.
  /* O AVISO SEM RÉGUA EXTERNA. Antes ele comparava contra uma meta mensal que
     eu não consigo provar de onde saiu; agora compara a pool com ela mesma —
     o que ela anuncia contra o que ela pagou. Fato, não alvo. */
  const aviso = p.cartazVsChao?.inflado
    ? '<div class="recado">⚠️ O cartaz anuncia ' +
      p.cartazVsChao.aoMesAnunciado.toFixed(1) + '%/mês, mas o que ela de fato pagou dá ' +
      p.cartazVsChao.aoMesGarantido.toFixed(1) + '%/mês — ' +
      p.cartazVsChao.quantasVezes.toFixed(1) + ' vezes menos.</div>'
    : "";

  // A trajetória: ontem, semana, mês — pra ver se está começando ou murchando.
  const traj = (p.apyOntem != null)
    ? '<div class="numeros" style="margin-top:5px">' +
        celula("ontem", nu(p.apyOntem)) +
        celula("7 dias", nu(p.apySemana)) +
        celula("1 mês", nu(p.apyMes)) +
        celula("volume", p.volumeDirecao
          ? (p.volumeDirecao === "caindo" ? "↓ " : p.volumeDirecao === "subindo" ? "↑ " : "= ") +
            (p.volumeRazao != null ? p.volumeRazao.toFixed(0) + "%" : "")
          : "—", p.volumeDirecao === "caindo" ? "desce" : p.volumeDirecao === "subindo" ? "sobe" : "") +
      '</div>'
    : "";

  // A ficha, no formato do estudo de caso do Módulo 4.
  const ficha = (p.ficha || []).length
    ? '<div class="ficha">' + p.ficha.map((i) =>
        '<div class="fichaLinha ' + i.peso + '">' +
          '<span class="fichaP">' + esc(i.pergunta) + '</span>' +
          '<span class="fichaR">' + esc(i.resposta) + '</span>' +
          (i.detalhe ? '<div class="fichaD">' + esc(i.detalhe) + '</div>' : "") +
        '</div>').join("") + '</div>'
    : "";

  const par = p.par
    ? '<span class="chip">' + esc(p.par) + '</span>' +
      (p.parRisco ? '<span class="chip fraco">' + esc(p.parRisco) + '</span>' : "")
    : "";

  /* A faixa de taxa. "Atenção a isso", diz a aula — e é ela que fecha a conta
     do multiplicador: giro × faixa = taxas/TVL ao dia. */
  const faixa = p.faixa
    ? '<span class="chip faixa f-' + p.faixa.nivel + '" title="' + esc(p.faixa.texto) + '">' +
      p.faixa.faixa + '% por troca</span>'
    : "";

  /* A correlação, que o método exige em par de dois voláteis.
   *
   * "Os ativos precisam ter alta correlação positiva" — e o curso não dá o
   * número. Aqui ele aparece, com o veredito e com o caso de "não sei"
   * separado do caso de "reprovou": pool sem histórico de preço não é pool
   * ruim, é pool não medida, e apagar essa diferença é o mesmo erro que
   * confundir "não cresceu" com "não sei se cresceu". */
  const v = p.parVeredito;
  const correlacao = (v && v.aplica)
    ? '<div class="recado ' + (v.aprovado ? "bom" : v.leitura.nivel === "sem-dado" ? "naoSei" : "") + '">' +
        (v.aprovado ? "🔗 " : v.leitura.nivel === "sem-dado" ? "❔ " : "⚠️ ") + esc(v.texto) +
      '</div>'
    : "";

  /* O caminho pra achar a pool de verdade.
   *
   * O cartão sempre disse ONDE ela está (protocolo e rede), mas dizer não é o
   * mesmo que levar: o Rayakuza tinha que copiar "brix", "Ethereum" e "WITRY" e
   * sair procurando à mão — e nome de projeto no DeFi é ambíguo de propósito.
   *
   * A página da pool no DefiLlama resolve tudo de uma vez: gráfico, rede,
   * protocolo, tokens do par, o explorer, e um "Website" que aponta pra tela de
   * adicionar liquidez DAQUELA pool no protocolo. Um link só, e não três, por
   * isso: os outros já estão lá dentro.
   *
   * rel=noopener porque a página de destino não precisa (nem deve) poder mexer
   * na nossa aba.
   *
   * (Sem crase neste comentário: o painel inteiro mora dentro de um template
   * literal, e uma crase aqui fecha a string da página.) */
  const link = p.id
    ? '<a class="irPara" href="https://defillama.com/yields/pool/' + encodeURIComponent(p.id) +
      '" target="_blank" rel="noopener">abrir no DefiLlama ↗</a>'
    : "";

  return '<div class="cartao">' +
    '<div class="topo">' +
      '<span class="nome">' + esc(p.projeto) + '</span>' +
      (p.nota ? '<span class="chip nota">' + p.nota.selo + '</span>' : "") +
      '<span class="etiqueta et-' + p.classe + '">' + (ETIQUETA[p.classe] || p.classe) + '</span>' +
    '</div>' +
    '<div class="onde">' + esc(p.rede) + ' · ' + fmt(p.tvl) + ' parados' +
      (p.volume7d ? ' · ' + fmt(p.volume7d) + ' girados na semana' : "") + '</div>' +
    '<div class="chips">' + par + faixa + '</div>' +
    numeros + aviso + correlacao + avisosDoPortao(p) + traj + ficha +
    '<div class="frase">' + esc(p.porque) + '</div>' +
    link +
  '</div>';
}

function cartaoDeRede(r) {
  const numeros = '<div class="numeros">' +
    celula("24h", pc(r.var1d), cor(r.var1d)) +
    celula("7d", pc(r.var7d), cor(r.var7d), true) +
    celula("1M", pc(r.var30d), cor(r.var30d)) +
    celula("3M", pc(r.var90d), cor(r.var90d)) +
  '</div>';

  const puxa = (r.puxadores || []).length
    ? '<div class="puxa">quem puxou: ' + r.puxadores.map((x) =>
        esc(x.nome) + " " + fmt(x.delta)).join(" · ") + '</div>'
    : "";

  return '<div class="cartao">' +
    '<div class="topo">' +
      '<span class="nome">' + esc(r.rede) + '</span>' +
      '<span class="onde">' + fmt(r.tvl) + ' parados</span>' +
      '<span class="etiqueta ' + (r.var7d >= 0 ? "et-firme" : "et-loteria") + '">' +
        fmt(r.abs7d) + '</span>' +
    '</div>' +
    numeros +
    '<div class="frase">' + esc(r.porque) + '</div>' +
    puxa +
  '</div>';
}

function grupo(titulo, nota, itens, desenha, vazio, total = null) {
  // "mostrando 6 de 412" em vez de deixar parecer que 6 e tudo que existe.
  const conta = (total != null && total > itens.length)
    ? ' <span class="onde">mostrando ' + itens.length + ' de ' + total + '</span>' : "";
  return '<div class="grupo">' +
    '<div class="grupoTitulo">' + titulo + conta + '</div>' +
    '<div class="grupoNota">' + nota + '</div>' +
    (itens.length ? itens.map(desenha).join("") : '<div class="nada">' + vazio + '</div>') +
  '</div>';
}

/* O mapa do dia: pra onde o dinheiro está indo, e qual assunto o está levando.
 *
 * Vem primeiro porque é a pergunta que se faz antes de escolher pool: se o
 * dinheiro está saindo de uma narrativa inteira, a melhor pool dentro dela
 * ainda é uma aposta contra a maré. */
/* ---------------------------------------------------------------------------
 * O BITCOIN — o eixo em que o resto se apoia.
 *
 * No método do Defiverso tudo aponta pro Bitcoin: é ele que define o ciclo, o
 * ciclo muda a divisão da carteira e o que se pode esperar de uma pool. O
 * radar já buscava o preço dele todo dia pra isso — só que a leitura virava
 * dois números e sumia.
 *
 * Aqui ela ganha corpo: o preço, a linha de 200 dias, onde está dentro da faixa
 * que percorreu, e há quantos dias está desse lado.
 *
 * O gráfico é SVG escrito à mão. Nenhuma biblioteca: o painel inteiro não tem
 * dependência externa, e um gráfico não é motivo pra criar a primeira.
 * ------------------------------------------------------------------------- */
/* O SELETOR DAS TRES JANELAS.
 *
 * Botao de verdade e nao aba: sao tres estados de um grafico so, nao tres
 * telas. E ele mora ACIMA do desenho porque quem troca de janela esta olhando
 * o desenho — o controle tem que estar onde o olho ja esta.
 *
 * A escolha NAO e guardada entre visitas, e isso e decisao. O radar existe pra
 * situar no ciclo; abrir sempre em 24 horas ensinaria a olhar o ruido primeiro,
 * que e exatamente o habito que o metodo tenta desfazer. */
function seletorDaJanela() {
  var opcoes = [["200d", "200 dias"], ["7d", "7 dias"], ["24h", "24 horas"]];
  return '<div class="janelaBtc">' + opcoes.map(function (o) {
    return '<button type="button" class="jbOp' + (janelaDoBtc === o[0] ? " ativo" : "") +
      '" data-janela="' + o[0] + '">' + o[1] + '</button>';
  }).join("") + '</div>';
}

function graficoDoBtc(g, serieVelha, mediaHoje, precoVivo, cruz, largura, altura) {
  /* SEM AS SERIES, DESENHA O QUE DA — e diz que esta faltando.
   *
   * A leitura guardada da rodada de hoje pode ser anterior a este codigo. Em
   * vez de sumir com o grafico, ele cai no modo antigo (preco + linha reta) e
   * a legenda EXPLICA que as medias chegam na proxima rodada. Tela que some
   * sem dizer por que e o mesmo defeito de outra forma. */
  var temSeries = g && g.preco && g.preco.length > 4;
  var serie = temSeries ? g.preco : serieVelha;
  if (!serie || serie.length < 4) return "";

  /* A PONTA DA LINHA E O PRECO DE AGORA.
   *
   * Ele perguntou: "isso seria um grafico vivo atualizando?". Em parte era, e
   * a parte que faltava era um defeito meu: a bolinha do fim ia no preco vivo,
   * mas a LINHA terminava no fechamento da rodada da manha. A bolinha flutuava
   * solta, desligada da ponta da linha — que e pior que nao se mexer, porque
   * parece erro de desenho.
   *
   * Trocar o ultimo ponto pelo preco de agora nao e maquiagem: o ultimo ponto
   * da serie E o dia de hoje, e o preco de hoje mudou desde a rodada. O numero
   * novo e mais verdadeiro que o guardado, nao menos.
   *
   * A COPIA e obrigatoria. 'g.preco' e o array guardado, usado tambem pelas
   * contas de variacao da janela; escrever nele aqui faria o resto da tela
   * passar a ler um numero que so existia pro desenho — o tipo de efeito
   * colateral que aparece semanas depois como "esse numero nao bate". */
  if (precoVivo > 0) {
    serie = serie.slice();
    serie[serie.length - 1] = precoVivo;
  }

  /* A escala cobre TUDO o que vai ser desenhado. Se a faixa sair fora da caixa
     o leitor ve uma linha cortada e acha que o indicador parou. */
  var todos = serie.slice();
  if (temSeries) {
    [g.media50, g.media200, g.faixaBaixa, g.faixaAlta].forEach(function (a) {
      (a || []).forEach(function (v) { if (v != null) todos.push(v); });
    });
  } else if (mediaHoje != null) { todos.push(mediaHoje); }
  if (precoVivo > 0) todos.push(precoVivo);

  var min = Math.min.apply(null, todos), max = Math.max.apply(null, todos);
  var vao = (max - min) || 1;
  /* A margem DIREITA abre espaco pros precos do eixo; a de baixo, pras datas. */
  var mE = 6, mD = 34, mT = 10, mB = 16;
  var n = serie.length;
  var x = function (i) { return mE + (i / (n - 1)) * (largura - mE - mD); };
  var y = function (v) { return mT + (1 - (v - min) / vao) * (altura - mT - mB); };

  /* O EIXO DE PRECO, do lado direito.
   *
   * Ele olhou o grafico pronto e disse: "nao consigo ver valor nenhum". Estava
   * certo, e a falta era antiga — o desenho mostrava a FORMA e nao dizia
   * quanto vale nenhum ponto. Da pra ver que subiu; nao da pra saber de quanto
   * pra quanto, que e a unica pergunta que importa pra quem tem dinheiro na
   * mesa.
   *
   * Tres marcas: o teto da escala, o meio e o piso. Nao mais que isso — um
   * grafico deste tamanho com seis linhas de grade vira um borrao, e o preco
   * exato de agora ja esta na celula grande logo acima.
   *
   * As linhas de grade sao MUITO fracas de proposito: elas orientam o olho e
   * nao competem com as quatro linhas que sao a informacao. */
  var eixoDePreco = function () {
    var fora = "";
    var mil = function (v) {
      return v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v);
    };
    [max, (max + min) / 2, min].forEach(function (v) {
      var yy = y(v);
      fora += '<line x1="' + mE + '" y1="' + yy.toFixed(1) + '" x2="' + (largura - mD) +
        '" y2="' + yy.toFixed(1) + '" stroke="var(--linha)" stroke-width=".7" opacity=".45"/>' +
        '<text x="' + (largura - mD - 1) + '" y="' + (yy - 2.5).toFixed(1) +
        '" font-size="8.5" fill="var(--fraco)" text-anchor="end">' + esc(mil(v)) + '</text>';
    });
    return fora;
  };

  var caminho = function (a, so) {
    var d = "", ligado = false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] == null) { ligado = false; continue; }
      d += (ligado ? "L" : "M") + x(i).toFixed(1) + "," + y(a[i]).toFixed(1) + " ";
      ligado = true;
    }
    return d.trim();
  };

  var partes = eixoDePreco();

  /* A FAIXA DE BULL MARKET COMO AREA, e nao como duas linhas.
   *
   * Ela e uma FAIXA — o espaco entre a media de 20 semanas e a de 21. Desenhar
   * duas linhas quase coladas so faria sujeira; a area diz o que ela e: uma
   * zona, com espessura, que o preco atravessa. */
  if (temSeries && g.faixaAlta && g.faixaBaixa) {
    var cima = "", baixo = "";
    for (var i = 0; i < n; i++) {
      if (g.faixaAlta[i] == null) continue;
      cima += (cima ? "L" : "M") + x(i).toFixed(1) + "," + y(g.faixaAlta[i]).toFixed(1) + " ";
    }
    for (var i = n - 1; i >= 0; i--) {
      if (g.faixaBaixa[i] == null) continue;
      baixo += "L" + x(i).toFixed(1) + "," + y(g.faixaBaixa[i]).toFixed(1) + " ";
    }
    if (cima && baixo) {
      partes += '<path d="' + cima + baixo + 'Z" fill="var(--sobe)" opacity=".20"/>';
    }
  }

  // a area do preco, so um fundo suave
  var linhaPreco = caminho(serie);
  partes += '<path d="' + linhaPreco + " L" + x(n - 1).toFixed(1) + "," + (altura - mB) +
    " L" + x(0).toFixed(1) + "," + (altura - mB) + ' Z" fill="url(#gBtc)"/>';

  /* CADA LINHA SO E DESENHADA SE ELA EXISTE.
     Era 'if (temSeries)', e temSeries so olha o PRECO. No grafico por hora o
     preco existe e as medias nao — entao caminho(null) estourava dentro do
     desenho, o bloco inteiro sumia, e a tela ficava eternamente em
     "buscando...". Uma condicao que fala por quatro arrays acaba mentindo
     sobre tres deles. */
  if (temSeries && g.media200) {
    partes += '<path d="' + caminho(g.media200) + '" fill="none" stroke="var(--alerta)" ' +
      'stroke-width="1.3" opacity=".9" stroke-linejoin="round"/>';
  }
  if (temSeries && g.media50) {
    partes += '<path d="' + caminho(g.media50) + '" fill="none" stroke="var(--fraco)" ' +
      'stroke-width="1.1" opacity=".9" stroke-dasharray="3 3" stroke-linejoin="round"/>';
  } else if (mediaHoje != null) {
    /* O modo antigo, e ele fica MARCADO como aproximacao. */
    var ym = y(mediaHoje).toFixed(1);
    partes += '<line x1="' + mE + '" y1="' + ym + '" x2="' + (largura - mD) + '" y2="' + ym +
      '" stroke="var(--alerta)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".6"/>';
  }

  // o preco por cima de tudo
  partes += '<path d="' + linhaPreco + '" fill="none" stroke="var(--realce)" stroke-width="1.7" ' +
    'stroke-linejoin="round" stroke-linecap="round"/>';

  /* A CRUZ, marcada onde ela aconteceu.
   *
   * 'quandoDias' conta de hoje pra tras; 'atrasDe' diz quantos dias atras esta
   * cada ponto. Achar o ponto mais proximo e melhor que interpolar: o grafico
   * tem 100 pontos pra 200 dias, entao cada ponto ja vale dois dias, e fingir
   * precisao de um dia seria inventar. */
  if (temSeries && cruz && cruz.quandoDias != null && g.atrasDe) {
    var alvoDias = cruz.quandoDias, melhorI = -1, melhorD = 1e9;
    for (var i = 0; i < g.atrasDe.length; i++) {
      var d = Math.abs(g.atrasDe[i] - alvoDias);
      if (d < melhorD) { melhorD = d; melhorI = i; }
    }
    if (melhorI >= 0 && melhorD <= 4 && g.media50[melhorI] != null) {
      var cx = x(melhorI), cy = y(g.media50[melhorI]);
      var ouro = cruz.tipo === "ouro";
      partes += '<line x1="' + cx.toFixed(1) + '" y1="' + mT + '" x2="' + cx.toFixed(1) +
        '" y2="' + (altura - mB) + '" stroke="' + (ouro ? "var(--sobe)" : "var(--desce)") +
        '" stroke-width="1" stroke-dasharray="2 3" opacity=".7"/>' +
        '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.4" fill="none" ' +
        'stroke="' + (ouro ? "var(--sobe)" : "var(--desce)") + '" stroke-width="1.6"/>';
    }
  }

  /* O PONTO DE AGORA, na ponta da linha — que agora e o mesmo lugar.
   *
   * O relogio de 60 segundos busca o preco e, quando ele mudou, manda
   * 'desenhar()' — que refaz a tela inteira, este grafico junto. Entao a ponta
   * anda de verdade a cada minuto.
   *
   * O QUE NAO SE MEXE, e nao deve: o resto da curva. Sao 200 fechamentos
   * diarios, e um fechamento de tres meses atras nao muda porque o preco de
   * agora mudou. Grafico que redesenha o passado a cada minuto nao esta vivo,
   * esta mentindo. */
  var ultimo = serie[n - 1];
  partes += '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(ultimo).toFixed(1) +
    '" r="3.2" fill="var(--realce)"><animate attributeName="opacity" values="1;.35;1" ' +
    'dur="2.4s" repeatCount="indefinite"/></circle>';

  /* AS DATAS. Um grafico sem eixo de tempo e um desenho bonito: da pra ver que
     subiu, nao da pra saber quando.

     Os rotulos podem vir prontos (g.rotulos), e vem no grafico por hora: la o
     eixo e de HORAS, e escrever "10 set" tres vezes seguidas nao ajudaria
     ninguem. O de 200 dias continua calculando data a partir de atrasDe. */
  if (g && g.rotulos && g.rotulos.length === 3) {
    var ondeX = [mE, largura / 2, largura - mD];
    var ancoras = ["start", "middle", "end"];
    g.rotulos.forEach(function (txt, k) {
      partes += '<text x="' + ondeX[k].toFixed(1) + '" y="' + (altura - 4) +
        '" font-size="8.5" fill="var(--fraco)" text-anchor="' + ancoras[k] + '">' +
        esc(txt) + '</text>';
    });
  } else if (temSeries && g.atrasDe) {
    var dataDe = function (atras) {
      var d = new Date(Date.now() - atras * 86400000);
      /* "23 de fev" vira "23 fev": o eixo tem tres rotulos e pouca largura, e
         a preposicao nao ajuda ninguem a ler uma data. */
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
        .replace(" de ", " ").replace(".", "");
    };
    var marcas = [0, Math.floor((n - 1) / 2), n - 1];
    marcas.forEach(function (i, k) {
      partes += '<text x="' + (k === 0 ? mE : k === 2 ? largura - mD : x(i)).toFixed(1) +
        '" y="' + (altura - 4) + '" font-size="8.5" fill="var(--fraco)" text-anchor="' +
        (k === 0 ? "start" : k === 2 ? "end" : "middle") + '">' +
        esc(i === 0 ? dataDe(g.atrasDe[0]) : i === n - 1 ? "hoje" : dataDe(g.atrasDe[i])) +
        '</text>';
    });
  }

  return '<svg class="btcGraf" viewBox="0 0 ' + largura + ' ' + altura + '" ' +
      'role="img" aria-label="preço do Bitcoin, médias de 50 e 200 dias e a faixa de bull market">' +
      '<defs><linearGradient id="gBtc" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--realce)" stop-opacity=".22"/>' +
        '<stop offset="100%" stop-color="var(--realce)" stop-opacity="0"/>' +
      '</linearGradient></defs>' + partes +
    '</svg>' +
    (g && g.porHora
      ? '<div class="grafLegenda"><span><i class="lgPreco"></i>Bitcoin, de hora em hora</span>' +
        '<span>sem as médias: elas são contas de meses, e sobre este pedaço ' +
        'seriam três linhas retas sem significado</span></div>'
      : temSeries
      ? '<div class="grafLegenda">' +
          '<span><i class="lgPreco"></i>Bitcoin</span>' +
          '<span><i class="lgFaixa"></i>faixa de bull market</span>' +
          '<span><i class="lg200"></i>média 200d</span>' +
          '<span><i class="lg50"></i>média 50d</span>' +
        '</div>'
      : '<div class="grafLegenda"><span>as médias entram no gráfico na próxima ' +
        'rodada — a leitura guardada é de antes delas existirem</span></div>');
}

/* ---------------------------------------------------------------------------
 * O PRECO DE AGORA E DE AGORA.
 *
 * Ele reparou: "vi que isso nao esta atualizando, o preco do Bitcoin mudou faz
 * tempo e ele nao acompanha, acreditei que foi um tipo de painel que atualizava
 * com o preco do Bitcoin".
 *
 * Estava certo, e o defeito era de honestidade: a celula dizia AGORA e trazia
 * a leitura da manha. Um numero velho com etiqueta de numero novo e a mesma
 * armadilha do APY anunciado que o radar inteiro existe pra desarmar.
 *
 * A DIVISAO, e ela e de custo, nao de capricho:
 *
 *   VIVO      o preco de agora. Muda a cada minuto, e ja existia uma rota
 *             barata que sabe: a mesma que cota os tokens da carteira.
 *
 *   DA MANHA  a media de 200 dias, a serie do grafico, o regime e ha quantos
 *             dias ele esta desse lado. Sao 400 dias de historico por leitura
 *             buscar a cada F5 pagaria duas chamadas ao DefiLlama pra receber
 *             um numero que muda uma vez por dia.
 *
 * E o que DEPENDE do preco se recalcula com o vivo: quanto esta contra a
 * media, onde esta na faixa, e a distancia dos alvos dele. Misturar preco novo
 * com distancia velha daria duas verdades na mesma tela. */
/* QUAL JANELA DO BITCOIN ESTA NA TELA.
 *
 * Tres perguntas diferentes, tres janelas — e a escolha fica com quem olha, em
 * vez de eu adivinhar. "200d" e a do ciclo, com as medias e a faixa; as outras
 * duas sao so preco, de hora em hora.
 *
 * O padrao e 200d de proposito: o radar existe pra situar no ciclo, e abrir no
 * grafico de 24 horas ensinaria a olhar o ruido primeiro. */
/* O CICLO BUSCADO PELA TELA, sem esperar a rodada.
 *
 * A leitura guardada continua valendo e continua sendo a que tem data. Isto
 * aqui e o ATALHO: as series do grafico, a faixa e a cruz saem de uma rota
 * propria, guardada meia hora na borda, e chegam poucos segundos depois da
 * pagina abrir.
 *
 * Por que existe: as tres coisas foram publicadas e ele nao conseguia ver
 * nenhuma, porque dependiam da proxima rodada. Fazer a pessoa esperar horas
 * pra ver uma medida que custa um pedido de rede e transferir pra ela o preco
 * de uma escolha minha. */
/* O MACRO, buscado pela tela.
 *
 * Mesma decisao do ciclo vivo, e pelo mesmo motivo: dado de mercado publico
 * nao precisa esperar a rodada. A rota guarda seis horas na borda, entao cem
 * aberturas do painel custam uma ida ao FRED. */
var macroVivo = null;
var macroBuscado = false;

function pedirMacro() {
  if (macroBuscado) return;
  macroBuscado = true;
  fetch("/api/macro?v=${VERSAO}").then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (d) {
    /* GUARDA MESMO SEM DADO. So guardar quando veio numero fazia o bloco de
       'o que faltou' nunca aparecer — a explicacao do erro dependia de nao ter
       erro. Quem desenha e que decide o que fazer com uma resposta vazia. */
    if (d) { macroVivo = d; desenhar(); }
  }).catch(function () {});
}

var cicloVivo = null;
var cicloBuscado = false;

function pedirCicloVivo() {
  if (cicloBuscado) return;
  cicloBuscado = true;
  /* A VERSAO DO CODIGO ENTRA NA CHAVE DO CACHE.
     Esta rota fica guardada meia hora na borda, e o que ela devolve MUDA
     quando eu publico. Sem a versao aqui, uma correcao publicada levava ate
     meia hora pra chegar em quem ja tinha aberto — e eu perdi tempo achando
     que o codigo estava errado quando era o cache servindo o anterior.
     Conteudo que muda com o codigo tem que ter o codigo na chave. */
  fetch("/api/btc-ciclo?v=${VERSAO}").then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (d) {
    if (d && d.grafico) { cicloVivo = d; desenhar(); }
  }).catch(function () {});
}

var janelaDoBtc = "200d";
var horasDoBtc = {};        // { "24": [pontos], "168": [pontos] }
var horasBuscando = {};

function pedirHoras(horas) {
  var chave = String(horas);
  if (horasDoBtc[chave] || horasBuscando[chave]) return;
  horasBuscando[chave] = true;
  fetch("/api/btc-horas?horas=" + horas + "&v=${VERSAO}").then(function (r) {
    return r.ok ? r.json() : null;
  }).then(function (d) {
    horasBuscando[chave] = false;
    if (d && d.pontos && d.pontos.length > 3) { horasDoBtc[chave] = d.pontos; desenhar(); }
  }).catch(function () { horasBuscando[chave] = false; });
}

/* Os pontos por hora viram o mesmo formato que o grafico ja entende: preco, e
   rotulos prontos pro eixo. Sem medias e sem faixa — elas sao contas de meses,
   e desenha-las sobre 24 horas daria tres linhas retas sem significado. */
function janelaPorHora(horas) {
  var pontos = horasDoBtc[String(horas)];
  if (!pontos || pontos.length < 4) return null;
  var hora = function (t) {
    var d = new Date(t * 1000);
    return horas <= 48
      ? d.getHours() + "h"
      : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
          .replace(" de ", " ").replace(".", "");
  };
  var meio = pontos[Math.floor(pontos.length / 2)];
  return {
    preco: pontos.map(function (p) { return p.preco; }),
    rotulos: [hora(pontos[0].t), hora(meio.t), "agora"],
    /* Sem medias: o grafico desenha so o que existe, e a legenda diz por que. */
    media50: null, media200: null, faixaBaixa: null, faixaAlta: null,
    atrasDe: null, dias: null, porHora: true,
  };
}

var btcVivo = null;      // { preco, variacao24h, quando }
var btcBuscadoEm = 0;

function precoDoBtcAgora(l) {
  if (btcVivo && btcVivo.preco > 0) return btcVivo.preco;
  return (l && l.preco && l.preco.hoje) || null;
}

async function buscarBitcoin() {
  /* No maximo uma busca por minuto. O preco nao anda mais rapido que isso pro
     que esta tela decide, e F5 nervoso nao pode virar enxurrada de chamada. */
  var agora = Date.now();
  if (agora - btcBuscadoEm < 60000) return false;
  btcBuscadoEm = agora;
  try {
    var r = await fetch("/api/precos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokens: ["BTC"] }),
    });
    if (!r.ok) return false;
    var d = await r.json();
    var t = d && d.tokens && d.tokens.BTC;
    if (!t || !(t.preco > 0)) return false;
    /* SÓ AVISA QUANDO MUDOU. Quem chama redesenha a tela ao receber "true", e
       redesenhar de minuto em minuto pra escrever o mesmo número seria fazer a
       tela piscar à toa enquanto ele lê. O relógio bate; a tela só se mexe
       quando há o que mostrar. */
    var mudou = !btcVivo || btcVivo.preco !== t.preco;
    btcVivo = { preco: t.preco, variacao24h: t.variacao24h, quando: d.quando || null,
                lidoEm: Date.now() };
    return mudou;
  } catch (e) {
    /* Falhar aqui nao pode apagar o bloco: sem preco vivo ele mostra o da
       manha e DIZ que e da manha. */
    return false;
  }
}

/* O PREÇO DO BITCOIN, VIVO NA TELA.
 *
 * Pedido dele em 09/09/2026: "pode deixar o preço do BTC em tempo real nessa
 * tela, ele é o centro de todo o mercado, merece destaque". E é o método dele
 * falando: o Bitcoin define o ciclo, e o ciclo muda a divisão da carteira do
 * B.A.R.C.A. — essa parte está no material, com os números.
 * tudo o que vem depois.
 *
 * TRÊS REGRAS, e cada uma existe por um motivo:
 *
 * 1. SÓ COM A ABA "HOJE" ABERTA. É a única tela que mostra o preço. Buscar
 *    enquanto ele está na Carteira seria gastar rede pra ninguém ver.
 *
 * 2. PARA QUANDO A TELA SOME. O painel é um aplicativo instalado no celular
 *    dele; um relógio rodando com o telefone no bolso é bateria queimada por
 *    número que ninguém está lendo. visibilitychange desliga e religa.
 *
 * 3. AO VOLTAR, BUSCA NA HORA. Voltar do bolso e ver o preço de vinte minutos
 *    atrás por mais um minuto é pior do que não ter relógio nenhum — porque aí
 *    ele confia no número velho achando que é vivo.
 *
 * O intervalo é o mesmo limite que buscarBitcoin já respeitava: um minuto.
 * Não porque o preço demore a mudar, mas porque é o que esta tela decide —
 * ciclo, meta e faixa não viram em trinta segundos. */
var relogioDoBtc = null;

function pararRelogioDoBtc() {
  if (relogioDoBtc) { clearInterval(relogioDoBtc); relogioDoBtc = null; }
}

function ligarRelogioDoBtc() {
  pararRelogioDoBtc();
  if (aba !== "hoje") return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  relogioDoBtc = setInterval(function () {
    if (aba !== "hoje" || document.visibilityState === "hidden") { pararRelogioDoBtc(); return; }
    buscarBitcoin().then(function (mudou) { if (mudou && aba === "hoje") desenhar(); });
  }, 60000);
}

/* O CLIQUE NO SELETOR DE JANELA, no nivel de cima.
 *
 * ELE ESTAVA DENTRO DE ligarRelogioDoBtc, e nunca era registrado: aquela
 * funcao tem duas saidas antecipadas antes do ponto onde eu tinha posto o
 * ouvinte. Os tres botoes apareciam na tela, mudavam de cor no CSS, e clicar
 * nao fazia nada. Peguei porque fui CLICAR pelo navegador em vez de conferir
 * que o HTML tinha os botoes — o HTML estava certo e a tela estava morta.
 *
 * A LICAO: "o elemento esta no DOM" nao e a mesma pergunta que "ele funciona".
 * Botao so esta pronto quando alguem clicou nele.
 *
 * Aqui em cima porque este trecho roda sempre, sem condicao — igual ao
 * visibilitychange logo abaixo. E por delegacao porque o bloco inteiro e
 * refeito a cada desenhar(): botao agarrado por id morre no proximo redesenho.
 */
if (typeof document !== "undefined") {
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest(".jbOp");
    if (!b) return;
    var nova = b.getAttribute("data-janela");
    if (!nova || nova === janelaDoBtc) return;
    janelaDoBtc = nova;
    if (nova !== "200d") pedirHoras(nova === "24h" ? 24 : 168);
    desenhar();
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") { pararRelogioDoBtc(); return; }
    if (aba !== "hoje") return;
    /* Voltou: busca AGORA, sem esperar o próximo minuto. */
    btcBuscadoEm = 0;
    buscarBitcoin().then(function (mudou) { if (mudou && aba === "hoje") desenhar(); });
    ligarRelogioDoBtc();
  });
}

/* Onde o preco esta na faixa, recalculado com o preco de agora.
 *
 * Mesma conta e mesmas palavras de posicaoNoCiclo/lerPosicao no servidor — e
 * esta duplicacao e proposital e pequena: o painel nao consegue importar do
 * Worker, e o teste arranca esta funcao daqui pra provar que as duas
 * concordam. */
function posicaoComPreco(pos, preco) {
  if (!pos) return null;
  var p = Number(preco);
  if (!(p > 0)) return pos;

  /* O preco de agora pode ter furado o topo ou o fundo da janela medida de
     manha. Furar e noticia, nao erro: o topo novo e o preco novo. Sem isto a
     marca da regua sairia da barra. */
  var topo = Math.max(pos.topo, p);
  var fundo = Math.min(pos.fundo, p);
  if (!(topo > fundo)) return pos;

  var doTopo = (p / topo - 1) * 100;
  var doFundo = (p / fundo - 1) * 100;
  var posicao = ((p - fundo) / (topo - fundo)) * 100;
  var onde =
    posicao >= 90 ? "colado no topo da janela"
    : posicao >= 65 ? "na parte de cima da faixa"
    : posicao >= 35 ? "no meio da faixa"
    : posicao >= 10 ? "na parte de baixo da faixa"
    : "colado no fundo da janela";

  return {
    hoje: p, topo: topo, fundo: fundo, dias: pos.dias,
    doTopo: doTopo, doFundo: doFundo, posicao: posicao, onde: onde,
    texto: onde + ": " + Math.abs(doTopo).toFixed(0) + "% abaixo do topo dos " +
      pos.dias + " dias e " + doFundo.toFixed(0) + "% acima do fundo",
  };
}

/* A régua da faixa: onde o preço está entre o fundo e o topo da janela. */
function reguaDaFaixa(p) {
  if (!p) return "";
  var pos = Math.max(0, Math.min(100, p.posicao));
  return '<div class="faixaRegua">' +
      '<div class="faixaBarra"><div class="faixaMarca" style="left:' + pos.toFixed(1) + '%"></div></div>' +
      '<div class="faixaPontas">' +
        '<span>' + fmt(p.fundo) + '<br><span class="onde">fundo</span></span>' +
        '<span style="text-align:right">' + fmt(p.topo) + '<br><span class="onde">topo</span></span>' +
      '</div>' +
    '</div>';
}

function blocoDoBitcoin() {
  var c = dados && dados.ciclo;
  var l = c && c.leitura;
  if (!l || !l.serie || !l.serie.length) return "";

  var hoje = precoDoBtcAgora(l);
  var vivo = !!(btcVivo && btcVivo.preco > 0);

  /* A posicao na faixa e a distancia da media saem do preco de AGORA. Preco
     novo com distancia velha seriam duas verdades na mesma tela. */
  var pos = vivo ? posicaoComPreco(l.posicao, hoje) : l.posicao;

  var contra = (l.mediaHoje > 0 && hoje > 0)
    ? (hoje / l.mediaHoje - 1) * 100
    : (l.preco && l.preco.dist != null ? l.preco.dist * 100 : null);

  /* A serie e de fechamentos diarios; o ultimo ponto vira o preco de agora,
     senao a bolinha do grafico discorda do numero logo acima dela. */
  var serie = l.serie;
  if (vivo) { serie = l.serie.slice(); serie[serie.length - 1] = Math.round(hoje); }

  var variacao = serie.length > 1 ? (serie[serie.length - 1] / serie[0] - 1) * 100 : null;

  /* O RÓTULO DIZ SE ESTÁ VIVO. "agora" era uma promessa que a célula nem sempre
     cumpria; com o pontinho, ela cumpre ou confessa. */
  var celulas = '<div class="numeros">' +
    celula(vivo ? '<span class="pulso"></span>agora' : "agora ·  da manhã",
      hoje ? fmt(hoje) : "—", "", true) +
    celula("média 200d", l.mediaHoje ? fmt(l.mediaHoje) : "—") +
    celula("contra ela", contra != null ? pc(contra) : "—", contra >= 0 ? "sobe" : "desce") +
    celula("desse lado há",
      l.diasNoRegime != null ? l.diasNoRegime + "d"
      : (l.diasQueEnxergo > 0 ? l.diasQueEnxergo + "+ d" : "—")) +
  '</div>';

  /* DE QUANDO E CADA NUMERO. Sem esta linha o bloco inteiro parece ter a mesma
     idade, e metade dele nao tem. */
  /* DE QUANDO E CADA NUMERO — em uma linha, e nao num paragrafo.
     Aqui havia a explicacao inteira de qual parte se atualiza sozinha e qual
     vem da rodada. Isso e desenho, e desenho e assunto do codigo. Fica a
     variacao de 24h, que e mercado, e a data, que evita ler numero velho como
     novo. */
  var carimbo = vivo
    ? '<div class="puxa">' +
      (btcVivo.variacao24h != null
        ? (btcVivo.variacao24h >= 0 ? "+" : "") + btcVivo.variacao24h.toFixed(1) + "% em 24h · "
        : "") +
      'médias e gráfico de ' + esc(l.dia || "hoje") + '</div>'
    : '<div class="puxa">preço de ' + esc(l.dia || "hoje") + '</div>';

  return grupo("₿ Bitcoin — o eixo do ciclo",
    "",
    [1], function () {
      return '<div class="cartao btcCartao">' +
        celulas +
        seletorDaJanela() +
        (function () {
          var porHora = janelaDoBtc !== "200d";
          var horas = janelaDoBtc === "24h" ? 24 : 168;
          if (porHora) {
            var jh = janelaPorHora(horas);
            if (!jh) {
              pedirHoras(horas);
              return '<div class="grafEsperando">buscando o preço de hora em hora…</div>';
            }
            return graficoDoBtc(jh, jh.preco, null, precoDoBtcAgora(l), null, 720, 150);
          }
          /* O QUE CHEGOU AGORA GANHA DO QUE FOI GUARDADO, e a regra e a
             mesma dos indicadores: o novo vale quando existe, o velho fica
             quando o novo nao veio. Nunca o contrario. */
          var gr = (cicloVivo && cicloVivo.grafico) || l.grafico;
          var cz = (cicloVivo && cicloVivo.cruzamento) ||
                   l.cruzamento || (l.confronto && l.confronto.cruzamento);
          if (!gr) pedirCicloVivo();
          return graficoDoBtc(gr, serie, l.mediaHoje, precoDoBtcAgora(l), cz, 720, 150);
        })() +
        reguaDaFaixa(pos) +
        (pos ? '<div class="frase">' + esc(pos.texto) + '</div>' : "") +
        (variacao != null
          /* A FRASE DIZ RESPEITO A FAIXA DO CICLO, NAO AO GRAFICO.
             Ela dizia "a janela inteira do GRAFICO sao N dias" — e virou
             mentira no minuto em que o grafico ganhou tres janelas: quem
             estava vendo 24 horas lia que estava vendo 260 dias. A medida e a
             mesma de sempre (o pedaco que a leitura enxerga); so o nome dela
             estava errado. */
          ? '<div class="puxa">' + (pos ? pos.dias : serie.length) + ' dias · ' +
            (variacao >= 0 ? "+" : "−") + Math.abs(variacao).toFixed(0) + '%</div>'
          : "") +
        carimbo +
        '<div id="alertasBtc"></div>' +
      '</div>';
    }, "");
}

/* Os alvos de preço que ele guardou na própria conta.
 *
 * Ficam no Supabase, com RLS — então quem não entrou não vê nada, e é por isso
 * que esta parte é desenhada DEPOIS, quando a sessão existe.
 *
 * ELES AVISAM NO TELEGRAM. Nem sempre foi assim, e a história vale ficar.
 *
 * Aqui morava este comentário: "disparar aviso no Telegram exigiria o Worker
 * ler a tabela pelos usuários, e isso pede um segredo que só o Rayakuza pode pôr
 * na Cloudflare". Era verdade quando foi escrito. O segredo chegou em
 * 09/09/2026, junto com a cópia de segurança — e o comentário ficou aqui,
 * descrevendo um impedimento que já não existia.
 *
 * Ele descobriu do jeito ruim: perguntou "o monitor BTC tá meio parado", e a
 * resposta era que quatro alvos dele, dois postos naquela manhã, nunca tinham
 * disparado e nunca iriam. Um deles estava a 1,7% do preço.
 *
 * A LIÇÃO: um comentário que diz "isto está bloqueado por X" é uma dívida com
 * vencimento invisível. No dia em que X sai do caminho, ninguém volta pra ler
 * o comentário — ele vira uma explicação convincente de um defeito.
 *
 * A TELA DIZ DE QUANTO EM QUANTO TEMPO. Três olhadas por dia não é vigilância
 * contínua, e um alerta que deixa a pessoa achar que é vira o pior tipo de
 * ferramenta: aquela em que se confia pra parar de olhar. */
async function desenharAlertasBtc() {
  var alvo = document.getElementById("alertasBtc");
  if (!alvo || !sessao) return;
  var l = dados && dados.ciclo && dados.ciclo.leitura;
  /* A distancia ate o alvo dele sai do preco de AGORA. Dizer "-4.6% daqui"
     com o preco da manha e errar justamente o numero que ele usa pra decidir. */
  var hoje = precoDoBtcAgora(l);
  if (!hoje) return;
  try {
    var r = await comAuth("/rest/v1/alertas?select=direcao,alvo,moeda,disparado_em&order=alvo.desc");
    if (!r.ok) return;
    var lista = await r.json();
    if (!lista.length) return;
    alvo.innerHTML = '<div class="alertasBtc"><div class="alertasTit">seus alvos de preço</div>' +
      lista.map(function (a) {
        var distancia = (Number(a.alvo) / hoje - 1) * 100;
        var perto = Math.abs(distancia) <= 5;
        var bateu = a.direcao === "above" ? hoje >= a.alvo : hoje <= a.alvo;

        /* TRÊS ESTADOS, e eles são diferentes.
         *
         *   avisado   o Telegram já mandou, e a data prova
         *   atingido  o preço passou o alvo, e o aviso sai na próxima rodada
         *   distância ainda não chegou lá
         *
         * Juntar os dois primeiros num "atingido" só esconderia justamente a
         * pergunta que ele vai fazer — "então por que não me avisou?" — cuja
         * resposta é "ainda vai, na próxima olhada". */
        var direito;
        if (a.disparado_em) {
          direito = "avisado " + new Date(a.disparado_em).toLocaleDateString("pt-BR");
        } else if (bateu) {
          direito = "atingido · aviso na próxima olhada";
        } else {
          direito = (distancia >= 0 ? "+" : "") + distancia.toFixed(1) + "% daqui";
        }

        return '<div class="alertaLinha' +
            (a.disparado_em ? " avisado" : bateu ? " bateu" : perto ? " perto" : "") + '">' +
          '<span>' + (a.direcao === "above" ? "acima de " : "abaixo de ") + fmt(Number(a.alvo)) + '</span>' +
          '<span>' + direito + '</span>' +
        '</div>';
      }).join("") +
      '<div class="alertaNota">Eu olho o preço <b>três vezes por dia</b> — 8h, meio-dia ' +
        'e 18h — e aviso no Telegram. Entre uma olhada e outra o preço pode ir e ' +
        'voltar sem eu ver. Cada alvo avisa uma vez só.</div>' +
      '</div>';
  } catch (e) {}
}

/* As pools em que ele já está.
 *
 * Antes de tudo na tela do dia. O resto do painel responde "onde vale olhar";
 * isto responde "o que mudou no que eu já tenho", e a segunda pergunta é sobre
 * dinheiro que já está na mesa.
 *
 * A regra de escrita é a mesma do bot: mostra o que mudou, com o número da
 * entrada ao lado do de hoje, e não diz o que fazer. */
function blocoDasMinhas() {
  const ms = dados.minhas || [];
  if (!ms.length) return "";

  const linha = (s) => {
    const num = (r, a, b, casas) => (a == null || b == null) ? "" :
      '<span>' + r + ': ' + a.toFixed(casas) + '% <b>→ ' + b.toFixed(casas) + '%</b></span>';
    const mudou = (s.mudancas || []).length;
    return '<div class="minha' + (mudou ? " mexeu" : "") + '">' +
      '<div class="minhaTopo">' +
        '<span class="minhaNome">' + esc(s.projeto) + ' ' + esc(s.simbolo || "") + '</span>' +
        '<span class="onde">' + esc(s.rede) + '</span>' +
        '<span class="minhaDesde">desde ' + esc(s.desde) +
          (s.dias != null ? ' · ' + s.dias + (s.dias === 1 ? " dia" : " dias") : "") + '</span>' +
      '</div>' +
      '<div class="antesDepois">' +
        num("chão", s.chaoEntrada, s.chaoHoje, 1) +
        num("incentivo", s.incentivoEntrada, s.incentivoHoje, 0) +
        ((s.tvlEntrada != null && s.tvlHoje != null)
          ? '<span>tamanho: ' + fmt(s.tvlEntrada) + ' <b>→ ' + fmt(s.tvlHoje) + '</b></span>' : "") +
      '</div>' +
      (mudou
        ? (s.mudancas.slice(0, 3).map((m) =>
            '<div class="minhaMudou">⚠️ ' + esc(m.texto) + '</div>').join(""))
        : '<div class="minhaCalma">✅ ' + esc(s.resumo) + '</div>') +
      (s.id ? '<a class="irPara" href="https://defillama.com/yields/pool/' +
        encodeURIComponent(s.id) + '" target="_blank" rel="noopener">abrir a pool ↗</a>' : "") +
    '</div>';
  };

  const mexeram = ms.filter((s) => (s.mudancas || []).length).length;
  return grupo("💼 Suas pools",
    mexeram
      ? mexeram + " de " + ms.length + " mudaram desde que você entrou. O número da entrada fica ao lado do de hoje — o que fazer com isso é com você."
      : "Nenhuma mudou de forma relevante desde que você entrou.",
    ms, linha, "");
}

function telaDeHoje() {
  const n = dados.narrativas || {};
  const fl = dados.fluxo || {};

  const linhaNarrativa = (x, positivo) =>
    '<div class="cartao">' +
      '<div class="topo">' +
        '<span class="nome">' + esc(x.narrativa) + '</span>' +
        '<span class="etiqueta ' + (positivo ? "et-firme" : "et-loteria") + '">' +
          (x.delta7d >= 0 ? "+" : "") + fmt(x.delta7d) + '</span>' +
      '</div>' +
      '<div class="frase">' + esc(x.porque) + '</div>' +
    '</div>';

  const linhaRede = (f, positivo) =>
    '<div class="mudanca">' +
      '<span class="seta ' + (positivo ? "sobe" : "desce") + '">' + (positivo ? "↑" : "↓") + '</span>' +
      '<span><b>' + esc(f.rede) + '</b> ' + (f.abs7d >= 0 ? "+" : "") + fmt(f.abs7d) +
      ' <span class="onde">' + pc(f.var7d) + ' · ' + fmt(f.tvl) + ' parados' +
      (f.varStables7d != null ? ' · stablecoin ' + pc(f.varStables7d) : "") +
      '</span></span></div>';

  return (
    blocoDoBitcoin() +
    blocoDasMinhas() +
    grupo("🔥 Narrativa puxando capital",
      "Qual assunto o dinheiro está procurando esta semana. Somado por categoria de protocolo, ordenado por dólar.",
      n.puxando || [], (x) => linhaNarrativa(x, true), "Nenhuma narrativa se destacou.") +
    grupo("🌑 Narrativa perdendo capital",
      "De onde o dinheiro está saindo. A melhor pool dentro de uma narrativa em fuga ainda rema contra a maré.",
      n.perdendo || [], (x) => linhaNarrativa(x, false), "Nenhuma narrativa perdeu dinheiro relevante hoje.") +
    grupo("🌱 Emergindo",
      "Categorias pequenas crescendo rápido — é onde uma narrativa nova aparece antes de virar assunto.",
      n.emergindo || [], (x) => linhaNarrativa(x, true), "Nada emergindo agora.") +
    grupo("💰 Redes ganhando capital", "Fluxo líquido da semana, em dólares.",
      fl.ganhando || [], (f) => linhaRede(f, true), "Nenhuma.") +
    grupo("🩸 Redes perdendo capital", "Fluxo líquido da semana, em dólares.",
      fl.perdendo || [], (f) => linhaRede(f, false), "Nenhuma perda relevante.")
  );
}

/* Os quatro números do cartão, explicados uma vez, em cima.
 *
 * "Chão" é palavra minha: procurei nos 82 PDFs do curso e no glossário e não há
 * termo do Defiverso pra isso, porque o curso não calcula essa medida. O que o
 * curso TEM é a ideia, escrita com todas as letras no relatório de APR vs APY —
 * e é ela que vai na citação aqui embaixo.
 *
 * Já "taxas" e "incentivos" são palavras DELE, do Guia 3 do Predador. Eu tinha
 * inventado "uso real" e "emitido" sem precisar. */
const LEGENDA =
  '<div class="legenda"><dl>' +
    '<dt>cartaz</dt><dd>o APY que a pool <b>anuncia</b>. É o melhor caso.</dd>' +
    '<dt>chão</dt><dd>o que ela <b>pagou nos dias ruins</b>: o rendimento que superou em 9 de cada 10 dias do último mês. É a parte em que dá pra contar.</dd>' +
    '<dt>taxas</dt><dd>rendimento que vem de <b>quem negocia</b> na pool.</dd>' +
    '<dt>incentivos</dt><dd>token que o protocolo <b>imprime</b> pra atrair dinheiro. Funciona enquanto durar.</dd>' +
    '<dt>mult/dia</dt><dd>o multiplicador do método: Taxas 24h ÷ TVL.</dd>' +
  '</dl>' +
  '<div class="fonte">"O número que você vê hoje é uma fotografia do momento, não um contrato." — Defiverso, APR vs APY</div>' +
  '</div>';

/* O mesmo par, em redes diferentes.
 *
 * Responde a pergunta que a aula "Pools na prática" resolve com cinco abas de
 * navegador abertas: "eu quero ESTE par — onde ele paga mais?". Ordenado pelo
 * espalhamento (quantas vezes o melhor lugar paga mais que o pior), porque a
 * pergunta aqui não é qual par rende mais, e sim onde se estaria deixando
 * dinheiro na mesa por abrir no lugar errado. */
function blocoDoComparador() {
  const cs = dados.comparacoes || [];
  if (!cs.length) return "";

  const linha = (o, i, total) => {
    const cls = i === 0 ? " top" : (i === total - 1 && total > 2 ? " fundo" : "");
    return '<div class="compLinha' + cls + '">' +
      '<span>' + esc(o.projeto) + ' <span class="onde">' + esc(o.rede) + '</span></span>' +
      '<span class="compMult">' + o.multiplicador.toFixed(3) + '%/dia</span>' +
      '<span class="compTvl">' + fmt(o.tvl) + '</span>' +
    '</div>';
  };

  const cartao = (c) => '<div class="comp">' +
      '<div class="compTopo">' +
        '<span class="compPar">' + esc(c.par) + '</span>' +
        (c.espalhamento >= 1.5
          ? '<span class="compVezes">' + c.espalhamento.toFixed(1) + 'x de diferença</span>' : "") +
        '<span class="compOnde">' + c.redes + (c.redes === 1 ? " rede" : " redes") +
          ' · ' + c.dexes + (c.dexes === 1 ? " protocolo" : " protocolos") + '</span>' +
      '</div>' +
      c.opcoes.map((o, i) => linha(o, i, c.opcoes.length)).join("") +
      (c.notaDoTvl ? '<div class="compNota">💡 ' + esc(c.notaDoTvl.texto) + '</div>' : "") +
    '</div>';

  return grupo("🔀 O mesmo par, redes diferentes",
    "Onde cada par paga mais. É o passo que a aula faz abrindo uma aba por rede — aqui está tudo de uma vez, ordenado pelo multiplicador do método (taxas 24h ÷ TVL).",
    cs, cartao, "");
}

function telaDePools() {
  const p = dados.pools;
  const t = dados.totais || {};
  const g = dados.portoes;

  /* O que os portões cortaram, dito em voz alta.
   *
   * O método é muito mais seletivo do que o radar era — de ~1900 pools medidas
   * sobram algumas dezenas. Sem esta caixa, a lista curta teria a mesma cara de
   * "o mercado está parado", e o Rayakuza não teria como saber que o corte foi
   * dele, nem qual regra cortou. */
  const resumoPortoes = g && g.barradas
    ? '<div class="cartao portoes">' +
        '<div class="qtitulo">os portões do método cortaram ' + g.barradas + ' pools</div>' +
        g.porMotivo.slice(0, 5).map((m) =>
          '<div class="pmotivo"><b>' + m.quantas + '</b> ' + esc(m.motivo) + '</div>').join("") +
        '<div class="porque">Cortes: TVL mínimo $' + (g.corte.tvlMinimo / 1e3).toFixed(0) + 'k · ' +
        'volume 24h mínimo $' + (g.corte.volumeMinimo24h / 1e3).toFixed(0) + 'k · ' +
        'rendimento de taxas mínimo ' + g.corte.rendimentoDescarte + '%/ano · ' +
        'uma perna em token âncora · sem par de duas memecoins.</div>' +
      '</div>'
    : "";
  if (!p || (!p.firmes.length && !p.alugadas.length && !p.loterias.length && !p.novas.length)) {
    return '<div class="nada">Ainda não há pools medidas. A medição roda às 8h da manhã ' +
      'e precisa do histórico semeado (<code>node semear-pools.js</code>).<br><br>' +
      'Se você semeou hoje e mesmo assim está vazio, provavelmente o banco bateu no ' +
      'limite diário de escrita do plano grátis — ele zera à meia-noite UTC (21h de Brasília) ' +
      'e a rodada das 8h preenche sozinha.</div>';
  }
  return (
    LEGENDA +
    blocoDoComparador() +
    resumoPortoes +
    grupo("🟢 Firmes — vivem de TAXAS",
      "Pagam parecido todo dia, e o dinheiro vem de quem negocia. Taxa é a métrica que o Guia 3 chama de <b>menos fraudável</b>. <b>Ordenadas pelo multiplicador do método</b> (Taxas 24h ÷ TVL).",
      p.firmes, cartaoDePool, "Nenhuma pool firme no corte de hoje.", t.firme) +
    grupo("🟡 Incentivadas — vivem de INCENTIVO",
      "Também pagam de forma regular, mas com token que o protocolo imprime. <i>Entre cedo quando os incentivos começarem, saia antes que terminem</i> — e eles terminam sem aviso.",
      p.alugadas, cartaoDePool, "Nenhuma.", t.alugada) +
    grupo("🔴 Loterias",
      "O número grande é média de dias muito bons com dias muito ruins. Ordenadas pelo tamanho da promessa que não se cumpre.",
      p.loterias, cartaoDePool, "Nenhuma — o que é bom sinal.", t.loteria) +
    grupo("🆕 Novas",
      "Montadas nos últimos 21 dias. É onde estão construindo agora, mas ainda não pagaram o suficiente pra se saber o que pagam.",
      p.novas, cartaoDePool, "Nenhuma pool nova relevante.", t.nova)
  );
}

function telaDeRedes(qual) {
  const r = dados.redes[qual];
  const grande = qual === "grandes";
  return (
    grupo(grande ? "📈 Grandes recebendo dinheiro" : "📈 Pequenas acelerando",
      grande
        ? "As 10 maiores redes. Aqui 5% já é muito: mexer isso numa rede de bilhões são centenas de milhões trocando de lugar."
        : "Fora do top 10. Aqui o corte é bem mais alto (25%) porque porcentagem em rede pequena engana com facilidade.",
      r.subiram, cartaoDeRede,
      grande ? "Nenhuma das 10 maiores se mexeu o bastante." : "Nenhuma pequena acelerando hoje.") +
    grupo(grande ? "📉 Grandes perdendo dinheiro" : "📉 Pequenas esvaziando",
      "Ordenadas pelo tamanho da saída em dólares, não pela porcentagem.",
      r.cairam, cartaoDeRede, "Nenhuma queda relevante.")
  );
}

function telaDeMudancas() {
  const m = dados.mudou;
  if (!m.tinhaOntem) {
    return '<div class="nada">Ainda não tenho a leitura de ontem pra comparar. ' +
      'A partir de amanhã esta aba mostra o que entrou e o que saiu das listas.</div>';
  }
  const linha = (x, entrou) =>
    '<div class="mudanca"><span class="seta ' + (entrou ? "sobe" : "desce") + '">' +
    (entrou ? "↑" : "↓") + '</span><span><b>' + esc(x.projeto || x.rede || x.id) + '</b> ' +
    esc(x.simbolo || "") + ' <span class="onde">' + esc(x.classe || "") + '</span></span></div>';

  return (
    grupo("↑ Entraram nas listas", "Pools que hoje passaram no corte e ontem não passavam.",
      m.entraram, (x) => linha(x, true), "Nada novo entrou.") +
    grupo("↓ Saíram das listas", "Pools que estavam ontem e hoje não estão — pararam de pagar, encolheram, ou mudaram de classe.",
      m.sairam, (x) => linha(x, false), "Nada saiu.")
  );
}

/* A RÉGUA DO CURSO, desenhada ao lado da minha.
 *
 * Entrou em 08/09/2026, depois de ele perguntar se eu tinha pegado todo o
 * material do curso. Não tinha: o Portal 2 — Teoria dos Ciclos ensina como
 * determinar o ciclo, com indicador nomeado e corte numérico, e eu tinha escrito
 * no código que "o curso nunca diz como determinar".
 *
 * CADA INDICADOR MOSTRA O NÚMERO, A FAIXA E A DATA. O número sozinho não diz
 * nada a quem não decorou os cortes; a faixa sozinha é um veredito que se
 * aceita sem conferir. Os três juntos deixam ele discordar de mim — que é o
 * ponto da ferramenta inteira.
 *
 * E a data importa mais aqui do que em qualquer outro lugar do painel: a fonte
 * limita 10 chamadas por hora e o Worker sai por IP compartilhado, então um
 * número pode ser de ontem. Número velho declarado velho é melhor que número
 * ausente — mas número velho apresentado como de hoje é pior que os dois. */
/* O QUE O DINHEIRO DO MUNDO ESTA FAZENDO.
 *
 * Inflacao, juros, quanto dinheiro existe, e o tamanho do balanco do banco
 * central americano. Sao os numeros que decidem se o dinheiro esta ficando
 * mais caro ou mais barato — e o preco de todo ativo de risco anda com isso.
 *
 * VEM DEPOIS DOS INDICADORES DO BITCOIN, e a ordem e proposital: o radar
 * existe pra situar no ciclo do Bitcoin, e o macro e o pano de fundo, nao o
 * assunto. Quem abre quer saber onde esta antes de saber por que.
 *
 * A REGRA DE TAYLOR E UMA CONTA, NAO UMA PREVISAO. Ela diz em que altura os
 * juros ficariam pela formula, dado o quanto a inflacao passou da meta. O
 * banco central se afasta dela com frequencia — e e justamente a DISTANCIA
 * entre a conta e o juro real que informa alguma coisa. */
function blocoDoMacro() {
  var m = macroVivo;
  if (!m) { pedirMacro(); return ""; }

  /* SEM DADO, SEM BLOCO — e o motivo NAO vai pra tela.
     Havia aqui um aviso explicando que o FRED recusa pedidos da nuvem sem
     credencial, com o endereco pra pedir a chave e o comando pra guardar. Isso
     e tarefa de quem monta, nao informacao de quem observa. Quem monta ve em
     /saude/macro; quem observa nao ve um bloco vazio pedindo desculpa. */
  if (m.falhas && m.falhas.length && !m.inflacao && !m.m2) return "";

  var linhas = [];
  var por = function (x, forte) {
    if (!x || !x.texto) return;
    linhas.push('<div class="indLinha' + (forte ? " destaque" : "") + '">' +
      '<span class="ponto">·</span><span>' + esc(x.texto) + '</span></div>');
  };

  por(m.inflacao, true);
  por(m.postura, true);
  por(m.taylor);
  por(m.m2);
  por(m.balanco);
  if (!linhas.length) return "";

  var resumo = "";
  if (m.inflacao && m.postura) {
    /* UMA FRASE QUE JUNTA AS DUAS PONTAS, sem dizer o que fazer com elas.
       Inflacao acima da meta pede juro mais alto; juro abaixo do que a regra
       aponta e o contrario disso. Quando as duas coisas acontecem juntas, isso
       e a informacao — e some se cada linha for lida sozinha. */
    resumo = m.inflacao.acimaDaMeta && m.postura.frouxa
      ? "Inflação acima da meta e juro abaixo do que a regra aponta ao mesmo tempo."
      : !m.inflacao.acimaDaMeta && m.postura.apertada
      ? "Inflação abaixo da meta e juro acima do que a regra aponta ao mesmo tempo."
      : "";
  }

  return '<div class="cicloCurso">' +
    '<div class="cursoTopo"><b>O dinheiro do mundo</b>' +
      (m.desemprego ? '<span class="cursoFase">desemprego ' +
        esc(String(m.desemprego.valor).replace(".", ",")) + '%</span>' : "") +
    '</div>' +
    linhas.join("") +
    (resumo ? '<div class="cursoRecado">' + esc(resumo) + '</div>' : "") +

    /* O rodape explicativo saiu junto com os outros: de onde vem a serie e
       como a conta e feita e documentacao, e documentacao mora no codigo. */
  '</div>';
}

/* Este numero esta perto o bastante de um corte pra a fonte decidir a leitura?
 *
 * Os cortes sao os mesmos do indicadores.js. A margem de 4% e MINHA, e sai da
 * medida: os dois caminhos de calculo divergiram no maximo 3,5% em 09/09/2026,
 * entao 4% cobre a divergencia observada com uma folga pequena. */
var CORTES_NA_TELA = {
  mvrv: [1, 1.4, 1.5, 3.5],
  zscore: [0.5, 3],
  puell: [0.5, 3],
  vdd: [0.5, 3],
};

function pertoDeUmCorte(chave, valor, margem) {
  var cortes = CORTES_NA_TELA[chave];
  if (!cortes || !(valor > 0)) return false;
  var m = margem || 0.04;
  for (var i = 0; i < cortes.length; i++) {
    if (Math.abs(valor / cortes[i] - 1) <= m) return true;
  }
  return false;
}

function blocoDaReguaDoCurso(c) {
  var l = c && c.leitura;
  var cur = l && l.curso;
  var ind = (l && l.indicadores) || {};

  /* O BLOCO SO SOME QUANDO NAO HA ABSOLUTAMENTE NADA A DIZER.
   *
   * Antes ele sumia inteiro quando os quatro indicadores on-chain falhavam —
   * e eles falham direto, porque a fonte tem cota por IP e o IP e o
   * compartilhado da Cloudflare. Resultado: a faixa de bull market e o
   * cruzamento, que NAO dependem daquela fonte e estavam prontos, sumiam
   * junto. Ele viu isso como "aparece praticamente nada".
   *
   * Uma condicao que fala por quatro coisas some com as outras duas. Agora
   * cada pedaco decide sozinho se tem o que mostrar. */
  /* O GUARDADO GANHA, O VIVO PREENCHE. Mesma ordem de sempre: a fonte de
     referencia (que a rodada busca) vale mais que o substituto (que a tela
     busca). O vivo entra quando o guardado nao tem nada — e ele DIZ que e
     substituto, linha por linha. */
  var veioDoSubstituto = false;
  if ((!cur || cur.fase === "sem-dado") && cicloVivo && cicloVivo.curso &&
      cicloVivo.curso.fase !== "sem-dado") {
    cur = cicloVivo.curso;
    ind = Object.assign({}, cicloVivo.indicadores || {}, { falhas: (ind && ind.falhas) || [] });
    veioDoSubstituto = true;
  }
  var temCurso = cur && cur.fase !== "sem-dado";
  var temEstrutura = (cicloVivo && (cicloVivo.faixaDeBull || cicloVivo.cruzamento)) ||
                     (l && (l.faixaDeBull || l.cruzamento));
  if (!temCurso && !temEstrutura) { pedirCicloVivo(); return ""; }

  var faixa = {
    fundo: { txt: "fundo", cor: "sobe" },
    topo: { txt: "topo", cor: "desce" },
    acumulacao: { txt: "acumulação", cor: "sobe" },
    meio: { txt: "meio do caminho", cor: "" },
  };

  var linhas = (temCurso ? (cur.porque || []) : []).map(function (t, i) {
    var chave = ["mvrv", "zscore", "puell", "vdd"][i];
    var d = ind[chave];
    return '<div class="indLinha">' +
      '<span class="ponto">·</span>' +
      '<span>' + esc(t) +
        /* DUAS MARCAS, e elas dizem coisas diferentes.
           "leitura de X" = o numero e de outro dia.
           "fonte reserva" = o numero e de hoje, mas veio por outro caminho de
           calculo. Medido, os dois caminhos ficam a menos de 3,5% um do outro
           — so que perto de um corte do curso 3% decidem de que lado o
           indicador cai, e quem le tem que poder saber disso. */
        (d && d.deAntes && d.dia
          ? ' <i class="indVelho">(leitura de ' + esc(d.dia) + ')</i>'
          : "") +
        /* A MARCA DA FONTE RESERVA SO APARECE QUANDO ELA PODE MUDAR A LEITURA.
         *
         * Antes ela vinha em toda linha, e ele reparou que isso polui sem
         * informar. Ele tem razao no caso comum: os dois caminhos de calculo
         * ficam a menos de 3,5% um do outro, e a 3,5% do MEIO de uma faixa a
         * diferenca nao muda nada do que se le.
         *
         * Perto de um CORTE, muda tudo: um MVRV de 1,395 por um caminho e
         * 1,405 pelo outro e "no meio" num e "acumulacao" no outro. Entao a
         * marca aparece exatamente ai — quando o numero esta perto o bastante
         * de um corte pra a escolha da fonte decidir a leitura.
         *
         * Aviso que aparece sempre vira moldura e some da vista; aviso que
         * aparece raro e lido. */
        (d && d.fonte === "coinmetrics" && pertoDeUmCorte(chave, d.valor)
          ? ' <i class="indVelho">(pode virar pro outro lado: valor de fonte alternativa)</i>'
          : "") +
      '</span>' +
    '</div>';
  }).join("");

  var f = (temCurso && faixa[cur.fase]) || faixa.meio;

  /* A FAIXA DE BULL MARKET E A CRUZ, as duas linhas que faltavam.
   *
   * Vêm ANTES da média de 50 na tela, e a ordem é a importância: a faixa é
   * semanal (vinte semanas são cinco meses), a média de 50 é diária. Linha
   * lenta em cima, linha rápida embaixo — quem lê de cima pra baixo lê da
   * estrutura pro detalhe.
   *
   * Elas saem de l e não de l.confronto: o confronto mora dentro do try da
   * régua do curso e vem null quando a fonte dos indicadores cai. A faixa não
   * depende daquela fonte — sai do preço do Bitcoin. Pendurá-la no confronto
   * faria uma medida que funciona sumir junto com uma fonte que às vezes não
   * responde. */
  var mil = function (v) {
    return "US$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR");
  };

  var bmsb = (cicloVivo && cicloVivo.faixaDeBull) ||
             l.faixaDeBull || (l.confronto && l.confronto.faixaDeBull);
  var cruz = (cicloVivo && cicloVivo.cruzamento) ||
             l.cruzamento || (l.confronto && l.confronto.cruzamento);
  if (!bmsb) pedirCicloVivo();

  var linhaDaFaixa = bmsb
    ? '<div class="indLinha destaque">' +
        '<span class="ponto">·</span>' +
        '<span>' + esc(bmsb.texto) +
          ' <i class="indVelho">(' + esc(mil(bmsb.fundo)) + " a " + esc(mil(bmsb.topo)) +
          ", Bitcoin em " + esc(mil(bmsb.hoje)) + ')</i></span>' +
      '</div>'
    : "";

  var linhaDaCruz = cruz
    ? '<div class="indLinha">' +
        '<span class="ponto">·</span>' +
        '<span>' + esc(cruz.texto) + '</span>' +
      '</div>'
    : "";

  /* Quando as três réguas rimam (ou brigam), isso é a informação — e ela vale
     mais que qualquer uma das três sozinha. */
  var rima = (l.confronto && l.confronto.recadoDaFaixa &&
              l.confronto.recadoDaFaixa !== (bmsb && bmsb.texto))
    ? '<div class="cursoRecado' +
      (/CONTRÁRIO/.test(l.confronto.recadoDaFaixa) ? " briga" : "") + '">' +
      esc(l.confronto.recadoDaFaixa.split(" · ").slice(1).join(" · ")) + '</div>'
    : "";

  return '<div class="cicloCurso">' +
    '<div class="cursoTopo">' +
      '<b>Os indicadores do ciclo</b>' +
      (temCurso ? '<span class="cursoFase ' + f.cor + '">' + esc(f.txt) + '</span>' : "") +
    '</div>' +
    /* SEM OS INDICADORES ON-CHAIN, O BLOCO SO MOSTRA O QUE TEM.
       Antes ele explicava a falha ("a fonte tem cota por hora"), e ele reparou:
       "isso e coisa tecnica de quem ta criando, nao de quem quer observar o
       mercado". Tem razao — por que a fonte recusou nao muda nada do que ele
       ve nem do que ele decide. O estado tecnico mora em /saude, que existe
       pra isso. */
    (temCurso ? '<div class="cursoFirmeza">' + esc(cur.firmeza) + '</div>' : "") +
    linhas +
    linhaDaFaixa +
    linhaDaCruz +
    /* A media de 50 seguia SO a leitura guardada, enquanto a faixa e a cruz ja
       preferiam a viva. Duas linhas vizinhas com regras diferentes de qual
       fonte vale: uma mostrava o texto novo e a outra o antigo, na mesma
       lista. Ordem de preferencia tem que ser uma so pro bloco inteiro. */
    (function () {
      var m50 = (cicloVivo && cicloVivo.media50) || l.media50;
      return m50 && m50.texto
        ? '<div class="indLinha"><span class="ponto">·</span><span>' + esc(m50.texto) + '</span></div>'
        : "";
    })() +
    (l.altseason && l.altseason.texto
      ? '<div class="indLinha"><span class="ponto">·</span><span>' + esc(l.altseason.texto) + '</span></div>'
      : "") +
    /* O RECADO DO CONFRONTO SÓ VALE PRO CURSO QUE ELE COMPAROU.
       Ele é escrito na rodada, contra o que a rodada conseguiu. Se a rodada
       não conseguiu nada e a tela preencheu pelo substituto, o recado fica
       falando de um vazio que não está mais na tela — e apareceu embaixo dos
       indicadores dizendo "os indicadores do curso não foram lidos hoje".
       Duas frases se contradizendo na mesma tela é pior que uma faltando. */
    (l.confronto && l.confronto.recado && !veioDoSubstituto
      ? '<div class="cursoRecado' + (l.confronto.discordam ? " briga" : "") + '">' +
        esc(l.confronto.recado) + '</div>'
      : "") +
    rima +
  '</div>';
}

/* A faixa do ciclo.
 *
 * Mostra os dois eixos SEMPRE, e não só o veredito. O veredito sozinho ("bear")
 * é uma palavra que se aceita; os dois eixos são duas medidas que o Rayakuza pode
 * conferir e discordar — que é o ponto da ferramenta inteira.
 *
 * Não tem botão aqui, e é de propósito: mudar o ciclo é decisão dele, e o
 * painel é uma tela que qualquer um com o link abre. A decisão fica no
 * Telegram, que só ele tem. */
function desenharCiclo() {
  const alvo = document.getElementById("ciclo");
  const c = dados && dados.ciclo;
  if (!c) { alvo.innerHTML = ""; return; }

  const nome = c.ciclo === "indefinido" ? "Ciclo indefinido" : "Mercado " + c.ciclo;
  const eixos = (c.leitura && c.leitura.porque) || [];
  const dias = c.leitura && c.leitura.diasNoRegime;

  alvo.innerHTML =
    '<div class="ciclo c-' + esc(c.ciclo) + '">' +
      '<div class="cicloTopo">' +
        '<span class="cicloNome">' + esc(nome) + '</span>' +
      '</div>' +
      (eixos.length
        ? '<div class="cicloEixos">' +
            eixos.map((e) => '<div><span class="ponto">·</span><span>' + esc(e) + '</span></div>').join("") +
            (dias != null
              ? '<div><span class="ponto">·</span><span>o preço está desse lado há <b>' + dias + ' dias</b></span></div>'
              : "") +
          '</div>'
        : "") +
      (c.discorda
        ? '<div class="cicloBriga">⚠️ Você fixou <b>' + esc(c.ciclo) + '</b>, mas o que eu meço hoje dá <b>' +
          esc(c.leitura.ciclo) + '</b>.</div>'
        : "") +
      blocoDaReguaDoCurso(c) +
      blocoDoMacro() +
      /* O RODAPE DO CICLO ENCOLHEU PRA O QUE MUDA ALGUMA COISA.
       *
       * Ele estava assim: "Medido, não decidido: quando os dois eixos
       * discordam eu não invento um veredito — trato como bear, que é o lado
       * conservador. /ciclo bull no Telegram sobrepõe."
       *
       * Ele leu e disse: "tudo informação irrelevante que polui o app". Tem
       * razão, e o padrão é maior que essa frase — era EU EXPLICANDO O MEU
       * PRÓPRIO RACIOCÍNIO na tela dele. Como eu chego no número é assunto do
       * código; o que a tela deve é o número e a data dele.
       *
       * O que sobra: a DATA (um número de ontem apresentado como de hoje é a
       * armadilha que este projeto inteiro existe pra desarmar) e, quando ele
       * fixou o ciclo à mão, o lembrete de que fixou — senão ele esquece que
       * a tela está obedecendo a ele em vez de medindo. */
      '<div class="cicloComo">' +
        (c.origem === "escolhido"
          ? 'Ciclo fixado por você. <code>/ciclo auto</code> volta pra medida. '
          : "") +
        (c.medidoEm ? '<span style="opacity:.7">Leitura de ' + esc(c.medidoEm) + '.</span>' : "") +
      '</div>' +
    '</div>';
}

/* ---------------------------------------------------------------------------
 * A CONTA — a única parte do painel com dado pessoal.
 *
 * Fica no Supabase e não no D1 por segurança, não por gosto: o painel do radar
 * é PÚBLICO (qualquer um com o link vê o mercado), e o D1 não tem noção de
 * "quem está pedindo". No Supabase o escopo é do BANCO — as policies de RLS
 * barram a leitura da carteira de outra pessoa mesmo que o app tenha um bug.
 * É o mesmo desenho que separa as contas no Caderno.
 *
 * Sem biblioteca: a API do Supabase é HTTP puro, e o painel inteiro não tem uma
 * única dependência externa. Puxar um SDK de CDN só pra fazer três chamadas
 * criaria um jeito novo de a página quebrar (CDN fora do ar = login morto).
 *
 * A chave abaixo é PUBLICÁVEL — é o papel dela ficar na página. Quem protege os
 * dados é a RLS, não o segredo da chave.
 * ------------------------------------------------------------------------- */
/* >>> PREENCHA COM O SEU PROJETO (INSTALAR.md, passo da Supabase) <<<
 *
 * A chave "publishable" é PUBLICÁVEL mesmo — o papel dela é ficar na página.
 * Quem protege os dados é a RLS do banco, não o segredo da chave. */
var SUPA = {
  url: "https://SEU-PROJETO.supabase.co",
  chave: "sb_publishable_SUA_CHAVE_AQUI",
};
var COFRE_SESSAO = "radar:sessao";

function lerSessao() {
  try { return JSON.parse(localStorage.getItem(COFRE_SESSAO) || "null"); } catch (e) { return null; }
}
function gravarSessao(s) {
  try {
    if (s) localStorage.setItem(COFRE_SESSAO, JSON.stringify(s));
    else localStorage.removeItem(COFRE_SESSAO);
  } catch (e) {}
}

var sessao = lerSessao();

function supaFetch(caminho, opcoes) {
  var o = opcoes || {};
  var cab = { apikey: SUPA.chave, "content-type": "application/json" };
  for (var k in (o.headers || {})) cab[k] = o.headers[k];
  if (sessao && sessao.access_token) cab.authorization = "Bearer " + sessao.access_token;
  return fetch(SUPA.url + caminho, { method: o.method || "GET", headers: cab, body: o.body });
}

/* Renova o token quando vence.
 *
 * Sem isso o login "some" depois de uma hora e a pessoa acha que o app esqueceu
 * dela. Uma tentativa só: se o refresh falhar, a sessão acabou de verdade, e
 * insistir seria esconder isso. */
async function renovar() {
  if (!sessao || !sessao.refresh_token) return false;
  var r = await supaFetch("/auth/v1/token?grant_type=refresh_token", {
    method: "POST", body: JSON.stringify({ refresh_token: sessao.refresh_token }),
  });
  if (!r.ok) { sessao = null; gravarSessao(null); return false; }
  sessao = await r.json();
  gravarSessao(sessao);
  return true;
}

async function comAuth(caminho, opcoes) {
  var r = await supaFetch(caminho, opcoes);
  if (r.status === 401 && await renovar()) r = await supaFetch(caminho, opcoes);
  return r;
}

/* As mensagens do Supabase vêm em inglês. Traduzo as que acontecem de verdade e
   deixo o resto passar — inventar tradução pra erro que eu não conheço faria a
   pessoa procurar o problema no lugar errado. */
function traduzirErro(t) {
  var m = String(t || "");
  if (/Invalid login credentials/i.test(m)) return "E-mail ou senha não conferem.";
  if (/User already registered/i.test(m)) return "Esse e-mail já tem conta. Tente entrar.";
  if (/Password should be at least/i.test(m)) return "A senha precisa de pelo menos 6 caracteres.";
  if (/Unable to validate email/i.test(m) || /Email address .* is invalid/i.test(m)) {
    // O Supabase valida o domínio, não só o formato. Foi o que barrou um
    // endereço de teste em 07/09/2026 — e a mensagem crua vinha em inglês.
    return "Esse e-mail não parece válido. Confira o domínio.";
  }
  if (/Email not confirmed/i.test(m)) return "Falta confirmar o e-mail. Procure a mensagem do Supabase na sua caixa.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas seguidas. Espere um minuto.";
  return m || "Não consegui completar. Tente de novo.";
}

async function entrar(email, senha, criando) {
  var caminho = criando ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
  var r = await supaFetch(caminho, {
    method: "POST", body: JSON.stringify({ email: email, password: senha }),
  });
  var d = await r.json().catch(function () { return {}; });
  if (!r.ok) return { erro: traduzirErro(d.error_description || d.msg || d.message) };
  if (!d.access_token) {
    // Cadastro com confirmação de e-mail ligada: a conta existe mas ainda não loga.
    return { aviso: "Conta criada. Confirme pelo link que o Supabase mandou no seu e-mail e depois entre." };
  }
  sessao = d; gravarSessao(d);
  return { ok: true };
}

function sair() { sessao = null; gravarSessao(null); fatias = null; desenhar(); }

/* O APELIDO, no lugar do e-mail.
 *
 * Pedido dele: "no local do e-mail, seria bom poder pôr um usuário/nickname,
 * eu gosto de usar Rayakuza".
 *
 * E nao e so gosto: o e-mail dele fica escrito bem em cima do patrimonio, na
 * parte da tela que ele quer poder mostrar. Esconder o valor e deixar o e-mail
 * seria esconder metade.
 *
 * Mora nos dados do proprio usuario no Supabase (user_metadata), que ja existe
 * e ja e dele — sem tabela nova, e some junto se ele apagar a conta. */
var editandoApelido = null;   // o texto sendo digitado, ou null

function apelidoDaSessao() {
  if (!sessao) return null;
  var u = sessao.user;
  var a = u && u.user_metadata && u.user_metadata.apelido;
  return (typeof a === "string" && a.trim()) ? a.trim() : null;
}

function comoMeChamo() {
  return apelidoDaSessao() || emailDaSessao() || "sua conta";
}

function guardarApelido(novo) {
  var limpo = String(novo || "").trim().slice(0, 24);
  if (sessao && sessao.user) {
    sessao.user.user_metadata = sessao.user.user_metadata || {};
    sessao.user.user_metadata.apelido = limpo;
    gravarSessao(sessao);
  }
  desenhar();
  return comAuth("/auth/v1/user", {
    method: "PUT",
    body: JSON.stringify({ data: { apelido: limpo } }),
  }).catch(function () {});
}

function emailDaSessao() {
  if (!sessao) return null;
  if (sessao.user && sessao.user.email) return sessao.user.email;
  try {
    var corpo = JSON.parse(atob(sessao.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return corpo.email || null;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------------------
 * A CARTEIRA — lançada em VALOR, lida em PORCENTAGEM.
 *
 * O Rayakuza: "não vou saber a porcentagem do meu portfólio". Ele tem razão —
 * pedir que a pessoa calcule a própria proporção é pedir que ela faça o
 * trabalho que a ferramenta existe pra fazer. Ele lança quanto tem; a conta é
 * comigo.
 *
 * A moeda é por LINHA: a reserva de emergência dele está em real e o cripto em
 * dólar. Forçar uma moeda só obrigaria a converter na mão justamente quem não
 * quer fazer conta.
 * ------------------------------------------------------------------------- */
var fatias = null;
var moedaVista = (function () {
  try { return localStorage.getItem("radar:moeda") || "BRL"; } catch (e) { return "BRL"; }
})();

function cotacao() {
  var d = dados && dados.dolar;
  return d && d.valor ? Number(d.valor) : null;
}

/* Dinheiro miúdo com casas de verdade.
 *
 * dinheiroNa arredonda em dois — o que está certo pra patrimônio e errado pra
 * rendimento no começo: US$ 0,0074 de taxa virava "US$ 0,01", que parece um
 * centavo inteiro e é quase o dobro. Quando o número é menor que um centavo,
 * mostra até onde ele existe. */
/* ---------------------------------------------------------------------------
 * O MODO PRIVADO — pra ele poder mostrar a tela
 *
 * Pedido dele em 09/09/2026: "seria legal um iconezinho de um olhinho pra
 * abrir ou fechar, para mostrar ou ocultar os valores caso eu queira divulgar
 * essa parte aqui da tela".
 *
 * ESCONDE DENTRO DAS FUNCOES QUE FORMATAM, e nao em cada lugar da tela. Sao
 * tres portas por onde numero de dinheiro sai — dinheiroNa, dinheiroMiudo e
 * numeroDeToken — e tapar as tres tapa a tela inteira de uma vez. Escondendo
 * de fora eu esqueceria um canto, e um canto esquecido no modo privado e o
 * patrimonio dele aparecendo num video que ja foi publicado.
 *
 * O QUE CONTINUA VISIVEL, de proposito: porcentagem, alvo, faixa da pool,
 * variacao do preco. Nada disso diz quanto ele tem — e sem isso a tela vira
 * uma fileira de bolinhas que nao serve pra mostrar nada.
 *
 * A QUANTIDADE DE TOKEN TAMBEM SOME. "0,0731945 BTC" diz o patrimonio dele tao
 * bem quanto o valor em dolar, e esconder um sem o outro seria fingir que
 * escondeu. */
/* A ARTE ENTRA AQUI, NO TEXTO DA PAGINA.
 *
 * painel.js MONTA uma string: o import la em cima traz a constante pro
 * Worker, e o codigo que roda no navegador dele nao enxerga nada disso. Tentei
 * usar a constante direto dentro de uma funcao do navegador e deu
 * "OLHO_ABERTO is not defined" na tela. Interpolar e o unico jeito: o valor
 * vira texto dentro da pagina, na hora de montar. */
var OLHO_ABERTO = "${OLHO_ABERTO}";
var OLHO_FECHADO = "${OLHO_FECHADO}";

var PRIVADO = "radar:privado";
var privado = (function () {
  try { return localStorage.getItem(PRIVADO) === "1"; } catch (e) { return false; }
})();

/* O OLHO ALIEN, desenhado a mao em SVG.
 *
 * Pedido dele: "da pra criar os icones mas com a tematica alien? seja
 * criativo". Ele mandou duas referencias — a cabeca de alien dentro de uma
 * palpebra, e a mesma cortada por uma barra.
 *
 * SVG e nao imagem, por tres motivos concretos:
 *
 *   - o painel inteiro nao tem dependencia externa nenhuma, e um icone nao e
 *     motivo pra criar a primeira;
 *   - as cores saem das variaveis do tema, entao ele funciona no claro e no
 *     escuro sem eu manter duas versoes;
 *   - nitido em qualquer tela, e pesa algumas centenas de bytes.
 *
 * DESENHADO PRA SER LIDO A 18 PIXELS. As referencias tem brilho, contorno e
 * sombra — nesse tamanho tudo isso vira borrao. Sobra a silhueta da cabeca, os
 * dois olhos inclinados, e a palpebra em volta: as tres coisas que fazem
 * alguem reconhecer um alien e um olho ao mesmo tempo.
 *
 * A BARRA DO ESTADO FECHADO tem um risco escuro por baixo, mais grosso. Sem
 * ele a barra some em cima do verde da cabeca, e o icone fica igual nos dois
 * estados — que e o unico jeito de este botao falhar de verdade. */
function iconeOlhoAlien(aberto) {
  /* A ARTE DELE, e nao mais um desenho meu.
   *
   * Medi antes de decidir o tamanho: reduzi a arte pra 21, 28, 34, 40, 48 e 56
   * e olhei. A 21 — o tamanho do botao antigo — o neon e a moldura viram
   * borrao e os dois estados ficam quase iguais. A 40 fica confortavel.
   *
   * O BOTAO PERDEU A BORDA de proposito: a arte ja traz a propria moldura
   * circular, e uma caixinha quadrada em volta dela brigaria com o desenho. */
  return '<img class="olhoAlien" src="' + (aberto ? OLHO_ABERTO : OLHO_FECHADO) +
    '" alt="" width="44" height="44" draggable="false">';
}

function virarPrivado() {
  privado = !privado;
  try { localStorage.setItem(PRIVADO, privado ? "1" : "0"); } catch (e) {}
}

/* Asterisco, escolha dele: "somente os valores ficam ocultados com asteriscos".
 * Quatro, e nao o tamanho do numero — asterisco a mais pra numero maior
 * contaria a ordem de grandeza, que e metade do que ele quer esconder. */
var TAPADO = "****";

function dinheiroMiudo(v, moeda) {
  if (v == null || !isFinite(v)) return "—";
  if (privado) return (moeda === "USD" ? "US$ " : "R$ ") + TAPADO;
  if (Math.abs(v) >= 0.01) return dinheiroNa(v, moeda);
  var sinal = moeda === "USD" ? "US$ " : "R$ ";
  return sinal + v.toFixed(6).replace(".", ",");
}

function dinheiroNa(v, moeda) {
  if (v == null || !isFinite(v)) return "—";
  if (privado) return (moeda === "USD" ? "US$ " : "R$ ") + TAPADO;
  var s = v < 0 ? "-" : "", n = Math.abs(v);
  var sinal = moeda === "USD" ? "US$ " : "R$ ";
  if (n >= 1e6) return s + sinal + (n / 1e6).toFixed(2) + " mi";
  return s + sinal + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function converterV(valor, de, para, taxa) {
  if (valor == null || !isFinite(valor)) return null;
  if (de === para) return valor;
  if (!(taxa > 0)) return null;
  if (de === "USD" && para === "BRL") return valor * taxa;
  if (de === "BRL" && para === "USD") return valor / taxa;
  return null;
}

/* ---------------------------------------------------------------------------
 * AS CINCO CAIXINHAS — a carteira organizada como o método pensa.
 *
 * Pedido dele em 08/09/2026, e é o desenho todo numa frase só:
 *
 *   "os tokens serão adicionados em cada aba dessas letras dependendo do que eu
 *    for lançando [...] na renda passiva posso pôr par de tokens rendendo em uma
 *    pool, talvez tenha como colocar até qual pool estou fazendo em qual
 *    plataforma"
 *
 * Antes disto a carteira era uma lista solta de nomes, e ele estava certo em
 * dizer que ficava confuso: o B.A.R.C.A. não fala de "fatias", fala de cinco
 * caixinhas com nome e função. Agora cada lançamento mora numa delas, e a
 * porcentagem que o método usa é a da CAIXINHA, não a da linha.
 *
 * Três jeitos de lançar, porque ele tem três tipos de coisa:
 *
 *   valor  — reais ou dólares parados. "tenho em caixa 100 dólar."
 *   token  — quantidade de um token, e o preço vem ao vivo. "1,5 ETH."
 *   pool   — uma posição de rendimento, com a plataforma e a pool do radar.
 *
 * A conta é sempre a mesma: cada linha vira um valor na moeda que ele está
 * vendo, as linhas somam por caixinha, e a caixinha vira porcentagem do total.
 * ------------------------------------------------------------------------- */

var CAIXAS = [
  { chave: "base",     letra: "B", nome: "Base sólida",     oQue: "Bitcoin" },
  { chave: "volatil",  letra: "A", nome: "Ativos voláteis", oQue: "altcoins" },
  { chave: "renda",    letra: "R", nome: "Renda passiva",   oQue: "pools, empréstimos, real yield" },
  { chave: "caixa",    letra: "C", nome: "Caixa",           oQue: "stablecoins, reais, dólares" },
  { chave: "aprender", letra: "A", nome: "Aprender",        oQue: "airdrops" },
];

function caixaDe(chave) {
  for (var i = 0; i < CAIXAS.length; i++) if (CAIXAS[i].chave === chave) return CAIXAS[i];
  return null;
}

/* O preço ao vivo dos tokens lançados.
 *
 * Vem de POST /api/precos. A variável precosPedidos guarda a última lista
 * pedida: sem isso, cada redesenho da tela pediria preço de novo, e redesenho
 * acontece a cada tecla. */
var precos = {};
var precosQuando = null;
var precosPedidos = null;
var alvos = null;   // alvo por caixinha, definido por ELE

function precoDoToken(simbolo) {
  var p = precos[String(simbolo || "").toUpperCase()];
  return (p && p.preco > 0) ? p : null;
}

function simbolosDaCarteira() {
  var vistos = {}, fora = [];
  var por = function (bruto) {
    var s = String(bruto || "").trim().toUpperCase();
    if (s && !vistos[s]) { vistos[s] = 1; fora.push(s); }
  };
  (fatias || []).forEach(function (f) { por(f.token); });
  /* O que ele está DIGITANDO no formulário também entra. Sem isto, a prévia
     não sabe dizer quanto vale — e o número que ele mais quer ver na hora de
     lançar é justamente quanto aquilo dá em reais. */
  if (lancando && lancando.tipo === "token") por(lancando.token);
  return fora;
}

async function buscarPrecos() {
  var lista = simbolosDaCarteira();
  var chave = lista.join(",");
  if (!lista.length) { precosPedidos = ""; return false; }
  if (chave === precosPedidos) return false;
  try {
    var r = await fetch("/api/precos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokens: lista }),
    });
    if (!r.ok) return false;
    var d = await r.json();
    juntar(precos, d.tokens);
    precosQuando = d.quando || null;
    // Só agora: marcar antes de saber se deu certo é nunca mais tentar.
    precosPedidos = chave;
    return true;
  } catch (e) {
    return false;
  }
}

/* Quanto vale UMA linha, na moeda que ele está vendo.
 *
 * O preço do token vem em dólar — é a moeda do mercado, não uma escolha minha.
 * Então token vira dólar e o dólar vira o que ele estiver vendo. Duas
 * conversões, mas nenhuma inventada. */
function valorDaLinha(f, moedaAlvo, taxa) {
  /* POSICAO FECHADA VALE ZERO, e isso e um numero, nao uma falha. Sem esta
     linha ela cairia no caminho de "posicao ainda nao lida" e entraria pra
     conta das que ficaram de fora do total — um aviso de erro pra uma coisa
     que deu certo. */
  if (linhaFechada(f)) return { valor: 0, emUSD: 0 };
  /* Posicao concentrada: o valor vem da blockchain, nao do que ele digitou.
     E o unico jeito de o numero estar certo amanha sem ele tocar em nada. */
  if (f.posicao) {
    var pos = posicaoDaLinha(f);
    if (pos) {
      return { valor: converterV(pos.valor, "USD", moedaAlvo, taxa), emUSD: pos.valor, posicao: pos };
    }

    /* NAO CONSEGUI LER — e aqui mora o defeito mais perigoso que este radar
     * pode ter, por isso a queda de braco.
     *
     * A leitura das posicoes depende de um no da Solana. Se a chave expirar ou
     * bater limite, a linha fica sem valor, o TOTAL DA CARTEIRA CAI, e as
     * porcentagens do B.A.R.C.A. se refazem sobre um total errado. Ele abriria
     * o app e veria "Renda passiva 0%" — indistinguivel de ter perdido a pool.
     * Falha de rede com cara de perda de dinheiro.
     *
     * A defesa: a ULTIMA LEITURA BOA. O vigia guarda o valor de cada posicao a
     * cada olhada (posicao_tamanho), e ele volta aqui marcado como velho. O
     * total continua aproximadamente certo, as porcentagens param de mentir, e
     * a linha DIZ que o numero e de antes.
     *
     * Numero velho declarado velho e melhor que numero ausente que parece
     * zero. */
    /* FECHOU: vale zero, e zero aqui é um NÚMERO, não uma falha.
       O dinheiro voltou pra carteira e já está contado lá — continuar mostrando
       o valor velho seria contar a mesma quantia duas vezes no total dele. */
    if (fechouNaPlataforma(f)) return { valor: 0, emUSD: 0, sumiu: true };

    var ultima = f.chave && tamanhos && tamanhos[f.chave];
    var guardado = ultima && Number(ultima.valor);
    if (isFinite(guardado) && guardado > 0) {
      return {
        valor: converterV(guardado, "USD", moedaAlvo, taxa),
        emUSD: guardado,
        deAntes: ultima.visto_em || null,
      };
    }
    return { valor: null, motivo: "lendo a posicao" };
  }
  if (f.token) {
    var p = precoDoToken(f.token);
    var q = Number(f.quantidade);
    if (!p) return { valor: null, motivo: "sem preço de " + String(f.token).toUpperCase() };
    if (f.quantidade == null || f.quantidade === "" || !isFinite(q)) return { valor: null };
    var emUSD = q * p.preco;
    return { valor: converterV(emUSD, "USD", moedaAlvo, taxa), emUSD: emUSD, preco: p };
  }
  var v = Number(f.valor);
  if (f.valor == null || f.valor === "" || !isFinite(v)) return { valor: null };
  return { valor: converterV(v, f.moeda || moedaAlvo, moedaAlvo, taxa) };
}

function temLancamento(f) {
  if (f.posicao) return true;
  return f.token
    ? (f.quantidade != null && f.quantidade !== "")
    : (f.valor != null && f.valor !== "");
}

function contasDaCarteira() {
  var taxa = cotacao();
  var total = 0, forisc = 0;

  var linhas = (fatias || []).map(function (f) {
    var r = valorDaLinha(f, moedaVista, taxa);
    if (r.valor == null && temLancamento(f)) forisc++;
    if (r.valor != null) total += r.valor;
    return { f: f, convertido: r.valor, emUSD: r.emUSD || null, preco: r.preco || null,
             posicao: r.posicao || null, motivo: r.motivo || null,
             deAntes: r.deAntes === undefined ? null : r.deAntes };
  });

  linhas.forEach(function (l) {
    l.pct = (l.convertido == null || !(total > 0)) ? null : (l.convertido / total) * 100;
  });

  /* A soma por caixinha. "sem" é a caixinha dos que ainda não têm caixinha —
     as linhas que ele lançou antes desta tela existir. Não some com elas: some
     com o lançamento de alguém é imperdoável. */
  var porCaixa = { sem: { total: 0, pct: null, linhas: [] } };
  CAIXAS.forEach(function (c) { porCaixa[c.chave] = { total: 0, pct: null, linhas: [] }; });

  linhas.forEach(function (l) {
    var k = porCaixa[l.f.caixa] ? l.f.caixa : "sem";
    porCaixa[k].linhas.push(l);
    if (l.convertido != null) porCaixa[k].total += l.convertido;
  });

  Object.keys(porCaixa).forEach(function (k) {
    porCaixa[k].pct = total > 0 ? (porCaixa[k].total / total) * 100 : null;
  });

  return { linhas: linhas, total: total, foraDaConta: forisc, taxa: taxa, porCaixa: porCaixa };
}

/* ---------------------------------------------------------------------------
 * O RESUMO — a sub-aba de OLHAR, dentro da Carteira.
 *
 * Pedido dele em 08/09/2026: "rankear meus tokens por quantidade ou %... um
 * gráfico em formato de pizza com legendas mostrando como se encontra meu
 * portfólio hoje em dia".
 *
 * A frase que decidiu o conteúdo veio junto, e é a melhor coisa que ele disse
 * sobre esta tela: "hoje você só faz resumo do que está no radar, ou seja, as
 * melhores — mas de tokens específicos como os que eu coloco na carteira, não
 * faz. Nem é sobre as pools ou empréstimos que estão na minha carteira, isso eu
 * vejo por lá mesmo".
 *
 * Ou seja: o valor e o rendimento das posições ele lê na Orca e na Kamino. O
 * que ninguém mostra pra ele é o CHÃO embaixo do dinheiro dele — a saúde da
 * rede e do protocolo onde ele está —, e isso o radar mede todo dia e joga
 * fora, porque só olha "as melhores".
 *
 * SUB-ABA, não aba nova: escolha dele. A Carteira de cima é de EDITAR (campos,
 * salvar, lançar); esta é de OLHAR. Separadas, ele abre o resumo sem risco de
 * esbarrar num campo.
 *
 * A REGRA DE SEMPRE VALE AQUI TAMBÉM, e aqui é onde ela mais tenta escapar:
 * nada nesta tela manda fazer nada. "Solana: 0,6% do rendimento é alugado" é
 * fato. "Saia da Solana" seria palpite sobre um futuro que ninguém tem.
 * ------------------------------------------------------------------------ */

var subAbaCarteira = (function () {
  try { return localStorage.getItem("radar:subaba") === "resumo" ? "resumo" : "editar"; }
  catch (e) { return "editar"; }
})();

function irParaSubAba(qual) {
  subAbaCarteira = qual === "resumo" ? "resumo" : "editar";
  try { localStorage.setItem("radar:subaba", subAbaCarteira); } catch (e) {}
  desenhar();
  /* O chão só é buscado quando o resumo aparece — quem nunca abre esta sub-aba
     não paga uma chamada de rede por causa dela. E buscarChao se cala quando a
     pergunta é a mesma da anterior, então trocar de sub-aba dez vezes não vira
     dez chamadas. */
  if (subAbaCarteira === "resumo") {
    buscarChao().then(function (veio) { if (veio && aba === "carteira") desenhar(); });
  }
}

var CORTES = [
  { chave: "caixa", nome: "por caixinha" },
  { chave: "token", nome: "por token" },
  { chave: "onde",  nome: "por onde está" },
];

var corteDaPizza = (function () {
  try {
    var g = localStorage.getItem("radar:corte");
    for (var i = 0; i < CORTES.length; i++) if (CORTES[i].chave === g) return g;
  } catch (e) {}
  return "caixa";
})();

/* Onde o dinheiro está POUSADO — e este corte é o que não existe em lugar
 * nenhum hoje. Ele responde "se a Kamino tiver um problema amanhã, o que
 * exatamente está lá dentro", que nenhuma tela da Kamino vai responder.
 *
 * "Fora de cadeia" não é sobra: as duas reservas dele em real não correm risco
 * de plataforma nenhum, e isso é uma informação, não uma ausência. */
function ondeEsta(f) {
  if (f.posicao) {
    var onde = String(f.onde || "").trim();
    if (!onde) return "posição on-chain";
    return onde.charAt(0).toUpperCase() + onde.slice(1);
  }
  if (podeSeguir(f)) return "solto na carteira";
  if (f.token) return "fora da carteira";
  return "fora de cadeia";
}

function nomeDoPedaco(f, corte) {
  if (corte === "caixa") {
    var c = caixaDe(f.caixa);
    return c ? c.nome : "sem caixinha";
  }
  if (corte === "token") {
    if (f.token) return String(f.token).toUpperCase();
    if (f.posicao) return f.fatia || "posição";
    if (f.moeda === "BRL") return "reais";
    if (f.moeda === "USD") return "dólares";
    return f.fatia || "outros";
  }
  return ondeEsta(f);
}

/* Os pedaços da pizza, já somados e ordenados do maior pro menor.
 *
 * Linha sem valor lido fica DE FORA e é contada à parte: entrar como zero
 * encolheria a fatia de todo mundo e a pizza mentiria calada. */
function pedacosDoPortfolio(c, corte) {
  var por = {}, ordem = [], total = 0, foraDaConta = 0;
  (c.linhas || []).forEach(function (l) {
    if (l.convertido == null) { if (temLancamento(l.f)) foraDaConta++; return; }
    if (!(l.convertido > 0)) return;
    var nome = nomeDoPedaco(l.f, corte);
    if (!por[nome]) { por[nome] = { nome: nome, valor: 0, quantas: 0, linhas: [] }; ordem.push(nome); }
    por[nome].valor += l.convertido;
    por[nome].quantas++;
    por[nome].linhas.push(l);
    total += l.convertido;
  });
  var fora = ordem.map(function (n) { return por[n]; });
  fora.forEach(function (p) { p.pct = total > 0 ? (p.valor / total) * 100 : 0; });
  fora.sort(function (a, b) { return b.valor - a.valor; });
  return { pedacos: fora, total: total, foraDaConta: foraDaConta };
}

/* Cores fixas por posição na lista. Doze passos de matiz, saltando de 137 em
 * 137 graus para que vizinhos nunca fiquem parecidos — a legenda é o que liga
 * cor a nome, então cor repetida perto é legenda inútil. */
function corDoPedaco(i) {
  return "hsl(" + ((i * 137) % 360) + " 62% 58%)";
}

function pedacoDaRosca(inicio, fim, raio, buraco) {
  var meio = 100;
  var x1 = meio + raio * Math.cos(inicio), y1 = meio + raio * Math.sin(inicio);
  var x2 = meio + raio * Math.cos(fim), y2 = meio + raio * Math.sin(fim);
  var x3 = meio + buraco * Math.cos(fim), y3 = meio + buraco * Math.sin(fim);
  var x4 = meio + buraco * Math.cos(inicio), y4 = meio + buraco * Math.sin(inicio);
  var grande = (fim - inicio) > Math.PI ? 1 : 0;
  return "M " + x1.toFixed(2) + " " + y1.toFixed(2) +
    " A " + raio + " " + raio + " 0 " + grande + " 1 " + x2.toFixed(2) + " " + y2.toFixed(2) +
    " L " + x3.toFixed(2) + " " + y3.toFixed(2) +
    " A " + buraco + " " + buraco + " 0 " + grande + " 0 " + x4.toFixed(2) + " " + y4.toFixed(2) +
    " Z";
}

/* A pizza. Rosca, na verdade — o buraco no meio cabe o total, e ler o total no
 * centro é mais rápido do que procurar embaixo. */
function desenhoDaPizza(pedacos) {
  if (!pedacos.length) return "";
  var soma = 0;
  pedacos.forEach(function (p) { soma += p.valor; });
  if (!(soma > 0)) return "";

  /* Uma fatia só = círculo inteiro. O arco de 360 graus tem começo igual ao
     fim e o navegador não desenha nada — some a pizza inteira sem erro. */
  if (pedacos.length === 1) {
    return '<circle cx="100" cy="100" r="76" fill="none" stroke="' + corDoPedaco(0) +
      '" stroke-width="28"></circle>';
  }

  var ang = -Math.PI / 2;
  return pedacos.map(function (p, i) {
    var passo = (p.valor / soma) * Math.PI * 2;
    var d = pedacoDaRosca(ang, ang + passo, 90, 62);
    ang += passo;
    return '<path d="' + d + '" fill="' + corDoPedaco(i) + '"></path>';
  }).join("");
}

function blocoDaPizza(c) {
  var r = pedacosDoPortfolio(c, corteDaPizza);
  if (!r.pedacos.length) {
    return '<div class="resumoCaixa"><div class="impCabeca">Como está o seu portfólio</div>' +
      '<div class="lcDica">Ainda não há valor lido em nenhuma linha.</div></div>';
  }

  var botoes = CORTES.map(function (o) {
    return '<button class="botao fraco btCorte' + (o.chave === corteDaPizza ? " escolhido" : "") +
      '" data-corte="' + o.chave + '">' + esc(o.nome) + '</button>';
  }).join("");

  var legenda = r.pedacos.map(function (p, i) {
    return '<div class="legLinha">' +
      '<span class="legCor" style="background:' + corDoPedaco(i) + '"></span>' +
      '<span class="legNome">' + esc(p.nome) + '</span>' +
      '<span class="legPct">' + (p.pct).toFixed(1) + '%</span>' +
      '<span class="legVal">' + esc(dinheiroNa(p.valor, moedaVista)) + '</span>' +
    '</div>';
  }).join("");

  return '<div class="resumoCaixa">' +
    '<div class="impCabeca">Como está o seu portfólio</div>' +
    '<div class="cortes">' + botoes + '</div>' +
    '<div class="pizzaEnvolta">' +
      '<svg viewBox="0 0 200 200" class="pizza" role="img" aria-label="divisão do portfólio">' +
        desenhoDaPizza(r.pedacos) +
        '<text x="100" y="97" class="pzTotal">' + esc(dinheiroNa(r.total, moedaVista)) + '</text>' +
        '<text x="100" y="113" class="pzSub">' + r.pedacos.length + ' pedaço(s)</text>' +
      '</svg>' +
      '<div class="legenda">' + legenda + '</div>' +
    '</div>' +
    (r.foraDaConta
      ? '<div class="lcDica">' + r.foraDaConta + ' linha(s) sem valor lido ficaram de fora da conta — ' +
        'entrar como zero encolheria todas as outras fatias.</div>'
      : "") +
  '</div>';
}

/* O ranking.
 *
 * ORDENADO POR % DO TOTAL, e a ressalva ficou escrita porque ele perguntou por
 * quantidade: 0,0731945 BTC ao lado de 418,90 USDC não se comparam — o número
 * maior é justamente o pedaço menor. A quantidade aparece do lado, sem sumir. */
function blocoDoRanking(c) {
  var linhas = (c.linhas || []).filter(function (l) {
    return l.convertido != null && l.convertido > 0;
  }).slice().sort(function (a, b) { return b.convertido - a.convertido; });

  if (!linhas.length) return "";

  return '<div class="resumoCaixa">' +
    '<div class="impCabeca">Suas linhas, da maior para a menor</div>' +
    linhas.map(function (l) {
      var f = l.f;
      var quanto = f.token && f.quantidade != null && f.quantidade !== ""
        ? numeroDeToken(Number(f.quantidade)) + " " + String(f.token).toUpperCase()
        : "";
      var cx = caixaDe(f.caixa);
      return '<div class="rkLinha">' +
        '<div class="rkBarra"><span style="width:' + Math.max(1, Math.min(100, l.pct || 0)) + '%"></span></div>' +
        '<div class="rkTexto">' +
          '<b>' + esc(f.fatia || (f.token || "linha")) + '</b>' +
          '<span class="rkPct">' + (l.pct || 0).toFixed(1) + '%</span>' +
        '</div>' +
        '<div class="rkNota">' + esc(dinheiroNa(l.convertido, moedaVista)) +
          (quanto ? ' · ' + esc(quanto) : "") +
          (cx ? ' · ' + esc(cx.nome) : "") +
          (l.deAntes ? ' · leitura de antes' : "") +
        '</div>' +
      '</div>';
    }).join("") +
  '</div>';
}

/* O resumo só aparece quando ele o escolheu E há carteira. Uma função só,
 * porque a tela pergunta isso em dois lugares e duas condições parecidas que
 * divergem é como uma metade da tela discorda da outra. */
/* O aviso do token repetido. Fica ACIMA das sub-abas de propósito: o total
 * dobrado estraga tanto a tela de editar quanto a pizza do resumo, então ele
 * não pode morar dentro de uma das duas. */
function avisoDeTokenRepetido() {
  var r = tokensRepetidos(fatias);
  if (!r.length) return "";
  return r.map(function (x) {
    var nomes = x.linhas.map(function (f) {
      return '"' + esc(f.fatia || x.token || "sem nome") + '"';
    }).join(" e ");
    var quantas = x.linhas.length;
    return '<div class="recadoConta ruim">' +
      '<b>' + esc(String(x.token || "Esse token").toUpperCase()) + ' está em ' + quantas +
      ' linhas que seguem a carteira</b> (' + nomes + ').' +
      ' Cada uma recebe o saldo inteiro, então o seu total está aparecendo ' + quantas +
      'x maior do que é — a carteira tem um número só desse token e não sabe que você' +
      ' quis dividir.' +
      ' Para separar, uma das linhas precisa ficar no cadeado 🔒, com a quantidade' +
      ' digitada por você, e a outra continua seguindo.' +
    '</div>';
  }).join("");
}

function mostrandoResumo() {
  return subAbaCarteira === "resumo" && !!(fatias || []).length;
}

/* ---------------------------------------------------------------------------
 * OS TRÊS BLOCOS DE FATO: o ciclo, a rede e os protocolos.
 *
 * A frase dele que decidiu isto: "esquece notícias e vamos usar fatos". E, sobre
 * o BTC: "o importante mesmo é sobre ciclo, porque ele que puxa todo o mercado
 * — caso ele inicie um bull de alta, o mercado todo vem com ele".
 *
 * Tudo aqui é número medido, com o dia da medida escrito. Nenhuma frase manda
 * fazer nada — e esta é a tela onde essa regra mais tenta escapar, porque
 * "Kamino perdeu 2,4% na semana" pede um verbo no fim da frase. Não tem.
 * ------------------------------------------------------------------------ */

var chao = null;          // o que veio de /api/chao
var chaoPedido = null;    // a última pergunta, pra não repetir a cada tecla

/* Hoje o app lê carteira de Solana e mais nada — a tabela se chama
 * carteira_solana. Então posição on-chain e token com mint são Solana, e isto
 * fica escrito em vez de virar uma dedução esperta que ninguém revisa quando
 * chegar a segunda rede. */
function redesDaCarteira(linhas) {
  var tem = (linhas || []).some(function (f) {
    return !linhaFechada(f) && (f.posicao || f.mint);
  });
  return tem ? ["Solana"] : [];
}

/* O nome do protocolo, como o DefiLlama chama.
 *
 * Ele escreve "Kamino · SOL/BTC Market"; lá é "Kamino Lend". Fico com a
 * primeira palavra e deixo o servidor casar por prefixo — inventar uma tabela
 * de tradução aqui seria uma lista que envelhece sem ninguém perceber. */
function protocolosDaCarteira(linhas) {
  var vistos = {}, fora = [];
  (linhas || []).forEach(function (f) {
    if (linhaFechada(f)) return;
    var onde = String(f.onde || "").split("·")[0].trim();
    if (!onde) return;
    var chave = onde.toLowerCase();
    if (vistos[chave]) return;
    vistos[chave] = 1;
    fora.push(onde);
  });
  return fora;
}

async function buscarChao() {
  var redes = redesDaCarteira(fatias);
  var protos = protocolosDaCarteira(fatias);
  if (!redes.length && !protos.length) return false;

  var pergunta = redes.join(",") + "|" + protos.join(",");
  if (pergunta === chaoPedido) return false;
  chaoPedido = pergunta;

  try {
    var r = await fetch("/api/chao?redes=" + encodeURIComponent(redes.join(",")) +
      "&protocolos=" + encodeURIComponent(protos.join(",")));
    if (!r.ok) return false;
    chao = await r.json();
    return true;
  } catch (e) { return false; }
}

var umPct = function (v) {
  if (v == null || !isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + Number(v).toFixed(1) + "%";
};
var classeDoSinal = function (v) {
  if (v == null || !isFinite(v)) return "";
  return v > 0 ? "sobe" : (v < 0 ? "desce" : "");
};
var grande = function (v) {
  var n = Number(v || 0);
  if (n >= 1e9) return "US$ " + (n / 1e9).toFixed(2) + " bi";
  if (n >= 1e6) return "US$ " + (n / 1e6).toFixed(1) + " mi";
  return "US$ " + Math.round(n).toLocaleString("pt-BR");
};

/* O CICLO, e a posição DELE dentro dele.
 *
 * As duas metades juntas são o ponto: o mercado numa linha, o dinheiro dele na
 * seguinte. Separadas, cada uma já existia em algum lugar; juntas, não existiam
 * em lugar nenhum. */
function blocoDoCiclo() {
  var c = dados && dados.ciclo;
  var l = c && c.leitura;
  if (!c || !l || !l.preco) return "";

  var hoje = precoDoBtcAgora(l) || l.preco.hoje;
  var media = l.preco.media;

  /* O preço médio DELE, das linhas de BTC. Vem dos lançamentos, e é o mesmo
     número que o vigia usa pra avisar quando cruza. */
  var meu = null;
  (fatias || []).forEach(function (f) {
    if (meu || String(f.token || "").toUpperCase() !== "BTC") return;
    var pm = precoMedioDoToken(movsDaLinha(f.chave), f.quantidade);
    if (pm && pm.medio > 0) meu = pm;
  });

  var distMedia = (hoje > 0 && media > 0) ? ((hoje / media) - 1) * 100 : null;
  var distMeu = (meu && hoje > 0) ? ((hoje / meu.medio) - 1) * 100 : null;

  return '<div class="resumoCaixa">' +
    '<div class="impCabeca">O ciclo, e você dentro dele</div>' +
    '<div class="lcDica">Ele puxa o mercado inteiro — por isso está aqui, e não o tamanho ' +
      'da rede Bitcoin, que não tem nada a ver com o BTC que você guarda.</div>' +

    '<div class="fatoLinha"><span>Ciclo medido</span><b>' + esc(c.ciclo || "—") + '</b></div>' +
    (l.firmeza ? '<div class="fatoNota">' + esc(l.firmeza) + '</div>' : "") +

    '<div class="fatoLinha"><span>Bitcoin agora</span><b>' +
      (hoje > 0 ? esc(dinheiroNa(hoje, "USD")) : "—") + '</b></div>' +
    (media > 0
      ? '<div class="fatoLinha"><span>Média de 200 dias</span><b class="' + classeDoSinal(distMedia) + '">' +
        esc(dinheiroNa(media, "USD")) + ' · ' + umPct(distMedia) + '</b></div>'
      : "") +
    (l.capital && l.capital.texto
      ? '<div class="fatoNota">' + esc(l.capital.texto) + '</div>' : "") +

    (meu
      ? '<div class="fatoSeu">' +
          '<div class="fatoLinha"><span>Seu preço médio</span><b>' +
            esc(dinheiroNa(meu.medio, "USD")) + '</b></div>' +
          '<div class="fatoLinha"><span>Onde você está</span><b class="' + classeDoSinal(distMeu) + '">' +
            umPct(distMeu) + ' do que você pagou</b></div>' +
        '</div>'
      : '<div class="fatoNota">Seu preço médio aparece aqui assim que houver aportes de BTC lançados.</div>') +

    '<div class="fatoQuando">medido em ' + esc(c.medidoEm || (dados && dados.dia) || "—") + '</div>' +
  '</div>';
}

/* A REDE onde o dinheiro dele mora. */
function blocoDaRede() {
  var lista = (chao && chao.redes) || [];
  if (!lista.length) return "";

  return lista.map(function (r) {
    var q = r.qualidade;
    return '<div class="resumoCaixa">' +
      '<div class="impCabeca">A rede onde seu dinheiro mora — ' + esc(r.rede) + '</div>' +
      '<div class="lcDica">O radar mede isto todo dia, mas só mostra as redes que se mexeram. ' +
        'A sua aparece aqui mesmo quando está parada.</div>' +

      '<div class="fatoLinha"><span>Dinheiro parado na rede</span><b>' + grande(r.tvl) + '</b></div>' +
      '<div class="fatoLinha"><span>Na semana</span><b class="' + classeDoSinal(r.var7d) + '">' +
        umPct(r.var7d) + '</b></div>' +
      '<div class="fatoLinha"><span>No mês</span><b class="' + classeDoSinal(r.var30d) + '">' +
        umPct(r.var30d) + '</b></div>' +
      '<div class="fatoLinha"><span>Stablecoins circulando</span><b>' + grande(r.stables) +
        ' · ' + umPct(r.varStables7d) + ' na semana</b></div>' +

      (q ? (
        (q.alugado != null
          ? '<div class="fatoLinha"><span>Vem de incentivo</span><b>' +
            Number(q.alugado).toFixed(1) + '%</b></div>' +
            '<div class="fatoNota">A fatia do rendimento da rede que vem de incentivos, e não ' +
            'de taxas. Incentivo tem prazo; taxa é o que a rede arrecada de quem usa. Quanto ' +
            'menor esta fatia, mais o rendimento se sustenta sozinho.</div>'
          : "") +
        (q.concentracao != null
          ? '<div class="fatoLinha"><span>Concentração</span><b>' +
            Number(q.concentracao).toFixed(1) + '% no maior</b></div>' +
            '<div class="fatoNota">' + esc(q.maiorProtocolo || "o maior protocolo") +
            ' guarda essa fatia do dinheiro da rede. Quanto menor, menos a rede depende de um só.</div>'
          : "")
      ) : "") +

      '<div class="fatoQuando">medido em ' + esc((chao && chao.dia) || "—") + '</div>' +
    '</div>';
  }).join("");
}

/* OS PROTOCOLOS onde ele está.
 *
 * O valor e o rendimento da posição dele ele lê na Orca e na Kamino — foi ele
 * quem disse, e tem razão. O que a tela deles não mostra é se o protocolo está
 * enchendo ou esvaziando, e é só isso que este bloco traz. */
function blocoDosProtocolos() {
  var lista = (chao && chao.protocolos) || [];
  if (!lista.length) return "";

  var deltaDe = function (hoje, antes) {
    return (antes > 0) ? ((hoje / antes) - 1) * 100 : null;
  };

  return '<div class="resumoCaixa">' +
    '<div class="impCabeca">Os protocolos onde você está</div>' +
    '<div class="lcDica">Quanto você tem lá dentro você vê na tela deles. O que eles não te ' +
      'mostram é se o dinheiro dos outros está entrando ou saindo.</div>' +
    lista.map(function (p) {
      return '<div class="protoLinha">' +
        '<div class="protoTopo"><b>' + esc(p.protocolo) + '</b>' +
          '<span class="protoCat">' + esc(p.categoria || "") + '</span></div>' +
        '<div class="protoNums">' +
          '<span>' + grande(p.tvl) + '</span>' +
          '<span class="' + classeDoSinal(deltaDe(p.tvl, p.tvl_7d)) + '">' +
            umPct(deltaDe(p.tvl, p.tvl_7d)) + ' na semana</span>' +
          '<span class="' + classeDoSinal(deltaDe(p.tvl, p.tvl_30d)) + '">' +
            umPct(deltaDe(p.tvl, p.tvl_30d)) + ' no mês</span>' +
        '</div>' +
      '</div>';
    }).join("") +
    '<div class="fatoQuando">medido em ' + esc((chao && chao.diaDosProtocolos) || "—") + '</div>' +
  '</div>';
}

function telaDoResumo(c) {
  return blocoDaPizza(c) + blocoDoRanking(c) +
    blocoDoCiclo() + blocoDaRede() + blocoDosProtocolos();
}

/* ---------------------------------------------------------------------------
 * SOMAR, TIRAR E MOVER — o rebalanceamento feito à mão.
 *
 * Pedido dele em 08/09/2026, e é o método B.A.R.C.A. em movimento:
 *
 *   "tenho além desses BTCs, mais 300 reais para lançar, mas aí eu compro 100
 *    dólares em BTC por outra plataforma, eu deveria conseguir lançar também e
 *    lá converteria"
 *
 *   "remover também será necessário, pois dependendo do ciclo vou poder fazer
 *    uma rotação, tirar de caixa, pôr mais em altcoins"
 *
 * Três regras, e as três existem por um motivo:
 *
 * 1. O aporte entra na MOEDA QUE ELE ESCOLHER. Comprou em dólar, lança em
 *    dólar; separou reais, lança em reais.
 *
 * 2. Mas a fatia continua guardada na moeda em que foi lançada. Um BTC lançado
 *    em dólar que recebe R$ 300 vira dólar + o equivalente em dólar. Se eu
 *    congelasse o valor em real, a cotação de amanhã mudaria o passado dele.
 *
 * 3. Tirar mais do que existe é recusado, não aparado em silêncio. Um número
 *    que se conserta sozinho é um número em que ninguém repara que errou.
 *
 * O radar faz a conta e mostra. Quanto mover, e de onde para onde, é dele.
 * ------------------------------------------------------------------------- */

var SEM_COTACAO = "Não tenho a cotação do dólar agora, então não consigo converter. Lance na mesma moeda da fatia.";

function arred(v) { return Math.round(v * 100) / 100; }

/* O CUSTO DE UMA POSICAO GUARDA MAIS CASAS QUE DINHEIRO DE BOLSO.
 *
 * O arredondamento comum corta em centavos, e esta certo pro que ele digita: ninguem lanca
 * R$ 1.670,4823 de reserva. Mas o valor de entrada de uma posicao vem lido da
 * cadeia, e cortar US$ 9,9236 em US$ 9,92 planta um erro de 0,4 centavo que
 * depois reaparece como lucro ou prejuizo que nunca existiu — numa posicao de
 * dez dolares isso e 0,04%, e a tela mostra vermelho por nada. */
function arredFino(v) { return Math.round(v * 1e6) / 1e6; }

/* Acha pela ORDEM, não pela posição na lista.
 *
 * Hoje ordem e posição coincidem — renumerar() garante isso a cada mudança —
 * mas a busca continua sendo pela ordem de propósito: se um dia elas voltarem
 * a divergir, isto acerta a linha certa em vez de errar em silêncio. Somar
 * dinheiro na linha errada é o pior erro que este painel pode cometer. */
function acharPorOrdem(lista, ordem) {
  for (var k = 0; k < lista.length; k++) if (lista[k].ordem === ordem) return lista[k];
  return null;
}

function valorDe(f) {
  return (f.valor == null || f.valor === "") ? null : Number(f.valor);
}

function somarEm(f, quanto, moeda, taxa) {
  var atual = valorDe(f);
  if (atual == null) {
    f.valor = arred(quanto);
    f.moeda = moeda;
    return { texto: "ficou com " + dinheiroNa(f.valor, moeda) + "." };
  }
  var m = f.moeda || moeda;
  var v = converterV(quanto, moeda, m, taxa);
  if (v == null) return { erro: SEM_COTACAO };
  f.valor = arred(atual + v);
  f.moeda = m;
  return {
    texto: dinheiroNa(atual, m) + " + " + dinheiroNa(quanto, moeda) +
      (moeda === m ? "" : " (= " + dinheiroNa(v, m) + ")") +
      " = " + dinheiroNa(f.valor, m) + ".",
  };
}

function tirarDe(f, quanto, moeda, taxa) {
  var atual = valorDe(f);
  if (!(atual > 0)) return { erro: "A fatia " + f.fatia + " está zerada — não há o que tirar." };
  var m = f.moeda || moeda;
  var v = converterV(quanto, moeda, m, taxa);
  if (v == null) return { erro: SEM_COTACAO };
  if (v > atual + 0.005) {
    return { erro: "Em " + f.fatia + " você tem " + dinheiroNa(atual, m) +
      " e está tirando " + dinheiroNa(quanto, moeda) +
      (moeda === m ? "" : " (= " + dinheiroNa(v, m) + ")") +
      ". Não dá pra tirar mais do que tem." };
  }
  f.valor = arred(Math.max(0, atual - v));
  f.moeda = m;
  return {
    texto: dinheiroNa(atual, m) + " − " + dinheiroNa(quanto, moeda) +
      (moeda === m ? "" : " (= " + dinheiroNa(v, m) + ")") +
      " = " + dinheiroNa(f.valor, m) + ".",
  };
}

function mexerNaCarteira(lista, tipo, ordemOrigem, ordemDestino, quanto, moeda, taxa) {
  var f = acharPorOrdem(lista, ordemOrigem);
  if (!f) return { erro: "Dê um nome à fatia antes de lançar valor nela." };
  if (!(quanto > 0)) return { erro: "Escreva quanto, em número maior que zero." };

  if (tipo === "somar") {
    var s = somarEm(f, quanto, moeda, taxa);
    return s.erro ? s : { texto: f.fatia + ": " + s.texto };
  }
  if (tipo === "tirar") {
    var t = tirarDe(f, quanto, moeda, taxa);
    return t.erro ? t : { texto: f.fatia + ": " + t.texto };
  }

  var d = acharPorOrdem(lista, ordemDestino);
  if (!d) return { erro: "Escolha para onde mover." };
  if (d === f) return { erro: "Origem e destino são a mesma fatia." };

  var saiu = tirarDe(f, quanto, moeda, taxa);
  if (saiu.erro) return saiu;
  var entrou = somarEm(d, quanto, moeda, taxa);
  if (entrou.erro) {
    // Desfaz: a rotação é uma coisa só, não pode sair de um lado e não entrar no outro.
    somarEm(f, quanto, moeda, taxa);
    return entrou;
  }
  return {
    texto: "Movi " + dinheiroNa(quanto, moeda) + " de " + f.fatia + " para " + d.fatia +
      ". " + f.fatia + " " + saiu.texto + " " + d.fatia + " " + entrou.texto,
  };
}

/* ---------------------------------------------------------------------------
 * TOKEN SE CONTA EM UNIDADE, NÃO EM DINHEIRO.
 *
 * Se ele comprou 0,3 ETH, o que ele sabe é "0,3 ETH" — não "R$ 3.800". O preço
 * muda amanhã; a quantidade não. Guardar a quantidade e multiplicar pelo preço
 * do dia é o que faz a carteira se atualizar sozinha, que foi o pedido.
 *
 * Oito casas porque é onde o Bitcoin para (um satoshi). Abaixo disso não existe
 * unidade pra contar.
 * ------------------------------------------------------------------------- */

function arredQtd(v) { return Math.round(v * 1e8) / 1e8; }

function numeroDeToken(v) {
  if (v == null || !isFinite(v)) return "—";
  if (privado) return TAPADO;
  return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

function mexerNaQuantidade(lista, tipo, ordem, quanto) {
  var f = acharPorOrdem(lista, ordem);
  if (!f) return { erro: "Escreva o símbolo do token antes de somar ou tirar." };
  if (!(quanto > 0)) return { erro: "Escreva quantos, em número maior que zero." };

  var atual = (f.quantidade == null || f.quantidade === "") ? 0 : Number(f.quantidade);
  var nome = String(f.token || "token").toUpperCase();

  if (tipo === "somar") {
    f.quantidade = arredQtd(atual + quanto);
    return { texto: nome + ": " + numeroDeToken(atual) + " + " + numeroDeToken(quanto) +
      " = " + numeroDeToken(f.quantidade) + "." };
  }
  if (tipo === "mover") {
    return { erro: "Mover é entre caixinhas de valor. Pra trocar de token, tire de um e some no outro." };
  }
  if (quanto > atual + 1e-12) {
    return { erro: "Você tem " + numeroDeToken(atual) + " " + nome +
      "; não dá pra tirar " + numeroDeToken(quanto) + "." };
  }
  f.quantidade = arredQtd(atual - quanto);
  return { texto: nome + ": " + numeroDeToken(atual) + " − " + numeroDeToken(quanto) +
    " = " + numeroDeToken(f.quantidade) + "." };
}

/* O painel escondido de cada linha. Um só controle para os três movimentos,
   porque no fundo são o mesmo: um valor mudando de lugar. */
function painelDeMexer(ordem, tipo) {
  if (tipo === "token") {
    return '<div class="mexer" hidden>' +
      '<input class="mVal" type="number" min="0" step="any" inputmode="decimal" placeholder="quantos">' +
      '<button class="botao fraco mPor">+ comprei</button>' +
      '<button class="botao fraco mTira">− vendi</button>' +
      '<span class="mSeta">em unidade do token, não em dinheiro</span>' +
    '</div>';
  }

  /* Os destinos são as outras linhas de VALOR, com a letra da caixinha junto —
     mover é o rebalanceamento do método, e ele precisa ver para qual caixinha
     o dinheiro está indo, não só para qual nome. */
  var destinos = (fatias || []).map(function (f, j) {
    if (j === ordem || f.token || !linhaTemConteudo(f)) return "";
    var cx = caixaDe(f.caixa);
    return '<option value="' + j + '">' + esc((cx ? cx.letra + " · " : "") + f.fatia) + '</option>';
  }).join("");

  return '<div class="mexer" hidden>' +
    '<input class="mVal" type="number" min="0" step="0.01" inputmode="decimal" placeholder="quanto">' +
    '<span class="mMoedas">' +
      '<button class="mBt2' + (moedaVista === "BRL" ? " ativo" : "") + '" data-m="BRL">R$</button>' +
      '<button class="mBt2' + (moedaVista === "USD" ? " ativo" : "") + '" data-m="USD">US$</button>' +
    '</span>' +
    '<button class="botao fraco mPor">+ somar aqui</button>' +
    '<button class="botao fraco mTira">− tirar daqui</button>' +
    (destinos
      ? '<span class="mSeta">ou mover para</span>' +
        '<select class="mDest">' + destinos + '</select>' +
        '<button class="botao fraco mMove">mover</button>'
      : "") +
  '</div>';
}

/* A referência do B.A.R.C.A., que muda com o ciclo.
 *
 * A regra de escrita desta parte vale mais que qualquer número: o próprio autor
 * do método recusa prescrever — "não é para você copiar, não é para você
 * engessar o que está aqui; as alocações VOCÊ que vai definir". Então o ALVO é
 * dele, digitado por ele, e a referência aparece ao lado com a procedência
 * escrita — e um botão que ele aperta se quiser.
 */
function refDoBarca() {
  return (dados && dados.barca) || null;
}

function referenciaDaCaixa(chave) {
  var b = refDoBarca();
  if (!b || !b.referencia) return null;
  for (var i = 0; i < b.referencia.length; i++) {
    if (b.referencia[i].chave === chave) return b.referencia[i];
  }
  return null;
}

/* O que a carteira está dizendo — agora por CAIXINHA, que é como o método pede.
 *
 *   "Se a minha parcela de caixa foi de 20% para 25%, as altcoins derreteram.
 *    Pego o 5% de caixa, compro altcoins pra voltar aos 20%."
 *
 * Só aparece onde ELE definiu alvo. Sem alvo dele não há do que se afastar, e
 * usar a referência como alvo seria decidir por ele. */
/* QUANTO FALTA EM DINHEIRO, e nao em pontos percentuais.
 *
 * Pedido dele em 09/09/2026: "seria bom saber quanto exatamente preciso em
 * valores para chegar na % que ainda falta, ai sei quanto preciso por em cada
 * posicao em relacao de quanto tenho em dolar/reais".
 *
 * Ele esta certo e o motivo e pratico: "24 pontos abaixo" nao se transfere. Ele
 * nao move pontos entre caixinhas, move dinheiro — e converter de cabeca, na
 * moeda que ele esta filtrando, e trabalho que a ferramenta existe pra poupar.
 *
 * A CONTA E DE REMANEJAMENTO: quanto falta pra chegar no alvo mexendo no que
 * ele JA TEM. E ela fecha sozinha — como os alvos dele somam 100%, a soma das
 * sobras e igual a soma das faltas, ate o centavo. O dinheiro que sai de uma
 * caixinha e exatamente o que entra na outra.
 *
 * Positivo e falta, negativo e sobra. Devolve null quando nao da pra saber —
 * sem total nao ha porcentagem que signifique dinheiro. */
/* QUANTO PODE ESTAR LONGE E AINDA SER "NO ALVO".
 *
 * Cinco pontos e uma regua grossa demais pra alvo pequeno. Ele viu na tela
 * "Ativos volateis · alvo 5% · no alvo" estando em 0,8% — faltavam 84% do
 * caminho. Cinco pontos sao pouco pra quem mira 60% e sao quase tudo pra quem
 * mira 5%.
 *
 * Entao: cinco pontos OU um quarto do alvo, o que for menor.
 *
 * E MORA AQUI, sozinha, porque eu ja errei isso. Consertei o cabecalho da
 * caixinha na v45 e esqueci do bloco de rebalanco — e as duas metades da mesma
 * tela passaram a discordar: uma dizia "faltam 4.2 pontos", a outra dizia
 * "dentro dos 5 pontos, e por isso fora da lista". Ele reparou na hora.
 * Duas copias de uma regra sao duas chances de consertar so uma. */
function folgaDoAlvo(alvoPct) {
  var a = Math.abs(Number(alvoPct));
  if (!isFinite(a)) return 5;
  return Math.min(5, a * 0.25);
}

function faltaEmDinheiro(totalDaCarteira, totalDaCaixa, alvoPct) {
  if (!(totalDaCarteira > 0)) return null;
  if (alvoPct == null || alvoPct === "") return null;
  var alvo = Number(alvoPct);
  if (!isFinite(alvo) || alvo < 0) return null;
  var tem = Number(totalDaCaixa);
  if (!isFinite(tem)) tem = 0;
  return (alvo / 100) * totalDaCarteira - tem;
}

/* DINHEIRO NOVO E DINHEIRO REMANEJADO SAO NUMEROS DIFERENTES.
 *
 * Ele descreveu o uso assim: "se eu ponho X reais em tal caixinha fico com X%
 * e bate, ai consigo equilibrar meus APORTES". A palavra aporte e a chave, e
 * com ela a conta de cima nao serve — e por pouco nao serve de um jeito que
 * ele so descobriria depois de por o dinheiro.
 *
 * REMANEJANDO, o total nao muda: sai de uma caixinha e entra na outra.
 *
 *     falta = alvo x total - tem
 *
 * APORTANDO de fora, a caixinha sobe E O TOTAL SOBE JUNTO. Pondo os US$ 500,58
 * que a outra conta diz, a Renda passiva dele vira 521,50 num total de
 * 2.586,58 — 20,2%, e nao os 25% que ele queria. Resolvendo pro x que fecha:
 *
 *     (tem + x) / (total + x) = alvo   ->   x = (alvo x total - tem) / (1 - alvo)
 *
 *     (521,50 - 20,92) / 0,75 = US$ 667,44   e ai sim da 25%.
 *
 * Devolve null quando nao faz sentido: alvo de 100% nao se alcanca aportando
 * (dividiria por zero), e caixinha ja acima do alvo nao se conserta pondo mais
 * dinheiro nela. */
function aporteParaOAlvo(totalDaCarteira, totalDaCaixa, alvoPct) {
  if (!(totalDaCarteira > 0)) return null;
  if (alvoPct == null || alvoPct === "") return null;
  var alvo = Number(alvoPct) / 100;
  if (!isFinite(alvo) || alvo <= 0 || alvo >= 1) return null;
  var tem = Number(totalDaCaixa);
  if (!isFinite(tem)) tem = 0;
  var x = (alvo * totalDaCarteira - tem) / (1 - alvo);
  return x > 0 ? x : null;
}

/* ---------------------------------------------------------------------------
 * DIVIDIR UM VALOR ENTRE AS CAIXINHAS
 *
 * Pedido dele em 09/09/2026: "faça com dinheiro novo ou trocando parte do
 * dinheiro das próprias caixinhas, fica mais organizado e mais fácil pra eu
 * saber como aportar ou o que fazer".
 *
 * Ele digita quanto tem, e a tela mostra como esse valor se reparte. Dois
 * modos, porque as contas são MESMO diferentes:
 *
 *   NOVO       dinheiro de fora. O total sobe junto, então o alvo de cada
 *              caixinha é calculado sobre (total + valor).
 *   REMANEJAR  troca entre caixinhas. O total não muda, e o dinheiro sai de
 *              quem está acima do alvo.
 *
 * A REPARTIÇÃO é proporcional ao que falta em cada uma. Quando o valor não dá
 * pra zerar todas as faltas — que é o caso comum — qualquer divisão que não
 * ultrapasse nenhum alvo reduz a distância total exatamente pelo mesmo tanto.
 * Sendo assim, a proporcional é a que mantém a ordem das prioridades sem eu
 * escolher por ele qual caixinha vem antes.
 *
 * E O RESULTADO VAI JUNTO: quanto cada caixinha fica DEPOIS, em porcentagem.
 * Sem isso ele teria que confiar na minha conta; com isso ele confere.
 *
 * Nada aqui manda fazer nada — devolve números, e a frase de cima continua
 * sendo que o que fazer com isso é com ele.
 * ------------------------------------------------------------------------- */
var repartir = null;   // { aberto, valor, modo } — o que ele digitou

function dividirDinheiro(caixas, totalAtual, quanto, modo) {
  var X = Number(quanto);
  if (!(X > 0) || !(totalAtual > 0)) return null;

  var comAlvo = (caixas || []).filter(function (c) {
    var a = Number(c.alvo);
    return isFinite(a) && a > 0;
  });
  if (!comAlvo.length) return null;

  /* O TOTAL DEPOIS, e é aqui que os dois modos se separam. Dinheiro novo sobe
     o total; remanejar só troca de lugar. */
  var totalDepois = modo === "novo" ? totalAtual + X : totalAtual;

  /* De onde SAI, no modo remanejar: das que estão acima do alvo, na proporção
     do que cada uma tem sobrando. */
  var tirando = [], sobrando = 0;
  if (modo !== "novo") {
    comAlvo.forEach(function (c) {
      var excesso = Number(c.tem || 0) - (Number(c.alvo) / 100) * totalDepois;
      if (excesso > 0) { tirando.push({ c: c, excesso: excesso }); sobrando += excesso; }
    });
  }

  /* NÃO DÁ PRA TIRAR MAIS DO QUE SOBRA. Se ele pedir pra remanejar mais do que
     existe acima do alvo, o valor é limitado — e a tela diz que foi. */
  var limitado = false;
  if (modo !== "novo" && X > sobrando) { X = sobrando; limitado = true; }
  if (!(X > 0)) return { partes: [], tirando: [], nada: true, limitado: limitado, sobrando: sobrando };

  var faltas = [], somaFaltas = 0;
  comAlvo.forEach(function (c) {
    var falta = (Number(c.alvo) / 100) * totalDepois - Number(c.tem || 0);
    if (falta > 0) { faltas.push({ c: c, falta: falta }); somaFaltas += falta; }
  });

  var partes = [], sobra = 0;
  if (!faltas.length) {
    sobra = X;
  } else if (somaFaltas >= X) {
    faltas.forEach(function (f) {
      partes.push({ chave: f.c.chave, nome: f.c.nome, quanto: X * (f.falta / somaFaltas) });
    });
  } else {
    /* Dá pra cobrir todas as faltas e ainda sobra. O que sobrar se reparte
       pelos alvos dele, que é a única divisão que ele já escolheu. */
    faltas.forEach(function (f) {
      partes.push({ chave: f.c.chave, nome: f.c.nome, quanto: f.falta });
    });
    var resto = X - somaFaltas;
    var somaAlvos = comAlvo.reduce(function (t, c) { return t + Number(c.alvo); }, 0);
    if (somaAlvos > 0) {
      comAlvo.forEach(function (c) {
        var pedaco = resto * (Number(c.alvo) / somaAlvos);
        if (!(pedaco > 0)) return;
        var ja = partes.find(function (p) { return p.chave === c.chave; });
        if (ja) ja.quanto += pedaco;
        else partes.push({ chave: c.chave, nome: c.nome, quanto: pedaco });
      });
    } else {
      sobra = resto;
    }
  }

  /* COMO FICA DEPOIS — a parte que ele usa pra conferir a minha conta. */
  var depois = comAlvo.map(function (c) {
    var p = partes.find(function (q) { return q.chave === c.chave; });
    var recebeu = p ? p.quanto : 0;
    var tirou = 0;
    if (modo !== "novo") {
      var t = tirando.find(function (q) { return q.c.chave === c.chave; });
      if (t && sobrando > 0) tirou = X * (t.excesso / sobrando);
    }
    var fica = Number(c.tem || 0) + recebeu - tirou;
    return {
      chave: c.chave, nome: c.nome, alvo: Number(c.alvo),
      antes: Number(c.tem || 0), fica: fica,
      pctAntes: (Number(c.tem || 0) / totalAtual) * 100,
      pctDepois: totalDepois > 0 ? (fica / totalDepois) * 100 : null,
    };
  });

  return {
    modo: modo, valor: X, limitado: limitado, sobrando: sobrando,
    totalAntes: totalAtual, totalDepois: totalDepois,
    partes: partes.filter(function (p) { return p.quanto > 0.004; }),
    tirando: tirando.map(function (t) {
      return { chave: t.c.chave, nome: t.c.nome, quanto: X * (t.excesso / sobrando) };
    }).filter(function (t) { return t.quanto > 0.004; }),
    depois: depois,
    sobra: sobra,
    cobreTudo: somaFaltas <= X,
    faltaTotal: somaFaltas,
  };
}

/* O CAMPO DE REPARTIR — fechado por padrão, como o resto.
 *
 * Ele digita quanto tem e escolhe de onde vem. A tela mostra em quanto fica
 * cada caixinha DEPOIS, que é o que faz a conta ser conferível em vez de ser
 * um número pra confiar.
 *
 * Nenhuma frase manda fazer nada: são números e o resultado deles. */
/* Os botões de modo, religados depois de cada redesenho parcial. */
function ligarRepartir() {
  document.querySelectorAll(".repModo").forEach(function (b) {
    b.onclick = function () {
      if (!repartir) return;
      repartir.modo = b.dataset.modo;
      desenhar();
    };
  });
}

/* As caixinhas com alvo definido por ELE, no formato que a divisão pede.
 * Sem alvo dele não há do que se aproximar — usar a referência do método como
 * alvo seria decidir por ele. */
function caixasComAlvo(c) {
  var fora = [];
  CAIXAS.forEach(function (cx) {
    var alvo = alvos && alvos[cx.chave];
    if (alvo == null || alvo === "") return;
    fora.push({ chave: cx.chave, nome: cx.nome, tem: c.porCaixa[cx.chave].total, alvo: alvo });
  });
  return fora;
}

/* SÓ O RESULTADO — separado do campo de propósito.
 *
 * A cada tecla digitada isto se refaz; o campo, não. Refazer o campo tiraria o
 * cursor do lugar a cada letra, que é o defeito clássico de tela que recalcula
 * enquanto se digita. */
function resultadoDeRepartir(c) {
  var modo = (repartir && repartir.modo) || "novo";
  var caixas = caixasComAlvo(c);
  var r = dividirDinheiro(caixas, c.total, repartir && repartir.valor, modo);

  if (!r) {
    return '<div class="repNota">' +
      (caixas.length
        ? "Escreva um valor maior que zero."
        : "Defina pelo menos um alvo nas caixinhas — sem alvo seu não há do que se aproximar.") +
      "</div>";
  }

  if (r.nada) {
    return '<div class="repNota">Nenhuma caixinha está acima do alvo, então não há de onde tirar. ' +
      "Com dinheiro novo a conta funciona.</div>";
  }

  var corpo = "";
  if (r.limitado) {
    corpo += '<div class="repNota">Acima dos alvos só existem ' + dinheiroNa(r.sobrando, moedaVista) +
      ", então a conta abaixo é sobre esse valor.</div>";
  }

  if (r.tirando && r.tirando.length) {
    corpo += '<div class="repTit">sai de</div>';
    r.tirando.forEach(function (t) {
      corpo += '<div class="repLinha"><span>' + esc(t.nome) + '</span><b class="desce">−' +
        dinheiroNa(t.quanto, moedaVista) + "</b></div>";
    });
  }

  corpo += '<div class="repTit">entra em</div>';
  r.partes.forEach(function (pt) {
    corpo += '<div class="repLinha"><span>' + esc(pt.nome) + '</span><b class="sobe">+' +
      dinheiroNa(pt.quanto, moedaVista) + "</b></div>";
  });

  /* COMO FICA DEPOIS. É a parte que ele usa pra conferir a minha conta, e por
     isso vem sempre — inclusive as caixinhas que não receberam nada. */
  corpo += '<div class="repTit">como fica</div>';
  r.depois.forEach(function (d) {
    var perto = Math.abs(d.pctDepois - d.alvo) < 1;
    corpo += '<div class="repLinha"><span>' + esc(d.nome) + "</span>" +
      '<span class="repDe">' + d.pctAntes.toFixed(1) + "% → </span>" +
      '<b class="' + (perto ? "sobe" : "") + '">' + d.pctDepois.toFixed(1) + "%</b>" +
      '<span class="repDe">alvo ' + d.alvo + "%</span></div>";
  });

  corpo += '<div class="repNota">' +
    (modo === "novo"
      ? "Com dinheiro novo o total sobe junto, então o alvo de cada caixinha sobe também — por isso às vezes falta em todas ao mesmo tempo."
      : "Trocando entre caixinhas o total não muda: o que sai de uma entra na outra.") +
    " O que fazer com isso é com você.</div>";

  return corpo;
}

function blocoDeRepartir(c) {
  var aberto = repartir && repartir.aberto;
  var barra = '<div class="repBarra"><button class="btRepartir">tenho um valor pra dividir ' +
    (aberto ? "▴" : "▾") + "</button></div>";
  if (!aberto) return barra;

  var modo = repartir.modo || "novo";
  return barra +
    '<div class="repCaixa">' +
      '<div class="repCampos">' +
        '<input class="repValor" type="number" step="any" min="0" inputmode="decimal" placeholder="quanto" value="' +
          esc(repartir.valor || "") + '">' +
        '<span class="repMoeda">' + (moedaVista === "BRL" ? "R$" : "US$") + "</span>" +
      "</div>" +
      '<div class="repModos">' +
        '<button class="repModo' + (modo === "novo" ? " ativo" : "") + '" data-modo="novo">dinheiro novo</button>' +
        '<button class="repModo' + (modo === "remanejar" ? " ativo" : "") + '" data-modo="remanejar">trocando entre caixinhas</button>' +
      "</div>" +
      '<div id="repResultado">' + resultadoDeRepartir(c) + "</div>" +
    "</div>";
}

function blocoDoRebalanco(c) {
  var acima = [], abaixo = [], dentro = [], comAlvo = 0;

  CAIXAS.forEach(function (cx) {
    var alvo = alvos && alvos[cx.chave];
    var atual = c.porCaixa[cx.chave] && c.porCaixa[cx.chave].pct;
    if (alvo == null || alvo === "" || atual == null) return;
    comAlvo++;
    var d = atual - Number(alvo);
    var dinheiro = faltaEmDinheiro(c.total, c.porCaixa[cx.chave].total, alvo);
    var aporte = aporteParaOAlvo(c.total, c.porCaixa[cx.chave].total, alvo);
    var x = { cx: cx, d: d, atual: atual, alvo: Number(alvo), dinheiro: dinheiro, aporte: aporte };
    /* A MESMA folga do cabeçalho da caixinha — veja folgaDoAlvo. */
    var folga = folgaDoAlvo(alvo);
    if (d > folga) acima.push(x);
    else if (d < -folga) abaixo.push(x);
    else dentro.push(x);
  });

  if (!comAlvo) return "";
  acima.sort(function (a, b) { return b.d - a.d; });
  abaixo.sort(function (a, b) { return a.d - b.d; });

  if (!acima.length && !abaixo.length) {
    return '<div class="recadoConta bom" style="margin-top:10px">✅ Nenhuma caixinha se afastou do alvo que você definiu.</div>';
  }

  var linha = function (x, sinal) {
    /* O DINHEIRO VEM PRIMEIRO, e os pontos ficam de apoio. É o número que ele
       usa: pontos percentuais não se transferem entre caixinhas, dinheiro sim. */
    var emDinheiro = "";
    if (x.dinheiro != null) {
      emDinheiro = '<b class="' + (x.dinheiro > 0 ? "desce" : "sobe") + '">' +
        (x.dinheiro > 0 ? "faltam " : "sobram ") +
        dinheiroNa(Math.abs(x.dinheiro), moedaVista) + "</b> · ";
    }

    /* AS DUAS CONTAS, quando a caixinha está faltando. São perguntas
       diferentes e ele faz as duas: tirar de outra caixinha, ou pôr dinheiro
       novo. Mostrar só uma faria ele acertar metade das vezes. */
    var duasContas = "";
    if (x.dinheiro != null && x.dinheiro > 0 && x.aporte != null) {
      duasContas = '<div class="rebalancoDuas">' +
        dinheiroNa(x.dinheiro, moedaVista) + ' tirando de outra caixinha · ' +
        '<b>' + dinheiroNa(x.aporte, moedaVista) + '</b> se for dinheiro novo' +
        ' <span class="onde">(dinheiro novo sobe o total junto, então precisa de mais)</span>' +
      "</div>";
    }

    return '<div>· ' + emDinheiro + '<b>' + esc(x.cx.nome) + '</b> está ' +
      Math.abs(x.d).toFixed(1) + ' pontos ' + sinal + ' do seu alvo: ' +
      x.atual.toFixed(1) + '% contra ' + x.alvo + '%' + duasContas + '</div>';
  };

  return '<div class="rebalanco">' +
    '<div class="rebalancoTit">o que a sua carteira está dizendo</div>' +
    blocoDeRepartir(c) +
    acima.map(function (x) { return linha(x, "ACIMA"); }).join("") +
    abaixo.map(function (x) { return linha(x, "ABAIXO"); }).join("") +
    (acima.length && abaixo.length
      ? '<div class="rebalancoPar">É o par que a aula descreve: uma sobrando e outra faltando. ' +
        'Os valores são a distância até o seu alvo, em dinheiro, sobre o total de hoje. ' +
        'O que fazer com isso é com você.</div>'
      : '<div class="rebalancoPar">Os valores são a distância até o seu alvo, em dinheiro, ' +
        'sobre o total de hoje. O que fazer com isso é com você.</div>') +
    /* AS QUE FICARAM DE FORA SÃO NOMEADAS, e isto veio de um susto dele.
     *
     * Ele importou o SOL, a caixinha Ativos voláteis saiu de 0,0% para 0,8%, e
     * com isso passou a estar a 4,2 pontos do alvo — dentro do corte. Ela
     * simplesmente sumiu da lista, e ele reportou como defeito: "faltou ativos
     * voláteis pra eu acompanhar".
     *
     * Ele estava certo em estranhar. Linha que desaparece sem dizer por quê é
     * indistinguível de linha que quebrou — e some justamente quando a notícia
     * é boa, que é a pior hora pra parecer defeito. */
    (dentro.length
      ? '<div class="rebalancoPar">No alvo, e por isso fora da lista: ' +
        dentro.map(function (x) {
          return esc(x.cx.nome) + " (" + x.atual.toFixed(1) + "% contra " + x.alvo + "%)";
        }).join(" · ") + ".</div>"
      : "") +
    '<div class="rebalancoPar">Aparecem só as caixinhas fora do alvo, ' +
      'então somar o que está na tela pode não fechar.</div>' +
    /* Se alguma linha ficou fora do total, o dinheiro aqui está por baixo — e
       um número por baixo com cara de exato é pior que número nenhum. */
    (c.foraDaConta
      ? '<div class="rebalancoPar">Atenção: ' + c.foraDaConta +
        (c.foraDaConta > 1 ? ' linhas ficaram' : ' linha ficou') +
        ' fora do total por falta de cotação, então estes valores estão por baixo.</div>'
      : "") +
  '</div>';
}

/* A pool que o radar já vigia, se a linha apontar para uma.
 *
 * O elo é o id do DefiLlama. Se ele marcou a pool com /entrei no Telegram, o
 * radar já mede chão, incentivo e tamanho todo dia — e é essa medida que
 * aparece aqui, sem medir de novo. */
/* Os numeros de hoje das pools que ele lancou, vindos de /api/piscinas. */
var poolsCarteira = {};
var poolsPedidas = null;

/* As POSICOES concentradas, lidas da Solana por /api/posicao.
 *
 * Diferente de tudo o mais na carteira: aqui o Rayakuza nao digita valor nenhum.
 * O endereco da posicao e publico e so leitura, e dele sai a faixa, quanto tem
 * de cada token e quanto vale hoje. Ele cola o endereco uma vez; o numero se
 * refaz sozinho a cada abertura da tela. */
var posicoes = {};
var posicoesPedidas = null;

/* Soma no que já existe, em vez de trocar o objeto inteiro.
 *
 * Trocar era o estrago de 08/09/2026: ele colava o endereço, o radar lia da
 * Solana e guardava, e a rebusca seguinte — se falhasse por qualquer motivo —
 * substituía tudo por vazio e apagava a leitura boa. Como o "já pedi" era
 * marcado antes de saber se dera certo, nunca havia segunda tentativa.
 *
 * São caches por chave. Somar é sempre certo; trocar só é certo quando a
 * resposta nova é completa, e ninguém garante isso. */
function juntar(alvo, novos) {
  for (var k in (novos || {})) alvo[k] = novos[k];
  return alvo;
}

/* Uma linha da carteira no formato que o banco aceita.
 *
 * Duas armadilhas moram aqui, e a segunda apareceu na cara dele em 09/09/2026
 * como "All object keys must match" em cima do patrimônio:
 *
 * 1. Campo que a tabela não conhece derruba o INSERT inteiro, com um erro que
 *    fala de coluna e não de carteira. Por isso a lista é fixa.
 *
 * 2. O PostgREST recusa um lote em que as linhas têm conjuntos de chaves
 *    DIFERENTES. Uma linha de token não tem posição; uma de pool não tem
 *    token. Eu mandava só o que cada uma tinha, então salvar quebrava assim
 *    que a carteira misturava tipos — que é exatamente o que a importação faz.
 *
 * Então o que falta vai como NULO, não some. É por isso que esta função existe
 * separada: dá pra provar num teste que toda linha sai com as mesmas chaves,
 * sem precisar de banco nem de tela. */
var COLUNAS_DA_ALOCACAO = ["chave", "fechada_em", "fatia", "caixa", "token", "quantidade", "valor", "moeda",
  "pool_id", "onde", "posicao", "valor_entrada", "data_entrada",
  "mint", "segue_carteira", "cambio_entrada", "ordem", "alvo"];

function linhaParaOBanco(f) {
  var limpa = {};
  COLUNAS_DA_ALOCACAO.forEach(function (c) {
    limpa[c] = (f && f[c] !== undefined) ? f[c] : null;
  });
  // Estas duas não aceitam nulo do outro lado.
  if (limpa.ordem == null) limpa.ordem = 0;
  if (limpa.segue_carteira == null) limpa.segue_carteira = true;
  return limpa;
}

/* Uma cópia da carteira no aparelho, para nada dele depender só de mim.
 *
 * A transação no banco já impede que uma falha minha apague os lançamentos.
 * Isto cobre o outro caso: ele apagar uma linha sem querer e salvar. A cópia
 * fica no celular, é gravada a cada leitura e a cada salvamento que deu certo,
 * e só aparece como oferta se a carteira vier vazia e a cópia tiver algo.
 *
 * Nunca restaura sozinha: uma carteira que se repovoa sem ninguém mandar é
 * assustadora, e ele pode ter esvaziado de propósito. */
/* ---------------------------------------------------------------------------
 * O QUE AINDA NAO FOI SALVO
 *
 * Pedido dele em 09/09/2026: "o aviso ajudaria, posso esquecer de salvar, ai
 * escolho se salvo o que fiz ou cancelo".
 *
 * Veio de uma perda de verdade: ele importou o SOL, o app recarregou antes de
 * ele apertar Salvar, e a linha sumiu. Nao ficou rastro nenhum — o que nao e
 * salvo nao deixa marca — e ele passou a duvidar se tinha sido bug ou ele.
 * Duvidar da ferramenta e pior que perder a linha.
 *
 * A escolha continua dele: nada e salvo sozinho. Mas some o silencio.
 *
 * O RETRATO IGNORA A QUANTIDADE DAS LINHAS QUE SEGUEM A CARTEIRA, e essa
 * exclusao e o que faz o aviso valer alguma coisa. Essas quantidades mudam
 * sozinhas quando a blockchain anda — sem ele tocar em nada. Um aviso de "voce
 * tem coisa nao salva" que aparece porque o USDC dele rendeu e um aviso que se
 * aprende a ignorar, e aviso ignorado nao avisa nada no dia em que importa. */
var salvoComo = null;

/* O aviso, e ele fica GRUDADO no alto enquanto houver coisa pendente.
 *
 * Recado que rola pra fora da tela e recado que ele nao le — e o unico momento
 * em que este texto importa e justamente quando ele esta prestes a fechar o
 * app sem ter visto. */
/* OS LANCAMENTOS SEM DONO.
 *
 * Lancamento nunca e apagado — quando uma linha some, ele fica pendurado numa
 * chave que nao existe mais. Isso ja salvou o historico dele duas vezes hoje,
 * mas ate agora so eu conseguia religar, por SQL, na mao.
 *
 * Aqui isso vira tela: ele ve o que ficou solto e escolhe onde pendurar. */
function orfaosDaCarteira() {
  if (!movsCarregados || fatias === null) return [];
  var vivas = {};
  (fatias || []).forEach(function (f) { if (f.chave) vivas[f.chave] = 1; });
  var fora = [];
  Object.keys(movimentos || {}).forEach(function (ch) {
    if (vivas[ch]) return;
    var lista = movimentos[ch] || [];
    if (!lista.length) return;
    var soma = 0, qtd = 0;
    lista.forEach(function (m) {
      var v = movEmDolar(m) || 0;
      soma += (m.tipo === "saque" ? -v : v);
      var q = Number(m.qtd_a);
      if (isFinite(q)) qtd += (m.tipo === "saque" ? -q : q);
    });
    fora.push({
      chave: ch, quantos: lista.length, soma: soma, qtd: qtd,
      simbolo: (lista.find(function (m) { return m.simbolo_a; }) || {}).simbolo_a || null,
      de: lista[lista.length - 1] && lista[lista.length - 1].quando,
      ate: lista[0] && lista[0].quando,
    });
  });
  return fora;
}

function blocoDeOrfaos() {
  var orfs = orfaosDaCarteira();
  if (!orfs.length) return "";

  var opcoes = (fatias || []).filter(linhaTemConteudo).map(function (f) {
    return '<option value="' + esc(f.chave) + '">' + esc(f.fatia || f.token || "linha") + "</option>";
  }).join("");

  return '<div class="orfaos">' +
    '<div class="orfaosTit">Lançamentos sem linha</div>' +
    '<div class="orfaosNota">Estes lançamentos pertenciam a linhas que não existem mais. ' +
      'Nada foi apagado — eles ficam aqui até você dizer onde vão.</div>' +
    orfs.map(function (o) {
      return '<div class="orfaoLinha">' +
        "<span>" + o.quantos + " lançamento" + (o.quantos > 1 ? "s" : "") +
          (o.simbolo ? " de " + esc(o.simbolo) : "") +
          " · " + dinheiroMiudo(o.soma, "USD") +
          (o.de ? " · desde " + esc(String(o.de)) : "") + "</span>" +
        '<select class="orfaoAlvo" data-de="' + esc(o.chave) + '">' +
          '<option value="">escolha a linha…</option>' + opcoes +
        "</select>" +
        '<button class="btReligar" data-de="' + esc(o.chave) + '">religar</button>' +
      "</div>";
    }).join("") +
  "</div>";
}

function avisoNaoSalvo() {
  if (!temCoisaNaoSalva()) return "";
  return '<div class="naoSalvo">' +
    '<span>Você tem mudanças que ainda não foram salvas.</span>' +
    '<button class="btSalvarAgora">salvar</button>' +
    '<button class="btDescartar' + (descartando ? " perguntando" : "") + '">' +
      (descartando ? "descartar mesmo?" : "descartar") + "</button>" +
  "</div>";
}

function retratoDaCarteira() {
  var linhas = (fatias || []).map(function (f) {
    var l = linhaParaOBanco(f);
    /* SEGUINDO, e nao apenas "pode seguir": a linha TRAVADA tem mint, mas a
       quantidade dela e digitada por ele e o app nunca encosta. Excluir a dela
       faria o aviso ficar calado justamente sobre um numero que so existe
       porque ele escreveu — e que se perde se ele fechar o app. */
    if (seguindo(f)) l.quantidade = null;
    return l;
  });
  return JSON.stringify({ linhas: linhas, alvos: alvos || {} });
}

function temCoisaNaoSalva() {
  if (salvoComo === null || fatias === null) return false;
  return retratoDaCarteira() !== salvoComo;
}

function marcarComoSalvo() { salvoComo = retratoDaCarteira(); }

var descartando = false;   // o "descartar" pediu confirmacao?
var apagandoLinha = null;  // a ordem da linha que pediu confirmacao

var COPIA = "radar:carteira";

/* As cópias guardadas no banco. Sobrevivem a trocar de aparelho, limpar o app
 * e a qualquer versão nova — que era a preocupação dele: "as versões sempre vão
 * atualizando e não dá pra perder as coisas que estão dando certo". */
var copias = null;
var mostrarCopias = false;

function guardarCopia(linhas) {
  try {
    if (!(linhas || []).length) return;
    localStorage.setItem(COPIA, JSON.stringify({ quando: Date.now(), linhas: linhas }));
  } catch (e) {}
}

function lerCopia() {
  try {
    var c = JSON.parse(localStorage.getItem(COPIA) || "null");
    return (c && (c.linhas || []).length) ? c : null;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------------------
 * A CÓPIA NO DRIVE DELE.
 *
 * Pedido dele em 08/09/2026, e a frase que define o desenho: "os dados são
 * guardados em contas da própria pessoa... a gente como ferramenta entra só com
 * a conexão de leitura — os dados de cada pessoa ficam com elas mesmo".
 *
 * ESTA É A ÚNICA CÓPIA QUE SOBREVIVE À SUPABASE SUMIR, e a única que ele leva
 * embora se um dia largar o radar. A do Telegram (que vai sozinha toda manhã)
 * mora num servidor que também não é dele; esta mora na conta dele.
 *
 * TRÊS ESCOLHAS QUE IMPORTAM:
 *
 * 1. ESCOPO drive.file, e não "drive". Com drive.file eu só enxergo os arquivos
 *    que ESTE app criou — o resto do Drive dele é invisível pra mim, e não é
 *    promessa minha: é o Google que recusa. Pedir "drive" seria pedir a chave da
 *    casa pra deixar uma carta na caixa do correio.
 *
 * 2. O TOKEN NUNCA VAI PRO localStorage. Só na memória da página, e some quando
 *    ele fecha a aba. Token do Google guardado em disco é credencial de verdade
 *    parada num lugar que qualquer script da página consegue ler; a sessão da
 *    Supabase mora lá porque sem ela o app não funciona, e o do Drive não tem
 *    essa desculpa — pedir de novo custa nada.
 *
 * 3. O CONTEÚDO VEM DA MESMA FUNÇÃO DO BANCO que o bot usa (retrato_da_carteira).
 *    Duas definições de "o que é um backup" divergem no primeiro campo novo, e a
 *    que divergir vai estar num arquivo que ele só abre no dia em que precisar.
 * ------------------------------------------------------------------------ */
/* >>> OPCIONAL: a cópia de segurança no Google Drive de quem usa. <<<
 * Vazio = o botão do Drive nem aparece, e nada mais muda. Pra ligar, crie um
 * OAuth Client ID no Google Cloud (INSTALAR.md) e cole aqui. Client ID não é
 * segredo — ele aparece no código de qualquer site com login do Google. */
var DRIVE_ID = "";
var DRIVE_PASTA = "Radar DeFi — cópias da carteira";
var DRIVE_ESCOPO = "https://www.googleapis.com/auth/drive.file";
var DRIVE_LIGADO = "radar:drive:ligado";
var DRIVE_DIGITAL = "radar:drive:digital";
var DRIVE_QUANDO = "radar:drive:quando";
var DRIVE_CONTA = "radar:drive:conta";

var driveToken = null;      // só na memória, de propósito (ver 2 acima)
var driveTokenAte = 0;
var driveCliente = null;
var driveEstado = "";       // "", "mandando", "pronto", "erro"
var driveRecado = "";

function driveLigado() {
  try { return localStorage.getItem(DRIVE_LIGADO) === "1"; } catch (e) { return false; }
}
function marcarDriveLigado(v) {
  try { localStorage.setItem(DRIVE_LIGADO, v ? "1" : "0"); } catch (e) {}
}
function driveUltima() {
  try { return localStorage.getItem(DRIVE_QUANDO) || ""; } catch (e) { return ""; }
}

/* QUAL das contas Google dele.
 *
 * Ele tem tres no celular. Sem dizer qual, o Google nao consegue renovar
 * calado — e com razao: escolher sozinho entre contas de uma pessoa e
 * exatamente o tipo de adivinhacao que nao se deve fazer. Entao a tela de
 * escolher aparecia TODA vez.
 *
 * O e-mail vem do proprio Drive depois da primeira gravacao, e mora so no
 * aparelho dele. Nao pode ser escrito no codigo: o painel e uma pagina
 * publica, e e-mail em pagina publica e dado pessoal exposto. */
function driveConta() {
  try { return localStorage.getItem(DRIVE_CONTA) || ""; } catch (e) { return ""; }
}

async function guardarContaDoDrive() {
  if (driveConta()) return;
  try {
    var r = await driveFetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)");
    if (!r.ok) return;
    var d = await r.json();
    var e = d && d.user && d.user.emailAddress;
    if (e) localStorage.setItem(DRIVE_CONTA, e);
  } catch (e) {}
}

/* A biblioteca do Google entra só quando ele liga a cópia.
 *
 * Carregar sempre custaria uma chamada de rede em toda abertura do painel pra
 * uma coisa que a maioria das aberturas não usa — e deixaria o app dependendo do
 * servidor do Google pra desenhar a tela. */
function carregarGoogle() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    return Promise.resolve(true);
  }
  if (window.gisCarregando) return window.gisCarregando;
  window.gisCarregando = new Promise(function (pronto) {
    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = function () {
      pronto(!!(window.google && window.google.accounts && window.google.accounts.oauth2));
    };
    s.onerror = function () { pronto(false); };
    document.head.appendChild(s);
  });
  return window.gisCarregando;
}

/* O token do Drive.
 *
 * comTela=true abre a janelinha de permissão e PRECISA de clique dele — o
 * navegador bloqueia janela que abre sozinha, e com razão. Depois da primeira
 * vez, prompt vazio renova calado, sem nada piscar na tela. */
async function pedirTokenDoDrive(comTela) {
  if (driveToken && Date.now() < driveTokenAte - 60000) return driveToken;
  var ok = await carregarGoogle();
  if (!ok) throw new Error("não consegui carregar o login do Google");
  if (!driveCliente) {
    driveCliente = window.google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_ID, scope: DRIVE_ESCOPO, callback: function () {},
    });
  }
  return await new Promise(function (deu, falhou) {
    driveCliente.callback = function (r) {
      if (r && r.access_token) {
        driveToken = r.access_token;
        driveTokenAte = Date.now() + (Number(r.expires_in || 3600) * 1000);
        deu(driveToken);
      } else {
        falhou(new Error((r && r.error) || "não veio permissão"));
      }
    };
    driveCliente.error_callback = function (e) {
      falhou(new Error((e && e.type === "popup_closed")
        ? "você fechou a janela" : "não consegui pedir a permissão"));
    };
    var pedido = { prompt: comTela ? "consent" : "" };
    /* A DICA de qual conta. So serve pro renovar calado; na primeira vez ela
       nao existe ainda, e aí a tela de escolher e o certo mesmo. */
    var conta = driveConta();
    if (conta) pedido.hint = conta;
    driveCliente.requestAccessToken(pedido);
  });
}

function driveFetch(url, opcoes) {
  var o = opcoes || {};
  var cab = { authorization: "Bearer " + driveToken };
  for (var k in (o.headers || {})) cab[k] = o.headers[k];
  return fetch(url, { method: o.method || "GET", headers: cab, body: o.body });
}

/* A pasta. Procura antes de criar — senão cada aparelho dele criaria uma, e
   três pastas com o mesmo nome é o mesmo que nenhuma. */
async function pastaDoDrive() {
  var q = "mimeType='application/vnd.google-apps.folder' and trashed=false and name='" + DRIVE_PASTA + "'";
  var r = await driveFetch("https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id)&q=" + encodeURIComponent(q));
  if (r.ok) {
    var d = await r.json();
    if (d.files && d.files.length) return d.files[0].id;
  }
  var c = await driveFetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: DRIVE_PASTA, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!c.ok) throw new Error("não consegui criar a pasta no seu Drive");
  return (await c.json()).id;
}

async function arquivoDoDrive(pasta, nome) {
  var q = "trashed=false and name='" + nome + "' and '" + pasta + "' in parents";
  var r = await driveFetch("https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id)&q=" + encodeURIComponent(q));
  if (!r.ok) return null;
  var d = await r.json();
  return (d.files && d.files[0] && d.files[0].id) || null;
}

/* Cria vazio e depois grava o conteúdo: dois pedidos simples em vez de um
   multipart montado à mão, que é onde essa API costuma dar erro sem explicação. */
async function gravarNoDrive(nome, conteudo) {
  var pasta = await pastaDoDrive();
  var id = await arquivoDoDrive(pasta, nome);
  if (!id) {
    var c = await driveFetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nome, parents: [pasta], mimeType: "application/json" }),
    });
    if (!c.ok) throw new Error("não consegui criar o arquivo");
    id = (await c.json()).id;
  }
  var u = await driveFetch("https://www.googleapis.com/upload/drive/v3/files/" + id + "?uploadType=media", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: conteudo,
  });
  if (!u.ok) throw new Error("não consegui gravar o conteúdo");
  return id;
}

async function digitalDoTexto(texto) {
  var b = new TextEncoder().encode(texto);
  var h = await crypto.subtle.digest("SHA-256", b);
  return Array.prototype.map.call(new Uint8Array(h), function (x) {
    return ("0" + x.toString(16)).slice(-2);
  }).join("");
}

function meuId() {
  if (sessao && sessao.user && sessao.user.id) return sessao.user.id;
  try {
    var corpo = JSON.parse(atob(sessao.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return corpo.sub || null;
  } catch (e) { return null; }
}

async function retratoDoBanco() {
  var eu = meuId();
  if (!eu) return null;
  var r = await comAuth("/rest/v1/rpc/retrato_da_carteira", {
    method: "POST", body: JSON.stringify({ dono: eu }),
  });
  if (!r.ok) return null;
  return await r.json();
}

/* A cópia sobe.
 *
 * aMao = ele clicou no botão. Aí sempre manda, mesmo sem mudança — o automático
 * se cala quando nada mudou (senão o Drive dele vira uma pilha de arquivos
 * iguais), e é justamente no dia em que ele QUER o arquivo que o calado não
 * serve. Toda rotina que se cala por bom motivo precisa de um pedido à mão que
 * ignore o motivo. */
async function mandarProDrive(aMao) {
  if (!DRIVE_ID) return;
  if (driveEstado === "mandando") return;
  driveEstado = "mandando";
  driveRecado = "";
  if (aba === "carteira") desenhar();
  try {
    /* PRIMEIRO OLHA SE MUDOU, DEPOIS INCOMODA O GOOGLE.
     *
     * Ao contrario era o defeito que ele viu na hora: "quando eu coloco em
     * carteira pede pra escolher uma conta toda vez". Pedir o token antes de
     * saber se ha o que copiar fazia a janela aparecer justamente nas aberturas
     * em que nada tinha pra fazer — que sao quase todas. Nada de Google
     * acontece aqui enquanto a carteira estiver igual a da ultima copia. */
    var retrato = await retratoDoBanco();
    if (!retrato || !retrato.conferencia) throw new Error("não consegui montar a cópia");

    var semData = JSON.stringify(Object.assign({}, retrato, { radar_defi_backup: undefined }));
    var digital = await digitalDoTexto(semData);
    var antes = "";
    try { antes = localStorage.getItem(DRIVE_DIGITAL) || ""; } catch (e) {}

    if (!aMao && antes === digital) {
      driveEstado = "pronto";
      if (aba === "carteira") desenhar();
      return;
    }

    await pedirTokenDoDrive(!!aMao && !driveLigado());

    /* O CAMPO CHAMA-SE gerado_em, e ler "quando" custou o primeiro arquivo:
       ele subiu como carteira-hoje.json, e nesse nome todo dia gravaria por
       cima do dia anterior — matando justamente o histórico que esta cópia
       existe pra ter. Um nome de arquivo que depende de um campo NUNCA pode
       cair num texto fixo quando o campo falta: a data de hoje, medida aqui,
       erra por horas no pior caso; "hoje" apaga tudo. */
    var quando = (retrato.radar_defi_backup && retrato.radar_defi_backup.gerado_em) || "";
    var dia = String(quando).slice(0, 10) || new Date().toISOString().slice(0, 10);
    await gravarNoDrive("carteira-" + dia + ".json", JSON.stringify(retrato, null, 2));
    await guardarContaDoDrive();

    marcarDriveLigado(true);
    try {
      localStorage.setItem(DRIVE_DIGITAL, digital);
      localStorage.setItem(DRIVE_QUANDO, new Date().toISOString());
    } catch (e) {}
    driveEstado = "pronto";
  } catch (e) {
    driveEstado = "erro";
    driveRecado = String((e && e.message) || e).slice(0, 120);
  }
  if (aba === "carteira") desenhar();
}

function blocoDoDrive() {
  if (!DRIVE_ID) return "";
  if (driveEstado === "mandando") {
    return '<button class="botao fraco" id="btDrive">gravando no seu Drive…</button>';
  }
  if (driveEstado === "erro") {
    return '<button class="botao fraco" id="btDrive">Drive: ' + esc(driveRecado) + ' — tentar de novo</button>';
  }
  if (!driveLigado()) {
    return '<button class="botao fraco" id="btDrive">guardar cópia no meu Drive</button>';
  }
  var q = driveUltima();
  return '<button class="botao fraco" id="btDrive">Drive: ' +
    (q ? esc(new Date(q).toLocaleString("pt-BR")) : "ligado") + '</button>';
}

function posicaoDaLinha(f) {
  var e = String((f && f.posicao) || "").trim();
  var p = e && posicoes[e];
  return (p && !p.erro) ? p : null;
}

function enderecosDePosicao() {
  var vistos = {}, fora = [];
  (fatias || []).forEach(function (f) {
    var e = String(f.posicao || "").trim();
    if (e && !vistos[e]) { vistos[e] = 1; fora.push(e); }
  });
  return fora;
}

async function lerPosicoes(lista) {
  try {
    var r = await fetch("/api/posicao", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enderecos: lista }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

/* Repare no que estas tres funcoes NAO fazem mais: esvaziar o cache quando a
 * carteira nao tem nada daquele tipo.
 *
 * Faziam, e o estrago era invisivel: ele colava o endereco da posicao no
 * formulario, o radar lia da Solana e guardava — e o proximo desenho da tela
 * chamava isto, via que NENHUMA LINHA tinha posicao ainda (a linha so nasce
 * depois de ele apertar Lancar) e apagava a leitura. O campo ficava eternamente
 * dizendo "vou ler quando voce sair do campo".
 *
 * Sao caches por chave: endereco, simbolo, id de pool. Entrada velha nao
 * atrapalha ninguem, e a que esta sendo digitada precisa sobreviver ate virar
 * linha. */
/* Linha fechada e historico: nao le mais a cadeia. */
function linhaFechada(f) { return !!(f && f.fechada_em); }

async function buscarPosicoes() {
  var lista = enderecosDePosicao();
  var chave = lista.join(",");
  if (!lista.length) { posicoesPedidas = ""; return false; }
  if (chave === posicoesPedidas) return false;

  var d = await lerPosicoes(lista);
  if (!d) return false;
  juntar(posicoes, d.posicoes);

  /* Endereço que foi pedido e voltou sem resposta vira erro com nome.
   *
   * O servidor descarta em silêncio o que não parece endereço da Solana — e
   * chave ausente, do lado de cá, era "ainda estou lendo". Ficava lendo para
   * sempre. Silêncio nunca pode virar espera infinita: ou tem resposta, ou tem
   * motivo escrito. */
  lista.forEach(function (e) {
    if (!posicoes[e]) posicoes[e] = { erro: "não consegui ler esse endereço — confira se ele está completo" };
  });

  posicoesPedidas = chave;
  return true;
}

function poolDoRadar(id) {
  return (id && poolsCarteira[id]) || null;
}

/* A foto da ENTRADA, que e outra coisa e vem de outro lugar.
 *
 * poolDoRadar diz como a pool esta hoje; isto diz como ela estava no dia em
 * que ele entrou, e so existe se ele marcou com /entrei no Telegram. Sao duas
 * perguntas diferentes e por isso duas funcoes: juntar as duas faria o painel
 * dizer "mudou" para quem nunca marcou entrada nenhuma. */
function entradaDaPool(id) {
  var ms = (dados && dados.minhas) || [];
  for (var i = 0; i < ms.length; i++) if (ms[i].id === id) return ms[i];
  return null;
}

function idsDePool() {
  var vistos = {}, fora = [];
  (fatias || []).forEach(function (f) {
    var id = String(f.pool_id || "").trim();
    if (id && !vistos[id]) { vistos[id] = 1; fora.push(id); }
  });
  return fora;
}

async function buscarPoolsDaCarteira() {
  var lista = idsDePool();
  var chave = lista.join(",");
  if (!lista.length) { poolsPedidas = ""; return false; }
  if (chave === poolsPedidas) return false;
  try {
    var r = await fetch("/api/piscinas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: lista }),
    });
    if (!r.ok) return false;
    var d = await r.json();
    juntar(poolsCarteira, d.pools);
    poolsPedidas = chave;
    return true;
  } catch (e) {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * ACHAR A POOL
 *
 * Pergunta dele em 08/09/2026: "eu posso copiar a pool na blockchain e colar?"
 * Nao da, e o motivo e da fonte: o DefiLlama nao guarda o endereco da pool.
 * O campo que eu tinha feito pedia o id do DefiLlama, que ninguem sabe de cor.
 *
 * Entao o campo passa a aceitar o que ele PODE ter: o link do DefiLlama, o id,
 * o endereco de um TOKEN do par, ou simplesmente o par escrito ("eth usdc
 * base"). A conta de qual e qual esta em src/piscina-busca.js.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * IMPORTAR A CARTEIRA
 *
 * Desenho dele em 09/09/2026: "poderia ter uma parte falando: escolha quais
 * pools deseja usar, quais empréstimos deseja usar. Mas não subir
 * automaticamente — a gente teria o poder de escolher quais exportar para
 * caixinha, para ficar no lugar certo."
 *
 * Então a regra desta tela inteira: ela ACHA e OFERECE. Marcar é dele, a
 * caixinha é dele, e o que ele já organizou nunca é mexido.
 *
 * A caixinha vem sugerida — bitcoin em B, stablecoin em C, pool e empréstimo em
 * R — porque escolher cinco vezes seguidas cansa e a sugestão acerta quase
 * sempre. Sugerir não é decidir: o seletor está ali do lado. */

/* O que está encolhido, e por que isso é guardado.
 *
 * Ele: "fica muito poluído se tudo ficar exposto, deixa a opção de encolher ou
 * expandir". Com quinze tokens importados a aba vira uma escada, e o bloco de
 * importar ocupa meia tela toda vez que ele abre — sendo que importar é coisa
 * que se faz uma vez e depois raramente.
 *
 * Fica no aparelho e não no banco: é preferência de tela, não patrimônio. E
 * sobrevive a fechar o app, que é o ponto — encolher algo e reencontrar tudo
 * aberto na próxima vez é o mesmo que não ter encolhido. */
var encolhidas = (function () {
  try { return JSON.parse(localStorage.getItem("radar:encolhidas") || "{}") || {}; }
  catch (e) { return {}; }
})();

/* TUDO nasce encolhido, e é pedido dele: "tem como deixar padrão todas os
 * tamanhos e ocultar as informações? quando eu quiser ver eu expando".
 *
 * O que fica de pé em cada caixinha é a LEITURA — letra, nome, porcentagem,
 * barra e a distância do alvo. Isso é o B.A.R.C.A. propriamente dito, e cabe
 * numa altura só para as cinco. O que se esconde é a lista de dentro, que é
 * detalhe e é o que faz a tela virar escada.
 *
 * As cinco iguais, uma embaixo da outra, é o desenho do método: dá pra
 * comparar as caixinhas de relance, que é a coisa que ele abre o app pra
 * fazer. */
function encolhida(chave) {
  return encolhidas[chave] === undefined ? true : !!encolhidas[chave];
}

/* VIRAR O ESTADO QUE APARECE, e nao o valor guardado.
 *
 * O defeito que isto conserta, achado em 09/09/2026 e reportado por ele duas
 * vezes seguidas ("os rendimentos sumiram, range de pool etc"):
 *
 * A caixinha nasce FECHADA — encolhida() devolve true quando nao ha nada
 * guardado. Mas o virar fazia !undefined, que da true. O mesmo estado. Entao
 * o PRIMEIRO TOQUE nao fazia nada; so o segundo abria.
 *
 * Junte com o Pronto, que devolvia a caixinha pro estado guardado (fechada), e
 * o resultado e que ele NAO CONSEGUIA CHEGAR na tela de vista. Editava, dava
 * Pronto, a caixinha fechava, e ele concluia — com razao — que os rendimentos
 * tinham sumido. Duas vezes eu respondi que era o modo editar. Era isto.
 *
 * A licao e velha e eu repeti: valor guardado e estado que aparece nao sao a
 * mesma coisa quando existe um padrao. Quem vira tem que virar o que se ve. */
function virarEncolhida(chave) {
  encolhidas[chave] = !encolhida(chave);
  try { localStorage.setItem("radar:encolhidas", JSON.stringify(encolhidas)); } catch (e) {}
}

/* Deixa a caixinha ABERTA. Usado ao sair da edicao: ele acabou de mexer nas
 * linhas, e fechar em cima do trabalho recem-feito esconde justamente o que
 * ele quer conferir. */
function abrirCaixa(chave) {
  if (!chave) return;
  encolhidas[chave] = false;
  try { localStorage.setItem("radar:encolhidas", JSON.stringify(encolhidas)); } catch (e) {}
}

/* Os lancamentos, por chave de linha. Chegam do banco junto com a carteira.
 *
 * Vazio nao e o mesmo que "ainda nao carregou": movsCarregados diz qual dos
 * dois e. Sem essa distincao, a tela mostraria "sem lancamentos" no meio
 * segundo antes de eles chegarem, e ele leria isso como perda de dados — que
 * e justamente o susto que ele ja levou uma vez. */
var movimentos = {};
var movsCarregados = false;
var movAberto = null;        // a chave da linha com o extrato aberto
var movNovo = null;          // { chave, tipo, valor, moeda, quando } sendo digitado
var movRecado = null;        // { chave, txt, classe }
var movApagando = null;      // o id do lançamento que pediu confirmação

function movsDaLinha(ch) {
  return (ch && movimentos[ch]) ? movimentos[ch] : [];
}

function arrumarMovimentos(lista) {
  movimentos = {};
  (lista || []).forEach(function (m) {
    if (!m || !m.chave) return;
    if (!movimentos[m.chave]) movimentos[m.chave] = [];
    movimentos[m.chave].push(m);
  });
  Object.keys(movimentos).forEach(function (k) {
    movimentos[k].sort(function (a, b) {
      return String(b.quando).localeCompare(String(a.quando));
    });
  });
}

/* ---------------------------------------------------------------------------
 * AS LINHAS QUE SEGUEM A CARTEIRA, E O CADEADO QUE SEGURA AS OUTRAS
 *
 * Ele fechou o desenho em 09/09/2026, e a frase dele e a especificacao inteira:
 * "os que eu digito voce nao consegue ler, e os da carteira pode atualizar
 * automatico os lancamentos ou retiradas".
 *
 * Duas linhas da carteira dele explicam por que precisa das duas metades:
 *
 *   USDC  92,371847  veio da carteira Solana, tem mint. Eu sei ler. Se ele
 *                    gastar 20, a linha tem que virar 72 sozinha.
 *
 *   BTC   0,0731945  digitado. O Bitcoin dele NAO esta na Solana — nao tenho
 *                    como ver. Se eu lesse a carteira e mexesse nesta linha,
 *                    zeraria o Base solida dele, e o metodo mandaria comprar
 *                    Bitcoin que ele ja tem.
 *
 * A linha so segue se tiver MINT (eu sei o que procurar) e nao estiver travada.
 * Sem mint nao ha cadeado nenhum a oferecer: nao ha o que travar.
 *
 * E A REGRA QUE MANDA EM TUDO: ausencia so vale como prova quando a leitura
 * ficou COMPLETA. getTokenAccountsByOwner pode falhar e devolver lista vazia
 * sem erro nenhum — e lista vazia e indistinguivel de "ele tirou tudo". Se eu
 * tratasse as duas igual, um no fora do ar zeraria a carteira dele na tela.
 * ------------------------------------------------------------------------- */
var saldos = null;           // mint -> quantidade, da ultima leitura
var saldosCompleto = false;  // a leitura ficou inteira?
var saldosBuscadosEm = 0;
var saldosRecado = null;     // { txt, classe }

function podeSeguir(f) {
  return !!(f && f.mint && f.token);
}

function seguindo(f) {
  return podeSeguir(f) && f.segue_carteira !== false;
}

/* Aplica os saldos lidos nas linhas que seguem. Devolve o que MUDOU, pra a
 * tela poder contar — mudanca de quantidade em silencio e mudanca que ele
 * descobre depois, olhando um total que nao fecha. */
/* DUAS LINHAS DO MESMO TOKEN SEGUINDO A CARTEIRA = saldo contado duas vezes.
 *
 * Ele chegou nisto sozinho, perguntando o que era possível: "posso usar USDT ou
 * USDC das minhas carteiras e mantê-los como reserva de oportunidade também".
 * Pode — a caixinha é sobre a finalidade, não sobre o token. Mas se as duas
 * linhas seguirem a carteira, cada uma recebe o SALDO INTEIRO, porque a
 * carteira tem um número só de USDC e não sabe que ele quis dividir. O total
 * dele apareceria dobrado, e as porcentagens do B.A.R.C.A. se refariam por cima
 * de um total errado.
 *
 * O aviso é a resposta certa, e não repartir sozinho: repartir exigiria eu
 * adivinhar quanto vai pra cada uma, e adivinhar sobre o dinheiro dele é
 * exatamente o que este app não faz. Ele tranca uma no cadeado e diz o quanto.
 *
 * Compara por MINT, não pelo símbolo. Dois tokens diferentes podem se chamar
 * "USDC" na Solana — o endereço é quem não repete. */
function tokensRepetidos(linhas) {
  var por = {}, ordem = [], fora = [];
  (linhas || []).forEach(function (f) {
    if (!seguindo(f)) return;
    var m = String(f.mint);
    if (!por[m]) { por[m] = { mint: m, token: f.token, linhas: [] }; ordem.push(m); }
    por[m].linhas.push(f);
  });
  ordem.forEach(function (m) { if (por[m].linhas.length > 1) fora.push(por[m]); });
  return fora;
}

function aplicarSaldos(linhas, lidos, completo) {
  var mudou = [];

  /* SEM OBJETO DE SALDOS NAO HOUVE LEITURA. null nao e carteira vazia — e a
     busca que nem chegou a acontecer. Sem esta linha, uma falha de rede
     entrava aqui como "nao achei nenhum token" e zerava tudo. O teste pegou
     isto antes de ir ao ar; e o mesmo engano da lista vazia, um passo antes. */
  if (!lidos || typeof lidos !== "object") return mudou;

  (linhas || []).forEach(function (f) {
    if (!seguindo(f)) return;

    var tem = !!(lidos && Object.prototype.hasOwnProperty.call(lidos, f.mint));

    /* NAO ACHEI ESTE TOKEN. Se a leitura ficou completa, ele tirou tudo — e
       zerar e o certo, foi o que ele pediu. Se a leitura falhou em algum
       pedaco, eu simplesmente nao sei, e nao mexo. */
    if (!tem && !completo) return;

    var novo = tem ? Number(lidos[f.mint]) : 0;
    if (!isFinite(novo) || novo < 0) return;

    var antes = Number(f.quantidade);
    if (isFinite(antes) && Math.abs(antes - novo) < 1e-12) return;

    f.quantidade = novo;
    mudou.push({
      chave: f.chave, token: f.token,
      de: isFinite(antes) ? antes : null, para: novo,
      sumiu: !tem,
    });
  });
  return mudou;
}

/* Le os saldos e aplica. Devolve true se alguma linha mudou. */
async function seguirCarteira() {
  if (!carteiraSolana) return false;
  if (!(fatias || []).some(seguindo)) return false;

  var agora = Date.now();
  if (agora - saldosBuscadosEm < 60000) return false;
  saldosBuscadosEm = agora;

  try {
    var r = await fetch("/api/saldos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ carteira: carteiraSolana }),
    });
    if (!r.ok) { saldosRecado = null; return false; }
    var d = await r.json();

    saldos = d.saldos || null;
    saldosCompleto = !!d.completo;

    var mudou = aplicarSaldos(fatias, saldos, saldosCompleto);

    /* O QUE MUDOU É DITO. Quantidade que anda sozinha e em silêncio é
       quantidade que ele descobre depois, num total que não fecha. */
    if (mudou.length) {
      saldosRecado = {
        txt: mudou.map(function (m) {
          return m.sumiu
            ? m.token + " saiu da carteira (era " + numeroDeToken(m.de) + ")"
            : m.token + ": " + numeroDeToken(m.de) + " → " + numeroDeToken(m.para);
        }).join(" · "),
        classe: "bom",
      };
      return true;
    }
    saldosRecado = null;
    return false;
  } catch (e) {
    return false;
  }
}

/* Grava o cadeado na hora, sozinho.
 *
 * Não espera o Salvar: é controle de segurança. Se ele trava o USDC e fecha o
 * app antes de salvar, o cadeado sumiria e a próxima leitura mexeria na linha
 * — o cadeado teria falhado justamente no caso em que existe. */
function travarLinha(f, segue) {
  if (!f || !f.chave) return;
  var antes = f.segue_carteira;
  f.segue_carteira = segue;
  desenhar();

  comAuth("/rest/v1/rpc/travar_linha", {
    method: "POST",
    body: JSON.stringify({ qual: f.chave, segue: segue }),
  }).then(function (r) {
    if (r.ok) {
      /* Destravou: relê agora, senão ele espera até um minuto pra ver efeito. */
      if (segue) { saldosBuscadosEm = 0; seguirCarteira().then(function () { desenhar(); }); }
      return;
    }
    return r.text().then(function (t) {
      f.segue_carteira = antes;
      saldosRecado = {
        txt: /não achei essa linha|nao achei essa linha/i.test(t)
          ? "Salve a carteira primeiro — esta linha ainda não existe no banco."
          : "Não consegui gravar o cadeado agora.",
        classe: "ruim",
      };
      desenhar();
    });
  }).catch(function () {
    f.segue_carteira = antes;
    saldosRecado = { txt: "Não consegui gravar o cadeado agora.", classe: "ruim" };
    desenhar();
  });
}

/* ---------------------------------------------------------------------------
 * A POSICAO MUDOU DE TAMANHO — foi ele que mexeu
 *
 * Em 09/09/2026 ele depositou US$ 10 na Orca e US$ 10 na Kamino direto na
 * plataforma, e perguntou: "se eu so adicionar la, nao atualiza na minha
 * carteira?". O valor atualizava; o "quanto voce pos", nao. Descobrir quanto
 * tinha entrado de verdade deu uma investigacao de quatro transacoes
 * decodificadas na mao — e o numero final, US$ 9,38, nao era nem os US$ 10 que
 * ele achava que tinha posto.
 *
 * Nao precisava. A LIQUIDEZ de uma posicao da Orca e a QUANTIDADE DE CTOKENS
 * da Kamino so mudam quando ele deposita ou saca:
 *
 *   preco andando        nao mexe
 *   taxa acumulando      nao mexe (fica guardada separada, fora da posicao)
 *   juro da Kamino       nao mexe (quem sobe e o cambio, nao a quantidade)
 *
 * Entao tamanho diferente da ultima olhada quer dizer UMA coisa so: ele mexeu.
 * A tela pergunta, com o valor ja calculado, e ele confirma num toque.
 *
 * PERGUNTA, NAO LANCA SOZINHA. Um aporte que aparece sem ele mandar e um numero
 * que ele nao reconhece na conta do proprio dinheiro — e a conta de "quanto
 * rendeu" e justamente a que ele usa pra decidir.
 * ------------------------------------------------------------------------- */
var tamanhos = null;         // chave -> { tamanho, valor } da ultima olhada
var mudancas = {};           // chave -> o que mudou desde entao
var mudancaOcupada = null;   // a chave que esta gravando agora

/* Quanto vale a mudanca de tamanho, em dolar.
 *
 * Regra de tres pelo valor de AGORA: se a posicao vale V com tamanho T, cada
 * unidade de tamanho vale V/T. Isso e exato pra Kamino (cTokens x cambio) e
 * uma boa aproximacao pra Orca dentro da faixa.
 *
 * E uma ESTIMATIVA, e a tela diz isso. O valor exato dependeria do preco no
 * instante do deposito, que eu nao sei — mas errar por centavos num numero que
 * ele confere e revisa e muito melhor que nao ter numero nenhum. */
/* A CONTA SUMIU: fechou, ou o endereço está errado?
 *
 * A diferença é toda: posição fechada é dinheiro que voltou pra carteira e
 * precisa de conta final; endereço errado é um engano de digitação que nunca
 * leu nada.
 *
 * O que separa os dois é a MEMÓRIA: se em algum momento eu li um tamanho dessa
 * linha, ela existiu — então sumir agora é fechamento. Se nunca li nada, o
 * endereço provavelmente está errado desde o começo.
 *
 * É a mesma distinção que já salvou este radar duas vezes em outros lugares:
 * lista vazia não é o mesmo que busca que falhou, e saldo ausente não é o mesmo
 * que saldo zero. Aqui ela aparece pela terceira vez, e agora tem nome. */
function fechouNaPlataforma(f) {
  if (!f || !f.posicao || linhaFechada(f)) return false;
  var p = posicoes[f.posicao];
  if (!p || !p.naoExiste) return false;
  var antes = tamanhos && tamanhos[f.chave];
  return !!(antes && antes.tamanho);
}

function mudancaDeTamanho(antes, pos) {
  if (!antes || !pos || !pos.tamanho) return null;
  var t0 = String(antes.tamanho || ""), t1 = String(pos.tamanho || "");
  if (!t0 || t0 === t1) return null;

  var n0, n1;
  try { n0 = BigInt(t0); n1 = BigInt(t1); } catch (e) { return null; }
  if (n1 === n0) return null;

  var cresceu = n1 > n0;
  var valor = Number(pos.valor);
  if (!isFinite(valor) || !(valor > 0) || n1 === 0n) {
    /* Fechou a posicao: o tamanho foi a zero e nao ha valor de que tirar a
       regra de tres. O valor guardado da ultima olhada e a melhor resposta. */
    return {
      tipo: "saque", fechou: true,
      quanto: Number(antes.valor) || null,
      tamanho: t1,
    };
  }

  /* A CONTA, e ela e uma multiplicacao so.
   *
   * A posicao vale V com tamanho n1, entao cada unidade dela vale V/n1.
   * As unidades que se mexeram sao |n1 - n0|. Logo:
   *
   *     quanto = |n1 - n0| x valor / n1
   *
   * Vale igual pros dois lados — deposito e saque — e o teste cobra isso. Eu
   * tinha escrito uma divisao a mais no caso do saque, e ela so nao aparecia
   * quando ele sacava exatamente metade: num saque de um quarto dava US$ 37,50
   * onde a resposta era US$ 25.
   *
   * A razao sai em BigInt antes de virar Number: a liquidez de uma posicao da
   * Orca passa de 10^18, e dividir dois inteiros desse tamanho ja convertidos
   * perderia justamente os digitos que interessam. */
  var razao = Number((n1 > n0 ? n1 - n0 : n0 - n1) * 1000000n / n1) / 1000000;
  var quanto = valor * razao;

  return {
    tipo: cresceu ? "aporte" : "saque",
    fechou: false,
    quanto: Math.abs(quanto),
    tamanho: t1,
  };
}

/* Le os tamanhos guardados e compara com o que a cadeia diz agora.
 *
 * Na PRIMEIRA olhada de uma posicao nao ha com o que comparar: anota e cala.
 * Perguntar ali seria perguntar sobre um deposito que talvez seja de meses
 * atras — e a primeira pergunta que um app faz e a que ensina se vale a pena
 * ler as proximas. */
async function olharTamanhos() {
  var linhas = (fatias || []).filter(function (f) {
    /* Linha FECHADA nao entra: a conta da posicao pode nem existir mais na
       blockchain, e perguntar de novo so traria erro pra tela. */
    /* Ou a posição foi lida (tem tamanho), ou ela sumiu depois de ter sido
       lida — que é o fechamento, e é justamente o caso que mais precisa de
       conta final. Antes só o primeiro entrava, e o fechamento passava batido. */
    return f && f.chave && f.posicao && !f.fechada_em &&
      ((posicoes[f.posicao] && posicoes[f.posicao].tamanho) || fechouNaPlataforma(f));
  });
  if (!linhas.length) return false;

  /* Ja veio junto com a carteira. Se nem isso chegou, nao ha com o que
     comparar e nao ha o que perguntar. */
  if (tamanhos === null) return false;

  var mexeu = false;
  for (var i = 0; i < linhas.length; i++) {
    var f = linhas[i];
    /* Posição que sumiu vira tamanho zero: é o que ela é de fato, e é o que
       mudancaDeTamanho já sabia tratar ("fechou: true"). Sem esta linha, o
       fechamento nunca chegava lá, porque não havia leitura nenhuma. */
    var pos = fechouNaPlataforma(f)
      ? { tamanho: "0", valor: 0 }
      : posicoes[f.posicao];
    var antes = tamanhos[f.chave];

    if (!antes) {
      /* Primeira vez que vejo esta posicao: anota e nao pergunta nada. */
      await anotarTamanho(f.chave, pos.tamanho, pos.valor);
      continue;
    }

    var m = mudancaDeTamanho(antes, pos);
    if (m && !mudancas[f.chave]) { mudancas[f.chave] = m; mexeu = true; }
  }
  return mexeu;
}

function anotarTamanho(chaveDaLinha, tamanho, valor) {
  tamanhos = tamanhos || {};
  tamanhos[chaveDaLinha] = { chave: chaveDaLinha, tamanho: tamanho, valor: valor };
  return comAuth("/rest/v1/rpc/anotar_tamanho", {
    method: "POST",
    body: JSON.stringify({ qual: chaveDaLinha, novo: String(tamanho), quanto: valor ?? null }),
  }).catch(function () {});
}

/* Ele confirmou: vira lancamento de verdade, e o tamanho novo passa a ser o
 * marco. As duas coisas juntas — anotar sem lancar perderia o aporte, lancar
 * sem anotar perguntaria de novo na proxima abertura. */
function confirmarMudanca(f) {
  var m = mudancas[f.chave];
  if (!m || mudancaOcupada) return;
  mudancaOcupada = f.chave;
  desenhar();

  var lanc = {
    chave: f.chave, tipo: m.tipo, valor: Number(m.quanto.toFixed(6)),
    moeda: "USD", valor_usd: Number(m.quanto.toFixed(6)),
    quando: new Date().toISOString().slice(0, 10),
    nota: m.fechou ? "posição fechada" : "detectado pela mudança de tamanho",
  };

  /* A COMPOSIÇÃO EM TOKENS, sem a qual não há conta de IL.
   *
   * A mudança de tamanho diz que fração da posição entrou ou saiu; aplicada à
   * composição de agora, dá quantos de cada token se mexeram. É aproximação
   * — a composição exata seria a do instante do depósito — mas erra por
   * centavos quando a leitura é logo depois, que é o caso: o radar pergunta
   * na primeira abertura seguinte.
   *
   * Sem isto o IL não fecha, e um aporte sem composição estraga a conta
   * inteira da linha. */
  var pos2 = posicoes[f.posicao];
  if (pos2 && pos2.tipo !== "emprestimo" && pos2.preco > 0 && Number(pos2.valor) > 0) {
    var fracao = m.quanto / Number(pos2.valor);
    lanc.qtd_a = Number((pos2.qtdA * fracao).toFixed(9));
    lanc.qtd_b = Number((pos2.qtdB * fracao).toFixed(9));
    lanc.simbolo_a = pos2.simboloA;
    lanc.simbolo_b = pos2.simboloB;
    lanc.preco = Number(pos2.preco.toFixed(8));
  }

  comAuth("/rest/v1/rpc/registrar_movimento", {
    method: "POST", body: JSON.stringify({ dados: lanc }),
  }).then(function (r) {
    if (!r.ok) {
      mudancaOcupada = null;
      movRecado = { chave: f.chave, txt: "Não consegui lançar agora.", classe: "ruim" };
      desenhar();
      return;
    }
    return anotarTamanho(f.chave, m.tamanho, posicoes[f.posicao] && posicoes[f.posicao].valor)
      .then(function () {
        /* FECHOU: a linha vira histórico na hora. Se eu deixasse pra depois,
           a próxima abertura tentaria ler uma posição que não existe mais e a
           linha ficaria eternamente em "lendo a posição na Solana…". */
        if (!m.fechou) return null;
        return comAuth("/rest/v1/rpc/fechar_linha", {
          method: "POST",
          body: JSON.stringify({ qual: f.chave, quando: new Date().toISOString().slice(0, 10) }),
        }).then(function (r) {
          if (r.ok) f.fechada_em = new Date().toISOString().slice(0, 10);
        }).catch(function () {});
      })
      .then(recarregarMovimentos)
      .then(function () {
        delete mudancas[f.chave];
        mudancaOcupada = null;
        movRecado = {
          chave: f.chave,
          txt: m.fechou ? "posição fechada, e a conta final está aí em cima." : "lançado.",
          classe: "bom",
        };
        desenhar();
      });
  }).catch(function () {
    mudancaOcupada = null;
    movRecado = { chave: f.chave, txt: "Não consegui lançar agora.", classe: "ruim" };
    desenhar();
  });
}

/* Ele disse que nao foi ele: so anota o tamanho novo e para de perguntar.
 * Nao lanca nada — e a resposta certa pra "eu nao sei o que foi isso". */
function ignorarMudanca(f) {
  var m = mudancas[f.chave];
  if (!m) return;
  delete mudancas[f.chave];
  anotarTamanho(f.chave, m.tamanho, posicoes[f.posicao] && posicoes[f.posicao].valor);
  desenhar();
}

var carteiraSolana = null;   // o endereço guardado dele
var achados = null;          // o resultado da varredura, ou null
var escolhas = {};           // chave da linha achada -> { marcado, caixa }
var importando = false;

function chaveDoAchado(tipo, x) {
  if (tipo === "pool") return "p:" + x.endereco;
  if (tipo === "emprestimo") return "e:" + x.endereco + ":" + x.reserva;
  return "t:" + x.mint;
}

/* A caixinha que o método sugere para cada coisa achada.
 *
 * Bitcoin é a base sólida — é a letra B e a aula não deixa dúvida. Stablecoin é
 * caixa. Pool e empréstimo são renda passiva por definição. O resto é ativo
 * volátil, que é onde o método põe altcoin. */
var STABLES = ["USDC", "USDT", "DAI", "PYUSD", "USDE", "FDUSD", "USDS", "BRZ", "USDG"];
var BITCOINS = ["BTC", "WBTC", "CBBTC", "TBTC", "ZBTC"];

function caixaSugerida(tipo, x) {
  if (tipo !== "token") return "renda";
  var s = String(x.simbolo || "").toUpperCase();
  if (BITCOINS.indexOf(s) >= 0) return "base";
  if (STABLES.indexOf(s) >= 0) return "caixa";
  return "volatil";
}

/* O que já está na carteira dele, para não oferecer duas vezes. */
function jaTenho(tipo, x) {
  var lista = fatias || [];
  if (tipo === "pool") return lista.some(function (f) { return f.posicao === x.endereco; });
  if (tipo === "emprestimo") return lista.some(function (f) { return f.pool_id === x.reserva; });
  return lista.some(function (f) { return f.mint === x.mint; });
}

async function varrerCarteira(endereco) {
  importando = true;
  desenhar();
  try {
    var r = await fetch("/api/carteira", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ carteira: endereco }),
    });
    achados = r.ok ? await r.json() : { erro: "não consegui procurar agora" };
  } catch (e) {
    achados = { erro: "não consegui falar com o radar agora" };
  }
  importando = false;

  /* Nada nasce marcado. É o pedido dele, e é a diferença entre uma ferramenta
     que te ajuda e uma que decide por você. */
  escolhas = {};
  if (achados && !achados.erro) {
    var por = function (tipo, lista) {
      (lista || []).forEach(function (x) {
        if (jaTenho(tipo, x)) return;
        escolhas[chaveDoAchado(tipo, x)] = { marcado: false, caixa: caixaSugerida(tipo, x), tipo: tipo, x: x };
      });
    };
    por("pool", achados.posicoes);
    por("emprestimo", achados.emprestimos);
    por("token", achados.tokens);
  }
  desenhar();
}

function importarEscolhidos() {
  var quantos = 0;
  var hoje = new Date().toISOString().slice(0, 10);
  Object.keys(escolhas).forEach(function (k) {
    var e = escolhas[k];
    if (!e.marcado) return;
    var x = e.x;
    quantos++;

    if (e.tipo === "pool") {
      fatias.push({
        fatia: x.simboloA + "/" + x.simboloB + " na " + x.onde,
        caixa: e.caixa, token: null, quantidade: null, valor: null, moeda: null,
        pool_id: null, onde: x.onde, posicao: x.endereco,
        /* Pela guarda, igual ao caminho de colar o endereco a mao. Eram DOIS
           caminhos de gravacao e eu so tinha consertado um — foi o teste que
           achou o outro, nao eu. Caminho que grava sem passar pela guarda e
           exatamente o jeito de o erro voltar depois de consertado. */
        valor_entrada: baseDeEntrada(x) == null ? null : arredFino(baseDeEntrada(x)),
        data_entrada: baseDeEntrada(x) == null ? null : hoje,
        mint: null, segue_carteira: true,
      });
    } else if (e.tipo === "emprestimo") {
      /* Empréstimo entra como POSIÇÃO, igual à pool — e não como valor
         congelado, que foi o meu erro na primeira versão.

         O juro da Kamino não é pago em token novo: a quantidade de cTokens fica
         parada e o CÂMBIO sobe. Gravar o valor em dólar congelaria os US$ 10,00
         para sempre enquanto o dinheiro rendia calado. Guardando o endereço, o
         valor se refaz a cada abertura; guardando o câmbio da entrada, dá pra
         dizer quanto rendeu — e essa conta é exata, não é estimativa. */
      fatias.push({
        fatia: x.simbolo + " na " + x.onde,
        caixa: e.caixa, token: null, quantidade: null,
        valor: null, moeda: null,
        pool_id: x.reserva, onde: x.onde + " · " + x.mercado,
        posicao: x.endereco,
        /* Emprestimo sempre foi dolar (uma perna so, e ela tem cotacao), mas
           passa pela mesma porta: guarda com excecao e guarda que se esquece. */
        valor_entrada: baseDeEntrada(x) == null ? null : arredFino(baseDeEntrada(x)),
        data_entrada: baseDeEntrada(x) == null ? null : hoje,
        cambio_entrada: x.cambio,
        mint: null, segue_carteira: true,
      });
    } else {
      fatias.push({
        fatia: x.simbolo, caixa: e.caixa,
        token: x.simbolo, quantidade: x.quantidade,
        valor: null, moeda: null, pool_id: null, onde: null, posicao: null,
        valor_entrada: null, data_entrada: null,
        mint: x.mint, segue_carteira: true,
      });
    }
  });
  achados = null;
  escolhas = {};
  renumerar();
  precosPedidos = null;
  posicoesPedidas = null;
  return quantos;
}

var buscaPool = null;   // { alvo: "lancar" | numero da linha, termo, achados, estado }

function abrirBuscaDePool(alvo, termo) {
  buscaPool = { alvo: alvo, termo: termo || "", achados: [], estado: "" };
}

async function procurarPool() {
  if (!buscaPool || !buscaPool.termo.trim()) return;
  buscaPool.estado = "procurando";
  desenhar();
  try {
    var r = await fetch("/api/piscinas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ busca: buscaPool.termo }),
    });
    var d = r.ok ? await r.json() : { achados: [] };
    buscaPool.achados = d.achados || [];
    buscaPool.estado = buscaPool.achados.length ? "" : "nada";
  } catch (e) {
    buscaPool.achados = [];
    buscaPool.estado = "erro";
  }
  desenhar();
}

function fichaDaPool(p) {
  var r = p.rendimento || {};
  return esc(p.projeto || "") + " " + esc(p.simbolo || "") +
    ' <span class="onde">' + esc(p.rede || "") + "</span>" +
    '<div class="lvAviso" style="padding:0">' +
      fmt(p.tvl) + " de TVL · " + (Number(p.apy) || 0).toFixed(1) + "% ao ano" +
      (r.texto ? " · " + esc(r.texto) : "") +
    "</div>";
}

function blocoDeBuscaDePool(alvo) {
  var meu = buscaPool && String(buscaPool.alvo) === String(alvo);
  if (!meu) {
    return '<button class="btBuscarPool" data-alvo="' + alvo + '">procurar a pool</button>';
  }

  /* Endereco da Solana neste campo quase sempre e o Position Address, colado
     no lugar errado — que foi exatamente o que aconteceu com ele. Dizer "nao
     achei" seria verdade e nao ajudaria em nada. */
  var pareceSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(buscaPool.termo || "").trim());

  var lista = "";
  if (pareceSolana) {
    lista = '<div class="lcDica">Isso parece o <b>endereço de uma posição</b> na Solana, e não uma pool do DefiLlama. ' +
      'Cole ele no campo <b>endereço da posição</b>, logo acima — de lá o radar lê a faixa e o valor sozinho.' +
      '<br><button class="btBuscarPool" id="btUsarComoPosicao">usar como endereço da posição</button></div>';
  }
  else if (buscaPool.estado === "procurando") lista = '<div class="lcDica">procurando…</div>';
  else if (buscaPool.estado === "nada") lista = '<div class="lcDica">Não achei. Tente o par e a rede — "eth usdc base" — ou cole o link da pool no DefiLlama.</div>';
  else if (buscaPool.estado === "erro") lista = '<div class="lcDica">Não consegui procurar agora. Tente daqui a pouco.</div>';
  else if (buscaPool.achados.length) {
    lista = '<div class="achados">' + buscaPool.achados.map(function (p, i) {
      return '<button class="achado" data-i="' + i + '">' + fichaDaPool(p) + "</button>";
    }).join("") + "</div>";
  }

  return '<div class="buscaPool">' +
    '<div class="lcQuanto">' +
      '<input class="bpTermo" value="' + esc(buscaPool.termo) + '" placeholder="eth usdc base, ou o link do DefiLlama">' +
      '<button class="botao fraco" id="btProcurarPool">procurar</button>' +
    "</div>" +
    '<div class="lcDica">Serve o par escrito, o link do DefiLlama, ou o endereço de um dos tokens. O endereço da pool em si não serve — o DefiLlama não guarda esse número.</div>' +
    lista +
  "</div>";
}

function poolEscolhida(id, aoTrocar) {
  var p = poolDoRadar(id);
  return '<div class="poolLigada">' +
    (p ? fichaDaPool(p) : '<span class="onde">pool ' + esc(id) + "</span>") +
    '<button class="' + aoTrocar + '">trocar</button>' +
  "</div>";
}

/* ---------------------------------------------------------------------------
 * O ESTADO DA TELA — e a decisão que consertou três bugs de uma vez.
 *
 * A versão anterior montava a lista de lançamentos LENDO OS CAMPOS DA TELA a
 * cada clique. Isso pareceu esperto e custou caro:
 *
 *   · linha sem nome sumia da leitura, então a posição na tela e a posição na
 *     lista deixavam de bater, e o botão de apagar apagava a linha errada;
 *   · trocar a moeda reescrevia os números da tela, e ler de volta gravava
 *     dólar como real (o bug dos "100 que viraram R$ 100");
 *   · com a tela em modo de leitura não há campo nenhum, e ler a tela
 *     apagaria a carteira inteira.
 *
 * Agora é ao contrário: a lista fatias é a verdade, e cada campo escreve NELA quando
 * o Rayakuza digita. oninput só dispara quando alguém digita de verdade — nunca
 * quando a tela se redesenha — então não existe mais o risco de um redesenho
 * virar uma gravação. A tela só lê o dado; nunca o contrário.
 * ------------------------------------------------------------------------- */

var editando = null;   // a caixinha aberta para edição, ou null
var lancando = null;   // o formulário de lançar, ou null

/* A ordem tem que continuar sendo a posição na lista: o painel de somar/tirar/
   mover procura por ela, e o banco guarda por ela. */
/* A CHAVE ESTAVEL DE UMA LINHA, gerada num lugar so.
 *
 * O salvamento apaga tudo e reinsere — e o id de cada linha e NOVO a cada vez.
 * E o que torna o salvamento uma transacao so, e foi assim que ele parou de
 * perder lancamentos; o preco e que nada duradouro pode se pendurar no id. O
 * historico de aportes sumiria no primeiro salvamento.
 *
 * A chave nasce aqui, viaja no jsonb, e volta igual. Sobrevive a renomear a
 * linha, a reordenar e ao delete+insert.
 *
 * E nasce DENTRO do renumerar de proposito. Sao seis lugares que criam linha
 * (importar pool, importar emprestimo, importar token, ligar posicao, lancar
 * token, lancar dinheiro) e todos chamam renumerar depois. Gerar a chave em
 * cada um seria seis chances de esquecer uma — e a linha esquecida nao daria
 * erro nenhum: ela so nao guardaria historico, calada. */
function novaChave() {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) {}
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function renumerar() {
  (fatias || []).forEach(function (f, i) {
    f.ordem = i;
    if (!f.chave) f.chave = novaChave();
  });
}

function nomeDaCaixa(chave) {
  var c = caixaDe(chave);
  return c ? c.nome : "sem caixinha";
}

function linhaTemConteudo(f) {
  return !!(f && ((f.token && String(f.token).trim()) ||
                  (f.posicao && String(f.posicao).trim()) ||
                  (f.fatia && String(f.fatia).trim())));
}

/* ---------------------------------------------------------------------------
 * LANÇAR — um lugar só, três perguntas.
 *
 * Pedido dele em 08/09/2026:
 *
 *   "quando eu comprar mais BTC, não tem como fazer isso e escolher a parte do
 *    portfólio que ele está indo? eu posso estar holdando BTC como ativo
 *    sólido, e posso ter uma parte para renda passiva em pools wbtc"
 *
 * Antes disto havia onze botões de "+" espalhados, um par dentro de cada
 * caixinha, e ele tinha que descobrir a caixinha certa ANTES de dizer o que
 * estava lançando. Invertido: primeiro o quê, depois quanto, depois onde.
 *
 * O mesmo token em duas caixinhas são duas linhas, de propósito. Para o método
 * BTC parado e WBTC emprestado não são a mesma coisa: um é preservação, o outro
 * é renda com risco de contrato. Somar os dois esconderia justamente a conta
 * que o B.A.R.C.A. quer que ele veja.
 * ------------------------------------------------------------------------- */

function aplicarLancamento(l) {
  if (!l || !l.caixa) return { erro: "Escolha em qual caixinha isto entra." };
  var onde = nomeDaCaixa(l.caixa);

  /* Uma pool com endereço é uma posição lida da blockchain; sem endereço, é
     uma linha de valor com o nome que ele deu. Mesmo botão, dois caminhos. */
  if (l.tipo === "pool" && String(l.posicao || "").trim()) {
    var endereco = String(l.posicao).trim();
    var lido = posicoes[endereco];
    if (!lido) return { erro: "Ainda não li essa posição. Espere um instante e tente de novo." };
    if (lido.erro) return { erro: lido.erro };

    var repetida = (fatias || []).find(function (f) { return f.posicao === endereco; });
    if (repetida) {
      return { erro: "Essa posição já está na carteira, em " + nomeDaCaixa(repetida.caixa) + "." };
    }

    var apelido = String(l.nome || "").trim() ||
      (lido.simboloA + "/" + lido.simboloB + " na Orca");
    /* A foto da entrada, tirada AGORA. Sem ela nao ha de que subtrair depois, e
       inventar uma base seria inventar o lucro dele — mas so em DOLAR, veja
       baseDeEntrada. Base na unidade errada e pior que base nenhuma. */
    var baseEmDolar = baseDeEntrada(lido);
    fatias.push({
      fatia: apelido, caixa: l.caixa, token: null, quantidade: null,
      valor: null, moeda: null, pool_id: null, onde: "Orca",
      posicao: endereco,
      valor_entrada: baseEmDolar == null ? null : arredFino(baseEmDolar),
      data_entrada: baseEmDolar == null ? null : new Date().toISOString().slice(0, 10),
    });
    return {
      texto: apelido + " ligada em " + onde + ": " +
        (baseEmDolar == null
          ? "nao consegui ler o valor em dolar (falta o preco de " +
            esc(lido.unidade || "um dos tokens") + "), entao nao gravei base de entrada"
          : dinheiroNa(baseEmDolar, "USD")) +
        (lido.leitura ? ", " + lido.leitura.texto : "") + ".",
    };
  }

  if (l.tipo === "token") {
    var s = String(l.token || "").trim().toUpperCase();
    if (!s) return { erro: "Escreva o símbolo do token — BTC, ETH, WBTC." };
    var q = Number(l.quanto);
    if (!(q > 0)) return { erro: "Escreva quantos, em número maior que zero." };

    var jaTem = (fatias || []).find(function (f) {
      return f.caixa === l.caixa && String(f.token || "").toUpperCase() === s;
    });
    if (jaTem) {
      var antes = Number(jaTem.quantidade) || 0;
      jaTem.quantidade = arredQtd(antes + q);
      return { texto: s + " em " + onde + ": " + numeroDeToken(antes) + " + " +
        numeroDeToken(q) + " = " + numeroDeToken(jaTem.quantidade) + "." };
    }
    fatias.push({
      fatia: s, caixa: l.caixa, token: s, quantidade: arredQtd(q),
      valor: null, moeda: null, pool_id: null, onde: null,
    });
    return { texto: numeroDeToken(q) + " " + s + " lançado em " + onde + "." };
  }

  var nome = String(l.nome || "").trim();
  if (!nome) return { erro: "Dê um nome a esta linha — é como você vai achá-la depois." };
  var v = Number(l.quanto);
  if (!(v > 0)) return { erro: "Escreva quanto, em número maior que zero." };
  var moeda = l.moeda || moedaVista;

  /* Casa pelo nome dentro da mesma caixinha. "reserva" em Caixa e "reserva" em
     Aprender são coisas diferentes, e somar as duas seria inventar. */
  var achada = (fatias || []).find(function (f) {
    return f.caixa === l.caixa && !f.token &&
      String(f.fatia || "").trim().toLowerCase() === nome.toLowerCase();
  });
  if (achada) {
    var r = somarEm(achada, v, moeda, cotacao());
    if (r.erro) return r;
    if (l.tipo === "pool") {
      if (String(l.onde || "").trim()) achada.onde = String(l.onde).trim();
      if (String(l.pool_id || "").trim()) achada.pool_id = String(l.pool_id).trim();
    }
    return { texto: nome + " em " + onde + ": " + r.texto };
  }

  fatias.push({
    fatia: nome, caixa: l.caixa, token: null, quantidade: null,
    valor: arred(v), moeda: moeda,
    pool_id: l.tipo === "pool" ? (String(l.pool_id || "").trim() || null) : null,
    /* Texto vazio, e não nulo, quando é pool sem plataforma escrita.
     *
     * É o que marca a linha como pool. Com nulo nos dois campos ela viraria
     * indistinguível de uma linha de dinheiro, e ele perderia o lugar de colar
     * o id do DefiLlama depois — que é justamente o que liga a linha ao que o
     * radar já mede. */
    onde: l.tipo === "pool" ? String(l.onde || "").trim() : null,
  });
  return { texto: nome + " lançado em " + onde + ": " + dinheiroNa(v, moeda) + "." };
}

/* O que vai acontecer, escrito antes de acontecer.
 *
 * Existe porque somar na linha errada é invisível: o total muda, fica
 * plausível, e ninguém confere. Dizer "vai somar em base sólida, que fica com
 * 0,06" transforma um erro silencioso num erro que se lê antes de apertar. */
function previaDoLancamento(l) {
  if (!l || !l.caixa) return "Escolha a caixinha.";
  var onde = nomeDaCaixa(l.caixa);

  if (l.tipo === "pool" && String(l.posicao || "").trim()) {
    var e = String(l.posicao).trim();
    var lido = posicoes[e];
    if (!lido) return "Vou ler essa posição na Solana quando você sair do campo.";
    if (lido.erro) return lido.erro;
    return "Vai entrar em " + onde + " como " + lido.simboloA + "/" + lido.simboloB +
      ", " + dinheiroNa(lido.valor, "USD") + ". O valor se refaz sozinho, você não digita nada.";
  }

  if (l.tipo === "token") {
    var s = String(l.token || "").trim().toUpperCase();
    var q = Number(l.quanto);
    if (!s) return "Escreva o símbolo do token.";
    if (!(q > 0)) return "Escreva quantos.";
    var p = precoDoToken(s);
    var vale = p ? " — cerca de " + dinheiroNa(converterV(q * p.preco, "USD", moedaVista, cotacao()), moedaVista) : "";
    var jaTem = (fatias || []).find(function (f) {
      return f.caixa === l.caixa && String(f.token || "").toUpperCase() === s;
    });
    if (jaTem) {
      var antes = Number(jaTem.quantidade) || 0;
      return "Vai somar em " + onde + ", que já tem " + numeroDeToken(antes) + " " + s +
        " e fica com " + numeroDeToken(arredQtd(antes + q)) + vale + ".";
    }
    return "Vai criar uma linha nova de " + s + " em " + onde + vale + ".";
  }

  var nome = String(l.nome || "").trim();
  var v = Number(l.quanto);
  if (!nome) return "Dê um nome a esta linha.";
  if (!(v > 0)) return "Escreva quanto.";
  var achada = (fatias || []).find(function (f) {
    return f.caixa === l.caixa && !f.token &&
      String(f.fatia || "").trim().toLowerCase() === nome.toLowerCase();
  });
  return achada
    ? "Vai somar em " + nome + ", dentro de " + onde + "."
    : "Vai criar " + nome + " em " + onde + ".";
}

function chipsDeCaixa(escolhida) {
  return CAIXAS.map(function (cx) {
    return '<button class="chip' + (cx.chave === escolhida ? " ativo" : "") +
      '" data-caixa="' + cx.chave + '">' + cx.letra + ' ' + esc(cx.nome.toLowerCase()) + '</button>';
  }).join("");
}

function fichaDoAchado(tipo, x) {
  if (tipo === "pool") {
    var l = x.leitura || {};
    return "<b>" + esc(x.simboloA + "/" + x.simboloB) + '</b> <span class="onde">' + esc(x.onde) + "</span>" +
      '<div class="impNota">' + dinheiroNa(x.valor, "USD") +
      (l.texto ? " · " + esc(l.texto) : "") + "</div>";
  }
  if (tipo === "emprestimo") {
    return "<b>" + esc(x.simbolo || "?") + '</b> <span class="onde">' + esc(x.onde) + "</span>" +
      '<div class="impNota">' + dinheiroNa(x.valor, "USD") + " · " + esc(x.mercado) + "</div>";
  }
  return "<b>" + esc(x.simbolo) + '</b> <span class="onde">' + numeroDeToken(x.quantidade) + "</span>" +
    '<div class="impNota">' + (x.valor == null ? "sem preço" : dinheiroNa(x.valor, "USD")) + "</div>";
}

function listaDeAchados(titulo, tipo, lista) {
  var chaves = (lista || []).map(function (x) { return chaveDoAchado(tipo, x); })
    .filter(function (k) { return escolhas[k]; });
  if (!chaves.length) return "";

  return '<div class="impTitulo">' + titulo + "</div>" +
    chaves.map(function (k) {
      var e = escolhas[k];
      return '<div class="impLinha">' +
        '<input type="checkbox" class="impMarca" data-k="' + esc(k) + '"' + (e.marcado ? " checked" : "") + ">" +
        '<div class="impMeio">' + fichaDoAchado(tipo, e.x) + "</div>" +
        '<select class="impCaixa" data-k="' + esc(k) + '">' +
          CAIXAS.map(function (cx) {
            return '<option value="' + cx.chave + '"' + (cx.chave === e.caixa ? " selected" : "") + ">" +
              cx.letra + " " + esc(cx.nome.toLowerCase()) + "</option>";
          }).join("") +
        "</select>" +
      "</div>";
    }).join("");
}

function blocoDeCopias() {
  if (!mostrarCopias) {
    return '<button class="botao fraco" id="btVerCopias">cópias de segurança</button>';
  }
  if (copias === null) {
    return '<div class="copias"><div class="impCabeca">Cópias de segurança</div>' +
      '<div class="lcDica">buscando…</div></div>';
  }
  if (!copias.length) {
    return '<div class="copias">' +
      '<div class="impCabeca">Cópias de segurança</div>' +
      '<div class="lcDica">Ainda não há nenhuma. A primeira é guardada no seu próximo Salvar — ' +
      'e a partir daí toda vez que você salvar, o estado anterior fica gravado aqui.</div>' +
      '<button class="botao fraco" id="btFecharCopias">fechar</button></div>';
  }
  return '<div class="copias">' +
    '<div class="impCabeca">Cópias de segurança</div>' +
    '<div class="lcDica">Uma cópia da carteira inteira é guardada a cada vez que você salva. ' +
    'Voltar para uma delas também guarda a de agora — nenhum caminho é sem volta.</div>' +
    copias.map(function (c) {
      return '<div class="copiaLinha">' +
        '<div><b>' + esc(new Date(c.quando).toLocaleString("pt-BR")) + '</b>' +
          '<div class="impNota">' + c.quantas + ' linha(s)</div></div>' +
        '<button class="botao fraco btVoltarPara" data-id="' + esc(c.id) + '">voltar para esta</button>' +
      '</div>';
    }).join("") +
    '<button class="botao fraco" id="btFecharCopias" style="margin-top:12px">fechar</button>' +
  '</div>';
}

function blocoDeImportar() {
  /* Encolhido vira uma linha só. Some enquanto ele não precisa, e uma linha
     ainda diz que existe — esconder de vez seria fazer ele procurar. */
  if (encolhida("importar") && !achados && !importando) {
    return '<div class="importar encolhido" id="abrirImportar">' +
      '<div class="impCabeca">' +
        '<span class="seta">▸</span> Importar carteira ' +
        '<span class="onde">' + (carteiraSolana ? "Solana · ligada" : "Solana") + '</span>' +
      '</div>' +
    '</div>';
  }

  if (importando) {
    return '<div class="importar"><div class="impCabeca">Procurando na Solana…</div>' +
      '<div class="abTrilho"><i></i></div></div>';
  }

  if (achados && achados.erro) {
    return '<div class="importar"><div class="impCabeca">Importar carteira</div>' +
      '<div class="lcDica ruim">' + esc(achados.erro) + '</div>' +
      '<button class="botao fraco" id="btFecharImp">fechar</button></div>';
  }

  if (achados) {
    var quantos = Object.keys(escolhas).filter(function (k) { return escolhas[k].marcado; }).length;
    var nada = !Object.keys(escolhas).length;
    return '<div class="importar">' +
      '<div class="impCabeca">O que achei na sua carteira</div>' +
      (nada
        ? '<div class="lcDica">Não achei nada de novo — o que está na sua carteira já está lançado aqui.</div>'
        : '<div class="lcDica"><b>Nada entra sozinho.</b> Marque o que quer e diga em qual caixinha vai.</div>') +
      (achados.avisos || []).map(function (a) { return '<div class="lcDica ruim">' + esc(a) + "</div>"; }).join("") +
      listaDeAchados("Pools de liquidez", "pool", achados.posicoes) +
      listaDeAchados("Empréstimos", "emprestimo", achados.emprestimos) +
      listaDeAchados("Tokens parados", "token", achados.tokens) +
      '<div class="impBotoes">' +
        '<button class="botao" id="btImportar"' + (quantos ? "" : " disabled") + ">Importar " +
          (quantos ? "os " + quantos + " marcados" : "os marcados") + "</button>" +
        '<button class="botao fraco" id="btFecharImp">agora não</button>' +
      "</div>" +
      '<div class="impRodape">A caixinha ao lado é sugestão, não decisão: bitcoin em B, stablecoin em C, pool e empréstimo em R. Troque à vontade.</div>' +
    "</div>";
  }

  return '<div class="importar">' +
    '<div class="impCabeca abreImportar"><span class="seta">▾</span> Importar carteira ' +
      '<span class="onde">Solana</span></div>' +
    '<input class="impEndereco" value="' + esc(carteiraSolana || "") + '" placeholder="cole o endereço da sua carteira">' +
    '<div class="impRodape">Só o endereço público. Ele deixa VER o que você tem, nunca mover. Nunca cole frase secreta nem chave privada — aqui nem em lugar nenhum.</div>' +
    '<div class="impBotoes">' +
      '<button class="botao" id="btVarrer">' + (carteiraSolana ? "procurar novidades" : "procurar") + "</button>" +
      (carteiraSolana ? '<button class="botao fraco" id="btEsquecerCarteira">esquecer</button>' : "") +
    "</div>" +
  "</div>";
}

function blocoDeLancar() {
  if (!lancando) {
    return '<div class="lancarLinha"><button class="botao" id="btAbrirLancar">+ Lançar</button></div>';
  }
  var l = lancando;
  /* Três, e não quatro.
   *
   * "Posição" era um tipo separado e ele mandou juntar: "pool e posição é a
   * mesma coisa, está repetindo; sempre que usar pool eu vou colar a posição".
   * Está certo — para quem investe, é uma coisa só. A diferença era técnica, e
   * diferença técnica não é motivo para um botão a mais na tela dele.
   *
   * Então Pool pergunta o endereço primeiro. Com endereço, não pergunta mais
   * nada: nome, valor e o par saem da blockchain. Sem endereço, aparecem os
   * campos à mão — que ainda servem para empréstimo e para pool que não é de
   * faixa concentrada. */
  var tipos = [
    { chave: "token", rotulo: "Token" },
    { chave: "dinheiro", rotulo: "Dinheiro" },
    { chave: "pool", rotulo: "Pool" },
  ];

  var campos;
  if (l.tipo === "token") {
    var p = precoDoToken(String(l.token || "").trim().toUpperCase());
    campos =
      '<div class="lcRot">Qual token</div>' +
      '<input class="lcTok" value="' + esc(l.token || "") + '" placeholder="BTC" maxlength="12">' +
      '<div class="lcDica">' + (p
        ? "1 " + esc(String(l.token).toUpperCase()) + " = " +
          dinheiroNa(converterV(p.preco, "USD", moedaVista, cotacao()), moedaVista) + " agora"
        : "o símbolo, como aparece na corretora") + '</div>' +
      '<div class="lcRot">Quanto</div>' +
      '<div class="lcQuanto">' +
        '<input class="lcVal" type="number" min="0" step="any" inputmode="decimal" value="' +
          (l.quanto == null ? "" : l.quanto) + '" placeholder="0,01">' +
        '<span class="lcUn">' + esc(String(l.token || "token").toUpperCase()) + '</span>' +
      '</div>';
  } else {
    var ehPool = l.tipo === "pool";
    var lido = ehPool && l.posicao ? posicoes[String(l.posicao).trim()] : null;
    var ligada = lido && !lido.erro;

    campos = ehPool
      ? '<div class="lcRot">Endereço da posição</div>' +
        '<input class="lcPosicao" value="' + esc(l.posicao || "") + '" placeholder="cole o Position Address">' +
        '<div class="lcDica">Na Orca: abra a posição e, em <b>Position Details</b>, copie o <b>Position Address</b>. É público e não move nada — nunca cole frase secreta nem chave privada, aqui nem em lugar nenhum.</div>' +
        (l.lendoPosicao ? '<div class="lcDica">lendo na Solana…</div>' : "") +
        (lido && lido.erro ? '<div class="lcDica ruim">' + esc(lido.erro) + '</div>' : "") +
        (ligada
          ? '<div class="poolLigada" style="display:block">' +
              "<b>" + esc(lido.simboloA + "/" + lido.simboloB) + "</b> · " + dinheiroNa(lido.valor, "USD") +
              barraDaFaixa(lido) +
            "</div>"
          : "")
      : "";

    /* Com a posição ligada não se pergunta mais nada: nome, valor e o par vêm
       da blockchain, e um campo de valor ao lado de um valor lido só convida a
       digitar um número que vai ser ignorado. */
    if (!ligada) {
      campos +=
        (ehPool ? '<div class="lcSep">ou, se não tiver endereço — empréstimo, pool sem faixa:</div>' : "") +
        '<div class="lcRot">Nome</div>' +
        '<input class="lcNome" value="' + esc(l.nome || "") + '" placeholder="' +
          (ehPool ? "WBTC emprestado na Aave" : "reserva de emergência") + '">' +
        '<div class="lcRot">Quanto</div>' +
        '<div class="lcQuanto">' +
          '<input class="lcVal" type="number" min="0" step="0.01" inputmode="decimal" value="' +
            (l.quanto == null ? "" : l.quanto) + '" placeholder="0,00">' +
          '<button class="mBt2' + ((l.moeda || moedaVista) === "BRL" ? " ativo" : "") + '" data-m="BRL">R$</button>' +
          '<button class="mBt2' + ((l.moeda || moedaVista) === "USD" ? " ativo" : "") + '" data-m="USD">US$</button>' +
        '</div>' +
        (ehPool
          ? '<div class="lcRot">Onde</div>' +
            '<input class="lcOnde" value="' + esc(l.onde || "") + '" placeholder="Aave, Aerodrome, Binance...">' +
            '<div class="lcRot">Qual pool <span class="onde">opcional</span></div>' +
            (l.pool_id
              ? poolEscolhida(l.pool_id, "lcTrocarPool")
              : blocoDeBuscaDePool("lancar"))
          : "");
    }
  }

  return '<div class="lancar">' +
    '<div class="lcTopo"><span class="lcTit">Lançar</span>' +
      '<button class="lcFechar" id="btFecharLancar" title="fechar">×</button></div>' +
    '<div class="lcTipos">' + tipos.map(function (t) {
      return '<button class="chip' + (l.tipo === t.chave ? " ativo" : "") +
        '" data-tipo="' + t.chave + '">' + t.rotulo + '</button>';
    }).join("") + '</div>' +
    campos +
    '<div class="lcRot">Em qual caixinha</div>' +
    '<div class="lcCaixas">' + chipsDeCaixa(l.caixa) + '</div>' +
    '<div class="lcPrevia" id="lcPrevia">' + esc(previaDoLancamento(l)) + '</div>' +
    '<button class="botao" id="btLancar">Lançar</button>' +
  '</div>';
}

/* ---------------------------------------------------------------------------
 * MODO VER — o padrão. Nenhum campo de digitar.
 * ------------------------------------------------------------------------- */

/* Quanto mudou desde que ele ligou a posicao ao radar.
 *
 * E o "Total PnL" que a Orca mostra, e sai de uma subtracao: valor de hoje
 * menos o valor do dia em que ele ligou. So aparece quando existe a foto da
 * entrada — sem ela nao ha de que subtrair, e inventar uma base seria inventar
 * o lucro dele.
 *
 * Repare o que este numero NAO inclui: as taxas que a pool ja pagou. Elas
 * exigem reler as contas de tick da pool, e ainda nao estao aqui. Entao o texto
 * diz "no valor", nao "no total" — a diferenca importa. */
/* ---------------------------------------------------------------------------
 * O QUE ENTROU, O QUE SAIU, E O QUE FOI COLHIDO
 *
 * Pedido dele em 08/09/2026: "vamos fazer, e importante isso tambem, tanto de
 * por quando de retirar ne, ou coletar yield pendente".
 *
 * Ele nomeou os tres, e o terceiro e o que quase ficou de fora. Cada um mexe
 * na conta de um jeito diferente, e cada um que falta e a ferramenta mentindo
 * sobre o dinheiro dele:
 *
 *   APORTE   sobe o custo. Sem registrar, por mais US$ 100 numa pool faz a
 *            posicao valer 100 a mais sem custo nenhum: lucro do nada.
 *
 *   SAQUE    desce o custo. Sem registrar, tirar metade da posicao aparece
 *            como prejuizo de metade — e bem na hora em que ele decidiu
 *            realizar, que e a pior hora pra ver um numero vermelho errado.
 *
 *   COLHEITA NAO mexe no custo. E lucro que estava pendente e virou dinheiro
 *            na mao. Sem registrar, colher zera o "rendeu X em taxas" que a
 *            tela le da cadeia e o ganho SOME: o momento em que ele realiza o
 *            lucro vira o momento em que a ferramenta diz que nao houve lucro
 *            nenhum. E o mais cruel dos tres, porque acontece justamente
 *            quando deu certo.
 *
 * A conta inteira:
 *
 *     custo     = aportes - saques
 *     realizado = colheitas
 *     ganho     = (vale hoje + pendente + realizado) - custo
 *
 * Estas funcoes rodam no navegador e sao arrancadas daqui por
 * testar-movimento.js — o mesmo arranjo de mexerNaCarteira. Uma copia so, e
 * o teste prova exatamente o codigo que vai ao ar.
 * ------------------------------------------------------------------------- */

var TIPOS_DE_MOVIMENTO = ["aporte", "saque", "colheita"];
var SINAL_DO_MOVIMENTO = { aporte: "+", saque: "−", colheita: "✓" };
var NOME_DO_MOVIMENTO = { aporte: "aporte", saque: "saque", colheita: "colheita" };

/* Quanto um lancamento vale em dolar.
 *
 * valor_usd e congelado no dia do lancamento, e e ele que manda: o cambio de
 * hoje nao pode reescrever quanto ele aportou em marco.
 *
 * Devolve null quando nao da pra saber — e null aqui NUNCA vira zero. Um
 * aporte em real que virasse zero sumiria do custo e reapareceria como lucro. */
function movEmDolar(m) {
  if (!m) return null;
  var usd = Number(m.valor_usd);
  if (isFinite(usd) && usd > 0) return usd;
  if ((m.moeda || "USD") === "USD") {
    var v = Number(m.valor);
    return (isFinite(v) && v > 0) ? v : null;
  }
  return null;
}

function primeiroAporte(lista) {
  var datas = [];
  (lista || []).forEach(function (m) {
    if (m.tipo === "aporte" && m.quando) datas.push(String(m.quando));
  });
  datas.sort();
  return datas[0] || null;
}

/* A soma dos lancamentos de uma linha.
 *
 * semCambio conta os que nao deu pra converter. Ele existe pra a tela poder
 * DIZER que ficaram de fora, em vez de mostrar um custo menor que o real com
 * cara de certo. */
function resumoDosMovimentos(movs) {
  var lista = [];
  (movs || []).forEach(function (m) {
    if (m && TIPOS_DE_MOVIMENTO.indexOf(m.tipo) >= 0) lista.push(m);
  });

  var aportes = 0, saques = 0, colheitas = 0, semCambio = 0;
  var quantos = { aporte: 0, saque: 0, colheita: 0 };

  lista.forEach(function (m) {
    quantos[m.tipo]++;
    var v = movEmDolar(m);
    if (v == null) { semCambio++; return; }
    if (m.tipo === "aporte") aportes += v;
    else if (m.tipo === "saque") saques += v;
    else colheitas += v;
  });

  return {
    aportes: aportes, saques: saques, colheitas: colheitas,
    custo: aportes - saques,
    realizado: colheitas,
    quantos: quantos,
    total: lista.length,
    semCambio: semCambio,
    desde: primeiroAporte(lista)
  };
}

/* O RESUMO QUE NUNCA FICA MUDO.
 *
 * Aqui mora um conserto, e vale escrever o erro inteiro porque ele e de um
 * tipo que eu repeti.
 *
 * Antes desta versao, a linha "quanto rendeu desde a entrada" aparecia sempre
 * que houvesse valor_entrada. Eu troquei por uma conta melhor, feita dos
 * lancamentos — e a conta melhor tem tres jeitos novos de nao aparecer: a
 * linha sem chave, a busca dos lancamentos que falhou, e o lancamento que
 * nao existe.
 *
 * Em 09/09/2026 o terceiro aconteceu de verdade: as chaves foram regeneradas
 * por um app velho, os aportes ficaram orfaos, e a linha do resultado sumiu da
 * tela dele. Ele reparou na hora — "nao mostra mais rendimentos igual antes" —
 * e eu respondi que era o modo editar. Estava errado: era isto.
 *
 * Entao valor_entrada vira o CHAO. Sem nenhum lancamento, ele conta como o
 * primeiro aporte e a linha diz o que sempre disse. Trocar uma coisa que
 * sempre funcionou por uma melhor que as vezes nao aparece e piorar, mesmo
 * quando a conta nova esta certa. */
/* A BASE DE ENTRADA SO PODE SER CONGELADA EM DOLAR.
 *
 * Esta funcao existe por causa de um erro que ficou GUARDADO, e por isso
 * sobreviveu ao conserto do erro.
 *
 * Em 09/09 a pool SOL/ETH aparecia valendo US$ 0,04. A conta velha somava
 * "quantidade de A vezes o preco da pool, mais a quantidade de B" — o que da o
 * valor da posicao na moeda B. Com B = USDC isso e dolar; com B = ETH, o
 * resultado sao 0,042342 ETH, e o rotulo "US$" era uma mentira de unidade.
 *
 * Consertei a conta no mesmo dia. Mas a foto da entrada ja tinha sido tirada
 * COM A CONTA ERRADA e gravada no banco. No dia seguinte a tela mostrava
 * "+US$ 101,94 (+240756,87%)": o valor de hoje, certo, em dolar, dividido por
 * uma base que estava em ETH.
 *
 * A LICAO, e ela e maior que este arquivo: consertar a conta nao conserta o
 * numero que ela ja gravou. Todo conserto de calculo pede a pergunta "isto ja
 * escreveu alguma coisa que ficou?" — e um numero errado guardado e pior que
 * um numero errado na tela, porque some do lugar onde a gente estava olhando.
 *
 * A defesa e nao aceitar numero sem unidade declarada. Quando a leitura diz
 * que nao esta em dolar, a gente NAO guarda base nenhuma: uma posicao sem
 * linha de resultado e um buraco visivel; uma base em unidade errada e um
 * lucro de 240 mil por cento que parece um numero. */
function baseDeEntrada(pos) {
  if (!pos) return null;
  var v = Number(pos.valor);
  if (!(v > 0)) return null;
  /* Sem o campo e o normal antigo (emprestimo, e toda leitura anterior a
     este campo existir): esses sempre foram dolar. Com o campo, ele manda. */
  if (pos.unidade != null && pos.unidade !== "USD") return null;
  return v;
}

function resumoDaLinhaInteira(movs, valorEntrada, dataEntrada) {
  var resumo = resumoDosMovimentos(movs);
  if (resumo.total) return resumo;

  var base = Number(valorEntrada);
  if (!(base > 0)) return resumo;

  var deDentro = resumoDosMovimentos([{
    chave: "chao", tipo: "aporte", valor: base,
    moeda: "USD", valor_usd: base, quando: dataEntrada || null
  }]);
  /* Marcado, pra a tela poder dizer que este numero e a entrada original e
     nao um lancamento que ele fez. */
  deDentro.doValorDeEntrada = true;
  return deDentro;
}

/* O PRECO MEDIO DE COMPRA DE UM TOKEN.
 *
 * Ele perguntou: "precisa ver tambem se for token volatil ele pode valorizar ou
 * desvalorizar ne? isso importa?".
 *
 * Importava, e faltava. A linha do BTC mostrava "-1,4%" — o MERCADO nas ultimas
 * 24 horas — enquanto a posicao dele estava 11% abaixo do que ele pagou. Dois
 * numeros na mesma tela, um deles sem relacao nenhuma com o dinheiro dele.
 *
 * A conta e a de sempre da corretora: soma o que pagou, soma quantos tokens
 * recebeu, divide. Venda desconta dos dois lados.
 *
 *     preco medio = (pago nas compras - recebido nas vendas)
 *                   -----------------------------------------
 *                   (tokens comprados - tokens vendidos)
 *
 * O DINHEIRO DE CADA COMPRA VAI CONGELADO EM DOLAR, no cambio do dia dela.
 * Uma compra de R$ 100 em junho custou US$ 19,31 naquele dia; converter pelo
 * dolar de hoje reescreveria o passado e mexeria no preco medio a cada
 * oscilacao do cambio.
 *
 * A QUANTIDADE DA CARTEIRA PODE NAO BATER com a somada aqui — ele recebe troco
 * de swap, paga taxa de rede, transfere. Quando isso acontece a funcao DIZ, em
 * vez de fingir que o preco medio cobre tudo. */
function precoMedioDoToken(movimentos, quantidadeHoje) {
  var pagos = 0, recebidos = 0, comprados = 0, vendidos = 0, semQtd = 0, temAlgo = false;

  (movimentos || []).forEach(function (m) {
    if (!m || (m.tipo !== "aporte" && m.tipo !== "saque")) return;
    var v = movEmDolar(m);
    var q = Number(m.qtd_a);
    if (v == null) return;
    temAlgo = true;
    if (!isFinite(q) || q <= 0) { semQtd++; return; }
    if (m.tipo === "aporte") { pagos += v; comprados += q; }
    else { recebidos += v; vendidos += q; }
  });

  if (!temAlgo) return null;

  var qtd = comprados - vendidos;
  var custo = pagos - recebidos;
  if (!(qtd > 0)) return { semQtd: semQtd, custo: custo, qtd: qtd, medio: null };

  var q0 = Number(quantidadeHoje);
  return {
    semQtd: semQtd,
    custo: custo,
    qtd: qtd,
    medio: custo / qtd,
    /* A diferenca entre o que os lancamentos somam e o que ele tem de fato.
       Positiva quer dizer que chegou token sem lancamento. */
    sobra: isFinite(q0) ? q0 - qtd : null,
  };
}

/* A CONTA FINAL DE UMA POSICAO FECHADA — o "quanto fiquei quando sai".
 *
 * Pedido dele: "quando fechar a posicao faz sentido, porque vou saber quanto
 * rendeu ou se tive IL e perdi".
 *
 * E uma conta DIFERENTE da posicao aberta, e vale escrever por que.
 *
 * Na aberta eu comparo o que esta dentro contra o que ele teria segurando. Na
 * fechada nao ha nada dentro: tudo virou saque. Entao a comparacao passa a ser
 * entre o que ELE RECEBEU e o que teria se tivesse segurado — as duas coisas
 * avaliadas ao PRECO DO FECHAMENTO, que e o unico instante em que as duas
 * existem lado a lado.
 *
 *     HODL      = tokens que ele pos    x preco do fechamento
 *     recebido  = tokens que ele tirou  x preco do fechamento
 *     IL        = recebido - HODL
 *     resultado = IL + o que foi colhido de taxa
 *
 * E NAO LE MAIS A REDE. Fechar uma posicao da Orca queima o NFT e a conta some
 * da blockchain; depender dela seria a linha ficar pra sempre em "lendo a
 * posicao". Tudo aqui sai dos lancamentos. */
function contaDoFechamento(movimentos) {
  var aportes = [], saques = [], colhido = 0;
  (movimentos || []).forEach(function (m) {
    if (!m) return;
    if (m.tipo === "colheita") { colhido += Number(m.valor_usd) || 0; return; }
    if (m.tipo === "aporte") aportes.push(m);
    else if (m.tipo === "saque") saques.push(m);
  });
  if (!aportes.length || !saques.length) return null;

  /* O preco do fechamento e o do ULTIMO saque: e o instante em que ele saiu. */
  var ultimo = saques[saques.length - 1];
  var P = Number(ultimo.preco);

  var soma = function (lista, campo) {
    var t = 0, falta = 0;
    lista.forEach(function (m) {
      var v = Number(m[campo]);
      if (!isFinite(v)) { falta++; return; }
      t += v;
    });
    return { total: t, falta: falta };
  };
  var pa = soma(aportes, "qtd_a"), pb = soma(aportes, "qtd_b");
  var sa = soma(saques, "qtd_a"), sb = soma(saques, "qtd_b");

  var custo = 0, recebidoEmDolar = 0;
  aportes.forEach(function (m) { custo += Number(m.valor_usd) || 0; });
  saques.forEach(function (m) { recebidoEmDolar += Number(m.valor_usd) || 0; });

  var base = {
    custo: custo,
    recebido: recebidoEmDolar,
    colhido: colhido,
    /* O lucro em dolar: o que voltou mais o que foi colhido, menos o que ele
       pos. Esta conta sempre existe, mesmo sem composicao. */
    lucro: recebidoEmDolar + colhido - custo,
  };

  var faltando = pa.falta + pb.falta + sa.falta + sb.falta;
  if (faltando || !(P > 0)) return { ...base, faltando: faltando || 1 };

  var segurando = pa.total * P + pb.total;
  var recebido = sa.total * P + sb.total;
  return {
    ...base,
    faltando: 0,
    preco: P,
    postosA: pa.total, postosB: pb.total,
    simboloA: ultimo.simbolo_a, simboloB: ultimo.simbolo_b,
    segurando: segurando,
    recebidoEmTokens: recebido,
    il: recebido - segurando,
    resultado: (recebido - segurando) + colhido,
  };
}

/* ---------------------------------------------------------------------------
 * O IMPERMANENT LOSS — a conta que o curso ensina e que faltava
 *
 * Ele perguntou: "a carteira ja salva quanto eu tinha quando entrei na pool?
 * ai sim quando fechar a posicao faz sentido, porque vou saber quanto rendeu ou
 * se tive IL e perdi".
 *
 * A carteira salvava METADE. Guardava quanto ele pos em DOLAR, e com isso da
 * pra dizer quanto rendeu. Mas IL nao e "quanto entrou versus quanto saiu":
 *
 *     IL = o que a posicao vale HOJE  -  o que os mesmos tokens valeriam
 *                                        se ele tivesse so SEGURADO
 *
 * Pra essa conta e preciso saber QUAIS tokens entraram e QUANTOS. Valor em
 * dolar nao diz isso: US$ 9,92 podem ser 0,048 SOL + 4,97 USDC ou qualquer
 * outra combinacao, e cada uma se comporta diferente quando o preco anda.
 *
 * AS TRES LINHAS QUE O METODO SEPARA, e a razao de nao somar tudo num numero:
 *
 *   taxas      o que a pool pagou. Sempre positivo, e e o motivo de estar la.
 *   IL         o custo de a pool ter rebalanceado por voce enquanto o preco
 *              andava. Quase sempre negativo.
 *   resultado  taxas + IL. E a resposta da unica pergunta que importa:
 *              valeu mais a pena fazer a pool ou so ter segurado os dois?
 *
 * SEM COMPOSICAO NAO HA CONTA. Se algum aporte nao tiver os tokens gravados, a
 * funcao devolve null em vez de estimar — IL estimado por cima e pior que IL
 * nenhum, porque tem cara de resposta.
 * ------------------------------------------------------------------------- */
function contaDoIL(movimentos, pos) {
  if (!pos || pos.tipo === "emprestimo") return null;
  if (!pos.qtdA && !pos.qtdB) return null;
  var preco = Number(pos.preco);
  if (!(preco > 0)) return null;

  var lista = (movimentos || []).filter(function (m) {
    return m && (m.tipo === "aporte" || m.tipo === "saque");
  });
  if (!lista.length) return null;

  /* Todo aporte e saque precisa da composicao. Um so sem ela ja estraga a
     conta inteira — e melhor dizer que falta do que entregar numero torto. */
  var semComposicao = 0;
  var a = 0, b = 0;
  lista.forEach(function (m) {
    var qa = Number(m.qtd_a), qb = Number(m.qtd_b);
    if (!isFinite(qa) || !isFinite(qb) || (qa === 0 && qb === 0)) { semComposicao++; return; }
    var sinal = m.tipo === "aporte" ? 1 : -1;
    a += sinal * qa;
    b += sinal * qb;
  });
  if (semComposicao) return { faltando: semComposicao };

  var segurando = a * preco + b;          // se ele tivesse so segurado
  var naPosicao = pos.qtdA * preco + pos.qtdB;
  var taxas = (pos.taxas && isFinite(Number(pos.taxas.emDolar))) ? Number(pos.taxas.emDolar) : null;

  return {
    faltando: 0,
    qtdA: a, qtdB: b,
    simboloA: pos.simboloA, simboloB: pos.simboloB,
    preco: preco,
    segurando: segurando,
    naPosicao: naPosicao,
    il: naPosicao - segurando,
    taxas: taxas,
    resultado: taxas == null ? null : (naPosicao - segurando) + taxas,
  };
}

/* O resultado da linha, com as partes SEPARADAS.
 *
 * Separadas de proposito. Numa posicao concentrada o valor cai quando o preco
 * anda, mesmo com a pool rendendo bem — e o custo de ficar entre dois limites.
 * Somar tudo num numero so esconderia justamente o que o metodo quer que ele
 * veja: se a taxa esta pagando o que a faixa esta custando.
 *
 * pct vem null quando o custo nao e positivo. Se ele ja sacou mais do que pos,
 * dividir por esse custo daria um numero enorme, ou Infinity, que parece
 * informacao e nao e. */
function resultadoDaLinha(resumo, valeHoje, pendente) {
  if (!resumo || !resumo.total) return null;
  if (valeHoje == null || !isFinite(valeHoje)) return null;

  var temPendente = (pendente != null && isFinite(Number(pendente)));
  var pend = temPendente ? Number(pendente) : 0;

  var ganho = (valeHoje + pend + resumo.realizado) - resumo.custo;
  var pct = resumo.custo > 0 ? (ganho / resumo.custo) * 100 : null;

  return {
    custo: resumo.custo,
    realizado: resumo.realizado,
    pendente: temPendente ? pend : null,
    valeHoje: valeHoje,
    ganho: ganho,
    pct: pct,
    completa: (resumo.semCambio === 0 && temPendente),
    semCambio: resumo.semCambio
  };
}

/* Um lancamento e valido? Devolve o MOTIVO quando nao e.
 *
 * Motivo em texto, e nao false. "Nao deu certo" sem dizer por que e a mesma
 * familia de erro que apagou os lancamentos dele em silencio. */
function conferirMovimento(m) {
  if (!m) return "sem lancamento";
  if (TIPOS_DE_MOVIMENTO.indexOf(m.tipo) < 0) return "tipo desconhecido: " + m.tipo;
  var v = Number(m.valor);
  if (!isFinite(v) || v <= 0) return "o valor precisa ser maior que zero";
  if (m.moeda && m.moeda !== "USD" && m.moeda !== "BRL") return "moeda desconhecida: " + m.moeda;
  if (m.moeda === "BRL" && !(Number(m.valor_usd) > 0)) {
    return "sem a cotacao do dolar eu nao sei quanto isso e em dolar";
  }
  if (!m.chave) return "sem a linha a que ele pertence";
  return null;
}

/* O PENDENTE DE CADA TIPO DE POSICAO — e por que nao e o mesmo numero.
 *
 * POOL: o valor lido da cadeia NAO inclui as taxas nao recolhidas. Elas ficam
 *       guardadas separadas, e por isso entram na conta por fora.
 *
 * EMPRESTIMO: o valor lido JA inclui o juro, porque a quantidade de cTokens
 *       nao muda e quem sobe e o cambio. Somar o juro por fora aqui contaria
 *       o dinheiro dele duas vezes.
 *
 * Duas regras diferentes pro mesmo campo e exatamente o tipo de coisa que
 * vira erro silencioso, entao esta escrito num lugar so. */
function pendenteDaLinha(l) {
  var pos = l && l.posicao;
  if (!pos) return null;
  if (pos.tipo === "emprestimo") return 0;
  if (pos.taxas && isFinite(Number(pos.taxas.emDolar))) return Number(pos.taxas.emDolar);
  return null;
}

/* A composicao da posicao, em porcentagem de dolar.
 *
 * "100%% em cbBTC" quando um lado sumiu; "62%% cbBTC / 38%% USDC" quando os
 * dois existem. Sem as duas cotacoes, cai na quantidade crua — que e pior de
 * ler, e ainda assim melhor que inventar uma proporcao. */
function composicaoDaPosicao(pos) {
  var a = pos.ladoAUsd, b = pos.ladoBUsd;
  if (a == null || b == null || !(a + b > 0)) {
    return numeroDeToken(Number(pos.qtdA.toFixed(6))) + " " + pos.simboloA +
      " + " + numeroDeToken(Number(pos.qtdB.toFixed(2))) + " " + pos.simboloB;
  }
  var pa = (a / (a + b)) * 100;
  /* Meio por cento de sobra nao e "os dois lados": e poeira de arredondamento
     de uma posicao que atravessou a faixa inteira. Chamar isso de 99,6%% / 0,4%%
     esconde o fato que importa, que e ter ido toda pra um lado. */
  if (pa >= 99.5) return "tudo em " + esc(pos.simboloA);
  if (pa <= 0.5) return "tudo em " + esc(pos.simboloB);
  return pa.toFixed(0) + "% " + esc(pos.simboloA) + " · " +
    (100 - pa).toFixed(0) + "% " + esc(pos.simboloB);
}

function ganhoDaPosicao(l) {
  var f = l.f;
  if (!f.posicao || l.convertido == null || l.emUSD == null) return "";
  var pos = l.posicao;

  /* EMPRÉSTIMO: o juro é a diferença de câmbio, e essa conta é EXATA.
   *
   * A quantidade de cTokens não muda com o tempo — só quando ele deposita ou
   * saca. Então todo o ganho está na diferença entre o câmbio de hoje e o do
   * dia da entrada. Não é estimativa nem média: é o número. */
  if (pos && pos.tipo === "emprestimo" && Number(f.cambio_entrada) > 0 && pos.cambio > 0) {
    var deCambio = " · o câmbio saiu de " + Number(f.cambio_entrada).toFixed(8).replace(".", ",") +
      " para " + pos.cambio.toFixed(8).replace(".", ",");

    /* ESTA CONTA SÓ VALE COM UMA ENTRADA SÓ, e é por isso que ela é conferida
     * antes de aparecer.
     *
     * Ela assume que TODOS os cTokens foram comprados no câmbio de entrada.
     * Se ele depositar de novo mais tarde, os cTokens novos entraram por um
     * câmbio mais alto — e aplicar o crescimento inteiro sobre o saldo inteiro
     * conta juro sobre dinheiro que acabou de chegar. O número sai alto, e alto
     * de um jeito que parece certo.
     *
     * Ele perguntou antes de depositar: "conserte antes então". Então: com mais
     * de um aporte, ou com saque, a linha para de dar o número e aponta pra
     * conta de baixo — que soma os aportes dele e acerta em qualquer caso.
     *
     * As duas concordam quando há uma entrada só. Vale a álgebra: com Q cTokens
     * comprados a c0 e valendo c1 hoje, o juro é Q*c1 - Q*c0, que é exatamente
     * valor de hoje menos valor de entrada — a conta que a linha de baixo faz. */
    var resumoDaqui = resumoDosMovimentos(movsDaLinha(f.chave));
    var umaEntradaSo = resumoDaqui.quantos.aporte <= 1 && resumoDaqui.quantos.saque === 0;

    if (umaEntradaSo) {
      var cresceu = pos.cambio / Number(f.cambio_entrada) - 1;
      var juro = l.emUSD * (cresceu / (1 + cresceu));
      return '<div class="lvAviso sobe">+' + juro.toFixed(6).replace(".", ",") +
        " USD de juros desde " + esc(f.data_entrada || "que você ligou") +
        deCambio + "</div>";
    }

    return '<div class="lvAviso miudo">Você depositou mais de uma vez aqui' + deCambio +
      ". Quanto rendeu está na conta abaixo, que soma os seus aportes — " +
      "a conta pelo câmbio só serve pra uma entrada só.</div>";
  }

  /* POOL: duas linhas, e elas dizem coisas diferentes.
   *
   * A primeira é a taxa que a posição já rendeu e ainda não foi recolhida — o
   * "Pending Yield" da tela da Orca. É dinheiro dele, separado do valor da
   * posição, e por isso aparece sozinho.
   *
   * A segunda é a variação do valor desde a entrada. Numa posição concentrada
   * ela cai quando o preço anda, mesmo com a pool rendendo bem: é o custo de
   * ficar entre dois limites. Somar as duas num número só esconderia justamente
   * o que o método quer que ele veja. */
  var linhas = "";

  /* A TAXA VEM PRIMEIRO EM TOKEN, e o dólar depois, marcado como foto.
   *
   * Ele reparou: "ele farma os dois, tanto USDC quanto o token — mas o valor do
   * token é volátil, por isso não é tão exato".
   *
   * Está certo. A pool paga nas duas pernas, e a perna em SOL é um número que
   * só sobe. Quanto ela VALE em dólar muda a cada minuto sem ele fazer nada —
   * é o mesmo ciclo que mexe no resto da carteira. Liderar com o dólar era
   * pôr o número instável na frente do número exato.
   *
   * Então: primeiro o que ele ganhou de verdade, depois quanto isso dá hoje. */
  var t = pos && pos.taxas;
  if (t && (t.qtdA > 0 || t.qtdB > 0)) {
    /* AS TAXAS SO EM DOLAR.
     *
     * Vinham em token primeiro — "rendeu 0,00000334 cbbt + 0,244741 USDC" —
     * com o dolar depois. A razao era boa: o token e o numero exato e o dolar
     * oscila. Mas ele decidiu o contrario, e o argumento e melhor: "no futuro
     * isso vai se transformar tudo em dolar ou BTC, mas primeiro eles vao se
     * tornar dolar, entao essa e a informacao mais importante".
     *
     * Ele tem razao sobre o que a tela e pra que serve: dois numeros de token
     * com oito casas nao entram na cabeca de ninguem de bater o olho, e a
     * pergunta que se faz olhando uma posicao e "quanto isso vale". */
    if (t.emDolar != null) {
      linhas += '<div class="lvAviso sobe">taxas acumuladas: ' +
        dinheiroMiudo(t.emDolar, "USD") + "</div>";
    }
  }

  /* A conta do que ele pos e do que ele tirou saiu daqui pra
     resultadoDoDinheiro: ela valia so pra posicao, e vale pra qualquer linha. */
  return linhas;
}

/* Quanto vale hoje, em dolar, pra qualquer linha.
 *
 * Posicao e token ja trazem o dolar. Linha de dinheiro em real so tem o valor
 * na moeda que ele esta vendo, entao converte — e devolve null sem cotacao,
 * porque chutar o cambio seria chutar o lucro dele. */
function valeHojeEmDolar(l) {
  if (l.emUSD != null && isFinite(l.emUSD)) return l.emUSD;
  if (l.convertido == null) return null;
  return converterV(l.convertido, moedaVista, "USD", cotacao());
}

/* A CONTA: o que ele pos, o que tirou, o que colheu, e o que sobrou.
 *
 * Tres linhas no maximo, e a terceira so aparece quando falta alguma coisa —
 * porque uma conta que se sabe incompleta e obrigada a dizer isso. */
/* A LINHA DO TOKEN: preco medio e resultado.
 *
 * Substitui a conta generica quando a linha e de token com compras lancadas —
 * porque num token a pergunta e outra. Nao e "quanto isso vale hoje", e sim
 * "quanto eu paguei e onde esta agora". */
function resultadoDoToken(l) {
  var f = l.f;
  if (!f.token) return "";
  var pm = precoMedioDoToken(movsDaLinha(f.chave), f.quantidade);
  if (!pm || pm.medio == null) return "";

  var p = l.preco && l.preco.preco > 0 ? l.preco.preco : null;
  if (!p) {
    return '<div class="lvAviso miudo">preço médio de compra: ' +
      dinheiroMiudo(pm.medio, "USD") + " · sem o preço de hoje não dá pra dizer o resultado</div>";
  }

  var valeHoje = pm.qtd * p;
  var ganho = valeHoje - pm.custo;
  var pct = pm.custo > 0 ? (ganho / pm.custo) * 100 : null;
  var sobe = ganho >= 0;
  var ruido = Math.abs(ganho) < 0.005;

  var txt = '<div class="lvAviso ' + (ruido ? "" : (sobe ? "sobe" : "desce")) + '">' +
    (ruido ? "no zero a zero" : (sobe ? "+" : "") + dinheiroMiudo(ganho, "USD") +
      (pct == null ? "" : " (" + (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%)")) +
    " sobre " + dinheiroMiudo(pm.custo, "USD") + " que você pagou</div>";

  txt += '<div class="lvAviso miudo">seu preço médio ' + dinheiroMiudo(pm.medio, "USD") +
    " · hoje " + dinheiroMiudo(p, "USD") + "</div>";

  /* A CARTEIRA E OS LANCAMENTOS DISCORDAM — e isso precisa aparecer, senao o
     preco medio cobre menos token do que ele tem e o resultado sai por baixo. */
  if (pm.sobra != null && Math.abs(pm.sobra) > 1e-8) {
    txt += '<div class="lvAviso miudo">Os lançamentos somam ' +
      numeroDeToken(Number(pm.qtd.toFixed(8))) + " " + esc(String(f.token).toUpperCase()) +
      ", e a linha tem " + numeroDeToken(f.quantidade) +
      ". A conta acima é sobre o que está lançado.</div>";
  }
  if (pm.semQtd) {
    txt += '<div class="lvAviso miudo">' + pm.semQtd +
      " lançamento(s) sem a quantidade em token ficaram de fora do preço médio.</div>";
  }
  return txt;
}

function resultadoDoDinheiro(l) {
  var f = l.f;
  /* Token com compras lançadas tem conta própria — veja resultadoDoToken. */
  if (f.token) {
    var doToken = resultadoDoToken(l);
    if (doToken) return doToken;
  }
  var resumo = resumoDaLinhaInteira(movsDaLinha(f.chave), f.valor_entrada, f.data_entrada);
  if (!resumo.total) {
    /* Buraco COM AVISO. Uma posicao ligada, sem lancamento e sem base, some da
       conta de resultado sem explicar por que — e "sumiu" e o unico jeito de
       um numero errar sem ninguem ver. */
    if (f.posicao && !(Number(f.valor_entrada) > 0)) {
      return '<div class="lvAviso miudo">sem base de entrada: lance o aporte ' +
        "pra a conta de resultado aparecer</div>";
    }
    return "";
  }

  var r = resultadoDaLinha(resumo, valeHojeEmDolar(l), pendenteDaLinha(l));
  if (!r) return "";

  var txt = "";
  /* MEIO CENTAVO NÃO É PREJUÍZO.
   *
   * Ele viu na tela "US$ -0,000254 (-0.00%)" em vermelho, no empréstimo da
   * Kamino. Não era erro de conta: é o USDC valendo US$ 0,99997 em vez de um
   * dólar cravado. Mas mostrar um menos vermelho e "-0,00%" faz uma diferença
   * de um quarto de milésimo parecer notícia ruim — e um vermelho que não
   * significa nada ensina a ignorar os que significam. */
  var somenteRuido = Math.abs(r.ganho) < 0.005;
  var sobe = r.ganho >= 0;

  /* ENTROU, AGORA, E A DIFERENÇA — nessa ordem, e tudo em dólar.
   *
   * Era assim: "-US$ 1,08 (-1.08%) sobre US$ 100,26 da entrada desde
   * 2026-09-09". Ele pediu: "mostre o quanto entrei em dólar e quanto estou
   * atualmente em dólar, e depois quando eu fechar quanto lucrei ou se saí no
   * prejuízo".
   *
   * A diferença é de ordem de leitura. O formato antigo dava o RESULTADO
   * primeiro e o custo depois, dentro de uma frase — pra saber quanto a
   * posição vale hoje era preciso somar de cabeça. O novo põe os dois números
   * que existem no mundo (o que saiu do bolso e o que está lá agora) e deixa a
   * diferença por último, que é o que ela é: uma consequência dos dois. */
  var entrouAgora = '<b>' + dinheiroMiudo(r.custo, "USD") + '</b> → <b>' +
    dinheiroMiudo(r.valeHoje + (r.pendente || 0), "USD") + '</b>';

  if (somenteRuido) {
    txt += '<div class="lvAviso">' + entrouAgora + ' · no zero a zero' +
      (resumo.desde ? " · desde " + esc(resumo.desde) : "") + "</div>";
  } else {
    txt += '<div class="lvAviso ' + (sobe ? "sobe" : "desce") + '">' + entrouAgora +
      ' · ' + (sobe ? "+" : "") + dinheiroMiudo(r.ganho, "USD") +
      (r.pct == null ? "" : " (" + (r.pct >= 0 ? "+" : "") + r.pct.toFixed(1) + "%)") +
      (resumo.desde ? " · desde " + esc(resumo.desde) : "") + "</div>";
  }

  /* AS TRES LINHAS QUE O MÉTODO SEPARA, quando a posição é uma pool.
   *
   * "As taxas cobriram o IL?" é a pergunta que decide se valeu a pena fazer a
   * pool em vez de só segurar os dois tokens. Somar as duas num número só
   * esconderia exatamente isso. */
  var il = contaDoIL(movsDaLinha(f.chave), l.posicao);
  if (il && il.faltando === 0) {
    var bom = il.il >= 0;
    txt += '<div class="ilBloco">' +
      '<div class="ilLinha"><span>se você tivesse só segurado</span><b>' +
        dinheiroMiudo(il.segurando, "USD") + "</b></div>" +
      '<div class="ilLinha"><span>na pool, agora</span><b>' +
        dinheiroMiudo(il.naPosicao, "USD") + "</b></div>" +
      '<div class="ilLinha"><span>' + (bom ? "a favor da pool" : "custo do rebalanceamento (IL)") +
        '</span><b class="' + (bom ? "sobe" : "desce") + '">' +
        (bom ? "+" : "") + dinheiroMiudo(il.il, "USD") + "</b></div>" +
      (il.taxas != null
        ? '<div class="ilLinha"><span>taxas que a pool pagou</span><b class="sobe">+' +
            dinheiroMiudo(il.taxas, "USD") + "</b></div>" +
          '<div class="ilLinha total"><span>' +
            (il.resultado >= 0 ? "a pool saiu na frente" : "segurar teria sido melhor") +
            '</span><b class="' + (il.resultado >= 0 ? "sobe" : "desce") + '">' +
            (il.resultado >= 0 ? "+" : "") + dinheiroMiudo(il.resultado, "USD") + "</b></div>"
        : '<div class="ilLinha miudo"><span>não consegui ler as taxas, então falta a outra metade</span></div>') +
      '<div class="ilNota">Comparado a ter segurado ' + numeroDeToken(Number(il.qtdA.toFixed(8))) +
        " " + esc(il.simboloA) + " + " + numeroDeToken(Number(il.qtdB.toFixed(6))) +
        " " + esc(il.simboloB) + ", que foi o que você pôs.</div>" +
    "</div>";
  } else if (il && il.faltando) {
    txt += '<div class="lvAviso miudo">' + il.faltando +
      (il.faltando > 1 ? " lançamentos não têm" : " lançamento não tem") +
      " a composição em tokens, então não dá pra medir o IL desta pool.</div>";
  }

  /* A composicao so quando ha mais de um lancamento: numa linha com um aporte
     so ela repetiria o numero de cima com outras palavras. */
  if (resumo.total > 1) {
    var partes = [];
    if (resumo.quantos.aporte) partes.push(dinheiroMiudo(resumo.aportes, "USD") + " em " +
      resumo.quantos.aporte + (resumo.quantos.aporte > 1 ? " aportes" : " aporte"));
    if (resumo.quantos.saque) partes.push(dinheiroMiudo(resumo.saques, "USD") + " sacado em " +
      resumo.quantos.saque + (resumo.quantos.saque > 1 ? " vezes" : " vez"));
    if (resumo.quantos.colheita) partes.push(dinheiroMiudo(resumo.colheitas, "USD") + " já colhido em " +
      resumo.quantos.colheita + (resumo.quantos.colheita > 1 ? " colheitas" : " colheita"));
    txt += '<div class="lvAviso miudo">' + partes.join(" · ") + "</div>";
  }

  /* O QUE FALTA, dito em voz alta. */
  var faltas = [];
  if (r.semCambio) {
    faltas.push(r.semCambio + (r.semCambio > 1 ? " lançamentos ficaram" : " lançamento ficou") +
      " de fora por falta de câmbio");
  }
  if (r.pendente == null && f.posicao) faltas.push("as taxas ainda não entram nesta conta");
  if (faltas.length) txt += '<div class="lvAviso miudo">' + esc(faltas.join(" · ")) + "</div>";

  return txt;
}

/* O EXTRATO — fechado por padrao.
 *
 * Ele ja disse duas vezes o que acontece quando tudo fica exposto: "fica muito
 * poluido se tudo ficar exposto, deixa a opcao de encolher ou expandir". Entao
 * a linha mostra so um botao com a contagem, e o extrato abre no clique. */
/* DE ONDE VEM ESTE NUMERO — dito na linha, e nao adivinhado.
 *
 * Na tela, um valor lido da carteira agora e um que ele digitou ha duas
 * semanas tinham a mesma cara. Era o mesmo defeito que o "AGORA" do Bitcoin
 * tinha: numero parado com jeito de numero vivo.
 *
 * Nas linhas que PODEM seguir, o cadeado e um botao — a escolha e dele, porque
 * so ele sabe se tem USDC tambem numa corretora. Nas que nao podem, e so uma
 * marca: nao ha o que travar quando nao ha o que ler. */
/* A PERGUNTA, quando a posicao mudou de tamanho.
 *
 * Vem em destaque, acima do extrato: e a unica coisa na carteira que pede uma
 * resposta dele. E PERGUNTA, nunca lanca sozinha — um aporte que aparece sem
 * ele mandar e um numero que ele nao reconhece na conta do proprio dinheiro. */
function perguntaDeMudanca(f) {
  var m = mudancas[f.chave];
  if (!m) return "";
  var ocupado = mudancaOcupada === f.chave;

  var frase = m.fechou
    ? "Esta posição foi FECHADA. O último valor que li foi " + dinheiroMiudo(m.quanto, "USD") + "."
    : (m.tipo === "aporte"
        ? "Esta posição CRESCEU cerca de " + dinheiroMiudo(m.quanto, "USD") + " desde a última olhada."
        : "Esta posição DIMINUIU cerca de " + dinheiroMiudo(m.quanto, "USD") + " desde a última olhada.");

  return '<div class="mudanca2">' +
    '<div class="mudTxt">' + esc(frase) + " Foi você que " +
      (m.tipo === "aporte" ? "depositou" : "sacou") + "?</div>" +
    '<div class="mudNota">O valor é estimado pelo preço de agora — dá pra corrigir depois no extrato.</div>' +
    '<div class="mudBotoes">' +
      '<button class="btMudSim" data-chave="' + esc(f.chave) + '"' + (ocupado ? " disabled" : "") + ">" +
        (ocupado ? "lançando…"
          : (m.fechou ? "sim, fechar e lançar o saque"
                      : "sim, lançar " + (m.tipo === "aporte" ? "aporte" : "saque"))) + "</button>" +
      '<button class="btMudNao" data-chave="' + esc(f.chave) + '"' + (ocupado ? " disabled" : "") + ">não fui eu</button>" +
    "</div>" +
  "</div>";
}

function cadeadoDaLinha(f) {
  if (!f.token) return "";

  if (!podeSeguir(f)) {
    return '<span class="cadeado fixo" title="esta linha não está na carteira Solana — a quantidade é sua">' +
      "🔒 você digita</span>";
  }

  var segue = seguindo(f);
  return '<button class="cadeado ' + (segue ? "segue" : "travado") + '" data-chave="' + esc(f.chave) +
    '" title="' + (segue
      ? "a quantidade vem da sua carteira. Toque para travar e digitar você mesmo."
      : "você digita esta quantidade. Toque para voltar a seguir a carteira.") + '">' +
    (segue ? "🔓 segue a carteira" : "🔒 você digita") + "</button>";
}

function extratoDaLinha(l) {
  var f = l.f;
  if (!f.chave) return "";
  var lista = movsDaLinha(f.chave);
  var aberto = movAberto === f.chave;

  var cabeca = '<button class="btMov" data-chave="' + esc(f.chave) + '">' +
    (lista.length ? lista.length + (lista.length > 1 ? " lançamentos" : " lançamento") : "lançar aporte, saque ou colheita") +
    " " + (aberto ? "▴" : "▾") + "</button>";

  if (!aberto) return '<div class="mvBarra">' + cabeca + cadeadoDaLinha(f) + "</div>";

  var corpo = "";
  lista.forEach(function (m) {
    var v = movEmDolar(m);
    corpo += '<div class="mvItem">' +
      '<span class="mvSinal ' + esc(m.tipo) + '">' + SINAL_DO_MOVIMENTO[m.tipo] + "</span>" +
      '<span class="mvQuanto">' + dinheiroNa(Number(m.valor), m.moeda || "USD") +
        (v == null ? ' <b class="desce">sem câmbio</b>'
                   : (m.moeda === "BRL" ? " (" + dinheiroMiudo(v, "USD") + ")" : "")) +
      "</span>" +
      '<span class="mvQuando">' + esc(String(m.quando || "")) + "</span>" +
      '<span class="mvTipo">' + NOME_DO_MOVIMENTO[m.tipo] + "</span>" +
      '<button class="btMovApagar' + (movApagando === m.id ? " perguntando" : "") + '" data-id="' + esc(m.id) +
        '" data-chave="' + esc(f.chave) + '">' +
        (movApagando === m.id ? "apagar mesmo?" : "apagar") + "</button>" +
      "</div>";
  });

  corpo += '<div class="mvBotoes">' +
    '<button class="btMovNovo" data-chave="' + esc(f.chave) + '" data-tipo="aporte">+ aporte</button>' +
    '<button class="btMovNovo" data-chave="' + esc(f.chave) + '" data-tipo="saque">− saque</button>' +
    '<button class="btMovNovo" data-chave="' + esc(f.chave) + '" data-tipo="colheita">✓ colhi o rendimento</button>' +
    "</div>";

  if (movNovo && movNovo.chave === f.chave) corpo += formDeMovimento(f);

  if (movRecado && movRecado.chave === f.chave) {
    corpo += '<div class="mvRecado ' + esc(movRecado.classe || "") + '">' + esc(movRecado.txt) + "</div>";
  }

  return '<div class="mvBarra">' + cabeca + cadeadoDaLinha(f) + '</div><div class="mvCaixa">' + corpo + "</div>";
}

/* Relê os lançamentos do banco depois de mexer neles.
 *
 * RELÊ, em vez de mexer na lista daqui. O id de um lançamento novo quem gera é
 * o banco, e a tela precisa dele pra poder apagar. Empurrar o item na lista
 * local deixaria a tela e o banco parecidos mas não iguais — e parecido é o
 * que engana. */
function recarregarMovimentos() {
  return comAuth("/rest/v1/movimento?select=id,chave,tipo,valor,moeda,valor_usd,quando,nota,qtd_a,qtd_b,simbolo_a,simbolo_b,preco&order=quando.desc")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (lista) {
      if (lista === null) return false;
      arrumarMovimentos(lista);
      movsCarregados = true;
      return true;
    })
    .catch(function () { return false; });
}

function gravarMovimento() {
  if (!movNovo) return;
  var alvo = movNovo.chave;

  var m = {
    chave: alvo,
    tipo: movNovo.tipo,
    valor: Number(String(movNovo.valor).replace(",", ".")),
    moeda: movNovo.moeda,
    quando: movNovo.quando,
  };
  /* Congela o câmbio AGORA. Guardar só o valor em real faria a cotação de
     amanhã reescrever quanto ele aportou hoje. */
  m.valor_usd = m.moeda === "USD" ? m.valor : converterV(m.valor, "BRL", "USD", cotacao());

  var motivo = conferirMovimento(m);
  if (motivo) { movRecado = { chave: alvo, txt: motivo, classe: "ruim" }; desenhar(); return; }

  movRecado = { chave: alvo, txt: "gravando…", classe: "" };
  desenhar();

  comAuth("/rest/v1/rpc/registrar_movimento", {
    method: "POST",
    body: JSON.stringify({ dados: m }),
  }).then(function (r) {
    if (r.ok) return recarregarMovimentos().then(function () {
      movNovo = null;
      movRecado = { chave: alvo, txt: "lançado.", classe: "bom" };
      desenhar();
    });
    return r.text().then(function (t) {
      /* A linha só existe pro banco depois de salva. Dizer isso, e dizer o que
         fazer — "não achei essa linha" sozinho não ajuda ninguém. */
      var txt = /não achei essa linha|nao achei essa linha/i.test(t)
        ? "Esta linha ainda não foi salva. Aperte Salvar primeiro, depois lance o movimento."
        : "Não consegui gravar agora: " + String(t).slice(0, 120);
      movRecado = { chave: alvo, txt: txt, classe: "ruim" };
      desenhar();
    });
  }).catch(function (e) {
    movRecado = { chave: alvo, txt: "Não consegui gravar: " + String(e && e.message || e).slice(0, 100), classe: "ruim" };
    desenhar();
  });
}

function apagarMovimento(id, chaveDaLinha) {
  movApagando = null;
  movRecado = { chave: chaveDaLinha, txt: "apagando…", classe: "" };
  desenhar();

  comAuth("/rest/v1/rpc/apagar_movimento", {
    method: "POST",
    body: JSON.stringify({ qual: id }),
  }).then(function (r) {
    if (!r.ok) {
      movRecado = { chave: chaveDaLinha, txt: "Não consegui apagar agora.", classe: "ruim" };
      desenhar();
      return;
    }
    return recarregarMovimentos().then(function () {
      movRecado = { chave: chaveDaLinha, txt: "apagado.", classe: "bom" };
      desenhar();
    });
  }).catch(function () {
    movRecado = { chave: chaveDaLinha, txt: "Não consegui apagar agora.", classe: "ruim" };
    desenhar();
  });
}

/* O formulario de um lancamento. Curto de proposito: quanto, em que moeda,
 * quando. Nada mais — cada campo a mais e uma chance de ele desistir. */
function formDeMovimento(f) {
  var m = movNovo;
  var explica = {
    aporte: "dinheiro entrando nesta linha. Sobe o custo.",
    saque: "dinheiro saindo por decisão sua. Desce o custo.",
    colheita: "a taxa que você recolheu da posição. Não mexe no custo — é lucro que saiu do pendente."
  };
  return '<div class="mvForm">' +
    '<div class="mvExplica">' + esc(NOME_DO_MOVIMENTO[m.tipo]) + ": " + esc(explica[m.tipo]) + "</div>" +
    '<div class="mvCampos">' +
      '<input class="mvValor" type="number" step="any" min="0" placeholder="quanto" value="' + esc(m.valor || "") + '">' +
      '<button class="mvMoeda" data-moeda="' + esc(m.moeda) + '">' + esc(m.moeda) + "</button>" +
      '<input class="mvData" type="date" value="' + esc(m.quando) + '">' +
    "</div>" +
    '<div class="mvAcoes">' +
      '<button class="btMovGravar">gravar</button>' +
      '<button class="btMovCancelar">cancelar</button>' +
    "</div>" +
  "</div>";
}

function avisoDeMovimento(l) {
  var p = l.preco;
  if (!p || !p.movimento) return "";
  var m = p.movimento;
  return '<div class="lvAviso">⚠️ ' + esc(String(l.f.token).toUpperCase()) + " " + m.sentido + " " +
    Math.abs(m.variacao).toFixed(1) + "% em 24 horas. Movimento " + m.forca +
    " — vale procurar o que aconteceu antes de decidir qualquer coisa.</div>";
}

/* A barra da faixa de uma posicao concentrada.
 *
 * E o desenho que a propria Orca faz, e por um bom motivo: numa posicao
 * concentrada o numero que decide o dia nao e quanto vale, e se o preco esta
 * DENTRO. Fora da faixa a posicao para de render e vira inteira o ativo que
 * caiu.
 *
 * Verde dentro, vermelho fora. O losango e onde o preco esta agora. */
/* Quantas casas o preço do par precisa pra que os três números da faixa sejam
 * DIFERENTES entre si.
 *
 * Duas casas fixas quebravam nas pools sem stablecoin: a SOL/ETH dele mostrava
 * "0.04 · 0.04 · 0.04" — fundo, preço e topo iguais na tela, e o texto logo
 * abaixo dizendo "1,73% até o fundo, 2,28% até o topo". A barra se contradizia
 * numa linha de distância.
 *
 * A régua é a grandeza do número: preço de par pode ser 78.000 (BTC em USDC) ou
 * 0,0413 (SOL em ETH), e um formato só não serve para os dois. */
function numeroDaFaixa(v) {
  var n = Number(v);
  if (!isFinite(n)) return "—";
  var casas = Math.abs(n) >= 1000 ? 2
    : Math.abs(n) >= 1 ? 3
    : Math.abs(n) >= 0.01 ? 5
    : 8;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function barraDaFaixa(pos) {
  var r = pos && pos.leitura;
  if (!r) return "";
  var onde = r.dentro ? r.posicao * 100 : (r.estado === "fora-baixo" ? 0 : 100);
  var classe = r.dentro ? (r.perto ? "perto" : "dentro") : "fora";

  return '<div class="faixa ' + classe + '">' +
    '<div class="faixaPontas">' +
      '<span>' + numeroDaFaixa(pos.faixa.fundo) + '</span>' +
      '<span>' + numeroDaFaixa(pos.preco) + '</span>' +
      '<span>' + numeroDaFaixa(pos.faixa.topo) + '</span>' +
    '</div>' +
    '<div class="faixaBarra"><i style="left:' + onde.toFixed(1) + '%"></i></div>' +
    '<div class="faixaTexto">' + esc(r.texto) + '</div>' +
  '</div>';
}

/* O RETRATO FINAL de uma posicao fechada.
 *
 * "Quanto fiquei quando sai" — o pedido dele. A linha para de mostrar valor,
 * faixa e taxa pendente (nao ha mais posicao) e passa a mostrar so o que
 * sobrou de verdade: o que ele pos, o que recebeu, o que colheu, e as duas
 * respostas — ganhou dinheiro? e ganhou mais do que se tivesse segurado?
 *
 * FICA NA CARTEIRA, apagada, em vez de sumir. Posicao fechada que desaparece
 * leva o resultado junto, e o resultado e justamente o que ele quer guardar. */
function linhaFechadaVista(l) {
  var f = l.f;
  var c = contaDoFechamento(movsDaLinha(f.chave));

  var corpo = '<div class="lv fechada">' +
    '<span class="lvNome">' + esc(f.fatia || "posição") +
      ' <span class="onde">fechada em ' + esc(f.fechada_em) + '</span></span>' +
    '<span class="lvValor">—</span>' +
  "</div>";

  if (!c) {
    return corpo + '<div class="lvAviso miudo">Sem lançamentos suficientes pra fechar a conta ' +
      "desta posição.</div>" + extratoDaLinha(l) + botaoReabrir(f);
  }

  var lucroBom = c.lucro >= 0;
  corpo += '<div class="ilBloco">' +
    '<div class="ilLinha"><span>você pôs</span><b>' + dinheiroMiudo(c.custo, "USD") + "</b></div>" +
    '<div class="ilLinha"><span>recebeu ao sair</span><b>' + dinheiroMiudo(c.recebido, "USD") + "</b></div>" +
    (c.colhido > 0
      ? '<div class="ilLinha"><span>colheu em taxas</span><b class="sobe">+' +
        dinheiroMiudo(c.colhido, "USD") + "</b></div>"
      : "") +
    '<div class="ilLinha total"><span>' + (lucroBom ? "lucro" : "prejuízo") +
      '</span><b class="' + (lucroBom ? "sobe" : "desce") + '">' +
      (lucroBom ? "+" : "") + dinheiroMiudo(c.lucro, "USD") + "</b></div>";

  if (c.faltando === 0) {
    var venceu = c.resultado >= 0;
    corpo += '<div class="ilLinha" style="margin-top:7px"><span>se tivesse só segurado</span><b>' +
        dinheiroMiudo(c.segurando, "USD") + "</b></div>" +
      '<div class="ilLinha"><span>' + (c.il >= 0 ? "a favor da pool" : "custo do rebalanceamento (IL)") +
        '</span><b class="' + (c.il >= 0 ? "sobe" : "desce") + '">' +
        (c.il >= 0 ? "+" : "") + dinheiroMiudo(c.il, "USD") + "</b></div>" +
      '<div class="ilLinha total"><span>' +
        (venceu ? "a pool saiu na frente de segurar" : "segurar teria sido melhor") +
        '</span><b class="' + (venceu ? "sobe" : "desce") + '">' +
        (venceu ? "+" : "") + dinheiroMiudo(c.resultado, "USD") + "</b></div>";
  } else {
    corpo += '<div class="ilLinha miudo"><span>' + c.faltando +
      " lançamento(s) sem composição em tokens, então não dá pra comparar com segurar</span></div>";
  }

  corpo += "</div>";
  return corpo + extratoDaLinha(l) + botaoReabrir(f);
}

function botaoReabrir(f) {
  return '<div class="mvBarra"><button class="btReabrir" data-chave="' + esc(f.chave) +
    '">esta posição não estava fechada</button></div>';
}

function linhaVista(l, totalDaCaixa) {
  var f = l.f;
  if (linhaFechada(f)) return linhaFechadaVista(l);
  /* A porcentagem da linha é DENTRO da caixinha, e a da caixinha é do total.
     Antes as duas eram do total, empilhadas, e ele estava certo em dizer que
     confundia: dois números respondendo à mesma pergunta em níveis diferentes. */
  var dentro = (l.convertido != null && totalDaCaixa > 0)
    ? (l.convertido / totalDaCaixa) * 100 : null;

  var nome, sub = "", sinal = "";
  if (f.token) {
    nome = String(f.token).toUpperCase();
    sub = numeroDeToken(f.quantidade);
    var p = l.preco;
    if (p && p.variacao24h != null) {
      sinal = '<span class="lvVar ' + (p.variacao24h >= 0 ? "sobe" : "desce") + '">' +
        (p.variacao24h >= 0 ? "+" : "") + p.variacao24h.toFixed(1) + "%</span>";
    } else if (!p) {
      sinal = '<span class="lvVar desce">sem preço</span>';
    }
  } else if (l.posicao && l.posicao.tipo === "emprestimo") {
    /* Empréstimo: o subtítulo é a quantidade emprestada, que não muda. O que
       muda é quanto ela vale, e é isso que a coluna do valor mostra. */
    nome = f.fatia || (l.posicao.simbolo + " na " + l.posicao.onde);
    sub = numeroDeToken(Number(l.posicao.quantidade.toFixed(6))) + " " + l.posicao.simbolo;
    sinal = '<span class="lvVar sobe">rendendo</span>';
  } else if (l.posicao) {
    /* Posicao concentrada: o subtitulo diz o que ela tem dentro AGORA, que
       muda a cada negociacao — e e a informacao que a linha de valor sozinha
       esconde. */
    nome = f.fatia || (l.posicao.simboloA + "/" + l.posicao.simboloB);
    /* DE QUE LADO ELA ESTA, e nao quantos tokens tem dentro.
     *
     * Ele pediu assim: "mostre se esta tudo em cbBTC ou USDC, e ETH/SOL a
     * mesma logica". Numa posicao concentrada essa e a pergunta — o preco
     * andando empurra a posicao pra um lado, e sair pela borda de baixo
     * significa estar 100%% no ativo que caiu.
     *
     * A quantidade crua nao responde isso de bater o olho: "0,00127 cbbt +
     * 76,90 USDC" exige saber de cabeca quanto vale o cbBTC. A proporcao em
     * dolar responde na hora. */
    sub = composicaoDaPosicao(l.posicao);
    var lr = l.posicao.leitura;
    if (lr) {
      sinal = '<span class="lvVar ' + (lr.dentro ? (lr.perto ? "" : "sobe") : "desce") + '">' +
        (lr.dentro ? (lr.perto ? "na borda" : "rendendo") : "parada") + '</span>';
    }
  } else {
    nome = f.fatia || "(sem nome)";
    sub = f.onde || "";
    var pr = f.pool_id ? poolDoRadar(f.pool_id) : null;
    if (pr && pr.apy != null) {
      /* O rendimento total, e a marca de onde ele vem. Pool que paga muito em
         token impresso e pool que paga em taxa nao sao a mesma coisa, e o
         metodo separa as duas — entao a tela separa tambem. */
      var so = pr.rendimento || {};
      sinal = '<span class="lvVar ' + (so.pctDeTaxa >= 70 ? "sobe" : "") + '">' +
        (Number(pr.apy) || 0).toFixed(1) + "% aa</span>";
    }
  }

  return '<div class="lv">' +
    '<span class="lvNome">' + esc(nome) +
      (sub ? ' <span class="onde">' + esc(sub) + '</span>' : "") + '</span>' +
    '<span class="lvValor">' + (l.convertido == null ? "—" : dinheiroNa(l.convertido, moedaVista)) + '</span>' +
    sinal +
    '<span class="lvPct">' + (dentro == null ? "" : dentro.toFixed(0) + "%") + '</span>' +
    (f.pool_id
      ? '<a class="lvLink" href="https://defillama.com/yields/pool/' + encodeURIComponent(f.pool_id) +
        '" target="_blank" rel="noopener">abrir a pool ↗</a>'
      : "") +
  '</div>' +
  (l.posicao && l.posicao.leitura ? barraDaFaixa(l.posicao) : "") +
  (fechouNaPlataforma(f)
    ? '<div class="lvAviso miudo">Esta posição <b>não existe mais na Solana</b> — ' +
        'ela foi fechada na plataforma, e o dinheiro voltou pra sua carteira (onde já ' +
        'está sendo contado). Por isso ela vale zero aqui. Confirme abaixo pra guardar ' +
        'a conta final: quanto rendeu, quanto foi taxa e quanto foi perda por ' +
        'descolamento.</div>'
    : "") +
  (f.posicao && !l.posicao && !fechouNaPlataforma(f) && l.deAntes != null
    ? '<div class="lvAviso miudo">Não consegui ler esta posição agora — o valor acima é da ' +
        'última leitura que deu certo' +
        (l.deAntes ? ' (' + esc(String(l.deAntes).slice(0, 16).replace("T", " ")) + ')' : "") +
        '. <button class="btDeNovo" data-endereco="' + esc(f.posicao) + '">tentar de novo</button></div>'
    : "") +
  (f.posicao && !l.posicao && !fechouNaPlataforma(f) && l.deAntes == null &&
   posicoes[f.posicao] && posicoes[f.posicao].naoExiste
    ? '<div class="lvAviso miudo">Nunca consegui ler esta posição, e a conta não existe ' +
        'na Solana — o endereço provavelmente está errado. Confira e cole de novo.</div>'
    : "") +
  (f.posicao && !l.posicao && l.deAntes == null
    ? '<div class="lvAviso desce">' +
        esc((posicoes[f.posicao] && posicoes[f.posicao].erro) || "lendo a posição na Solana…") +
        ' <button class="btDeNovo" data-endereco="' + esc(f.posicao) + '">tentar de novo</button>' +
      '</div>'
    : "") +
  ganhoDaPosicao(l) +
  resultadoDoDinheiro(l) +
  perguntaDeMudanca(l.f) +
  extratoDaLinha(l) +
  avisoDeMovimento(l);
}

/* ---------------------------------------------------------------------------
 * MODO EDITAR — só a caixinha aberta, e os campos escrevem no dado.
 * ------------------------------------------------------------------------- */

function linhaEdicao(l, i) {
  var f = l.f;
  var eToken = !!f.token;
  var ePool = !eToken && (f.pool_id != null || f.onde != null);

  var cabeca = eToken
    ? '<input class="eTok" data-i="' + i + '" value="' + esc(f.token || "") + '" placeholder="BTC" maxlength="12">'
    : '<input class="eNome" data-i="' + i + '" value="' + esc(f.fatia || "") + '" placeholder="nome da linha">';

  /* O valor aparece na moeda em que FOI LANÇADO, não na que ele está vendo.
     É o campo que ele vai corrigir; mostrar convertido faria uma correção de
     centavo redenominar a linha. A conversão está logo abaixo, como texto. */
  var numero = eToken
    ? '<input class="eQtd" data-i="' + i + '" type="number" min="0" step="any" inputmode="decimal" value="' +
      (f.quantidade == null ? "" : f.quantidade) + '" placeholder="quantos">'
    : '<input class="eVal" data-i="' + i + '" type="number" min="0" step="0.01" inputmode="decimal" value="' +
      (f.valor == null ? "" : f.valor) + '" placeholder="0,00">';

  var moedaBotoes = eToken ? "" :
    /* Classe própria, e de propósito NÃO a mesma dos botões do ±.
     *
     * Estes dois pares de R$/US$ vivem na mesma linha e querem dizer coisas
     * diferentes: este diz em que moeda a linha FOI LANÇADA, o do ± diz em que
     * moeda é o movimento que ele está fazendo agora. Iguais na aparência,
     * seria questão de tempo até um clique errado. Aqui eles são cinzas e
     * pequenos; os do ± continuam verdes.
     *
     * E este NÃO converte: trocar aqui é dizer "eu tinha lançado na moeda
     * errada", que é o oposto de converter. Por isso o aviso vai escrito na
     * linha, e não só no title. */
    '<button class="eMoedaBt' + ((f.moeda || moedaVista) === "BRL" ? " ativo" : "") +
      '" data-i="' + i + '" data-m="BRL" title="a linha foi lançada em reais">R$</button>' +
    '<button class="eMoedaBt' + ((f.moeda || moedaVista) === "USD" ? " ativo" : "") +
      '" data-i="' + i + '" data-m="USD" title="a linha foi lançada em dólares">US$</button>';

  return '<div class="lin" data-i="' + i + '" data-ordem="' + i + '" data-tipo="' + (eToken ? "token" : "valor") + '">' +
    cabeca + numero + moedaBotoes +
    '<span class="acoes">' +
      '<button class="mexerAbre" data-i="' + i + '" title="somar ou tirar">±</button>' +
      (function () {
        /* APAGAR UMA LINHA LEVA O HISTORICO DELA JUNTO, e ate agora isso
         * acontecia com UM clique e sem pergunta nenhuma.
         *
         * Ele: "excluir um lancamento acaba com o preco medio, precisa ver
         * direito isso pra eu nao perder esses dados". Ja aconteceu hoje: ele
         * refez as posicoes, os aportes ficaram orfaos, e a tela passou a
         * mostrar +106% de lucro que nao existia.
         *
         * Agora o botao DIZ o que esta em jogo antes de obedecer. A linha do
         * BTC dele tem catorze lancamentos; "apagar mesmo? 14 lancamentos"
         * e uma frase que faz a mao parar. */
        var quantos = movsDaLinha(f.chave).length;
        var pedindo = apagandoLinha === i;
        return '<button class="lixo' + (pedindo ? " perguntando" : "") +
          '" data-i="' + i + '" title="apagar a linha">' +
          (pedindo
            ? (quantos ? "apagar mesmo? " + quantos + " lançamento" + (quantos > 1 ? "s" : "") : "apagar mesmo?")
            : "X") + "</button>";
      })() +
    '</span>' +
    (ePool || f.posicao
      ? '<div class="linCampos">' +
          '<input class="eOnde" data-i="' + i + '" value="' + esc(f.onde || "") + '" placeholder="onde: Orca, Aave...">' +
          /* O campo do endereco aparece SEMPRE numa linha de renda passiva, e
             nao so quando ja existe um endereco. Antes so aparecia depois de
             preenchido, o que e o mesmo que nao existir: em 08/09/2026 o Rayakuza
             tentou ligar a posicao dele colando o endereco no campo de BUSCA de
             pool, porque era o unico campo a vista. */
          '<input class="ePosicao" data-i="' + i + '" value="' + esc(f.posicao || "") +
            '" placeholder="endereço da posição (Orca)">' +
        '</div>' +
        (f.posicao
          ? '<div class="linNota">O valor desta linha vem da blockchain — não dá para digitar, e é essa a graça.</div>'
          : '<div class="linCampos" style="grid-template-columns:1fr">' +
              (f.pool_id ? poolEscolhida(f.pool_id, "eTrocarPool") : blocoDeBuscaDePool(String(i))) +
            '</div>')
      : "") +
    '<div class="linNota">' + esc(
      eToken
        ? (l.convertido == null ? "sem preço agora" : "vale " + dinheiroNa(l.convertido, moedaVista))
        : ((l.convertido == null ? "" : "= " + dinheiroNa(l.convertido, moedaVista) + " na tela · ") +
           "o R$/US$ acima diz em que moeda você lançou — trocar corrige, não converte")
    ) + '</div>' +
    painelDeMexer(i, eToken ? "token" : "valor") +
  '</div>';
}

/* O bloco das posições encerradas de uma caixinha.
 *
 * NASCE RECOLHIDO. Ele abre a carteira pra olhar o que está vivo; o histórico é
 * uma consulta, não uma leitura diária. E vem com o RESULTADO SOMADO na própria
 * linha do título, porque esse é o número que responde sozinho a pergunta "e as
 * que eu já fechei?" — sem precisar abrir nada.
 *
 * O estado de aberto/fechado usa o mesmo cofre das caixinhas encolhidas, com
 * chave própria ("fim:renda"). Uma preferência de tela mora no aparelho, não no
 * banco: é escolha de quem está olhando, não dado da carteira. */
function blocoDasFechadas(cx, linhas) {
  if (!linhas || !linhas.length) return "";

  var chave = "fim:" + cx.chave;
  var aberto = !encolhida(chave);

  /* O resultado somado. Só entra o que dá pra somar — linha sem conta fechada
     não vira zero, fica de fora, e a contagem diz quantas foram. */
  var soma = 0, quantas = 0;
  linhas.forEach(function (l) {
    var r = contaDoFechamento(movsDaLinha(l.f.chave));
    if (r && isFinite(r.resultado)) { soma += r.resultado; quantas++; }
  });

  var resumo = quantas
    ? '<span class="fimSoma ' + (soma >= 0 ? "sobe" : "desce") + '">' +
        (soma >= 0 ? "+" : "") + esc(dinheiroNa(soma, "USD")) + '</span>'
    : "";

  return '<div class="fim' + (aberto ? " aberto" : "") + '">' +
    '<button class="fimTopo" data-fim="' + esc(chave) + '">' +
      '<span class="seta">' + (aberto ? "▾" : "▸") + '</span> ' +
      'posições fechadas <span class="onde">' + linhas.length + '</span>' +
      resumo +
    '</button>' +
    (aberto
      ? '<div class="fimCorpo">' +
          linhas.map(function (l) { return linhaFechadaVista(l); }).join("") +
        '</div>'
      : "") +
  '</div>';
}

function secaoDaCaixa(cx, d, c) {
  var ref = referenciaDaCaixa(cx.chave);
  var bruto = alvos ? alvos[cx.chave] : null;
  var alvo = (bruto == null || bruto === "") ? null : Number(bruto);
  var pct = d.pct;
  var aberta = editando === cx.chave;

  var distancia = "";
  if (alvo != null && pct != null) {
    var dif = pct - alvo;
    /* Em dinheiro, na moeda que ele está filtrando. Pontos percentuais não se
       transferem entre caixinhas; dinheiro sim, e é o que ele vai mover. */
    var falta = faltaEmDinheiro(c.total, d.total, alvo);
    var emDinheiro = falta == null ? "" : " (" + dinheiroNa(Math.abs(falta), moedaVista) + ")";
    /* "NO ALVO" PRECISA SER VERDADE, e cinco pontos e uma regua grossa demais
     * pra alvo pequeno.
     *
     * Ele viu na tela: "Ativos volateis · US$ 16,60 · alvo 5% · no alvo",
     * estando em 0,8%. Faltavam 84% do caminho. A distancia em PONTOS era 4,2,
     * dentro da faixa — mas cinco pontos sao pouco pra quem mira 60% e sao
     * quase tudo pra quem mira 5%.
     *
     * Entao alem dos cinco pontos, exige-se proximidade PROPORCIONAL: estar a
     * no maximo um quarto do alvo de distancia. Num alvo de 60% isso da 15
     * pontos e os 5 continuam mandando; num alvo de 5% da 1,25 ponto, e aí a
     * tela para de dizer que esta no lugar quando nao esta. */
    var folga = folgaDoAlvo(alvo);
    distancia = Math.abs(dif) <= folga
      ? " · no alvo"
      : (dif > 0
          ? " · " + dif.toFixed(1) + " pontos acima" + emDinheiro + " a mais"
          : " · faltam " + Math.abs(dif).toFixed(1) + " pontos" + emDinheiro);
  }

  var barra = "";
  if (pct != null) {
    barra = '<div class="cxBarra"><i style="width:' + Math.max(0, Math.min(100, pct)).toFixed(1) + '%"></i>' +
      (alvo != null ? '<b style="left:' + Math.max(0, Math.min(100, alvo)) + '%" title="seu alvo"></b>' : "") +
      (ref ? '<u style="left:' + Math.max(0, Math.min(100, ref.pct)) + '%" title="referência do método"></u>' : "") +
    '</div>';
  }

  var corpo;
  if (aberta) {
    corpo = '<div class="cxEdicao">' +
      '<div class="cxAlvoCampo">alvo <input class="cxAlvo" data-caixa="' + cx.chave +
        '" type="number" min="0" max="100" step="1" inputmode="decimal" value="' +
        (alvo == null ? "" : alvo) + '">%' +
        (ref ? ' <span class="onde">o método usa ' + ref.pct + '% ' + esc(ref.deOnde) + '</span>' : "") +
      '</div>' +
      d.linhas.map(function (l) { return linhaEdicao(l, c.linhas.indexOf(l)); }).join("") +
      '<div class="cxMais"><button class="btPronto">Pronto</button></div>' +
    '</div>';
  } else {
    /* AS FECHADAS SAEM DA FRENTE, e a razão é dele: "viu o tamanho que fica
     * esse monte de informação? tem que ficar escondido em algum lugar
     * agrupado, pra que não atrapalhe as novas posições que eu abrir".
     *
     * Ele tem razão, e o motivo é mais fundo que espaço na tela. A caixinha
     * responde "o que eu TENHO aqui" — e posição fechada não é o que ele tem,
     * é o que ele teve. As duas coisas disputando as mesmas linhas fazem a
     * pergunta ficar sem resposta clara justamente quando ele abre uma posição
     * nova e quer vê-la.
     *
     * NÃO SOME: vira um bloco recolhido, com a contagem e o resultado somado à
     * mostra. Fechar uma posição é o momento em que a conta final existe — e a
     * conta final é a única coisa que sobra de uma posição encerrada. Esconder
     * de vez seria apagar o que a posição ensinou. */
    var abertas = [], encerradas = [];
    d.linhas.forEach(function (l) {
      (linhaFechada(l.f) ? encerradas : abertas).push(l);
    });
    corpo =
      abertas.map(function (l) { return linhaVista(l, d.total); }).join("") +
      blocoDasFechadas(cx, encerradas);
  }

  /* Editar ganha da preferência de encolher: abrir os campos e não mostrá-los
     seria um botão que não faz nada. */
  var fechada = encolhida("cx:" + cx.chave) && !aberta;
  var temLinhas = d.linhas.length > 0;
  // Caixinha vazia não tem o que esconder: a seta seria um botão que não faz nada.
  if (!temLinhas) fechada = false;

  return '<div class="cx' + (aberta ? " aberta" : "") + (fechada ? " fechada" : "") + '">' +
    '<div class="cxTopo">' +
      '<span class="cxLetra">' + cx.letra + '</span>' +
      '<span class="cxNome cxVirar" data-caixa="' + cx.chave + '">' + esc(cx.nome) +
        (temLinhas
          ? ' <span class="seta">' + (fechada ? "▸" : "▾") + '</span>' +
            (fechada ? ' <span class="onde">' + d.linhas.length + '</span>' : "")
          : "") +
      '</span>' +
      '<span class="cxHoje">' + (pct == null ? "—" : pct.toFixed(1) + "%") + '</span>' +
      '<button class="cxEditar" data-caixa="' + cx.chave + '" title="editar esta caixinha">' +
        (aberta ? "×" : "✎") + '</button>' +
    '</div>' +
    barra +
    '<div class="cxSoma">' + dinheiroNa(d.total, moedaVista) +
      (alvo != null ? " · alvo " + alvo + "%" : " · sem alvo") + distancia + '</div>' +
    (fechada ? "" : corpo) +
  '</div>';
}

/* A tela de entrar na conta.
 *
 * ESTA FUNÇÃO TINHA SUMIDO, e o estrago era invisível pra quem já estava
 * logado. O painel chamava telaDeLogin() sem que ela existisse, então a aba
 * Carteira quebrava com "telaDeLogin is not defined" — mas SÓ em aparelho sem
 * sessão guardada. No celular do Rayakuza havia sessão; no computador não. Ele
 * reclamou duas vezes que "no computador a carteira não abre", e na primeira eu
 * culpei o cache e mexi nos cabeçalhos. Não era o cache.
 *
 * A lição, e por isso ela fica escrita aqui: quando o mesmo sintoma volta
 * depois de um conserto, o conserto foi no lugar errado.
 *
 * O teste em testar-painel.js agora exige que toda função chamada dentro do
 * <script> exista de verdade — era o buraco que deixou isto passar. */
function telaDeLogin() {
  return '<div class="conta">' +
    '<h3>Entrar na sua conta</h3>' +
    '<p>O mercado você vê sem entrar. A conta serve só pra guardar a <b>sua</b> carteira — e ela fica separada da de qualquer outra pessoa pela regra do banco, não pela do app.</p>' +
    '<label class="campo"><span>e-mail</span><input id="cEmail" type="email" autocomplete="username" inputmode="email"></label>' +
    '<label class="campo"><span>senha</span><input id="cSenha" type="password" autocomplete="current-password"></label>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">' +
      '<button class="botao" id="btEntrar">Entrar</button>' +
      '<button class="botao fraco" id="btCriar">Criar conta</button>' +
    '</div>' +
    '<div style="margin-top:10px"><button class="botao fraco" id="btEsqueci" style="border:0;padding:4px 0;font-weight:400;font-size:12.5px">esqueci a senha</button></div>' +
    '<div class="recadoConta" id="recadoLogin"></div>' +
  '</div>';
}

function telaDaCarteira() {
  if (!sessao) return telaDeLogin();
  if (fatias === null) return '<div class="nada">carregando sua carteira…</div>';

  /* Renumera ANTES de desenhar, sempre.
   *
   * O painel de somar/tirar/mover procura a linha pela ordem, e a tela escreve
   * a ordem no data-ordem de cada linha. Se as duas coisas discordarem, o ±
   * some dinheiro na linha errada — ou, como aconteceu aqui em 08/09/2026 com
   * uma linha que nunca passou por renumerar(), simplesmente não acha nada e
   * reclama de um símbolo que está preenchido.
   *
   * Chamar aqui torna a regra "ordem é a posição" verdadeira por construção,
   * em vez de depender de cada ação lembrar de renumerar. */
  renumerar();

  var c = contasDaCarteira();
  var outra = moedaVista === "BRL" ? "USD" : "BRL";
  var totalNaOutra = converterV(c.total, moedaVista, outra, c.taxa);
  var vazia = !(fatias || []).length;

  var semCaixa = c.porCaixa.sem.linhas.length
    ? '<div class="cx semCaixa">' +
        '<div class="cxTopo"><span class="cxLetra">?</span>' +
          '<span class="cxNome">Sem caixinha</span>' +
          '<span class="cxHoje">' + (c.porCaixa.sem.pct == null ? "—" : c.porCaixa.sem.pct.toFixed(1) + "%") + '</span>' +
        '</div>' +
        '<div class="cxSoma">' + dinheiroNa(c.porCaixa.sem.total, moedaVista) +
          ' · escolha a letra do B.A.R.C.A. de cada uma</div>' +
        c.porCaixa.sem.linhas.map(function (l) { return linhaVista(l, c.porCaixa.sem.total); }).join("") +
        '<div class="cxMais">' + CAIXAS.map(function (cx) {
          return '<button class="btMoverCaixa" data-caixa="' + cx.chave + '">tudo para ' + cx.letra + '</button>';
        }).join("") + '</div>' +
      '</div>'
    : "";

  return '<div class="grupo">' +
    '<div class="grupoTitulo">💼 Sua carteira</div>' +
    /* O parágrafo de instruções só na carteira vazia. Ele ocupava meia tela
       toda vez que ele abria a aba — e quem já sabe não precisa ler de novo. */
    (vazia
      ? '<div class="grupoNota">As cinco caixinhas do B.A.R.C.A. Aperte <b>Lançar</b> e diga três coisas: o que, quanto, e em qual caixinha. Token entra pela <b>quantidade</b> — o preço vem ao vivo e o valor se refaz sozinho.</div>'
      : "") +
    '<div class="cartao">' +
      '<div class="compTopo">' +
        '<span class="compPar">' +
          (editandoApelido === null
            ? '<button class="btApelido" title="mudar como você aparece aqui">' +
                esc(comoMeChamo()) + "</button>"
            : '<input class="inApelido" maxlength="24" placeholder="seu apelido" value="' +
                esc(editandoApelido) + '">' +
              '<button class="btApelidoOk">ok</button>') +
        "</span>" +
        '<span class="compOnde">' +
          /* O olhinho fica GRUDADO no valor, e nao num menu: o momento de usar
             ele e o segundo antes de virar a tela pra alguem. */
          '<button class="btOlho" id="btOlho" aria-label="' +
            (privado ? "mostrar os valores" : "esconder os valores") + '" title="' +
            (privado ? "mostrar os valores" : "esconder os valores pra mostrar a tela") + '">' +
            iconeOlhoAlien(!privado) + "</button>" +
          '<button class="botao fraco" id="btSair">sair</button></span>' +
      '</div>' +

      '<div class="totalCarteira">' +
        '<div class="totalValor">' + dinheiroNa(c.total, moedaVista) + '</div>' +
        '<div class="totalOutro">' +
          (totalNaOutra != null ? "= " + dinheiroNa(totalNaOutra, outra) : "sem cotação hoje") +
        '</div>' +
        '<div class="moedaBotoes">' +
          '<button class="mBt' + (moedaVista === "BRL" ? " ativo" : "") + '" data-moeda="BRL">R$</button>' +
          '<button class="mBt' + (moedaVista === "USD" ? " ativo" : "") + '" data-moeda="USD">US$</button>' +
        '</div>' +
      '</div>' +
      (c.foraDaConta
        ? '<div class="recadoConta ruim">' + c.foraDaConta + ' linha(s) ficaram de fora do total: falta a cotação do dólar ou o preço do token.</div>'
        : "") +

      avisoDeTokenRepetido() +

      /* AS DUAS SUB-ABAS. Editar é onde ele mexe; Resumo é onde ele olha.
         Separadas a pedido dele, e o motivo é bom: olhar não pode ter risco de
         esbarrar num campo e mudar o que estava salvo. Some na carteira vazia,
         porque não há resumo de nada. */
      (vazia ? "" :
        '<div class="subAbas">' +
          '<button class="sbBt' + (subAbaCarteira === "editar" ? " ativo" : "") + '" data-sub="editar">editar</button>' +
          '<button class="sbBt' + (subAbaCarteira === "resumo" ? " ativo" : "") + '" data-sub="resumo">resumo</button>' +
        '</div>') +

      (vazia && lerCopia()
        ? '<div class="recadoConta ruim">A carteira está vazia, mas tenho uma cópia de ' +
          esc(new Date(lerCopia().quando).toLocaleString("pt-BR")) + ' guardada neste aparelho, com ' +
          lerCopia().linhas.length + ' linha(s). ' +
          '<button class="botao fraco" id="btRecuperar">recuperar</button></div>'
        : "") +
      (mostrandoResumo() ? telaDoResumo(c) : (

      blocoDeImportar() +
      blocoDeLancar() +
      semCaixa +
      CAIXAS.map(function (cx) { return secaoDaCaixa(cx, c.porCaixa[cx.chave], c); }).join("") +

      '<div class="cxRodape">' +
        '<button class="botao fraco" id="btUsarBarca">usar a referência do ciclo como alvo</button>' +
        '<button class="botao" id="btSalvar">Salvar</button>' +
      '</div>' +
      '<div class="cxRodape">' + blocoDeCopias() + blocoDoDrive() + '</div>' +
      blocoDoRebalanco(c) +
      '<div class="recadoConta" id="recadoCarteira"></div>' +
      avisoNaoSalvo() +
      blocoDeOrfaos() +
      (saldosRecado
        ? '<div class="recadoConta ' + esc(saldosRecado.classe || "") + '">' +
          (saldosRecado.classe === "ruim" ? "" : "a carteira mudou: ") +
          esc(saldosRecado.txt) + "</div>"
        : "") +
      (saldos && !saldosCompleto && (fatias || []).some(seguindo)
        ? '<div class="recadoConta">Não consegui ler a carteira inteira agora — as quantidades que seguem a carteira podem estar da última leitura boa. Nada foi zerado por causa disso.</div>'
        : "")

      )) +
    '</div>' +

    '<div class="grupoNota">' +
      '<i>"Não é para você copiar, não é para você engessar o que está aqui. As alocações e as porcentagens VOCÊ que vai definir." — a própria aula do B.A.R.C.A.</i>' +
      (refDoBarca() && refDoBarca().ativos
        ? '<br>Em ' + esc(refDoBarca().ciclo) + ' ele fica com <b>' + refDoBarca().ativos.minimo + ' a ' +
          refDoBarca().ativos.maximo + ' ativos</b>. Passando de 15, o risco volta a subir por repetir setor.'
        : "") +
    '</div>' +

    (c.taxa
      ? '<div class="grupoNota">Dólar a ' + dinheiroNa(c.taxa, "BRL") +
        (dados.dolar && dados.dolar.dia ? ' · cotação de ' + esc(dados.dolar.dia) : "") + '</div>'
      : '<div class="grupoNota">Sem cotação do dólar hoje — o total soma só o que está na moeda escolhida.</div>') +
  '</div>';
}

/* ---------------------------------------------------------------------------
 * LIGAR OS BOTÕES
 * ------------------------------------------------------------------------- */

/* O último recado da carteira, guardado fora da tela.
 *
 * "Lançado. Falta apertar Salvar." aparecia e sumia meio segundo depois: o
 * lançamento dispara a releitura das posições, que redesenha, e o redesenho
 * monta um <div> vazio no lugar. Recado que pisca é o mesmo que recado nenhum —
 * e este em particular é o que avisa que ainda falta salvar. */
var recadoDaCarteira = null;

function ligarCarteira() {
  var recado = function (id, txt, classe) {
    if (id === "recadoCarteira") recadoDaCarteira = txt ? { txt: txt, classe: classe } : null;
    var el = document.getElementById(id);
    if (el) { el.textContent = txt; el.className = "recadoConta " + (classe || ""); }
  };

  var btEntrar = document.getElementById("btEntrar");
  if (btEntrar) {
    var tentar = async function (criando) {
      var email = document.getElementById("cEmail").value.trim();
      var senha = document.getElementById("cSenha").value;
      if (!email || !senha) return recado("recadoLogin", "Preencha e-mail e senha.", "ruim");
      recado("recadoLogin", "Um instante...", "");
      var r = await entrar(email, senha, criando);
      if (r.erro) return recado("recadoLogin", r.erro, "ruim");
      if (r.aviso) return recado("recadoLogin", r.aviso, "bom");
      fatias = null;
      desenhar();
    };
    btEntrar.onclick = function () { tentar(false); };
    document.getElementById("btCriar").onclick = function () { tentar(true); };
    document.getElementById("cSenha").onkeydown = function (e) { if (e.key === "Enter") tentar(false); };
    document.getElementById("btEsqueci").onclick = async function () {
      var email = document.getElementById("cEmail").value.trim();
      if (!email) return recado("recadoLogin", "Escreva o e-mail primeiro.", "ruim");
      recado("recadoLogin", "Mandando...", "");
      var r = await supaFetch("/auth/v1/recover", {
        method: "POST", body: JSON.stringify({ email: email }),
      });
      /* O Supabase responde 200 mesmo pra e-mail que não existe, de propósito:
         responder diferente diria a um estranho quais e-mails têm conta aqui.
         A mensagem tem que ser igual nos dois casos. */
      recado("recadoLogin", r.ok
        ? "Se existir conta com esse e-mail, o link de troca de senha foi enviado."
        : "Não consegui pedir a troca agora. Tente daqui a pouco.", r.ok ? "bom" : "ruim");
    };
    return;
  }

  var btSair = document.getElementById("btSair");
  if (btSair) btSair.onclick = sair;

  var btOlho = document.getElementById("btOlho");
  if (btOlho) btOlho.onclick = function () { virarPrivado(); desenhar(); };

  var btApelido = document.querySelector(".btApelido");
  if (btApelido) btApelido.onclick = function () {
    editandoApelido = apelidoDaSessao() || "";
    desenhar();
    var campo = document.querySelector(".inApelido");
    if (campo) { campo.focus(); campo.select(); }
  };

  /* Escreve DIRETO no estado, como todo campo desta tela: ler da tela na hora
     de gravar perde o que ele digitou no primeiro redesenho. */
  var inApelido = document.querySelector(".inApelido");
  if (inApelido) {
    inApelido.oninput = function () { editandoApelido = inApelido.value; };
    inApelido.onkeydown = function (e) {
      if (e.key === "Enter") { var t = editandoApelido; editandoApelido = null; guardarApelido(t); }
      if (e.key === "Escape") { editandoApelido = null; desenhar(); }
    };
  }
  var btOk = document.querySelector(".btApelidoOk");
  if (btOk) btOk.onclick = function () {
    var t = editandoApelido; editandoApelido = null; guardarApelido(t);
  };

  if (fatias === null) {
    fatias = [];
    alvos = {};
    Promise.all([
      comAuth("/rest/v1/alocacao?select=chave,fechada_em,fatia,caixa,token,quantidade,valor,moeda,pool_id,onde,posicao,valor_entrada,data_entrada,cambio_entrada,mint,segue_carteira,ordem&order=ordem")
        .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      comAuth("/rest/v1/alvo_caixa?select=caixa,pct")
        .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      comAuth("/rest/v1/carteira_solana?select=endereco")
        .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
      comAuth("/rest/v1/movimento?select=id,chave,tipo,valor,moeda,valor_usd,quando,nota,qtd_a,qtd_b,simbolo_a,simbolo_b,preco&order=quando.desc")
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      /* A ULTIMA LEITURA BOA DE CADA POSICAO, buscada JUNTO e nao depois.
         Antes ela so chegava dentro de olharTamanhos, que so roda quando as
         posicoes foram lidas — ou seja, ela faltaria exatamente no caso em que
         serve: quando a leitura falha. */
      comAuth("/rest/v1/posicao_tamanho?select=chave,tamanho,valor,visto_em")
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    ]).then(function (par) {
      fatias = par[0] || [];
      renumerar();
      guardarCopia(fatias);
      alvos = {};
      (par[1] || []).forEach(function (a) { alvos[a.caixa] = Number(a.pct); });
      carteiraSolana = (par[2] && par[2][0] && par[2][0].endereco) || null;
      /* null quer dizer que a busca FALHOU; lista vazia quer dizer que ele
         ainda nao lancou nada. Tratar os dois igual faria uma falha de rede
         parecer historico apagado. */
      if (par[3] !== null) { arrumarMovimentos(par[3] || []); movsCarregados = true; }
      if (par[4] !== null) {
        tamanhos = {};
        (par[4] || []).forEach(function (x) { tamanhos[x.chave] = x; });
      }
      marcarComoSalvo();
      return Promise.all([buscarPrecos(), buscarPoolsDaCarteira(), buscarPosicoes(), seguirCarteira()]);
    }).then(function () {
      if (aba === "carteira") desenhar();
      if (mostrandoResumo()) {
        buscarChao().then(function (veio) { if (veio && aba === "carteira") desenhar(); });
      }
      /* A copia no Drive, sem ele pedir. So depois que tudo carregou: copiar
         uma carteira meio lida gravaria por cima da boa. */
      if (driveLigado()) mandarProDrive(false);
    }).catch(function () { if (aba === "carteira") desenhar(); });
    return;
  }

  // Repõe o último recado, que o redesenho teria apagado.
  if (recadoDaCarteira) {
    var elRec = document.getElementById("recadoCarteira");
    if (elRec) {
      elRec.textContent = recadoDaCarteira.txt;
      elRec.className = "recadoConta " + (recadoDaCarteira.classe || "");
    }
  }

  buscarPrecos().then(function (mudou) { if (mudou && aba === "carteira") desenhar(); });
  buscarPoolsDaCarteira().then(function (mudou) { if (mudou && aba === "carteira") desenhar(); });
  buscarPosicoes().then(function (mudou) { if (mudou && aba === "carteira") desenhar(); });
  /* As linhas que seguem a carteira: relê os saldos e acompanha o que ele
     depositou ou tirou. Guarda-se sozinha contra F5 nervoso (uma vez por
     minuto) e nunca zera nada sem leitura completa. */
  seguirCarteira().then(function (mudou) { if (mudou && aba === "carteira") desenhar(); });
  /* Depois das posições chegarem: compara o tamanho de cada uma com a última
     olhada e pergunta se ele mexeu. */
  buscarPosicoes().then(olharTamanhos).then(function (mudou) {
    if (mudou && aba === "carteira") desenhar();
  }).catch(function () {});

  /* Redesenha o que os números dizem, sem refazer a tela: refazer tiraria o
     foco do campo e o cursor do lugar. */
  var recalcular = function () {
    var c = contasDaCarteira();
    CAIXAS.forEach(function (cx, i) {
      var caixa = document.querySelectorAll(".cx:not(.semCaixa)")[i];
      if (!caixa) return;
      var p = c.porCaixa[cx.chave];
      var h = caixa.querySelector(".cxHoje");
      if (h) h.textContent = p.pct == null ? "—" : p.pct.toFixed(1) + "%";
      var b = caixa.querySelector(".cxBarra i");
      if (b) b.style.width = Math.max(0, Math.min(100, p.pct || 0)).toFixed(1) + "%";
    });
    var tv = document.querySelector(".totalValor");
    if (tv) tv.textContent = dinheiroNa(c.total, moedaVista);
    var outra = moedaVista === "BRL" ? "USD" : "BRL";
    var to = document.querySelector(".totalOutro");
    if (to) {
      var v = converterV(c.total, moedaVista, outra, c.taxa);
      to.textContent = v != null ? "= " + dinheiroNa(v, outra) : "sem cotação hoje";
    }
  };

  var linhaDoCampo = function (el) { return fatias[Number(el.dataset.i)]; };

  /* Cada campo escreve DIRETO no dado. oninput só dispara quando alguém
     digita — nunca quando a tela se redesenha. É isso que impede um redesenho
     de virar uma gravação, que era a origem do bug da moeda. */
  document.querySelectorAll(".eNome").forEach(function (el) {
    el.oninput = function () { linhaDoCampo(el).fatia = el.value; };
  });
  document.querySelectorAll(".eTok").forEach(function (el) {
    el.oninput = function () {
      var f = linhaDoCampo(el);
      f.token = el.value.trim().toUpperCase();
      f.fatia = f.token;
    };
    el.onchange = function () { buscarPrecos().then(function () { desenhar(); }); };
  });
  document.querySelectorAll(".eVal").forEach(function (el) {
    el.oninput = function () {
      var f = linhaDoCampo(el);
      f.valor = el.value === "" ? null : Number(el.value);
      recalcular();
    };
  });
  document.querySelectorAll(".eQtd").forEach(function (el) {
    el.oninput = function () {
      var f = linhaDoCampo(el);
      f.quantidade = el.value === "" ? null : Number(el.value);
      recalcular();
    };
  });
  document.querySelectorAll(".ePosicao").forEach(function (el) {
    el.oninput = function () { linhaDoCampo(el).posicao = el.value.trim() || null; };
    el.onchange = function () { posicoesPedidas = null; buscarPosicoes().then(function () { desenhar(); }); };
  });
  document.querySelectorAll(".eOnde").forEach(function (el) {
    el.oninput = function () { linhaDoCampo(el).onde = el.value.trim() || null; };
  });
  document.querySelectorAll(".eMoedaBt").forEach(function (b) {
    b.onclick = function () {
      linhaDoCampo(b).moeda = b.dataset.m;
      desenhar();
    };
  });
  document.querySelectorAll(".cxAlvo").forEach(function (el) {
    el.oninput = function () {
      if (el.value === "") delete alvos[el.dataset.caixa];
      else alvos[el.dataset.caixa] = Number(el.value);
    };
  });

  document.querySelectorAll(".cxEditar").forEach(function (b) {
    b.onclick = function () {
      editando = editando === b.dataset.caixa ? null : b.dataset.caixa;
      desenhar();
    };
  });
  document.querySelectorAll(".btPronto").forEach(function (b) {
    b.onclick = function () {
      /* Sai da edicao com a caixinha ABERTA: e onde moram o rendimento, a
         faixa e as taxas, e e o que ele foi ver depois de mexer. */
      abrirCaixa(editando);
      editando = null;
      desenhar();
    };
  });

  var btUsar = document.getElementById("btUsarBarca");
  /* É um BOTÃO e não um padrão, e a diferença importa: o autor do método diz
     que copiar a divisão dele não faz sentido. Preencher sozinho seria eu
     escolhendo por ele; oferecer é dar o ponto de partida e devolver a
     decisão. */
  if (btUsar) btUsar.onclick = function () {
    var b = refDoBarca();
    if (!b || !b.referencia) return;
    alvos = {};
    b.referencia.forEach(function (r) { alvos[r.chave] = r.pct; });
    desenhar();
    recado("recadoCarteira", "Alvos preenchidos com a referência do ciclo. Mude o que quiser e aperte Salvar.", "bom");
  };

  document.querySelectorAll(".mBt").forEach(function (b) {
    b.onclick = function () {
      moedaVista = b.dataset.moeda;
      try { localStorage.setItem("radar:moeda", moedaVista); } catch (e) {}
      desenhar();
    };
  });

  document.querySelectorAll(".lixo").forEach(function (b) {
    b.onclick = function () {
      var i = Number(b.dataset.i);
      if (apagandoLinha !== i) { apagandoLinha = i; desenhar(); return; }
      apagandoLinha = null;
      fatias.splice(i, 1);
      renumerar();
      desenhar();
      recado("recadoCarteira",
        "Linha apagada. Os lançamentos dela NÃO foram apagados — ficam guardados, " +
        "e aparecem aqui embaixo pra você religar em qualquer linha.", "bom");
    };
  });

  document.querySelectorAll(".btMoverCaixa").forEach(function (b) {
    b.onclick = function () {
      fatias.forEach(function (f) { if (!f.caixa) f.caixa = b.dataset.caixa; });
      desenhar();
    };
  });

  // ----- somar, tirar e mover -----
  document.querySelectorAll(".mexerAbre").forEach(function (b) {
    b.onclick = function () {
      var p = b.closest(".lin").querySelector(".mexer");
      if (!p) return;
      p.hidden = !p.hidden;
      if (!p.hidden) p.querySelector(".mVal").focus();
    };
  });
  document.querySelectorAll(".mexer .mBt2").forEach(function (b) {
    b.onclick = function () {
      b.parentNode.querySelectorAll(".mBt2").forEach(function (o) { o.classList.remove("ativo"); });
      b.classList.add("ativo");
    };
  });

  var aplicar = function (botao, tipo) {
    var caixa = botao.closest(".mexer");
    var linha = botao.closest(".lin");
    var ordem = Number(linha.dataset.ordem);
    var quanto = Number(caixa.querySelector(".mVal").value);
    var ativo = caixa.querySelector(".mBt2.ativo");
    var moeda = ativo ? ativo.dataset.m : moedaVista;
    var sel = caixa.querySelector(".mDest");
    var destino = (tipo === "mover" && sel) ? Number(sel.value) : null;

    var r = linha.dataset.tipo === "token"
      ? mexerNaQuantidade(fatias, tipo, ordem, quanto)
      : mexerNaCarteira(fatias, tipo, ordem, destino, quanto, moeda, cotacao());
    if (r.erro) return recado("recadoCarteira", r.erro, "ruim");

    desenhar();
    recado("recadoCarteira", r.texto + " Falta apertar Salvar.", "bom");
  };

  document.querySelectorAll(".mPor").forEach(function (b) { b.onclick = function () { aplicar(b, "somar"); }; });
  document.querySelectorAll(".mTira").forEach(function (b) { b.onclick = function () { aplicar(b, "tirar"); }; });
  document.querySelectorAll(".mMove").forEach(function (b) { b.onclick = function () { aplicar(b, "mover"); }; });

  var btVerCopias = document.getElementById("btVerCopias");
  if (btVerCopias) btVerCopias.onclick = async function () {
    mostrarCopias = true;
    copias = null;
    desenhar();
    try {
      var r = await comAuth("/rest/v1/carteira_backup?select=id,quando,quantas&order=quando.desc&limit=30");
      copias = r.ok ? await r.json() : [];
    } catch (e) { copias = []; }
    desenhar();
  };

  document.querySelectorAll(".fimTopo").forEach(function (b) {
    b.onclick = function () { virarEncolhida(b.dataset.fim); desenhar(); };
  });

  document.querySelectorAll(".sbBt").forEach(function (b) {
    b.onclick = function () { irParaSubAba(b.dataset.sub); };
  });
  document.querySelectorAll(".btCorte").forEach(function (b) {
    b.onclick = function () {
      corteDaPizza = b.dataset.corte;
      try { localStorage.setItem("radar:corte", corteDaPizza); } catch (e) {}
      desenhar();
    };
  });

  var btDrive = document.getElementById("btDrive");
  if (btDrive) btDrive.onclick = function () { mandarProDrive(true); };

  var btFecharCopias = document.getElementById("btFecharCopias");
  if (btFecharCopias) btFecharCopias.onclick = function () { mostrarCopias = false; desenhar(); };

  document.querySelectorAll(".btVoltarPara").forEach(function (b) {
    b.onclick = async function () {
      b.textContent = "voltando…";
      var r = await comAuth("/rest/v1/rpc/restaurar_backup", {
        method: "POST", body: JSON.stringify({ qual: b.dataset.id }),
      });
      if (!r.ok) {
        return recado("recadoCarteira",
          "Não consegui voltar, e nada mudou: " + (await r.text()).slice(0, 100), "ruim");
      }
      /* Recarrega do banco em vez de confiar no que estava na tela: depois de
         restaurar, a verdade é o que está lá, não o que eu achava que estava. */
      mostrarCopias = false;
      fatias = null;
      copias = null;
      desenhar();
      recado("recadoCarteira", "Carteira restaurada. A de antes ficou guardada também.", "bom");
    };
  });

  var btRec = document.getElementById("btRecuperar");
  if (btRec) btRec.onclick = function () {
    var c = lerCopia();
    if (!c) return;
    fatias = c.linhas;
    renumerar();
    precosPedidos = null; posicoesPedidas = null; poolsPedidas = null;
    desenhar();
    recado("recadoCarteira", c.linhas.length + " linha(s) voltaram. Confira e aperte Salvar.", "bom");
  };

  // ----- encolher e expandir -----
  var abrirImp = document.getElementById("abrirImportar");
  if (abrirImp) abrirImp.onclick = function () { virarEncolhida("importar"); desenhar(); };
  var fecharImp = document.querySelector(".abreImportar");
  if (fecharImp) fecharImp.onclick = function () { virarEncolhida("importar"); desenhar(); };

  document.querySelectorAll(".cxVirar").forEach(function (el) {
    el.onclick = function () { virarEncolhida("cx:" + el.dataset.caixa); desenhar(); };
  });

  // ----- importar a carteira -----
  var elEnd = document.querySelector(".impEndereco");
  var btVarrer = document.getElementById("btVarrer");
  if (btVarrer) btVarrer.onclick = function () {
    var e = elEnd ? elEnd.value.trim() : (carteiraSolana || "");
    if (!e) return recado("recadoCarteira", "Cole o endereço da carteira primeiro.", "ruim");
    carteiraSolana = e;
    varrerCarteira(e);
  };

  var btEsq = document.getElementById("btEsquecerCarteira");
  if (btEsq) btEsq.onclick = async function () {
    carteiraSolana = null;
    achados = null;
    await comAuth("/rest/v1/carteira_solana?endereco=neq.", { method: "DELETE" });
    desenhar();
    recado("recadoCarteira", "Esqueci o endereço. Suas linhas continuam onde estavam.", "bom");
  };

  var btFecharImp = document.getElementById("btFecharImp");
  if (btFecharImp) btFecharImp.onclick = function () { achados = null; escolhas = {}; desenhar(); };

  document.querySelectorAll(".impMarca").forEach(function (b) {
    b.onchange = function () {
      var e = escolhas[b.dataset.k];
      if (e) e.marcado = b.checked;
      /* Redesenha só o botão, não a tela: redesenhar tudo perderia a rolagem
         no meio de uma lista de quinze itens. */
      var bt = document.getElementById("btImportar");
      if (bt) {
        var n = Object.keys(escolhas).filter(function (k) { return escolhas[k].marcado; }).length;
        bt.disabled = !n;
        bt.textContent = n ? "Importar os " + n + " marcados" : "Importar os marcados";
      }
    };
  });

  document.querySelectorAll(".impCaixa").forEach(function (sel) {
    sel.onchange = function () {
      var e = escolhas[sel.dataset.k];
      if (e) e.caixa = sel.value;
    };
  });

  var btImp = document.getElementById("btImportar");
  if (btImp) btImp.onclick = async function () {
    var quantos = importarEscolhidos();
    /* Guarda o endereço só agora, quando ele de fato importou alguma coisa.
       Guardar na varredura seria decidir por ele que a carteira fica salva. */
    if (carteiraSolana) {
      await comAuth("/rest/v1/carteira_solana", {
        method: "POST",
        headers: { prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ endereco: carteiraSolana }),
      }).catch(function () {});
    }
    desenhar();
    recado("recadoCarteira",
      quantos + (quantos === 1 ? " linha entrou" : " linhas entraram") + " na carteira. Falta apertar Salvar.", "bom");
  };

  // ----- o extrato de aportes, saques e colheitas -----
  document.querySelectorAll(".btMov").forEach(function (b) {
    b.onclick = function () {
      var ch = b.dataset.chave;
      movAberto = (movAberto === ch) ? null : ch;
      movNovo = null;
      movRecado = null;
      desenhar();
    };
  });

  document.querySelectorAll(".btMovNovo").forEach(function (b) {
    b.onclick = function () {
      movNovo = {
        chave: b.dataset.chave, tipo: b.dataset.tipo, valor: "",
        moeda: moedaVista, quando: new Date().toISOString().slice(0, 10),
      };
      movRecado = null;
      desenhar();
      var c = document.querySelector(".mvValor");
      if (c) c.focus();
    };
  });

  /* Os campos escrevem DIRETO no movNovo, no oninput.
   *
   * A mesma licao que consertou a carteira: ler o valor da tela na hora de
   * gravar da errado, porque a tela e redesenhada por preco novo, por posicao
   * que chegou, por qualquer coisa — e o que ele digitou some no meio. O
   * oninput nunca dispara em redesenho, entao o dado fica seguro. */
  var elV = document.querySelector(".mvValor");
  if (elV) elV.oninput = function () { if (movNovo) movNovo.valor = elV.value; };
  var elD = document.querySelector(".mvData");
  if (elD) elD.oninput = function () { if (movNovo) movNovo.quando = elD.value; };
  var elM = document.querySelector(".mvMoeda");
  if (elM) elM.onclick = function () {
    if (!movNovo) return;
    movNovo.moeda = movNovo.moeda === "USD" ? "BRL" : "USD";
    desenhar();
  };

  var elCancelar = document.querySelector(".btMovCancelar");
  if (elCancelar) elCancelar.onclick = function () { movNovo = null; desenhar(); };

  var elGravar = document.querySelector(".btMovGravar");
  if (elGravar) elGravar.onclick = function () { gravarMovimento(); };

  /* APAGAR EM DOIS TOQUES.
   *
   * O primeiro toque vira pergunta, o segundo apaga. Botao destrutivo que
   * obedece de primeira e o que faz alguem perder uma linha sem perceber, e
   * este apaga um lancamento que ele digitou a mao — nao da pra reler da
   * cadeia depois. */
  document.querySelectorAll(".btMovApagar").forEach(function (b) {
    b.onclick = function () {
      var id = b.dataset.id;
      if (movApagando !== id) { movApagando = id; movRecado = null; desenhar(); return; }
      apagarMovimento(id, b.dataset.chave);
    };
  });

  var elRep = document.querySelector(".btRepartir");
  if (elRep) elRep.onclick = function () {
    repartir = repartir && repartir.aberto
      ? { aberto: false, valor: repartir.valor, modo: repartir.modo }
      : { aberto: true, valor: (repartir && repartir.valor) || "", modo: (repartir && repartir.modo) || "novo" };
    desenhar();
  };

  /* O campo escreve DIRETO no estado, no oninput — a mesma lição da carteira:
     ler da tela na hora de calcular perde o que ele digitou no primeiro
     redesenho, e esta tela redesenha sozinha quando chega preço novo. */
  var elRepV = document.querySelector(".repValor");
  if (elRepV) {
    /* Troca só o MIOLO do resultado, nunca o campo. Refazer o campo tiraria o
       cursor do lugar a cada tecla digitada. */
    elRepV.oninput = function () {
      if (!repartir) return;
      repartir.valor = elRepV.value;
      var onde = document.getElementById("repResultado");
      if (onde) { onde.innerHTML = resultadoDeRepartir(contasDaCarteira()); ligarRepartir(); }
    };
  }

  ligarRepartir();

  var elSalvarJa = document.querySelector(".btSalvarAgora");
  if (elSalvarJa) elSalvarJa.onclick = function () {
    var b = document.getElementById("btSalvar");
    if (b) b.onclick();
  };

  /* DESCARTAR EM DOIS TOQUES. Joga fora trabalho que ele fez e que nao esta
     em lugar nenhum — nao pode obedecer de primeira. */
  var elDescartar = document.querySelector(".btDescartar");
  if (elDescartar) elDescartar.onclick = function () {
    if (!descartando) { descartando = true; desenhar(); return; }
    descartando = false;
    /* Recarrega do banco: depois de descartar, a verdade e o que esta la. */
    fatias = null;
    salvoComo = null;
    desenhar();
  };

  document.querySelectorAll(".btMudSim").forEach(function (b) {
    b.onclick = function () {
      var f = (fatias || []).find(function (x) { return x.chave === b.dataset.chave; });
      if (f) confirmarMudanca(f);
    };
  });
  document.querySelectorAll(".btReligar").forEach(function (b) {
    b.onclick = function () {
      var de = b.dataset.de;
      var sel = document.querySelector('.orfaoAlvo[data-de="' + de + '"]');
      var para = sel && sel.value;
      if (!para) {
        recado("recadoCarteira", "Escolha em qual linha esses lançamentos entram.", "ruim");
        return;
      }
      b.textContent = "religando…";
      comAuth("/rest/v1/rpc/religar_movimentos", {
        method: "POST", body: JSON.stringify({ de: de, para: para }),
      }).then(function (r) {
        if (!r.ok) {
          b.textContent = "religar";
          return recado("recadoCarteira", "Não consegui religar agora.", "ruim");
        }
        return r.json().then(function (quantos) {
          return recarregarMovimentos().then(function () {
            desenhar();
            recado("recadoCarteira", quantos + " lançamento(s) religados. Nada foi apagado.", "bom");
          });
        });
      }).catch(function () {
        b.textContent = "religar";
        recado("recadoCarteira", "Não consegui religar agora.", "ruim");
      });
    };
  });

  document.querySelectorAll(".btReabrir").forEach(function (b) {
    b.onclick = function () {
      var f = (fatias || []).find(function (x) { return x.chave === b.dataset.chave; });
      if (!f) return;
      comAuth("/rest/v1/rpc/reabrir_linha", {
        method: "POST", body: JSON.stringify({ qual: f.chave }),
      }).then(function (r) {
        if (!r.ok) return;
        f.fechada_em = null;
        /* Volta a perguntar à rede: pode ser que a posição exista mesmo. */
        posicoesPedidas = null;
        tamanhos = null;
        buscarPosicoes().then(function () { desenhar(); });
      }).catch(function () {});
    };
  });

  document.querySelectorAll(".btMudNao").forEach(function (b) {
    b.onclick = function () {
      var f = (fatias || []).find(function (x) { return x.chave === b.dataset.chave; });
      if (f) ignorarMudanca(f);
    };
  });

  document.querySelectorAll("button.cadeado").forEach(function (b) {
    b.onclick = function () {
      var f = (fatias || []).find(function (x) { return x.chave === b.dataset.chave; });
      if (f) travarLinha(f, !seguindo(f));
    };
  });

  // ----- achar a pool -----
  document.querySelectorAll(".btBuscarPool").forEach(function (b) {
    b.onclick = function () { abrirBuscaDePool(b.dataset.alvo, ""); desenhar(); };
  });
  document.querySelectorAll(".lcTrocarPool").forEach(function (b) {
    b.onclick = function () {
      if (lancando) lancando.pool_id = "";
      abrirBuscaDePool("lancar", "");
      desenhar();
    };
  });
  document.querySelectorAll(".eTrocarPool").forEach(function (b) {
    var i = Number(b.closest(".lin").dataset.i);
    b.onclick = function () {
      if (fatias[i]) fatias[i].pool_id = null;
      abrirBuscaDePool(String(i), "");
      desenhar();
    };
  });

  var campoBusca = document.querySelector(".bpTermo");
  if (campoBusca) {
    campoBusca.oninput = function () { buscaPool.termo = campoBusca.value; };
    campoBusca.onkeydown = function (e) { if (e.key === "Enter") procurarPool(); };
    var btProcurar = document.getElementById("btProcurarPool");
    if (btProcurar) btProcurar.onclick = procurarPool;
  }

  document.querySelectorAll(".btDeNovo").forEach(function (b) {
    b.onclick = function () {
      var e = b.dataset.endereco;
      delete posicoes[e];
      posicoesPedidas = null;
      b.textContent = "lendo…";
      buscarPosicoes().then(function () { desenhar(); });
    };
  });

  var btUsarPos = document.getElementById("btUsarComoPosicao");
  if (btUsarPos) btUsarPos.onclick = function () {
    var endereco = String(buscaPool.termo || "").trim();
    var alvo = buscaPool.alvo;
    buscaPool = null;
    if (alvo === "lancar") {
      if (lancando) { lancando.tipo = "pool"; lancando.posicao = endereco; }
    } else {
      var f = fatias[Number(alvo)];
      if (f) f.posicao = endereco;
    }
    posicoesPedidas = null;
    desenhar();
    lerPosicoes([endereco]).then(function (d) {
      if (d && d.posicoes) { for (var k in d.posicoes) posicoes[k] = d.posicoes[k]; }
      desenhar();
    });
  };

  document.querySelectorAll(".achado").forEach(function (b) {
    b.onclick = function () {
      var achada = buscaPool && buscaPool.achados[Number(b.dataset.i)];
      if (!achada) return;

      /* Guarda a pool escolhida na mão antes de qualquer ida à rede: senão a
         tela mostraria "pool 747c1d2a-..." no segundo entre escolher e o
         servidor responder, e um id cru na tela parece erro. */
      poolsCarteira[achada.id] = achada;

      if (buscaPool.alvo === "lancar") {
        if (lancando) {
          lancando.pool_id = achada.id;
          /* Preenche o que ele deixaria em branco, sem apagar o que escreveu.
             O nome vem do par e da rede porque é assim que ele chama a posição
             na cabeça: "ETH-USDC na Base". */
          if (!String(lancando.onde || "").trim()) lancando.onde = achada.projeto || "";
          if (!String(lancando.nome || "").trim()) {
            lancando.nome = (achada.simbolo || "") + (achada.rede ? " na " + achada.rede : "");
          }
        }
      } else {
        var f = fatias[Number(buscaPool.alvo)];
        if (f) {
          f.pool_id = achada.id;
          if (!String(f.onde || "").trim()) f.onde = achada.projeto || "";
        }
      }
      buscaPool = null;
      poolsPedidas = null;
      desenhar();
    };
  });

  // ----- o formulário de lançar -----
  var btAbrir = document.getElementById("btAbrirLancar");
  if (btAbrir) btAbrir.onclick = function () {
    lancando = { tipo: "token", token: "", quanto: null, moeda: moedaVista, caixa: null, nome: "", onde: "", pool_id: "" };
    desenhar();
  };
  var btFechar = document.getElementById("btFecharLancar");
  if (btFechar) btFechar.onclick = function () { lancando = null; desenhar(); };

  if (lancando) {
    var previa = function () {
      var el = document.getElementById("lcPrevia");
      if (el) el.textContent = previaDoLancamento(lancando);
    };
    var ligar = function (classe, campo, numero) {
      var el = document.querySelector(classe);
      if (!el) return;
      el.oninput = function () {
        lancando[campo] = numero ? (el.value === "" ? null : Number(el.value)) : el.value;
        previa();
      };
    };
    ligar(".lcTok", "token", false);
    ligar(".lcPosicao", "posicao", false);

    var elPos = document.querySelector(".lcPosicao");
    if (elPos) elPos.onchange = async function () {
      var e = elPos.value.trim();
      lancando.posicao = e;
      if (!e) return desenhar();
      lancando.lendoPosicao = true;
      desenhar();
      var d = await lerPosicoes([e]);
      lancando.lendoPosicao = false;
      if (d && d.posicoes) { for (var k in d.posicoes) posicoes[k] = d.posicoes[k]; }
      else posicoes[e] = { erro: "não consegui falar com a Solana agora" };
      desenhar();
    };
    ligar(".lcNome", "nome", false);
    ligar(".lcVal", "quanto", true);
    ligar(".lcOnde", "onde", false);

    var elTok = document.querySelector(".lcTok");
    if (elTok) elTok.onchange = function () {
      lancando.token = elTok.value;
      buscarPrecos().then(function () { desenhar(); });
    };

    document.querySelectorAll(".lcTipos .chip").forEach(function (b) {
      b.onclick = function () {
        lancando.tipo = b.dataset.tipo;
        // A pool é renda passiva por definição no método; ele pode mudar depois.
        if (lancando.tipo === "pool" && !lancando.caixa) lancando.caixa = "renda";
        desenhar();
      };
    });
    document.querySelectorAll(".lcCaixas .chip").forEach(function (b) {
      b.onclick = function () { lancando.caixa = b.dataset.caixa; desenhar(); };
    });
    document.querySelectorAll(".lcQuanto .mBt2").forEach(function (b) {
      b.onclick = function () { lancando.moeda = b.dataset.m; desenhar(); };
    });

    var btLancar = document.getElementById("btLancar");
    if (btLancar) btLancar.onclick = function () {
      var r = aplicarLancamento(lancando);
      if (r.erro) {
        var el = document.getElementById("lcPrevia");
        if (el) { el.textContent = r.erro; el.className = "lcPrevia ruim"; }
        return;
      }
      var novoToken = lancando.tipo === "token";
      lancando = null;
      renumerar();
      posicoesPedidas = null;
      if (novoToken) { buscarPrecos().then(function () { desenhar(); recado("recadoCarteira", r.texto + " Falta apertar Salvar.", "bom"); }); }
      else { desenhar(); recado("recadoCarteira", r.texto + " Falta apertar Salvar.", "bom"); }
    };
  }

  /* COM GUARDA, e a guarda entrou junto com a sub-aba de resumo: no resumo o
     botao Salvar nao existe, e pedir .onclick de um elemento que nao esta la
     estoura ali mesmo — levando junto TODO o resto de ligarCarteira, que roda
     depois. Era a tela inteira morrendo por causa de um botao ausente. */
  var btSalvarEl = document.getElementById("btSalvar");
  if (btSalvarEl) btSalvarEl.onclick = async function () {
    /* Sai daqui o que não tem nome nem símbolo: linha em branco é linha que ele
       começou e desistiu, e gravá-la só encheria a tela na próxima vez. */
    var novas = (fatias || []).filter(linhaTemConteudo);

    /* Se uma posicao ainda nao tem foto da entrada, tira agora. Vale para a
       linha que ele criou antes desta tela existir, ou colou o endereco a mao
       na edicao. Sem base nao ha PnL, e uma base errada seria pior. */
    var hoje = new Date().toISOString().slice(0, 10);
    novas.forEach(function (f) {
      if (!f.posicao) return;
      var pos = posicaoDaLinha(f);
      if (pos && !(Number(f.valor_entrada) > 0)) {
        /* So em dolar. Uma base em ETH gravada aqui viraria "+240756%" na tela
           de amanha, e ninguem mais saberia de onde veio. */
        var base = baseDeEntrada(pos);
        if (base != null) {
          f.valor_entrada = arred(base);
          f.data_entrada = hoje;
        }
      }
    });

    fatias = novas;
    renumerar();
    recado("recadoCarteira", "Salvando...", "");

    novas = novas.map(linhaParaOBanco);

    /* UMA chamada para cada coisa, e cada uma é uma transação no banco.
     *
     * Antes eram duas: apagar tudo, depois gravar tudo. Em 09/09/2026 o gravar
     * falhou e o apagar já tinha passado — os lançamentos do Rayakuza sumiram e
     * nada entrou no lugar. Dois pedidos separados nunca viram uma coisa só: se
     * o segundo falha, o primeiro já aconteceu.
     *
     * Agora quem apaga e grava é uma função dentro do banco. Se qualquer coisa
     * quebrar no meio, o apagar volta atrás junto e a carteira fica exatamente
     * como estava. Perder patrimônio por erro meu não pode ser possível. */
    var r2 = await comAuth("/rest/v1/rpc/salvar_alocacao", {
      method: "POST", body: JSON.stringify({ linhas: novas }),
    });
    if (!r2.ok) {
      return recado("recadoCarteira",
        "Não consegui salvar, e NADA foi perdido: " + (await r2.text()).slice(0, 110), "ruim");
    }

    var lista = Object.keys(alvos || {})
      .filter(function (k) { return alvos[k] != null && alvos[k] !== ""; })
      .map(function (k) { return { caixa: k, pct: Number(alvos[k]) }; });
    var r3 = await comAuth("/rest/v1/rpc/salvar_alvos", {
      method: "POST", body: JSON.stringify({ alvos: lista }),
    });
    if (!r3.ok) {
      return recado("recadoCarteira",
        "Salvei os lançamentos, mas não os alvos: " + (await r3.text()).slice(0, 90), "ruim");
    }

    fatias = novas;
    guardarCopia(novas);
    marcarComoSalvo();
    descartando = false;
    desenhar();
    recado("recadoCarteira", "Salvo.", "bom");
  };
}

function desenhar() {
  const alvo = document.getElementById("conteudo");
  if (!dados) return;
  desenharCiclo();
  if (aba === "hoje") {
    alvo.innerHTML = telaDeHoje();
    desenharAlertasBtc();
    /* Busca o preço de agora e redesenha se veio. Sem esperar: a tela aparece
       com o número da manhã e se corrige sozinha, em vez de ficar em branco
       enquanto uma chamada de rede acontece. */
    buscarBitcoin().then(function (veio) { if (veio && aba === "hoje") desenhar(); });
    ligarRelogioDoBtc();
  }
  else if (aba === "pools") { pararRelogioDoBtc(); alvo.innerHTML = telaDePools(); }
  else if (aba === "grandes") alvo.innerHTML = telaDeRedes("grandes");
  else if (aba === "pequenas") alvo.innerHTML = telaDeRedes("pequenas");
  else if (aba === "carteira") { alvo.innerHTML = telaDaCarteira(); ligarCarteira(); }
  else alvo.innerHTML = telaDeMudancas();
}

document.querySelectorAll(".abas button").forEach((b) => {
  b.onclick = () => {
    aba = b.dataset.aba;
    document.querySelectorAll(".abas button").forEach((o) => o.setAttribute("aria-selected", String(o === b)));
    desenhar();
  };
});

/* ---------------------------------------------------------------------------
 * A ABERTURA: conferir a versão antes de mostrar o mercado.
 *
 * O problema que isto resolve é concreto. O painel é um app instalado, com
 * service worker guardando a casca. Ele abria, via a tela de ontem, e a frase
 * que sobrava pra mim era "recarregue o app". Aqui o próprio app confere.
 *
 * A regra que decide tudo: NUNCA TRANCAR A PORTA. Sem internet, servidor fora,
 * resposta estranha — abre assim mesmo, avisando. Um radar que se recusa a
 * abrir por não conseguir conferir a versão é pior que um radar desatualizado.
 * ------------------------------------------------------------------------- */
/* A decisão da abertura, separada de tudo que é tela e rede.
 *
 * Fica sozinha porque é a única parte aqui que dá pra conferir: as outras são
 * fetch, caches e reload, que só existem no navegador. Quatro caminhos, e o
 * teste em testar-painel.js prova os quatro — inclusive o freio contra o laço,
 * que é o que impede o app de recarregar pra sempre e nunca abrir.
 *
 * A REGRA QUE MANDA: nenhum caminho tranca a porta. Sem internet, servidor
 * fora, resposta estranha — abre assim mesmo, avisando. Um radar que se recusa
 * a abrir por não conseguir conferir a versão é pior que um radar velho. */
function decidirAbertura(aqui, resposta, jaTentei) {
  if (!resposta || !resposta.versao) {
    return { passo: "sem-rede", abre: true,
      recado: "Não consegui conferir agora. Abrindo com a versão que está aqui." };
  }
  if (resposta.versao === aqui) {
    return { passo: "em-dia", abre: true, recado: "Tudo em dia." };
  }
  if (jaTentei === String(resposta.versao)) {
    return { passo: "laco", abre: true,
      recado: "Tentei atualizar e continuou nesta versão. Abrindo assim mesmo — mas me avise, porque não deveria acontecer." };
  }
  return { passo: "atualizar", abre: false, nova: resposta.versao,
    recado: "Versão nova (" + resposta.versao + "). Trocando…" };
}

(function abrirRadar() {
  const tela = document.getElementById("abertura");
  if (!tela) return;
  const trilho = document.getElementById("abTrilho");
  const recado = document.getElementById("abRecado");
  const acao = document.getElementById("abAcao");
  const AQUI = "${VERSAO}";

  const dizer = (t) => { if (recado) recado.textContent = t; };

  /* Meio segundo de piso, como jogo faz. Fechar em 80ms pareceria que nada
     foi conferido — e o ponto da barrinha é justamente ele ver que foi. */
  const comecou = Date.now();
  const respirar = () => new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - comecou))));

  const entrar = async (marca) => {
    await respirar();
    if (trilho) trilho.className = "abTrilho " + (marca || "pronto");
    setTimeout(() => {
      tela.classList.add("saindo");
      setTimeout(() => tela.remove(), 400);
    }, 320);
  };

  const limparEVoltar = async (nova) => {
    try { sessionStorage.setItem("radar:tentei", String(nova)); } catch (e) {}
    try {
      const nomes = await caches.keys();
      await Promise.all(nomes.map((n) => caches.delete(n)));
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) { /* sem cofre pra limpar, recarregar já resolve */ }
    location.reload();
  };

  (async () => {
    let d = null;
    try {
      const r = await fetch("/versao", { cache: "no-store" });
      if (r.ok) d = await r.json();
    } catch (e) { d = null; }

    let jaTentei = null;
    try { jaTentei = sessionStorage.getItem("radar:tentei"); } catch (e) {}

    const veredito = decidirAbertura(AQUI, d, jaTentei);
    dizer(veredito.recado);
    if (!veredito.abre) return limparEVoltar(veredito.nova);
    return entrar(veredito.passo === "em-dia" ? "pronto" : "parado");
  })();
})();

let convite = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); convite = e;
  document.getElementById("instalar").style.display = "block";
});
document.getElementById("instalar").onclick = async () => {
  if (!convite) return;
  convite.prompt(); await convite.userChoice; convite = null;
  document.getElementById("instalar").style.display = "none";
};
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

const COFRE = "radar:ultimo";
const guardar = (d) => { try { localStorage.setItem(COFRE, JSON.stringify({ quando: Date.now(), d })); } catch {} };
const desencavar = () => { try { return JSON.parse(localStorage.getItem(COFRE) || "null"); } catch { return null; } };

fetch("/api/radar").then((r) => r.json()).then((d) => {
  dados = d; guardar(d);
  const t = d.totais || {};
  document.getElementById("sub").textContent =
    d.dia + " · " + (d.quantasPools || 0) + " pools classificadas · " +
    (t.firme || 0) + " de taxas · " + (t.alugada || 0) + " de incentivo · " +
    (t.loteria || 0) + " loterias · " + (t.nova || 0) + " novas";
  if (d.fonteDeStablecoin && !d.fonteDeStablecoin.confiavel) {
    document.getElementById("alertas").innerHTML =
      '<div class="aviso"><b>Dado de stablecoin suspeito hoje</b> — ' + esc(d.fonteDeStablecoin.motivo) +
      '. As frases sobre "dinheiro de verdade" estão omitidas de propósito.</div>';
  }
  desenhar();
}).catch((e) => {
  const g = desencavar();
  if (!g) {
    document.getElementById("conteudo").innerHTML =
      '<div class="nada">Não consegui buscar: ' + esc(e.message) + '</div>';
    return;
  }
  dados = g.d;
  const horas = Math.round((Date.now() - g.quando) / 3600000);
  document.getElementById("alertas").innerHTML =
    '<div class="aviso"><b>Sem internet.</b> Isto é o que eu sabia ' +
    (horas < 1 ? "há menos de uma hora" : "há cerca de " + horas + (horas === 1 ? " hora" : " horas")) +
    ' — o mercado já mudou desde então.</div>';
  document.getElementById("sub").textContent = dados.dia + " · leitura guardada";
  desenhar();
});
</script>
</body>
</html>`;
}
