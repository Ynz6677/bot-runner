const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const config = require('../config.json');
const { requireAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Mengubah status toko TOKO OPEN / TOKO CLOSE')
    .addStringOption((o) =>
      o.setName('kondisi').setDescription('Status toko').setRequired(true).addChoices({ name: 'TOKO OPEN', value: 'OPEN' }, { name: 'TOKO CLOSE', value: 'CLOSE' }),
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const cfg = db.getGuildConfig(interaction.guildId);
    if (!cfg) return interaction.reply({ content: '⚠️ Jalankan `/setup` terlebih dahulu.', ephemeral: true });

    const kondisi = interaction.options.getString('kondisi');
    db.setStoreStatus(interaction.guildId, kondisi);

    const label = kondisi === 'OPEN' ? 'TOKO OPEN' : 'TOKO CLOSE';

    // Balasan command dibuat PUBLIK (bukan ephemeral) sesuai ketentuan
    await interaction.reply({ content: `✅ Status toko diubah menjadi **${label}**.` });

    if (cfg.info_channel_id) {
      const infoChannel = await interaction.guild.channels.fetch(cfg.info_channel_id).catch(() => null);
      if (infoChannel) {
        const embed = new EmbedBuilder()
          .setColor(kondisi === 'OPEN' ? config.embed_color_success : config.embed_color_danger)
          .setTitle(kondisi === 'OPEN' ? config.messages.toko_open_title : config.messages.toko_close_title)
          .setDescription(kondisi === 'OPEN' ? config.messages.toko_open_desc : config.messages.toko_close_desc)
          .setTimestamp();
        await infoChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  },
};
