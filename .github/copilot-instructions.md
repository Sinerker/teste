<!-- Instruções para agentes de IA — projeto "APP DE INVENTÁRIO" -->
# Guia rápido para agentes (Copilot / AI)

Este documento descreve padrões, convenções e pontos-chave do projeto para permitir que agentes de IA sejam imediatamente produtivos.

- **Visão geral**: aplicativo frontend estático (HTML/CSS/JS) que carrega um CSV (`embalagens com categorias.csv`) e cria "lotes" salvos no IndexedDB do navegador. Fluxo comum: `index.html` → criar lote (usa `script.js` + `lote.js`) → `contagens.html` (usa `contagens.js`).

- **Arquivos principais**:
  - `index.html` — UI de criação de lote; referencia `script.js` e `lote.js`.
  - `script.js` — lê CSV, cria a estrutura hierárquica e a árvore de categorias (`#container-arvore`).
  - `lote.js` — lógica de criação/lista/exclusão de lotes; usa IndexedDB (`NOME_BANCO = "banco_lotes"`).
  - `contagens.html` / `contagens.js` — tela de contagem que lê o lote atual de `sessionStorage['loteAtual']`.
  - `embalagens com categorias.csv` — CSV com delimitador `;` e cabeçalhos `NIVEL 0` .. `NIVEL 7`.

- **Padrões e convenções do projeto**:
  - IndexedDB: cada lote é salvo em uma object store cujo nome segue o padrão `LOTE_<nome>_<timestamp>`; cada store contém um único objeto (o lote) — código usa `store.add(lote)` e depois `store.getAll()[0]` para recuperar.
  - Chave global para DB: `NOME_BANCO = "banco_lotes"` — não altere sem ajustar todas as referências.
  - Seleção atual: `sessionStorage.setItem('loteAtual', nomeStore)` e `carregarLoteAtual()` lê essa chave para abrir `contagens.html`.
  - CSV: carregado com `fetch('embalagens com categorias.csv')` — requer servidor HTTP (não funciona via `file://`).
  - Montagem de caminho de categoria: `montarCaminhoProduto(item)` cria strings do tipo `NIVEL 0 > NIVEL 1 > ...` e é usada para comparar com os `data-path` das checkboxes.

- **IDs/classes DOM importantes (referência rápida)**:
  - `#container-arvore`, `.checkbox-arvore` — árvore de seleção de categorias.
  - `#criar-lote` — botão que aciona `criarLote()` em `lote.js`.
  - `#codigo-produto`, `#quantidade`, `#info-produto`, `#botao-tela-cheia` — usados por `contagens.js`.
  - Status visuais: `.produto-encontrado`, `.produto-fora-lote`, `.produto-nao-encontrado` (em `contagens.css`).

- **Fluxos de desenvolvimento / como testar localmente**:
  1. Inicie um servidor estático na raiz do projeto (ex.: em PowerShell):
     - `python -m http.server 8000;` ou use a extensão Live Server do VS Code.
  2. Abra `http://localhost:8000/index.html` e carregue o CSV; crie um lote selecionando categorias.
  3. O `sessionStorage['loteAtual']` aponta para a object store criada; abra `contagens.html` via navegação automática.
  4. Use DevTools → Application → IndexedDB para inspecionar `banco_lotes` e stores `LOTE_*`.

- **Modificações de schema/DB**:
  - Quando precisar modificar estrutura de IndexedDB (ex.: renomear stores, mudar formato): siga o padrão já usado — abrir DB com versão nova (`db.version + 1`) e criar/excluir stores dentro de `onupgradeneeded`.
  - Após alterar criação/exclusão de stores, atualize todos os pontos que consultam `db.objectStoreNames`.

- **Coisas descobertas que um agente deve saber (armadilhas comuns)**:
  - O CSV usa `;` como separador e espera colunas `NIVEL 0..7`; o agente deve preservar esse parsing ao transformar ou atualizar o código.
  - `fetch()` exige servidor HTTP — testes headless precisam servir arquivos estáticos.
  - Cada store contém apenas um objeto-lote; ler `getAll()[0]` é padrão aqui.
  - A aplicação é totalmente cliente-side; não há build step nem dependências npm declaradas.

- **Exemplos para uso direto**:
  - Encontrar o lote atual em código: `const nomeStore = sessionStorage.getItem('loteAtual');` e depois abrir transação `db.transaction([nomeStore], 'readonly')`.
  - Criar nome de store: `const nomeStore = `LOTE_${nome.replace(/\s+/g,'_')}_${timestamp}`` (veja `lote.js`).

Se alguma parte do comportamento não estiver clara (ex.: intenção ao armazenar apenas um objeto por store), pergunte antes de modificar a modelagem do IndexedDB — posso fornecer testes manuais e exemplos de entrada CSV. Deseja que eu ajuste algo ou inclua exemplos de testes automáticos?
