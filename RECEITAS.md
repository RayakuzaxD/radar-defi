# Receitas: o que já funciona, e como foi feito

> Este arquivo nasceu como diário de construção da instância original, do
> Rayakuza, e continua vivo: solução nova entra aqui junto com o código. Os
> valores citados são de exemplo — cada instância tem os seus.

Pedido dele em 09/09/2026: *"um arquivo mostrando como cada coisa que hoje já
funciona foi feito seria bom, pode ser útil no futuro para criar outras
ferramentas iguais ou parecidas — você resolveu muita coisa para ser perdida"*.

Este arquivo é isso. Não é documentação de API: é a lista dos problemas que
custaram caro e as soluções que sobreviveram, com o **motivo** de cada uma —
porque a solução sem o motivo vira regra decorada, e regra decorada se quebra
no primeiro caso diferente.

Quase toda seção abaixo nasceu de um defeito real, e quase todo defeito foi
descoberto porque o Rayakuza olhou a tela e disse "isso está errado".

**Este arquivo é vivo** — pedido dele: *"aí vai adicionando as coisas novas
funcionais que formos implementando"*. Toda solução nova que custar caro entra
aqui, na hora, com o problema e o motivo. Receita que fica só na memória de uma
conversa se perde na próxima.

---

# Parte 1 — Ler a blockchain sem biblioteca

O radar não usa nenhuma biblioteca de Solana. São chamadas JSON-RPC cruas e
decodificação de bytes à mão. Cabe num Worker da Cloudflare e não tem etapa de
build.

## 1.1 Achar um endereço derivado sem fazer matemática de curva

**O problema.** Endereços de programa (PDA) na Solana são derivados por
SHA-256 mais uma checagem de que o resultado NÃO está na curva ed25519. Fazer
essa checagem exige aritmética de curva elíptica — código pesado.

**A solução.** Não fazer a checagem: **gerar os candidatos e perguntar à rede
qual existe.** O "bump" vai de 255 para baixo, e o primeiro fora da curva é o
válido. Na prática o certo é quase sempre 255, 254 ou 253.

```
para bump de 255 até 251:
    candidato = SHA256(sementes ++ [bump] ++ programa ++ "ProgramDerivedAddress")
pergunta getMultipleAccounts com os 5 candidatos
o que existir e tiver o dono certo é o endereço
```

Custa uma chamada de rede e zero matemática. Verificado: a posição da Orca dele
é bump 253, a obrigação da Kamino é 255.

**Quando reusar:** qualquer PDA, em qualquer programa. É o mesmo truque.

## 1.2 A conta de taxas de uma pool concentrada

Três armadilhas, e as três mordem em silêncio:

**Subtração com máscara de 128 bits.** `feeGrowthInside = global − abaixo −
acima`, e esses contadores **estouram de propósito**. A subtração precisa ser
`(a - b) & ((1n << 128n) - 1n)`. Sem a máscara o número vira negativo e a taxa
sai absurda.

**`Math.floor` com negativo.** O início do array de ticks é
`Math.floor(tick / passo) * passo`. Com tick negativo, `Math.floor(-1.2)` é
`-2` e não `-1` — e é isso que se quer. Truncar daria o array errado.

**Conferir contra a tela do protocolo.** A conta ficou pronta quando bateu
dígito a dígito com o tooltip da Orca — os dois pares de números bateram ao
milionésimo.

## 1.3 O SOL nativo não é uma conta de token

**O buraco.** `getTokenAccountsByOwner` devolve contas de token. O SOL nativo
não é uma — é o saldo da própria carteira, e pede `getBalance`. Ele ficou
**invisível por semanas**: uma linha inteira que o total nunca contou.

**Como apareceu.** Investigando um troco que não chegou numa pool. O troco do
auto-swap tinha voltado como SOL, e o radar não enxergava SOL.

**A solução.** Somar o `getBalance` à lista, usando o **mint do SOL embrulhado**
como chave. Economicamente são o mesmo ativo, e quem olha a carteira quer saber
quanto tem de SOL, não quantos formatos de SOL tem.

**A lição maior:** um ativo que não cabe no formato da pergunta não aparece nem
como zero. Ele simplesmente não existe. Vale perguntar, de qualquer fonte de
dados: *o que existe aqui que a minha pergunta não alcança?*

## 1.4 Nós de RPC: cobertura, não redundância

Nós públicos não são intercambiáveis. Cada um responde um subconjunto:

| nó | responde | falha em |
|---|---|---|
| publicnode | `getAccountInfo`, `getMultipleAccounts` | 403 em `getTokenAccountsByOwner` |
| leorpc | programa Token comum | erro interno no Token-2022 |
| oficial | tudo | 403 quando vem da Cloudflare |

A lista de nós é **cobertura**: tenta um, cai pro outro. E o que falhou entra no
resultado — `{ tokens, falhou }` — porque **"não achei" e "não consegui
perguntar" são coisas diferentes e o usuário precisa saber qual foi**.

## 1.5 O que denuncia um depósito

**A pergunta.** Como saber que ele pôs dinheiro numa posição, sem ele avisar?

**A resposta.** A **liquidez** de uma posição da Orca e a **quantidade de
cTokens** da Kamino só mudam quando ele deposita ou saca:

- preço andando — não mexe
- taxa acumulando — não mexe (fica guardada fora da posição)
- juro da Kamino — não mexe (quem sobe é o câmbio)

Guardar esse número a cada olhada e comparar é suficiente. E o valor do que se
mexeu sai de regra de três: `|n1 - n0| × valor / n1`.

**Cuidado com o tipo.** A liquidez passa de 10^18. Em `Number`, dois valores que
diferem no último dígito viram o mesmo número — justamente a diferença que
distingue "mudou" de "não mudou". Viaja como **texto**, compara em **BigInt**.

## 1.6 Ler o que entrou numa transação: os cofres, não a carteira

**O erro.** Para saber quanto entrou numa pool, olhei o saldo de SOL nativo da
carteira. Dava quase um dólar a mais do que de fato entrou — porque o SOL nativo paga
**aluguel de conta** e taxa de rede junto.

**O certo.** Olhar o que **entrou nos cofres do protocolo**. Nas mudanças de
saldo da transação, o endereço do pool ganha exatamente `qtdA` e `qtdB`:

```
Czfq3xZZ...  USDC  +5.000000000
Czfq3xZZ...  SOL   +0.050000000
```

Número limpo, ao milionésimo. Foi assim que a composição de três entradas
antigas foi reconstruída meses depois.

---

# Parte 2 — Não perder o dado de ninguém

Esta parte inteira nasceu de um acidente: em 08/09/2026 os lançamentos dele
sumiram. Cada regra abaixo é uma cicatriz.

## 2.1 Apagar e gravar têm que ser UMA transação

**O acidente.** Salvar era: `DELETE` tudo, depois `INSERT` tudo. Dois pedidos.
O `DELETE` passou, o `INSERT` falhou (PostgREST recusa lote quando as linhas têm
conjuntos de chaves diferentes — PGRST102), e a carteira ficou vazia.

**A regra.** Dois pedidos separados nunca viram uma coisa só. **Quem apaga e
grava tem que ser uma função dentro do banco** — em plpgsql, uma função é uma
transação: se qualquer coisa quebra no meio, o apagar volta atrás junto.

## 2.2 Chave estável: nada duradouro se pendura no `id`

**O problema.** Se o salvamento apaga e reinsere, **o `id` de cada linha nasce
novo a cada vez**. Qualquer coisa amarrada nele (histórico, anexos, marcações)
se perde silenciosamente — e some devagar, o que é pior.

**A solução.** Uma coluna `chave`, gerada uma vez no cliente, que viaja no
payload e volta igual. Sobrevive a renomear, reordenar e ao delete+insert.

**Gerar num lugar só.** Seis lugares criavam linha. Gerar a chave em cada um
seria seis chances de esquecer — e a linha esquecida não daria erro nenhum: ela
só não guardaria histórico, calada. A chave nasce dentro do `renumerar()`, que
todos chamam.

## 2.3 Quando a chave não vier, PROCURAR — nunca inventar

**O buraco que isso abriu.** Um app numa versão anterior salva sem mandar a
chave, e a função gerava uma nova pra cada linha. Todo o histórico ficava órfão,
sem erro e sem aviso. Aconteceu de verdade, minutos depois de a coluna nascer.

**O conserto.** Sem chave, a função monta um mapa das chaves atuais por
`(nome | caixa | n-ésima ocorrência)` **antes do delete**, e devolve a que já
era da linha. Chave nova só quando não acha nada.

**A regra geral:** toda coluna nova precisa entrar no `INSERT` da função de
salvar. Duas vezes uma coluna nasceu depois da função e ninguém as apresentou —
`cambio_entrada` e `fechada_em`. A segunda teria reaberto posições fechadas em
silêncio.

## 2.4 Histórico nunca é apagado — vira órfão

Quando a linha some, os lançamentos ficam pendurados numa chave que não existe
mais. **Não são deletados em cascata.** Isso salvou o histórico dele duas vezes
no mesmo dia.

E o órfão precisa de **caminho de volta na tela** — senão só quem tem acesso ao
banco consegue religar, e aí a proteção existe só no papel.

## 2.5 Ausência só vale como prova quando a leitura ficou completa

**O caso.** Ler os saldos da carteira para atualizar quantidades.
`getTokenAccountsByOwner` pode falhar e devolver **lista vazia sem erro** — e
lista vazia é indistinguível de "ele tirou tudo".

**A regra.** *Presença sempre vale; ausência só com leitura inteira.* A API
devolve `completo: true/false`, e o cliente só zera uma linha quando `completo`.

**O sub-caso que quase passou:** `null` também não é lista vazia. Uma falha
total de rede caía no mesmo caminho de "não achei o token" e zerava tudo. O
teste pegou antes de ir ao ar.

## 2.6 A última leitura boa

**O pior defeito possível numa ferramenta de patrimônio:** a leitura falha, o
valor some, **o total cai**, e as porcentagens se refazem sobre um total errado.
O usuário abre o app e vê "0%" — indistinguível de ter perdido o dinheiro.
Falha de rede com cara de prejuízo.

**A defesa.** Guardar o último valor lido de cada posição e voltar com ele,
**marcado como velho**, quando a leitura de agora falha.

> Número velho declarado velho é melhor que número ausente que parece zero.

**A armadilha de ordem:** a última leitura só chegava depois das posições serem
lidas — ou seja, faltaria exatamente no caso em que serve. Precisa ser buscada
junto com o resto.

## 2.7 Conferir não pode consumir o aviso

Uma rota de saúde pública que roda a rodada **de verdade** grava o estado novo.
Aí a rodada seguinte compara "fora" com "fora", não vê mudança, e o aviso some
para sempre. A rota que existe pra provar que o vigia funciona apagando
justamente o aviso.

Toda conferência roda **seca**: lê, calcula, conta, e não escreve.

*(Este defeito foi cometido duas vezes no mesmo dia — nas posições de manhã e
nos tokens à tarde. Está aqui porque uma regra que já se quebrou uma vez se
quebra de novo.)*

## 2.8 Cópias: as recentes E uma por dia

Guardar "as 30 mais recentes" parece suficiente e não é: **uma tarde de edição
gasta as 30** e apaga o histórico da semana. Sobrevivem duas famílias: as N mais
recentes (desfazer o que acabou de fazer) e **a última de cada dia** (voltar a
uma semana atrás).

## 2.9 Avisar do que não foi salvo — e calar do que muda sozinho

O aviso de "você tem alterações não salvas" só vale se ele **não aparecer à
toa**. As quantidades que seguem a carteira mudam sozinhas quando a blockchain
anda; se isso acendesse o aviso, ele apareceria em toda abertura e em duas
semanas ninguém leria.

O retrato que decide o aviso **ignora exatamente os campos que mudam sem o
usuário** — e só esses.

---

# Parte 3 — As contas que o dinheiro exige

## 3.1 Impermanent loss precisa de TOKENS, não de dólares

**O erro de desenho.** Guardei "quanto ele pôs" em dólar. Serve pra dizer quanto
rendeu. Não serve pra IL.

```
IL = o que a posição vale HOJE
   - o que os mesmos tokens valeriam se ele tivesse só SEGURADO
```

US$ 12,50 podem ser 0,06 SOL + 6,25 USDC ou qualquer outra combinação, e cada
uma se comporta diferente quando o preço anda. **Sem saber quais tokens e
quantos, a conta não existe.**

E somar em TOKEN, não em dólar: o que ele teria segurando é a soma das
quantidades avaliada ao preço de hoje — não a soma dos dólares que pôs.

## 3.2 As três linhas nunca viram uma

taxas ganhas · IL · resultado. Somar num número só esconde a única pergunta que
importa: **as taxas cobriram o rebalanceamento?** Existe caso em que o usuário
lucra em dólar e ainda assim perde para quem só segurou — e é exatamente isso
que o método quer que ele veja.

## 3.3 O pendente de cada tipo é um número diferente

- **Pool:** o valor lido da cadeia **não** inclui as taxas não recolhidas. Entram
  por fora.
- **Empréstimo:** o valor **já** inclui o juro (a quantidade de cTokens não muda;
  quem sobe é o câmbio). Somar por fora conta o dinheiro duas vezes.

Duas regras diferentes para o mesmo campo é exatamente o que vira erro
silencioso. Fica escrito num lugar só, com nome.

## 3.4 Colher não é sacar

Três movimentos, três efeitos:

| | efeito no custo |
|---|---|
| aporte | sobe |
| saque | desce |
| **colheita** | **não mexe** — é lucro que saiu do pendente |

Sem registrar a colheita, recolher as taxas **zera o pendente lido da cadeia** e
o ganho some: o momento em que o usuário realiza o lucro vira o momento em que a
ferramenta diz que não houve nenhum. É o mais cruel dos três, porque acontece
justamente quando deu certo.

## 3.5 Dinheiro novo não é dinheiro remanejado

```
remanejando (o total não muda):   falta = alvo × total − tem
aportando   (o total sobe junto): x = (alvo × total − tem) / (1 − alvo)
```

Pondo o valor de remanejamento como dinheiro novo, chega-se a 20% onde se queria
25%. E há um efeito contraintuitivo: **um aporte grande faz faltar dinheiro em
todas as caixinhas ao mesmo tempo**, porque o alvo de cada uma é uma fatia do
total, e o total cresceu.

## 3.6 Câmbio de compra fica congelado

Uma compra de R$ 100 em junho custou uns US$ 18 **àquele** câmbio. Converter pelo
dólar de hoje reescreve o passado e faz o preço médio mexer a cada oscilação da
moeda. Guardar `valor`, `moeda` e `valor_usd` — o último congelado no dia.

## 3.7 Tolerância proporcional, não fixa

"Está no alvo" com folga de 5 pontos é boa régua pra quem mira 60% e péssima pra
quem mira 5% — a tela dizia "no alvo" para uma caixinha em 0,8% de um alvo de 5%.
A folga passa a ser `min(5, alvo × 0,25)`.

**E a regra mora numa função só.** Consertar o cabeçalho e esquecer o bloco fez
as duas metades da mesma tela discordarem, e o usuário reparou na hora.

---

# Parte 4 — Um bot que não se aprende a ignorar

## 4.1 O silêncio é o padrão

A maior parte do código de um vigia é sobre **quando calar**. Bot que fala todo
dia é bot que se aprende a ignorar — e aí ele cala justamente no dia em que
tinha algo.

Regras que sobreviveram:

- **Um aviso por assunto por rodada**, no máximo.
- **Só quando o ESTADO muda.** Sair da faixa é notícia uma vez; continuar fora é
  o estado das coisas.
- **Estado e LADO são coisas diferentes.** "Dentro" e "perto da borda" são o
  mesmo lado; trocar entre eles não merece mensagem de madrugada.
- **Corte de poeira.** Uma carteira com doze tokens de menos de dois dólares
  viraria doze mensagens no primeiro dia.

## 4.2 A primeira olhada anota e cala

Sem estado anterior não há de onde ter mudado. O código comparava `null` com
"rendendo", achava que tinha mudado, e anunciava "VOLTOU PRA DENTRO DA FAIXA"
numa posição que nunca saiu.

**Mensagem falsa na estreia é o pior jeito de começar:** quem recebe aprende, na
primeira vez, que o bot inventa.

*(A exceção que vale: se na primeira olhada a coisa já está no estado ruim, isso
o usuário precisa saber — pode ter acontecido antes de o vigia existir.)*

## 4.3 Nenhuma frase manda fazer nada

"Saiu por cima e parou de render" é fato. "Melhor sair" é palpite sobre um futuro
que ninguém tem — e a decisão depende do imposto dele, do plano dele e do resto
da carteira.

**Isso é testável.** Uma regex de verbos proibidos roda contra o texto de todos
os avisos:

```js
/\b(saia|retire|feche|venda|compre|invista|deveria|recomendo|sugiro|melhor)\b/i
```

Se algum aviso novo usar um deles, o teste fica vermelho.

## 4.4 Falha silenciosa também é notícia

Se a leitura falha em **tudo**, o bot avisa — e a frase que mais importa é
*"Nada foi perdido — eu é que estou sem enxergar"*, porque é ela que separa
falha de prejuízo.

Só quando falha tudo: uma leitura que falha pode ser endereço errado do próprio
usuário; todas falharem é a fonte que caiu.

---

# Parte 5 — Front sem etapa de build

O painel inteiro é uma página servida pelo próprio Worker, escrita como um
template literal gigante. Sem npm no navegador, sem bundler, sem dependência
externa. Um `wrangler deploy` publica tudo.

## 5.1 O preço: a crase

**Uma crase dentro do template fecha a string e quebra a página inteira.** Foi
cometido **cinco vezes num único dia**, quase sempre num comentário
("o `import` lá em cima").

E a barra invertida também: dentro do template, `\"` vira `"` e `\s` vira `s`.
Uma regex `[\s\S]` vira `[sS]`.

**A defesa que funciona:** um teste que arranca o `<script>` da página gerada e
**manda o motor do JavaScript analisar**. Para o Node aquele código é texto;
sem esse teste, o erro só apareceria na tela do usuário.

## 5.2 Testar o código do navegador sem poder importá-lo

As funções do painel rodam no navegador e não podem ser importadas pelo Node. A
saída: **arrancar a função pelo nome, contando chaves**, e montar com `new
Function`.

Feio, e de propósito: testa exatamente o código que vai ao ar. Uma segunda cópia
das contas num módulo separado passaria no teste e divergiria da tela no
primeiro conserto feito num lugar só.

## 5.3 Quando a duplicação é obrigada, o teste obriga a concordar

Algumas contas precisam existir dos dois lados (servidor e navegador). Nesses
casos, o teste arranca **as duas** e exige o mesmo número nos mesmos casos. Foi
assim com a posição no ciclo e com o preço médio.

## 5.4 O campo escreve no dado, nunca o contrário

Ler o valor da tela na hora de gravar dá errado, porque a tela é redesenhada por
preço novo, por posição que chegou, por qualquer coisa — e o que o usuário
digitou some no meio.

**Todo campo escreve direto no estado, no `oninput`**, que nunca dispara em
redesenho. E quando só uma parte precisa se refazer, troca-se o miolo do
resultado, nunca o campo — senão o cursor pula a cada tecla.

## 5.5 Esconder valores dentro das funções que formatam

O modo privado (mostrar/ocultar patrimônio) tapa **as três funções que formatam
número de dinheiro**, não cada lugar da tela. Tapar de fora seria esconder 90%,
e 90% não é esconder: é o patrimônio aparecendo num canto que ninguém conferiu.

## 5.6 Ícone pequeno: massa cheia, não traço fino

Traço de 1,5 pixel some quando o ícone encolhe para 21. Silhueta sólida com
recortes vazados não some nunca.

E medir antes de escolher tamanho: reduzir a arte para 21, 28, 34, 40, 48 e olhar
é mais rápido que discutir.

**Testar nos dois temas.** Um ícone sem fundo funcionava no escuro e sumia no
claro. Foi um teste de dez segundos que derrubou meia hora de trabalho.

---

# Parte 6 — Como trabalhar nisso

## 6.1 Verificar contra a realidade, não contra a própria conta

Toda conta financeira aqui foi conferida contra a tela do protocolo ou contra a
blockchain: a faixa e o valor contra a Orca, o câmbio de cTokens contra a Kamino,
a composição das entradas contra os cofres do whirlpool.

**Provar uma fórmula contra ela mesma prova o erro junto.** Os testes de conta
neste projeto **põem o dinheiro e refazem a divisão**.

## 6.2 O teste guarda a história, não só o número

Cada teste diz **qual defeito ele pega** e **o que aconteceu** quando não
existia. Um teste chamado "deve retornar 25" não impede ninguém de reintroduzir
o bug; um teste que diz "pondo o valor de remanejamento como dinheiro novo, NÃO
chega — é o engano que ele quase cometeu" impede.

## 6.3 Quando ele diz que a tela está errada, ela está

Aconteceu várias vezes: o usuário reporta, eu tenho prova de que o servidor está
certo, e **o problema está entre os dois** — cache, versão velha no aparelho,
render antigo. Nunca na cabeça dele.

Duas vezes eu respondi "é o modo editar" antes de investigar. Nas duas havia
defeito real.

## 6.4 Erro engolido é o defeito que mais custa

`catch {}` vazio, `|| 0` em cima de um `null`, ausência tratada como zero. Todos
os piores defeitos deste projeto foram desse tipo: **a falha existia e ninguém
soube**.

A regra: falha vira **motivo escrito**, não silêncio. E `null` nunca vira zero
sem alguém decidir explicitamente que pode.

## 6.5 Armadilhas do ambiente (Windows + OneDrive)

- **`sed -i` seguido de `wrangler deploy` no mesmo comando publica o arquivo
  velho.** A sincronização do OneDrive atrasa a escrita o bastante. Publicar
  separado, e conferir com `curl .../versao` — o número é a prova.
- **O heredoc do Bash come barras invertidas**, mesmo com delimitador entre
  aspas. Para qualquer trecho com `\`, usar a ferramenta de edição direta.
- **PowerShell:** `&&` não encadeia, `npx.ps1` é bloqueado pela política de
  execução (usar `npx.cmd`).
- **`grep FALHAR` não detecta crash.** Um teste que morre de `ReferenceError`
  não escreve "FALHOU". Conferir o **código de saída**.
- **Corolário do heredoc, custou uma publicação em 08/09/2026:** ele reduz duas
  barras invertidas a uma. O Python recebe `\n`, entende quebra de linha, e
  escreve uma quebra DE VERDADE dentro de uma string JavaScript — arquivo
  quebrado no ar. Escapes de uma barra só (`\u00e7`) passam inteiros; os de
  duas, não. **Quando o texto precisa de quebra de linha, montar com**
  **`String.fromCharCode(10)`** e não escrever barra invertida em lugar nenhum.
  Aconteceu de novo escrevendo ESTE parágrafo, que descrevia a armadilha e caiu
  nela.

## 6.6 A rota de saúde achou o buraco que o teste não achava

`mandarCopias` estava importando quatro funções da Supabase que **nunca foram
importadas**. Os 65 testes passaram verdes: nenhum deles carrega `index.js` — é
o Worker, não tem como rodar fora da Cloudflare. `node --check` também passou:
identificador não declarado é erro de execução, não de sintaxe.

Quem achou foi `/saude/copia`, na primeira chamada, em três segundos:
`{"erro":"donosComCarteira is not defined"}`.

**A lição não é "escreva mais testes".** É que **código que só existe dentro do
cron precisa de uma porta que o exercite por fora** — senão o primeiro ensaio
dele é às 8h da manhã, sozinho, sem ninguém olhando, e o resultado é um backup
que não aconteceu. A rota lê e mede, mas não manda: conferir não pode consumir
(§4 do vigia, mesma regra).

## 6.7 Automático não dispensa o botão

A cópia vai sozinha toda manhã **e** existe `/copia` no bot. Não é redundância:

- o automático **cala quando nada mudou** (senão o histórico dele vira uma pilha
  de arquivos idênticos, que é o mesmo que não ter histórico);
- por isso, no dia em que ele QUER o arquivo na mão, o automático é justamente
  quem não vai mandar.

Toda rotina que se cala por bom motivo precisa de um pedido à mão que ignore o
motivo. E o pedido à mão é também o único jeito de ele **provar pra si mesmo**
que a proteção existe, sem esperar amanhã.

## 6.8 Um nome de arquivo nunca pode cair num texto fixo

A cópia no Drive subiu como **`carteira-hoje.json`**. O campo de data no banco
chama-se `gerado_em`; o código lia `quando`, que não existe, e caía no `|| "hoje"`
do fim da expressão.

O arquivo estava perfeito por dentro. O defeito só apareceria **amanhã**: como o
app procura pelo nome antes de criar, ele acharia `carteira-hoje.json` e gravaria
por cima. Todo dia, para sempre — um backup que apaga o backup anterior, com
cara de estar funcionando.

**A regra:** quando um nome de arquivo depende de um campo, o valor de reserva
tem que ser outra data — medida na hora, se preciso —, nunca uma palavra. Data
errada por algumas horas é um arquivo a mais; nome constante é um apagador.

E o que achou foi olhar o Drive **pelo outro lado**, não a tela do app. A tela
dizia "Drive: 17:26:12" e estava certa: ela grava, mesmo. Só o lado de lá sabia
com que nome.

## 6.9 A ordem que o banco não promete

Duas listas do retrato saíam sem `order by`. O Postgres não promete ordem sem
ela, e devolvia as mesmas linhas trocadas entre chamadas. Como as duas cópias
decidem se gravam comparando a **impressão digital do texto**, isso virava
gravação à toa: ele regravou no Drive às 17:37 uma carteira idêntica à das 17:32.

Não é sobre performance nem sobre estética do SQL. **Todo lugar onde o conteúdo
vira uma digital exige ordem determinística em cada lista** — senão o "mudou?"
mente, e mentindo pra mais (grava sempre) ele apenas incomoda; num desenho um
pouco diferente mentiria pra menos, e aí deixa de copiar.

## 6.10 Pedir permissão só quando há o que fazer

Primeira versão do Drive: pedia o token do Google, depois olhava se a carteira
tinha mudado. Ele viu na hora — *"quando eu coloco em carteira pede pra escolher
uma conta toda vez"*.

A ordem estava invertida. Quase toda abertura do painel não tem nada pra copiar,
e a janela aparecia justamente nessas. Invertido: lê, compara a digital, e só
então encosta no Google. Nas aberturas em que nada mudou, o Google nem é chamado.

**A regra geral:** o pedido de permissão vai o mais tarde possível no caminho —
depois de todas as perguntas que se responde sozinho. Permissão pedida à toa
ensina a pessoa a clicar em "permitir" sem ler, que é o oposto do que ela serve.

Junto veio a segunda metade: com **três contas Google** no celular dele, renovar
calado é impossível sem dizer qual. A dica (`hint`) vem do próprio Drive depois
da primeira gravação e mora só no aparelho — **nunca escrita no código, porque o
painel é uma página pública e e-mail em página pública é dado pessoal exposto.**

## 2.10 Onde os dados moram: a escolha que não tem meio-termo

Ele propôs guardar a carteira de cada pessoa no Drive **dela**, e a ferramenta
só ler. A intuição é boa — "os dados ficam com a pessoa" — mas o Drive não
compra o que parece comprar, e a análise vale pra qualquer ferramenta assim.

**O que quebra a soberania não é onde os dados moram. É o aviso de fundo.**

Se a ferramenta precisa avisar às 8h da manhã, com o app fechado, ela precisa
ler os dados enquanto ninguém está logado — e pra isso **alguma coisa guarda uma
credencial**. Sempre. Trocar Supabase por Drive não elimina a credencial: troca
uma chave estreita (as tabelas de um projeto) por um token grosso (arquivos de
uma conta Google inteira).

E Drive não é banco: sem consulta, sem escrita concorrente, sem regra por linha.
Cada salvamento reescreveria um arquivo inteiro, e dois aparelhos salvando junto
se atropelam.

**As três arquiteturas, honestamente:**

| | quem guarda credencial | avisa com o app fechado |
|---|---|---|
| banco com regra por dono (hoje) | o servidor, com chave estreita | sim |
| banco no Drive de cada um | o servidor, com token grosso | sim |
| tudo no navegador | ninguém | **não** |

A terceira é a única que cumpre "ninguém toca nos meus dados", e o preço dela é
o bot inteiro. **Qualquer ferramenta que prometa as duas coisas está escondendo
onde a chave mora.**

**A saída que serve:** banco com isolamento por dono (que já dá a propriedade
que interessa) **e** o Drive como CÓPIA — arquivo do usuário, na conta dele, que
ele pode abrir, guardar ou levar embora. Fecha o buraco de "e se o banco sumir?"
sem desfazer nenhuma proteção existente.

---

## 6.11 A caixinha é sobre a finalidade, não sobre a moeda nem o token

Ele perguntou como o app sabe se um lançamento é em real ou em dólar, e chegou
sozinho à conclusão certa: *"a diferença é pra que serve o dinheiro ou onde ele
estiver alocado — posso usar USDT ou USDC das minhas carteiras e mantê-los como
reserva de oportunidade também"*.

Está certo, e o app já era assim — mas por acidente de desenho, não por decisão
escrita. Vale ficar escrito, porque é o que impede a próxima tela de errar:

| | o que guarda | pergunta a moeda? |
|---|---|---|
| **linha de dinheiro** | um valor fixo + a moeda | **sim** |
| **linha de token** | a **quantidade** | **não** — o preço vem ao vivo |

Três eixos independentes: a **caixinha** diz a finalidade, a **moeda** diz a
unidade, o **token** diz o ativo. Misturar dois deles é o erro clássico —
"a caixinha Caixa é a das stablecoins" seria falso: ela é a do dinheiro que
serve de reserva, esteja em real, em dólar ou em USDC.

E a moeda de uma linha **congela no lançamento**. O botão R$/US$ do topo só muda
a exibição. Se ele reescrevesse a moeda da linha, a cotação de amanhã mudaria o
passado dele — o mesmo princípio do câmbio congelado (§3.6).

## 6.12 Avisar, não repartir

Duas linhas do mesmo token seguindo a carteira recebem, cada uma, o saldo
**inteiro** — a carteira tem um número só e não sabe que ele quis dividir. O
total dobra em silêncio e as porcentagens do B.A.R.C.A. se refazem por cima de
um total errado.

Havia duas saídas. Repartir o saldo entre as linhas seria mais confortável e
está errado: exigiria **eu adivinhar** quanto vai pra cada uma. O aviso põe o
problema na frente dele e a decisão na mão dele — e some sozinho quando ele
tranca uma no cadeado, o que é a confirmação de que resolveu, sem precisar
dispensar nada.

Duas escolhas dentro do aviso:

- **Compara por endereço do token, não pelo símbolo.** Na Solana qualquer um
  cria um token chamado "USDC". O endereço é quem não repete.
- **Fica ACIMA das sub-abas**, não dentro de uma. O total dobrado estraga tanto
  a tela de editar quanto a pizza do resumo; morar em uma das duas o esconderia
  justamente de metade dos olhares.

## 6.13 O que o radar mede e joga fora

O radar mostra as redes **que se mexeram**. A Solana está de lado — então a rede
onde o dinheiro dele mora não aparecia em lugar nenhum, embora fosse medida
todo santo dia. Ele viu antes de mim: *"hoje você só faz resumo do que está no
radar, ou seja, as melhores — mas de tokens específicos como os que eu coloco na
carteira, não faz"*.

**A lição é sobre filtro por relevância global.** "Mostrar o que mudou mais" é
uma boa regra para descobrir; é uma péssima regra para acompanhar. As duas
precisam de caminhos separados — `/api/radar` responde "o que está acontecendo",
`/api/chao` responde "como está o que é meu".

E o recorte veio dele também: o valor e o rendimento da posição ele lê na Orca e
na Kamino. **Não repetir o que a ferramenta de origem já mostra melhor.** O que
sobra — se o protocolo está enchendo ou esvaziando — é pequeno, e é tudo.

## 6.14 Nenhum botão é agarrado sem conferir se está na tela

A sub-aba "resumo" tirou o botão Salvar do desenho, e `ligarCarteira` fazia
`document.getElementById("btSalvar").onclick = ...` direto. Sem o botão isso
estoura ali mesmo — e leva junto **todo o resto da função**, que roda depois.
Um botão ausente matando a aba inteira.

A tela é montada por pedaços que aparecem e somem conforme o estado, então
**nenhum elemento é garantido**. Há um teste que varre a página atrás dessa
classe de erro, com duas exceções que ele conhece pelo nome: os do esqueleto
fixo do HTML, e os da tela de login (ligados no ramo que acabou de desenhá-la).

Vale além deste projeto: toda tela que troca de modo cria essa armadilha, e ela
não aparece em nenhum teste de lógica — só quando alguém abre o modo novo.

# O que eu faria de novo, na mesma ordem

Se fosse começar uma ferramenta parecida amanhã:

1. **Separar o público do pessoal em duas bases desde o primeiro dia.** O painel
   é público; patrimônio não pode estar a um endereço de distância.
2. **Chave estável em toda linha, antes de existir qualquer coisa amarrada a
   ela.** Barato agora, caro depois.
3. **Salvamento como função do banco**, nunca dois pedidos.
4. **Guardar composição, não só valor.** Dólar não reconstrói token; token
   reconstrói dólar.
5. **Congelar o câmbio no dia.**
6. **Escrever o teste da falha antes do conserto**, com a história dentro.
7. **Ter uma rota de saúde seca** desde cedo — e nunca deixá-la escrever.
8. **Assumir que a fonte de dados vai cair**, e decidir desde o começo o que a
   tela mostra quando isso acontecer.
9. **Mandar a cópia de segurança pelo canal que já está de pé**, e não pelo
   canal certo que ainda não existe. O Telegram já falava com ele; o Drive
   precisava de um Client ID. A cópia que protege é a que começou a rodar.
10. **Conferir do outro lado.** A tela do app dizia que a cópia subiu, e dizia a
    verdade. O nome errado do arquivo só existia no Drive, e só apareceu porque
    fui olhar lá. Toda entrega que sai da máquina — arquivo, mensagem, gravação
    — se confere no destino, não na origem.
11. **Separar a tela de olhar da tela de mexer.** Ele pediu sub-aba, e o motivo
    é bom: olhar não pode ter risco de esbarrar num campo e mudar o que estava
    salvo.
