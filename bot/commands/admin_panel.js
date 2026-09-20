const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database');
const config = require('../config.json');
const { requireAdmin } = require('../utils/permissions');

function buildButton(key, customId) {
  const b = config.buttons[key];
  const btn = new ButtonBuilder().setCustomId(customId).setLabel(b.label).setStyle(ButtonStyle[b.style] || ButtonStyle.Secondary);
  if (b.emoji) btn.setEmoji(b.emoji);
  return btn;
}

module.exports = {
  data: new SlashCommandBuilder().setName('admin_panel').setDescription('Membuka panel admin untuk kelola produk & status toko'),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const cfg = db.getGuildConfig(interaction.guildId);
    const status = cfg?.store_status === 'CLOSE' ? 'TOKO CLOSE 🔴' : 'TOKO OPEN 🟢';

    const embed = new EmbedBuilder()
      .setColor(config.embed_color)
      .setTitle('🛠️ Panel Admin Toko')
      .setDescription('Gunakan tombol di bawah untuk mengelola produk & status toko.')
      .addFields({ name: 'Status Toko Saat Ini', value: `**${status}**` });

    const rowProduk = new ActionRowBuilder().addComponents(
      buildButton('tambahkan', 'admin_tambah_barang'),
      buildButton('restok', 'admin_restok'),
      buildButton('upload_akun', 'admin_upload_akun'),
      buildButton('ubah_harga', 'admin_ubahharga'),
      buildButton('hapus_produk', 'admin_hapus_produk'),
    );

    const rowStatus = new ActionRowBuilder().addComponents(
      buildButton('buka_toko', 'store_open'),
      buildButton('tutup_toko', 'store_close'),
    );

    // Balasan dibuat PUBLIK (bukan ephemeral) sesuai ketentuan
    await interaction.reply({ embeds: [embed], components: [rowProduk, rowStatus] });
  },
};
