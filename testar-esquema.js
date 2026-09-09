/* Confere o schema.sql contra os INSERTs do código.
 *
 *   node testar-esquema.js
 *
 * Este arquivo existe por causa de dois estragos reais, e previne os dois:
 *
 * 1. Em 06/09/2026 o `schema.sql` tinha 22 colunas em `medida_piscina` e o
 *    código gravava 43. O banco no ar estava certo (as colunas foram criadas à
 *    mão quando cada recurso entrou), mas o arquivo que o README manda rodar em
 *    "Montar do zero" criaria uma tabela onde metade das gravações falharia.
 *    Um desvio assim não dói hoje — dói no dia em que se precisa remontar.
 *
 * 2. Antes disso, um INSERT ganhou colunas no MEIO da lista e os valores no
 *    FIM. O banco recebeu "muito-bom" na coluna da ficha, e o erro só apareceu
 *    depois, na leitura, como JSON inválido — longe de onde nasceu.
 *
 * A conferência é textual de propósito: não abre banco, não precisa de rede, e
 * roda junto com o resto em `npm run testar`.
 */

import { readFileSync, readdirSync } from "node:fs";

let passou = 0, falhou = 0;
function conferir(oQue, cond, det = "") {
  if (cond) { passou++; console.log(`  ok   ${oQue}`); }
  else { falhou++; console.log(`  FALHOU  ${oQue}${det ? ` — ${det}` : ""}`); }
}
const titulo = (t) => console.log(`\n${t}`);

const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

/* As tabelas do schema.sql, cada uma com a lista de colunas que declara. */
function tabelasDoEsquema(sql) {
  const tabelas = new Map();
  const re = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\n\);/g;
  let m;
  while ((m = re.exec(sql))) {
    const colunas = semComentarios(m[2])
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^(PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)/i.test(l))
      .map((l) => l.split(/\s+/)[0].replace(/[,()]/g, ""))
      .filter(Boolean);
    tabelas.set(m[1], colunas);
  }
  return tabelas;
}

/* O conteúdo de um parêntese que abre em `abre`, respeitando os de dentro.
 *
 * Regex não serve aqui: `VALUES (${escapar(dia)}, ...)` fecha o primeiro
 * parêntese DENTRO de `escapar(dia)`, e um `[\s\S]*?\)` para ali — o que fazia
 * a conferência achar 1 valor onde há 4. */
function dentroDoParentese(texto, abre) {
  let nivel = 0;
  for (let i = abre; i < texto.length; i++) {
    if (texto[i] === "(") nivel++;
    else if (texto[i] === ")" && --nivel === 0) return texto.slice(abre + 1, i);
  }
  return null;
}

/* Separa por vírgula no nível de fora — `numero(a, b)` é um valor, não dois. */
function porVirgulaDeFora(texto) {
  const partes = [];
  let nivel = 0, atual = "";
  for (const c of texto) {
    if (c === "(" || c === "{" || c === "[") nivel++;
    else if (c === ")" || c === "}" || c === "]") nivel--;
    if (c === "," && nivel === 0) { partes.push(atual); atual = ""; continue; }
    atual += c;
  }
  partes.push(atual);
  return partes.map((p) => p.trim()).filter(Boolean);
}

/* Todo INSERT do código, com a tabela, as colunas nomeadas e os valores. */
function insertsDoCodigo(fonte, arquivo) {
  const achados = [];
  const re = /INSERT(?:\s+OR\s+REPLACE)?\s+INTO\s+(\w+)\s*\(/gi;
  let m;
  while ((m = re.exec(fonte))) {
    const listaDeColunas = dentroDoParentese(fonte, re.lastIndex - 1);
    if (listaDeColunas == null) continue;
    const depois = re.lastIndex - 1 + listaDeColunas.length + 2;
    const ondeValues = fonte.slice(depois, depois + 200).search(/VALUES\s*\(/i);
    if (ondeValues < 0) continue;
    const abre = depois + ondeValues + fonte.slice(depois + ondeValues).indexOf("(");
    const listaDeValores = dentroDoParentese(fonte, abre) ?? "";

    achados.push({
      arquivo, tabela: m[1],
      colunas: porVirgulaDeFora(semComentarios(listaDeColunas)),
      marcas: (listaDeValores.match(/\?/g) || []).length,
      valores: listaDeValores,
    });
  }
  return achados;
}

const sql = readFileSync("schema.sql", "utf8");
const tabelas = tabelasDoEsquema(sql);

const fontes = [
  ...readdirSync("src").filter((f) => f.endsWith(".js")).map((f) => `src/${f}`),
  ...readdirSync(".").filter((f) => f.startsWith("semear") && f.endsWith(".js")),
];
const inserts = fontes.flatMap((f) => insertsDoCodigo(readFileSync(f, "utf8"), f));

// ---------------------------------------------------------------------------
titulo("O schema.sql foi lido");

conferir("achou tabelas no schema.sql", tabelas.size >= 8, `achou ${tabelas.size}`);
conferir("achou INSERTs no código", inserts.length >= 8, `achou ${inserts.length}`);
conferir("medida_piscina existe no schema", tabelas.has("medida_piscina"));

// ---------------------------------------------------------------------------
titulo("Toda coluna gravada existe na tabela");

for (const ins of inserts) {
  const declaradas = tabelas.get(ins.tabela);
  if (!declaradas) {
    conferir(`${ins.tabela} (de ${ins.arquivo}) está no schema.sql`, false,
      "o código grava numa tabela que o schema.sql não cria");
    continue;
  }
  const faltando = ins.colunas.filter((c) => !declaradas.includes(c));
  conferir(`${ins.tabela}: as ${ins.colunas.length} colunas gravadas existem`,
    faltando.length === 0,
    faltando.length ? `faltam no schema.sql: ${faltando.join(", ")}` : "");
}

// ---------------------------------------------------------------------------
titulo("Cada coluna tem exatamente um valor — o erro que desalinha tudo");

for (const ins of inserts) {
  /* Os semeadores montam SQL como texto (rodam uma vez, no PC do Rayakuza, e
   * geram um arquivo .sql), então não têm `?`. Contar as expressões separadas
   * por vírgula responde a mesma pergunta ali. */
  const valores = ins.marcas || porVirgulaDeFora(ins.valores).length;
  const como = ins.marcas ? "?" : "expressões";
  conferir(`${ins.tabela} (${ins.arquivo}): ${ins.colunas.length} colunas para ${valores} valores (${como})`,
    ins.colunas.length === valores,
    "coluna sem valor (ou o contrário) não dá erro na hora: grava tudo deslocado uma casa");
}

// ---------------------------------------------------------------------------
titulo("Nenhuma coluna repetida na mesma gravação");

for (const ins of inserts) {
  const vistas = new Set(), repetidas = new Set();
  for (const c of ins.colunas) (vistas.has(c) ? repetidas : vistas).add(c);
  conferir(`${ins.tabela}: sem coluna repetida`, repetidas.size === 0,
    [...repetidas].join(", "));
}

console.log(`\n${"-".repeat(60)}`);
console.log(falhou === 0 ? `TUDO VERDE — ${passou} conferências` : `${falhou} FALHARAM (de ${passou + falhou})`);
process.exit(falhou === 0 ? 0 : 1);
