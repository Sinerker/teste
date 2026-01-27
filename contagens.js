/* ============================================================
   contagens.js — Gestão de contagens por lote (com cache/session)
   - Opção A: arquivo completo, organizado e comentado
   - Requisitos: usar sessionStorage por lote, IndexedDB por lote
============================================================ */

/* --------------------------
   Configurações / Estado
   -------------------------- */
const NOME_BANCO = "banco_lotes";
let conexaoDB = null;
let loteAtual = null; // objeto do lote carregado (contém marcados, naoMarcados, usuario, etc)
let mapContagens = {}; // cache em sessionStorage para somas rápidas por codAcesso (por lote)
let ultimoProdutoContado = null; // guarda o último salvo para exibir em #ultimo-produto
const display = document.getElementById("info-produto");

/* ===========================================================
   1) ABRIR OU RETORNAR CONEXÃO COM IndexedDB
   =========================================================== */
function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (conexaoDB) return resolve(conexaoDB);
    const req = indexedDB.open(NOME_BANCO);
    req.onsuccess = (e) => {
      conexaoDB = e.target.result;
      resolve(conexaoDB);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/* ===========================================================
   2) CARREGAR LOTE ATUAL
   - lê sessionStorage "loteAtual" (nomeStore) e carrega o registro
   - carrega mapContagens do sessionStorage: "contagens_<nomeStore>"
   =========================================================== */
async function carregarLoteAtual() {
  const nomeStore = sessionStorage.getItem("loteAtual");
  if (!nomeStore) {
    alert("Nenhum lote selecionado.");
    window.location.href = "index.html";
    return null;
  }

  const db = await abrirBanco();
  if (!db.objectStoreNames.contains(nomeStore)) {
    alert(`Lote "${nomeStore}" não existe.`);
    window.location.href = "index.html";
    return null;
  }

  // carregar cache de contagens do sessionStorage (se existir)
  const cache = sessionStorage.getItem(`contagens_${nomeStore}`);
  mapContagens = cache ? JSON.parse(cache) : {};

  // carregar dados do lote (assumi que o lote foi salvo como único registro na store de lote)
  return new Promise((resolve, reject) => {
    const tx = db.transaction([nomeStore], "readonly");
    const store = tx.objectStore(nomeStore);
    const req = store.getAll();
    req.onsuccess = (e) => {
      const arr = e.target.result;
      if (!arr || arr.length === 0) reject("Lote vazio");
      else resolve(arr[0]);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/* ===========================================================
   3) EXIBIÇÃO DO PRODUTO (no painel info-produto)
   - status: "encontrado" | "fora-lote" | "nao-encontrado"
   - se checkbox Qtde1 estiver marcado: salvar automaticamente APÓS exibir
   =========================================================== */
function exibirProduto(produto, status) {
  const inputCodigo = document.getElementById("codigo-produto");

  // reset
  display.className = "";
  display.innerHTML = "";

  if (status === "encontrado") {
    display.classList.add("produto-encontrado");
    display.style.display = "flex";

    display.innerHTML = `
      <div class="linha-seq-ean">
        <div><strong>SEQ:</strong> <span class="seq">${produto.SEQPRODUTO}</span></div>
        <div><strong>EAN:</strong> <span class="ean">${produto.CODACESSO}</span></div>
      </div>

      <div class="linha-descricao">
        <strong>Descrição:</strong>
        <span class="descricao">${produto.DESCCOMPLETA}</span>
      </div>

      <div class="linha-qtd">
        <strong>Qtd Emb:</strong>
        <span class="qtd">${produto.QTDEMBALAGEM}</span>
      </div>
    `;

    // Atualiza input quantidade com soma cache (pode ser negativo)
    const totalSalvo = mapContagens[produto.CODACESSO] ?? 0;
    const inputQtd = document.getElementById("quantidade");
    inputQtd.value = totalSalvo !== 0 ? totalSalvo : "";
    inputQtd.focus();
    inputQtd.select();

    // Se Qtde1 estiver ativo: salvamento automático.
    // Precisamos aguardar o DOM já montado (já está) e então chamar autoSalvar.
    if (document.getElementById("checkbox-qtde1").checked) {
      // Apenas auto-salva se os campos obrigatórios estiverem preenchidos
      // (salvarContagem() fará a validação final; aqui só colocamos o valor e chamamos)
      inputQtd.value = "1";
      // async call — não bloquear a UI
      setTimeout(() => {
        // salvarContagem verifica os campos; se faltar algo, não salva.
        salvarContagem().catch((e) => {
          // erros já logados em salvarContagem; aqui somente prevenção
          console.error("autoSalvarQtde1 falhou:", e);
        });
      }, 0);
    }
  } else if (status === "fora-lote") {
    display.classList.add("produto-fora-lote");
    display.style.display = "block";
    display.innerHTML = `<div class="valor msg">Produto fora do lote</div>`;
    inputCodigo.focus();
    inputCodigo.select();
  } else if (status === "nao-encontrado") {
    display.classList.add("produto-nao-encontrado");
    display.style.display = "block";
    display.innerHTML = `<div class="valor msg">Produto não encontrado</div>`;
    inputCodigo.focus();
    inputCodigo.select();
  }
}

/* ===========================================================
   4) BUSCA POR CÓDIGO
   - busca apenas entre marcados (se achar, exibe encontrado)
   - se achar entre naoMarcados exibe "fora-lote"
   =========================================================== */
function buscarPorCodigo(codigoDigitado) {
  const codigoLimpo = String(codigoDigitado || "").replace(/\s+/g, "");
  const produtoMarcado = loteAtual.marcados.find(
    (item) => String(item.CODACESSO || "").replace(/\s+/g, "") === codigoLimpo
  );
  if (produtoMarcado) {
    exibirProduto(produtoMarcado, "encontrado");
    return;
  }

  const produtoNaoMarcado = loteAtual.naoMarcados.find(
    (item) => String(item.CODACESSO || "").replace(/\s+/g, "") === codigoLimpo
  );
  if (produtoNaoMarcado) {
    exibirProduto(produtoNaoMarcado, "fora-lote");
    return;
  }

  exibirProduto(null, "nao-encontrado");
}

/* ===========================================================
   5) BUSCA POR NOME
   - palavras obrigatórias (todas devem existir na descrição)
   - retorna somente produtos marcados
   - se 1 resultado -> exibe; se >1 -> lista para escolha
   =========================================================== */
function buscarPorNome(textoDigitado) {
  const termo = String(textoDigitado || "")
    .toLowerCase()
    .trim();
  if (!termo) {
    exibirProduto(null, "nao-encontrado");
    return;
  }
  const palavras = termo.split(/\s+/g);

  const resultados = loteAtual.marcados
    .map((item) => {
      const descricao = String(item.DESCCOMPLETA || "").toLowerCase();
      const todasExistem = palavras.every((p) => descricao.includes(p));
      if (!todasExistem) return null;
      // score simples: quantas palavras
      let score = 0;
      palavras.forEach((p) => {
        if (descricao.includes(p)) score++;
      });
      return { item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (resultados.length === 0) {
    exibirProduto(null, "nao-encontrado");
    return;
  }
  if (resultados.length === 1) {
    exibirProduto(resultados[0].item, "encontrado");
    return;
  }

  // múltiplos resultados -> exibir lista
  exibirListaResultados(resultados.map((r) => r.item));
}

/* ===========================================================
   Função para focar suavemente no topo de um campo (scrollIntoView)
   - idCampo: ID do campo a focar
   =========================================================== */

document.getElementById("codigo-produto").addEventListener("focus", () => {
  forcarNoTopo("codigo-produto");
});

document.getElementById("quantidade").addEventListener("focus", () => {
  forcarNoTopo("quantidade");
});

function forcarNoTopo(idCampo) {
  const elemento = document.getElementById(idCampo);
  if (!elemento) return;

  let tentativas = 0;

  const interval = setInterval(() => {
    elemento.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    tentativas++;

    if (tentativas >= 3) {
      clearInterval(interval);
    }
  }, 250);
}



/* ===========================================================
   6) EXIBIR LISTA DE RESULTADOS (quando busca por nome retorna >1)
   - quando o usuário clica em um item:
     -> exibir o produto escolhido
     -> se Qtde1 estiver ativo: salvar automaticamente
   =========================================================== */
function exibirListaResultados(lista) {
  const display = document.getElementById("info-produto");
  display.className = "";
  display.innerHTML = "";
  display.style.display = "block";

  let html = `<div class="lista-resultados">`;
  lista.forEach((produto, idx) => {
    html += `
      <div class="item-resultado" data-index="${idx}">
        <div><strong>SEQ:</strong> ${produto.SEQPRODUTO}</div>
        <div><strong>EAN:</strong> ${produto.CODACESSO}</div>
        <div class="descricao-lista">${produto.DESCCOMPLETA}</div>
      </div>
    `;
  });
  html += `</div>`;
  display.innerHTML = html;

  // adicionar listeners
  const nodes = display.querySelectorAll(".item-resultado");
  nodes.forEach((node, i) => {
    node.addEventListener("click", async () => {
      const produto = lista[i];
      // exibe o produto selecionado
      exibirProduto(produto, "encontrado");

      // se Qtde1 marcado, já salva automaticamente com qtde=1
      if (document.getElementById("checkbox-qtde1").checked) {
        // garantir que o input quantidade está com "1" (exibirProduto não altera se já havia cache)
        const inputQtd = document.getElementById("quantidade");
        inputQtd.value = "1";

        // esperar microtask para DOM estabilizar e então salvar
        setTimeout(() => {
          salvarContagem().catch((e) =>
            console.error("autoSalvar (lista) falhou:", e)
          );
        }, 0);
      }
    });
  });
}

/* ===========================================================
   7) DETECTAR SE A ENTRADA É CÓDIGO OU NOME
   - usa regex /^\d+$/ para decidir se é código (somente dígitos)
   =========================================================== */
function buscarProdutoPorEntrada() {
  const input = document.getElementById("codigo-produto");
  const texto = (input.value || "").trim();
  if (!texto) return;

  const ehCodigo = /^\d+$/.test(texto);
  if (ehCodigo) buscarPorCodigo(texto);
  else buscarPorNome(texto);
}

/* ===========================================================
   8) SALVAR CONTAGEM
   - valida campos obrigatórios: radio, corredor (não vazio), coluna, andar,
     deve haver produto em .produto-encontrado e quantidade não vazia
   - quantidade === 0 -> não salva (limpa campo e foca no código)
   - salva em objectStore: contagens_<nomeStore>
   - atualiza cache mapContagens e sessionStorage
   - atualiza último produto contado
   =========================================================== */
async function salvarContagem() {
  try {
    const produtoElem = document.querySelector(".produto-encontrado");
    const inputQtd = document.getElementById("quantidade");
    const qtdValor = String(inputQtd.value ?? "").trim();

    // campos obrigatórios
    const tipoLocalRadio = document.querySelector(
      'input[name="tipo-local"]:checked'
    );
    const corredor = (document.getElementById("corredor").value || "").trim();
    const coluna = (document.getElementById("coluna").value || "").trim();
    const andar = (document.getElementById("andar").value || "").trim();

    if (
      !produtoElem ||
      !tipoLocalRadio ||
      !corredor ||
      !coluna ||
      !andar ||
      qtdValor === ""
    ) {
      mostrarAviso(
        "Preencha todos os campos obrigatórios antes de salvar.",
        "erro"
      );
      return;
    }

    // verifica se a quantidade é maior que 9999
    if (Number(qtdValor) > 9999) {
      mostrarAviso(
        "Quantidade inválida! Não pode ser maior que 9.999.",
        "erro"
      );
      inputQtd.select(); // seleciona o campo para correção
      return;
    }

    // se quantidade for 0: limpar e não salvar
    if (qtdValor === "0" || Number(qtdValor) === 0) {
      inputQtd.value = "";
      document.getElementById("info-produto").style.display = "none";
      const campoCodigo = document.getElementById("codigo-produto");
      campoCodigo.value = "";
      campoCodigo.select();
      return;
    }

    // montar objeto produto/contagem a salvar
    const produto = {
      seqProduto: produtoElem.querySelector(".seq")?.textContent ?? "",
      descCompleta: produtoElem.querySelector(".descricao")?.textContent ?? "",
      qtdEmbalagem: produtoElem.querySelector(".qtd")?.textContent ?? "",
      codAcesso: produtoElem.querySelector(".ean")?.textContent ?? "",
    };

    const agora = new Date();
    const contagem = {
      usuario: loteAtual?.usuario ?? "desconhecido",
      data: agora.toLocaleDateString("pt-BR"),
      hora: agora.toLocaleTimeString("pt-BR"),
      seqProduto: produto.seqProduto,
      descCompleta: produto.descCompleta,
      qtdEmbalagem: produto.qtdEmbalagem,
      codAcesso: produto.codAcesso,
      quantidade: Number(qtdValor),
      tipoLocal: tipoLocalRadio.value,
      corredor,
      coluna,
      andar,
    };

    const nomeStoreContagens = `contagens_${sessionStorage.getItem(
      "loteAtual"
    )}`;
    const db = await abrirBanco();

    // criar store de contagens se necessário (upgrade)
    if (!db.objectStoreNames.contains(nomeStoreContagens)) {
      db.close();
      const novaVersao = db.version + 1;
      const req = indexedDB.open(NOME_BANCO, novaVersao);
      req.onupgradeneeded = (event) => {
        event.target.result.createObjectStore(nomeStoreContagens, {
          autoIncrement: true,
        });
      };
      await new Promise((resolve, reject) => {
        req.onsuccess = (ev) => {
          conexaoDB = ev.target.result;
          resolve();
        };
        req.onerror = (ev) => reject(ev.target.error);
      });
    }

    // grava contagem
    const trans = conexaoDB.transaction([nomeStoreContagens], "readwrite");
    const store = trans.objectStore(nomeStoreContagens);
    store.add(contagem);

    trans.oncomplete = () => {
      // Atualiza cache (mapContagens) e grava em sessionStorage por lote
      const chave = produto.codAcesso;
      mapContagens[chave] = (mapContagens[chave] || 0) + Number(qtdValor);
      sessionStorage.setItem(nomeStoreContagens, JSON.stringify(mapContagens));

      // limpar campos e esconder painel
      if (!document.getElementById("checkbox-qtde1").checked) {
        inputQtd.value = ""; // só limpa se Qtde1 não estiver marcado
      }
      const campoCodigo = document.getElementById("codigo-produto");
      campoCodigo.value = "";
      campoCodigo.select();
      document.getElementById("info-produto").style.display = "none";

      // atualizar último contado e exibir
      ultimoProdutoContado = { ...produto, quantidade: Number(qtdValor) };
      exibirUltimoProdutoContado();
    };

    trans.onerror = (e) => {
      console.error("Erro ao salvar contagem:", e);
    };
  } catch (err) {
    console.error("salvarContagem erro:", err);
  }
}

async function mostrarContagensSalvas() {
  const nomeStore = sessionStorage.getItem("loteAtual");
  if (!nomeStore) return alert("Nenhum lote selecionado.");

  const db = await abrirBanco();
  const nomeStoreContagens = `contagens_${nomeStore}`;
  if (!db.objectStoreNames.contains(nomeStoreContagens)) {
    return alert("Nenhuma contagem salva para este lote.");
  }

  const tx = db.transaction([nomeStoreContagens], "readonly");
  const store = tx.objectStore(nomeStoreContagens);

  const req = store.getAll();
  req.onsuccess = (e) => {
    const contagens = e.target.result;

    const lista = document.getElementById("lista-contagens");
    lista.innerHTML = ""; // limpa lista anterior

    if (contagens.length === 0) {
      lista.innerHTML = "<p>Nenhuma contagem encontrada.</p>";
    } else {
      contagens.forEach((c) => {
        const div = document.createElement("div");
        div.classList.add("contagem-item");
        div.innerHTML = `
          <div><span class="chave">SEQ:</span> <span class="valor">${c.seqProduto}</span></div>
          <div><span class="chave">EAN:</span> <span class="valor">${c.codAcesso}</span></div>
          <div><span class="chave">Descrição:</span> <span class="valor">${c.descCompleta}</span></div>
          <div><span class="chave">Qtd:</span> <span class="valor">${c.quantidade}</span></div>
          <div><span class="chave">Local:</span> <span class="valor">${c.tipoLocal} - Corredor ${c.corredor}, Coluna ${c.coluna}, Andar ${c.andar}</span></div>
          <div><span class="chave">Data/Hora:</span> <span class="valor">${c.data} ${c.hora}</span></div>
        `;
        lista.appendChild(div);
      });
    }

    // mostra modal
    document.getElementById("modal-contagens").style.display = "flex";
  };

  req.onerror = (e) => {
    console.error("Erro ao buscar contagens:", e);
  };
}

// fechar modal
document.getElementById("fechar-modal").addEventListener("click", () => {
  document.getElementById("modal-contagens").style.display = "none";
});

/* ===========================================================
   9) QTDE1 - CHECKBOX: bloquear input e impedir foco/click
   - quando marcado: coloca 1 no input e impede alteração
   - quando desmarcado: libera o campo
   =========================================================== */
function configurarCheckboxQtde1() {
  const checkboxQtde1 = document.getElementById("checkbox-qtde1");
  const inputQtd = document.getElementById("quantidade");
  const inputCodigo = document.getElementById("codigo-produto");

  if (!checkboxQtde1 || !inputQtd || !inputCodigo) return;

  checkboxQtde1.addEventListener("change", () => {
    if (checkboxQtde1.checked) {
      // Bloqueia o campo para edição e cliques
      inputQtd.value = "1";
      inputQtd.setAttribute("readonly", "readonly");
      inputQtd.classList.add("bloqueado-qtde");

      // impede pointer/foco por clique
      inputQtd.style.pointerEvents = "none";
      inputQtd.style.userSelect = "none";

      // garante que o foco esteja no campo código para continuar contando
      inputCodigo.select();
    } else {
      // Libera o campo
      inputQtd.value = "";
      inputQtd.removeAttribute("readonly");
      inputQtd.classList.remove("bloqueado-qtde");

      inputQtd.style.pointerEvents = "auto";
      inputQtd.style.userSelect = "auto";

      inputCodigo.select();
    }
  });
}

/* ===========================================================
   10) EXIBIR ÚLTIMO PRODUTO CONTADO
   - formata chave/valor (diferencia visual entre label e valor)
   =========================================================== */
function exibirUltimoProdutoContado() {
  if (!ultimoProdutoContado) return;
  const display = document.getElementById("ultimo-produto");
  if (!display) return;

  // estrutura similar à lista de resultados, mas compacta
  display.innerHTML = `
    <div class="ultimo-contado">
      <div><span class="chave">SEQ:</span> <span class="valor">${ultimoProdutoContado.seqProduto}</span></div>
      <div><span class="chave">EAN:</span> <span class="valor">${ultimoProdutoContado.codAcesso}</span></div>
      <div class="descricao-lista"><span class="valor">${ultimoProdutoContado.descCompleta}</span></div>
      <div><span class="chave">Qtd:</span> <span class="valor">${ultimoProdutoContado.quantidade}</span></div>
    </div>
  `;
}

/* ===========================================================
   11) EVENTOS E INICIALIZAÇÃO (DOM ready)
   - restaura estado por lote
   - registra listeners de teclas e botões
   =========================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  // registrar listeners para salvar estado
  document
    .querySelectorAll('input[name="tipo-local"]')
    .forEach((radio) => radio.addEventListener("change", salvarEstadoTela));
  document
    .getElementById("corredor")
    .addEventListener("input", salvarEstadoTela);
  document
    .getElementById("coluna")
    .addEventListener("change", salvarEstadoTela);
  document.getElementById("andar").addEventListener("change", salvarEstadoTela);

  // carregar lote atual e cache
  loteAtual = await carregarLoteAtual();

  // criar div info-produto se não existir (mantém compatibilidade com markup)
  let infoProduto = document.getElementById("info-produto");
  if (!infoProduto) {
    infoProduto = document.createElement("div");
    infoProduto.id = "info-produto";
    const campoQuantidade = document.querySelector(".campo-quantidade");
    campoQuantidade.parentNode.insertBefore(infoProduto, campoQuantidade);
  }

  // buscar produto ao ENTER no campo código/nome
  const inputCodigo = document.getElementById("codigo-produto");
  inputCodigo.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      buscarProdutoPorEntrada();
    }
  });

  // salvar contagem ao ENTER no campo quantidade
  const inputQtd = document.getElementById("quantidade");
  inputQtd.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      salvarContagem();
    }
  });

  // botão tela cheia (mantém seu comportamento)
  const botaoTelaCheia = document.getElementById("botao-tela-cheia");
  if (botaoTelaCheia) {
    botaoTelaCheia.addEventListener("click", async () => {
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen();
      botaoTelaCheia.style.display = "none";
    });
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) botaoTelaCheia.style.display = "block";
    });
  }

  // restaurar estado da tela para o lote atual (usa chave por lote)
  restaurarEstadoTela();

  // configurar checkbox Qtde1
  configurarCheckboxQtde1();

  document
    .getElementById("botao-ver-contagens")
    .addEventListener("click", () => {
      mostrarContagensSalvas();
    });
});

/* ===========================================================
   12) SALVAR / RESTAURAR ESTADO DA TELA POR LOTE (sessionStorage)
   - chave: estadoContagem_<nomeStore>
   =========================================================== */
function salvarEstadoTela() {
  const tipoLocal =
    document.querySelector('input[name="tipo-local"]:checked')?.value || "";
  const corredor = document.getElementById("corredor").value || "";
  const coluna = document.getElementById("coluna").value || "A";
  const andar = document.getElementById("andar").value || "1";

  const nomeStore = sessionStorage.getItem("loteAtual");
  if (!nomeStore) return;

  const estado = { tipoLocal, corredor, coluna, andar };
  sessionStorage.setItem(`estadoContagem_${nomeStore}`, JSON.stringify(estado));
}

function restaurarEstadoTela() {
  const nomeStore = sessionStorage.getItem("loteAtual");
  if (!nomeStore) return;

  const dados = sessionStorage.getItem(`estadoContagem_${nomeStore}`);
  if (!dados) return;

  const estado = JSON.parse(dados);
  const radio = document.querySelector(
    `input[name="tipo-local"][value="${estado.tipoLocal}"]`
  );
  if (radio) radio.checked = true;

  document.getElementById("corredor").value = estado.corredor || "";
  document.getElementById("coluna").value = estado.coluna || "A";
  document.getElementById("andar").value = estado.andar || "1";
}

/* ===========================================================
   Exportar funções úteis para depuração (opcional)
   - window._contagens = { ... } facilita console debugging
   =========================================================== */
window._contagens = {
  abrirBanco,
  carregarLoteAtual,
  buscarPorCodigo,
  buscarPorNome,
  salvarContagem,
  mapContagensRef: () => mapContagens,
  getLoteAtual: () => loteAtual,
};

/* -------------------------------------------------------------
   Função para mostrar mensagem temporária no topo da página
------------------------------------------------------------- */
function mostrarAviso(msg, tipo = "erro") {
  // tipo: "info", "erro", "sucesso"
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
