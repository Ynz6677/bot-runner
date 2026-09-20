const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database');
const config = require('../config.json');
const { requireAdmin } = require('../utils/permissions');
const { formatRupiah } = require('../utils/helpers');

function buildProductEmbed(product) {
  const tipeLabel = product.type === 'akun' ? 'Akun' : 'Item';
  const embed = new EmbedBuilder()
    .setColor(config.embed_color)
    .setTitle(product.name)
    .setDescription(`💰 **${formatRupiah(product.price)}**  •  📦 Stok: **${product.stock}**  •  🏷️ ${tipeLabel}`);
  if (product.image_url) embed.setThumbnail(product.image_url);
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('katalog')
    .setDescription('Menampilkan ulang sebuah produk (dengan foto) di channel ini')
    .addStringOption((o) => o.setName('nama_produk').setDescription('Nama produk (persis)').setRequired(true).setAutocomplete(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const nama = interaction.options.getString('nama_produk');
    const products = db.listProducts(interaction.guildId);
    const product = products.find((p) => p.name.toLowerCase() === nama.toLowerCase());
    if (!product) return interaction.reply({ content: '❌ Produk tidak ditemukan. Cek kembali nama produknya.', ephemeral: true });

    const publishedMsg = await interaction.channel.send({ embeds: [buildProductEmbed(product)] });
    db.setProductMessage(product.id, interaction.channel.id, publishedMsg.id);
    await interaction.reply({ content: `✅ Katalog **${product.name}** berhasil ditampilkan di channel ini.`, ephemeral: true });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const products = db.listProducts(interaction.guildId);
    const filtered = products.filter((p) => p.name.toLowerCase().includes(focused.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map((p) => ({ name: p.name, value: p.name })));
  },

  buildProductEmbed,
};
