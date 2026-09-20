// deploy-commands.js
// Jalankan sekali (atau setiap kali ada command baru/berubah): node deploy-commands.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data) commands.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`[deploy] Mendaftarkan ${commands.length} slash command...`);

    if (process.env.GUILD_ID) {
      // Deploy ke 1 guild -> update INSTAN, cocok untuk development di Termux
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
      console.log('[deploy] Berhasil! Command ter-deploy ke guild testing (instan).');
    } else {
      // Deploy global -> propagasi ke semua server bisa sampai ~1 jam
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
      console.log('[deploy] Berhasil! Command ter-deploy secara global (bisa butuh waktu propagasi).');
    }
  } catch (err) {
    console.error('[deploy] Gagal deploy command:', err);
  }
})();
