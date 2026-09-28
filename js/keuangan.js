        // ===================================================================

        function renderPaySection() {
            const cfg = PAY_KATEGORI[activePayKategori];
            if (!cfg) return;
            document.getElementById('payPageTitleText').innerText = cfg.label;
            document.getElementById('payPageIcon').className = `fa-solid ${cfg.icon} text-amber-400`;
            document.getElementById('payFormTitle').innerText = `Tambah Data ${cfg.label}`;
            document.getElementById('payNamaLabel').innerText = cfg.namaLabel;
            document.getElementById('payNama').placeholder = cfg.namaPlaceholder;
            document.getElementById('payUraianLabel').innerText = cfg.uraianLabel;
            document.getElementById('payUraian').placeholder = cfg.uraianLabel;
            document.getElementById('payColNama').innerText = cfg.namaLabel;
            document.getElementById('payColUraian').innerText = cfg.uraianLabel;
            document.getElementById('payTableTitle').innerText = `Riwayat ${cfg.label}`;
            document.getElementById('paySumTotalLabel').innerText = cfg.arah === 'masuk' ? 'Total Diterima' : 'Total Dibayarkan';
            cancelPayEdit();
            applyRoleBasedUI();
            renderPayTable();
        }

        function renderPayTable() {
            const cfg = PAY_KATEGORI[activePayKategori];
            const tbody = document.getElementById('payTableBody');
            if (!tbody || !cfg) return;
            const query = (document.getElementById('paySearchInput').value || '').trim().toLowerCase();
            let data = payData.filter(d => d.projId === activeProjectId && d.kategori === activePayKategori);
            if (query) data = data.filter(d => (d.nama || '').toLowerCase().includes(query) || (d.uraian || '').toLowerCase().includes(query));
            data = [...data].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-500">Belum ada data ${escapeHtml(cfg.label)}.</td></tr>`;
            } else {
                let total = 0;
                tbody.innerHTML = data.map((item, idx) => {
                    total += Number(item.jumlah) || 0;
                    return `
                        <tr class="hover:bg-slate-800/50 transition">
                            <td class="p-3">${idx + 1}</td>
                            <td class="p-3 font-mono text-amber-400">${item.tanggal || '-'}</td>
                            <td class="p-3 font-bold text-white">${escapeHtml(item.nama)}</td>
                            <td class="p-3 text-slate-300">${escapeHtml(item.uraian) || '-'}</td>
                            <td class="p-3 font-mono font-bold ${cfg.arah === 'masuk' ? 'text-emerald-400' : 'text-red-400'}">${cfg.arah === 'masuk' ? '+' : '-'}${formatRupiah(item.jumlah)}</td>
                            <td class="p-3">${escapeHtml(item.metodeBayar) || '-'}</td>
                            <td class="p-3 text-[11px] text-slate-400">${escapeHtml(item.keterangan) || '-'}</td>
                            <td class="p-3 text-center">
                                <button onclick="editPayItem(${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
                                <button onclick="deletePayItem(${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>
                            </td>
                        </tr>`;
                }).join('');
                document.getElementById('paySumTotal').innerText = formatRupiah(total);
                document.getElementById('paySumCount').innerText = data.length;
                return;
            }
            document.getElementById('paySumTotal').innerText = formatRupiah(0);
            document.getElementById('paySumCount').innerText = 0;
        }

        function handlePaySubmit(e) {
            e.preventDefault();
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            const payload = {
                kategori: activePayKategori,
                tanggal: document.getElementById('payTanggal').value,
                nama: document.getElementById('payNama').value.trim(),
                uraian: document.getElementById('payUraian').value.trim(),
                jumlah: parseFloat(document.getElementById('payJumlah').value) || 0,
                metodeBayar: document.getElementById('payMetode').value,
                keterangan: document.getElementById('payKeterangan').value.trim()
            };
            if (payEditContext) {
                const idx = payData.findIndex(d => d.id === payEditContext);
                if (idx !== -1) payData[idx] = { ...payData[idx], ...payload };
            } else {
                payData.push({ id: Date.now() + Math.random(), projId: activeProjectId, ...payload });
            }
            localStorage.setItem('erp_pay', JSON.stringify(payData));
            cancelPayEdit();
            renderPayTable();
        }

        function editPayItem(id) {
            const item = payData.find(d => d.id === id);
            if (!item) return;
            payEditContext = id;
            document.getElementById('payEditId').value = id;
            document.getElementById('payTanggal').value = item.tanggal || '';
            document.getElementById('payNama').value = item.nama || '';
            document.getElementById('payUraian').value = item.uraian || '';
            document.getElementById('payJumlah').value = item.jumlah || '';
            document.getElementById('payMetode').value = item.metodeBayar || 'Transfer Bank';
            document.getElementById('payKeterangan').value = item.keterangan || '';
            document.getElementById('payFormTitle').innerText = `Edit Data ${PAY_KATEGORI[activePayKategori].label}`;
            document.getElementById('paySubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
            document.getElementById('payCancelBtn').classList.remove('hidden');
            document.getElementById('payFormBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function cancelPayEdit() {
            payEditContext = null;
            const form = document.getElementById('formPay');
            if (form) form.reset();
            document.getElementById('payEditId').value = '';
            const cfg = PAY_KATEGORI[activePayKategori];
            if (cfg) document.getElementById('payFormTitle').innerText = `Tambah Data ${cfg.label}`;
            const submitBtn = document.getElementById('paySubmitBtn');
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Tambah Data';
            const cancelBtn = document.getElementById('payCancelBtn');
            if (cancelBtn) cancelBtn.classList.add('hidden');
        }

        function deletePayItem(id) {
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            if (!confirm('Hapus data pembayaran ini?')) return;
            payData = payData.filter(d => d.id !== id);
            localStorage.setItem('erp_pay', JSON.stringify(payData));
            renderPayTable();
        }

        // Kategori Termin & Investor dianggap PEMASUKAN (uang masuk ke proyek); Subkon/Tenaga/Material/
        // Karyawan dianggap PENGELUARAN. Laba/Rugi = Total Pemasukan - Total Pengeluaran.
        // Sumber tunggal perhitungan Laba Rugi - dipakai bersama oleh tampilan halaman, Export Excel/PDF & WhatsApp
        function computeLabaRugiData() {
            const projPay = payData.filter(d => d.projId === activeProjectId);
            const w = computeInvestorWaterfall(activeProjectId);
            const sumBy = (fn) => projPay.filter(fn).reduce((a, c) => a + (Number(c.jumlah) || 0), 0);
            const cnt = (fn) => projPay.filter(fn).length;

            const terminNetto = sumBy(d => d.kategori === 'termin');
            const subkonUtangMasuk = sumBy(d => d.kategori === 'subkon' && d.jenis === 'utang');
            const subkonPengembalianMasuk = sumBy(d => d.kategori === 'subkon' && d.jenis === 'pengembalian');
            const totalMasuk = terminNetto + subkonUtangMasuk + subkonPengembalianMasuk + w.modal;

            const tenagaKeluar = sumBy(d => d.kategori === 'tenaga');
            const karyawanKeluar = sumBy(d => d.kategori === 'karyawan');
            const materialKeluar = sumBy(d => d.kategori === 'material');
            const subkonPengambilanKeluar = sumBy(d => d.kategori === 'subkon' && d.jenis === 'pengambilan');
            const subkonPajakKeluar = sumBy(d => d.kategori === 'subkon' && d.jenis === 'pajak');
            const totalKeluar = tenagaKeluar + karyawanKeluar + materialKeluar + subkonPengambilanKeluar + subkonPajakKeluar + w.dikembalikan + w.keuntungan;

            const rows = [
                { label: 'Termin (Netto Diterima)', arah: 'masuk', icon: 'fa-hand-holding-dollar', count: cnt(d => d.kategori === 'termin'), total: terminNetto },
                { label: 'Modal Investor Masuk', arah: 'masuk', icon: 'fa-sack-dollar', count: w.modal > 0 ? 1 : 0, total: w.modal },
                { label: 'Subkon - Pembayaran Utang (Diterima)', arah: 'masuk', icon: 'fa-hand-holding-dollar', count: cnt(d => d.kategori === 'subkon' && d.jenis === 'utang'), total: subkonUtangMasuk },
                { label: 'Subkon - Pengembalian / Ganti Rugi (Diterima)', arah: 'masuk', icon: 'fa-rotate-left', count: cnt(d => d.kategori === 'subkon' && d.jenis === 'pengembalian'), total: subkonPengembalianMasuk },
                { label: 'Tenaga (Upah)', arah: 'keluar', icon: 'fa-helmet-safety', count: cnt(d => d.kategori === 'tenaga'), total: tenagaKeluar },
                { label: 'Karyawan (Gaji)', arah: 'keluar', icon: 'fa-id-badge', count: cnt(d => d.kategori === 'karyawan'), total: karyawanKeluar },
                { label: 'Material', arah: 'keluar', icon: 'fa-truck-field', count: cnt(d => d.kategori === 'material'), total: materialKeluar },
                { label: 'Subkon - Pengambilan Dana', arah: 'keluar', icon: 'fa-money-bill-transfer', count: cnt(d => d.kategori === 'subkon' && d.jenis === 'pengambilan'), total: subkonPengambilanKeluar },
                { label: 'Subkon - Pajak', arah: 'keluar', icon: 'fa-receipt', count: cnt(d => d.kategori === 'subkon' && d.jenis === 'pajak'), total: subkonPajakKeluar },
                { label: 'Investor - Pengembalian Modal (otomatis dari Termin)', arah: 'keluar', icon: 'fa-rotate-left', count: w.dikembalikan > 0 ? 1 : 0, total: w.dikembalikan },
                { label: 'Investor - Keuntungan (% x Modal)', arah: 'keluar', icon: 'fa-chart-line', count: w.keuntungan > 0 ? 1 : 0, total: w.keuntungan }
            ];
            const labaRugi = totalMasuk - totalKeluar;
            return { rows, totalMasuk, totalKeluar, labaRugi, margin: totalMasuk > 0 ? (labaRugi / totalMasuk) * 100 : 0 };
        }

        function renderLabaRugi() {
            const { rows, totalMasuk, totalKeluar, labaRugi, margin } = computeLabaRugiData();
            document.getElementById('lrTotalPemasukan').innerText = formatRupiah(totalMasuk);
            document.getElementById('lrTotalPengeluaran').innerText = formatRupiah(totalKeluar);
            const lrEl = document.getElementById('lrLabaRugi');
            lrEl.innerText = formatRupiah(labaRugi);
            lrEl.className = `text-2xl font-black font-mono mt-1 ${labaRugi >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
            document.getElementById('lrLabaRugiLabel').innerText = labaRugi >= 0 ? 'Laba / Untung' : 'Rugi';
            document.getElementById('lrMargin').innerText = `Margin: ${margin.toFixed(2)}%`;

            const tbody = document.getElementById('lrTableBody');
            tbody.innerHTML = rows.map(r => {
                const arahTotal = r.arah === 'masuk' ? totalMasuk : totalKeluar;
                const persen = arahTotal > 0 ? (r.total / arahTotal) * 100 : 0;
                return `
                    <tr class="hover:bg-slate-800/50 transition">
                        <td class="p-3 font-bold text-white"><i class="fa-solid ${r.icon} text-amber-400 mr-1.5"></i>${r.label}</td>
                        <td class="p-3">${r.arah === 'masuk' ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">PEMASUKAN</span>' : '<span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">PENGELUARAN</span>'}</td>
                        <td class="p-3 font-mono">${r.count}</td>
                        <td class="p-3 font-mono font-bold ${r.arah === 'masuk' ? 'text-emerald-400' : 'text-red-400'}">${formatRupiah(r.total)}</td>
                        <td class="p-3 font-mono">${persen.toFixed(1)}%</td>
                    </tr>`;
            }).join('');
        }

        function renderLapHarian() {
            // (tidak mereset seluruh form agar isian yang sedang diketik user tidak hilang saat renderLapHarian dipanggil ulang)
            const rowsContainer = document.getElementById('lhPekerjaanRowsContainer');
            if (rowsContainer) {
                const existingRows = rowsContainer.querySelectorAll('.lh-pekerjaan-row');
                if (existingRows.length === 0) {
                    addLhPekerjaanRow();
                } else {
                    existingRows.forEach(row => filterLhPekerjaanOptions(row.dataset.rowId));
                }
            }

            const tbody = document.getElementById('lapHarianTableBody');
            tbody.innerHTML = '';
            let projLh = lapHarianData.filter(l => {
                const rab = rabData.find(r => r.id == l.pekerjaanId);
                return rab && rab.projId === activeProjectId;
            });

            const filterDate = document.getElementById('lhFilterDate').value;
            if (filterDate) {
                projLh = projLh.filter(l => l.tanggal === filterDate);
            }

            if (projLh.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Belum ada data Laporan Harian.</td></tr>`;
                return;
            }

            // Group by Date as requested: "pada area list buat agar cuaca, material masuk dan keluar menjadi kesatuan pertanggal jadi yang pisah pada tanggal tersebut adalah item pekerjaan, volume dan tenaga."
            const groupedByDate = {};
            projLh.forEach(item => {
                if (!groupedByDate[item.tanggal]) {
                    groupedByDate[item.tanggal] = {
                        tanggal: item.tanggal,
                        cuacaPagi: item.cuacaPagi || 'Cerah',
                        cuacaSiang: item.cuacaSiang || 'Cerah',
                        cuacaSore: item.cuacaSore || 'Cerah',
                        cuacaMalam: item.cuacaMalam || 'Cerah',
                        items: []
                    };
                }
                groupedByDate[item.tanggal].items.push(item);
            });

            // Get material masuk & keluar for project
            const projMatMasuk = materialMasukData.filter(m => m.projId === activeProjectId);
            const projMatKeluar = materialKeluarData.filter(m => m.projId === activeProjectId);

            // Urutkan berdasarkan tanggal (lama -> baru) supaya list selalu rapi & tidak acak-acakan
            const sortedGroups = Object.values(groupedByDate).sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));
            let currentMonthKey = null;

            sortedGroups.forEach(group => {
                // Sisipkan baris pemisah setiap kali data berpindah bulan
                const monthKey = (group.tanggal || '').slice(0, 7); // "YYYY-MM"
                if (monthKey !== currentMonthKey) {
                    tbody.innerHTML += buildMonthSeparatorRow(group.tanggal, 5);
                    currentMonthKey = monthKey;
                }

                const dateMatMasuk = projMatMasuk.filter(m => m.tanggal === group.tanggal);
                const dateMatKeluar = projMatKeluar.filter(m => m.tanggal === group.tanggal);
                const kendalaNotulen = findLhKendalaByDate(group.tanggal);

                let matTextMasuk = dateMatMasuk.length > 0 ? dateMatMasuk.map(m => `${formatMaterialLabel(m)}: ${formatAngka(m.volume)} ${m.satuan}`).join(', ') : 'Tidak ada';
                let matTextKeluar = dateMatKeluar.length > 0 ? dateMatKeluar.map(m => `${formatMaterialLabel(m)}: ${formatAngka(m.volume)} ${m.satuan}`).join(', ') : 'Tidak ada';

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-800/50 transition align-top';

                // Item Pekerjaan, Tenaga Kerja & Aksi digabung jadi 1 nested table supaya tiap baris
                // (per item pekerjaan) benar-benar SEJAJAR satu sama lain - Rincian pekerjaan, tenaga
                // yang mengerjakannya, dan tombol edit/hapusnya ada di baris yang sama persis.
                let combinedRowsHtml = '';
                let totalTenagaEstimasi = 0;
                group.items.forEach(item => {
                    const rab = rabData.find(r => r.id == item.pekerjaanId);
                    const noDivLabel = rab ? (rab.noDiv || '-') : '-';
                    const rincianLabel = rab ? (rab.rincian || rab.sub) : 'Pekerjaan';
                    const satuanLabel = rab ? (rab.satuan || '') : '';
                    totalTenagaEstimasi += estimateTotalTenagaFromText(item.tenaga);
                    combinedRowsHtml += `
                        <tr class="border-t border-slate-800 align-top">
                            <td class="py-1.5 pr-2">
                                <span class="text-slate-500 font-mono text-[10px]">${noDivLabel}</span>
                                <div class="font-bold text-white">${rincianLabel}</div>
                                <div class="text-emerald-400 font-mono font-bold">${formatAngka(item.volume)} ${satuanLabel}</div>
                            </td>
                            <td class="py-1.5 pr-2 text-amber-300 align-middle">${item.tenaga || 'Standar'} (${item.jamAktif || 8}h + ${item.jamLembur || 0}h)</td>
                            <td class="py-1.5 text-center align-middle">
                                <div class="flex justify-center space-x-1">
                                    <button onclick="editLapHarian(${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded transition" title="Edit"><i class="fa-solid fa-pen text-[10px]"></i></button>
                                    <button onclick="deleteLapHarian(${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded transition" title="Hapus"><i class="fa-solid fa-trash-can text-[10px]"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                const combinedTableHtml = `
                    <table class="w-full text-[11px] border-collapse">
                        <thead>
                            <tr class="text-slate-500">
                                <th class="text-left pb-1 pr-2 font-semibold">Item Pekerjaan</th>
                                <th class="text-left pb-1 pr-2 font-semibold">Tenaga Kerja</th>
                                <th class="text-center pb-1 font-semibold w-14">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>${combinedRowsHtml}</tbody>
                        <tfoot>
                            <tr class="border-t border-amber-500/30">
                                <td class="pt-1.5 pr-2 font-bold text-amber-300" colspan="2">Total Tenaga Kerja Hari Ini</td>
                                <td class="pt-1.5 text-center font-bold text-amber-300">${totalTenagaEstimasi > 0 ? formatAngka(totalTenagaEstimasi) + ' org' : '-'}</td>
                            </tr>
                        </tfoot>
                    </table>
                `;

                tr.innerHTML = `
                    <td class="p-3 font-mono font-bold text-amber-400">${group.tanggal}</td>
                    <td class="p-3">
                        <div class="text-[11px] space-y-0.5">
                            <div>Pagi: <span class="text-white">${group.cuacaPagi}</span></div>
                            <div>Siang: <span class="text-white">${group.cuacaSiang}</span></div>
                            <div>Sore: <span class="text-white">${group.cuacaSore}</span></div>
                            <div>Malam: <span class="text-white">${group.cuacaMalam}</span></div>
                        </div>
                    </td>
                    <td class="p-3">
                        <div class="text-[11px] space-y-1">
                            <div><strong class="text-purple-400">Masuk:</strong> ${matTextMasuk}</div>
                            <div><strong class="text-rose-400">Keluar:</strong> ${matTextKeluar}</div>
                        </div>
                    </td>
                    <td class="p-3">${combinedTableHtml}</td>
                    <td class="p-3">
                        <div class="text-[11px] space-y-1">
                            <div><strong class="text-amber-300">Kendala:</strong> ${kendalaNotulen && kendalaNotulen.kendala ? kendalaNotulen.kendala : '-'}</div>
                            <div><strong class="text-sky-300">Notulen:</strong> ${kendalaNotulen && kendalaNotulen.notulen ? kendalaNotulen.notulen : '-'}</div>
                            <div class="flex space-x-1 pt-1">
                                <button onclick="editLhKendala('${group.tanggal}')" class="bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white p-1 rounded transition" title="${kendalaNotulen ? 'Edit' : 'Tambah'} Kendala & Notulen"><i class="fa-solid fa-pen text-[10px]"></i></button>
                                ${kendalaNotulen ? `<button onclick="deleteLhKendala(${kendalaNotulen.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded transition" title="Hapus"><i class="fa-solid fa-trash-can text-[10px]"></i></button>` : ''}
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function handleLapHarianSubmit(e) {
            e.preventDefault();
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            const editId = document.getElementById('lhEditId').value;
            const tanggal = document.getElementById('lhTanggal').value;
            const cuacaPagi = document.getElementById('lhCuacaPagi').value;
            const cuacaSiang = document.getElementById('lhCuacaSiang').value;
            const cuacaSore = document.getElementById('lhCuacaSore').value;
            const cuacaMalam = document.getElementById('lhCuacaMalam').value;

            // Kumpulkan semua baris item pekerjaan yang sedang diisi di form
            const rowEls = Array.from(document.querySelectorAll('#lhPekerjaanRowsContainer .lh-pekerjaan-row'));
            const entries = rowEls.map(row => ({
                pekerjaanId: row.querySelector('.lh-pekerjaan-select').value,
                volume: parseFloat(row.querySelector('.lh-volume').value) || 0,
                tenaga: row.querySelector('.lh-tenaga').value.trim(),
                jamAktif: parseFloat(row.querySelector('.lh-jam-aktif').value) || 8,
                jamLembur: parseFloat(row.querySelector('.lh-jam-lembur').value) || 0
            }));

            if (entries.length === 0 || entries.some(en => !en.pekerjaanId)) {
                alert('Setiap item pekerjaan wajib dipilih dari daftar RAB terlebih dahulu.');
                return;
            }

            if (editId) {
                // Mode Edit: hanya 1 item laporan harian (baris pertama pada form) yang diperbarui
                const idx = lapHarianData.findIndex(l => l.id == editId);
                if (idx !== -1) {
                    lapHarianData[idx] = {
                        ...lapHarianData[idx],
                        tanggal, ...entries[0],
                        cuacaPagi, cuacaSiang, cuacaSore, cuacaMalam
                    };
                }
            } else {
                // Mode Tambah Baru: setiap baris pekerjaan menjadi 1 record Laporan Harian tersendiri,
                // tetap berbagi tanggal & cuaca yang sama (karena 1 tukang/tim tidak selalu hanya mengerjakan 1 pekerjaan per hari)
                entries.forEach((en, i) => {
                    lapHarianData.push({
                        id: Date.now() + i,
                        tanggal, ...en,
                        cuacaPagi, cuacaSiang, cuacaSore, cuacaMalam
                    });
                });
            }

            localStorage.setItem('erp_lap_harian', JSON.stringify(lapHarianData));
            cancelLhEdit();
            renderLapHarian();
        }

        function editLapHarian(id) {
            const item = lapHarianData.find(l => l.id == id);
            if (!item) return;
            document.getElementById('lhEditId').value = item.id;
            document.getElementById('lhTanggal').value = item.tanggal;
            document.getElementById('lhCuacaPagi').value = item.cuacaPagi || 'Cerah';
            document.getElementById('lhCuacaSiang').value = item.cuacaSiang || 'Cerah';
            document.getElementById('lhCuacaSore').value = item.cuacaSore || 'Cerah';
            document.getElementById('lhCuacaMalam').value = item.cuacaMalam || 'Cerah';

            // Mode Edit hanya untuk 1 item pekerjaan (item yang dipilih dari list), jadi form direset ke 1 baris saja
            const container = document.getElementById('lhPekerjaanRowsContainer');
            container.innerHTML = '';
            lhRowCounter = 0;
            const rowId = addLhPekerjaanRow();
            const row = document.querySelector(`.lh-pekerjaan-row[data-row-id="${rowId}"]`);
            row.querySelector('.lh-pekerjaan-select').value = item.pekerjaanId;
            row.querySelector('.lh-volume').value = item.volume;
            row.querySelector('.lh-tenaga').value = item.tenaga || '';
            row.querySelector('.lh-jam-aktif').value = item.jamAktif || 8;
            row.querySelector('.lh-jam-lembur').value = item.jamLembur || 0;
            updateLhPekerjaanInfo(rowId);

            // Sembunyikan tombol tambah pekerjaan & tombol hapus baris saat mode edit (hanya 1 item yang diedit)
            document.getElementById('btnTambahLhPekerjaan').classList.add('hidden');
            updateLhRemoveButtonsState();
            document.getElementById('lhFormTitle').innerText = 'Edit Laporan Harian (1 Item Pekerjaan)';
            document.getElementById('btnCancelLhEdit').classList.remove('hidden');
            window.scrollTo({ top: 150, behavior: 'smooth' });
        }

        function cancelLhEdit() {
            document.getElementById('lhEditId').value = '';
            document.getElementById('formLapHarian').reset();
            resetLhPekerjaanRows();
            document.getElementById('lhFormTitle').innerText = 'Buat / Edit Laporan Harian Baru';
            document.getElementById('btnCancelLhEdit').classList.add('hidden');
        }

        function deleteLapHarian(id) {
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            if (confirm('Hapus laporan harian ini?')) {
                lapHarianData = lapHarianData.filter(l => l.id != id);
                localStorage.setItem('erp_lap_harian', JSON.stringify(lapHarianData));
                renderLapHarian();
            }
        }

        function resetLhFilterDate() {
            document.getElementById('lhFilterDate').value = '';
            renderLapHarian();
        }

        // ===================================================================
        // 2.1.b KENDALA & NOTULEN HARIAN (TERPISAH, 1X INPUT PER TANGGAL, BISA DIEDIT)

        // ===================================================================
        // PEMBAYARAN MATERIAL (khusus): ambil data dasar dari Material Order, admin hanya menambahkan
        // biaya tambahan (Ongkir, Admin, Pajak, dll) secara lengkap. Total = Harga Dasar + Biaya Tambahan.
        // ===================================================================
        let pmTambahanDraft = []; // [{id, label, nominal}] draft biaya tambahan yang sedang diedit di form

        function renderPayMaterialSection() {
            const orderSelect = document.getElementById('pmOrderId');
            if (orderSelect) {
                const projOrders = materialOrderData.filter(o => o.projId === activeProjectId);
                orderSelect.innerHTML = '<option value="">-- Pilih Material Order --</option>' +
                    projOrders.map(o => `<option value="${o.id}">${escapeHtml(o.nama)}${o.dimensi ? ' (' + escapeHtml(o.dimensi) + ')' : ''} - ${o.tanggal || '-'} - ${formatRupiah((o.volume || 0) * (o.harga || 0))}</option>`).join('');
            }
            if (!document.getElementById('pmTanggal').value) document.getElementById('pmTanggal').value = new Date().toISOString().split('T')[0];
            const admin = isAdminUser();
            document.getElementById('pmReadOnlyNotice').classList.toggle('hidden', admin);
            document.getElementById('pmFormBox').classList.toggle('hidden', !admin);
            renderPmTambahanList();
            updatePmTotals();
            renderPayMaterialTable();
        }

        function fillPmFromOrder() {
            const orderId = document.getElementById('pmOrderId').value;
            const box = document.getElementById('pmOrderPreview');
            const order = materialOrderData.find(o => o.id == orderId);
            if (!order) { box.innerHTML = 'Pilih PO untuk melihat harga dasarnya.'; updatePmTotals(); return; }
            box.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><strong class="text-slate-400">Material:</strong> ${escapeHtml(order.nama)}</div>
                <div><strong class="text-slate-400">Volume:</strong> ${formatAngka(order.volume)} ${escapeHtml(order.satuan || '')}</div>
                <div><strong class="text-slate-400">Harga Satuan:</strong> ${formatRupiah(order.harga)}</div>
                <div><strong class="text-slate-400">Supplier:</strong> ${escapeHtml(order.supplier) || '-'}</div>
            </div>`;
            updatePmTotals();
        }

        function addPmBiayaTambahan() {
            const labelEl = document.getElementById('pmTambahanLabel');
            const nominalEl = document.getElementById('pmTambahanNominal');
            const label = labelEl.value.trim();
            const nominal = parseFloat(nominalEl.value);
            if (!label) { alert('Nama biaya tambahan wajib diisi (mis. Ongkir, Admin, Pajak).'); return; }
            if (isNaN(nominal) || nominal <= 0) { alert('Nominal biaya harus lebih dari 0.'); return; }
            pmTambahanDraft.push({ id: Date.now() + Math.random(), label, nominal });
            labelEl.value = ''; nominalEl.value = '';
            renderPmTambahanList();
            updatePmTotals();
        }

        function removePmBiayaTambahan(id) {
            pmTambahanDraft = pmTambahanDraft.filter(b => b.id !== id);
            renderPmTambahanList();
            updatePmTotals();
        }

        function renderPmTambahanList() {
            const el = document.getElementById('pmTambahanList');
            if (!el) return;
            if (pmTambahanDraft.length === 0) { el.innerHTML = '<div class="text-[11px] text-slate-500 italic">Belum ada biaya tambahan. Tambahkan Ongkir/Admin/Pajak/dll di atas.</div>'; return; }
            el.innerHTML = pmTambahanDraft.map(b => `
                <div class="flex items-center justify-between bg-[#1c2541] border border-slate-700 rounded-lg px-3 py-1.5 text-xs">
                    <span class="text-slate-200 font-medium">${escapeHtml(b.label)}</span>
                    <div class="flex items-center space-x-3">
                        <span class="font-mono text-indigo-300">${formatRupiah(b.nominal)}</span>
                        <button type="button" onclick="removePmBiayaTambahan(${b.id})" class="text-red-400 hover:text-red-300 px-1" title="Hapus"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>`).join('');
        }

        function updatePmTotals() {
            const orderId = document.getElementById('pmOrderId').value;
            const order = materialOrderData.find(o => o.id == orderId);
            const hargaDasar = order ? (order.volume || 0) * (order.harga || 0) : 0;
            const totalTambahan = pmTambahanDraft.reduce((a, c) => a + (Number(c.nominal) || 0), 0);
            document.getElementById('pmHargaDasarView').innerText = formatRupiah(hargaDasar);
            document.getElementById('pmTotalView').innerText = formatRupiah(hargaDasar + totalTambahan);
        }

        function handlePayMaterialSubmit(e) {
            e.preventDefault();
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat mengisi Pembayaran Material.'); return; }
            const orderId = document.getElementById('pmOrderId').value;
            const order = materialOrderData.find(o => o.id == orderId);
            if (!order) { alert('Pilih PO Material Order terlebih dahulu.'); return; }
            const tanggal = document.getElementById('pmTanggal').value;
            const hargaDasar = (order.volume || 0) * (order.harga || 0);
            const biayaTambahan = pmTambahanDraft.map(b => ({ ...b }));
            const totalTambahan = biayaTambahan.reduce((a, c) => a + (Number(c.nominal) || 0), 0);
            const jumlah = hargaDasar + totalTambahan;
            const payload = {
                kategori: 'material', tanggal, nama: order.nama, uraian: biayaTambahan.map(b => b.label).join(', ') || '-',
                jumlah, orderId: order.id, hargaDasar, biayaTambahan, metodeBayar: 'Transfer Bank', keterangan: ''
            };
            const editId = document.getElementById('pmEditId').value;
            if (editId) {
                const idx = payData.findIndex(d => d.id == editId);
                if (idx !== -1) payData[idx] = { ...payData[idx], ...payload };
            } else {
                payData.push({ id: Date.now() + Math.random(), projId: activeProjectId, ...payload });
            }
            localStorage.setItem('erp_pay', JSON.stringify(payData));
            cancelPayMaterialEdit();
            renderPayMaterialTable();
        }

        function editPayMaterialItem(id) {
            const item = payData.find(d => d.id === id);
            if (!item) return;
            document.getElementById('pmEditId').value = id;
            document.getElementById('pmTanggal').value = item.tanggal || '';
            document.getElementById('pmOrderId').value = item.orderId || '';
            pmTambahanDraft = (item.biayaTambahan || []).map(b => ({ ...b }));
            fillPmFromOrder();
            renderPmTambahanList();
            updatePmTotals();
            document.getElementById('pmFormTitle').innerText = 'Edit Pembayaran Material';
            document.getElementById('pmSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
            document.getElementById('pmCancelBtn').classList.remove('hidden');
            document.getElementById('pmFormBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function cancelPayMaterialEdit() {
            document.getElementById('pmEditId').value = '';
            const form = document.getElementById('formPayMaterial');
            if (form) form.reset();
            pmTambahanDraft = [];
            renderPmTambahanList();
            const preview = document.getElementById('pmOrderPreview');
            if (preview) preview.innerHTML = 'Pilih PO untuk melihat harga dasarnya.';
            document.getElementById('pmTanggal').value = new Date().toISOString().split('T')[0];
            updatePmTotals();
            document.getElementById('pmFormTitle').innerText = 'Tambah Pembayaran Material';
            document.getElementById('pmSubmitBtn').innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Simpan Pembayaran';
            document.getElementById('pmCancelBtn').classList.add('hidden');
        }

        function deletePayMaterialItem(id) {
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat menghapus data ini.'); return; }
            if (!confirm('Hapus data pembayaran material ini?')) return;
            payData = payData.filter(d => d.id !== id);
            localStorage.setItem('erp_pay', JSON.stringify(payData));
            renderPayMaterialTable();
        }

        function renderPayMaterialTable() {
            const tbody = document.getElementById('payMaterialTableBody');
            if (!tbody) return;
            const admin = isAdminUser();
            const data = payData.filter(d => d.projId === activeProjectId && d.kategori === 'material').sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
            if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">Belum ada data pembayaran material.</td></tr>`; return; }
            tbody.innerHTML = data.map(item => {
                const tambahanText = (item.biayaTambahan || []).map(b => `${escapeHtml(b.label)}: ${formatRupiah(b.nominal)}`).join('<br>') || '-';
                const aksi = admin ? `<button onclick="editPayMaterialItem(${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button><button onclick="deletePayMaterialItem(${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>` : '-';
                return `<tr class="hover:bg-slate-800/50 transition">
                    <td class="p-3 font-mono text-amber-400">${item.tanggal || '-'}</td>
                    <td class="p-3 font-bold text-white">${escapeHtml(item.nama)}</td>
                    <td class="p-3 font-mono text-slate-300">${formatRupiah(item.hargaDasar || 0)}</td>
                    <td class="p-3 text-[11px] text-slate-400">${tambahanText}</td>
                    <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(item.jumlah)}</td>
                    <td class="p-3 text-center">${aksi}</td>
                </tr>`;
            }).join('');
        }

        // ===================================================================
        // PEMBAYARAN SUBKON: Nilai Kontrak per Subkon + 4 jenis transaksi
        // (Pengambilan Dana & Pajak = keluar; Pembayaran Utang & Pengembalian/Ganti Rugi = masuk)
        // ===================================================================
        let skSelectedKaryawanId = null;
        let skTransaksiEditId = null;

        function getSubkonList() {
            return karyawanData.filter(k => k.projId === activeProjectId && k.kategori === 'Subkon');
        }

        function renderPaySubkonSection() {
            const admin = isAdminUser();
            document.getElementById('skReadOnlyNotice').classList.toggle('hidden', admin);
            const formBox = document.getElementById('skFormBox');
            if (formBox) formBox.classList.toggle('hidden', !admin);

            const sel = document.getElementById('skSubkonSelect');
            const list = getSubkonList();
            if (list.length === 0) {
                sel.innerHTML = '';
                document.getElementById('skEmptyState').classList.remove('hidden');
                document.getElementById('skContent').classList.add('hidden');
                skSelectedKaryawanId = null;
                return;
            }
            document.getElementById('skEmptyState').classList.add('hidden');
            document.getElementById('skContent').classList.remove('hidden');
            if (!skSelectedKaryawanId || !list.some(k => k.id === skSelectedKaryawanId)) {
                skSelectedKaryawanId = list[0].id;
            }
            sel.innerHTML = list.map(k => `<option value="${k.id}" ${k.id === skSelectedKaryawanId ? 'selected' : ''}>${escapeHtml(k.nama)}</option>`).join('');
            cancelSkTransaksiEdit();
            renderSkDetail();
        }

        function handleSkSubkonChange() {
            const sel = document.getElementById('skSubkonSelect');
            skSelectedKaryawanId = sel ? Number(sel.value) : null;
            cancelSkTransaksiEdit();
            renderSkDetail();
        }

        function renderSkDetail() {
            const k = karyawanData.find(x => x.id === skSelectedKaryawanId);
            const kontrakInput = document.getElementById('skNilaiKontrakInput');
            if (kontrakInput) kontrakInput.value = k ? (k.nilaiKontrak || 0) : 0;
            populateSkWeekFilter();
            renderSkTransaksiTable();
            renderSkSummaryCards();
        }

        function saveSkNilaiKontrak() {
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat mengubah Nilai Kontrak.'); return; }
            const k = karyawanData.find(x => x.id === skSelectedKaryawanId);
            if (!k) return;
            k.nilaiKontrak = parseFloat(document.getElementById('skNilaiKontrakInput').value) || 0;
            localStorage.setItem('erp_karyawan', JSON.stringify(karyawanData));
            renderSkSummaryCards();
            alert('Nilai Kontrak Subkon berhasil disimpan.');
        }

        function updateSkFormFields() {
            const jenis = document.getElementById('skJenis').value;
            const persenBox = document.getElementById('skPersentaseBox');
            const nominalInput = document.getElementById('skNominal');
            const nominalLabel = document.getElementById('skNominalLabel');
            if (jenis === 'pengambilan') {
                persenBox.classList.remove('hidden');
                nominalInput.readOnly = true;
                nominalLabel.innerText = 'Nominal (Rp) - otomatis dari %';
                updateSkNominalPreview();
            } else {
                persenBox.classList.add('hidden');
                nominalInput.readOnly = false;
                nominalInput.value = '';
                nominalLabel.innerText = 'Nominal (Rp)';
            }
        }

        function updateSkNominalPreview() {
            const jenis = document.getElementById('skJenis').value;
            if (jenis !== 'pengambilan') return;
            const k = karyawanData.find(x => x.id === skSelectedKaryawanId);
            const persen = parseFloat(document.getElementById('skPersentase').value) || 0;
            const nilaiKontrak = k ? (k.nilaiKontrak || 0) : 0;
            const nominal = nilaiKontrak * (persen / 100);
            document.getElementById('skNominal').value = nominal ? nominal.toFixed(2) : '';
        }

        function handleSkTransaksiSubmit(e) {
            e.preventDefault();
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat mengisi transaksi Subkon.'); return; }
            if (!skSelectedKaryawanId) { alert('Pilih Subkon terlebih dahulu.'); return; }
            const jenis = document.getElementById('skJenis').value;
            const tanggal = document.getElementById('skTanggal').value;
            const persentase = jenis === 'pengambilan' ? (parseFloat(document.getElementById('skPersentase').value) || 0) : null;
            const nominal = parseFloat(document.getElementById('skNominal').value) || 0;
            const keterangan = document.getElementById('skKeterangan').value.trim();
            if (!tanggal) { alert('Tanggal wajib diisi.'); return; }
            if (nominal <= 0) { alert('Nominal harus lebih dari 0.'); return; }

            const k = karyawanData.find(x => x.id === skSelectedKaryawanId);
            const payload = {
                kategori: 'subkon', tanggal, nama: k ? k.nama : '-', uraian: (SUBKON_JENIS_INFO[jenis] || {}).label || jenis,
                jumlah: nominal, karyawanId: skSelectedKaryawanId, jenis, persentase, keterangan, metodeBayar: 'Transfer Bank'
            };
            if (skTransaksiEditId) {
                const idx = payData.findIndex(d => d.id === skTransaksiEditId);
                if (idx !== -1) payData[idx] = { ...payData[idx], ...payload };
            } else {
                payData.push({ id: Date.now() + Math.random(), projId: activeProjectId, ...payload });
            }
            localStorage.setItem('erp_pay', JSON.stringify(payData));
            cancelSkTransaksiEdit();
            renderSkDetail();
        }

        function editSkTransaksi(id) {
            const item = payData.find(d => d.id === id);
            if (!item) return;
            skTransaksiEditId = id;
            document.getElementById('skTanggal').value = item.tanggal || '';
            document.getElementById('skJenis').value = item.jenis;
            updateSkFormFields();
            if (item.jenis === 'pengambilan') document.getElementById('skPersentase').value = item.persentase || '';
            document.getElementById('skNominal').value = item.jumlah;
            document.getElementById('skKeterangan').value = item.keterangan || '';
            document.getElementById('skFormTitle').innerText = 'Edit Transaksi Subkon';
            document.getElementById('skSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
            document.getElementById('skCancelBtn').classList.remove('hidden');
            document.getElementById('skFormBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function cancelSkTransaksiEdit() {
            skTransaksiEditId = null;
            const form = document.getElementById('formSkTransaksi');
            if (form) form.reset();
            const jenisSel = document.getElementById('skJenis');
            if (jenisSel) jenisSel.value = 'pengambilan';
            updateSkFormFields();
            const tglInput = document.getElementById('skTanggal');
            if (tglInput) tglInput.value = new Date().toISOString().split('T')[0];
            const titleEl = document.getElementById('skFormTitle');
            if (titleEl) titleEl.innerText = 'Tambah Transaksi Subkon';
            const submitBtn = document.getElementById('skSubmitBtn');
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Simpan Transaksi';
            const cancelBtn = document.getElementById('skCancelBtn');
            if (cancelBtn) cancelBtn.classList.add('hidden');
        }

        function deleteSkTransaksi(id) {
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat menghapus data ini.'); return; }
            if (!confirm('Hapus transaksi ini?')) return;
            payData = payData.filter(d => d.id !== id);
            localStorage.setItem('erp_pay', JSON.stringify(payData));
            if (skTransaksiEditId === id) cancelSkTransaksiEdit();
            renderSkDetail();
        }

        function populateSkWeekFilter() {
            const sel = document.getElementById('skFilterMinggu');
            if (!sel) return;
            const proj = projects.find(p => p.id === activeProjectId) || {};
            const curVal = sel.value;
            const totalWeeks = (typeof getProjectScheduleWeeks === 'function') ? getProjectScheduleWeeks() : 12;
            let html = '<option value="">Semua Minggu</option>';
            for (let w = 1; w <= totalWeeks; w++) {
                const range = (typeof getWeekDateRangeDetailed === 'function') ? getWeekDateRangeDetailed(w, proj.tglMulai, proj.tglSelesai) : null;
                html += `<option value="${w}">Minggu ${w}${range ? ' (' + range.labelShort + ')' : ''}</option>`;
            }
            sel.innerHTML = html;
            if (curVal && [...sel.options].some(o => o.value === curVal)) sel.value = curVal;
        }

        function renderSkTransaksiTable() {
            const tbody = document.getElementById('skTransaksiTableBody');
            if (!tbody || !skSelectedKaryawanId) return;
            const admin = isAdminUser();
            let data = payData.filter(d => d.projId === activeProjectId && d.kategori === 'subkon' && d.karyawanId === skSelectedKaryawanId);

            const weekFilter = document.getElementById('skFilterMinggu') ? document.getElementById('skFilterMinggu').value : '';
            if (weekFilter) {
                const proj = projects.find(p => p.id === activeProjectId) || {};
                const range = (typeof getWeekDateRangeDetailed === 'function') ? getWeekDateRangeDetailed(parseInt(weekFilter, 10), proj.tglMulai, proj.tglSelesai) : null;
                if (range) {
                    const startStr = range.start.toISOString().split('T')[0];
                    const endStr = range.end.toISOString().split('T')[0];
                    data = data.filter(d => d.tanggal >= startStr && d.tanggal <= endStr);
                }
            }
            data = data.slice().sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);

            if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">Belum ada transaksi untuk periode ini.</td></tr>`; return; }
            tbody.innerHTML = data.map(item => {
                const info = SUBKON_JENIS_INFO[item.jenis] || { label: item.jenis, arah: 'keluar', badge: '' };
                const aksi = admin ? `<button onclick="editSkTransaksi(${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button><button onclick="deleteSkTransaksi(${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>` : '-';
                return `<tr class="hover:bg-slate-800/50 transition">
                    <td class="p-3 font-mono text-amber-400">${item.tanggal || '-'}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${info.badge}">${info.label}</span></td>
                    <td class="p-3 font-mono">${item.persentase != null ? formatAngka(item.persentase) + '%' : '-'}</td>
                    <td class="p-3 font-mono font-bold ${info.arah === 'masuk' ? 'text-emerald-400' : 'text-red-400'}">${info.arah === 'masuk' ? '+' : '-'}${formatRupiah(item.jumlah)}</td>
                    <td class="p-3 text-[11px] text-slate-400">${escapeHtml(item.keterangan) || '-'}</td>
                    <td class="p-3 text-center">${aksi}</td>
                </tr>`;
            }).join('');
        }

        function renderSkSummaryCards() {
            const k = karyawanData.find(x => x.id === skSelectedKaryawanId);
            const nilaiKontrak = k ? (k.nilaiKontrak || 0) : 0;
            const allData = payData.filter(d => d.projId === activeProjectId && d.kategori === 'subkon' && d.karyawanId === skSelectedKaryawanId);
            const sum = (jenis) => allData.filter(d => d.jenis === jenis).reduce((a, c) => a + (Number(c.jumlah) || 0), 0);
            const totalPengambilan = sum('pengambilan');
            document.getElementById('skSumKontrak').innerText = formatRupiah(nilaiKontrak);
            document.getElementById('skSumPengambilan').innerText = formatRupiah(totalPengambilan);
            document.getElementById('skSumSisa').innerText = formatRupiah(Math.max(0, nilaiKontrak - totalPengambilan));
            document.getElementById('skSumPajak').innerText = formatRupiah(sum('pajak'));
            document.getElementById('skSumUtang').innerText = formatRupiah(sum('utang'));
            document.getElementById('skSumPengembalian').innerText = formatRupiah(sum('pengembalian'));
        }

        // ===================================================================
        // PEMBAYARAN TERMIN: Nilai Kontrak otomatis dari RAB (di luar PPN/PPH) = Subtotal Fisik + Biaya
        // Tambahan. Tiap termin = Persentase x Nilai Kontrak, dikurangi Pajak & PPh per termin (netto).
        // ===================================================================
        function getRabKontrakValue(projId) {
            const projRAB = rabData.filter(r => r.projId === projId);
            const subtotal = projRAB.reduce((a, c) => a + (c.volume * c.harga), 0);
            const proj = projects.find(p => p.id === projId) || {};
            const biayaTambahan = Array.isArray(proj.biayaTambahan) ? proj.biayaTambahan : [];
            const totalPersenTambahan = biayaTambahan.reduce((a, c) => a + (Number(c.persen) || 0), 0);
            const tambahanVal = subtotal * (totalPersenTambahan / 100);
            return subtotal + tambahanVal;
        }

        function getTerminTotalNettoAndPersen(projId) {
            const data = payData.filter(d => d.projId === projId && d.kategori === 'termin');
            return {
                totalNetto: data.reduce((a, c) => a + (Number(c.jumlah) || 0), 0),
                totalPersen: data.reduce((a, c) => a + (Number(c.persentase) || 0), 0)
            };
        }

        function renderPayTerminSection() {
            const admin = isAdminUser();
            document.getElementById('tmReadOnlyNotice').classList.toggle('hidden', admin);
            document.getElementById('tmFormBox').classList.toggle('hidden', !admin);
            if (!document.getElementById('tmTanggal').value) document.getElementById('tmTanggal').value = new Date().toISOString().split('T')[0];
            cancelTerminEdit();
            renderPayTerminTable();
        }

        function updateTerminPreview() {
            const kontrak = getRabKontrakValue(activeProjectId);
            const persen = parseFloat(document.getElementById('tmPersentase').value) || 0;
            const pajak = parseFloat(document.getElementById('tmPajak').value) || 0;
            const pph = parseFloat(document.getElementById('tmPph').value) || 0;
            const nominal = kontrak * (persen / 100);
            const netto = Math.max(0, nominal - pajak - pph);
            const box = document.getElementById('tmPreviewBox');
            if (box) box.innerHTML = `<div class="text-[11px] bg-[#0b132b] border border-slate-700 rounded-lg p-3 text-slate-300">Nilai Kontrak: <b class="text-white">${formatRupiah(kontrak)}</b> &middot; Nominal Termin (${formatAngka(persen)}%): <b class="text-sky-300">${formatRupiah(nominal)}</b> &middot; Netto Diterima: <b class="text-emerald-400">${formatRupiah(netto)}</b></div>`;
        }

        function handleTerminSubmit(e) {
            e.preventDefault();
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat mengisi Pembayaran Termin.'); return; }
            const tanggal = document.getElementById('tmTanggal').value;
            const persentase = parseFloat(document.getElementById('tmPersentase').value) || 0;
            const pajak = parseFloat(document.getElementById('tmPajak').value) || 0;
            const pph = parseFloat(document.getElementById('tmPph').value) || 0;
            const keterangan = document.getElementById('tmKeterangan').value.trim();
            if (!tanggal) { alert('Tanggal wajib diisi.'); return; }
            if (persentase <= 0) { alert('Persentase harus lebih dari 0.'); return; }
            const kontrak = getRabKontrakValue(activeProjectId);
            const nominalTermin = kontrak * (persentase / 100);
            const jumlah = Math.max(0, nominalTermin - pajak - pph);
            const editId = document.getElementById('tmEditId').value;
            const existingCount = payData.filter(d => d.projId === activeProjectId && d.kategori === 'termin' && d.id != editId).length;
            const nama = keterangan || `Termin ${existingCount + 1}`;
            const payload = { kategori: 'termin', tanggal, nama, uraian: keterangan, jumlah, persentase, nominalTermin, pajak, pph, keterangan, metodeBayar: 'Transfer Bank' };
            if (editId) {
                const idx = payData.findIndex(d => d.id == editId);
                if (idx !== -1) payData[idx] = { ...payData[idx], ...payload };
            } else {
                payData.push({ id: Date.now() + Math.random(), projId: activeProjectId, ...payload });
            }
            localStorage.setItem('erp_pay', JSON.stringify(payData));
            cancelTerminEdit();
            renderPayTerminTable();
        }

        function editTerminItem(id) {
            const item = payData.find(d => d.id === id);
            if (!item) return;
            document.getElementById('tmEditId').value = id;
            document.getElementById('tmTanggal').value = item.tanggal || '';
            document.getElementById('tmPersentase').value = item.persentase || '';
            document.getElementById('tmPajak').value = item.pajak || '';
            document.getElementById('tmPph').value = item.pph || '';
            document.getElementById('tmKeterangan').value = item.keterangan || '';
            updateTerminPreview();
            document.getElementById('tmFormTitle').innerText = 'Edit Termin';
            document.getElementById('tmSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
            document.getElementById('tmCancelBtn').classList.remove('hidden');
            document.getElementById('tmFormBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function cancelTerminEdit() {
            document.getElementById('tmEditId').value = '';
            const form = document.getElementById('formTermin');
            if (form) form.reset();
            document.getElementById('tmTanggal').value = new Date().toISOString().split('T')[0];
            updateTerminPreview();
            document.getElementById('tmFormTitle').innerText = 'Tambah Termin';
            document.getElementById('tmSubmitBtn').innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Simpan Termin';
            document.getElementById('tmCancelBtn').classList.add('hidden');
        }

        function deleteTerminItem(id) {
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat menghapus data ini.'); return; }
            if (!confirm('Hapus data termin ini?')) return;
            payData = payData.filter(d => d.id !== id);
            localStorage.setItem('erp_pay', JSON.stringify(payData));
            renderPayTerminTable();
        }

        function renderPayTerminTable() {
            const tbody = document.getElementById('payTerminTableBody');
            if (!tbody) return;
            const admin = isAdminUser();
            document.getElementById('tmSumKontrak').innerText = formatRupiah(getRabKontrakValue(activeProjectId));
            const data = payData.filter(d => d.projId === activeProjectId && d.kategori === 'termin').sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || a.id - b.id);
            const { totalNetto, totalPersen } = getTerminTotalNettoAndPersen(activeProjectId);
            document.getElementById('tmSumNetto').innerText = formatRupiah(totalNetto);
            document.getElementById('tmSumPersen').innerText = formatAngka(totalPersen) + '%';
            if (data.length === 0) { tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-500">Belum ada data termin.</td></tr>`; return; }
            tbody.innerHTML = data.map(item => {
                const aksi = admin ? `<button onclick="editTerminItem(${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button><button onclick="deleteTerminItem(${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>` : '-';
                return `<tr class="hover:bg-slate-800/50 transition">
                    <td class="p-3 font-mono text-amber-400">${item.tanggal || '-'}</td>
                    <td class="p-3 font-bold text-white">${escapeHtml(item.keterangan) || escapeHtml(item.nama)}</td>
                    <td class="p-3 font-mono">${formatAngka(item.persentase)}%</td>
                    <td class="p-3 font-mono text-slate-300">${formatRupiah(item.nominalTermin)}</td>
                    <td class="p-3 font-mono text-red-400">${formatRupiah(item.pajak)}</td>
                    <td class="p-3 font-mono text-red-400">${formatRupiah(item.pph)}</td>
                    <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(item.jumlah)}</td>
                    <td class="p-3 text-center">${aksi}</td>
                </tr>`;
            }).join('');
        }

        // ===================================================================
        // PEMBAYARAN INVESTOR: settings (Modal & Persentase Keuntungan) + kartu pengembalian modal
        // otomatis dari kumulatif Termin (netto), capped di Nilai Modal. Keuntungan = Persentase x Modal.
        // ===================================================================
        function computeInvestorWaterfall(projId) {
            const proj = projects.find(p => p.id === projId) || {};
            const modal = Number(proj.investorModal) || 0;
            const persen = Number(proj.investorProfitPersen) || 0;
            const { totalNetto: totalTermin } = getTerminTotalNettoAndPersen(projId);
            const dikembalikan = Math.min(totalTermin, modal);
            const sisa = Math.max(0, modal - dikembalikan);
            const keuntungan = modal * (persen / 100);
            return { modal, persen, totalTermin, dikembalikan, sisa, keuntungan };
        }

        function renderPayInvestorSection() {
            const admin = isAdminUser();
            document.getElementById('ivReadOnlyNotice').classList.toggle('hidden', admin);
            document.getElementById('ivFormBox').classList.toggle('hidden', !admin);
            const proj = projects.find(p => p.id === activeProjectId) || {};
            document.getElementById('ivModal').value = proj.investorModal || '';
            document.getElementById('ivPersen').value = proj.investorProfitPersen || '';
            renderPayInvestorCards();
        }

        function handleInvestorSettingSubmit(e) {
            e.preventDefault();
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat mengubah pengaturan Investor.'); return; }
            const proj = projects.find(p => p.id === activeProjectId);
            if (!proj) return;
            proj.investorModal = parseFloat(document.getElementById('ivModal').value) || 0;
            proj.investorProfitPersen = parseFloat(document.getElementById('ivPersen').value) || 0;
            localStorage.setItem('erp_projects', JSON.stringify(projects));
            renderPayInvestorCards();
            alert('Pengaturan Investor berhasil disimpan.');
        }

        function renderPayInvestorCards() {
            const w = computeInvestorWaterfall(activeProjectId);
            document.getElementById('ivViewModal').innerText = formatRupiah(w.modal);
            document.getElementById('ivViewTermin').innerText = formatRupiah(w.totalTermin);
            document.getElementById('ivViewDikembalikan').innerText = formatRupiah(w.dikembalikan);
            document.getElementById('ivViewSisa').innerText = formatRupiah(w.sisa);
            document.getElementById('ivViewKeuntungan').innerText = formatRupiah(w.keuntungan) + ` (${formatAngka(w.persen)}%)`;
        }
