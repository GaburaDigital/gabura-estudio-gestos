// Textos da interface em português e inglês. A língua vem do navegador (ou de ?lingua=en / ?lingua=pt).

import type { Lingua, Texto } from './nucleo/config';

const pt = {
  titulo: 'Estúdio de Gestos',
  subtitulo: 'Grave, reveja e teste gestos do Meta Quest e sequências de teclado e mouse',
  modoVR: 'Gravar para VR (Meta Quest)', modoPC: 'Gravar para PC (teclado e mouse)',
  importar: 'Importar ações (.json)', importarZip: 'Importar gestos (.zip)', exemplo: 'Abrir o exemplo',
  semProjeto: 'Importe um arquivo de ações para começar. Ele diz o que gravar. Para conhecer, abra o exemplo.',
  projeto: 'Projeto', personagem: 'Personagem',
  exportarAcao: 'Exportar este gesto (.zip)', exportarBloco: 'Exportar o bloco (.zip)', exportarTudo: 'Exportar tudo (.zip)',
  parte: 'Parte', sugestao: 'Sugestão', condicoes: 'Condições', observacoes: 'Observações (como ativar, condições especiais…)',
  tolerancia: 'Tolerância do reconhecimento', tentativas: 'Gravações', rever: 'Rever', apagar: 'Apagar',
  gravar: 'Gravar', gravando: 'Gravando…', testar: 'Testar', pararTeste: 'Parar o teste', entrarVR: 'Entrar no VR',
  semVR: 'Abra esta página no navegador do Quest para gravar no VR.',
  espelho: 'Espelho', aparencia: 'Aparência do personagem', cinza: 'Boneco cinza',
  opcional: 'opcional', duracao: 'duração',
  tipos: { ataque: 'ataque (engatilha e libera)', modo: 'modo (liga e dura)', combo: 'combo', gesto: 'gesto' },
  maos: { uma: 'uma mão', duas: 'duas mãos', qualquer: 'qualquer mão' },
  avisos: {
    cheio: 'Esta parte já tem todas as gravações. Apague uma para regravar.',
    semDados: 'Não chegou nada do óculos na gravação. Tente de novo.',
    semTeclas: 'Nenhuma tecla ou botão do mouse foi apertado. Tente de novo.',
    gravou: 'Gravado!', apagou: 'Apagado.',
  } as Record<string, string>,
  salvoNoNavegador: 'O trabalho fica guardado neste navegador. Exporte para levar ao projeto ou a outro aparelho.',
  soMemoria: 'Atenção: este navegador não deixou guardar. Exporte antes de fechar a página.',
  reconheceu: 'Reconheceu', engatilhado: 'engatilhado', faltaGravar: 'Sem gravações para testar neste modo.',
  pcAjuda: 'Clique em Gravar. Depois da contagem, faça a sequência no teclado e no mouse (os cliques valem dentro da área do boneco).',
  vrAjuda: [
    'Analógico direito ↑↓: ação · ←→: parte',
    'A: gravar · B: apagar a última · X: rever',
    'Y: testar / voltar a gravar',
  ],
  contagem: 'Prepare-se', vrTestando: 'TESTANDO: faça os gestos',
  erroArquivo: 'Arquivo com problema',
};
type Textos = typeof pt;

const en: Textos = {
  titulo: 'Gesture Studio',
  subtitulo: 'Record, review and test Meta Quest gestures and keyboard and mouse sequences',
  modoVR: 'Record for VR (Meta Quest)', modoPC: 'Record for PC (keyboard and mouse)',
  importar: 'Import actions (.json)', importarZip: 'Import gestures (.zip)', exemplo: 'Open the example',
  semProjeto: 'Import an actions file to start. It says what to record. To try it out, open the example.',
  projeto: 'Project', personagem: 'Character',
  exportarAcao: 'Export this gesture (.zip)', exportarBloco: 'Export the block (.zip)', exportarTudo: 'Export everything (.zip)',
  parte: 'Part', sugestao: 'Suggestion', condicoes: 'Conditions', observacoes: 'Notes (how to activate, special conditions…)',
  tolerancia: 'Recognition tolerance', tentativas: 'Recordings', rever: 'Replay', apagar: 'Delete',
  gravar: 'Record', gravando: 'Recording…', testar: 'Test', pararTeste: 'Stop testing', entrarVR: 'Enter VR',
  semVR: 'Open this page in the Quest browser to record in VR.',
  espelho: 'Mirror', aparencia: 'Character look', cinza: 'Gray mannequin',
  opcional: 'optional', duracao: 'duration',
  tipos: { ataque: 'attack (charge and release)', modo: 'mode (turns on and lasts)', combo: 'combo', gesto: 'gesture' },
  maos: { uma: 'one hand', duas: 'two hands', qualquer: 'any hand' },
  avisos: {
    cheio: 'This part already has all recordings. Delete one to record again.',
    semDados: 'Nothing came from the headset during the recording. Try again.',
    semTeclas: 'No key or mouse button was pressed. Try again.',
    gravou: 'Recorded!', apagou: 'Deleted.',
  },
  salvoNoNavegador: 'Your work is kept in this browser. Export it to take it to the project or another device.',
  soMemoria: 'Warning: this browser did not allow saving. Export before closing the page.',
  reconheceu: 'Recognized', engatilhado: 'charged', faltaGravar: 'No recordings to test in this mode.',
  pcAjuda: 'Click Record. After the countdown, do the sequence on the keyboard and mouse (clicks count inside the mannequin area).',
  vrAjuda: [
    'Right stick ↑↓: action · ←→: part',
    'A: record · B: delete the last one · X: replay',
    'Y: test / back to recording',
  ],
  contagem: 'Get ready', vrTestando: 'TESTING: do the gestures',
  erroArquivo: 'Problem with the file',
};

function linguaInicial(): Lingua {
  const q = new URLSearchParams(location.search).get('lingua');
  if (q === 'en' || q === 'pt') return q;
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}
export const LINGUA: Lingua = linguaInicial();
export const T: Textos = LINGUA === 'en' ? en : pt;
/** Texto do arquivo de configuração na língua da tela. */
export const tx = (t: Texto | null | undefined): string => (t ? t[LINGUA] || t.pt : '');
