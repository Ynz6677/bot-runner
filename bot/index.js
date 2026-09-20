// index.js
// Entry point Bot Discord Store. Dioptimalkan untuk Termux Android:
// - Intents dibatasi seminimal mungkin (hemat bandwidth & RAM)
// - better-sqlite3 (sinkron) sebagai database, tanpa proses DB terpisah

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const db = require('./database');

const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
if (!token) {
  console.warn('[bot] TOKEN tidak ditemukan. Bot Discord tidak dijalankan. Isi TOKEN atau DISCORD_TOKEN di environment.');
  process.exit(0);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel, Partials.User],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.name) {
    client.commands.set(command.data.name, command);
  }
}

const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

db.init();

client.login(token).catch((err) => {
  console.error('[bot] Gagal login ke Discord:', err.message);
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
