(function () {
  const NOME_BANCO_LOCAL = "banco_lotes";

  // --- util: sanitiza string para nome de arquivo (remove / \ : * ? " < > | e reduz espaços)
  function sanitizeFilename(str) {
    return String(str || "")
      .normalize("NFKD") // separa acentos
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[\/\\:?*"<>|]/g, "") // remove caracteres inválidos
      .trim()
      .replace(/\s+/g, "_"); // espaços para underscore
  }

  function abrirBancoExportar() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(NOME_BANCO_LOCAL);
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function exportarContagens() {
    try {
      const nomeStore = sessionStorage.getItem("loteAtual");
      if (!nomeStore) {
        alert("Nenhum lote selecionado.");
        return;
      }

      const storeContagens = `contagens_${nomeStore}`;
      const db = await abrirBancoExportar();

      if (!db.objectStoreNames.contains(storeContagens)) {
        alert("Nenhuma contagem salva para exportar.");
        return;
      }

      // pega todas as contagens
      const txCont = db.transaction([storeContagens], "readonly");
      const storeC = txCont.objectStore(storeContagens);
      const reqCont = storeC.getAll();

      reqCont.onerror = () => alert("Erro ao ler contagens.");
      reqCont.onsuccess = () => {
        const dados = reqCont.result || [];

        if (dados.length === 0) {
          alert("Nenhuma contagem encontrada.");
          return;
        }

        // ler dados do lote para montar nome do arquivo
        if (!db.objectStoreNames.contains(nomeStore)) {
          alert("Erro: store do lote não existe.");
          return;
        }

        const txLote = db.transaction([nomeStore], "readonly");
        const storeL = txLote.objectStore(nomeStore);
        const reqLote = storeL.getAll();

        reqLote.onerror = () => alert("Erro ao obter os dados do lote.");
        reqLote.onsuccess = () => {
          const dadosLote = reqLote.result[0];
          if (!dadosLote) {
            alert("Não foi possível ler dados do lote.");
            return;
          }

          // montar partes do nome do arquivo
          const usuarioRaw = dadosLote.usuario || "SEMUSUARIO";
          const lojaRaw = dadosLote.loja || "SEMLOJA";
          const descricaoRaw = dadosLote.nomeDigitado || "SEMLOTE";

          const usuario = sanitizeFilename(usuarioRaw).toUpperCase();
          const loja = sanitizeFilename(lojaRaw).toUpperCase();
          const descricao = sanitizeFilename(descricaoRaw).toUpperCase();

          // data no formato dd-mm-aa (ex: 09-12-25)
          let dataFinal = "";
          if (dadosLote.dataCriacao) {
            const dt = new Date(dadosLote.dataCriacao);
            if (!isNaN(dt)) {
              dataFinal = `${String(dt.getDate()).padStart(2, "0")}-${String(
                dt.getMonth() + 1
              ).padStart(2, "0")}-${String(dt.getFullYear()).slice(-2)}`;
            }
          }
          if (!dataFinal) {
            // fallback para hoje
            const dt = new Date();
            dataFinal = `${String(dt.getDate()).padStart(2, "0")}-${String(
              dt.getMonth() + 1
            ).padStart(2, "0")}-${String(dt.getFullYear()).slice(-2)}`;
          }

          const baseNomeArquivo = `${usuario}_${loja}_${descricao}_${dataFinal}`;

          /* ==========================================================
             1) Montar e exportar CSV
          ========================================================== */
          const cabecalho = [
            "DATA",
            "HORA",
            "USUARIO",
            "LOCAL",
            "CORREDOR",
            "ANDAR",
            "SEQPRODUTO",
            "CODACESSO",
            "DESCCOMPLETA",
            "QTDEMB",
            "CONTAGEM",
          ].join(";");

          const linhasCSV = [cabecalho];

          dados.forEach((c) => {
            const linha = [
              c.data,
              c.hora,
              c.usuario,
              c.tipoLocal,
              c.corredor,
              c.andar,
              c.seqProduto,
              c.codAcesso,
              (c.descCompleta || "").replace(/;/g, ","), // evitar ; no meio do CSV
              c.qtdEmbalagem,
              c.quantidade,
            ].join(";");
            linhasCSV.push(linha);
          });

          const textoCSV = linhasCSV.join("\n");
          const BOM = "\uFEFF";
          const blobCSV = new Blob([BOM + textoCSV], {
            type: "text/csv;charset=utf-8;",
          });
          const urlCSV = URL.createObjectURL(blobCSV);
          const aCSV = document.createElement("a");
          aCSV.href = urlCSV;
          aCSV.download = `${baseNomeArquivo}.csv`;
          document.body.appendChild(aCSV);
          aCSV.click();
          document.body.removeChild(aCSV);
          URL.revokeObjectURL(urlCSV);

          /* ==========================================================
             2) Agrupar por codAcesso (somar) e gerar TXT
             Observação: soma considera sinais (+/-) conforme os valores salvos
          ========================================================== */
          const agrupado = {};
          // importante: manter ordem de aparição dos EANs conforme aparecem nas contagens
          const ordemEans = [];

          dados.forEach((c) => {
            const ean = String(c.codAcesso || "");
            if (!agrupado.hasOwnProperty(ean)) {
              agrupado[ean] = 0;
              ordemEans.push(ean);
            }
            agrupado[ean] += Number(c.quantidade);
          });

          const linhasTXT = [];

          ordemEans.forEach((ean) => {
            const soma = agrupado[ean];
            const prefixo6 = "000000";
            const ean14 = ean.padStart(14, "0");
            const qtd7 = String(soma).padStart(7, "0");
            const linhaFinal = `${prefixo6}${ean14}${qtd7}`;
            linhasTXT.push(linhaFinal);
          });

          // montagem do conteúdo TXT
          const textoTXT = linhasTXT.join("\n");

          // baixar TXT com sufixo _CONCATENADO no nome do arquivo
          const blobTXT = new Blob([textoTXT], {
            type: "text/plain;charset=utf-8;",
          });
          const urlTXT = URL.createObjectURL(blobTXT);
          const aTXT = document.createElement("a");
          aTXT.href = urlTXT;
          aTXT.download = `${baseNomeArquivo}_CONCATENADO.txt`;
          document.body.appendChild(aTXT);
          aTXT.click();
          document.body.removeChild(aTXT);
          URL.revokeObjectURL(urlTXT);
        };
      };
    } catch (e) {
      console.error("Erro exportarContagens:", e);
      alert("Erro inesperado ao exportar contagens.");
    }
  }

  // ativa o botão ao carregar DOM
  document.addEventListener("DOMContentLoaded", () => {
    const botao = document.getElementById("botao-exportar-contagens");
    if (botao) botao.addEventListener("click", exportarContagens);
  });
})();
