const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database');
const config = require('../config.json');
const { requireAdmin } = require('../utils/permissions');
const { formatRupiah } = require('../utils/helpers');

const MAX_ROLE_REWARDS = 6;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role_rewards')
    .setDescription('Atur role otomatis berdasarkan total nominal belanja (maksimal 6 role)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Tambah/update role reward')
        .addRoleOption((o) => o.setName('role').setDescription('Role yang akan diberikan otomatis').setRequired(true))
        .addIntegerOption((o) => o.setName('minimal_belanja').setDescription('Minimal total nominal belanja (Rupiah) untuk dapat role ini').setRequired(true).setMinValue(1)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Hapus role reward')
        .addRoleOption((o) => o.setName('role').setDescription('Role yang mau dihapus dari daftar reward').setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Lihat daftar role reward yang sudah diatur')),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const role = interaction.options.getRole('role');
      const minimalBelanja = interaction.options.getInteger('minimal_belanja');

      const existing = db.listRoleRewards(interaction.guildId);
      const isUpdate = existing.some((r) => r.role_id === role.id);
      if (!isUpdate && existing.length >= MAX_ROLE_REWARDS) {
        return interaction.reply({ content: `❌ Maksimal ${MAX_ROLE_REWARDS} role reward per server. Hapus salah satu dulu lewat \`/role_rewards remove\` kalau mau ganti.`, ephemeral: true });
      }

      db.addRoleReward(interaction.guildId, role.id, minimalBelanja);
      return interaction.reply({ content: `✅ Role ${role} akan otomatis diberikan setelah total belanja mencapai **${formatRupiah(minimalBelanja)}**.`, ephemeral: true });
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role');
      const changes = db.removeRoleReward(interaction.guildId, role.id);
      return interaction.reply({ content: changes > 0 ? `✅ Role ${role} dihapus dari daftar reward.` : `⚠️ Role ${role} tidak ada di daftar reward.`, ephemeral: true });
    }

    // sub === 'list'
    const rewards = db.listRoleRewards(interaction.guildId);
    if (rewards.length === 0) {
      return interaction.reply({ content: 'ℹ️ Belum ada role reward yang diatur. Tambahkan lewat `/role_rewards add`.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(config.embed_color)
      .setTitle('🏅 Daftar Role Reward')
      .setDescription(rewards.map((r) => `<@&${r.role_id}> — minimal total belanja **${formatRupiah(r.min_spending)}**`).join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
