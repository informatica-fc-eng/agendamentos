// Importa as variáveis do arquivo .env (como senha do banco, chaves Twilio etc.)
require('dotenv').config();

// Importa bibliotecas necessárias
const express = require('express');     // Cria servidor web
const cors = require('cors');           // Permite acesso de outro domínio (ex: seu front-end)
const mysql = require('mysql2/promise'); // Conexão assíncrona com MySQL
const twilio = require('twilio');       // Envio de mensagens WhatsApp

const app = express();                  // Inicializa o servidor Express
const port = process.env.PORT || 3000;  // Porta (usa .env ou 3000 padrão)

// === Configuração do Twilio ===
// SID e TOKEN vêm do painel do Twilio e ficam no .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// === Middleware de CORS ===
// Permite que o front-end (HTML+JS) se comunique com este servidor
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  optionsSuccessStatus: 200
}));

// Habilita o uso de JSON no corpo das requisições POST
app.use(express.json());

// === Conexão com banco de dados MySQL ===
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', // Endereço do servidor MySQL
  user: process.env.DB_USER || 'root',      // Usuário
  password: process.env.DB_PASS || '',      // Senha
  database: process.env.DB_NAME || 'agendamentos', // Nome do banco
  waitForConnections: true,
  connectionLimit: 10,                      // Máximo de conexões simultâneas
  queueLimit: 0
});

// === Rota principal de agendamento ===
// É chamada pelo front-end quando o usuário envia o formulário
app.post('/api/book', async (req, res) => {
  const { nome, email, telefone, data, hora, mensagem } = req.body;

  // Validação básica — impede campos vazios
  if (!nome || !email || !telefone || !data || !hora) {
    return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando.' });
  }

  // Conecta ao banco
  const conn = await pool.getConnection();
  try {
    // Insere o novo agendamento na tabela
    const insertSql = `
      INSERT INTO appointments 
      (nome,email,telefone,data_agendamento,hora_agendamento,mensagem)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await conn.query(insertSql, [nome, email, telefone, data, hora, mensagem || null]);

    // Se o insert deu certo, tenta enviar mensagem WhatsApp
    try {
      const to = `whatsapp:${telefone.startsWith('+') ? telefone : '+' + telefone}`;
      const from = `whatsapp:${twilioWhatsAppNumber}`;
      const messageBody = `Olá ${nome}! Seu agendamento foi confirmado em ${data} às ${hora}.`;

      const message = await twilioClient.messages.create({ from, to, body: messageBody });
      console.log('WhatsApp enviado com sucesso. SID:', message.sid);
    } catch (twErr) {
      console.warn('Erro ao enviar WhatsApp:', twErr.message);
    }

    // Responde sucesso ao front-end
    return res.status(201).json({ success: true, message: 'Agendamento criado com sucesso.' });

  } catch (err) {
    // Caso o horário já esteja ocupado, o MySQL gera erro de duplicidade
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      return res.status(409).json({ success: false, message: 'Horário já reservado. Escolha outro.' });
    }
    // Outros erros (ex: falha de conexão, SQL incorreto, etc.)
    console.error('Erro interno:', err);
    return res.status(500).json({ success: false, message: 'Erro no servidor.' });
  } finally {
    // Libera a conexão para o pool
    conn.release();
  }
});

// Rota simples para verificar se o servidor está ativo
app.get('/', (req, res) => {
  res.send('Servidor de agendamento ativo!');
});

// Inicia o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
