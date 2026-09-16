        // ===================================================================
        // Baseline utk CCO nomor `nomor`: kalau nomor<=1 -> RAB Kontrak Awal (rabData); kalau nomor>1
        // -> hasil (efektif) CCO nomor-1, dihitung berantai secara rekursif.
        function getRabCcoBaselineList(projId, nomor) {
            if (nomor <= 1) return rabData.filter(r => r.projId === projId).map(r => ({ ...r }));
            return computeRabCcoResult(projId, nomor - 1);
        }

        // Hasil (daftar item efektif) SETELAH perubahan CCO `nomor` diterapkan ke baseline-nya.
        // nomor 0/negatif dianggap "belum ada CCO sama sekali" -> hasilnya = RAB Kontrak Awal apa adanya.
        function computeRabCcoResult(projId, nomor) {
            if (nomor < 1) return rabData.filter(r => r.projId === projId).map(r => ({ ...r }));
            const baseline = getRabCcoBaselineList(projId, nomor);
            const cco = rabCcoList.find(c => c.projId === projId && c.nomor === nomor);
            // Volume tiap item acuan SELALU mengikuti hasil perhitungan di halaman Volume CCO untuk CCO ini
            // (kalau item itu sudah pernah diukur di sana); kalau belum pernah diukur, volumenya tetap =
            // volume acuan (baseline) apa adanya - artinya belum ada perubahan volume yang tercatat.
            let result = baseline.map(item => ({ ...item, volume: volCcoEffectiveVolume(item, nomor) }));
            if (!cco) return result; // CCO ini belum pernah dibuat -> baseline (dgn volume dari Volume CCO) apa adanya
            const changes = rabCcoItems.filter(c => c.ccoId === cco.id).sort((a, b) => (a.order || 0) - (b.order || 0));
            changes.forEach(ch => {
                if (ch.tipe === 'hilang') {
                    result = result.filter(item => String(item.id) !== String(ch.refId));
                } else if (ch.tipe === 'baru') {
                    // Pekerjaan baru murni dibuat di RAB CCO (belum ada di acuan manapun), jadi volumenya
                    // masih diketik manual di sini - tidak melalui Volume CCO.
                    result.push({
                        id: `cco${cco.id}-${ch.id}`, projId,
                        noDiv: ch.noDiv || '', div: ch.div || '', sub: ch.sub || '', rincian: ch.rincian || '',
                        satuan: ch.satuan || '', volume: Number(ch.volumeBaru) || 0, harga: Number(ch.hargaBaru) || 0
                    });
                } else { // 'ubah' -> HANYA harga yang diambil dari sini; volume sudah mengikuti Volume CCO di atas
                    const idx = result.findIndex(item => String(item.id) === String(ch.refId));
                    if (idx !== -1 && ch.hargaBaru !== null && ch.hargaBaru !== undefined) {
                        result[idx] = { ...result[idx], harga: Number(ch.hargaBaru) };
                    }
                }
            });
            return result;
        }

        let rabCcoSelectedNomor = null; // nomor CCO yang sedang dibuka di halaman RAB CCO

        function renderRabCcoPage() {
            const notice = document.getElementById('rabCcoReadOnlyNotice');
            if (notice) applyRoleBasedUI();
            const select = document.getElementById('rabCcoSelect');
            const ccoList = rabCcoList.filter(c => c.projId === activeProjectId).sort((a, b) => a.nomor - b.nomor);

            if (ccoList.length === 0) {
                select.innerHTML = '';
                document.getElementById('rabCcoEmptyState').classList.remove('hidden');
                document.getElementById('rabCcoContent').classList.add('hidden');
                rabCcoSelectedNomor = null;
                return;
            }
            document.getElementById('rabCcoEmptyState').classList.add('hidden');
            document.getElementById('rabCcoContent').classList.remove('hidden');

            if (!rabCcoSelectedNomor || !ccoList.some(c => c.nomor === rabCcoSelectedNomor)) {
                rabCcoSelectedNomor = ccoList[ccoList.length - 1].nomor; // default ke CCO terbaru
            }
            select.innerHTML = ccoList.map(c => `<option value="${c.nomor}" ${c.nomor === rabCcoSelectedNomor ? 'selected' : ''}>CCO ${c.nomor}${c.tanggal ? ' - ' + c.tanggal : ''}</option>`).join('');

            renderRabCcoDetail();
        }

        function selectRabCco(nomorStr) {
            rabCcoSelectedNomor = parseInt(nomorStr, 10);
            renderRabCcoDetail();
        }

        // Menambah CCO baru dengan nomor urut berikutnya (tak terbatas). Baseline-nya otomatis mengikuti
        // hasil CCO sebelumnya (atau RAB Kontrak Awal kalau ini CCO 1) - tidak perlu dipilih manual.
        function addNewRabCco() {
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat menambah CCO.'); return; }
            const existing = rabCcoList.filter(c => c.projId === activeProjectId);
            const nextNomor = existing.length === 0 ? 1 : Math.max(...existing.map(c => c.nomor)) + 1;
            rabCcoList.push({
                id: Date.now(), projId: activeProjectId, nomor: nextNomor,
                tanggal: new Date().toISOString().split('T')[0]
            });
            localStorage.setItem('erp_rab_cco_list', JSON.stringify(rabCcoList));
            rabCcoSelectedNomor = nextNomor;
            renderRabCcoPage();
        }

        // Hapus CCO - HANYA boleh menghapus CCO dengan nomor TERTINGGI (paling baru) pada proyek ini, supaya
        // rantai acuan CCO 1 -> CCO 2 -> CCO 3 dst tidak putus di tengah (menghapus CCO di tengah akan membuat
        // CCO sesudahnya kehilangan acuan datanya).
        function deleteRabCco() {
            if (!isAdminUser()) { alert('Akses ditolak. Hanya Admin yang dapat menghapus CCO.'); return; }
            if (!rabCcoSelectedNomor) return;
            const existing = rabCcoList.filter(c => c.projId === activeProjectId);
            const maxNomor = Math.max(...existing.map(c => c.nomor));
            if (rabCcoSelectedNomor !== maxNomor) {
                alert(`Hanya CCO dengan nomor terbaru (CCO ${maxNomor}) yang boleh dihapus, supaya urutan acuan CCO tidak putus. Hapus dulu CCO ${maxNomor} sebelum menghapus CCO ${rabCcoSelectedNomor}.`);
                return;
            }
            if (!confirm(`Hapus CCO ${rabCcoSelectedNomor} beserta seluruh perubahan di dalamnya? Tindakan ini tidak bisa dibatalkan.`)) return;
            const cco = existing.find(c => c.nomor === rabCcoSelectedNomor);
            rabCcoList = rabCcoList.filter(c => c.id !== cco.id);
            rabCcoItems = rabCcoItems.filter(c => c.ccoId !== cco.id);
            localStorage.setItem('erp_rab_cco_list', JSON.stringify(rabCcoList));
            localStorage.setItem('erp_rab_cco_items', JSON.stringify(rabCcoItems));
            rabCcoSelectedNomor = null;
            renderRabCcoPage();
        }

        // Baris "Pekerjaan Baru" yang sedang diedit di form (belum tentu sudah tersimpan) - direset/dimuat ulang
        // setiap kali renderRabCcoDetail() dipanggil, dari rabCcoItems bertipe 'baru' milik CCO yang dipilih.
        let rabCcoBaruDraft = [];

        function renderRabCcoDetail() {
            if (!rabCcoSelectedNomor) return;
            const admin = isAdminUser();
            const cco = rabCcoList.find(c => c.projId === activeProjectId && c.nomor === rabCcoSelectedNomor);
            if (!cco) return;

            const baseline = getRabCcoBaselineList(activeProjectId, rabCcoSelectedNomor);
            const changes = rabCcoItems.filter(c => c.ccoId === cco.id);
            const changeByRef = new Map(changes.filter(c => c.refId !== null && c.refId !== undefined).map(c => [String(c.refId), c]));
            rabCcoBaruDraft = changes.filter(c => c.tipe === 'baru').map(c => ({ ...c }));

            document.getElementById('ccoBaselineLabel').innerText = rabCcoSelectedNomor <= 1 ? 'RAB Kontrak Awal' : `hasil CCO ${rabCcoSelectedNomor - 1}`;

            // ---- Tabel pekerjaan acuan (existing) ----
            const tbody = document.getElementById('rabCcoBaselineTableBody');
            if (baseline.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-500">Tidak ada item pekerjaan acuan.</td></tr>`;
            } else {
                tbody.innerHTML = baseline.map((item, idx) => {
                    const ch = changeByRef.get(String(item.id));
                    const isHilang = ch && ch.tipe === 'hilang';
                    // Volume Baru TIDAK lagi diketik manual di sini - selalu mengikuti hasil pengukuran di
                    // halaman Volume CCO untuk CCO yang sama (kalau belum pernah diukur, tetap = volume acuan).
                    const volBaru = volCcoEffectiveVolume(item, rabCcoSelectedNomor);
                    const sudahDiukur = volCcoHasMeasurement(item.id, rabCcoSelectedNomor);
                    const hargaBaru = ch && ch.tipe === 'ubah' && ch.hargaBaru !== null && ch.hargaBaru !== undefined ? ch.hargaBaru : item.harga;
                    const justifikasi = ch ? (ch.justifikasi || '') : '';
                    let statusBadge = '<span class="text-slate-600">Tetap</span>';
                    if (isHilang) {
                        statusBadge = '<span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">DIHILANGKAN</span>';
                    } else {
                        const nilaiLama = item.volume * item.harga;
                        const nilaiBaru = volBaru * hargaBaru;
                        if (Math.abs(nilaiBaru - nilaiLama) > 0.0001) {
                            statusBadge = nilaiBaru > nilaiLama
                                ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">PEKERJAAN TAMBAH</span>'
                                : '<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">PEKERJAAN KURANG</span>';
                        }
                    }
                    return `
                        <tr class="${isHilang ? 'opacity-50' : ''}">
                            <td class="p-2">${idx + 1}</td>
                            <td class="p-2 text-white">${escapeHtml(item.rincian || item.sub)}<div class="text-[10px] text-slate-500">${escapeHtml(item.div)} / ${escapeHtml(item.sub)}</div></td>
                            <td class="p-2">${escapeHtml(item.satuan)}</td>
                            <td class="p-2 font-mono text-slate-400">${formatAngka(item.volume)}</td>
                            <td class="p-2">
                                <div class="font-mono font-bold ${sudahDiukur ? 'text-sky-300' : 'text-slate-500'}">${formatAngka(volBaru)}</div>
                                <button type="button" onclick="jumpToVolCco('${item.id}')" class="text-[9px] text-amber-300 hover:text-amber-200 underline whitespace-nowrap">${sudahDiukur ? 'Ukur ulang di Volume CCO' : 'Belum diukur - ukur di Volume CCO'}</button>
                            </td>
                            <td class="p-2 font-mono text-slate-400">${formatRupiah(item.harga)}</td>
                            <td class="p-2"><input type="number" step="any" data-cco-harga="${item.id}" value="${hargaBaru}" ${admin && !isHilang ? '' : 'disabled'} class="w-28 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                            <td class="p-2" data-cco-status="${item.id}">${statusBadge}</td>
                            <td class="p-2"><input type="text" data-cco-justif="${item.id}" value="${escapeHtml(justifikasi)}" placeholder="Alasan perubahan..." ${admin ? '' : 'disabled'} class="w-40 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                            <td class="p-2 text-center">
                                ${admin ? `<button onclick="toggleRabCcoHilang('${item.id}')" class="text-[10px] px-2 py-1 rounded-lg font-bold ${isHilang ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white'}">${isHilang ? 'Batalkan' : 'Hilangkan'}</button>` : '-'}
                            </td>
                        </tr>`;
                }).join('');
            }

            renderRabCcoBaruTable();
            renderRabCcoSummary(baseline, cco);
        }

        // Tombol "Hilangkan/Batalkan" di tabel acuan langsung tersimpan on-click (bukan menunggu tombol Simpan
        // di bawah), supaya baris yang dihilangkan langsung hilang dari daftar/summary tanpa membingungkan.
        function toggleRabCcoHilang(refId) {
            if (!isAdminUser()) return;
            const cco = rabCcoList.find(c => c.projId === activeProjectId && c.nomor === rabCcoSelectedNomor);
            if (!cco) return;
            const idx = rabCcoItems.findIndex(c => c.ccoId === cco.id && String(c.refId) === String(refId));
            if (idx !== -1 && rabCcoItems[idx].tipe === 'hilang') {
                // Batalkan status dihilangkan
                rabCcoItems.splice(idx, 1);
            } else {
                // Hapus dulu perubahan volume/harga lama pada item ini (kalau ada), lalu tandai dihilangkan
                rabCcoItems = rabCcoItems.filter(c => !(c.ccoId === cco.id && String(c.refId) === String(refId)));
                rabCcoItems.push({ id: Date.now(), projId: activeProjectId, ccoId: cco.id, refId, tipe: 'hilang', justifikasi: '', order: rabCcoItems.length + 1 });
            }
            localStorage.setItem('erp_rab_cco_items', JSON.stringify(rabCcoItems));
            renderRabCcoDetail();
        }

        function renderRabCcoBaruTable() {
            const tbody = document.getElementById('rabCcoBaruTableBody');
            const admin = isAdminUser();
            if (rabCcoBaruDraft.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500">Belum ada pekerjaan baru ditambahkan.</td></tr>`;
                return;
            }
            tbody.innerHTML = rabCcoBaruDraft.map((row, idx) => `
                <tr>
                    <td class="p-2">${idx + 1}</td>
                    <td class="p-2"><input type="text" data-baru-nodiv="${idx}" value="${escapeHtml(row.noDiv)}" ${admin ? '' : 'disabled'} class="w-16 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                    <td class="p-2"><input type="text" data-baru-div="${idx}" value="${escapeHtml(row.div)}" ${admin ? '' : 'disabled'} class="w-28 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                    <td class="p-2"><input type="text" data-baru-sub="${idx}" value="${escapeHtml(row.sub)}" ${admin ? '' : 'disabled'} class="w-28 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                    <td class="p-2"><input type="text" data-baru-rincian="${idx}" value="${escapeHtml(row.rincian)}" ${admin ? '' : 'disabled'} class="w-36 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                    <td class="p-2"><input type="text" data-baru-satuan="${idx}" value="${escapeHtml(row.satuan)}" ${admin ? '' : 'disabled'} class="w-16 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                    <td class="p-2"><input type="number" step="any" data-baru-volume="${idx}" value="${row.volumeBaru ?? ''}" ${admin ? '' : 'disabled'} class="w-20 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                    <td class="p-2"><input type="number" step="any" data-baru-harga="${idx}" value="${row.hargaBaru ?? ''}" ${admin ? '' : 'disabled'} class="w-24 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                    <td class="p-2"><input type="text" data-baru-justif="${idx}" value="${escapeHtml(row.justifikasi)}" placeholder="Alasan pekerjaan baru..." ${admin ? '' : 'disabled'} class="w-40 bg-[#0b132b] border border-slate-700 rounded px-2 py-1 text-white text-xs"></td>
                    <td class="p-2 text-center">${admin ? `<button onclick="removeRabCcoBaruRow(${idx})" class="text-red-400 hover:text-red-300"><i class="fa-solid fa-trash"></i></button>` : '-'}</td>
                </tr>`).join('');
        }

        function addRabCcoBaruRow() {
            if (!isAdminUser()) return;
            rabCcoBaruDraft.push({ id: Date.now(), tipe: 'baru', noDiv: '', div: '', sub: '', rincian: '', satuan: '', volumeBaru: '', hargaBaru: '', justifikasi: '' });
            renderRabCcoBaruTable();
        }

        function removeRabCcoBaruRow(idx) {
            rabCcoBaruDraft.splice(idx, 1);
            renderRabCcoBaruTable();
        }

        function renderRabCcoSummary(baseline, cco) {
            const nilaiSebelum = baseline.reduce((a, c) => a + (c.volume * c.harga), 0);
            const hasilSesudah = computeRabCcoResult(activeProjectId, rabCcoSelectedNomor);
            const nilaiSesudah = hasilSesudah.reduce((a, c) => a + (c.volume * c.harga), 0);
            const selisih = nilaiSesudah - nilaiSebelum;
            const selisihPersen = nilaiSebelum > 0 ? (selisih / nilaiSebelum) * 100 : 0;
            document.getElementById('ccoSumSebelum').innerText = formatRupiah(nilaiSebelum);
            document.getElementById('ccoSumSesudah').innerText = formatRupiah(nilaiSesudah);
            const elRp = document.getElementById('ccoSumSelisihRp');
            const elPersen = document.getElementById('ccoSumSelisihPersen');
            elRp.innerText = (selisih >= 0 ? '+' : '') + formatRupiah(selisih);
            elRp.className = 'text-sm font-black font-mono mt-1 ' + (selisih >= 0 ? 'text-emerald-400' : 'text-red-400');
            elPersen.innerText = (selisihPersen >= 0 ? '+' : '') + selisihPersen.toFixed(2) + '%';
            elPersen.className = 'text-sm font-black font-mono mt-1 ' + (selisihPersen >= 0 ? 'text-emerald-400' : 'text-red-400');
        }

        // Simpan seluruh perubahan CCO yang sedang dibuka: baca semua input volume/harga/justifikasi baru
        // dari tabel acuan (tipe 'ubah', hanya disimpan kalau volume/harga memang berbeda dari acuan) +
        // seluruh baris "Pekerjaan Baru" dari form draft (tipe 'baru'). Baris "Dihilangkan" sudah tersimpan
        // langsung saat tombol Hilangkan diklik (lihat toggleRabCcoHilang), jadi tidak diulang di sini.
        function saveRabCcoChanges() {
            if (!isAdminUser()) { alert('Akses ditolak.'); return; }
            const cco = rabCcoList.find(c => c.projId === activeProjectId && c.nomor === rabCcoSelectedNomor);
            if (!cco) return;
            const baseline = getRabCcoBaselineList(activeProjectId, rabCcoSelectedNomor);

            // Buang dulu perubahan lama bertipe 'ubah' & 'baru' milik CCO ini (akan ditulis ulang dari form);
            // baris 'hilang' TIDAK disentuh karena sudah dikelola langsung oleh toggleRabCcoHilang().
            rabCcoItems = rabCcoItems.filter(c => !(c.ccoId === cco.id && (c.tipe === 'ubah' || c.tipe === 'baru')));

            let order = rabCcoItems.filter(c => c.ccoId === cco.id).length;
            let jumlahPerubahan = 0;

            baseline.forEach(item => {
                // Item yang sedang ditandai "Dihilangkan" dilewati - tidak perlu dicatat perubahan harga.
                const isHilang = rabCcoItems.some(c => c.ccoId === cco.id && c.tipe === 'hilang' && String(c.refId) === String(item.id));
                if (isHilang) return;
                const hargaInput = document.querySelector(`[data-cco-harga="${item.id}"]`);
                const justifInput = document.querySelector(`[data-cco-justif="${item.id}"]`);
                if (!hargaInput) return;
                const hargaBaru = parseFloat(hargaInput.value) || 0;
                const justifikasi = justifInput ? justifInput.value.trim() : '';
                // Volume TIDAK disimpan di sini lagi - otomatis mengikuti hasil pengukuran di halaman Volume
                // CCO (lihat computeRabCcoResult -> volCcoEffectiveVolume). Baris 'ubah' di sini hanya untuk
                // mencatat perubahan HARGA satuan + justifikasinya, dan hanya disimpan kalau memang berbeda
                // dari harga acuan atau ada justifikasi yang diisi (supaya alasan tetap tersimpan meski harga
                // belum berubah, mis. justifikasi untuk perubahan volume yang diukur di Volume CCO).
                if (Math.abs(hargaBaru - item.harga) > 0.0001 || justifikasi) {
                    rabCcoItems.push({
                        id: Date.now() + order, projId: activeProjectId, ccoId: cco.id, refId: item.id, tipe: 'ubah',
                        hargaBaru: hargaBaru, justifikasi, order: ++order
                    });
                    jumlahPerubahan++;
                }
            });

            rabCcoBaruDraft.forEach((row, idx) => {
                const noDiv = document.querySelector(`[data-baru-nodiv="${idx}"]`)?.value.trim() || '';
                const div = document.querySelector(`[data-baru-div="${idx}"]`)?.value.trim() || '';
                const sub = document.querySelector(`[data-baru-sub="${idx}"]`)?.value.trim() || '';
                const rincian = document.querySelector(`[data-baru-rincian="${idx}"]`)?.value.trim() || '';
                const satuan = document.querySelector(`[data-baru-satuan="${idx}"]`)?.value.trim() || '';
                const volumeBaru = parseFloat(document.querySelector(`[data-baru-volume="${idx}"]`)?.value) || 0;
                const hargaBaru = parseFloat(document.querySelector(`[data-baru-harga="${idx}"]`)?.value) || 0;
                const justifikasi = document.querySelector(`[data-baru-justif="${idx}"]`)?.value.trim() || '';
                if (!sub && !rincian) return; // baris kosong yang belum diisi sama sekali dilewati
                rabCcoItems.push({
                    id: row.id || (Date.now() + 1000 + idx), projId: activeProjectId, ccoId: cco.id, refId: null, tipe: 'baru',
                    noDiv, div, sub, rincian, satuan, volumeBaru, hargaBaru, justifikasi, order: ++order
                });
                jumlahPerubahan++;
            });

            localStorage.setItem('erp_rab_cco_items', JSON.stringify(rabCcoItems));
            alert(`Perubahan CCO ${rabCcoSelectedNomor} berhasil disimpan (${jumlahPerubahan} baris perubahan tercatat).`);
            renderRabCcoDetail();
        }

        // ===================================================================
        // 1.2 VOLUME CCO MODULE (hitung ulang volume item pekerjaan per CCO,
        //     metode hitung sama seperti Opname, hasilnya dipakai RAB CCO)
        // ===================================================================

        // Total bersih (Tambah - Kurang) hasil pengukuran utk 1 item acuan pada 1 CCO tertentu.
        function volCcoNetVolumeForItem(refId, ccoNomor) {
            const rows = volCcoData.filter(o => String(o.refId) === String(refId) && o.ccoNomor === ccoNomor);
            return rows.reduce((a, c) => a + (c.tipe === 'kurang' ? -1 : 1) * (Number(c.volume) || 0), 0);
        }
        // Apakah item ini sudah pernah diukur sama sekali di Volume CCO untuk CCO tsb.
        function volCcoHasMeasurement(refId, ccoNomor) {
            return volCcoData.some(o => String(o.refId) === String(refId) && o.ccoNomor === ccoNomor);
        }
        // Volume EFEKTIF 1 item acuan pada CCO tertentu: kalau sudah pernah diukur di Volume CCO, pakai
        // hasil pengukuran itu; kalau belum, tetap pakai volume acuan (baseline) apa adanya (belum berubah).
        function volCcoEffectiveVolume(item, ccoNomor) {
            return volCcoHasMeasurement(item.id, ccoNomor) ? volCcoNetVolumeForItem(item.id, ccoNomor) : item.volume;
        }

        let volCcoSelectedNomor = null;   // nomor CCO yang sedang dibuka di halaman Volume CCO
        let volCcoSelectedRefId = null;   // id item acuan yang sedang dibuka detailnya
        let volCcoEditRowId = null;       // id baris volCcoData yang sedang diedit (null = mode tambah baru)

        function renderVolCcoPage() {
            const select = document.getElementById('volCcoFilterSelect');
            const ccoList = rabCcoList.filter(c => c.projId === activeProjectId).sort((a, b) => a.nomor - b.nomor);

            if (ccoList.length === 0) {
                select.innerHTML = '';
                document.getElementById('volCcoEmptyState').classList.remove('hidden');
                document.getElementById('volCcoStatsWrap').classList.add('hidden');
                document.getElementById('volCcoMasterTableBody').innerHTML = '';
                document.getElementById('volCcoDetailArea').classList.add('hidden');
                volCcoSelectedNomor = null;
                return;
            }
            document.getElementById('volCcoEmptyState').classList.add('hidden');
            document.getElementById('volCcoStatsWrap').classList.remove('hidden');

            if (!volCcoSelectedNomor || !ccoList.some(c => c.nomor === volCcoSelectedNomor)) {
                volCcoSelectedNomor = ccoList[ccoList.length - 1].nomor;
            }
            select.innerHTML = ccoList.map(c => `<option value="${c.nomor}" ${c.nomor === volCcoSelectedNomor ? 'selected' : ''}>CCO ${c.nomor}${c.tanggal ? ' - ' + c.tanggal : ''}</option>`).join('');

            renderVolCcoMaster();
            renderVolCcoDetail();
        }

        function handleVolCcoChange() {
            const sel = document.getElementById('volCcoFilterSelect');
            volCcoSelectedNomor = sel ? parseInt(sel.value, 10) : null;
            volCcoSelectedRefId = null;
            renderVolCcoMaster();
            renderVolCcoDetail();
        }

        // Daftar (master list) SELURUH item pekerjaan acuan milik CCO terpilih (persis daftar "Pekerjaan
        // Acuan" di halaman RAB CCO untuk CCO yang sama), menampilkan Volume Acuan vs Volume Terukur.
        function renderVolCcoMaster() {
            const tbody = document.getElementById('volCcoMasterTableBody');
            if (!tbody || !volCcoSelectedNomor) return;
            const searchEl = document.getElementById('volCcoSearchInput');
            const query = searchEl ? searchEl.value.trim().toLowerCase() : '';

            const baseline = getRabCcoBaselineList(activeProjectId, volCcoSelectedNomor);
            const displayItems = query
                ? baseline.filter(r => [r.noDiv, r.div, r.sub, r.rincian, r.satuan].some(v => (v || '').toString().toLowerCase().includes(query)))
                : baseline;

            if (displayItems.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-500">${baseline.length === 0 ? 'Tidak ada item pekerjaan acuan pada CCO ini.' : 'Tidak ada item yang cocok dengan pencarian.'}</td></tr>`;
            } else {
                let sudahCount = 0, belumCount = 0, totalSelisih = 0;
                tbody.innerHTML = displayItems.map((item, idx) => {
                    const sudahDiukur = volCcoHasMeasurement(item.id, volCcoSelectedNomor);
                    const volTerukur = volCcoEffectiveVolume(item, volCcoSelectedNomor);
                    const selisih = volTerukur - item.volume;
                    if (sudahDiukur) sudahCount++; else belumCount++;
                    totalSelisih += selisih;
                    const statusBadge = sudahDiukur
                        ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold whitespace-nowrap"><i class="fa-solid fa-circle-check mr-1"></i>Sudah Diukur</span>'
                        : '<span class="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold whitespace-nowrap"><i class="fa-solid fa-circle-exclamation mr-1"></i>Belum Diukur</span>';
                    return `
                        <tr class="hover:bg-slate-800/50 transition">
                            <td class="p-3">${idx + 1}</td>
                            <td class="p-3 font-mono font-bold text-amber-400">${escapeHtml(item.noDiv) || '-'}</td>
                            <td class="p-3 font-semibold text-white">${escapeHtml(item.div) || '-'}</td>
                            <td class="p-3">${escapeHtml(item.sub)}</td>
                            <td class="p-3 text-slate-400">${escapeHtml(item.rincian) || ''}</td>
                            <td class="p-3 font-mono">${escapeHtml(item.satuan)}</td>
                            <td class="p-3 font-mono text-slate-400">${formatAngka(item.volume)}</td>
                            <td class="p-3 font-mono font-bold text-sky-300">${formatAngka(volTerukur)}</td>
                            <td class="p-3">${statusBadge}</td>
                            <td class="p-3 text-center">
                                <button onclick="openVolCcoDetail('${item.id}')" class="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold px-3 py-1.5 rounded-lg transition whitespace-nowrap">
                                    <i class="fa-solid fa-ruler-combined mr-1"></i>Detail Hitung
                                </button>
                            </td>
                        </tr>`;
                }).join('');
                document.getElementById('volCcoSumTotalItem').innerText = displayItems.length;
                document.getElementById('volCcoSumSudah').innerText = sudahCount;
                document.getElementById('volCcoSumBelum').innerText = belumCount;
                document.getElementById('volCcoSumSelisih').innerText = (totalSelisih >= 0 ? '+' : '') + formatAngka(totalSelisih);
            }
        }

        function openVolCcoDetail(refId) {
            volCcoSelectedRefId = refId;
            volCcoEditRowId = null;
            const detailArea = document.getElementById('volCcoDetailArea');
            detailArea.classList.remove('hidden');
            document.getElementById('formVolCco').reset();
            document.getElementById('volCcoEditId').value = '';
            cancelVolCcoEdit();
            renderVolCcoFormFields();
            renderVolCcoDetail();
            detailArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function closeVolCcoDetail() {
            volCcoSelectedRefId = null;
            volCcoEditRowId = null;
            document.getElementById('volCcoDetailArea').classList.add('hidden');
        }

        // Dipanggil dari tombol "Ukur di Volume CCO" pada halaman RAB CCO: pindah tab, pilih CCO yang sama,
        // langsung buka detail hitung utk item yang bersangkutan.
        function jumpToVolCco(refId) {
            const nomor = rabCcoSelectedNomor;
            switchTab('vol-cco');
            setTimeout(() => {
                volCcoSelectedNomor = nomor;
                renderVolCcoPage();
                openVolCcoDetail(refId);
            }, 50);
        }

        function renderVolCcoJudulInfo() {
            const infoEl = document.getElementById('volCcoJudulInfo');
            if (!infoEl) return;
            const baseline = getRabCcoBaselineList(activeProjectId, volCcoSelectedNomor);
            const item = baseline.find(r => String(r.id) === String(volCcoSelectedRefId));
            if (!item) { infoEl.innerHTML = ''; return; }
            const volTerukur = volCcoEffectiveVolume(item, volCcoSelectedNomor);
            const selisih = volTerukur - item.volume;
            const selisihColor = Math.abs(selisih) < 0.0001 ? 'text-emerald-400' : (selisih > 0 ? 'text-amber-300' : 'text-red-400');
            infoEl.innerHTML = `
                <div class="bg-[#0b132b] border border-slate-700 rounded-xl p-3 space-y-1">
                    <div class="text-white font-bold text-xs">[${escapeHtml(item.noDiv) || '-'}] ${escapeHtml(item.div) || ''} &raquo; ${escapeHtml(item.sub)} &mdash; ${escapeHtml(item.rincian)}</div>
                    <div class="text-amber-300 font-semibold text-[11px]"><i class="fa-solid fa-layer-group mr-1"></i>CCO ${volCcoSelectedNomor}</div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                        <span>Satuan: <span class="font-bold text-white">${escapeHtml(item.satuan)}</span></span>
                        <span>Volume Acuan: <span class="font-bold text-white">${formatAngka(item.volume)} ${escapeHtml(item.satuan)}</span></span>
                        <span>Volume Terukur: <span class="font-bold text-sky-300">${formatAngka(volTerukur)} ${escapeHtml(item.satuan)}</span></span>
                        <span>Selisih thd Acuan: <span class="font-bold ${selisihColor}">${selisih > 0 ? '+' : ''}${formatAngka(selisih)} ${escapeHtml(item.satuan)}</span></span>
                    </div>
                </div>`;
        }

        function renderVolCcoFormFields() {
            const metode = document.getElementById('volCcoMetode').value;
            const cfg = BQ_OPNAME_METODE[metode];
            const container = document.getElementById('volCcoFieldsContainer');
            if (!container) return;
            if (!container.dataset.built) {
                container.innerHTML = BQ_OPNAME_ALL_FIELDS.map(f => `
                    <div id="volCcoWrap_${f}">
                        <label class="block text-slate-400 mb-1"><i class="fa-solid ${BQ_OPNAME_FIELD_ICON[f]} mr-1 text-amber-400"></i><span id="volCcoLabel_${f}">${f}</span></label>
                        <input type="number" step="any" id="volCco_${f}" value="${f === 'koefisien' ? '1' : ''}" class="w-full bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-2 text-white">
                    </div>
                `).join('');
                container.dataset.built = '1';
            }
            BQ_OPNAME_ALL_FIELDS.forEach(f => {
                const wrap = document.getElementById('volCcoWrap_' + f);
                const input = document.getElementById('volCco_' + f);
                if (!wrap || !input) return;
                if (cfg.fields.includes(f)) {
                    wrap.classList.remove('hidden');
                    document.getElementById('volCcoLabel_' + f).innerText = cfg.labels[f] || f;
                    input.required = true;
                } else {
                    wrap.classList.add('hidden');
                    input.required = false;
                }
            });
            updateVolCcoFormulaPreview();
        }

        function volCcoReadFormValues() {
            const metode = document.getElementById('volCcoMetode').value;
            const cfg = BQ_OPNAME_METODE[metode];
            const vals = {};
            BQ_OPNAME_ALL_FIELDS.forEach(f => {
                const input = document.getElementById('volCco_' + f);
                vals[f] = input ? (parseFloat(input.value) || 0) : 0;
            });
            return { metode, cfg, vals };
        }

        function updateVolCcoFormulaPreview() {
            const el = document.getElementById('volCcoFormulaPreview');
            if (!el) return;
            const { metode, vals } = volCcoReadFormValues();
            const volume = computeBqOpnameVolume(metode, vals);
            const baseline = getRabCcoBaselineList(activeProjectId, volCcoSelectedNomor);
            const item = baseline.find(r => String(r.id) === String(volCcoSelectedRefId));
            el.innerText = `Hasil Volume: ${formatAngka(volume)} ${item ? item.satuan : ''}`;
        }

        function handleVolCcoSubmit(e) {
            e.preventDefault();
            if (!volCcoSelectedRefId || !volCcoSelectedNomor) { alert('Pilih item pekerjaan terlebih dahulu.'); return; }
            const { metode, vals } = volCcoReadFormValues();
            const volume = computeBqOpnameVolume(metode, vals);
            const segmen = document.getElementById('volCcoSegmen').value.trim();
            const tipe = document.getElementById('volCcoTipe').value;
            const catatan = document.getElementById('volCcoCatatan').value.trim();

            // Volume disimpan presisi penuh (tidak dibulatkan) - sama seperti prinsip di fitur Opname, supaya
            // RAB CCO yang mengambil angka ini tetap akurat sesuai input.
            const rowValues = { segmen, tipe, metode, ...vals, catatan, volume: volume, projId: activeProjectId, ccoNomor: volCcoSelectedNomor, refId: volCcoSelectedRefId };

            if (volCcoEditRowId) {
                const idx = volCcoData.findIndex(o => o.id === volCcoEditRowId);
                if (idx !== -1) volCcoData[idx] = { ...volCcoData[idx], ...rowValues };
            } else {
                const siblingOrders = volCcoData.filter(o => String(o.refId) === String(volCcoSelectedRefId) && o.ccoNomor === volCcoSelectedNomor).map(o => o.order || 0);
                const nextOrder = siblingOrders.length ? Math.max(...siblingOrders) + 1 : 1;
                volCcoData.push({ id: Date.now() + Math.random(), order: nextOrder, ...rowValues });
            }
            localStorage.setItem('erp_vol_cco', JSON.stringify(volCcoData));
            cancelVolCcoEdit();
            renderVolCcoDetail();
            renderVolCcoMaster();
        }

        function editVolCcoRow(id) {
            const row = volCcoData.find(o => o.id === id);
            if (!row) return;
            volCcoEditRowId = id;
            document.getElementById('volCcoEditId').value = id;
            document.getElementById('volCcoSegmen').value = row.segmen;
            document.getElementById('volCcoTipe').value = row.tipe;
            document.getElementById('volCcoMetode').value = row.metode;
            renderVolCcoFormFields();
            BQ_OPNAME_ALL_FIELDS.forEach(f => {
                const input = document.getElementById('volCco_' + f);
                if (input) input.value = (row[f] !== undefined && row[f] !== null) ? row[f] : (f === 'koefisien' ? 1 : '');
            });
            document.getElementById('volCcoCatatan').value = row.catatan || '';
            updateVolCcoFormulaPreview();

            document.getElementById('volCcoFormTitle').innerText = 'Edit Baris Perhitungan Volume CCO';
            const submitBtn = document.getElementById('volCcoSubmitBtn');
            submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
            document.getElementById('volCcoCancelBtn').classList.remove('hidden');
            document.getElementById('formVolCco').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function cancelVolCcoEdit() {
            volCcoEditRowId = null;
            const form = document.getElementById('formVolCco');
            if (form) form.reset();
            document.getElementById('volCcoEditId').value = '';
            document.getElementById('volCcoTipe').value = 'tambah';
            document.getElementById('volCcoMetode').value = 'plt';
            renderVolCcoFormFields();
            const titleEl = document.getElementById('volCcoFormTitle');
            if (titleEl) titleEl.innerText = 'Input Perhitungan Volume CCO';
            const submitBtn = document.getElementById('volCcoSubmitBtn');
            if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Tambah Baris Perhitungan';
            const cancelBtn = document.getElementById('volCcoCancelBtn');
            if (cancelBtn) cancelBtn.classList.add('hidden');
        }

        function deleteVolCcoRow(id) {
            if (!confirm('Hapus baris perhitungan ini?')) return;
            volCcoData = volCcoData.filter(o => o.id !== id);
            localStorage.setItem('erp_vol_cco', JSON.stringify(volCcoData));
            renderVolCcoDetail();
            renderVolCcoMaster();
        }

        function moveVolCcoRow(id, direction) {
            const siblings = volCcoData.filter(o => String(o.refId) === String(volCcoSelectedRefId) && o.ccoNomor === volCcoSelectedNomor).sort((a, b) => (a.order || 0) - (b.order || 0));
            const idx = siblings.findIndex(o => o.id === id);
            if (idx === -1) return;
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= siblings.length) return;
            const a = siblings[idx], b = siblings[targetIdx];
            const tmpOrder = a.order;
            const realIdxA = volCcoData.findIndex(o => o.id === a.id);
            const realIdxB = volCcoData.findIndex(o => o.id === b.id);
            volCcoData[realIdxA].order = b.order;
            volCcoData[realIdxB].order = tmpOrder;
            localStorage.setItem('erp_vol_cco', JSON.stringify(volCcoData));
            renderVolCcoDetail();
        }

        function renderVolCcoTable() {
            const tbody = document.getElementById('volCcoTableBody');
            if (!tbody) return;
            const rows = volCcoData.filter(o => String(o.refId) === String(volCcoSelectedRefId) && o.ccoNomor === volCcoSelectedNomor).sort((a, b) => (a.order || 0) - (b.order || 0));
            const baseline = getRabCcoBaselineList(activeProjectId, volCcoSelectedNomor);
            const item = baseline.find(r => String(r.id) === String(volCcoSelectedRefId));
            if (rows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-500">Belum ada hasil perhitungan untuk item pekerjaan ini pada CCO ${volCcoSelectedNomor}.</td></tr>`;
            } else {
                tbody.innerHTML = rows.map((row, idx) => {
                    const tipeTag = row.tipe === 'kurang'
                        ? '<span class="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[9px] font-bold ml-1.5 align-middle">KURANG</span>'
                        : '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold ml-1.5 align-middle">TAMBAH</span>';
                    return `
                        <tr>
                            <td class="p-3">${idx + 1}</td>
                            <td class="p-3 font-mono font-bold text-amber-400">${item ? (item.noDiv || '-') : '-'}</td>
                            <td class="p-3 font-semibold text-white">${item ? (item.div || '-') : '-'}</td>
                            <td class="p-3">${item ? item.sub : '-'}</td>
                            <td class="p-3 text-slate-400">${item ? (item.rincian || '') : '-'}</td>
                            <td class="p-3 font-medium text-white">${escapeHtml(row.segmen)}</td>
                            <td class="p-3 text-[11px] text-slate-400">${BQ_OPNAME_METODE[row.metode] ? BQ_OPNAME_METODE[row.metode].label : ''}<br>${bqOpnameFormulaText(row)}</td>
                            <td class="p-3 font-mono font-bold ${row.tipe === 'kurang' ? 'text-red-400' : 'text-emerald-400'}">${row.tipe === 'kurang' ? '-' : '+'}${formatAngka(row.volume)} ${item ? item.satuan : ''}${tipeTag}</td>
                            <td class="p-3 text-[11px] text-slate-400">${escapeHtml(row.catatan) || '-'}</td>
                            <td class="p-3">
                                <div class="flex items-center justify-center gap-1.5">
                                    <button onclick="moveVolCcoRow(${row.id}, 'up')" ${idx === 0 ? 'disabled' : ''} class="text-slate-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition" title="Naik"><i class="fa-solid fa-arrow-up"></i></button>
                                    <button onclick="moveVolCcoRow(${row.id}, 'down')" ${idx === rows.length - 1 ? 'disabled' : ''} class="text-slate-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition" title="Turun"><i class="fa-solid fa-arrow-down"></i></button>
                                    <button onclick="editVolCcoRow(${row.id})" class="text-sky-400 hover:text-sky-300 transition" title="Edit"><i class="fa-solid fa-pen"></i></button>
                                    <button onclick="deleteVolCcoRow(${row.id})" class="text-red-400 hover:text-red-300 transition" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>`;
                }).join('');
            }

            const summaryEl = document.getElementById('volCcoSummary');
            if (summaryEl) {
                const totalTambah = rows.filter(r => r.tipe !== 'kurang').reduce((a, c) => a + (Number(c.volume) || 0), 0);
                const totalKurang = rows.filter(r => r.tipe === 'kurang').reduce((a, c) => a + (Number(c.volume) || 0), 0);
                const totalBersih = totalTambah - totalKurang;
                const satuan = item ? item.satuan : '';
                summaryEl.innerHTML = `
                    <h3 class="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-700 pb-2 mb-3">Ringkasan Perhitungan &mdash; CCO ${volCcoSelectedNomor}</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Total Tambah</div><div class="font-bold text-emerald-400 text-sm">${formatAngka(totalTambah)} ${satuan}</div></div>
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Total Kurang</div><div class="font-bold text-red-400 text-sm">${formatAngka(totalKurang)} ${satuan}</div></div>
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Volume Terukur (Bersih)</div><div class="font-bold text-sky-300 text-sm">${formatAngka(totalBersih)} ${satuan}</div></div>
                        <div class="bg-[#0b132b] rounded-xl p-3"><div class="text-slate-400 text-[10px] uppercase">Volume Acuan</div><div class="font-bold text-white text-sm">${formatAngka(item ? item.volume : 0)} ${satuan}</div></div>
                    </div>`;
            }
        }

        function renderVolCcoDetail() {
            if (volCcoSelectedRefId) {
                const baseline = getRabCcoBaselineList(activeProjectId, volCcoSelectedNomor);
                if (!baseline.some(r => String(r.id) === String(volCcoSelectedRefId))) { volCcoSelectedRefId = null; }
            }
            if (volCcoSelectedRefId) {
                document.getElementById('volCcoDetailArea').classList.remove('hidden');
                renderVolCcoJudulInfo();
                renderVolCcoTable();
                const metodeSel = document.getElementById('volCcoMetode');
                if (metodeSel && !metodeSel.value) metodeSel.value = 'plt';
                renderVolCcoFormFields();
                BQ_OPNAME_ALL_FIELDS.forEach(f => {
                    const input = document.getElementById('volCco_' + f);
                    if (input && !input.dataset.bound) { input.addEventListener('input', updateVolCcoFormulaPreview); input.dataset.bound = '1'; }
                });
            } else {
                document.getElementById('volCcoDetailArea').classList.add('hidden');
            }
        }

        // ===================================================================
        // 2.5 LAPORAN KEUANGAN - PEMBAYARAN (generik, 6 kategori) & LABA RUGI
