# -*- coding: utf-8 -*-
"""Leva a conta do patrimonio pro painel — a copia literal entre os marcadores.

    python portar-patrimonio.py

O navegador nao importa modulo (receita 5.2), entao a conta do rendimento vive
duas vezes: em src/patrimonio.js (o modulo, que os testes provam) e dentro de
src/painel.js (a copia que roda no navegador). O teste de concordancia em
testar-patrimonio.js compara as duas caractere a caractere — e e ELE quem manda
rodar este arquivo: mudou o modulo, a copia envelheceu, o teste fica vermelho
ate este porte rodar.

Duas traducoes, as duas de forma e nao de conteudo:
  - `export ` some (dentro do painel nao ha modulo);
  - crase vira apostrofo (painel.js e um template literal gigante, e uma crase
    dentro dele mata a pagina inteira — ja aconteceu cinco vezes).
"""
import io, os

# A raiz e a pasta DESTE arquivo, e nao um caminho escrito. A primeira versao
# levava o caminho da maquina (com o nome de usuario dentro) pro repositorio
# publico — a varredura pegou antes do push. Relativo funciona nos dois
# repositorios e em qualquer maquina de quem clonar.
RAIZ = os.path.dirname(os.path.abspath(__file__))

mod = io.open(RAIZ + "/src/patrimonio.js", encoding="utf-8").read()
ini = mod.index("export const JANELAS")
copia = mod[ini:].replace("export ", "")
assert "\\" not in copia, "barra invertida na copia quebraria o template literal"
copia = copia.replace("`", "'")
assert "${" not in copia, "interpolacao na copia seria executada pelo servidor"

P = RAIZ + "/src/painel.js"
s = io.open(P, encoding="utf-8").read()

# O MARCADOR TEM QUE SER UNICO, e quase nao foi: quando a copia do livro
# nasceu, os dois blocos passaram a conter "NAO EDITE AQUI" e este porte
# substituiu o bloco ERRADO — apagou o livro inteiro e deixou o cabecalho dele
# em cima do conteudo do patrimonio. A suite pegou; a tela nao teria pegado.
marcador = "COPIA LITERAL DE src/patrimonio.js"

i = s.index("*/", s.index(marcador)) + 2
f = s.rindex("/*", 0, s.index("FIM DA COPIA DE src/patrimonio.js"))
s = s[:i] + "\n" + copia + "\n" + s[f:]

io.open(P, "w", encoding="utf-8").write(s)
print("copia atualizada:", len(copia), "caracteres")
