        // ===================================================================
        // Helper: hitung index minggu dari sebuah tanggal relatif terhadap tanggal mulai proyek.
        // maxWeeks dibuat dinamis (lihat getProjectScheduleWeeks) supaya proyek dengan durasi panjang
        // (banyak minggu) tetap terhitung semua, bukan terpotong di minggu ke-12 seperti sebelumnya.
        function getWeekIndexFromProjectStart(dateStr, projStartStr, maxWeeks) {
            if (!dateStr || !projStartStr) return null;
            const cap = maxWeeks || 12;
            const start = new Date(projStartStr);
            const d = new Date(dateStr);
            const diffDays = Math.floor((d - start) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return null;
            const wk = Math.floor(diffDays / 7) + 1;
            return wk > cap ? cap : wk;
        }

        // Hitung total kolom minggu yang perlu ditampilkan pada Matriks Time Schedule & Grafik Kurva S,
        // berdasarkan durasi proyek (tglMulai - tglSelesai) dan rencana divisi yang sudah diinput.
        // Minimum 12 minggu (tampilan semula), maksimum dibatasi 104 minggu (~2 tahun) agar tetap ringan.
        function getProjectScheduleWeeks() {
            const proj = projects.find(p => p.id === activeProjectId) || {};
            let weeks = 12;
            if (proj.tglMulai && proj.tglSelesai) {
                const start = new Date(proj.tglMulai);
                const end = new Date(proj.tglSelesai);
                const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
                if (diffDays > 0) weeks = Math.max(weeks, Math.ceil((diffDays + 1) / 7));
            }
            // Perluas jumlah minggu tampilan kalau ada rencana jadwal yang menjangkau minggu lebih jauh
            // dari perkiraan durasi proyek (mis. proyek belum diatur tanggal selesainya).
            divScheduleData.filter(d => d.projId === activeProjectId).forEach(d => {
                (d.weeks || []).forEach(w => { if (w > weeks) weeks = w; });
            });
            return Math.min(weeks, 104);
        }

        // ---- Helper Bobot Time Schedule (per Pekerjaan / Kepala Sub RAB) ----

        // Bobot total 1 pekerjaan (kepala sub) berdasarkan proporsi nilai RAB-nya thd subtotal seluruh RAB proyek
        function getSubBobotTotal(noDiv, sub) {
            const projRab = rabData.filter(r => r.projId === activeProjectId);
            const subtotal = projRab.reduce((a, c) => a + (c.volume * c.harga), 0);
            const items = projRab.filter(r => (r.noDiv || '-') === noDiv && r.sub === sub);
            const cost = items.reduce((a, c) => a + (c.volume * c.harga), 0);
            return subtotal > 0 ? (cost / subtotal) * 100 : 0;
        }

        // Subtotal nilai RAB (volume x harga) seluruh proyek aktif - dasar perhitungan konversi Volume -> Bobot%
        function getSubtotalRabProyek() {
            return rabData.filter(r => r.projId === activeProjectId).reduce((a, c) => a + (c.volume * c.harga), 0);
        }

        // Info Volume Total RAB, satuan, & harga rata-rata per satuan untuk 1 pekerjaan (kepala sub).
        // Harga rata-rata dipakai untuk mengonversi input "Volume Rencana" (fisik) pada Time Schedule
        // menjadi Bobot% (dasar perhitungan Kurva S), karena 1 kepala sub bisa terdiri dari beberapa
        // rincian item RAB dengan satuan berbeda-beda.
        function getSubVolumeInfo(noDiv, sub) {
            const items = rabData.filter(r => r.projId === activeProjectId && (r.noDiv || '-') === noDiv && r.sub === sub);
            const totalVolume = items.reduce((a, c) => a + (parseFloat(c.volume) || 0), 0);
            const totalCost = items.reduce((a, c) => a + (c.volume * c.harga), 0);
            const satuanSet = [...new Set(items.map(i => i.satuan).filter(Boolean))];
            const satuan = satuanSet.length === 1 ? satuanSet[0] : (satuanSet.length > 1 ? 'Campuran' : '-');
            const hargaRataRata = totalVolume > 0 ? (totalCost / totalVolume) : 0;
            return { totalVolume, satuan, hargaRataRata, totalCost };
        }

        // KOMPATIBILITAS DATA LAMA: sebelum update ini, 1 baris rencana jadwal menyimpan "volume" fisik yang
        // baru dikonversi ke Bobot% pakai harga rata-rata pekerjaan (bisa meleset/round-off kalau 1 kepala
        // sub terdiri dari beberapa rincian item dengan satuan/harga berbeda-beda - "Campuran"). Sekarang user
        // input Bobot% LANGSUNG (field `bobot`), jadi tidak perlu konversi lagi & tidak ada lagi celah
        // pembulatan. Baris LAMA yang belum punya field `bobot` (hanya punya `volume`) tetap dibaca dengan
        // benar lewat fallback konversi di bawah, supaya data yang sudah diinput sebelumnya tidak hilang/rusak.
        function getEntryBobot(noDiv, sub, entry) {
            if (entry.bobot !== undefined && entry.bobot !== null && entry.bobot !== '') {
                return parseFloat(entry.bobot) || 0;
            }
            const volInfo = getSubVolumeInfo(noDiv, sub);
            const subtotalProyek = getSubtotalRabProyek();
            if (volInfo.hargaRataRata <= 0 || subtotalProyek <= 0) return 0;
            return ((parseFloat(entry.volume) || 0) * volInfo.hargaRataRata / subtotalProyek) * 100;
        }

        // Total Bobot (%) yang sudah dijadwalkan utk 1 pekerjaan, dijumlahkan dari SEMUA grup bobot+minggu yang
        // sudah ada. 1 grup dgn bobot B dianggap berkomitmen TOTAL B (bukan dikali jumlah minggu) - karena B
        // adalah TOTAL bobot utk seluruh periode grup itu, yang lalu dibagi rata ke tiap minggu yang dipilih.
        // excludeId: opsional, dipakai saat mode edit agar grup yang sedang diedit tidak ikut dihitung dobel
        function getTsScheduledBobot(noDiv, sub, excludeId) {
            return divScheduleData
                .filter(d => d.projId === activeProjectId && (d.noDiv || '-') === noDiv && d.sub === sub && d.id != excludeId)
                .reduce((a, c) => a + getEntryBobot(noDiv, sub, c), 0);
        }

        // Rencana mingguan (bobot %) 1 pekerjaan, dijumlahkan dari SEMUA grup bobot+minggu pekerjaan tsb.
        // Tiap grup me-representasikan TOTAL bobot utk seluruh minggu yang dipilih pada grup itu, jadi
        // dibagi rata ke tiap minggu (bobot / jumlah minggu) - supaya kalau dijumlahkan lagi dari minggu ke
        // minggu, hasilnya balik tepat ke total bobot grup itu (dan pada akhirnya ke 100% keseluruhan
        // proyek kalau seluruh bobot RAB sudah dijadwalkan semuanya), bukan malah berlipat ganda.
        function getSubScheduleWeekly(noDiv, sub, totalWeeks) {
            const weekly = Array(totalWeeks).fill(0);
            divScheduleData
                .filter(d => d.projId === activeProjectId && (d.noDiv || '-') === noDiv && d.sub === sub)
                .forEach(entry => {
                    const jumlahMinggu = (entry.weeks || []).length;
                    if (jumlahMinggu === 0) return;
                    const bobotPerWeek = getEntryBobot(noDiv, sub, entry) / jumlahMinggu;
                    (entry.weeks || []).forEach(w => {
                        if (w >= 1 && w <= totalWeeks) weekly[w - 1] += bobotPerWeek;
                    });
                });
            return weekly;
        }

        // Populate dropdown pemilih minggu (#tsWeekPicker) dengan minggu 1..totalWeeks beserta rentang
        // tanggalnya. Minggu yang SUDAH punya rencana untuk item pekerjaan yang sedang dipilih (di luar
        // entri yang sedang diedit) disembunyikan dari pilihan - supaya tidak ada 2 entri utk minggu & item
        // yang sama (tiap minggu untuk 1 item pekerjaan cukup 1 entri saja, dengan volumenya sendiri).
        function populateTsWeekPicker() {
            const picker = document.getElementById('tsWeekPicker');
            if (!picker) return;
            const totalWeeks = getProjectScheduleWeeks();
            const proj = projects.find(p => p.id === activeProjectId) || {};
            const fmtShort = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });

            const selVal = document.getElementById('tsDivSelect') ? document.getElementById('tsDivSelect').value : '';
            const editId = document.getElementById('tsEditId') ? document.getElementById('tsEditId').value : '';
            let usedWeeks = new Set();
            if (selVal) {
                const [noDiv, sub] = selVal.split('|||');
                divScheduleData
                    .filter(d => d.projId === activeProjectId && (d.noDiv || '-') === noDiv && d.sub === sub && d.id != editId)
                    .forEach(d => (d.weeks || []).forEach(w => usedWeeks.add(w)));
            }

            const currentVal = picker.value;
            picker.innerHTML = '';
            for (let w = 1; w <= totalWeeks; w++) {
                if (usedWeeks.has(w)) continue;
                const range = getWeekDateRangeDetailed(w, proj.tglMulai, proj.tglSelesai);
                const opt = document.createElement('option');
                opt.value = w;
                opt.textContent = range ? `Minggu ke-${w} (${fmtShort(range.start)}-${fmtShort(range.end)})` : `Minggu ke-${w}`;
                picker.appendChild(opt);
            }
            if (picker.options.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Semua minggu sudah punya rencana untuk pekerjaan ini';
                picker.appendChild(opt);
            } else if (currentVal && [...picker.options].some(o => o.value === currentVal)) {
                picker.value = currentVal;
            }
        }

        // Ganti pekerjaan yang dipilih pada form - reset bobot kalau sedang membuat entri BARU (bukan mode
        // edit), supaya form selalu bersih tiap ganti pekerjaan, lalu segarkan pilihan minggu yang tersedia.
        function handleTsSubChange() {
            const editId = document.getElementById('tsEditId').value;
            if (!editId) {
                const bobotInput = document.getElementById('tsBobot');
                if (bobotInput) bobotInput.value = '';
            }
            populateTsWeekPicker();
            updateTsBobotInfo();
        }

        // Tampilkan info Bobot RAB Kontrak Pekerjaan · Sudah Dijadwalkan · Sisa Bisa Dijadwalkan (dalam %)
        // begitu pekerjaan dipilih pada form Time Schedule, sekaligus preview & validasi input Bobot+Minggu
        // yang sedang diketik. Bobot yg dimasukkan TIDAK BOLEH membuat total seluruh minggu pekerjaan ini
        // melebihi Bobot RAB Kontrak pekerjaan itu sendiri (supaya 1 pekerjaan tidak pernah dijadwalkan lebih
        // dari porsinya di Total Anggaran Proyek).
        function updateTsBobotInfo() {
            const sel = document.getElementById('tsDivSelect');
            const infoEl = document.getElementById('tsBobotInfo');
            const bobotInput = document.getElementById('tsBobot');
            if (!sel || !infoEl || !sel.value) { if (infoEl) infoEl.innerHTML = ''; return; }
            const [noDiv, sub] = sel.value.split('|||');
            const editId = document.getElementById('tsEditId').value;

            const bobotTotalPekerjaan = getSubBobotTotal(noDiv, sub);
            const sudahDijadwalkan = getTsScheduledBobot(noDiv, sub, editId || null);
            const sisaBisaDijadwalkan = Math.max(0, bobotTotalPekerjaan - sudahDijadwalkan);

            const bobotInputVal = parseFloat(bobotInput.value) || 0;
            const weekPicker = document.getElementById('tsWeekPicker');
            const mingguDipilih = weekPicker ? parseInt(weekPicker.value) : NaN;

            let warning = '';
            if (bobotInputVal > sisaBisaDijadwalkan + 0.01) {
                warning = ` <span class="text-red-400 font-bold">(Bobot melebihi sisa Bobot RAB pekerjaan ini yang bisa dijadwalkan!)</span>`;
            }

            let preview = '';
            if (mingguDipilih && bobotInputVal > 0) {
                preview = `<br>Preview Minggu ${mingguDipilih}: <span class="font-bold text-amber-300">${formatAngka(bobotInputVal)}%</span> bobot (khusus minggu ini saja)`;
            }

            infoEl.innerHTML = `Bobot RAB Kontrak Pekerjaan Ini (thd Total Anggaran Proyek): <span class="font-bold text-white">${formatAngka(bobotTotalPekerjaan)}%</span> &middot; Sudah Dijadwalkan: <span class="font-bold text-amber-300">${formatAngka(sudahDijadwalkan)}%</span> &middot; Sisa Bisa Dijadwalkan: <span class="font-bold text-emerald-400">${formatAngka(sisaBisaDijadwalkan)}%</span>${warning}${preview}`;
        }

        // Daftar seluruh periode jadwal yang sudah diinput, diurutkan berdasarkan nomor Divisi lalu tanggal mulai
        // Bantu urutkan No/Divisi RAB & Time Schedule secara alami: mendukung angka biasa (1, 2, DIV-01, dst)
        // MAUPUN angka Romawi (I, II, III, IV, V, ...), supaya urutan divisi selalu benar sesuai nilai aslinya,
        // bukan diurutkan sebagai teks biasa (yang akan membuat "IX" muncul sebelum "V", misalnya).
        function romanToInt(str) {
            const s = (str || '').toString().trim().toUpperCase();
            if (!/^[MDCLXVI]+$/.test(s)) return null;
            const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
            let total = 0;
            for (let i = 0; i < s.length; i++) {
                const cur = map[s[i]];
                const next = map[s[i + 1]];
                total += (next && cur < next) ? -cur : cur;
            }
            return total > 0 ? total : null;
        }

        // Memecah No. Divisi menjadi rangkaian token yang bisa dibandingkan secara berjenjang, supaya format
        // "V.01", "V.02", "VI.01", "VI.02" (angka Romawi + nomor urut sub) terurut benar sesuai nilai
        // angkanya (bukan sekadar urutan input), dan tidak "loncat-loncat".
        // Tiap token dikonversi: angka Romawi murni -> nilainya, angka Arab murni -> nilainya, selain itu -> teks.
        function divisionSortKey(str) {
            const s = (str || '-').toString().trim();
            const tokens = s.split(/[\s\-.\/]+/).filter(Boolean);
            if (tokens.length === 0) return [{ type: 'text', val: '' }];
            return tokens.map(t => {
                const romanVal = romanToInt(t);
                if (romanVal !== null) return { type: 'num', val: romanVal };
                if (/^\d+$/.test(t)) return { type: 'num', val: parseInt(t, 10) };
                return { type: 'text', val: t.toLowerCase() };
            });
        }

        function compareDivisionKey(a, b) {
            const ka = divisionSortKey(a);
            const kb = divisionSortKey(b);
            const len = Math.max(ka.length, kb.length);
            for (let i = 0; i < len; i++) {
                const ta = ka[i], tb = kb[i];
                if (!ta) return -1; // token yang lebih pendek (mis. "V") tampil sebelum "V.01"
                if (!tb) return 1;
                if (ta.type === 'num' && tb.type === 'num') {
                    if (ta.val !== tb.val) return ta.val - tb.val;
                    continue;
                }
                if (ta.type === 'num') return -1; // angka diprioritaskan dibanding teks
                if (tb.type === 'num') return 1;
                const cmp = ta.val.localeCompare(tb.val, undefined, { numeric: true });
                if (cmp !== 0) return cmp;
            }
            return 0;
        }

        function renderJadwalList() {
            const tbody = document.getElementById('tsJadwalListBody');
            if (!tbody) return;
            const list = divScheduleData
                .filter(d => d.projId === activeProjectId)
                .sort((a, b) => {
                    const na = (a.noDiv || '-'), nb = (b.noDiv || '-');
                    if (na !== nb) return compareDivisionKey(na, nb);
                    const aw = (a.weeks && a.weeks.length) ? Math.min(...a.weeks) : 999;
                    const bw = (b.weeks && b.weeks.length) ? Math.min(...b.weeks) : 999;
                    return aw - bw;
                });
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">Belum ada rencana jadwal yang diinput.</td></tr>`;
                return;
            }
            const projForDates = projects.find(p => p.id === activeProjectId) || {};
            const fmtShortDate = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
            tbody.innerHTML = list.map((d, i) => {
                const jumlahMinggu = (d.weeks || []).length;
                const weeksSorted = jumlahMinggu ? d.weeks.slice().sort((a, b) => a - b) : [];
                const weeksLabel = weeksSorted.length ? weeksSorted.map(w => {
                    const range = getWeekDateRangeDetailed(w, projForDates.tglMulai, projForDates.tglSelesai);
                    return range ? `M${w} (${fmtShortDate(range.start)}-${fmtShortDate(range.end)})` : `M${w}`;
                }).join(', ') : '-';
                const bobotVal = getEntryBobot(d.noDiv || '-', d.sub, d);
                return `
                <tr class="hover:bg-slate-800/50 transition">
                    <td class="p-3 font-mono text-slate-400">${i + 1}</td>
                    <td class="p-3 text-white font-semibold">${d.noDiv || '-'} - ${d.sub}</td>
                    <td class="p-3 font-mono text-amber-300 font-bold">${formatAngka(bobotVal)}%</td>
                    <td class="p-3 font-mono text-[11px]">${weeksLabel}</td>
                    <td class="p-3 text-center">
                        <button onclick="editTsSchedule(${d.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1 rounded mr-1"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="deleteTsSchedule(${d.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1 rounded"><i class="fa-solid fa-trash-can text-xs"></i></button>
                    </td>
                </tr>
            `;
            }).join('');
        }

        function editTsSchedule(id) {
            const item = divScheduleData.find(d => d.id == id);
            if (!item) return;
            document.getElementById('tsEditId').value = item.id;
            document.getElementById('tsDivSelect').value = `${item.noDiv || '-'}|||${item.sub}`;
            const bobotVal = getEntryBobot(item.noDiv || '-', item.sub, item);
            document.getElementById('tsBobot').value = Math.round(bobotVal * 1e6) / 1e6;
            populateTsWeekPicker();
            const mingguItem = Array.isArray(item.weeks) && item.weeks.length ? item.weeks[0] : '';
            document.getElementById('tsWeekPicker').value = mingguItem;
            document.getElementById('tsFormTitle').innerText = 'Edit Rencana Bobot & Minggu Pekerjaan';
            document.getElementById('btnCancelTsEdit').classList.remove('hidden');
            updateTsBobotInfo();
            window.scrollTo({ top: 150, behavior: 'smooth' });
        }

        function deleteTsSchedule(id) {
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            if (!confirm('Hapus rencana jadwal ini?')) return;
            divScheduleData = divScheduleData.filter(d => d.id != id);
            localStorage.setItem('erp_div_schedule', JSON.stringify(divScheduleData));
            renderJadwalList();
            renderTimeSchedule();
        }

        function cancelTsScheduleEdit() {
            document.getElementById('tsEditId').value = '';
            document.getElementById('formDivSchedule').reset();
            populateTsWeekPicker();
            document.getElementById('tsFormTitle').innerText = 'Atur Rencana Bobot & Minggu Pelaksanaan Per Pekerjaan';
            document.getElementById('btnCancelTsEdit').classList.add('hidden');
            updateTsBobotInfo();
        }

        function renderTimeSchedule() {
            // Populate tsDivSelect (kepala Sub Pekerjaan RAB, bukan Divisi)
            populateTsSubSelect();
            populateTsWeekPicker();
            renderJadwalList();

            const head = document.getElementById('scheduleMatrixHead');
            const body = document.getElementById('scheduleMatrixBody');
            head.innerHTML = '';
            body.innerHTML = '';

            const totalWeeks = getProjectScheduleWeeks();
            const proj = projects.find(p => p.id === activeProjectId) || {};

            // Header matrix: tiap kolom M1, M2, dst diberi keterangan rentang tanggal mingguannya (dd/mm - dd/mm)
            // supaya langsung ketahuan M1/M2/dst itu tanggal berapa, tanpa perlu buka halaman lain.
            let headTr = '<tr><th class="p-3">No. & Kepala Sub Pekerjaan</th><th class="p-3">Metrik</th>';
            for (let w = 1; w <= totalWeeks; w++) {
                const range = getWeekDateRangeDetailed(w, proj.tglMulai, proj.tglSelesai);
                const fmtShort = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
                const dateLabel = range ? `${fmtShort(range.start)}-${fmtShort(range.end)}` : '';
                headTr += `<th class="p-2 text-center font-mono" ${range ? `title="${range.labelFull}"` : ''}>
                    <div>M${w}</div>${dateLabel ? `<div class="text-[9px] font-normal normal-case text-slate-500 mt-0.5">${dateLabel}</div>` : ''}
                </th>`;
            }
            headTr += '</tr>';
            head.innerHTML = headTr;

            const projRab = rabData.filter(r => r.projId === activeProjectId);
            const subtotal = projRab.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);

            // Ambil kepala Sub Pekerjaan unik beserta nomor divisinya (noDiv), berurutan sesuai urutan data RAB
            // (yang secara alami sudah berurutan berdasarkan nomor divisinya) — supaya baris matrix berurutan sesuai noDiv.
            const subKeys = [...new Set(projRab.map(r => `${r.noDiv || '-'}|||${r.sub}`))]
                .sort((a, b) => {
                    const [noDivA] = a.split('|||'); const [noDivB] = b.split('|||');
                    return compareDivisionKey(noDivA, noDivB);
                });

            if (subKeys.length === 0) {
                body.innerHTML = `<tr><td colspan="${totalWeeks + 2}" class="p-6 text-center text-slate-500">Belum ada data RAB / Pekerjaan.</td></tr>`;
                renderSCurveChart();
                return;
            }

            // Akumulator untuk baris TOTAL PROYEK (seluruh pekerjaan) per minggu
            const totalRencanaMingguan = Array(totalWeeks).fill(0);
            const totalRealisasiMingguan = Array(totalWeeks).fill(0);

            subKeys.forEach(key => {
                const [noDiv, sub] = key.split('|||');
                const subItems = projRab.filter(r => r.sub === sub && (r.noDiv || '-') === noDiv);
                const subCost = subItems.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);
                const subBobotTotal = subtotal > 0 ? (subCost / subtotal) * 100 : 0;
                const sudahDijadwalkan = getTsScheduledBobot(noDiv, sub, null);

                // Rencana mingguan: dijumlahkan dari SEMUA periode jadwal pekerjaan ini (bisa lebih dari 1 periode,
                // masing2 dgn bobot manual & rentang tanggalnya sendiri)
                const rencanaMingguan = getSubScheduleWeekly(noDiv, sub, totalWeeks, proj.tglMulai);

                // Realisasi mingguan: HARUS mengikuti/sama persis dengan Laporan Mingguan - yaitu "Bobot
                // Minggu Ini" per item RAB (dari hasil opname bersih minggu itu), bukan dihitung ulang secara
                // terpisah dari Laporan Harian. Supaya Time Schedule selalu konsisten dengan Laporan Mingguan.
                const realisasiMingguan = Array(totalWeeks).fill(0);
                subItems.forEach(rab => {
                    for (let w = 1; w <= totalWeeks; w++) {
                        const volIni = bqOpnameNetVolumeForWeek(rab.id, `Minggu ${w}`);
                        realisasiMingguan[w - 1] += subtotal > 0 ? (volIni * rab.harga / subtotal) * 100 : 0;
                    }
                });

                // Komulatif & deviasi
                const kumRencana = []; const kumRealisasi = []; const deviasi = [];
                let runR = 0, runA = 0;
                for (let w = 0; w < totalWeeks; w++) {
                    runR += rencanaMingguan[w];
                    runA += realisasiMingguan[w];
                    kumRencana.push(runR);
                    kumRealisasi.push(runA);
                    deviasi.push(runA - runR);
                    totalRencanaMingguan[w] += rencanaMingguan[w];
                    totalRealisasiMingguan[w] += realisasiMingguan[w];
                }

                const fmt = (n) => n.toFixed(2) + '%';
                const rowsMeta = [
                    { label: 'Rencana Mingguan', data: rencanaMingguan, cls: 'text-sky-300' },
                    { label: 'Komulatif Rencana', data: kumRencana, cls: 'text-sky-400 font-bold' },
                    { label: 'Realisasi Mingguan', data: realisasiMingguan, cls: 'text-emerald-300' },
                    { label: 'Komulatif Realisasi', data: kumRealisasi, cls: 'text-emerald-400 font-bold' },
                    { label: 'Deviasi (Kumulatif)', data: deviasi, cls: '' }
                ];

                rowsMeta.forEach((m, idx) => {
                    let row = '<tr class="hover:bg-slate-800/50 transition">';
                    if (idx === 0) {
                        row += `<td class="p-3 font-bold text-white align-top" rowspan="5">${noDiv} - ${sub}<br><span class="text-amber-400 font-mono text-[10px]">Bobot RAB: ${subBobotTotal.toFixed(2)}% (Terjadwal: ${sudahDijadwalkan.toFixed(2)}%)</span></td>`;
                    }
                    row += `<td class="p-2 text-[10px] text-slate-400">${m.label}</td>`;
                    m.data.forEach(v => {
                        let cellCls = m.cls;
                        if (m.label === 'Deviasi (Kumulatif)') cellCls = v < 0 ? 'text-red-400 font-bold' : (v > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400');
                        row += `<td class="p-2 text-center text-[10px] font-mono ${cellCls}">${fmt(v)}</td>`;
                    });
                    row += '</tr>';
                    body.innerHTML += row;
                });
            });

            // Baris TOTAL PROYEK: total komulatif rencana, total komulatif realisasi & total deviasi per minggu (seluruh pekerjaan)
            const totalKumRencana = []; const totalKumRealisasi = []; const totalDeviasi = [];
            let tRunR = 0, tRunA = 0;
            for (let w = 0; w < totalWeeks; w++) {
                tRunR += totalRencanaMingguan[w];
                tRunA += totalRealisasiMingguan[w];
                totalKumRencana.push(tRunR);
                totalKumRealisasi.push(tRunA);
                totalDeviasi.push(tRunA - tRunR);
            }
            const fmtTotal = (n) => n.toFixed(2) + '%';
            const totalRowsMeta = [
                { label: 'Total Komulatif Rencana', data: totalKumRencana, cls: 'text-sky-300 font-bold' },
                { label: 'Total Komulatif Realisasi', data: totalKumRealisasi, cls: 'text-emerald-300 font-bold' },
                { label: 'Total Deviasi', data: totalDeviasi, cls: '' }
            ];
            totalRowsMeta.forEach((m, idx) => {
                let row = '<tr class="bg-[#0b132b] hover:bg-slate-800/70 transition border-t-2 border-amber-500/40">';
                if (idx === 0) {
                    row += `<td class="p-3 font-bold text-amber-400 align-top" rowspan="3">TOTAL<br><span class="font-normal text-slate-300">Seluruh Divisi Proyek</span></td>`;
                }
                row += `<td class="p-2 text-[10px] text-amber-300 font-bold">${m.label}</td>`;
                m.data.forEach(v => {
                    let cellCls = m.cls;
                    if (m.label === 'Total Deviasi') cellCls = v < 0 ? 'text-red-400 font-bold' : (v > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400');
                    row += `<td class="p-2 text-center text-[10px] font-mono ${cellCls}">${fmtTotal(v)}</td>`;
                });
                row += '</tr>';
                body.innerHTML += row;
            });

            renderSCurveChart();
        }

        function handleDivScheduleSubmit(e) {
            e.preventDefault();
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            const selVal = document.getElementById('tsDivSelect').value;
            if (!selVal) { alert('Pilih pekerjaan terlebih dahulu.'); return; }
            const [noDiv, sub] = selVal.split('|||');
            const bobot = parseFloat(document.getElementById('tsBobot').value) || 0;
            const editId = document.getElementById('tsEditId').value;
            const minggu = parseInt(document.getElementById('tsWeekPicker').value);

            if (bobot <= 0) { alert('Bobot Rencana harus diisi lebih dari 0.'); return; }
            if (!minggu) { alert('Pilih minggu untuk rencana ini.'); return; }
            // Jaga-jaga: pastikan minggu ini belum punya entri lain utk item yang sama (harusnya sudah
            // disembunyikan dari dropdown oleh populateTsWeekPicker, ini cuma lapisan pengaman tambahan).
            const dobelMinggu = divScheduleData.some(d => d.projId === activeProjectId && (d.noDiv || '-') === noDiv && d.sub === sub && d.id != editId && (d.weeks || []).includes(minggu));
            if (dobelMinggu) { alert(`Minggu ${minggu} sudah punya rencana untuk pekerjaan ini. Edit entri yang sudah ada, atau pilih minggu lain.`); return; }

            // VALIDASI UTAMA (diblokir, tidak bisa disimpan kalau melanggar): total Bobot SELURUH minggu
            // (termasuk entri baru ini) untuk 1 pekerjaan yang sama TIDAK BOLEH melebihi Bobot RAB Kontrak
            // pekerjaan itu sendiri (porsinya thd Total Anggaran Proyek). Karena bobot tiap pekerjaan sudah
            // dibatasi ke bobot RAB-nya masing-masing, dan jumlah seluruh bobot RAB semua pekerjaan = 100%,
            // maka total kumulatif seluruh proyek juga otomatis tidak akan pernah melebihi 100% di akhir.
            const bobotTotalPekerjaan = getSubBobotTotal(noDiv, sub);
            const sudahDijadwalkan = getTsScheduledBobot(noDiv, sub, editId || null);
            const sisaBisaDijadwalkan = Math.max(0, bobotTotalPekerjaan - sudahDijadwalkan);
            if (bobot > sisaBisaDijadwalkan + 0.01) {
                alert(`Bobot Rencana (${formatAngka(bobot)}%) melebihi sisa Bobot RAB pekerjaan ini yang bisa dijadwalkan (${formatAngka(sisaBisaDijadwalkan)}%). Bobot RAB Kontrak pekerjaan ini hanya ${formatAngka(bobotTotalPekerjaan)}% dari Total Anggaran Proyek.`);
                return;
            }

            // tglMulai/tglSelesai dihitung otomatis dari minggu yang dipilih - hanya untuk keperluan
            // tampilan/kompatibilitas fitur lain (mis. Action Plan), TIDAK dipakai lagi sebagai dasar
            // perhitungan Kurva S (yang sekarang berbasis minggu terpilih secara langsung).
            const proj = projects.find(p => p.id === activeProjectId) || {};
            let tglMulai = '', tglSelesai = '';
            if (proj.tglMulai) {
                const range = getWeekDateRangeDetailed(minggu, proj.tglMulai, proj.tglSelesai);
                if (range) { tglMulai = range.start.toISOString().split('T')[0]; tglSelesai = range.end.toISOString().split('T')[0]; }
            }

            if (editId) {
                const idx = divScheduleData.findIndex(d => d.id == editId);
                if (idx !== -1) {
                    divScheduleData[idx] = { ...divScheduleData[idx], noDiv, sub, bobot, volume: undefined, weeks: [minggu], tglMulai, tglSelesai };
                }
            } else {
                divScheduleData.push({ id: Date.now(), projId: activeProjectId, noDiv, sub, bobot, weeks: [minggu], tglMulai, tglSelesai });
            }

            localStorage.setItem('erp_div_schedule', JSON.stringify(divScheduleData));
            cancelTsScheduleEdit();
            renderTimeSchedule();
        }

        // Hitung Rencana Kumulatif & Realisasi Kumulatif (%) per minggu, dijumlahkan dari SELURUH pekerjaan
        // proyek aktif. Dipakai bersama oleh Grafik Kurva-S (Time Schedule) & widget "Progress Minggu Ini"
        // di Beranda, supaya angkanya selalu konsisten di kedua tempat.
        function computeProjectCumulativeSCurve() {
            const totalWeeks = getProjectScheduleWeeks();
            const proj = projects.find(p => p.id === activeProjectId) || {};
            const projRab = rabData.filter(r => r.projId === activeProjectId);
            const subtotal = projRab.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);
            const subKeys = [...new Set(projRab.map(r => `${r.noDiv || '-'}|||${r.sub}`))];

            const totalRencanaMingguan = Array(totalWeeks).fill(0);
            const totalRealisasiMingguan = Array(totalWeeks).fill(0);

            subKeys.forEach(key => {
                const [noDiv, sub] = key.split('|||');
                const subItems = projRab.filter(r => r.sub === sub && (r.noDiv || '-') === noDiv);

                const rencanaMingguan = getSubScheduleWeekly(noDiv, sub, totalWeeks, proj.tglMulai);
                for (let w = 0; w < totalWeeks; w++) totalRencanaMingguan[w] += rencanaMingguan[w];

                // Realisasi mingguan mengikuti Laporan Mingguan (bobot minggu ini per item dari opname
                // bersih), bukan dihitung ulang terpisah dari Laporan Harian - supaya Kurva S & widget
                // Beranda selalu konsisten dengan angka di Laporan Mingguan.
                subItems.forEach(rab => {
                    for (let w = 1; w <= totalWeeks; w++) {
                        const volIni = bqOpnameNetVolumeForWeek(rab.id, `Minggu ${w}`);
                        totalRealisasiMingguan[w - 1] += subtotal > 0 ? (volIni * rab.harga / subtotal) * 100 : 0;
                    }
                });
            });

            const planCumulative = []; const realCumulative = [];
            let runR = 0, runA = 0;
            for (let w = 0; w < totalWeeks; w++) {
                runR += totalRencanaMingguan[w];
                runA += totalRealisasiMingguan[w];
                planCumulative.push(parseFloat(runR.toFixed(2)));
                realCumulative.push(parseFloat(runA.toFixed(2)));
            }
            return { totalWeeks, planCumulative, realCumulative, proj };
        }

        let scurveChartInstance = null;
        function renderSCurveChart() {
            const totalWeeks = getProjectScheduleWeeks();

            // Grafik dibungkus wrapper yang bisa digeser kiri-kanan (overflow-x-auto) dan lebar canvas
            // disesuaikan dengan jumlah minggu, supaya saat minggunya banyak, titik & garis grafik tetap
            // presisi/tidak berhimpitan di layar HP - bukan dipaksa muat ke satu lebar layar.
            const wrapper = document.getElementById('scurveChartWrapper');
            const inner = document.getElementById('scurveChartInner');
            const canvasEl = document.getElementById('scurveCanvas');

            const ctx = canvasEl.getContext('2d');
            if (scurveChartInstance) scurveChartInstance.destroy();

            const labels = ['M0', ...Array.from({length: totalWeeks}, (_, i) => `M${i+1}`)];

            // Total kumulatif rencana & realisasi seluruh pekerjaan (mengikuti data tabel Time Schedule di atas)
            const { planCumulative: planData, realCumulative: realData } = computeProjectCumulativeSCurve();
            // Tambahkan titik "Minggu 0" bernilai 0% di paling depan grafik, supaya kurva terlihat mulai betul-
            // betul dari titik nol (0,0) sebelum naik ke Minggu 1 - standar tampilan Kurva S yang profesional.
            // computeProjectCumulativeSCurve() sendiri TIDAK diubah (tetap dipakai apa adanya di tempat lain,
            // mis. widget progress Beranda), titik nol ini hanya ditambahkan khusus untuk data grafik di sini.
            const planDataWithZero = [0, ...planData];
            const realDataWithZero = [0, ...realData];

            // Lebar canvas ikut menyesuaikan +1 titik (Minggu 0) supaya jarak antar titik tetap presisi/konsisten.
            if (wrapper && inner) {
                const pxPerWeek = 55;
                const minWidth = Math.max(wrapper.clientWidth || 0, (totalWeeks + 1) * pxPerWeek);
                inner.style.width = minWidth + 'px';
            }

            scurveChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Rencana Komulatif (%)',
                            data: planDataWithZero,
                            borderColor: '#0ea5e9',
                            backgroundColor: 'rgba(14, 165, 233, 0.1)',
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'Realisasi Komulatif (%)',
                            data: realDataWithZero,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                    scales: {
                        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' }, max: 100, min: 0 }
                    }
                }
            });
        }

        // ===================================================================
        // 3.2 ACTION PLAN
        // ===================================================================
        let actionPlanSelectedWeek = 1;

        // Kembalikan rentang tanggal (mulai - selesai) untuk minggu ke-N dihitung dari tanggal mulai proyek
        function getWeekDateRange(week, projStartStr, projEndStr) {
            if (!projStartStr) return null;
            const start = new Date(projStartStr);
            const wStart = new Date(start);
            wStart.setDate(start.getDate() + (week - 1) * 7);
            let wEnd = new Date(wStart);
            wEnd.setDate(wStart.getDate() + 6);
            // Pada minggu terakhir, tanggal akhirnya mengikuti Tanggal Selesai Kontrak proyek yang
            // sesungguhnya (jika lebih awal dari genap 7 hari), bukan selalu dibulatkan jadi 7 hari.
            if (projEndStr) {
                const projEnd = new Date(projEndStr);
                if (!isNaN(projEnd) && projEnd >= wStart && projEnd < wEnd) wEnd = projEnd;
            }
            const fmt = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            return { start: wStart, end: wEnd, label: `${fmt(wStart)} s/d ${fmt(wEnd)}` };
        }

        // Versi lengkap/detail dari rentang tanggal 1 minggu (nama hari + nama bulan penuh), dipakai
        // khusus pada halaman Laporan Mingguan supaya periode tanggalnya terbaca jelas & lengkap.
        function getWeekDateRangeDetailed(week, projStartStr, projEndStr) {
            if (!projStartStr) return null;
            const start = new Date(projStartStr);
            const wStart = new Date(start);
            wStart.setDate(start.getDate() + (week - 1) * 7);
            let wEnd = new Date(wStart);
            wEnd.setDate(wStart.getDate() + 6);
            // Sama seperti getWeekDateRange: minggu terakhir mengikuti Tanggal Selesai Kontrak proyek,
            // tidak dibulatkan genap 7 hari jika kontraknya berakhir lebih cepat dari itu.
            if (projEndStr) {
                const projEnd = new Date(projEndStr);
                if (!isNaN(projEnd) && projEnd >= wStart && projEnd < wEnd) wEnd = projEnd;
            }
            const fmtFull = (d) => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const fmtShort = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            return { start: wStart, end: wEnd, labelFull: `${fmtFull(wStart)} s/d ${fmtFull(wEnd)}`, labelShort: `${fmtShort(wStart)} - ${fmtShort(wEnd)}` };
        }

        // ---- Helper Laporan Bulanan: 1 Bulan = 4 Minggu (mengikuti definisi Minggu Ke- pada Laporan Mingguan) ----

        // Rentang nomor minggu (mingguKe) yang termasuk dalam 1 bulan tertentu.
        function getMonthWeekRange(month) {
            const start = (month - 1) * 4 + 1;
            const end = month * 4;
            return { start, end };
        }

        // Rentang tanggal 1 bulan, dihitung dari tanggal mulai minggu pertama s/d tanggal akhir minggu terakhir
        // pada bulan tsb (sama persis basis perhitungannya dengan getWeekDateRangeDetailed di Laporan Mingguan).
        function getMonthDateRangeDetailed(month, projStartStr, projEndStr) {
            if (!projStartStr) return null;
            const wRange = getMonthWeekRange(month);
            const startWeekRange = getWeekDateRangeDetailed(wRange.start, projStartStr, projEndStr);
            if (!startWeekRange) return null;
            const endWeekRange = getWeekDateRangeDetailed(wRange.end, projStartStr, projEndStr);
            const wStart = startWeekRange.start;
            const wEnd = endWeekRange ? endWeekRange.end : startWeekRange.end;
            const fmtFull = (d) => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const fmtShort = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            return { start: wStart, end: wEnd, labelFull: `${fmtFull(wStart)} s/d ${fmtFull(wEnd)}`, labelShort: `${fmtShort(wStart)} - ${fmtShort(wEnd)}` };
        }

        // Hitung target mingguan (%) & status action plan untuk 1 item RAB pada minggu tertentu
        function getActionPlanItemWeekly(item, week, subtotal) {
            const bobotItem = subtotal > 0 ? ((item.volume * item.harga) / subtotal) * 100 : 0;
            const proj = projects.find(p => p.id === activeProjectId) || {};
            const noDiv = item.noDiv || '-';
            const entries = divScheduleData.filter(d => d.projId === activeProjectId && (d.noDiv || '-') === noDiv && d.sub === item.sub);
            const sched = entries.length > 0;

            // Porsi item ini thd bobot total pekerjaan (sub)-nya, dipakai utk membagi rencana mingguan sub secara proporsional ke tiap item RAB di dalamnya
            const subBobotTotal = getSubBobotTotal(noDiv, item.sub);
            const itemShare = subBobotTotal > 0 ? (bobotItem / subBobotTotal) : 0;
            const totalWeeksProj = getProjectScheduleWeeks();
            const subWeekly = getSubScheduleWeekly(noDiv, item.sub, totalWeeksProj, proj.tglMulai);
            const itemWeekly = subWeekly.map(v => v * itemShare);

            let wStart = null, wEnd = null;
            if (sched) {
                const allWeeks = entries.flatMap(e => Array.isArray(e.weeks) ? e.weeks : []);
                if (allWeeks.length) {
                    wStart = Math.min(...allWeeks);
                    wEnd = Math.max(...allWeeks);
                }
            }

            const targetMingguIni = itemWeekly[week - 1] || 0;
            const targetKumulatif = itemWeekly.slice(0, week).reduce((a, b) => a + b, 0);

            // Realisasi kumulatif s/d minggu terpilih - HARUS mengikuti/sama persis dengan Laporan Mingguan
            // (bobot minggu ini per item dari hasil opname bersih), bukan dihitung ulang terpisah dari
            // Laporan Harian, supaya Action Plan selalu konsisten dengan Time Schedule & Laporan Mingguan.
            let realisasiKumulatif = 0;
            let realisasiMingguIni = 0;
            for (let w = 1; w <= week; w++) {
                const volIni = bqOpnameNetVolumeForWeek(item.id, `Minggu ${w}`);
                const persen = subtotal > 0 ? (volIni * item.harga / subtotal) * 100 : 0;
                realisasiKumulatif += persen;
                if (w === week) realisasiMingguIni = persen;
            }

            let status, statusCls;
            if (!sched) {
                status = 'Belum Dijadwalkan'; statusCls = 'bg-slate-500/20 text-slate-300';
            } else if (wStart !== null && week < wStart) {
                status = 'Belum Mulai'; statusCls = 'bg-slate-500/20 text-slate-300';
            } else if (realisasiKumulatif + 0.01 >= targetKumulatif) {
                status = realisasiKumulatif > targetKumulatif + 0.01 ? 'Ahead of Schedule' : 'On Schedule';
                statusCls = realisasiKumulatif > targetKumulatif + 0.01 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300';
            } else {
                status = 'Behind Schedule'; statusCls = 'bg-red-500/20 text-red-300';
            }

            return { bobotItem, targetMingguIni, realisasiMingguIni, status, statusCls };
        }

        function handleActionPlanWeekChange() {
            const sel = document.getElementById('actionPlanWeekSelect');
            actionPlanSelectedWeek = parseInt(sel.value) || 1;
            renderActionPlan();
        }

        function renderActionPlan() {
            const weekSelect = document.getElementById('actionPlanWeekSelect');
            if (weekSelect && weekSelect.options.length === 0) {
                for (let w = 1; w <= 12; w++) {
                    const opt = document.createElement('option');
                    opt.value = w;
                    opt.textContent = `Minggu ke-${w}`;
                    weekSelect.appendChild(opt);
                }
            }
            if (weekSelect) weekSelect.value = actionPlanSelectedWeek;

            const proj = projects.find(p => p.id === activeProjectId) || {};
            const range = getWeekDateRange(actionPlanSelectedWeek, proj.tglMulai, proj.tglSelesai);
            const rangeBox = document.getElementById('actionPlanWeekDateRange');
            if (rangeBox) rangeBox.innerHTML = range ? `<i class="fa-regular fa-calendar mr-1"></i> ${range.label}` : 'Tanggal mulai proyek belum diatur.';
            const captionBox = document.getElementById('actionPlanTableCaption');
            if (captionBox) captionBox.innerText = `Target Action Plan Pekerjaan Lapangan - Minggu ke-${actionPlanSelectedWeek}${range ? ' (' + range.label + ')' : ''}`;

            const tbody = document.getElementById('actionPlanTableBody');
            tbody.innerHTML = '';
            // Urutkan sesuai nomor divisi (mendukung angka Romawi bertingkat V.01, V.02, VI.01, dst) supaya
            // urutan tampil sama persis dengan halaman RAB dan tidak loncat-loncat.
            const projRAB = rabData.filter(r => r.projId === activeProjectId).sort((a, b) => compareDivisionKey(a.noDiv, b.noDiv));
            const subtotal = projRAB.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);

            if (projRAB.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-500">Belum ada data RAB.</td></tr>`;
                return;
            }

            projRAB.forEach(item => {
                const totalHarga = item.volume * item.harga;
                const bobot = subtotal > 0 ? ((totalHarga / subtotal) * 100).toFixed(2) : '0.00';
                const wk = getActionPlanItemWeekly(item, actionPlanSelectedWeek, subtotal);

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-800/50 transition';
                tr.innerHTML = `
                    <td class="p-3 font-mono font-bold text-amber-400">${item.noDiv}</td>
                    <td class="p-3 font-semibold text-white">${item.div}</td>
                    <td class="p-3">${item.sub} (${item.rincian})</td>
                    <td class="p-3 font-mono">${item.satuan}</td>
                    <td class="p-3 font-mono">${formatAngka(item.volume)}</td>
                    <td class="p-3 font-mono text-sky-400 font-bold">${bobot}%</td>
                    <td class="p-3 font-mono text-amber-300">${wk.targetMingguIni.toFixed(2)}%</td>
                    <td class="p-3"><span class="${wk.statusCls} px-2.5 py-1 rounded-full text-[10px] font-bold">${wk.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Bangun baris data Action Plan untuk minggu terpilih (dipakai bersama oleh Excel & PDF export agar isinya sama persis dengan halaman)
        function buildActionPlanExportRows(week) {
            const projRAB = rabData.filter(r => r.projId === activeProjectId).sort((a, b) => compareDivisionKey(a.noDiv, b.noDiv));
            const subtotal = projRAB.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);
            return projRAB.map(item => {
                const totalHarga = item.volume * item.harga;
                const bobot = subtotal > 0 ? ((totalHarga / subtotal) * 100) : 0;
                const wk = getActionPlanItemWeekly(item, week, subtotal);
                return {
                    'No. Divisi': item.noDiv || '-',
                    'Nama Divisi': item.div,
                    'Nama Sub Pekerjaan': `${item.sub} (${item.rincian})`,
                    'Satuan': item.satuan,
                    'Volume RAB': item.volume,
                    'Bobot (%)': Number(bobot.toFixed(2)),
                    'Target Minggu Ini (%)': Number(wk.targetMingguIni.toFixed(2)),
                    'Status Action Plan': wk.status
                };
            });
        }

        function getActionPlanExportDataset() {
            const week = actionPlanSelectedWeek;
            const proj = projects.find(p => p.id === activeProjectId) || {};
            const range = getWeekDateRange(week, proj.tglMulai, proj.tglSelesai);
            const rows = buildActionPlanExportRows(week).map(r => ({
                noDiv: r['No. Divisi'], div: r['Nama Divisi'], sub: r['Nama Sub Pekerjaan'], satuan: r['Satuan'],
                volume: r['Volume RAB'], bobot: r['Bobot (%)'], bobotTarget: r['Target Minggu Ini (%)'], status: r['Status Action Plan']
            }));
            const columns = [
                { header: 'No. Divisi', key: 'noDiv' }, { header: 'Nama Divisi', key: 'div' },
                { header: 'Nama Sub Pekerjaan', key: 'sub' }, { header: 'Satuan', key: 'satuan' },
                { header: 'Volume RAB', key: 'volume' }, { header: 'Bobot (%)', key: 'bobot' },
                { header: 'Target Minggu Ini (%)', key: 'bobotTarget' }, { header: 'Status', key: 'status' }
            ];
            return { title: `Action Plan - Minggu ${week}`, columns, rows, orientation: 'landscape', subtitle: range ? `Minggu ${week} (${range.label})` : `Minggu ${week}` };
        }

        function exportActionPlanExcel() {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek' };
            const ds = getActionPlanExportDataset();
            exportProfessionalExcel(ds.title, ds.columns, ds.rows, `${ds.title.replace(/[\\\/\?\*\[\]:]/g, ' ')}_${proj.nama}.xlsx`, { subtitle: ds.subtitle });
        }

        function exportActionPlanPdf() {
            const proj = projects.find(p => p.id === activeProjectId) || { nama: 'Proyek' };
            const ds = getActionPlanExportDataset();
            exportProfessionalPdf(ds.title, ds.columns, ds.rows, `${ds.title.replace(/[\\\/\?\*\[\]:]/g, ' ')}_${proj.nama}.pdf`, { orientation: ds.orientation, subtitle: ds.subtitle });
        }

        // ===================================================================
        // 4. MATERIAL & BACKUP QUANTITY MODULE
