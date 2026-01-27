/* ============================================================
   lote.js — Gestão completa de Lotes (PC + Celular)
   Versão atualizada: Nome do lote definido pelo usuário
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
      resolve(conexaoDB);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

/* -------------------------------------------------------------
   Monta caminho completo "NIVEL 0 > NIVEL 1..."
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
      const req = indexedDB.open(NOME_BANCO, novaVersao);

      req.onupgradeneeded = (event) => {
        const dbUp = event.target.result;
        dbUp.createObjectStore(nomeStore, { autoIncrement: true });
      };

      req.onsuccess = (event) => {
        conexaoDB = event.target.result;
        resolve();
      };

      req.onerror = (event) => reject(event.target.error);
    });
  }

  const trans = conexaoDB.transaction([nomeStore], "readwrite");
  const store = trans.objectStore(nomeStore);
  store.add(lote);

  return new Promise((resolve, reject) => {
    trans.oncomplete = () => resolve();
    trans.onerror = () => reject(trans.error);
  });
}

/* -------------------------------------------------------------
   Criar Lote
------------------------------------------------------------- */
async function criarLote() {
  try {
    const usuario = document.getElementById("usuario").value.trim();
    const loja = document.getElementById("loja").value.trim();
    const nomeLoteDigitado = document.getElementById("nome-lote").value.trim();

    if (!usuario || !loja || !nomeLoteDigitado) {
      mostrarAviso("Preencha usuário, loja e nome do lote.", "erro");
      return;
    }

    // timestamp
    const agora = new Date();
    const timestamp =
      `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(agora.getDate()).padStart(2, "0")}_` +
      `${String(agora.getHours()).padStart(2, "0")}-${String(
        agora.getMinutes()
      ).padStart(2, "0")}-${String(agora.getSeconds()).padStart(2, "0")}`;

    // Nome REAL da store no IndexedDB
    const nomeStore = `LOTE_${nomeLoteDigitado.replace(
      /\s+/g,
      "_"
    )}_${timestamp}`;

    // Capturar categorias marcadas
    const checks = document.querySelectorAll(".checkbox-arvore");
    const categoriasMarcadas = new Set();
    checks.forEach((cb) => {
      if (cb.checked) categoriasMarcadas.add(cb.dataset.path);
    });

    const marcados = [];
    const naoMarcados = [];

    if (!Array.isArray(dadosCSV) || dadosCSV.length === 0) {
      mostrarAviso("CSV não carregado.", "erro");
      return;
    }

    dadosCSV.forEach((item) => {
      const caminho = montarCaminhoProduto(item);
      if (categoriasMarcadas.has(caminho)) marcados.push(item);
      else naoMarcados.push(item);
    });

    const lote = {
      nomeDigitado: nomeLoteDigitado,
      usuario,
      loja,
      dataCriacao: agora.toISOString(),
      marcados,
      naoMarcados,
    };

    await salvarLote(nomeStore, lote);

    sessionStorage.setItem("loteAtual", nomeStore);
    window.location.href = "contagens.html";
  } catch (e) {
    console.error("Erro ao criar lote:", e);
    mostrarAviso("Erro ao criar lote.", "erro");
  }
}

/* -------------------------------------------------------------
   Listar Lotes
------------------------------------------------------------- */
async function listarLotes() {
  const antiga = document.getElementById("lista-lotes");
  if (antiga) antiga.remove();

  const container = document.createElement("div");
  container.id = "lista-lotes";

  const db = await abrirBanco();
  const nomesStores = Array.from(db.objectStoreNames).filter((n) =>
    n.startsWith("LOTE_")
  );

  const ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.padding = "0";

  if (nomesStores.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhum lote encontrado.";
    ul.appendChild(li);
  } else {
    nomesStores
      .sort()
      .reverse()
      .forEach((nomeStore) => {
        const li = document.createElement("li");
        li.classList.add("item-lote");

        // buscar dados do lote
        const trans = db.transaction([nomeStore], "readonly");
        const store = trans.objectStore(nomeStore);
        const req = store.getAll();

        req.onsuccess = () => {
          const dados = req.result[0];
          if (!dados) return;

          const divNome = document.createElement("div");
          divNome.classList.add("lote-nome");

          const info = document.createElement("div");
          info.classList.add("lote-info");
          info.textContent = `Usuário: ${dados.usuario} — Loja: ${dados.loja}`;

          const dataBr = new Date(dados.dataCriacao).toLocaleString("pt-BR");
          const divData = document.createElement("div");
          divData.classList.add("lote-data");
          divData.textContent = `Criado em: ${dataBr}`;

          divNome.innerHTML = `<strong>${dados.nomeDigitado}</strong>`;
          divNome.appendChild(info);
          divNome.appendChild(divData);

          divNome.onclick = () => {
            sessionStorage.setItem("loteAtual", nomeStore);
            window.location.href = "contagens.html";
          };

          const btnDel = document.createElement("button");
          btnDel.textContent = "Excluir";
          btnDel.classList.add("btn-excluir-lote");
          btnDel.onclick = (e) => {
            e.stopPropagation();
            confirmarExclusao(nomeStore);
          };

          li.appendChild(divNome);
          li.appendChild(btnDel);
          ul.appendChild(li);
        };
      });
  }

  container.appendChild(ul);

  const botaoCriar = document.getElementById("criar-lote");
  botaoCriar.insertAdjacentElement("afterend", container);
}

/* -------------------------------------------------------------
   Modal de exclusão
------------------------------------------------------------- */
function criarModal(msg, callbackSim) {
  const bg = document.createElement("div");
  bg.classList.add("modal-bg");

  const box = document.createElement("div");
  box.classList.add("modal-box");

  const p = document.createElement("p");
  p.textContent = msg;

  const btnSim = document.createElement("button");
  btnSim.textContent = "Sim";
  btnSim.classList.add("sim");
  btnSim.onclick = () => {
    document.body.removeChild(bg);
    callbackSim();
  };

  const btnNao = document.createElement("button");
  btnNao.textContent = "Não";
  btnNao.classList.add("nao");
  btnNao.onclick = () => document.body.removeChild(bg);

  box.appendChild(p);
  box.appendChild(btnSim);
  box.appendChild(btnNao);
  bg.appendChild(box);
  document.body.appendChild(bg);
}

function confirmarExclusao(nomeStore) {
  criarModal(`Deseja excluir o lote "${nomeStore}"?`, () => {
    criarModal("Tem certeza absoluta? Isso não pode ser desfeito.", () => {
      excluirStore(nomeStore);
    });
  });
}

/* -------------------------------------------------------------
   Excluir objeto IndexedDB
------------------------------------------------------------- */
async function excluirStore(nomeStore) {
  const db = await abrirBanco();
  db.close();

  const novaVersao = db.version + 1;
  const req = indexedDB.open(NOME_BANCO, novaVersao);

  req.onupgradeneeded = (event) => {
    const dbUp = event.target.result;

    // Apaga o store principal do lote
    if (dbUp.objectStoreNames.contains(nomeStore)) {
      dbUp.deleteObjectStore(nomeStore);
    }

    // Apaga o store de contagens
    const storeContagens = `contagens_${nomeStore}`;
    if (dbUp.objectStoreNames.contains(storeContagens)) {
      dbUp.deleteObjectStore(storeContagens);
    }
  };

  req.onsuccess = () => {
    conexaoDB = req.result;

    // Remover sessionStorage apenas do lote excluído
    sessionStorage.removeItem("loteAtual");
    sessionStorage.removeItem(`estadoContagem_${nomeStore}`);
    sessionStorage.removeItem(`contagens_${nomeStore}`);

    listarLotes();
  };

  req.onerror = (event) => {
    console.error("Erro ao excluir store:", event.target.error);
  };
}

/* -------------------------------------------------------------
   Inicialização
------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const btnCriar = document.getElementById("criar-lote");
  if (btnCriar) btnCriar.addEventListener("click", criarLote);

  listarLotes();
});


/* -------------------------------------------------------------
   Função para mostrar mensagem temporária no topo da página
------------------------------------------------------------- */
function mostrarAviso(msg, tipo = "info") {
  // tipo pode ser: "info", "erro", "sucesso"
  const div = document.createElement("div");
  div.textContent = msg;
  div.className = `aviso-flutuante aviso-${tipo}`;

  // estilos básicos
  div.style.position = "fixed";
  div.style.top = "10px";
  div.style.left = "50%";
  div.style.transform = "translateX(-50%)";
  div.style.padding = "10px 20px";
  div.style.backgroundColor =
    tipo === "erro" ? "#f44336" : tipo === "sucesso" ? "#4caf50" : "#2196f3";
  div.style.color = "#fff";
  div.style.fontWeight = "bold";
  div.style.borderRadius = "5px";
  div.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
  div.style.zIndex = 9999;
  div.style.opacity = 0;
  div.style.transition = "opacity 0.3s ease";

  document.body.appendChild(div);

  // fade in
  requestAnimationFrame(() => {
    div.style.opacity = 1;
  });

  // remove após 2 segundos
  setTimeout(() => {
    div.style.opacity = 0;
    div.addEventListener("transitionend", () => div.remove());
  }, 2000);
}
