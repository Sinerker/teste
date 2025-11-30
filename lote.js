/* ============================================================
   banco-lotes.js — Gestão completa de Lotes (PC + Celular)
============================================================ */

/* -------------------------------------------------------------
   Variáveis globais
------------------------------------------------------------- */
const NOME_BANCO = "banco_lotes";
let conexaoDB = null;

/* -------------------------------------------------------------
   Abrir IndexedDB
------------------------------------------------------------- */
function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (conexaoDB) return resolve(conexaoDB);

    const request = indexedDB.open(NOME_BANCO);
    request.onsuccess = (event) => {
      conexaoDB = event.target.result;
      console.log("✅ Banco aberto com sucesso!");
      resolve(conexaoDB);
    };
    request.onerror = (event) => {
      console.error("❌ Erro ao abrir banco:", event.target.error);
      reject(event.target.error);
    };
  });
}

/* -------------------------------------------------------------
   Monta caminho completo "NIVEL 0 > NIVEL 1..." para cada produto
------------------------------------------------------------- */
function montarCaminhoProduto(item) {
  const niveis = [];
  for (let i = 0; i <= 7; i++) {
    if (item[`NIVEL ${i}`]) niveis.push(item[`NIVEL ${i}`].trim());
  }
  return niveis.join(" > ");
}

/* -------------------------------------------------------------
   Salvar lote no IndexedDB
------------------------------------------------------------- */
async function salvarLote(nomeStore, lote) {
  const db = await abrirBanco();

  if (!db.objectStoreNames.contains(nomeStore)) {
    const novaVersao = db.version + 1;
    db.close();

    await new Promise((resolve, reject) => {
      const requestUpgrade = indexedDB.open(NOME_BANCO, novaVersao);
      requestUpgrade.onupgradeneeded = (event) => {
        const dbUpgrade = event.target.result;
        dbUpgrade.createObjectStore(nomeStore, { autoIncrement: true });
        console.log("✅ ObjectStore criada:", nomeStore);
      };
      requestUpgrade.onsuccess = (event) => {
        conexaoDB = event.target.result;
        resolve();
      };
      requestUpgrade.onerror = (event) => reject(event.target.error);
    });
  }

  const transacao = conexaoDB.transaction([nomeStore], "readwrite");
  const store = transacao.objectStore(nomeStore);
  store.add(lote);

  return new Promise((resolve, reject) => {
    transacao.oncomplete = () => {
      console.log("✅ Lote salvo com sucesso!");
      alert("✅ Lote criado e salvo com sucesso!");
      resolve();
    };
    transacao.onerror = () => {
      console.error("❌ Erro ao salvar lote:", transacao.error);
      reject(transacao.error);
    };
  });
}

/* -------------------------------------------------------------
   Criar Lote (botão "Criar Lote")
------------------------------------------------------------- */
async function criarLote() {
  try {
    console.log("📦 Iniciando criação do lote...");

    const usuario = document.getElementById("usuario").value.trim();
    const loja = document.getElementById("loja").value.trim();

    if (!usuario || !loja) {
      alert("Preencha usuário e loja antes de criar o lote.");
      return;
    }

    const agora = new Date();
    const dataFormatada =
      `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}_` +
      `${String(agora.getHours()).padStart(2, "0")}-${String(agora.getMinutes()).padStart(2, "0")}-${String(agora.getSeconds()).padStart(2, "0")}`;
    const nomeStore = `${usuario}_${loja}_${dataFormatada}`;

    console.log("🗂 Nome da Store:", nomeStore);

    // Capturar checkboxes marcados
    const todosChecks = document.querySelectorAll(".checkbox-arvore");
    const categoriasMarcadas = new Set();
    todosChecks.forEach(cb => {
      if (cb.checked) categoriasMarcadas.add(cb.dataset.path);
    });

    // Separar produtos marcados e não marcados
    const produtosMarcados = [];
    const produtosNaoMarcados = [];

    if (!Array.isArray(dadosCSV) || dadosCSV.length === 0) {
      alert("⚠️ CSV vazio ou não carregado. Impossível criar lote.");
      return;
    }

    dadosCSV.forEach(item => {
      const caminho = montarCaminhoProduto(item);
      if (categoriasMarcadas.has(caminho)) produtosMarcados.push(item);
      else produtosNaoMarcados.push(item);
    });

    const lote = {
      usuario,
      loja,
      dataCriacao: agora.toISOString(),
      marcados: produtosMarcados,
      naoMarcados: produtosNaoMarcados
    };

    await salvarLote(nomeStore, lote);
    sessionStorage.setItem("loteAtual", nomeStore);

    console.log("🔗 Redirecionando para contagens.html...");
    window.location.href = "contagens.html";

  } catch (erro) {
    console.error("❌ Erro ao criar lote:", erro);
    alert("Ocorreu um erro ao criar o lote. Verifique o console.");
  }
}

/* -------------------------------------------------------------
   Listar Lotes Existentes
------------------------------------------------------------- */
async function listarLotes() {
  const listaExistente = document.getElementById("lista-lotes");
  if (listaExistente) listaExistente.remove();

  const container = document.createElement("div");
  container.id = "lista-lotes";
  container.style.marginTop = "20px";

  const db = await abrirBanco();
  const listaUl = document.createElement("ul");
  listaUl.style.listStyle = "none";
  listaUl.style.padding = "0";

  const lotes = Array.from(db.objectStoreNames).filter(n => n.includes("_"));

  if (lotes.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhum lote encontrado.";
    listaUl.appendChild(li);
  } else {
    lotes.sort().reverse().forEach(nomeStore => {
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.justifyContent = "space-between";
      li.style.alignItems = "center";

      const partes = nomeStore.split("_");
      const nomeFormatado = document.createElement("div");
      nomeFormatado.classList.add("lote-nome");
      partes.forEach(parte => {
        const span = document.createElement("span");
        span.textContent = parte;
        nomeFormatado.appendChild(span);
      });

      nomeFormatado.style.cursor = "pointer";
      nomeFormatado.addEventListener("click", () => {
        sessionStorage.setItem("loteAtual", nomeStore);
        window.location.href = "contagens.html";
      });

      li.appendChild(nomeFormatado);

      const btnExcluir = document.createElement("button");
      btnExcluir.textContent = "Excluir Lote";
      btnExcluir.classList.add("btn-excluir-lote");
      btnExcluir.addEventListener("click", (event) => {
        event.stopPropagation();
        confirmarExclusao(nomeStore);
      });
      li.appendChild(btnExcluir);

      listaUl.appendChild(li);
    });
  }

  container.appendChild(listaUl);
  const botaoCriar = document.getElementById("criar-lote");
  if (botaoCriar) botaoCriar.insertAdjacentElement("afterend", container);
}

/* -------------------------------------------------------------
   Modal de confirmação de exclusão
------------------------------------------------------------- */
function criarModal(mensagem, callbackSim) {
  const modalBg = document.createElement("div");
  modalBg.classList.add("modal-bg");

  const modalBox = document.createElement("div");
  modalBox.classList.add("modal-box");

  const msg = document.createElement("p");
  msg.textContent = mensagem;
  modalBox.appendChild(msg);

  const btnSim = document.createElement("button");
  btnSim.textContent = "Sim";
  btnSim.classList.add("sim");
  btnSim.addEventListener("click", () => {
    document.body.removeChild(modalBg);
    callbackSim();
  });

  const btnNao = document.createElement("button");
  btnNao.textContent = "Não";
  btnNao.classList.add("nao");
  btnNao.addEventListener("click", () => document.body.removeChild(modalBg));

  modalBox.appendChild(btnSim);
  modalBox.appendChild(btnNao);
  modalBg.appendChild(modalBox);
  document.body.appendChild(modalBg);
}

function confirmarExclusao(nomeStore) {
  criarModal(`Deseja realmente excluir o lote "${nomeStore}"?`, () => {
    criarModal("Tem certeza absoluta? Esta ação não pode ser desfeita.", () => {
      excluirStore(nomeStore);
    });
  });
}

/* -------------------------------------------------------------
   Excluir store do IndexedDB
------------------------------------------------------------- */
async function excluirStore(nomeStore) {
  try {
    const db = await abrirBanco();
    db.close();

    const novaVersao = db.version + 1;
    const request = indexedDB.open(NOME_BANCO, novaVersao);

    request.onupgradeneeded = (event) => {
      const dbUpgrade = event.target.result;
      if (dbUpgrade.objectStoreNames.contains(nomeStore)) {
        dbUpgrade.deleteObjectStore(nomeStore);
        console.log(`✅ ObjectStore "${nomeStore}" excluída.`);
      }
    };

    request.onsuccess = (event) => {
      conexaoDB = event.target.result;
      alert(`Lote "${nomeStore}" excluído com sucesso!`);
      listarLotes();
    };

    request.onerror = (event) => console.error("❌ Erro ao excluir store:", event.target.error);

  } catch (erro) {
    console.error("❌ Erro na exclusão do lote:", erro);
  }
}

/* -------------------------------------------------------------
   Inicialização
------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const botaoCriar = document.getElementById("criar-lote");
  if (botaoCriar) botaoCriar.addEventListener("click", criarLote);

  listarLotes();
});
