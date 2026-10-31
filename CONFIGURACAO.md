# Arquivo de ações (configuração) do Estúdio de Gestos

O arquivo de ações diz ao Estúdio **o que gravar** num projeto. É um `.json` com a versão do formato, o projeto,
o personagem (e a aparência do boneco), a **biblioteca de gestos** e os **blocos de ações**.

Exemplo: `public/configs/exemplo_basico.json`. O Estúdio ainda lê a versão 1 (veja o fim deste arquivo).

## Regras gerais

- `versao_formato`: `2`.
- **IDs** (`projeto`, gestos, blocos, ações, passos, alternativas): letras minúsculas, números e `_`, sem acentos, até 40 caracteres.
- **Textos**: `{ "pt": "...", "en": "..." }` ou um texto só (vale para as duas línguas).
- **Cores**: `#rrggbb`.
- O Estúdio confere tudo e recusa o arquivo com uma mensagem dizendo o que está errado. Nada do arquivo é executado.
- Tudo o que se ajusta no Estúdio (ajustes dos gestos, preparações criadas e postas nas ações) é guardado e vai
  no zip exportado (`configuracao.json`). Importar de novo o arquivo de ações do mesmo projeto **não apaga** esses ajustes.

## Estrutura

```json
{
  "versao_formato": 2,
  "projeto": "meu_jogo",
  "nome": { "pt": "Meu jogo", "en": "My game" },
  "personagem": { "id": "heroi", "nome": "Herói", "aparencia": { ... } },
  "gravacao": { "repeticoes": 5, "contagem": 3, "duracao_padrao": 2.5 },
  "gestos": [ ... ],
  "blocos": [ { "id": "ataques", "nome": "Ataques", "acoes": [ ... ] } ]
}
```

| Campo | O que é | Padrão |
|---|---|---|
| `gravacao.repeticoes` | quantas gravações por gesto (1 a 10) | 5 |
| `gravacao.contagem` | segundos de contagem antes de gravar (0 a 5) | 3 |
| `gravacao.duracao_padrao` | tempo de gravação de um gesto sem `duracao` (0,5 a 8 s) | 2,5 |

## Gestos (a biblioteca)

Cada gesto é gravado uma vez e pode ser usado por várias ações (ex.: a mesma preparação ou o mesmo engatilhar).

```json
{
  "id": "prep_cotovelo",
  "nome": { "pt": "Cotovelo levantado", "en": "Raised elbow" },
  "tipo": "preparacao",
  "sugestao": "Punho fechado perto do ombro, cotovelo levantado. Segure um instante.",
  "sugestao_pc": "Segure E.",
  "ajustes": { "conta": "mao_dir", "espelhado": true, "duracao": 2, "segurar": 0.4, "tolerancia": 1 }
}
```

| Campo | Valores | Padrão |
|---|---|---|
| `tipo` | `parte` (passo de uma ação) ou `preparacao` (aparece na biblioteca de preparações) | `parte` |
| `ajustes.conta` | o que conta no reconhecimento: `mao_dir`, `mao_esq`, `duas_maos`, `mao_cabeca`, `cabeca`, `corpo`. O resto é ignorado | `corpo` |
| `ajustes.espelhado` | vale feito com a outra mão (espelhado) | `false` |
| `ajustes.duracao` | segundos de gravação (0,5 a 8) | `duracao_padrao` |
| `ajustes.segurar` | segundos que a pose final precisa ser segurada (0 a 2; 0 = basta passar por ela) | 0 |
| `ajustes.tolerancia` | multiplica o limite do reconhecimento (0,5 a 2; maior = mais fácil) | 1 |

## Ações

```json
{
  "id": "soco_furadeira",
  "nome": "Soco furadeira",
  "tipo": "ataque",
  "passos": [
    { "id": "engatilhar", "nome": "Engatilhar", "gesto": "giro_do_pulso" },
    { "id": "preparar", "nome": "Preparar", "gesto": "prep_cotovelo" },
    { "id": "liberar", "nome": "Liberar", "alternativas": [
      { "id": "jab", "nome": "Jab", "gesto": "jab", "efeito": { "forma": "broca", "direcao": "pulso", "origem": "mao" } },
      { "id": "gancho", "nome": "Gancho", "gesto": "gancho", "efeito": { "forma": "tornado", "direcao": "cima", "origem": "corpo" } }
    ] }
  ],
  "carga": { "passo": "engatilhar", "minimo": 3, "maximo": 10 },
  "tempo_maximo": 10,
  "condicoes": "Cada ciclo gasta mais aura.",
  "opcional": false,
  "plataformas": ["vr", "pc"],
  "efeito": { "forma": "broca", "cor": "#bfe9ff", "origem": "mao", "direcao": "pulso", "duracao": 1.2 }
}
```

| Campo | Valores | Padrão |
|---|---|---|
| `tipo` | `ataque`, `modo`, `combo`, `gesto` | `ataque` com mais de um passo, senão `gesto` |
| `passos` | 1 a 6 passos feitos um depois do outro. Cada passo usa um `gesto` ou tem `alternativas` (qualquer uma vale) | — |
| `alternativas[].efeito` | o efeito dessa alternativa (no último passo); sem ele, vale o `efeito` da ação | o da ação |
| `carga` | o gesto do `passo` é repetido no teste; cada repetição soma um ciclo até o `maximo`; o passo seguinte só vale com o `minimo`. `niveis` dá nomes: `[{ "ciclos": 3, "nome": "1 agulha" }, { "ciclos": 6, "nome": "500 agulhas" }]` (4 ou 5 ciclos ficam no nível 3) | sem carga |
| `tempo_maximo` | segundos que a ação fica engatilhada esperando o próximo passo, contados do último passo ou ciclo | 5 |
| `condicoes` | texto mostrado junto (regras do jogo, combos…) | nenhum |
| `opcional` | marca como opcional na lista | `false` |
| `plataformas` | `vr`, `pc` ou as duas | as duas |
| `efeito.forma` | `broca`, `tornado`, `raio`, `onda`, `aura`, `projetil`, `explosao`, `brilho`, `lamina` | `brilho` |
| `efeito.origem` | `mao` (a mão que fez o gesto), `mao_dir`, `mao_esq`, `maos`, `boca`, `corpo`, `chao` | `maos` |
| `efeito.direcao` | `pulso` (para onde o punho aponta), `apontar` (a mão esticada), `cabeca` (para onde a cabeça olha, um pouco abaixo dos olhos), `movimento` (a direção do golpe no disparo), `frente`, `cima`, `baixo` | `frente` |
| `efeito.duracao` | segundos do efeito (0,3 a 6; ex.: um raio contínuo de 2 s) | 1 |

No teste, todo poder mostra uma seta com a direção. O efeito é só um marcador: a arte de verdade fica no jogo.

## Aparência do boneco

Sem `aparencia`, o boneco é cinza, com 1,70 m.

```json
"aparencia": {
  "altura": 2.7,
  "proporcoes": { "cabeca": 1.35, "ombros": 1.35, "bracos": 1.15, "pernas": 1.1, "tronco": 1.15 },
  "cores": { "corpo": "#7a4030", "frente": "#d9a066", "detalhe": "#00e5ff", "maos": "#6a3428" },
  "acessorios": ["orelhas_redondas", "focinho", "oculos", "barriga"],
  "maos": "patas"
}
```

| Campo | Valores |
|---|---|
| `altura` | metros (0,3 a 6) |
| `proporcoes.*` | 0,5 a 2 (1 = humano comum) |
| `cores.*` | corpo; frente (barriga, com o acessório `barriga`, e focinho); detalhe (óculos, chifres, antenas, mochila); mãos e pés |
| `acessorios` | `orelhas_redondas`, `orelhas_pontudas`, `focinho`, `oculos`, `cauda`, `mochila`, `antenas`, `chifres`, `barriga` |
| `maos` | `maos` ou `patas` (com garras) |

## O que vem no zip exportado

```
estudio_gestos.json          versão do pacote (2), projeto, data, ações e gestos que vieram
configuracao.json            a configuração de trabalho (com as preparações e os ajustes feitos no Estúdio)
acoes/<acao>/acao.json       observações da ação
gestos/<gesto>/vr/<n>.json   gravações do Meta Quest
gestos/<gesto>/pc/<n>.json   gravações do PC
```

### Gravação do VR

```json
{ "versao_formato": 2, "modo": "vr", "gesto": "prep_cotovelo", "n": 1, "data": "...", "duracao": 2,
  "altura_olhos": 1.58, "inicio": 0.31, "fim": 1.62, "quadros": [[...], ...] }
```

- Cada quadro tem 27 números: `[t, cabeça x y z, cabeça qx qy qz qw, mão esq x y z qx qy qz qw gatilho grip, mão dir x y z qx qy qz qw gatilho grip, botões]`.
- Posições em metros do WebXR (`local-floor`: chão em y = 0) de quem gravou; as mãos no espaço do controle
  (−z para a frente, +y para o polegar). `altura_olhos` ajusta a pessoas de outros tamanhos.
- `botoes`: bit 0 = A, bit 2 = X, bit 4 e 5 = cliques dos analógicos. B e Y nunca são gravados (são do menu).
- `inicio` e `fim`: o trecho com movimento, achado sozinho.

### Gravação do PC

```json
{ "versao_formato": 2, "modo": "pc", "gesto": "jab", "n": 1, "data": "...", "duracao": 1.2,
  "eventos": [ { "t": 0.12, "tipo": "baixo", "codigo": "Mouse0" }, { "t": 0.4, "tipo": "mover", "codigo": "Mouse", "dx": -80, "dy": 0 } ] }
```

- `tipo`: `baixo`, `cima` (tecla ou botão do mouse), `roda` (`dy` −1 para cima, 1 para baixo), `mover` (`dx`, `dy` em pixels somados em ~50 ms).
- `codigo`: código da tecla do navegador (`KeyQ`, `Space`…) ou `Mouse0` (esquerdo), `Mouse1` (meio), `Mouse2` (direito).

## Como o modo testar reconhece

- **VR:** cada gravação vira 20 "fotos" das mãos (posição e para onde apontam), da cabeça e do olhar, em relação a
  onde a cabeça estava no começo, virado para a frente e no tamanho de quem gravou, mais gatilho, grip, A e X.
  Só conta o que o gesto pede. O gesto de agora é comparado por DTW (alinhamento no tempo) e precisa: ficar dentro
  do limite (o quanto as gravações diferem entre si × tolerância), ter pelo menos 70% do **tamanho** das gravações
  (um soco curto não vale pelo completo), **terminar na pose certa** e, se pedir, **segurar a pose**.
- **PC:** sequências de fichas (teclas e botões apertados, roda e direção de movimentos grandes do mouse).
- Os passos seguem a ordem e o tempo máximo; a carga conta os ciclos.

O código está em `src/nucleo/reconhecedor.ts` e não depende da página nem do desenho: um jogo pode usar o mesmo.

## Versão 1

Arquivos e zips da versão 1 (ações com `partes`) continuam aceitos: cada parte vira o gesto `<acao>_<parte>` e um
passo; `maos: "uma"` vira `mao_dir` com `espelhado`, `duas` vira `duas_maos` e `qualquer` vira `corpo` com `espelhado`.
