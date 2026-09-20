const { SlashCommandBuilder } = require('discord.js');
const db = require('../database');
const { requireAdmin } = require('../utils/permissions');
const { voidPendingOrder } = require('../handlers/orderManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Reset/hilangkan order yang masih PENDING (order aktif yang macet)')
    .addUserOption((o) => o.setName('user').setDescription('Reset order pending milik user ini saja (kosongkan untuk reset SEMUA order pending)').setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetUser = interaction.options.getUser('user');
    const pending = db.getPendingOrders(interaction.guildId, targetUser?.id);

    if (pending.length === 0) {
      return interaction.reply({
        content: targetUser ? `ℹ️ **${targetUser.username}** tidak sedang punya order PENDING.` : 'ℹ️ Tidak ada order PENDING saat ini.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    for (const order of pending) {
      await voidPendingOrder(interaction.client, order, 'direset paksa oleh admin');
    }

    await interaction.editReply({
      content: `✅ ${pending.length} order PENDING berhasil direset. Stok dikembalikan, channel order (jika masih ada) dihapus, dan status "order aktif" pembeli terkait sudah hilang.`,
    });
  },
};
