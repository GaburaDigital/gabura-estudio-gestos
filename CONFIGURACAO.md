# Arquivo de ações (configuração) do Estúdio de Gestos

O arquivo de ações diz ao Estúdio **o que gravar** num projeto. É um `.json` com a versão do formato, o
projeto, o personagem (e a aparência do boneco), quantas gravações fazer e os blocos de ações.

Exemplo completo: `public/configs/exemplo_basico.json`.

## Regras gerais

- `versao_formato` é sempre `1`.
- **IDs** (`projeto`, `id` de blocos, ações e partes): letras minúsculas, números e `_`, sem acentos, até 40 caracteres.
  Exemplo: `soco_furadeira`. O ID de cada ação não pode se repetir no arquivo.
- **Textos** podem ser um objeto `{ "pt": "...", "en": "..." }` ou um texto só (vale para as duas línguas).
- **Cores**: `#rrggbb`.
- O Estúdio confere tudo e recusa o arquivo com uma mensagem dizendo o que está errado. Nada do arquivo é executado.

## Estrutura

```json
{
  "versao_formato": 1,
  "projeto": "meu_jogo",
  "nome": { "pt": "Meu jogo", "en": "My game" },
  "personagem": { "id": "heroi", "nome": "Herói", "aparencia": { ... } },
  "gravacao": { "repeticoes": 5, "contagem": 3, "duracao_padrao": 2.5 },
  "blocos": [ { "id": "ataques", "nome": "Ataques", "acoes": [ ... ] } ]
}
```

| Campo | O que é | Padrão |
|---|---|---|
| `gravacao.repeticoes` | quantas gravações por parte (1 a 10) | 5 |
| `gravacao.contagem` | segundos de contagem antes de gravar (0 a 5) | 3 |
| `gravacao.duracao_padrao` | segundos de gravação de cada parte (0,5 a 8) | 2,5 |

### Ação

```json
{
  "id": "bola_de_energia",
  "nome": { "pt": "Bola de energia", "en": "Energy ball" },
  "tipo": "ataque",
  "maos": "duas",
  "partes": [
    { "id": "engatilhar", "nome": "Engatilhar", "sugestao": "Junte as mãos na cintura e aperte os gatilhos.",
      "sugestao_pc": "Segure Q por um instante.", "duracao": 2.5 },
    { "id": "liberar", "nome": "Liberar", "sugestao": "Empurre as mãos para a frente.", "duracao": 1.5 }
  ],
  "condicoes": "Só depois de engatilhar.",
  "opcional": false,
  "plataformas": ["vr", "pc"],
  "tempo_maximo": 5,
  "efeito": { "forma": "projetil", "cor": "#c58fff", "origem": "maos" }
}
```

| Campo | Valores | Padrão |
|---|---|---|
| `tipo` | `ataque` (engatilha e libera), `modo` (liga e dura), `combo`, `gesto` | `ataque` com mais de uma parte, senão `gesto` |
| `maos` | `uma`, `duas`, `qualquer`. Com `uma` ou `qualquer`, o reconhecedor aceita o gesto feito com a outra mão (espelhado) | `qualquer` |
| `partes` | 1 a 4 partes, feitas uma depois da outra. Sem `partes`, a ação tem uma parte só (`gesto`) | uma parte |
| `sugestao` / `sugestao_pc` | como fazer no VR / no PC (é só uma dica; quem grava decide o gesto) | vazio |
| `duracao` (na parte) | segundos de gravação | `gravacao.duracao_padrao` |
| `condicoes` | texto mostrado junto (ex.: "precisa do sabre ligado", "só no ar") | nenhum |
| `opcional` | marca a ação como opcional na lista | `false` |
| `plataformas` | onde a ação aparece: `vr`, `pc` ou as duas | as duas |
| `tempo_maximo` | segundos entre uma parte e a seguinte (depois disso, a ação "desengatilha") | 5 |
| `efeito.forma` | `tornado`, `raio`, `onda`, `aura`, `projetil`, `explosao`, `brilho`, `lamina` | `brilho` |
| `efeito.origem` | `mao_dir`, `mao_esq`, `maos`, `boca`, `corpo`, `chao` | `maos` |

O efeito é só um marcador do modo testar (simples e leve). A arte de verdade de cada poder fica no jogo.

### Aparência do boneco

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
| `altura` | metros (0,3 a 6). As gravações são desenhadas nesse tamanho |
| `proporcoes.*` | 0,5 a 2 (1 = humano comum) |
| `cores.corpo` / `frente` / `detalhe` / `maos` | corpo; peito e barriga (com o acessório `barriga`) e focinho; óculos, chifres, antenas e mochila; mãos e pés |
| `acessorios` | `orelhas_redondas`, `orelhas_pontudas`, `focinho`, `oculos`, `cauda`, `mochila`, `antenas`, `chifres`, `barriga` |
| `maos` | `maos` ou `patas` (com garras) |

## O que vem no zip exportado

```
estudio_gestos.json          versão do pacote, projeto, data e quais ações vieram
configuracao.json            o arquivo de ações usado
LEIA.txt
acoes/<acao>/acao.json       observações, tolerância e quantas gravações cada parte tem (vr e pc)
acoes/<acao>/vr/<parte>_<n>.json
acoes/<acao>/pc/<parte>_<n>.json
```

### Gravação do VR (`vr/<parte>_<n>.json`)

```json
{ "versao_formato": 1, "modo": "vr", "acao": "acenar", "parte": "gesto", "n": 1, "data": "...",
  "duracao": 2.5, "altura_olhos": 1.58, "inicio": 0.31, "fim": 2.12, "quadros": [[...], ...] }
```

- Cada quadro tem 27 números: `[t, cabeça x y z, cabeça qx qy qz qw, mão esq x y z qx qy qz qw gatilho grip, mão dir x y z qx qy qz qw gatilho grip, botões]`.
- Posições em metros do WebXR (`local-floor`: chão em y = 0) de quem gravou; `altura_olhos` permite ajustar a
  pessoas de outros tamanhos. `t` em segundos desde o começo da gravação.
- `botoes`: um bit para cada botão, na ordem A, B, X, Y, clique do analógico esquerdo, clique do analógico direito.
- `inicio` e `fim`: o trecho com movimento (achado sozinho); a contagem e o fim parado ficam de fora.

### Gravação do PC (`pc/<parte>_<n>.json`)

```json
{ "versao_formato": 1, "modo": "pc", "acao": "acenar", "parte": "gesto", "n": 1, "data": "...", "duracao": 2.5,
  "eventos": [ { "t": 0.12, "tipo": "baixo", "codigo": "KeyQ" }, { "t": 0.4, "tipo": "mover", "codigo": "Mouse", "dx": -80, "dy": 0 } ] }
```

- `tipo`: `baixo` e `cima` (tecla ou botão do mouse), `roda` (`dy` −1 para cima, 1 para baixo) e `mover` (`dx`, `dy`
  em pixels somados em ~50 ms).
- `codigo`: o código da tecla do navegador (`KeyQ`, `Space`, `ShiftLeft`…) ou `Mouse0` (esquerdo), `Mouse1` (meio), `Mouse2` (direito).

## Como o modo testar reconhece

- **VR:** cada gravação vira uma sequência de 20 "fotos" das mãos e da cabeça em relação a onde a cabeça estava
  no começo, virada para a frente de quem gravou e no tamanho dessa pessoa, mais gatilho, grip e botões. O gesto
  de agora é comparado com as gravações por **DTW** (alinhamento no tempo: o mesmo gesto mais rápido ou mais
  devagar ainda combina). O limite de cada parte sai do quanto as gravações diferem entre si, vezes a tolerância.
- **PC:** cada gravação vira uma sequência de fichas (teclas e botões apertados, roda e direção de movimentos
  grandes do mouse). Combina quando as últimas fichas são iguais, num tempo parecido.
- Partes seguintes (liberar) só contam depois da anterior (engatilhar), dentro do `tempo_maximo`.

Um jogo pode usar o mesmo jeito de reconhecer: o código está em `src/nucleo/reconhecedor.ts` e não depende da
página nem do desenho.
