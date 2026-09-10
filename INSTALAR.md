# Como colocar o radar no ar

Meia hora, tudo de graça. Você vai precisar de conta na **Cloudflare**, no
**Telegram**, na **Supabase** e na **Helius** — as duas últimas só se quiser a
parte de carteira (lançamentos, preço médio, leitura de posições na Solana).
O radar de mercado funciona só com as duas primeiras.

Faça na ordem. O passo 5 depende do 4, e o 6 depende do 5.

---

## 0. Escolha o seu caminho: grátis ou US$ 5/mês

**Esta é a única decisão do roteiro, e ela já vem escolhida** — o padrão é o
gratuito. Leia, e só mexa se quiser o outro.

O plano gratuito da Cloudflare dá **10 milissegundos de processamento** por
rodada. O radar baixa do DefiLlama:

| fonte | tamanho |
|---|---|
| redes | 64 KB — cabe folgado |
| protocolos | **8,8 MB** — estoura sozinho |
| pools | **11,8 MB** — estoura sozinho |

Não é a frequência que não cabe: é o peso de **uma** rodada. Rodar uma vez por
dia em vez de quatro não muda nada.

### 🆓 Modo econômico — o padrão

A nuvem cuida do que é leve e constante. O seu computador cuida do que é pesado,
com um comando por dia:

```bash
node medir-pools.js
```

| na nuvem, sozinho | no seu computador, 1×/dia |
|---|---|
| radar de redes | as pools (chão, cartaz, classes) |
| o ciclo e os indicadores do curso | a qualidade das redes |
| a carteira, posições e preço médio | |
| o vigia e os avisos no Telegram | |
| as cópias de segurança | |

**Tudo funciona.** A única diferença é onde a parte pesada roda. Se você pular
um dia, nada se perde — a aba Pools mostra a medida do último dia em que você
rodou, **com a data à mostra**, sem fingir que é de hoje.

> Dica: dá pra agendar o comando no seu sistema (Agendador de Tarefas no
> Windows, `cron` no Linux/Mac) e nunca mais lembrar dele.

### 💳 Tudo na nuvem — US$ 5/mês

Com o **Workers Paid** ativo, a nuvem faz tudo sozinha e você nunca roda nada à
mão. Duas mudanças no `wrangler.jsonc`:

1. `"ECONOMICO": "false"`

E pronto — os horários não mudam. A nuvem passa a medir as pools sozinha, uma
vez por dia, na rodada das 08h.

São US$ 5 fixos: as franquias do plano pago são grandes o bastante pra que o
radar não gere um centavo além da assinatura.

---

## 1. Criar o bot no Telegram

No Telegram, procure por **@BotFather** e mande:

```
/newbot
```

Ele pede um nome (qualquer um, ex.: `Radar DeFi meu`) e um usuário, que
precisa terminar em `bot` (ex.: `radar_defi_seu_bot`).

No fim ele devolve um **token**, que se parece com
`8123456789:AAF...`. Guarde — é a senha do bot. Não coloque em arquivo nenhum
do projeto.

---

## 2. Criar o banco

Dentro da pasta `radar-defi`:

```bash
npx wrangler d1 create radar-defi
```

Ele devolve um bloco com `database_id = "algo-com-tracinhos"`. Copie esse id e
cole no `wrangler.jsonc`, no lugar de `00000000-0000-0000-0000-000000000000`.

Depois crie as tabelas:

```bash
npx wrangler d1 execute radar-defi --remote --file=schema.sql
```

---

## 3. Publicar

```bash
npx wrangler deploy
```

No fim ele mostra o endereço. Sem domínio próprio, ele é
`radar-defi.SEU-USUARIO.workers.dev`. Guarde.

### 3b. Domínio próprio (opcional, mas decida ANTES de instalar no celular)

Se você tem um domínio **na Cloudflare** (nameservers apontando pra lá),
acrescente ao `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "radar.SEUDOMINIO.com.br", "custom_domain": true }
]
```

e publique de novo. A Cloudflare cria o registro de DNS e o certificado sozinha.

Três coisas que valem saber:

1. **Isso DESLIGA o `workers.dev`.** Assim que existe uma rota de domínio, o
   endereço antigo passa a dar 404. Se o webhook do Telegram já estiver ligado,
   refaça o passo 5 no endereço novo — senão o bot emudece.
2. **Para um aplicativo instalado, o endereço é a identidade.** Trocar depois de
   instalado no celular cria um app NOVO: ícone novo, e a última leitura
   guardada não vai junto. Por isso decida antes.
3. **Use subdomínio, não a raiz.** `radar.dominio.com.br` deixa a raiz livre e
   abre espaço pros outros aplicativos no mesmo domínio. App comendo o domínio
   inteiro é escolha difícil de desfazer.

> **Se der erro de "Workers Free limit of 5 cron triggers per account":** o
> limite é por CONTA, não por worker — some os crons dos seus outros workers.
> O radar cabe em 2 expressões porque os três horários dele estão numa lista só.
> Se um dia precisar de mais um horário, **acrescente à lista de horas** no
> `wrangler.jsonc` (`0 11,15,21 * * *`) em vez de criar outra linha — a
> Cloudflare conta expressões, não disparos.

---

## 4. Guardar os segredos

Dois agora (os da carteira entram nos passos 9 e 10). Ele pergunta o valor e
você cola:

```bash
npx wrangler secret put TELEGRAM_TOKEN
```

```bash
npx wrangler secret put GATILHO
```

O `GATILHO` é uma palavra secreta inventada por você — sem espaço e sem acento,
ex.: `radar-meu-9182`. Ela vira parte de um endereço, e é o que impede
qualquer um de mandar o radar rodar. Guarde também.

O `TELEGRAM_CHAT` **não precisa**: o radar descobre sozinho no passo 6.

---

## 5. Ligar o Telegram no radar

Abra no navegador, trocando só o gatilho:

```
https://radar.SEUDOMINIO.com.br/ligar-telegram/SEU-GATILHO
```

Deve responder `{"ligou":true,...}`.

> **Por que não é o jeito que os tutoriais ensinam.** O caminho comum é montar à
> mão uma URL da `api.telegram.org` com o token do bot no meio dela e colar no
> navegador. Funciona, e é um jeito ótimo de vazar o token: ele fica no histórico
> do navegador, e basta uma letra errada pra não funcionar sem dizer por quê.
> Aqui o radar já tem o token guardado e sabe o próprio endereço, então ele mesmo
> se liga. O token não sai da Cloudflare.

---

## 6. Dar bom dia pro bot

No Telegram, abra a conversa com o seu bot e mande:

```
/oi
```

Ele responde com a lista de comandos — e nesse momento guarda o seu chat, que é
pra onde os avisos vão daqui pra frente. **Sem este passo ele nunca fala
sozinho**, porque não sabe com quem falar.

---

## 7. Dar memória a ele (o passo que quase todo mundo pula)

O radar guarda uma foto por dia e compara. Recém-publicado, ele tem uma foto só
— e uma foto não se compara com nada. Sem este passo ele passa **uma semana
mudo**, e uma semana mudo é o suficiente pra você parar de confiar nele.

```bash
node semear.js
```

Demora alguns minutos: são as 120 maiores redes, 45 dias de histórico, duas
passadas (valor parado e stablecoins). Ele busca, monta um `semente.sql` e manda
pro banco sozinho.

> Já existe um `semente.sql` pronto na pasta, colhido em **02/09/2026** (120
> redes, 46 dias). Se você estiver publicando no mesmo dia ou no seguinte, dá pra
> pular a espera e mandar direto:
>
> ```bash
> npx wrangler d1 execute radar-defi --remote --file=semente.sql
> ```
>
> Se já passou mais que isso, rode o `semear.js` — ele não duplica nada e traz os
> dias que faltam.

Quer ir mais fundo (mais redes pequenas no radar, mais demora):

```bash
node semear.js 200 90
```

### 7b. E o histórico das POOLS

O passo 7 dá memória às redes. As pools precisam da própria:

```bash
node semear-pools.js
```

Demora uns 14 minutos e é lento de propósito — a API devolve o gráfico de uma
pool por chamada e barra (`429`) quem pede rápido demais. Em 05/09/2026, seis
chamadas simultâneas derrubaram 41 de 70 pedidos.

Sem este passo a aba **Pools** fica vazia, que é justamente a tela principal.

Depois dele, calcule as medidas:

```
https://radar.SEUDOMINIO.com.br/rodar/SEU-GATILHO?seco&medir
```

Confira se pegou:

```
https://radar.SEUDOMINIO.com.br/saude
```

A resposta tem duas metades independentes, `redes` e `pools`, cada uma com o
seu `pronto`. As duas precisam dizer `"sim"` — as redes podem estar prontas e as
pools não, e o sintoma disso é a aba principal vazia sem explicação.

Se faltar, rode o semeador de novo: nenhum dos dois duplica nada.

---

## 8. Provar que funciona

Primeiro **em seco** — ele faz a rodada inteira (grava a foto, consulta o que já
avisou, monta o texto) e devolve a mensagem na tela, sem mandar nada pra ninguém:

```
https://radar.SEUDOMINIO.com.br/rodar/SEU-GATILHO?seco
```

A resposta traz `mostrados` e `anotados`. Eles diferem quando a mensagem não
coube inteira, e está tudo bem — o que importa é que ambos existam.

Chame **de novo**, na mesma hora. Tem que responder `"calou": true`. Se na
segunda vez vier mensagem outra vez, o "não repetir" está quebrado e ele vai
tocar seu celular de quatro em quatro horas com o mesmo assunto.

Aí sim, valendo:

```
https://radar.SEUDOMINIO.com.br/rodar/SEU-GATILHO?tudo
```

Deve chegar uma mensagem no Telegram.

E o painel:

```
https://radar.SEUDOMINIO.com.br/painel
```

Pronto. A partir daqui ele acorda sozinho às 8h, 12h e 18h.

---

## 9. A carteira (opcional): Supabase

Tudo até aqui é o radar de MERCADO, que é público. A aba **Carteira** — os
lançamentos, o preço médio, as caixinhas do B.A.R.C.A. — guarda dado pessoal, e
dado pessoal não entra no D1, porque o painel é uma página pública. Ele mora na
Supabase, atrás do SEU login, com RLS (cada linha pertence a um usuário e só
ele lê).

1. Crie um projeto em [supabase.com](https://supabase.com) (grátis).
2. No **SQL Editor**, cole e rode o conteúdo de `supabase/migracoes/todas.sql`.
   São todas as tabelas, funções e regras de segurança, na ordem.
3. Em **Settings → API**, copie a **URL** e a chave **publishable**. A URL vai
   em DOIS lugares: no `wrangler.jsonc` (`vars.SUPABASE_URL`) e, junto com a
   chave, nas linhas marcadas com `>>> PREENCHA <<<` do `src/painel.js`. Essa
   chave é publicável mesmo — quem protege os dados é a RLS.
4. A **service key** (Settings → API → `service_role`) vai pra Cloudflare, e
   NUNCA pro código:

```bash
npx wrangler secret put SUPABASE_SERVICE_KEY
```

Ela existe por um motivo só: o bot rodar de manhã, quando ninguém está logado,
pra vigiar posições e mandar a cópia de segurança. As leituras que a usam são
estreitas de propósito (`src/supabase.js`).

Publique de novo (`npx wrangler deploy`) e crie sua conta na tela de login do
painel.

---

## 10. As posições na Solana (opcional): Helius

Pra ler pools da Orca e empréstimos da Kamino direto da blockchain, o radar
precisa de um nó RPC. Os públicos bloqueiam justamente as chamadas que ele usa
— um recusa `getTokenAccountsByOwner`, outro erra Token-2022, o oficial barra
a Cloudflare. A [Helius](https://helius.dev) resolve os três no plano grátis.

Crie a conta, copie a URL do RPC (com a chave dentro) e:

```bash
npx wrangler secret put SOLANA_RPC
```

**Sobre carteira: só o endereço público, SEMPRE.** O radar lê saldo e posição, e
mais nada. Frase-semente e chave privada não entram aqui, não são pedidas em
tela nenhuma — e se algum dia uma tela pedir, desconfie do código que você
acabou de puxar.

---

## 11. A cópia no Google Drive (opcional)

O painel pode gravar uma cópia da carteira no Drive DE QUEM USA — escopo
`drive.file`, que só enxerga os arquivos que o próprio app criar. Precisa de um
OAuth Client ID (grátis, ~10 min):

1. [console.cloud.google.com](https://console.cloud.google.com) → novo projeto.
2. **APIs e serviços → Biblioteca** → ativar a **Google Drive API**.
3. **Tela de permissão OAuth** → Externo → preencha nome e e-mails → criar. O
   app nasce em modo "Testando": adicione os usuários em **Público-alvo →
   Usuários de teste**.
4. **Clientes → Criar cliente** → tipo **Aplicativo da Web** → em *Origens
   JavaScript autorizadas*, o endereço do seu radar (sem barra no final). URIs
   de redirecionamento: vazio.
5. Copie o **Client ID** (termina em `.apps.googleusercontent.com`) e cole na
   linha `var DRIVE_ID = ""` do `src/painel.js`. Client ID não é segredo; a
   chave secreta do cliente não é usada — pode até apagar.

Com o campo vazio, o botão do Drive simplesmente não aparece. Nada mais muda.

---

## 12. As pools, no modo econômico

Se você ficou no gratuito (o padrão), este é o comando que mantém a aba Pools
viva:

```bash
node medir-pools.js
```

Ele baixa as ~12 MB de pools, calcula chão, abismo e classe de cada uma,
calcula a qualidade das redes, e manda tudo pro banco. Demora alguns minutos e
não tem limite de processamento nenhum, porque roda no seu computador.

Pra ver o que ele faria sem enviar:

```bash
node medir-pools.js --seco
```

Ele escreve um `medida-de-hoje.sql` que você pode abrir e ler antes de mandar.

> **Ele NÃO reimplementa a medição.** Usa exatamente as mesmas funções que a
> nuvem usaria, com um banco de mentira que anota o SQL em vez de executar.
> Duas cópias de uma conta divergem no primeiro conserto feito num lugar só —
> e a divergência apareceria como um número estranho na sua tela, meses depois,
> sem pista de origem.

---

## Como atualizar

Saiu conserto ou coisa nova no repositório? Dois comandos, na pasta do projeto:

```bash
git pull
```

```bash
npx wrangler deploy
```

O banco e os segredos ficam intactos — atualizar troca só o código. Vale
conferir o `/versao` do seu endereço depois: o número deve ter subido.

> Consertos de erro grave são publicados aqui assim que encontrados na
> instância original. Quem atualiza de vez em quando os recebe sem precisar
> descobrir o erro sozinho.

---

## Quando alguma coisa não vai

**O bot não responde nada no Telegram.** O webhook não está ligado. Refaça o
passo 5 e confira que o `GATILHO` no endereço é exatamente o que você guardou no
passo 4 (sem espaço, sem acento).

**Ele responde aos comandos mas nunca fala sozinho.** Faltou o passo 6 — ele não
sabe pra qual chat falar. Mande `/oi`.

**Ele fala, mas diz "nada fora do normal" todo dia.** Provavelmente falta
memória: veja `/saude`. Se `diasDeHistorico` for menor que 8, rode o `semear.js`.

**Ele avisa demais.** Os limiares estão no alto do `src/sinais.js`, em
`LIMIARES`, cada um com um comentário do porquê daquele número. Suba
`entrada.altaPct` ou `pequena.altaPct` e publique de novo. Rode
`node testar-sinais.js` antes — se algum teste ficar vermelho, o número novo
quebrou uma regra que você provavelmente quer manter.

**Chegou um aviso dizendo "⚠️ O radar quebrou nesta rodada".** É de propósito:
radar que quebra calado é pior que radar nenhum, porque você acha que o mercado
está parado quando na verdade ninguém está olhando. A mensagem diz o que falhou.

---

## Custo

Tudo dentro do plano grátis, com folga:

- Cloudflare Workers: 100 mil execuções por dia; o radar usa 4 por dia mais o
  que você pedir no Telegram.
- Cloudflare D1: 5 GB; o radar usa alguns megabytes por ano.
- DefiLlama: aberto, sem chave, sem cobrança. Cada rodada faz **três** chamadas —
  e é por isso que o histórico é semeado do seu computador, e não buscado lá.
