const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, RoleSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../database');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Mengatur konfigurasi toko (role admin, channel, QRIS, metode bayar)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((o) => o.setName('channel_log').setDescription('Channel log riwayat publik').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((o) => o.setName('channel_testimoni').setDescription('Channel testimoni').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((o) => o.setName('channel_info').setDescription('Channel info_toko (broadcast)').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((o) =>
      o.setName('channel_status_pembayaran').setDescription('Channel khusus admin untuk konfirmasi Berhasil/Dibatalkan').addChannelTypes(ChannelType.GuildText).setRequired(true),
    )
    .addChannelOption((o) => o.setName('channel_vouch').setDescription('Channel tempat vouch/rating pembeli akan diposting').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addAttachmentOption((o) => o.setName('qris').setDescription('Gambar QRIS pembayaran (akan otomatis tampil di tiap channel order)').setRequired(true))
    .addStringOption((o) => o.setName('metode_pembayaran').setDescription('Teks metode pembayaran tambahan (rekening/e-wallet, dsb)').setRequired(true)),

  async execute(interaction) {
    const logChannel = interaction.options.getChannel('channel_log');
    const testimoniChannel = interaction.options.getChannel('channel_testimoni');
    const infoChannel = interaction.options.getChannel('channel_info');
    const statusChannel = interaction.options.getChannel('channel_status_pembayaran');
    const vouchChannel = interaction.options.getChannel('channel_vouch');
    const qris = interaction.options.getAttachment('qris');
    const payment = interaction.options.getString('metode_pembayaran');

    if (!qris.contentType?.startsWith('image/')) {
      return interaction.reply({ content: '❌ File QRIS harus berupa gambar (PNG/JPG).', ephemeral: true });
    }

    // Gunakan langsung URL attachment yang diupload di command ini.
    // TIDAK direpost/dipindahkan ke channel lain - QRIS tetap di tempat pertama kali diupload.
    const qrisUrl = qris.url;

    // Role Admin dipilih lewat RoleSelectMenu (bukan option command) supaya bisa pilih LEBIH DARI 1 role.
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId('select_admin_roles')
      .setPlaceholder('Pilih 1 atau lebih role Admin toko')
      .setMinValues(1)
      .setMaxValues(10);

    const reply = await interaction.reply({
      content: '👤 Terakhir, pilih role Admin toko (bisa pilih lebih dari satu):',
      components: [new ActionRowBuilder().addComponents(roleSelect)],
      ephemeral: true,
      fetchReply: true,
    });

    const rolePicked = await reply.awaitMessageComponent({ time: 60000, filter: (i) => i.user.id === interaction.user.id }).catch(() => null);
    if (!rolePicked) return interaction.editReply({ content: '⏱️ Waktu habis, `/setup` dibatalkan. Jalankan ulang command ini.', components: [] });

    const roleIds = rolePicked.values; // array of role IDs
    const roleMentions = roleIds.map((id) => `<@&${id}>`).join(', ');

    db.upsertGuildConfig({
      guild_id: interaction.guildId,
      admin_role_id: roleIds.join(','), // disimpan dipisah koma, mendukung banyak role sekaligus
      log_channel_id: logChannel.id,
      testimoni_channel_id: testimoniChannel.id,
      info_channel_id: infoChannel.id,
      admin_status_channel_id: statusChannel.id,
      qris_image_url: qrisUrl,
      payment_info: payment,
      vouch_channel_id: vouchChannel.id,
    });

    const embed = new EmbedBuilder()
      .setColor(config.embed_color)
      .setTitle('⚙️ Konfigurasi Toko Berhasil Disimpan')
      .addFields(
        { name: 'Role Admin', value: roleMentions, inline: true },
        { name: 'Channel Log Riwayat', value: `<#${logChannel.id}>`, inline: true },
        { name: 'Channel Testimoni', value: `<#${testimoniChannel.id}>`, inline: true },
        { name: 'Channel Info Toko', value: `<#${infoChannel.id}>`, inline: true },
        { name: 'Channel Status Pembayaran', value: `<#${statusChannel.id}>`, inline: true },
        { name: 'Channel Vouch', value: `<#${vouchChannel.id}>`, inline: true },
        { name: 'Metode Pembayaran', value: payment, inline: false },
      )
      .setThumbnail(qrisUrl);

    await rolePicked.update({ content: '', embeds: [embed], components: [] });
  },
};
