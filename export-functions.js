        // ===================================================================
        // Helper: susun baris Laporan Harian lengkap dengan Material Masuk & Keluar per tanggal
        function buildLapHarianExportRows() {
            const projLh = lapHarianData.filter(l => {
                const rab = rabData.find(r => r.id == l.pekerjaanId);
                return rab && rab.projId === activeProjectId;
            });
            const projMatMasuk = materialMasukData.filter(m => m.projId === activeProjectId);
            const projMatKeluar = materialKeluarData.filter(m => m.projId === activeProjectId);

            return projLh.map(item => {
                const rab = rabData.find(r => r.id == item.pekerjaanId);
                const dateMatMasuk = projMatMasuk.filter(m => m.tanggal === item.tanggal);
                const dateMatKeluar = projMatKeluar.filter(m => m.tanggal === item.tanggal);
                const matMasukText = dateMatMasuk.length > 0 ? dateMatMasuk.map(m => `${formatMaterialLabel(m)}: ${formatAngka(m.volume)} ${m.satuan}`).join(', ') : '-';
                const matKeluarText = dateMatKeluar.length > 0 ? dateMatKeluar.map(m => `${formatMaterialLabel(m)}: ${formatAngka(m.volume)} ${m.satuan}`).join(', ') : '-';
                const kn = findLhKendalaByDate(item.tanggal);
                return {
                    Tanggal: item.tanggal,
                    'Item Pekerjaan': rab ? (rab.sub + (rab.rincian ? ` - ${rab.rincian}` : '')) : 'Pekerjaan',
                    Volume: item.volume,
                    Satuan: rab ? rab.satuan : '',
                    Tenaga: item.tenaga || 'Standar',
                    'Jam Aktif': item.jamAktif || 8,
                    'Jam Lembur': item.jamLembur || 0,
                    'Cuaca Pagi': item.cuacaPagi || 'Cerah',
                    'Cuaca Siang': item.cuacaSiang || 'Cerah',
                    'Cuaca Sore': item.cuacaSore || 'Cerah',
                    'Cuaca Malam': item.cuacaMalam || 'Cerah',
                    'Material Masuk': matMasukText,
                    'Material Keluar': matKeluarText,
                    Kendala: (kn && kn.kendala) ? kn.kendala : '-',
                    Notulen: (kn && kn.notulen) ? kn.notulen : '-'
                };
            });
        }

        // ===================================================================
        // BUILDER EXPORT: KEBUTUHAN, ORDER, MASUK, KELUAR, SISA MATERIAL
        // Setiap builder mengembalikan { headers, rows } di mana rows berisi
        // { cells: [...], kind: 'data' | 'subtotal' | 'total' } — dipakai bersama
        // oleh Export Excel & Export PDF agar hasilnya selalu SAMA PERSIS dengan
        // daftar yang tampil di halaman (termasuk urutan tanggal & subtotal).
        // ===================================================================
        function buildKebutuhanExportRows() {
            const headers = ['Kode', 'Nama Material', 'Dimensi', 'Spesifikasi', 'Satuan', 'Volume', 'Harga Satuan', 'Total Harga', 'Nama Toko', 'Kontak Toko', 'PIC', 'Status Order', '% Sudah Diorder'];
            const data = kebutuhanMatData.filter(d => d.projId === activeProjectId);
            // Kelompokkan: BELUM DI-ORDER paling atas (paling butuh tindak lanjut), lalu ORDER SEBAGIAN, lalu
            // SUDAH DI-ORDER (100%) - supaya di Excel/PDF/WA pun langsung ketahuan material mana yang belum
            // dipesan tanpa perlu menyisir satu-satu. Di dalam tiap kelompok, urutan mengikuti waktu input.
            const withStatus = data.map(item => {
                const sudahDipesan = getKebutuhanOrderedTotal(item.id, null);
                const persenDipesan = item.volume > 0 ? Math.min(100, (sudahDipesan / item.volume) * 100) : 0;
                const statusGroup = persenDipesan <= 0 ? 0 : (persenDipesan >= 100 ? 2 : 1);
                return { item, persenDipesan, statusGroup };
            }).sort((a, b) => a.statusGroup - b.statusGroup || a.item.id - b.item.id);

            const groupLabel = { 0: 'BELUM DI-ORDER', 1: 'SEDANG ORDER SEBAGIAN', 2: 'SUDAH DI-ORDER (100%)' };
            const rows = [];
            let total = 0;
            let currentGroup = null;
            withStatus.forEach(({ item, persenDipesan, statusGroup }) => {
                if (statusGroup !== currentGroup) {
                    const count = withStatus.filter(x => x.statusGroup === statusGroup).length;
                    rows.push({ kind: 'group', cells: [`=== ${groupLabel[statusGroup]} (${count} item) ===`, '', '', '', '', '', '', '', '', '', '', '', ''] });
                    currentGroup = statusGroup;
                }
                const totalItem = (item.volume || 0) * (item.harga || 0);
                total += totalItem;
                const statusLabel = persenDipesan <= 0 ? 'Belum Order' : (persenDipesan >= 100 ? 'Sudah Order (100%)' : 'Order Sebagian');
                rows.push({
                    kind: 'data',
                    cells: [item.kode || '-', item.nama, item.dimensi || '-', item.spesifikasi || '-', item.satuan, item.volume, formatRupiah(item.harga), formatRupiah(totalItem), item.supplier || '-', item.kontak || '-', item.pic || '-', statusLabel, `${formatAngka(persenDipesan)}%`]
                });
            });
            rows.push({ kind: 'total', cells: ['TOTAL NILAI KEBUTUHAN MATERIAL', '', '', '', '', '', '', formatRupiah(total), '', '', '', '', ''] });
            return { title: 'Rencana Kebutuhan Material', headers, rows };
        }

        function buildOrderExportRows() {
            const headers = ['Tanggal PO', 'Nama Material', 'Dimensi', 'Spesifikasi', 'Keterangan PO (Tahap)', 'Volume Order', 'Total Nilai', 'Estimasi Tiba', 'Supplier', 'Kontak Toko', 'PIC', 'Sudah Masuk', 'Sisa Belum Masuk', '% Sudah Masuk', 'Status'];
            const data = materialOrderData.filter(d => d.projId === activeProjectId);
            const sortedData = [...data].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
            const rows = [];
            let totalNilaiOrder = 0;
            let dailyVolumeMap = {};
            let dailyNilai = 0;
            let currentTanggal = null;

            const flushDaily = (tgl) => {
                if (tgl === null) return;
                const volText = Object.entries(dailyVolumeMap).map(([sat, vol]) => `${vol} ${sat}`).join(', ') || '-';
                rows.push({ kind: 'subtotal', cells: [`Total Diorder Tanggal ${tgl || '-'}`, '', '', '', '', volText, formatRupiah(dailyNilai), '', '', '', '', '', '', '', ''] });
                dailyVolumeMap = {};
                dailyNilai = 0;
            };

            sortedData.forEach(item => {
                if (currentTanggal !== null && item.tanggal !== currentTanggal) flushDaily(currentTanggal);
                currentTanggal = item.tanggal;

                const st = getOrderMasukStatus(item);
                const tahap = getOrderTahapKe(item);
                const totalItem = (item.volume || 0) * (item.harga || 0);
                totalNilaiOrder += totalItem;
                dailyNilai += totalItem;
                dailyVolumeMap[item.satuan] = (dailyVolumeMap[item.satuan] || 0) + (item.volume || 0);
                const statusText = st.persen >= 100 ? 'Sudah Masuk' : (st.persen > 0 ? 'Belum 100%' : 'Belum Masuk');

                rows.push({
                    kind: 'data',
                    cells: [
                        item.tanggal, item.nama, item.dimensi || '-', item.spesifikasi || '-',
                        `Tahap ${tahap.ke} dari ${tahap.total}${item.ket ? ' - ' + item.ket : ''}`,
                        `${formatAngka(item.volume)} ${item.satuan}`, formatRupiah(totalItem), item.estimasiTiba || '-', item.supplier,
                        item.kontak || '-', item.pic || '-',
                        `${formatAngka(st.totalMasuk)} ${item.satuan}`, `${formatAngka(st.sisa)} ${item.satuan}`, `${st.persen.toFixed(1)}%`, statusText
                    ]
                });
            });
            flushDaily(currentTanggal);

            const activeProj = projects.find(p => p.id === activeProjectId);
            const rentangProyek = (sortedData.length && activeProj && activeProj.tglMulai && activeProj.tglSelesai)
                ? `${activeProj.tglMulai} s/d ${activeProj.tglSelesai}`
                : (sortedData.length ? `${sortedData[0].tanggal || '-'} s/d ${sortedData[sortedData.length - 1].tanggal || '-'}` : '-');
            rows.push({ kind: 'total', cells: [`TOTAL KESELURUHAN ORDER MATERIAL (${rentangProyek})`, '', '', '', '', '', formatRupiah(totalNilaiOrder), '', '', '', '', '', '', '', ''] });
            return { title: 'Pemesanan Material (Material Order)', headers, rows };
        }

        function buildMasukExportRows() {
            const headers = ['Tanggal', 'No. Nota / SJ', 'Nama Material', 'Dimensi', 'Spesifikasi', 'Volume Masuk', 'Total Nilai', 'Supplier', 'Kontak Toko', 'PIC'];
            const data = materialMasukData.filter(d => d.projId === activeProjectId);
            const sortedData = [...data].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
            const rows = [];
            let totalNilaiMasuk = 0;
            sortedData.forEach(item => {
                const hargaSatuan = getHargaSatuan(item.nama, item.dimensi, item.spesifikasi);
                const totalItem = (item.volume || 0) * hargaSatuan;
                totalNilaiMasuk += totalItem;
                const relatedOrder = materialOrderData.find(o => o.id == item.orderId);
                rows.push({
                    kind: 'data',
                    cells: [item.tanggal, item.nota, item.nama, item.dimensi || '-', item.spesifikasi || '-', `${formatAngka(item.volume)} ${item.satuan}`, hargaSatuan ? formatRupiah(totalItem) : '-', item.supplier, (relatedOrder && relatedOrder.kontak) || '-', (relatedOrder && relatedOrder.pic) || '-']
                });
            });
            rows.push({ kind: 'total', cells: ['TOTAL NILAI MATERIAL MASUK', '', '', '', '', '', formatRupiah(totalNilaiMasuk), '', '', ''] });
            return { title: 'Penerimaan Material Masuk', headers, rows };
        }

        function buildKeluarExportRows() {
            const headers = ['Tanggal', 'Nama Material', 'Dimensi', 'Spesifikasi', 'Volume Keluar', 'Total Nilai', 'Penerima', 'Untuk Pekerjaan'];
            const data = materialKeluarData.filter(d => d.projId === activeProjectId);
            const sortedData = [...data].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
            const rows = [];
            let totalNilaiKeluar = 0;
            sortedData.forEach(item => {
                const hargaSatuan = getHargaSatuan(item.nama, item.dimensi, item.spesifikasi);
                const totalItem = (item.volume || 0) * hargaSatuan;
                totalNilaiKeluar += totalItem;
                rows.push({
                    kind: 'data',
                    cells: [item.tanggal, item.nama, item.dimensi || '-', item.spesifikasi || '-', `${formatAngka(item.volume)} ${item.satuan}`, hargaSatuan ? formatRupiah(totalItem) : '-', item.penerima || '-', item.pekerjaan]
                });
            });
            rows.push({ kind: 'total', cells: ['TOTAL NILAI MATERIAL KELUAR', '', '', '', '', formatRupiah(totalNilaiKeluar), '', ''] });
            return { title: 'Pengeluaran Material Lapangan', headers, rows };
        }

        function buildSisaExportRows() {
            const headers = ['Nama Material', 'Dimensi', 'Spesifikasi', 'Satuan', 'Total Masuk', 'Total Keluar', 'Stok Sisa', 'Nilai Stok Sisa', 'Status Stok'];
            const sisaList = [...getMaterialSisaList()].sort((a, b) => (a.tanggalAwal || '').localeCompare(b.tanggalAwal || '') || a.nama.localeCompare(b.nama));
            const rows = [];
            let totalNilaiSisa = 0;
            sisaList.forEach(s => {
                const hargaSatuan = getHargaSatuan(s.nama, s.dimensi, s.spesifikasi);
                const nilaiSisa = (s.sisa > 0 ? s.sisa : 0) * hargaSatuan;
                totalNilaiSisa += nilaiSisa;
                rows.push({
                    kind: 'data',
                    cells: [s.nama, s.dimensi || '-', s.spesifikasi || '-', s.satuan, s.masuk, s.keluar, `${s.sisa} ${s.satuan}`, hargaSatuan ? formatRupiah(nilaiSisa) : '-', s.sisa <= 0 ? 'Habis' : 'Aman / Tersedia']
                });
            });
            rows.push({ kind: 'total', cells: ['TOTAL NILAI STOK SISA', '', '', '', '', '', '', formatRupiah(totalNilaiSisa), ''] });
            return { title: 'Stok Sisa Material (Warehouse Inventory)', headers, rows };
        }

        function getMaterialExportBuilder(type) {
            const map = {
                'mat-kebutuhan': buildKebutuhanExportRows,
                'mat-order': buildOrderExportRows,
                'mat-masuk': buildMasukExportRows,
                'mat-keluar': buildKeluarExportRows,
                'mat-sisa': buildSisaExportRows
            };
            return map[type] ? map[type]() : null;
        }

        // Hitung lebar kolom otomatis (untuk Excel) berdasarkan panjang konten terpanjang per kolom
        function computeExportColWidths(headers, rows) {
            return headers.map((h, idx) => {
                let maxLen = (h || '').toString().length;
                rows.forEach(r => {
                    const v = (r.cells[idx] ?? '').toString();
                    if (v.length > maxLen) maxLen = v.length;
                });
                return { wch: Math.min(Math.max(maxLen + 2, 10), 42) };
            });
        }

        // Escape teks agar aman ditampilkan di dalam tabel HTML (untuk PDF)
        function escapeExportHtml(str) {
            return (str ?? '').toString()
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        // Render array headers + rows (dari builder di atas) menjadi tabel HTML rapi untuk laporan PDF
        function renderMaterialExportTableHtml(headers, rows) {
            if (!rows.length) {
                return `<p style="font-size:11px; color:#555;">Belum ada data untuk ditampilkan.</p>`;
            }
            const theadHtml = `<tr>${headers.map(h => `<th style="background:#1c2541; color:#fff; padding:6px; text-align:left; border:1px solid #94a3b8;">${escapeExportHtml(h)}</th>`).join('')}</tr>`;
            const tbodyHtml = rows.map(r => {
                let rowStyle = '';
                let cellStyle = 'padding:5px 6px; border:1px solid #cbd5e1;';
                if (r.kind === 'subtotal') { rowStyle = 'background:#eef2f7; font-weight:bold;'; }
                else if (r.kind === 'total') { rowStyle = 'background:#dbeafe; font-weight:bold;'; }
                return `<tr style="${rowStyle}">${r.cells.map(c => `<td style="${cellStyle}">${escapeExportHtml(c === '' || c === undefined || c === null ? '' : c)}</td>`).join('')}</tr>`;
            }).join('');
            return `
                <table cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse; font-size:10px; margin-top:8px;">
                    <thead>${theadHtml}</thead>
                    <tbody>${tbodyHtml}</tbody>
                </table>
            `;
        }

        // ===================================================================
        // MESIN EXPORT PROFESIONAL (dipakai bersama oleh SEMUA export Excel & PDF
        // di seluruh halaman) - satu sumber data yang sama dipakai baik untuk Excel
        // maupun PDF, supaya hasil keduanya selalu identik dan sesuai isi halamannya.
        // ===================================================================

        function getExportProjectMeta() {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek', lokasi: '-' };
            return {
                proj,
                namaProyek: proj.nama || '-',
                lokasi: proj.lokasi || '-',
                logo: proj.logo || null,
                tanggalCetak: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
            };
        }

        // --------- EXCEL: kop surat + info proyek + tabel bergaya + rumus asli + header berulang ---------
        // columns: [{ header, key, formula?: (row, excelRowNum, ctx) => 'string formula (tanpa =)' }]
        // rows: array data polos { key: value, ... }
        // opts: { totalRow: { label, sumKeys: [...] }, subtitle: 'Periode: ...' }
        // Kelompokkan rows berdasarkan field tertentu (mis. 'div'), urut sesuai kemunculan pertama tiap
        // kelompok - dipakai utk laporan yang perlu subtotal per divisi (RAB, Laporan Mingguan/Bulanan,
        // Time Schedule) sebelum baris TOTAL BESAR di paling akhir.
        function groupRowsByKey(rows, key) {
            const groups = [];
            const map = new Map();
            rows.forEach((r, i) => {
                const k = (r[key] || '(Tanpa Divisi)').toString();
                if (!map.has(k)) { const g = { key: k, indices: [] }; map.set(k, g); groups.push(g); }
                map.get(k).indices.push(i);
            });
            return groups;
        }

        function exportProfessionalExcel(title, columns, rows, filename, opts = {}) {
            const meta = getExportProjectMeta();
            const ncol = columns.length;
            const aoa = [];
            aoa.push([title.toUpperCase()]);
            aoa.push([`Proyek: ${meta.namaProyek}`]);
            aoa.push([`Lokasi: ${meta.lokasi}    |    Tanggal Cetak: ${meta.tanggalCetak}${opts.subtitle ? '    |    ' + opts.subtitle : ''}`]);
            aoa.push([]);
            const headerRowIdx = aoa.length; // 0-based
            aoa.push(columns.map(c => c.header));
            const dataStartRowIdx = aoa.length; // 0-based

            const colLetter = (key) => XLSX.utils.encode_col(columns.findIndex(c => c.key === key));
            // ctx.dataStartExcelRow/dataEndExcelRow SENGAJA dihitung dari SELURUH baris data sebelum baris
            // subtotal disisipkan - supaya rumus seperti Bobot(%) tetap merujuk ke total KESELURUHAN proyek
            // (bukan cuma satu divisi), walau nanti posisi barisnya bergeser oleh baris subtotal per divisi.
            const ctx = { dataStartExcelRow: dataStartRowIdx + 1, dataEndExcelRow: dataStartRowIdx + rows.length, colLetter };

            // Susun baris: kalau opts.groupByDivision aktif, sisipkan baris SUBTOTAL setiap kali kelompok
            // (mis. Divisi) berganti; rowExcelIndex melacak baris ke berapa (0-based) tiap item rows[i]
            // berakhir ditulis, dan subtotalPlans menyimpan rentang baris yg perlu dijumlah utk tiap subtotal.
            const rowExcelIndex = [];
            const subtotalPlans = []; // { rowIdx, label, firstDataRow, lastDataRow }
            if (opts.groupByDivision && rows.length > 0) {
                const groups = groupRowsByKey(rows, opts.groupKey || 'div');
                groups.forEach(g => {
                    g.indices.forEach(i => {
                        rowExcelIndex[i] = aoa.length;
                        aoa.push(columns.map(c => (rows[i][c.key] !== undefined && rows[i][c.key] !== null) ? rows[i][c.key] : ''));
                    });
                    const subRowIdx = aoa.length;
                    aoa.push(columns.map((c, ci) => ci === 0 ? `Subtotal: ${g.key}` : ''));
                    subtotalPlans.push({
                        rowIdx: subRowIdx, label: `Subtotal: ${g.key}`,
                        firstDataRow: rowExcelIndex[g.indices[0]] + 1,
                        lastDataRow: rowExcelIndex[g.indices[g.indices.length - 1]] + 1
                    });
                });
            } else {
                rows.forEach((row, i) => {
                    rowExcelIndex[i] = aoa.length;
                    aoa.push(columns.map(c => (row[c.key] !== undefined && row[c.key] !== null) ? row[c.key] : ''));
                });
            }

            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, ncol - 1) } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, ncol - 1) } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(0, ncol - 1) } }
            ];

            // Terapkan rumus Excel ASLI (bukan angka statis) pada kolom yang didefinisikan formula-nya -
            // memakai rowExcelIndex supaya tetap tepat sasaran meski posisinya bergeser oleh baris subtotal.
            columns.forEach((col, ci) => {
                if (typeof col.formula !== 'function') return;
                rows.forEach((row, ri) => {
                    const excelRowNum = rowExcelIndex[ri] + 1; // 1-based, dipakai di string formula (A1 notation)
                    const f = col.formula(row, excelRowNum, ctx);
                    if (f) ws[XLSX.utils.encode_cell({ r: rowExcelIndex[ri], c: ci })] = { t: 'n', f: f };
                });
            });

            // Rumus SUM utk tiap baris subtotal per divisi (hanya menjumlah rentang baris divisi itu sendiri)
            subtotalPlans.forEach(sp => {
                columns.forEach((c, ci) => {
                    if (!opts.totalRow || !opts.totalRow.sumKeys || !opts.totalRow.sumKeys.includes(c.key)) return;
                    const L = XLSX.utils.encode_col(ci);
                    ws[XLSX.utils.encode_cell({ r: sp.rowIdx, c: ci })] = { t: 'n', f: `SUM(${L}${sp.firstDataRow}:${L}${sp.lastDataRow})` };
                });
                for (let c = 0; c < ncol; c++) {
                    const ref = XLSX.utils.encode_cell({ r: sp.rowIdx, c });
                    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
                    ws[ref].s = { font: { bold: true, italic: true }, fill: { fgColor: { rgb: 'E2E8F0' } }, border: allThinBorder() };
                }
            });

            // Baris TOTAL BESAR - SELALU di baris PALING TERAKHIR tabel (bukan diulang-ulang), menjumlah
            // seluruh baris data asli (rowExcelIndex), bukan menjumlah subtotal-subtotal (menghindari dobel).
            let lastRowIdx = aoa.length - 1;
            if (opts.totalRow && rows.length > 0) {
                const totalRowIdx = aoa.length;
                aoa.push(columns.map((c, ci) => ci === 0 ? (opts.totalRow.label || 'TOTAL') : ''));
                XLSX.utils.sheet_add_aoa(ws, [aoa[totalRowIdx]], { origin: totalRowIdx });
                columns.forEach((c, ci) => {
                    if (!opts.totalRow.sumKeys || !opts.totalRow.sumKeys.includes(c.key)) return;
                    const L = XLSX.utils.encode_col(ci);
                    // Jumlahkan tiap baris data satu-satu (bukan 1 rentang utuh), karena posisi baris data bisa
                    // tidak berurutan sempurna kalau ada baris subtotal di sela-selanya.
                    const terms = rows.map((r, ri) => `${L}${rowExcelIndex[ri] + 1}`).join('+');
                    ws[XLSX.utils.encode_cell({ r: totalRowIdx, c: ci })] = { t: 'n', f: terms || '0' };
                });
                lastRowIdx = totalRowIdx;
                for (let c = 0; c < ncol; c++) {
                    const ref = XLSX.utils.encode_cell({ r: totalRowIdx, c });
                    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
                    ws[ref].s = { font: { bold: true }, fill: { fgColor: { rgb: 'D9E2F3' } }, border: allThinBorder() };
                }
            }
            ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRowIdx, c: Math.max(0, ncol - 1) } });

            // Styling: judul tebal besar, header tabel BOLD + BERWARNA + rata tengah, seluruh sel data diberi border tipis
            const titleRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
            if (ws[titleRef]) ws[titleRef].s = { font: { bold: true, sz: 14, color: { rgb: '0B132B' } } };
            for (let c = 0; c < ncol; c++) {
                const ref = XLSX.utils.encode_cell({ r: headerRowIdx, c });
                if (ws[ref]) ws[ref].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: allThinBorder() };
            }
            rows.forEach((row, ri) => {
                for (let c = 0; c < ncol; c++) {
                    const ref = XLSX.utils.encode_cell({ r: rowExcelIndex[ri], c });
                    if (!ws[ref]) ws[ref] = { t: 's', v: '' };
                    ws[ref].s = { border: allThinBorder(), alignment: { vertical: 'top', wrapText: true } };
                }
            });

            // Lebar kolom otomatis menyesuaikan isi terpanjang (supaya rapi, tidak terpotong/terhambur),
            // kecuali kolom itu sendiri sudah menentukan lebar tetapnya sendiri (col.width) - dipakai utk
            // kolom sempit seperti tanggal 1-31 pada rekap Daftar Hadir.
            ws['!cols'] = columns.map(c => {
                if (c.width) return { wch: c.width };
                const headerLen = (c.header || '').toString().length;
                const maxDataLen = rows.reduce((m, r) => Math.max(m, String(r[c.key] ?? '').length), 0);
                return { wch: Math.max(10, Math.min(45, Math.max(headerLen, maxDataLen) + 3)) };
            });
            ws['!rows'] = aoa.map((_, i) => i === headerRowIdx ? { hpt: 26 } : undefined);

            const wb = XLSX.utils.book_new();
            const sheetName = title.substring(0, 31).replace(/[\\\/\?\*\[\]:]/g, ' ');
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            // Baris header tabel (bukan baris 1-4 kop) diset sebagai "Print Titles" - supaya kalau file Excel
            // ini dicetak/print langsung dari Excel dan datanya lebih dari 1 halaman, kepala tabelnya ikut
            // muncul ulang otomatis di setiap halaman cetak berikutnya.
            wb.Workbook = wb.Workbook || {};
            wb.Workbook.Names = wb.Workbook.Names || [];
            wb.Workbook.Names.push({ Sheet: 0, Name: '_xlnm.Print_Titles', Ref: `'${sheetName}'!$1:$${headerRowIdx + 1}` });

            try { XLSX.writeFile(wb, filename, { cellStyles: true }); }
            catch (e) { XLSX.writeFile(wb, filename); } // fallback kalau versi library tidak dukung styling, data tetap lengkap
        }

        function allThinBorder() {
            const b = { style: 'thin', color: { rgb: 'B7C0CE' } };
            return { top: b, bottom: b, left: b, right: b };
        }

        // --------- PDF: kop surat + info proyek + tabel bergaya, header tabel berulang tiap halaman cetak ---------
        // Format 1 nilai sel untuk ditampilkan di PDF - dibaca dari NAMA KOLOM (key) supaya format angkanya
        // masuk akal (uang pakai "Rp", bobot/persen pakai "%", angka lain dirapikan) tanpa perlu menulis
        // ulang aturan format di setiap dataset.
        function formatPdfCellValue(key, value) {
            if (value === undefined || value === null || value === '') return '-';
            if (typeof value !== 'number') return String(value);
            const k = (key || '').toLowerCase();
            if (k.includes('harga') || k.includes('uang') || k.includes('nilai') || k === 'total') return formatRupiah(value);
            if (k.includes('bobot') || k.includes('persen')) return (value >= 0 ? '' : '') + value.toFixed(2) + '%';
            return formatAngka(value);
        }

        // Gambar KOP surat (logo + nama proyek + lokasi + tanggal cetak + judul laporan) di bagian atas
        // halaman PERTAMA saja - TIDAK diulang di halaman berikutnya (supaya tidak tumpang tindih dengan
        // kepala tabel). Kepala tabel sendiri (opsi "head" AutoTable) tetap otomatis berulang di SETIAP
        // halaman baru - itu sudah perilaku bawaan AutoTable, tidak perlu digambar manual lagi di sini.
        function drawPdfKop(doc, meta, title, opts) {
            const pageWidth = doc.internal.pageSize.getWidth();
            const marginX = 10;
            let y = 12;
            const textX = meta.logo ? marginX + 20 : marginX;
            if (meta.logo) {
                try {
                    let fmt = 'JPEG';
                    if (meta.logo.includes('image/png')) fmt = 'PNG';
                    else if (meta.logo.includes('image/webp')) fmt = 'WEBP';
                    doc.addImage(meta.logo, fmt, marginX, y - 8, 16, 16);
                } catch (e) { /* format logo tidak didukung, lewati saja */ }
            }
            doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(11, 19, 43);
            doc.text(meta.namaProyek, textX, y);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(71, 85, 105);
            doc.text(`Lokasi: ${meta.lokasi}`, textX, y + 5);
            doc.text(`Dicetak dari ProConstruct ERP v3.0  -  ${meta.tanggalCetak}${opts.subtitle ? '  -  ' + opts.subtitle : ''}`, textX, y + 9.5);
            doc.setDrawColor(31, 54, 100); doc.setLineWidth(0.4);
            doc.line(marginX, y + 12.5, pageWidth - marginX, y + 12.5);
            doc.setFillColor(31, 54, 100);
            doc.rect(marginX, y + 15.5, pageWidth - marginX * 2, 7, 'F');
            doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
            doc.text(title.toUpperCase(), pageWidth / 2, y + 20.2, { align: 'center' });
            return y + 27; // tinggi total kop (mm) - dipakai sbg jarak mulai tabel di halaman pertama
        }

        // PDF dibangun LANGSUNG DARI DATA (columns/rows - sumber yang SAMA PERSIS dengan export Excel),
        // memakai jsPDF + AutoTable - BUKAN screenshot html2canvas seperti sebelumnya. Keuntungannya: teks di
        // PDF adalah teks ASLI (bisa di-select/copy/cari), ukuran file jauh lebih kecil, tata letak tabel
        // dihitung presisi oleh AutoTable (bukan hasil potong-gambar), dan kepala tabel otomatis berulang di
        // setiap halaman baru bawaan AutoTable sendiri - jadi tidak mungkin lagi hasilnya blank/kosong seperti
        // masalah screenshot kemarin, karena tidak ada proses "memotret" apapun di sini.
        function exportProfessionalPdf(title, columns, rows, filename, opts = {}) {
            const meta = getExportProjectMeta();
            const orientation = opts.orientation || 'portrait';
            const doc = new jspdf.jsPDF({ orientation, unit: 'mm', format: 'a4' });

            // Kop surat (logo, nama proyek, judul laporan) HANYA digambar SEKALI di halaman pertama - TIDAK
            // diulang di halaman berikutnya (itu yang menyebabkan tumpang tindih dengan kepala tabel
            // sebelumnya). Di halaman kedua dst, yang otomatis berulang HANYA kepala tabelnya sendiri (opsi
            // "head" AutoTable di bawah, ini bawaan/default library - tidak perlu digambar manual lagi).
            const startY = drawPdfKop(doc, meta, title, opts);

            const subtotalStyle = { fillColor: [226, 232, 240], fontStyle: 'bold', textColor: [15, 23, 42] };
            let body;
            if (rows.length === 0) {
                body = [[{ content: 'Belum ada data untuk ditampilkan pada laporan ini.', colSpan: columns.length, styles: { halign: 'center', textColor: [100, 116, 139] } }]];
            } else if (opts.groupByDivision) {
                // Sisipkan baris SUBTOTAL setiap kali kelompok (Divisi) berganti, di dalam badan tabel itu
                // sendiri (bukan di footer) - supaya letaknya persis di bawah baris-baris divisi terkait.
                body = [];
                groupRowsByKey(rows, opts.groupKey || 'div').forEach(g => {
                    g.indices.forEach(i => body.push(columns.map(c => formatPdfCellValue(c.key, rows[i][c.key]))));
                    const subRow = columns.map((c, ci) => {
                        let val = '';
                        if (ci === 0) val = `Subtotal: ${g.key}`;
                        else if (opts.totalRow && opts.totalRow.sumKeys && opts.totalRow.sumKeys.includes(c.key)) {
                            val = formatPdfCellValue(c.key, g.indices.reduce((a, i) => a + (Number(rows[i][c.key]) || 0), 0));
                        }
                        return { content: val, styles: subtotalStyle };
                    });
                    body.push(subRow);
                });
            } else {
                body = rows.map(row => columns.map(c => formatPdfCellValue(c.key, row[c.key])));
            }

            // Baris TOTAL BESAR - ditaruh sebagai baris FOOTER, dan showFoot:'lastPage' memastikan baris ini
            // HANYA muncul SEKALI di ujung tabel (baris paling akhir), bukan diulang-ulang di setiap halaman.
            let foot;
            if (opts.totalRow && rows.length > 0) {
                foot = [columns.map((c, ci) => {
                    if (ci === 0) return opts.totalRow.label || 'TOTAL';
                    if (opts.totalRow.sumKeys && opts.totalRow.sumKeys.includes(c.key)) {
                        return formatPdfCellValue(c.key, rows.reduce((a, r) => a + (Number(r[c.key]) || 0), 0));
                    }
                    return '';
                })];
            }

            const columnStyles = {};
            columns.forEach((c, idx) => { if (c.width) columnStyles[idx] = { cellWidth: Math.max(5, c.width * 1.7), halign: 'center' }; });

            doc.autoTable({
                head: [columns.map(c => c.header)],
                body,
                foot,
                showFoot: 'lastPage',
                startY,
                margin: { top: 10, left: 10, right: 10, bottom: 12 },
                styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle', lineColor: [183, 192, 206], lineWidth: 0.1 },
                headStyles: { fillColor: [31, 54, 100], textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' },
                footStyles: { fillColor: [217, 226, 243], textColor: [11, 19, 43], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [244, 247, 251] },
                columnStyles
            });

            doc.save(filename);
        }

        // Ubah hasil builder material lama ({headers, rows:[{cells,kind}]}) menjadi format columns/rows generik,
        // supaya materials JUGA lewat mesin export yang sama persis dengan halaman lain (konsisten di semua halaman).
        function materialBuilderToGeneric(built) {
            const columns = built.headers.map((h, idx) => ({ header: h, key: 'c' + idx }));
            const rows = built.rows.map(r => {
                const obj = {};
                built.headers.forEach((h, idx) => { obj['c' + idx] = r.cells[idx] ?? ''; });
                return obj;
            });
            return { columns, rows };
        }

        // ===================================================================
        // DATASET PER HALAMAN: satu fungsi ini yang menentukan APA saja isi export-nya untuk
        // tiap jenis halaman - dipakai SAMA PERSIS oleh Excel & PDF supaya keduanya selalu identik
        // dan sesuai dengan data yang tampil di layar pada halaman terkait.
        // ===================================================================
        function getExportDataset(type) {
            const materialTypes = ['mat-kebutuhan', 'mat-order', 'mat-masuk', 'mat-keluar', 'mat-sisa'];
            if (materialTypes.includes(type)) {
                const built = getMaterialExportBuilder(type);
                const generic = materialBuilderToGeneric(built);
                return { title: built.title, columns: generic.columns, rows: generic.rows, orientation: 'landscape' };
            }

            if (type === 'rab') {
                const projRAB = rabData.filter(r => r.projId === activeProjectId).sort((a, b) => compareDivisionKey(a.noDiv, b.noDiv));
                const columns = [
                    { header: 'No', key: 'no' },
                    { header: 'No/Div', key: 'noDiv' },
                    { header: 'Divisi Pekerjaan', key: 'div' },
                    { header: 'Sub Pekerjaan', key: 'sub' },
                    { header: 'Rincian', key: 'rincian' },
                    { header: 'Satuan', key: 'satuan' },
                    { header: 'Volume', key: 'volume' },
                    { header: 'Harga Satuan (Rp)', key: 'harga' },
                    { header: 'Jumlah Harga (Rp)', key: 'jumlahHarga', formula: (row, r, ctx) => `${ctx.colLetter('volume')}${r}*${ctx.colLetter('harga')}${r}` },
                    { header: 'Bobot (%)', key: 'bobot', formula: (row, r, ctx) => `IF(SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow})=0,0,${ctx.colLetter('jumlahHarga')}${r}/SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow})*100)` }
                ];
                const rows = projRAB.map((r, i) => ({
                    no: i + 1, noDiv: r.noDiv || '', div: r.div || '', sub: r.sub || '', rincian: r.rincian || '',
                    satuan: r.satuan || '', volume: r.volume, harga: r.harga,
                    jumlahHarga: r.volume * r.harga,
                    bobot: (() => { const sub = projRAB.reduce((a, c) => a + c.volume * c.harga, 0); return sub > 0 ? (r.volume * r.harga / sub) * 100 : 0; })()
                }));
                return { title: 'RAB Kontrak Awal', columns, rows, orientation: 'landscape', groupByDivision: true, groupKey: 'div', totalRow: { label: 'TOTAL KESELURUHAN', sumKeys: ['jumlahHarga', 'bobot'] } };
            }

            if (type === 'lap-harian') {
                const rows = buildLapHarianExportRows();
                const columns = Object.keys(rows[0] || { Tanggal: '', 'Item Pekerjaan': '', Volume: '', Satuan: '', Tenaga: '', 'Jam Aktif': '', 'Jam Lembur': '', 'Cuaca Pagi': '', 'Cuaca Siang': '', 'Cuaca Sore': '', 'Cuaca Malam': '', 'Material Masuk': '', 'Material Keluar': '', Kendala: '', Notulen: '' })
                    .map(k => ({ header: k, key: k }));
                return { title: 'Laporan Harian Lapangan', columns, rows, orientation: 'landscape' };
            }

            if (type === 'lap-mingguan' || type === 'lap-bulanan') {
                const isMingguan = type === 'lap-mingguan';
                const selEl = document.getElementById(isMingguan ? 'lmFilterMingguSelect' : 'lbFilterBulanSelect');
                const proj = projects.find(p => p.id === activeProjectId) || {};
                const projRAB = rabData.filter(r => r.projId === activeProjectId).sort((a, b) => compareDivisionKey(a.noDiv, b.noDiv));
                const subtotal = projRAB.reduce((a, c) => a + c.volume * c.harga, 0);

                const columns = [
                    { header: 'No/Div', key: 'noDiv' }, { header: 'Divisi Pekerjaan', key: 'div' },
                    { header: 'Sub Pekerjaan', key: 'sub' }, { header: 'Rincian', key: 'rincian' }, { header: 'Satuan', key: 'satuan' },
                    { header: 'Volume RAB', key: 'volumeRab' }, { header: 'Harga Satuan (Rp)', key: 'harga' },
                    { header: 'Jumlah Harga (Rp)', key: 'jumlahHarga', formula: (row, r, ctx) => `${ctx.colLetter('volumeRab')}${r}*${ctx.colLetter('harga')}${r}` },
                    { header: 'Bobot (%)', key: 'bobotItem', formula: (row, r, ctx) => `IF(SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow})=0,0,${ctx.colLetter('jumlahHarga')}${r}/SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow})*100)` },
                    { header: `Vol. ${isMingguan ? 'Minggu' : 'Bulan'} Lalu`, key: 'volLalu' },
                    { header: `Vol. ${isMingguan ? 'Minggu' : 'Bulan'} Ini`, key: 'volIni' },
                    { header: 'Vol. Komulatif', key: 'volKum' },
                    { header: 'Bobot Lalu (%)', key: 'bobotLalu', formula: (row, r, ctx) => `${ctx.colLetter('volLalu')}${r}*${ctx.colLetter('harga')}${r}/IF(SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow})=0,1,SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow}))*100` },
                    { header: 'Bobot Ini (%)', key: 'bobotIni', formula: (row, r, ctx) => `${ctx.colLetter('volIni')}${r}*${ctx.colLetter('harga')}${r}/IF(SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow})=0,1,SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow}))*100` },
                    { header: 'Bobot Komulatif (%)', key: 'bobotKum', formula: (row, r, ctx) => `${ctx.colLetter('bobotLalu')}${r}+${ctx.colLetter('bobotIni')}${r}` },
                    { header: 'Jumlah Uang (Rp)', key: 'jumlahUang', formula: (row, r, ctx) => `${ctx.colLetter('volKum')}${r}*${ctx.colLetter('harga')}${r}` },
                    { header: 'Keterangan', key: 'keterangan' }
                ];

                let rows = [], reportTitle, subtitle, selectedLabel;
                if (isMingguan) {
                    selectedLabel = selEl ? selEl.value : 'Minggu 1';
                    const weekNum = parseInt((selectedLabel || '').replace(/\D/g, ''), 10) || 1;
                    rows = projRAB.map(item => {
                        const volLalu = bqOpnameNetVolumeCumulative(item.id, weekNum);
                        const volIni = bqOpnameNetVolumeForWeek(item.id, selectedLabel);
                        const volKum = volLalu + volIni;
                        const entry = lapMingguanData.find(l => l.rabId == item.id && l.mingguKe === selectedLabel);
                        return {
                            noDiv: item.noDiv || '', div: item.div || '', sub: item.sub || '', rincian: item.rincian || '', satuan: item.satuan || '',
                            volumeRab: item.volume, harga: item.harga, jumlahHarga: item.volume * item.harga,
                            bobotItem: subtotal > 0 ? (item.volume * item.harga / subtotal) * 100 : 0,
                            volLalu, volIni, volKum,
                            bobotLalu: subtotal > 0 ? (volLalu * item.harga / subtotal) * 100 : 0,
                            bobotIni: subtotal > 0 ? (volIni * item.harga / subtotal) * 100 : 0,
                            bobotKum: subtotal > 0 ? (volKum * item.harga / subtotal) * 100 : 0,
                            jumlahUang: volKum * item.harga,
                            keterangan: entry ? (entry.keterangan || '') : ''
                        };
                    });
                    reportTitle = `Laporan Mingguan - ${selectedLabel}`;
                    subtitle = `Periode: ${selectedLabel}`;
                } else {
                    selectedLabel = selEl ? selEl.value : 'Bulan 1';
                    const monthNum = parseInt((selectedLabel || '').replace(/\D/g, ''), 10) || 1;
                    const monthWeekRange = getMonthWeekRange(monthNum);
                    rows = projRAB.map(item => {
                        const itemLmEntries = lapMingguanData.filter(l => l.rabId == item.id);
                        const volLalu = monthWeekRange.start <= 1 ? 0 : itemLmEntries.filter(l => { const wk = parseInt((l.mingguKe || '').replace(/\D/g, ''), 10); return wk >= 1 && wk < monthWeekRange.start; }).reduce((a, c) => a + (Number(c.volume) || 0), 0);
                        const bulanEntries = itemLmEntries.filter(l => { const wk = parseInt((l.mingguKe || '').replace(/\D/g, ''), 10) || 0; return wk >= monthWeekRange.start && wk <= monthWeekRange.end; });
                        const volIni = bulanEntries.reduce((a, c) => a + (Number(c.volume) || 0), 0);
                        const volKum = volLalu + volIni;
                        const keterangan = bulanEntries.map(l => l.keterangan).filter(k => (k || '').trim() !== '').join('; ');
                        return {
                            noDiv: item.noDiv || '', div: item.div || '', sub: item.sub || '', rincian: item.rincian || '', satuan: item.satuan || '',
                            volumeRab: item.volume, harga: item.harga, jumlahHarga: item.volume * item.harga,
                            bobotItem: subtotal > 0 ? (item.volume * item.harga / subtotal) * 100 : 0,
                            volLalu, volIni, volKum,
                            bobotLalu: subtotal > 0 ? (volLalu * item.harga / subtotal) * 100 : 0,
                            bobotIni: subtotal > 0 ? (volIni * item.harga / subtotal) * 100 : 0,
                            bobotKum: subtotal > 0 ? (volKum * item.harga / subtotal) * 100 : 0,
                            jumlahUang: volKum * item.harga,
                            keterangan
                        };
                    });
                    reportTitle = `Laporan Bulanan - ${selectedLabel}`;
                    subtitle = `Periode: ${selectedLabel}`;
                }
                return { title: reportTitle, columns, rows, orientation: 'landscape', subtitle, groupByDivision: true, groupKey: 'div', totalRow: { label: 'TOTAL KESELURUHAN', sumKeys: ['jumlahHarga', 'bobotItem', 'jumlahUang'] } };
            }

            if (type === 'time-schedule') {
                const projRAB = rabData.filter(r => r.projId === activeProjectId).sort((a, b) => compareDivisionKey(a.noDiv, b.noDiv));
                const subtotal = projRAB.reduce((a, c) => a + c.volume * c.harga, 0);
                const columns = [
                    { header: 'No', key: 'no' }, { header: 'No/Div', key: 'noDiv' }, { header: 'Divisi Pekerjaan', key: 'div' },
                    { header: 'Sub Pekerjaan', key: 'sub' }, { header: 'Rincian', key: 'rincian' }, { header: 'Satuan', key: 'satuan' },
                    { header: 'Volume', key: 'volume' }, { header: 'Harga Satuan (Rp)', key: 'harga' },
                    { header: 'Jumlah Harga (Rp)', key: 'jumlahHarga', formula: (row, r, ctx) => `${ctx.colLetter('volume')}${r}*${ctx.colLetter('harga')}${r}` },
                    { header: 'Bobot Rencana (%)', key: 'bobot', formula: (row, r, ctx) => `IF(SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow})=0,0,${ctx.colLetter('jumlahHarga')}${r}/SUM(${ctx.colLetter('jumlahHarga')}${ctx.dataStartExcelRow}:${ctx.colLetter('jumlahHarga')}${ctx.dataEndExcelRow})*100)` }
                ];
                const rows = projRAB.map((r, i) => ({
                    no: i + 1, noDiv: r.noDiv || '', div: r.div || '', sub: r.sub || '', rincian: r.rincian || '',
                    satuan: r.satuan || '', volume: r.volume, harga: r.harga, jumlahHarga: r.volume * r.harga,
                    bobot: subtotal > 0 ? (r.volume * r.harga / subtotal) * 100 : 0
                }));
                return { title: 'Time Schedule - Bobot Item Pekerjaan (Dasar Kurva S)', columns, rows, orientation: 'landscape', groupByDivision: true, groupKey: 'div', totalRow: { label: 'TOTAL KESELURUHAN', sumKeys: ['jumlahHarga', 'bobot'] } };
            }

            if (type === 'bq-estimasi') {
                const columns = [
                    { header: 'No', key: 'no' }, { header: 'Nama Material', key: 'nama' }, { header: 'Satuan', key: 'satuan' },
                    { header: 'Volume Terhitung', key: 'volume' }, { header: 'Estimasi Harga Satuan (Rp)', key: 'harga' },
                    { header: 'Total Biaya (Rp)', key: 'total', formula: (row, r, ctx) => `${ctx.colLetter('volume')}${r}*${ctx.colLetter('harga')}${r}` }
                ];
                const rows = (bqResultsData || []).map((item, i) => ({ no: i + 1, nama: item.nama, satuan: item.satuan, volume: item.volume, harga: item.harga, total: item.volume * item.harga }));
                return { title: 'Backup Quantity - Estimasi Material', columns, rows, orientation: 'portrait', totalRow: { label: 'TOTAL', sumKeys: ['total'] } };
            }

            if (type === 'vol-cco') {
                const ccoNomor = volCcoSelectedNomor || (rabCcoList.filter(c => c.projId === activeProjectId).sort((a, b) => b.nomor - a.nomor)[0] || {}).nomor;
                const baseline = ccoNomor ? getRabCcoBaselineList(activeProjectId, ccoNomor) : [];
                const columns = [
                    { header: 'No', key: 'no' }, { header: 'No/Div', key: 'noDiv' }, { header: 'Divisi', key: 'div' },
                    { header: 'Sub Pekerjaan', key: 'sub' }, { header: 'Rincian', key: 'rincian' }, { header: 'Satuan', key: 'satuan' },
                    { header: 'Volume Acuan', key: 'volAcuan' }, { header: 'Volume Terukur', key: 'volTerukur' },
                    { header: 'Selisih', key: 'selisih', formula: (row, r, ctx) => `${ctx.colLetter('volTerukur')}${r}-${ctx.colLetter('volAcuan')}${r}` },
                    { header: 'Status', key: 'status' }
                ];
                const rows = baseline.map((item, i) => {
                    const sudah = ccoNomor ? volCcoHasMeasurement(item.id, ccoNomor) : false;
                    const volTerukur = ccoNomor ? volCcoEffectiveVolume(item, ccoNomor) : item.volume;
                    return { no: i + 1, noDiv: item.noDiv || '', div: item.div || '', sub: item.sub || '', rincian: item.rincian || '', satuan: item.satuan || '', volAcuan: item.volume, volTerukur, selisih: volTerukur - item.volume, status: sudah ? 'Sudah Diukur' : 'Belum Diukur' };
                });
                return { title: `Volume CCO - CCO ${ccoNomor || '-'}`, columns, rows, orientation: 'landscape', subtitle: `CCO ${ccoNomor || '-'}` };
            }

            if (type === 'bq-opname') {
                const rows = buildBqOpnameExportRows();
                const columns = Object.keys(rows[0] || {}).map(k => ({ header: k, key: k }));
                if (columns.length === 0) {
                    ['No/Div', 'Divisi', 'Sub Pekerjaan', 'Rincian', 'Satuan', 'Volume RAB', 'Minggu Ke', 'Segmen/Ruangan/Posisi', 'Tipe', 'Metode', 'Jumlah', 'Panjang', 'Lebar', 'Tinggi/Tebal', 'Koefisien', 'Volume Hasil', 'Catatan'].forEach(h => columns.push({ header: h, key: h }));
                }
                return { title: 'Backup Quantity - Opname Lapangan', columns, rows, orientation: 'landscape' };
            }

            if (type === 'absen-daftar-hadir') {
                const bulanInput = document.getElementById('dhFilterBulan');
                const bulanStr = (bulanInput && bulanInput.value) || new Date().toISOString().slice(0, 7);
                const columns = [
                    { header: 'No', key: 'no' }, { header: 'Nama Karyawan', key: 'nama' }, { header: 'Hari Hadir', key: 'hariHadir' },
                    { header: 'Jam Hadir', key: 'jamHadir' }, { header: 'Hari Lembur', key: 'hariLembur' }, { header: 'Jam Lembur', key: 'jamLembur' },
                    { header: 'Izin', key: 'izin' }, { header: 'Sakit', key: 'sakit' }, { header: 'Cuti', key: 'cuti' }
                ];
                const rows = buildDaftarHadirRekap(bulanStr).map((r, i) => ({ no: i + 1, ...r }));
                return { title: `Daftar Hadir - ${bulanStr}`, columns, rows, orientation: 'landscape' };
            }

            if (type.startsWith('pay-') && type !== 'pay-labarugi') {
                const kategori = type.replace('pay-', '');
                const cfg = PAY_KATEGORI[kategori];
                if (!cfg) return { title: type, columns: [], rows: [] };
                const data = [...payData.filter(d => d.projId === activeProjectId && d.kategori === kategori)]
                    .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
                const columns = [
                    { header: 'No', key: 'no' }, { header: 'Tanggal', key: 'tanggal' }, { header: cfg.namaLabel, key: 'nama' },
                    { header: cfg.uraianLabel, key: 'uraian' }, { header: 'Jumlah (Rp)', key: 'jumlah' },
                    { header: 'Metode Bayar', key: 'metodeBayar' }, { header: 'Keterangan', key: 'keterangan' }
                ];
                const rows = data.map((d, i) => ({ no: i + 1, tanggal: d.tanggal || '-', nama: d.nama, uraian: d.uraian || '-', jumlah: d.jumlah || 0, metodeBayar: d.metodeBayar || '-', keterangan: d.keterangan || '-' }));
                return { title: cfg.label, columns, rows, orientation: 'portrait', totalRow: { label: 'TOTAL', sumKeys: ['jumlah'] } };
            }

            if (type === 'pay-labarugi') {
                const projPay = payData.filter(d => d.projId === activeProjectId);
                const columns = [
                    { header: 'Kategori', key: 'kategori' }, { header: 'Arah', key: 'arah' },
                    { header: 'Jumlah Transaksi', key: 'count' }, { header: 'Total (Rp)', key: 'total' }
                ];
                const rows = Object.keys(PAY_KATEGORI).map(k => {
                    const cfg = PAY_KATEGORI[k];
                    const items = projPay.filter(d => d.kategori === k);
                    return { kategori: cfg.label, arah: cfg.arah === 'masuk' ? 'Pemasukan' : 'Pengeluaran', count: items.length, total: items.reduce((a, d) => a + (Number(d.jumlah) || 0), 0) };
                });
                const totalMasuk = rows.filter(r => r.arah === 'Pemasukan').reduce((a, r) => a + r.total, 0);
                const totalKeluar = rows.filter(r => r.arah === 'Pengeluaran').reduce((a, r) => a + r.total, 0);
                rows.push({ kategori: 'TOTAL PEMASUKAN', arah: '', count: '', total: totalMasuk });
                rows.push({ kategori: 'TOTAL PENGELUARAN', arah: '', count: '', total: totalKeluar });
                rows.push({ kategori: (totalMasuk - totalKeluar) >= 0 ? 'LABA / UNTUNG' : 'RUGI', arah: '', count: '', total: totalMasuk - totalKeluar });
                return { title: 'Laba Rugi & Untung', columns, rows, orientation: 'portrait' };
            }

            return { title: type, columns: [], rows: [] };
        }

        function triggerExcelExport(type) {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek' };
            const dataset = getExportDataset(type);
            const filename = `${dataset.title.replace(/[\\\/\?\*\[\]:]/g, ' ')}_${proj.nama}.xlsx`;
            exportProfessionalExcel(dataset.title, dataset.columns, dataset.rows, filename, { subtitle: dataset.subtitle, totalRow: dataset.totalRow, groupByDivision: dataset.groupByDivision, groupKey: dataset.groupKey });
        }

        function triggerPdfExport(type) {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek' };
            const dataset = getExportDataset(type);
            const filename = `${dataset.title.replace(/[\\\/\?\*\[\]:]/g, ' ')}_${proj.nama}.pdf`;
            exportProfessionalPdf(dataset.title, dataset.columns, dataset.rows, filename, { orientation: dataset.orientation, subtitle: dataset.subtitle, totalRow: dataset.totalRow, groupByDivision: dataset.groupByDivision, groupKey: dataset.groupKey });
        }

        let currentWaType = '';
        function openWaExportModal(type) {
            currentWaType = type;
            document.getElementById('waModal').classList.remove('hidden');
            document.getElementById('waModalTitle').innerText = `Export Format WhatsApp Text (${type.toUpperCase()})`;

            const container = document.getElementById('waSelectControlContainer');
            container.innerHTML = '';

            if (type === 'lap-harian') {
                container.innerHTML = `<input type="date" id="waInputDate" onchange="generateWaTextContent()" class="w-full bg-[#1c2541] border border-slate-700 rounded-lg p-2 text-white">`;
                document.getElementById('waInputDate').value = new Date().toISOString().split('T')[0];
            } else if (type === 'lap-mingguan') {
                container.innerHTML = `<select id="waInputMinggu" onchange="generateWaTextContent()" class="w-full bg-[#1c2541] border border-slate-700 rounded-lg p-2 text-white"><option value="Minggu 1">Minggu 1</option><option value="Minggu 2">Minggu 2</option></select>`;
            } else if (type === 'lap-bulanan') {
                container.innerHTML = `<select id="waInputBulan" onchange="generateWaTextContent()" class="w-full bg-[#1c2541] border border-slate-700 rounded-lg p-2 text-white"><option value="Bulan 1">Bulan 1</option><option value="Bulan 2">Bulan 2</option></select>`;
            } else {
                container.innerHTML = `<p class="text-slate-300 text-[11px]">Export seluruh data lengkap ${type} proyek.</p>`;
            }

            generateWaTextContent();
        }

        function closeWaModal() {
            document.getElementById('waModal').classList.add('hidden');
        }

        function generateWaTextContent() {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek' };
            let text = `🏗️ *PROCONSTRUCT ERP v3.0 - LAPORAN* 🏗️\n*Proyek:* ${proj.nama}\n*Lokasi:* ${proj.lokasi}\n\n`;

            if (currentWaType === 'rab') {
                const projRAB = rabData.filter(r => r.projId === activeProjectId);
                const sub = projRAB.reduce((a,c) => a + (c.volume * c.harga), 0);
                text += `📋 *REKAPITULASI RAB*\nTotal Item: ${projRAB.length}\nSubtotal Fisik: ${formatRupiah(sub)}\n`;
            } else if (currentWaType === 'lap-harian') {
                const dateVal = document.getElementById('waInputDate') ? document.getElementById('waInputDate').value : new Date().toISOString().split('T')[0];
                text += `📅 *LAPORAN HARIAN LAPANGAN*\nTanggal: ${dateVal}\n`;
                const dateLh = lapHarianData.filter(l => l.tanggal === dateVal);
                let totalTenagaWa = 0;
                dateLh.forEach((item, i) => {
                    const rab = rabData.find(r => r.id == item.pekerjaanId);
                    const namaPekerjaan = rab ? `${rab.noDiv || '-'} - ${rab.rincian || rab.sub}` : 'Pekerjaan';
                    const satuanPekerjaan = rab ? (rab.satuan || '') : '';
                    totalTenagaWa += estimateTotalTenagaFromText(item.tenaga);
                    text += `${i+1}. ${namaPekerjaan} | Vol: ${formatAngka(item.volume)} ${satuanPekerjaan} | Tenaga: ${item.tenaga || '-'}\n`;
                });
                text += `\n👷 *TOTAL TENAGA KERJA HARI INI:* ${totalTenagaWa > 0 ? formatAngka(totalTenagaWa) + ' orang' : '-'}\n`;
                // Kendala & Notulen: 1x per hari (bukan per item pekerjaan)
                const knForDate = findLhKendalaByDate(dateVal);
                text += `\n⚠️ *KENDALA*\n`;
                text += (knForDate && knForDate.kendala && knForDate.kendala.trim() !== '') ? `${knForDate.kendala}\n` : 'Tidak ada kendala\n';
                text += `\n📝 *NOTULEN*\n`;
                text += (knForDate && knForDate.notulen && knForDate.notulen.trim() !== '') ? `${knForDate.notulen}\n` : 'Tidak ada notulen\n';
                const dateMatMasuk = materialMasukData.filter(m => m.projId === activeProjectId && m.tanggal === dateVal);
                const dateMatKeluar = materialKeluarData.filter(m => m.projId === activeProjectId && m.tanggal === dateVal);
                text += `\n📦 *MATERIAL MASUK*\n`;
                text += dateMatMasuk.length > 0 ? dateMatMasuk.map((m,i) => `${i+1}. ${formatMaterialLabel(m)} - ${formatAngka(m.volume)} ${m.satuan}`).join('\n') + '\n' : 'Tidak ada\n';
                text += `\n📤 *MATERIAL KELUAR*\n`;
                text += dateMatKeluar.length > 0 ? dateMatKeluar.map((m,i) => `${i+1}. ${formatMaterialLabel(m)} - ${formatAngka(m.volume)} ${m.satuan}`).join('\n') + '\n' : 'Tidak ada\n';
            } else if (currentWaType === 'lap-mingguan') {
                text += `📊 *LAPORAN MINGGUAN PROYEK*\nSemua progress mingguan tercatat lengkap dan detail.\n`;
            } else if (currentWaType === 'lap-bulanan') {
                const bulanVal = document.getElementById('waInputBulan') ? document.getElementById('waInputBulan').value : 'Bulan 1';
                const monthNum = parseInt((bulanVal || '').replace(/\D/g, ''), 10) || 1;
                const range = getMonthDateRangeDetailed(monthNum, proj.tglMulai, proj.tglSelesai);
                text += `📊 *LAPORAN BULANAN PROYEK*\n${bulanVal}${range ? ' (' + range.labelShort + ')' : ''}\nVolume bulan ini diambil otomatis dari total Laporan Mingguan pada bulan terkait.\n`;
            } else if (currentWaType === 'mat-sisa') {
                const sisaList = getMaterialSisaList();
                text += `📦 *STOK SISA MATERIAL (GUDANG)*\n`;
                text += sisaList.length > 0 ? sisaList.map((s,i) => `${i+1}. ${s.nama}: Masuk ${formatAngka(s.masuk)} ${s.satuan}, Keluar ${formatAngka(s.keluar)} ${s.satuan}, Sisa *${formatAngka(s.sisa)} ${s.satuan}* (${s.sisa <= 0 ? 'Habis' : 'Aman/Tersedia'})`).join('\n') + '\n' : 'Belum ada data material masuk/keluar.\n';
            } else if (currentWaType === 'action-plan') {
                const week = actionPlanSelectedWeek || 1;
                const range = getWeekDateRange(week, proj.tglMulai, proj.tglSelesai);
                const rows = buildActionPlanExportRows(week);
                text += `📋 *ACTION PLAN LAPANGAN*\nMinggu ke-${week}${range ? ' (' + range.label + ')' : ''}\n\n`;
                text += rows.length > 0 ? rows.map((r, i) => `${i+1}. [${r['No. Divisi']}] ${r['Nama Sub Pekerjaan']}\n   Target: ${r['Target Minggu Ini (%)']}% | Status: ${r['Status Action Plan']}`).join('\n') + '\n' : 'Belum ada data RAB.\n';
            } else if (currentWaType === 'mat-kebutuhan') {
                const data = kebutuhanMatData.filter(d => d.projId === activeProjectId);
                const withStatus = data.map(item => {
                    const sudahDipesan = getKebutuhanOrderedTotal(item.id, null);
                    const persenDipesan = item.volume > 0 ? Math.min(100, (sudahDipesan / item.volume) * 100) : 0;
                    const statusGroup = persenDipesan <= 0 ? 0 : (persenDipesan >= 100 ? 2 : 1);
                    return { item, persenDipesan, statusGroup };
                }).sort((a, b) => a.statusGroup - b.statusGroup || a.item.id - b.item.id);
                const groupEmoji = { 0: '🔴', 1: '🟡', 2: '🟢' };
                const groupLabel = { 0: 'BELUM DI-ORDER', 1: 'SEDANG ORDER SEBAGIAN', 2: 'SUDAH DI-ORDER (100%)' };
                text += `📦 *RENCANA KEBUTUHAN MATERIAL*\n\n`;
                let totalNilai = 0;
                [0, 1, 2].forEach(g => {
                    const items = withStatus.filter(x => x.statusGroup === g);
                    if (items.length === 0) return;
                    text += `${groupEmoji[g]} *${groupLabel[g]} (${items.length} item)*\n`;
                    items.forEach(({ item, persenDipesan }, i) => {
                        const totalItem = (item.volume || 0) * (item.harga || 0);
                        totalNilai += totalItem;
                        text += `${i + 1}. ${item.nama}${item.dimensi ? ' ' + item.dimensi : ''} - ${formatAngka(item.volume)} ${item.satuan} (${formatAngka(persenDipesan)}% terorder)`;
                        if (item.pic) text += ` | PIC: ${item.pic}`;
                        text += `\n`;
                    });
                    text += `\n`;
                });
                if (data.length === 0) text += `Belum ada data kebutuhan material.\n`;
                else text += `💰 *Total Nilai Kebutuhan:* ${formatRupiah(totalNilai)}\n`;
            } else if (currentWaType.startsWith('pay-') && currentWaType !== 'pay-labarugi') {
                const kategori = currentWaType.replace('pay-', '');
                const cfg = PAY_KATEGORI[kategori];
                const data = [...payData.filter(d => d.projId === activeProjectId && d.kategori === kategori)]
                    .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
                const emoji = cfg.arah === 'masuk' ? '💵' : '💸';
                text += `${emoji} *${(cfg.label || '').toUpperCase()}*\n\n`;
                let total = 0;
                data.forEach((d, i) => {
                    total += Number(d.jumlah) || 0;
                    text += `${i + 1}. ${d.tanggal || '-'} - ${d.nama}${d.uraian ? ' (' + d.uraian + ')' : ''}\n   ${cfg.arah === 'masuk' ? '+' : '-'}${formatRupiah(d.jumlah)}${d.metodeBayar ? ' via ' + d.metodeBayar : ''}\n`;
                });
                if (data.length === 0) text += 'Belum ada data.\n';
                else text += `\n${cfg.arah === 'masuk' ? '💵 *Total Diterima:*' : '💸 *Total Dibayarkan:*'} ${formatRupiah(total)}\n`;
            } else if (currentWaType === 'pay-labarugi') {
                const projPay = payData.filter(d => d.projId === activeProjectId);
                let totalMasuk = 0, totalKeluar = 0;
                text += `⚖️ *LABA RUGI & UNTUNG*\n\n`;
                Object.keys(PAY_KATEGORI).forEach(k => {
                    const cfg = PAY_KATEGORI[k];
                    const sub = projPay.filter(d => d.kategori === k).reduce((a, d) => a + (Number(d.jumlah) || 0), 0);
                    if (cfg.arah === 'masuk') totalMasuk += sub; else totalKeluar += sub;
                    text += `${cfg.arah === 'masuk' ? '➕' : '➖'} ${cfg.label}: ${formatRupiah(sub)}\n`;
                });
                const labaRugi = totalMasuk - totalKeluar;
                text += `\n💵 *Total Pemasukan:* ${formatRupiah(totalMasuk)}\n💸 *Total Pengeluaran:* ${formatRupiah(totalKeluar)}\n${labaRugi >= 0 ? '✅ *Laba/Untung:*' : '⚠️ *Rugi:*'} ${formatRupiah(labaRugi)}\n`;
            } else {
                text += `📌 *LAPORAN DETAIL ${currentWaType.toUpperCase()}*\nData lengkap dan akurat sesuai sistem ERP.\n`;
            }

            text += `\n_Dibuat otomatis oleh ProConstruct ERP v3.0_\n_by rchmd20_`;
            document.getElementById('waPreviewText').value = text;
        }

        function copyWaText() {
            const txt = document.getElementById('waPreviewText');
            txt.select();
            navigator.clipboard.writeText(txt.value);
            alert('Teks WhatsApp berhasil disalin!');
        }

        function sendWaDirect() {
            const txt = document.getElementById('waPreviewText').value;
            window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
        }

        // Helper Format Rupiah (dibatasi maksimal 2 angka di belakang koma)
        function formatRupiah(num) {
            return 'Rp ' + Number(num).toLocaleString('id-ID', { maximumFractionDigits: 2 });
        }

        // Helper KEAMANAN: ubah karakter HTML berbahaya (<, >, ", ', &) pada teks bebas dari user (nama,
        // catatan, keterangan, dsb) menjadi bentuk aman sebelum dimasukkan ke innerHTML. Tanpa ini, orang
        // yang mengisi field bebas dengan kode seperti <script> atau <img onerror=...> bisa membuat kode
        // itu ikut "jalan" di layar user LAIN yang melihat data yang sama (karena datanya tersinkron lewat
        // cloud) - ini disebut serangan XSS (Cross-Site Scripting). Dipakai membungkus nilai field bebas
        // tepat sebelum ditulis ke innerHTML, TANPA mengubah data aslinya yang tersimpan di localStorage/cloud.
        function escapeHtml(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // Helper Format Angka umum (volume, sisa, dsb): angka bulat tetap tampil bulat,
        // angka desimal dibulatkan & dibatasi MAKSIMAL 2 angka di belakang koma di semua halaman.
        // Memakai locale id-ID sehingga koma dipakai sbg pemisah desimal & titik sbg pemisah ribuan.
        function formatAngka(num, maxDecimals = 2) {
            const n = Number(num);
            if (isNaN(n)) return num;
            return n.toLocaleString('id-ID', { maximumFractionDigits: maxDecimals });
        }

        // ---- Helper Baris Pemisah Bulan (dipakai di berbagai tabel list yang diurutkan berdasarkan tanggal) ----

        // Label "Bulan Tahun" dalam Bahasa Indonesia dari sebuah string tanggal (YYYY-MM-DD)
        function formatMonthYearLabel(dateStr) {
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        }

        // Baris pemisah bulan generik, dipakai di berbagai tabel list bertanggal supaya tiap kali data
        // berpindah bulan ada baris pemisah visual yang jelas (label "Bulan Tahun") sebelum melanjutkan
        // ke baris-baris bulan berikutnya.
        function buildMonthSeparatorRow(dateStr, colspan) {
            return `<tr class="bg-[#0b132b]"><td colspan="${colspan}" class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border-y border-amber-500/20">
                <i class="fa-regular fa-calendar mr-1.5"></i>${formatMonthYearLabel(dateStr)}
            </td></tr>`;
        }

        // Helper Format Label Material: Nama + Dimensi + Spesifikasi (dipakai supaya identitas material
        // selalu jelas di mana pun ditampilkan, termasuk pada Data Laporan Harian & Export WA-nya)
        function formatMaterialLabel(item) {
            if (!item) return '-';
            const extra = [item.dimensi, item.spesifikasi].filter(Boolean).join(' - ');
            return extra ? `${item.nama} (${extra})` : item.nama;
        }

        // Perkirakan jumlah total tenaga kerja (orang) dari teks bebas kolom "Tenaga" pada Laporan Harian,
        // mis. "5 Tukang, 2 Mandor, 1 Kepala Tukang" -> dijumlah jadi 8. Dipakai utk baris "Total Tenaga
        // Kerja Hari Ini" pada list & export WhatsApp. Kalau formatnya tidak diawali angka, segmen tsb dilewati.
        function estimateTotalTenagaFromText(tenagaText) {
            if (!tenagaText) return 0;
            let total = 0;
            String(tenagaText).split(/,|(?:\bdan\b)/i).forEach(seg => {
                const m = seg.trim().match(/^(\d+(?:[.,]\d+)?)/);
                if (m) total += parseFloat(m[1].replace(',', '.'));
            });
            return total;
        }
