// Script opcional para popular uma tabela de horários disponíveis no MySQL
// Lê o arquivo horarios.json e insere as datas/horas no banco

require('dotenv').config();     // Importa variáveis de ambiente
const fs = require('fs');       // Permite ler o arquivo JSON
const mysql = require('mysql2/promise'); // Conexão assíncrona com MySQL

async function run() {
  // Lê o arquivo horarios.json e converte em objeto JavaScript
  const data = JSON.parse(fs.readFileSync('./horarios.json', 'utf8'));

  // Cria pool de conexão com o banco
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
  const conn = await pool.getConnection();

  // Cria a tabela se não existir
  await conn.query(`
    CREATE TABLE IF NOT EXISTS available_slots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      data_slot DATE NOT NULL,
      hora_slot VARCHAR(10) NOT NULL,
      UNIQUE KEY uniq_slot (data_slot, hora_slot)
    );
  `);

  try {
    // Percorre o JSON e insere cada data e hora
    for (const date in data) {
      const horas = data[date];
      for (const h of horas) {
        // "INSERT IGNORE" evita erro se já existir
        await conn.query('INSERT IGNORE INTO available_slots (data_slot, hora_slot) VALUES (?, ?)', [date, h]);
      }
    }
    console.log('Slots importados com sucesso!');
  } catch (err) {
    console.error('Erro ao importar slots:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

// Executa a função
run();
