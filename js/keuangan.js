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
        function renderLabaRugi() {
            const projPay = payData.filter(d => d.projId === activeProjectId);
            let totalMasuk = 0, totalKeluar = 0;
            const perKategori = {};
            Object.keys(PAY_KATEGORI).forEach(k => { perKategori[k] = { count: 0, total: 0 }; });
            projPay.forEach(d => {
                const cfg = PAY_KATEGORI[d.kategori];
                if (!cfg) return;
                perKategori[d.kategori].count++;
                perKategori[d.kategori].total += Number(d.jumlah) || 0;
                if (cfg.arah === 'masuk') totalMasuk += Number(d.jumlah) || 0;
                else totalKeluar += Number(d.jumlah) || 0;
            });
            const labaRugi = totalMasuk - totalKeluar;
            const margin = totalMasuk > 0 ? (labaRugi / totalMasuk) * 100 : 0;

            document.getElementById('lrTotalPemasukan').innerText = formatRupiah(totalMasuk);
            document.getElementById('lrTotalPengeluaran').innerText = formatRupiah(totalKeluar);
            const lrEl = document.getElementById('lrLabaRugi');
            lrEl.innerText = formatRupiah(labaRugi);
            lrEl.className = `text-2xl font-black font-mono mt-1 ${labaRugi >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
            document.getElementById('lrLabaRugiLabel').innerText = labaRugi >= 0 ? 'Laba / Untung' : 'Rugi';
            document.getElementById('lrMargin').innerText = `Margin: ${margin.toFixed(2)}%`;

            const tbody = document.getElementById('lrTableBody');
            tbody.innerHTML = Object.keys(PAY_KATEGORI).map(k => {
                const cfg = PAY_KATEGORI[k];
                const d = perKategori[k];
                const arahTotal = cfg.arah === 'masuk' ? totalMasuk : totalKeluar;
                const persen = arahTotal > 0 ? (d.total / arahTotal) * 100 : 0;
                return `
                    <tr class="hover:bg-slate-800/50 transition">
                        <td class="p-3 font-bold text-white"><i class="fa-solid ${cfg.icon} text-amber-400 mr-1.5"></i>${cfg.label}</td>
                        <td class="p-3">${cfg.arah === 'masuk' ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">PEMASUKAN</span>' : '<span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">PENGELUARAN</span>'}</td>
                        <td class="p-3 font-mono">${d.count}</td>
                        <td class="p-3 font-mono font-bold ${cfg.arah === 'masuk' ? 'text-emerald-400' : 'text-red-400'}">${formatRupiah(d.total)}</td>
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
