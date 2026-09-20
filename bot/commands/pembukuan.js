const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const config = require('../config.json');
const { requireAdmin } = require('../utils/permissions');
const { formatRupiah } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder().setName('pembukuan').setDescription('Menampilkan ringkasan omset & transaksi toko'),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const data = db.getPembukuan(interaction.guildId);
    const embed = new EmbedBuilder()
      .setColor(config.embed_color)
      .setTitle('📊 Pembukuan Toko')
      .addFields(
        { name: 'Total Omset', value: formatRupiah(data.omset), inline: true },
        { name: 'Transaksi Sukses', value: String(data.sukses), inline: true },
        { name: 'Transaksi Gagal/Batal', value: String(data.gagal), inline: true },
        { name: 'Produk Terlaris', value: data.terlaris ? `${data.terlaris.product_name} (${data.terlaris.total_qty}x terjual)` : '-', inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
