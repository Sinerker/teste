/* -------------------------------------------------------------
   contagens.js — otimizado para celular
--------------------------------------------------------------*/

const NOME_BANCO = "banco_lotes";
let conexaoDB = null;
let loteAtual = null;
let dadosCSV = [];

/* -------------------------------------------------------------
   Abrir IndexedDB
--------------------------------------------------------------*/
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
   Carregar lote atual do sessionStorage
--------------------------------------------------------------*/
async function carregarLoteAtual() {
  const nomeStore = sessionStorage.getItem("loteAtual");
  console.log("Carregando lote atual:", nomeStore);

  if (!nomeStore) {
    alert("Nenhum lote selecionado. Volte para a página inicial.");
    window.location.href = "index.html";
    return null;
  }

  const db = await abrirBanco();

  if (!db.objectStoreNames.contains(nomeStore)) {
    alert(`O lote "${nomeStore}" não existe mais.`);
    window.location.href = "index.html";
    return null;
  }

  return new Promise((resolve, reject) => {
    const transacao = db.transaction([nomeStore], "readonly");
    const store = transacao.objectStore(nomeStore);

    const request = store.getAll();
    request.onsuccess = (event) => {
      const lotes = event.target.result;
      console.log("Lotes retornados do store:", lotes);

      if (!lotes || lotes.length === 0) {
        reject("O lote está vazio.");
        return;
      }

      resolve(lotes[0]);
    };
    request.onerror = (event) => {
      console.error("Erro ao carregar lote do IndexedDB:", event.target.error);
      reject(event.target.error);
    };
  });
}

/* -------------------------------------------------------------
   Buscar produto por código ou descrição ao pressionar Enter
--------------------------------------------------------------*/
function buscarProdutoPorCodigo() {
  const inputCodigo = document.getElementById("codigo-produto");
  const codigoDigitadoRaw = inputCodigo.value;
  const codigoDigitado = codigoDigitadoRaw
    .replace(/\r/g, "")
    .trim()
    .toLowerCase();
  const displayInfo = document.getElementById("info-produto");
  const inputQuantidade = document.getElementById("quantidade");

  displayInfo.textContent = "";
  displayInfo.style.color = "black";

  if (!codigoDigitado) return;

  console.log("Buscando produto:", codigoDigitado);

  // Procura nos produtos marcados
  const produtoMarcado = loteAtual.marcados.find((item) => {
    const codigoItem = String(item.CODACESSO || "")
      .replace(/\r/g, "")
      .trim();
    const nomeItem = String(item.DESCCOMPLETA || "")
      .replace(/\r/g, "")
      .trim()
      .toLowerCase();
    return codigoItem === codigoDigitado || nomeItem === codigoDigitado;
  });

  if (produtoMarcado) {
    console.log("Produto encontrado nos marcados:", produtoMarcado);
    displayInfo.innerHTML = `
      <strong>SEQ:</strong> ${produtoMarcado.SEQPRODUTO} |
      <strong>Descrição:</strong> ${produtoMarcado.DESCCOMPLETA} |
      <strong>Código:</strong> ${produtoMarcado.CODACESSO} |
      <strong>Qtd Embalagem:</strong> ${produtoMarcado.QTDEMBALAGEM}
    `;
    displayInfo.style.color = "green";

    inputQuantidade.focus();
    inputQuantidade.select();
    return;
  }

  // Procura nos produtos não marcados
  const produtoNaoMarcado = loteAtual.naoMarcados.find((item) => {
    const codigoItem = String(item.CODACESSO || "")
      .replace(/\r/g, "")
      .trim();
    const nomeItem = String(item.DESCCOMPLETA || "")
      .replace(/\r/g, "")
      .trim()
      .toLowerCase();
    return codigoItem === codigoDigitado || nomeItem === codigoDigitado;
  });

  if (produtoNaoMarcado) {
    console.log("Produto encontrado nos não marcados:", produtoNaoMarcado);
    displayInfo.textContent = "Produto fora do lote";
    displayInfo.style.color = "orange";

    inputQuantidade.focus();
    inputQuantidade.select();
    return;
  }

  console.log("Produto não encontrado");
  displayInfo.textContent = "Produto não encontrado";
  displayInfo.style.color = "red";
}

/* -------------------------------------------------------------
   Inicialização
--------------------------------------------------------------*/
document.addEventListener("DOMContentLoaded", async () => {
  try {
    loteAtual = await carregarLoteAtual();
    if (!loteAtual) return;

    console.log(
      "Pronto para buscar produtos. Lote carregado e CSV disponível."
    );

    // Cria elemento para mostrar informações do produto
    let infoProduto = document.getElementById("info-produto");
    if (!infoProduto) {
      infoProduto = document.createElement("div");
      infoProduto.id = "info-produto";
      infoProduto.style.marginBottom = "0.5rem";
      infoProduto.style.fontWeight = "600";
      infoProduto.style.textAlign = "center";

      const campoQuantidade = document.querySelector(".campo-quantidade");
      campoQuantidade.parentNode.insertBefore(infoProduto, campoQuantidade);
    }

    // Evento para buscar produto apenas ao pressionar Enter
    const inputCodigo = document.getElementById("codigo-produto");
    inputCodigo.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        buscarProdutoPorCodigo();
      }
    });
  } catch (erro) {
    console.error("Erro na inicialização:", erro);
    alert("Erro ao carregar dados. Verifique o console.");
  }
});
