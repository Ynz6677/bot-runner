const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const db = require('../database');
const config = require('../config.json');
const { requireAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order')
    .setDescription('Order barang dari toko')
    .addSubcommand((sub) => sub.setName('place').setDescription('Membuat & memasang tombol Order (khusus admin)')),

  async execute(interaction) {
    if (interaction.options.getSubcommand() !== 'place') return;
    if (!(await requireAdmin(interaction))) return;

    // ---------- Step 1: pilih kategori channel (tempat channel order baru akan dibuat) ----------
    const categorySelect = new ChannelSelectMenuBuilder()
      .setCustomId('select_panel_category')
      .setPlaceholder('Pilih kategori channel order')
      .addChannelTypes(ChannelType.GuildCategory);

    const reply = await interaction.reply({
      content: '1️⃣ Pilih kategori channel (folder) tempat channel order baru akan dibuat:',
      components: [new ActionRowBuilder().addComponents(categorySelect)],
      ephemeral: true,
      fetchReply: true,
    });

    const categoryPicked = await reply.awaitMessageComponent({ time: 60000, filter: (i) => i.user.id === interaction.user.id }).catch(() => null);
    if (!categoryPicked) return;
    const categoryId = categoryPicked.values[0];

    // ---------- Step 2: pilih channel tempat pesan + tombol akan dipasang ----------
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId('select_panel_channel')
      .setPlaceholder('Pilih channel untuk memasang tombol')
      .addChannelTypes(ChannelType.GuildText);

    await categoryPicked.update({
      content: '2️⃣ Pilih channel tempat pesan & tombol ini akan dipasang:',
      components: [new ActionRowBuilder().addComponents(channelSelect)],
    });

    const channelPicked = await reply.awaitMessageComponent({ time: 60000, filter: (i) => i.user.id === interaction.user.id }).catch(() => null);
    if (!channelPicked) return;
    const targetChannelId = channelPicked.values[0];

    // ---------- Step 3: Modal - pesan custom (embed) + teks tombol ----------
    const modal = new ModalBuilder().setCustomId('modal_order_panel').setTitle('Pesan & Tombol');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('judul').setLabel('Judul Pesan (embed)').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('isi').setLabel('Isi Pesan (embed)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('teks_tombol').setLabel('Tulisan pada Tombol').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80),
      ),
    );
    await channelPicked.showModal(modal);

    const submitted = await channelPicked.awaitModalSubmit({ time: 180000, filter: (i) => i.customId === 'modal_order_panel' }).catch(() => null);
    if (!submitted) return;

    const judul = submitted.fields.getTextInputValue('judul').trim();
    const isi = submitted.fields.getTextInputValue('isi').trim();
    const teksTombol = submitted.fields.getTextInputValue('teks_tombol').trim();

    const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
    if (!targetChannel) {
      return submitted.reply({ content: '❌ Channel tujuan tidak ditemukan.', ephemeral: true });
    }

    // Simpan konfigurasi panel (kategori channel order) ke database supaya tombolnya "ingat" pengaturannya
    const panelId = db.createOrderPanel({
      guildId: interaction.guildId,
      type: null,
      categoryId,
      channelId: targetChannelId,
      buttonLabel: teksTombol,
      embedTitle: judul,
      embedDescription: isi,
    });

    const embed = new EmbedBuilder().setColor(config.embed_color).setTitle(judul).setDescription(isi);
    const button = new ButtonBuilder().setCustomId(`order_panel_${panelId}`).setLabel(teksTombol).setStyle(ButtonStyle.Success).setEmoji('🛒');

    const panelMsg = await targetChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
    db.setOrderPanelMessage(panelId, panelMsg.id);

    await submitted.reply({ content: `✅ Tombol **${teksTombol}** berhasil dipasang di <#${targetChannel.id}>.`, ephemeral: true });
  },
};
