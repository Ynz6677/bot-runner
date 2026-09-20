const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const ExcelJS = require('exceljs');
const db = require('../database');
const config = require('../config.json');
const { requireAdmin } = require('../utils/permissions');
const { formatRupiah } = require('../utils/helpers');

const GREEN = 'FF16A34A';
const GREEN_LIGHT = 'FFEAFBF1';

function buildButton(key, customId) {
  const b = config.buttons[key];
  const btn = new ButtonBuilder().setCustomId(customId).setLabel(b.label).setStyle(ButtonStyle[b.style] || ButtonStyle.Secondary);
  if (b.emoji) btn.setEmoji(b.emoji);
  return btn;
}

module.exports = {
  data: new SlashCommandBuilder().setName('transaksi').setDescription('Export riwayat transaksi ke Excel (.xlsx) lalu reset'),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const rows = db.getUnexportedLedger(interaction.guildId);
    if (rows.length === 0) {
      return interaction.reply({ content: 'ℹ️ Tidak ada data transaksi baru untuk di-export.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      buildButton('export_reset', 'transaksi_export_confirm'),
      buildButton('batal_export', 'transaksi_export_cancel'),
    );

    const reply = await interaction.reply({
      content: `⚠️ Ditemukan **${rows.length}** transaksi belum di-export. Export ke Excel sekarang? (Setelah export, data ini akan direset namun nomor urut TIDAK diulang dari awal)`,
      components: [row],
      ephemeral: true,
      fetchReply: true,
    });

    const confirmInteraction = await reply.awaitMessageComponent({ time: 30000, filter: (i) => i.user.id === interaction.user.id }).catch(() => null);
    if (!confirmInteraction) return interaction.editReply({ content: '⏱️ Waktu konfirmasi habis, dibatalkan.', components: [] });

    if (confirmInteraction.customId === 'transaksi_export_cancel') {
      return confirmInteraction.update({ content: '🚫 Export dibatalkan.', components: [] });
    }

    await confirmInteraction.deferUpdate();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Transaksi');

    // Kolom A dibuat sempit -> jadi bar aksen hijau di sisi kiri (samping)
    sheet.columns = [
      { key: 'bar', width: 3 },
      { key: 'no', width: 8 },
      { key: 'usn', width: 22 },
      { key: 'order', width: 28 },
      { key: 'id', width: 16 },
      { key: 'harga', width: 18 },
      { key: 'tanggal', width: 20 },
    ];

    // Baris 1: bar info judul (atas), warna hijau
    sheet.mergeCells('B1:G1');
    sheet.getRow(1).height = 26;
    const titleCell = sheet.getCell('B1');
    titleCell.value = `LAPORAN TRANSAKSI - ${interaction.guild.name}`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };

    // Baris 2: header kolom
    const headerRow = sheet.getRow(2);
    headerRow.values = ['', 'NO', 'USN', 'ORDER', 'ID', 'HARGA', 'TANGGAL'];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      } else {
        cell.font = { bold: true, color: { argb: 'FF14532D' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } };
        cell.border = { bottom: { style: 'thin', color: { argb: GREEN } } };
      }
    });

    // Baris data (ID = order_code / ID Transaksi WX..., BUKAN Discord user ID)
    let grandTotal = 0;
    for (const r of rows) {
      const harga = r.total_price || 0;
      grandTotal += harga;
      const dataRow = sheet.addRow({ bar: '', no: r.no, usn: r.usn, order: r.order_name, id: r.order_code || '-', harga: formatRupiah(harga), tanggal: r.tanggal });
      dataRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    }

    // Baris TOTAL KESELURUHAN di paling bawah
    const totalRowNumber = 2 + rows.length + 1;
    sheet.mergeCells(`B${totalRowNumber}:E${totalRowNumber}`);
    const totalLabelCell = sheet.getCell(`B${totalRowNumber}`);
    totalLabelCell.value = 'TOTAL KESELURUHAN';
    totalLabelCell.font = { bold: true, color: { argb: 'FF14532D' } };
    totalLabelCell.alignment = { horizontal: 'right' };
    totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } };

    const totalValueCell = sheet.getCell(`F${totalRowNumber}`);
    totalValueCell.value = formatRupiah(grandTotal);
    totalValueCell.font = { bold: true, size: 13, color: { argb: 'FF14532D' } };
    totalValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } };

    sheet.getCell(`G${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } };
    sheet.getCell(`A${totalRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };

    sheet.views = [{ state: 'frozen', ySplit: 2 }];
    sheet.autoFilter = { from: 'B2', to: 'G2' };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `transaksi_${Date.now()}.xlsx`;
    const attachment = new AttachmentBuilder(Buffer.from(buffer), { name: filename });

    db.markLedgerExported(interaction.guildId, rows.map((r) => r.no));

    await interaction.editReply({
      content: `✅ ${rows.length} transaksi berhasil di-export & direset (nomor urut tetap lanjut dari #${rows[rows.length - 1].no}). Total keseluruhan: **${formatRupiah(grandTotal)}**.`,
      components: [],
    });
    await interaction.followUp({ files: [attachment], ephemeral: true });
  },
};
