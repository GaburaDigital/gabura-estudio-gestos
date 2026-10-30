# PROJETO

- linha: livre (ferramenta genérica da Gabura Digital, usada pelas linhas Gaburaverso e Brincolar e por clientes)
- nome: Estúdio de Gestos
- repositorio: gabura-estudio-gestos
- publico: autores e equipes dos jogos (gravação de gestos); não é um jogo
- plataforma: ambos (Meta Quest pelo navegador, em VR; PC pelo navegador)
- duracao: sessões de gravação de 15 a 40 minutos
- licenca_codigo: MIT
- licenca_arte_marca: nenhum personagem ou arte de projeto entra neste repositório
- engine: Three.js + WebXR, TypeScript, Vite
- perfil: nenhum perfil de linha; os dados de cada projeto (arquivo de ações, gravações, aparência do personagem)
  ficam no repositório do próprio projeto e são importados no navegador

## Resumo
Grava gestos do Meta Quest (cabeça, mãos, gatilho, grip e botões) e sequências de teclado e mouse no PC, a partir
de um arquivo de ações que o projeto fornece. Um boneco humanoide genérico repete cada gravação e pode ficar com a
aparência aproximada do personagem. O modo testar reconhece os gestos (inclusive engatilhar e liberar) e mostra o
poder no boneco. Exporta um gesto, um bloco ou tudo em .zip para o projeto do jogo.

Proteção: arquivos de projetos da Brincolar Games e de clientes nunca são colocados neste repositório público;
eles são só importados no navegador de quem grava.
