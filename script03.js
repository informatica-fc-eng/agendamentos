// ===================================================== //
//   AGENDAMENTO COM JSON LOCAL                          //
//   (carrega horários disponíveis de um arquivo JSON)   //
// ===================================================== //

let horariosDisponiveis = {}; // variável que guardará os horários lidos do JSON ou do localStorage

// Faz um fetch do arquivo "horarios.json" (deve estar no mesmo diretório/public)
fetch("horarios.json")
    .then(res => res.json()) // converte a resposta para JSON
    .then(data => {
        horariosDisponiveis = data; // armazena os horários carregados

        const datasDisponiveis = Object.keys(horariosDisponiveis); // obtém as chaves (datas) do objeto
        const inputData = document.getElementById("data"); // campo <input type="date">

        // Define o menor e maior valor permitidos no input date com base no JSON
        inputData.min = datasDisponiveis[0];
        inputData.max = datasDisponiveis[datasDisponiveis.length - 1];

        // Validação: se o usuário escolher uma data fora da lista, seta uma mensagem de erro customizada
        inputData.addEventListener("input", function () {
            if (!datasDisponiveis.includes(this.value)) {
                // setCustomValidity impede o envio do formulário se não for vazio
                this.setCustomValidity("Data indisponível para agendamento.");
            } else {
                // limpa a mensagem quando a data é válida
                this.setCustomValidity("");
            }
        });

        // Aplica horários previamente salvos no localStorage (se houver)
        const salvos = localStorage.getItem("horariosDisponiveis");
        if (salvos) {
            const locais = JSON.parse(salvos);
            // mescla os horários salvos com os carregados do JSON
            for (let dataKey in locais) {
                horariosDisponiveis[dataKey] = locais[dataKey];
            }
        }
    })
    .catch(err => console.error("Erro ao carregar horários:", err)); // trata erro se o fetch falhar

// Função para salvar alterações de horários no localStorage
function salvarHorarios() {
    localStorage.setItem("horariosDisponiveis", JSON.stringify(horariosDisponiveis));
}

// Quando o usuário altera a data selecionada, atualiza o <select> de horas
document.getElementById("data").addEventListener("change", function () {
    const dataSelecionada = this.value;
    const horaSelect = document.getElementById("hora");
    horaSelect.innerHTML = ""; // limpa as opções anteriores

    // Se houver horários para a data selecionada, popula o select com eles
    if (horariosDisponiveis[dataSelecionada] && horariosDisponiveis[dataSelecionada].length > 0) {
        horariosDisponiveis[dataSelecionada].forEach(hora => {
            const option = document.createElement("option");
            option.value = hora;
            option.textContent = hora;
            horaSelect.appendChild(option);
        });
        horaSelect.disabled = false; // habilita o select
    } else {
        // Se não houver horários, mostra uma opção informativa e desabilita o select
        const option = document.createElement("option");
        option.textContent = "Sem horários disponíveis";
        option.disabled = true;
        horaSelect.appendChild(option);
        horaSelect.disabled = true;
    }
});


// ===================================================== //
//   FUNÇÕES DE MODAL E RESET                            //
// ===================================================== //

// Mostra o modal de confirmação preenchendo os dados
function mostrarModal(nome, email, telefone, data, hora) {
    document.getElementById("modalNome").textContent = nome;         // coloca o nome no modal
    document.getElementById("modalEmail").textContent = email;       // coloca o e-mail no modal
    document.getElementById("modalTelefone").textContent = telefone; // coloca o telefone no modal
    document.getElementById("modalData").textContent = data;         // coloca a data no modal
    document.getElementById("modalHora").textContent = hora;         // coloca a hora no modal
    document.getElementById("confirmationModal").style.display = "block"; // exibe o modal
}

// Fecha o modal e reseta os campos do formulário
function fecharModal() {
    document.getElementById("confirmationModal").style.display = "none"; // esconde o modal
    document.getElementById("nome").value = "";                          // limpa nome
    document.getElementById("email").value = "";                         // limpa email
    document.getElementById("telefone").value = "";                      // limpa telefone
    document.getElementById("data").value = "";                          // limpa data
    // redefine o select de hora para o estado inicial (forçando re-seleção após fechar)
    document.getElementById("hora").innerHTML = "<option value=''>Selecione uma data primeiro</option>";
    document.getElementById("hora").disabled = true;                     // desabilita select de hora
    document.getElementById("mensagem").value = "";                      // limpa observações
    document.getElementById("statusMsg").textContent = "";               // limpa mensagem de status
}

// Fecha o modal quando o usuário clica fora da caixa do modal
window.onclick = function (event) {
    const modal = document.getElementById("confirmationModal");
    if (event.target == modal) {
        fecharModal();
    }
};


// ===================================================== //
//   FUNÇÃO PARA ENVIO VIA WHATSAPP (BACKEND NODE.JS)   //
//   (chama o endpoint do seu servidor para enviar uma  //
//    mensagem via Twilio/WhatsApp ou similar)          //
// ===================================================== //

function enviarConfirmacaoWhatsApp(params) {
    const apiUrl = "http://localhost:3000/api/send-whatsapp"; // endpoint do backend (ajuste conforme ambiente)

    // fetch POST envia JSON com os dados necessários para o servidor enviar o WhatsApp
    return fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nome: params.nome,
            telefone: params.telefone, // espera formato E.164 (ex: 5511999998888)
            data: params.data,
            hora: params.hora
        })
    }).then(response => {
        // se o backend responder com status não-ok, lança erro para o catch
        if (!response.ok) {
            throw new Error(`Falha no envio do WhatsApp. Status: ${response.status}`);
        }
        return response.json(); // retorna o JSON de sucesso para encadear promessas
    });
}


// ===================================================== //
//   FUNÇÃO PRINCIPAL: SALVAR NO BANCO + ENVIAR E-MAIL   //
// ===================================================== //
async function enviarEmail() {
    // Captura os valores dos campos do formulário
    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const telefone = document.getElementById("telefone").value.replace(/\D/g, ''); // remove tudo que não é número
    const dataInput = document.getElementById("data").value;
    const hora = document.getElementById("hora").value;
    const mensagem = document.getElementById("mensagem").value.trim();
    const statusMsg = document.getElementById("statusMsg");

    // === Validação básica ===
    if (!nome || !email || !telefone || !dataInput || !hora) {
        statusMsg.style.color = "red";
        statusMsg.textContent = "Preencha todos os campos obrigatórios!";
        return;
    }

    // Formata data para exibição amigável
    const dataObj = new Date(dataInput + 'T00:00:00');
    const dataFormatada = dataObj.toLocaleDateString("pt-BR");

    // Objeto com os dados que serão enviados ao backend
    const payload = {
        nome,
        email,
        telefone: telefone.startsWith('55') ? telefone : '55' + telefone, // garante formato brasileiro
        data: dataInput, // formato YYYY-MM-DD para o banco
        hora,
        mensagem
    };

    // Exibe mensagem de progresso
    statusMsg.textContent = "Verificando disponibilidade...";
    statusMsg.style.color = "black";

    // === Passo 1: tenta salvar no banco (Node.js) ===
    const backendUrl = "http://localhost:3000/api/book"; // altere para URL de produção no deploy

    try {
        const response = await fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Se inserção bem-sucedida
        if (response.status === 201 || response.status === 200) {
            statusMsg.textContent = "Agendamento confirmado! Enviando email...";
            statusMsg.style.color = "green";

            // === Passo 2: envia emails via EmailJS ===
            await emailjs.send("service_8joxznp", "template_yiopo3o", payload);
            await emailjs.send("service_8joxznp", "template_qg2enqu", payload);

            // Remove o horário reservado da lista local
            if (horariosDisponiveis[dataInput]) {
                horariosDisponiveis[dataInput] = horariosDisponiveis[dataInput].filter(h => h !== hora);
                salvarHorarios();
            }

            // Mostra o modal de confirmação
            mostrarModal(nome, email, telefone, dataFormatada, hora);

        } else if (response.status === 409) {
            // Horário já ocupado
            statusMsg.textContent = data.message || "Horário já reservado. Escolha outro horário.";
            statusMsg.style.color = "red";

        } else {
            statusMsg.textContent = data.message || "Erro ao salvar agendamento.";
            statusMsg.style.color = "red";
        }
    } catch (error) {
        // Falha de conexão com servidor
        console.error("Erro ao conectar com backend:", error);
        statusMsg.style.color = "red";
        statusMsg.textContent = "Falha de conexão com servidor. Verifique se o Node.js está rodando.";
    }
}



// ===================================================== //
//   FUNÇÕES DE MODAL WHATSAPP                            //
// ===================================================== //
function fecharAuthModal() {
    document.getElementById("whatsappAuthModal").style.display = "none";
    // Opcional: Salvar que o usuário já viu o popup (para não mostrar mais)
    localStorage.setItem('hasSeenAuthPopup', 'true');
}

// =====================================================================
// FUNÇÕES PARA MODAL DE AUTORIZAÇÃO WHATSAPP (JOIN)
// =====================================================================

// Função para fechar o novo modal de autorização
function fecharAuthModal() {
    document.getElementById("whatsappAuthModal").style.display = "none";
    // Opcional: Salva no navegador que o usuário já viu o popup
    localStorage.setItem('hasSeenAuthPopup', 'true');
}

// ⚠️ NOVO: Função para montar o link do WhatsApp
function montarWhatsappLink() {
    const twilioNumber = "+14155238886"; // Número do Twilio Sandbox (FIXO)
    
    // ⚠️ SUBSTITUA "join SEU-CODIGO-JOIN" PELO SEU CÓDIGO REAL DA TWILIO!
    const joinCode = "join great-panda"; 
    
    // Mensagem profissional em português
    const message = "";
    
    // O link para iniciar o chat do WhatsApp com mensagem pré-preenchida
    // O join code vai em uma nova linha para clareza
    const encodedMessage = encodeURIComponent(`${message}${joinCode}`);
    
    // O link wa.me para abrir o chat
    const whatsappLink = `https://wa.me/${twilioNumber}?text=${encodedMessage}`;
    
    // Aplica o link ao botão no HTML
    document.getElementById("whatsappAuthLink").href = whatsappLink;
}

// Lógica para exibir o modal de autorização assim que a página carrega
// O "window.onload" garante que o HTML já foi carregado antes de manipular os elementos.
window.onload = function() {
    montarWhatsappLink(); // Primeiro monta o link
    
    // Exibe o modal de autorização ao carregar a página
    document.getElementById("whatsappAuthModal").style.display = "block";
    
    // Nota: Se você usou a lógica de opt-in que eu forneci antes, 
    // a função window.onload pode precisar de ajustes para não sobrescrever a lógica de inicialização.
};

// =====================================================================
// 3. FUNÇÃO PARA COPIAR CÓDIGO (ADICIONAR NO SEU script03.js)
// =====================================================================

// Recebe o ID do elemento do texto (joinCodeText) e o elemento do botão clicado (this)
function copiarCodigo(elementId, buttonElement) {
    // Pega o texto do span #joinCodeText
    const copyText = document.getElementById(elementId).textContent;
    
    // Usa a API de Clipboard moderna para copiar o texto (funciona em HTTPS)
    if (!navigator.clipboard) {
        // Fallback: para navegadores sem suporte ou HTTP (se for o caso)
        console.error('API de Clipboard não suportada.');
        alert('Falha ao copiar. Por favor, copie manualmente: ' + copyText);
        return;
    }
    
    navigator.clipboard.writeText(copyText).then(function() {
        // Efeito visual no botão: muda o texto para 'Copiado!'
        const originalText = buttonElement.textContent;
        
        buttonElement.textContent = 'Copiado!';
        
        // Reverte o texto do botão após 2 segundos
        setTimeout(() => {
            buttonElement.textContent = originalText;
        }, 2000);
        
    }, function(err) {
        console.error('Falha ao copiar:', err);
        alert('Falha ao copiar. Por favor, copie manualmente: ' + copyText);
    });
}