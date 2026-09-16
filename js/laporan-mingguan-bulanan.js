        // ===================================================================
        function renderLapMingguan() {
            const mingguSel = document.getElementById('lmFilterMingguSelect');
            const searchEl = document.getElementById('lmSearchInput');
            const periodeLabelEl = document.getElementById('lmPeriodeLabel');
            const tbody = document.getElementById('lapMingguanTableBody');
            if (!tbody) return;

            const proj = projects.find(p => p.id === activeProjectId) || {};

            // Isi ulang opsi Minggu setiap render (bukan hanya sekali) supaya rentang tanggalnya selalu
            // ikut menyesuaikan jika Tanggal Mulai Proyek berubah atau saat pindah proyek.
            if (mingguSel) {
                const curVal = mingguSel.value || 'Minggu 1';
                mingguSel.innerHTML = '';
                for (let i = 1; i <= 12; i++) {
                    const range = getWeekDateRangeDetailed(i, proj.tglMulai, proj.tglSelesai);
                    const opt = document.createElement('option');
                    opt.value = `Minggu ${i}`;
                    opt.textContent = range ? `Minggu ${i} (${range.labelShort})` : `Minggu ${i}`;
                    if (`Minggu ${i}` === curVal) opt.selected = true;
                    mingguSel.appendChild(opt);
                }
            }

            const selectedMinggu = mingguSel ? mingguSel.value : 'Minggu 1';
            const selectedWeekNum = parseInt((selectedMinggu || '').replace(/\D/g, ''), 10) || 1;
            const admin = isAdminUser();
            const canEditLm = canUserEdit();

            // Tampilkan periode tanggal lengkap & detail (nama hari + nama bulan penuh) untuk minggu terpilih.
            if (periodeLabelEl) {
                const rangeDetailed = getWeekDateRangeDetailed(selectedWeekNum, proj.tglMulai, proj.tglSelesai);
                periodeLabelEl.innerHTML = rangeDetailed
                    ? `<i class="fa-solid fa-calendar-days mr-1"></i>Periode: <span class="text-amber-300 font-semibold">${rangeDetailed.labelFull}</span>`
                    : `<i class="fa-solid fa-calendar-days mr-1"></i>Tanggal Mulai Proyek belum diatur, periode tanggal tidak dapat dihitung.`;
            }

            tbody.innerHTML = '';
            const projRAB = rabData.filter(r => r.projId === activeProjectId);
            const subtotal = projRAB.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);

            const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
            const displayRAB = query
                ? projRAB.filter(r => [r.noDiv, r.div, r.sub, r.rincian, r.satuan].some(v => (v || '').toString().toLowerCase().includes(query)))
                : projRAB;

            if (displayRAB.length === 0) {
                tbody.innerHTML = `<tr><td colspan="18" class="p-6 text-center text-slate-500">${projRAB.length === 0 ? 'Belum ada data RAB / Pekerjaan.' : 'Tidak ada item yang cocok dengan pencarian.'}</td></tr>`;
            } else {
                // Kelompokkan per Divisi (sama persis seperti list RAB), supaya total per divisi & total
                // keseluruhan bisa ditampilkan langsung di dalam list Laporan Mingguan.
                const divGroups = [];
                const divGroupMap = new Map();
                displayRAB.forEach(item => {
                    const key = (item.noDiv || '-') + '||' + (item.div || '-');
                    if (!divGroupMap.has(key)) {
                        const group = { noDiv: item.noDiv, div: item.div, items: [] };
                        divGroupMap.set(key, group);
                        divGroups.push(group);
                    }
                    divGroupMap.get(key).items.push(item);
                });
                divGroups.sort((ga, gb) => compareDivisionKey(ga.noDiv, gb.noDiv));

                let sumMoneyMingguIni = 0;
                let sumBobotMingguIni = 0;
                let grandJumlahHargaRab = 0, grandBobotRab = 0;
                let grandBobotLalu = 0, grandBobotIni = 0, grandBobotKum = 0, grandUang = 0;

                divGroups.forEach(group => {
                    let divJumlahHargaRab = 0, divBobotRab = 0;
                    let divBobotLalu = 0, divBobotIni = 0, divBobotKum = 0, divUang = 0;

                    group.items.forEach(item => {
                        // Jumlah Harga & Bobot (%) di sini PERSIS sama dengan kolom di list RAB (nilai & bobot
                        // penuh/rencana item ini terhadap keseluruhan proyek) - dipakai juga sbg pembagi progress.
                        const itemTotalHarga = item.volume * item.harga;
                        const bobotItemRab = subtotal > 0 ? (itemTotalHarga / subtotal) * 100 : 0;

                        // Volume Minggu Lalu & Minggu Ini TIDAK diinput manual di sini - diambil otomatis dari
                        // hasil opname bersih (Tambah - Kurang) pada halaman Opname untuk item & minggu terkait,
                        // supaya Laporan Mingguan selalu mengikuti data lapangan terbaru dari Opname.
                        const volLalu = bqOpnameNetVolumeCumulative(item.id, selectedWeekNum);
                        const volIni = bqOpnameNetVolumeForWeek(item.id, selectedMinggu);
                        const volKum = volLalu + volIni;
                        const sisaVolume = Math.max(item.volume - volKum, 0);
                        const entry = lapMingguanData.find(l => l.rabId == item.id && l.mingguKe === selectedMinggu);
                        const keterangan = entry ? (entry.keterangan || '') : '';
                        const sudahDiopname = bqOpnameData.some(o => o.pekerjaanId == item.id && o.mingguKe === selectedMinggu);

                        const bobotLalu = subtotal > 0 ? (volLalu * item.harga / subtotal) * 100 : 0;
                        const bobotIni = subtotal > 0 ? (volIni * item.harga / subtotal) * 100 : 0;
                        const bobotKum = subtotal > 0 ? (volKum * item.harga / subtotal) * 100 : 0;
                        const jumlahUang = volKum * item.harga;

                        // % Bobot Item = progress kumulatif item ini terhadap bobot RAB (rencana) miliknya SENDIRI,
                        // yaitu (Bobot Komulatif Minggu Ini / Bobot RAB item) x 100. Idealnya tidak lebih dari 100%;
                        // jika melebihi 100% berarti volume yang diinput sudah melebihi volume rencana RAB-nya.
                        const progressItemPersen = bobotItemRab > 0 ? (bobotKum / bobotItemRab) * 100 : 0;
                        const isOverProgress = progressItemPersen > 100;

                        divJumlahHargaRab += itemTotalHarga; divBobotRab += bobotItemRab;
                        divBobotLalu += bobotLalu; divBobotIni += bobotIni; divBobotKum += bobotKum;
                        divUang += jumlahUang;
                        sumMoneyMingguIni += (volIni * item.harga);
                        sumBobotMingguIni += bobotIni;

                        const inputsDisabled = !canEditLm ? 'disabled' : '';
                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-slate-800/50 transition';
                        tr.innerHTML = `
                            <td class="p-3 font-mono font-bold text-amber-400">${item.noDiv || '-'}</td>
                            <td class="p-3 font-semibold text-white">${item.div || '-'}</td>
                            <td class="p-3">${item.sub}</td>
                            <td class="p-3 text-slate-400">${item.rincian || ''}</td>
                            <td class="p-3 font-mono">${item.satuan}</td>
                            <td class="p-3 font-mono">${formatAngka(item.volume)}</td>
                            <td class="p-3 font-mono">${formatRupiah(item.harga)}</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(itemTotalHarga)}</td>
                            <td class="p-3 font-mono font-bold text-sky-400">${bobotItemRab.toFixed(2)}%</td>
                            <td class="p-3 font-mono text-slate-400">${formatAngka(volLalu)}</td>
                            <td class="p-3">
                                <span class="font-mono font-bold text-amber-300">${formatAngka(volIni)}</span>
                                <div class="text-[9px] text-slate-500 mt-0.5">Sisa: ${formatAngka(sisaVolume)} ${item.satuan}</div>
                                <div class="text-[9px] mt-0.5 ${sudahDiopname ? 'text-sky-400' : 'text-slate-600'}">
                                    <i class="fa-solid fa-link"></i> ${sudahDiopname ? 'Dari data Opname' : 'Belum ada data Opname'}
                                </div>
                            </td>
                            <td class="p-3 font-mono font-bold text-sky-300">${formatAngka(volKum)}</td>
                            <td class="p-3 font-mono text-slate-400">${bobotLalu.toFixed(2)}%</td>
                            <td class="p-3 font-mono font-bold text-amber-300">${bobotIni.toFixed(2)}%</td>
                            <td class="p-3 font-mono font-bold text-sky-400">${bobotKum.toFixed(2)}%</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(jumlahUang)}</td>
                            <td class="p-3">
                                <span class="font-mono font-bold ${isOverProgress ? 'text-red-400' : 'text-slate-300'}">${progressItemPersen.toFixed(2)}%</span>
                                ${isOverProgress ? `<div class="text-[9px] text-red-400 font-bold mt-0.5"><i class="fa-solid fa-triangle-exclamation"></i> Melebihi 100%!</div>` : ''}
                            </td>
                            <td class="p-3">
                                <input type="text" value="${escapeHtml(keterangan)}" placeholder="Keterangan..." ${inputsDisabled}
                                    onchange="updateLmKeterangan(${item.id}, this.value)"
                                    class="w-40 bg-[#0b132b] border border-slate-700 rounded-lg px-2 py-1 text-white text-xs ${!canEditLm ? 'opacity-50 cursor-not-allowed' : ''}">
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });

                    grandJumlahHargaRab += divJumlahHargaRab; grandBobotRab += divBobotRab;
                    grandBobotLalu += divBobotLalu; grandBobotIni += divBobotIni; grandBobotKum += divBobotKum;
                    grandUang += divUang;

                    // Baris total per divisi: kolom "% Bobot Item" (progress per-item) TIDAK dijumlahkan karena
                    // itu murni rasio milik masing2 item sendiri, begitu juga kolom Volume (satuan berbeda2).
                    const subtotalTr = document.createElement('tr');
                    subtotalTr.className = 'bg-[#15203c] border-t border-b border-slate-700';
                    subtotalTr.innerHTML = `
                        <td class="p-3 font-bold text-amber-300 uppercase tracking-wide" colspan="7">Total ${group.noDiv || '-'} &mdash; ${group.div || '-'}</td>
                        <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(divJumlahHargaRab)}</td>
                        <td class="p-3 font-mono font-bold text-sky-300">${divBobotRab.toFixed(2)}%</td>
                        <td class="p-3 text-slate-600">-</td>
                        <td class="p-3 text-slate-600">-</td>
                        <td class="p-3 text-slate-600">-</td>
                        <td class="p-3 font-mono font-bold text-slate-300">${divBobotLalu.toFixed(2)}%</td>
                        <td class="p-3 font-mono font-bold text-amber-300">${divBobotIni.toFixed(2)}%</td>
                        <td class="p-3 font-mono font-bold text-sky-300">${divBobotKum.toFixed(2)}%</td>
                        <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(divUang)}</td>
                        <td class="p-3 text-slate-600">-</td>
                        <td class="p-3"></td>
                    `;
                    tbody.appendChild(subtotalTr);
                });

                const grandTr = document.createElement('tr');
                grandTr.className = 'bg-emerald-950/40 border-t-2 border-emerald-500/60';
                grandTr.innerHTML = `
                    <td class="p-3 font-black text-emerald-300 uppercase tracking-wide" colspan="7">Total Keseluruhan Divisi</td>
                    <td class="p-3 font-mono font-black text-emerald-300">${formatRupiah(grandJumlahHargaRab)}</td>
                    <td class="p-3 font-mono font-black text-sky-300">${grandBobotRab.toFixed(2)}%</td>
                    <td class="p-3 text-slate-600">-</td>
                    <td class="p-3 text-slate-600">-</td>
                    <td class="p-3 text-slate-600">-</td>
                    <td class="p-3 font-mono font-black text-slate-200">${grandBobotLalu.toFixed(2)}%</td>
                    <td class="p-3 font-mono font-black text-amber-300">${grandBobotIni.toFixed(2)}%</td>
                    <td class="p-3 font-mono font-black text-sky-300">${grandBobotKum.toFixed(2)}%</td>
                    <td class="p-3 font-mono font-black text-emerald-300">${formatRupiah(grandUang)}</td>
                    <td class="p-3 text-slate-600">-</td>
                    <td class="p-3"></td>
                `;
                tbody.appendChild(grandTr);

                // Kartu ringkasan atas: bobot rencana minggu ini diambil dari Time Schedule (jika ada jadwal),
                // supaya deviasi rencana vs realisasi lebih akurat dibanding angka tetap.
                let planBobotMinggu = 0;
                try {
                    const totalWeeks = getProjectScheduleWeeks();
                    if (selectedWeekNum >= 1 && selectedWeekNum <= totalWeeks) {
                        const subKeys = [...new Set(projRAB.map(r => `${r.noDiv || '-'}|||${r.sub}`))];
                        subKeys.forEach(key => {
                            const [noDiv, sub] = key.split('|||');
                            const rencanaMingguan = getSubScheduleWeekly(noDiv, sub, totalWeeks, proj.tglMulai);
                            planBobotMinggu += rencanaMingguan[selectedWeekNum - 1] || 0;
                        });
                    }
                } catch (err) { planBobotMinggu = 0; }

                document.getElementById('lmSumMoney').innerText = formatRupiah(sumMoneyMingguIni);
                document.getElementById('lmSumPlanBobot').innerText = planBobotMinggu.toFixed(2) + '%';
                document.getElementById('lmSumRealBobot').innerText = sumBobotMingguIni.toFixed(2) + '%';
                const dev = sumBobotMingguIni - planBobotMinggu;
                document.getElementById('lmSumDevBobot').innerText = (dev >= 0 ? '+' : '') + dev.toFixed(2) + '%';
                // Bobot Komulatif s/d minggu terpilih = grandBobotKum yang sudah dijumlahkan per item
                // (Bobot Lalu + Bobot Minggu Ini) pada baris "Total Keseluruhan Divisi" di tabel bawah -
                // ditampilkan juga di kartu ringkasan atas supaya langsung kelihatan tanpa scroll ke bawah.
                document.getElementById('lmSumKumBobot').innerText = grandBobotKum.toFixed(2) + '%';
                document.getElementById('lmSumStatus').innerText = dev >= 0 ? 'Sesuai / Ahead' : 'Delay / Lagging';
                document.getElementById('lmSumStatus').className = dev >= 0 ? 'text-xs font-bold text-emerald-400 mt-1' : 'text-xs font-bold text-red-400 mt-1';
            }
        }

        // Simpan/ubah Volume Minggu Ini untuk 1 item RAB pada minggu yang sedang dipilih. 1 entri per
        // (item RAB, minggu) - jika belum ada, dibuat baru; jika sudah ada, ditimpa (upsert).
        function updateLmVolume(rabId, val) {
            if (!canUserEdit()) {
                alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.');
                renderLapMingguan();
                return;
            }
            const mingguSel = document.getElementById('lmFilterMingguSelect');
            const mingguKe = mingguSel ? mingguSel.value : 'Minggu 1';
            const volume = parseFloat(val) || 0;

            let entry = lapMingguanData.find(l => l.rabId == rabId && l.mingguKe === mingguKe);
            if (entry) {
                entry.volume = volume;
            } else {
                lapMingguanData.push({ id: Date.now() + Math.random(), projId: activeProjectId, rabId, mingguKe, volume, keterangan: '' });
            }
            localStorage.setItem('erp_lap_mingguan', JSON.stringify(lapMingguanData));
            renderLapMingguan();
        }

        // Simpan/ubah Keterangan untuk 1 item RAB pada minggu yang sedang dipilih (upsert, sama seperti volume).
        function updateLmKeterangan(rabId, val) {
            if (!canUserEdit()) {
                alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.');
                renderLapMingguan();
                return;
            }
            const mingguSel = document.getElementById('lmFilterMingguSelect');
            const mingguKe = mingguSel ? mingguSel.value : 'Minggu 1';

            let entry = lapMingguanData.find(l => l.rabId == rabId && l.mingguKe === mingguKe);
            if (entry) {
                entry.keterangan = val;
            } else {
                lapMingguanData.push({ id: Date.now() + Math.random(), projId: activeProjectId, rabId, mingguKe, volume: 0, keterangan: val });
            }
            localStorage.setItem('erp_lap_mingguan', JSON.stringify(lapMingguanData));
        }

        // ===================================================================
        // 2.3 LAPORAN BULANAN
        // ===================================================================
        function renderLapBulanan() {
            const bulanSel = document.getElementById('lbFilterBulanSelect');
            const searchEl = document.getElementById('lbSearchInput');
            const periodeLabelEl = document.getElementById('lbPeriodeLabel');
            const tbody = document.getElementById('lapBulananTableBody');
            if (!tbody) return;

            const proj = projects.find(p => p.id === activeProjectId) || {};

            // Isi ulang opsi Bulan setiap render (sama seperti Minggu pada Laporan Mingguan) supaya rentang
            // tanggalnya selalu ikut menyesuaikan jika Tanggal Mulai Proyek berubah atau saat pindah proyek.
            // 1 Bulan = 4 Minggu, mengikuti definisi "Minggu Ke-" yang dipakai pada Laporan Mingguan.
            if (bulanSel) {
                const curVal = bulanSel.value || 'Bulan 1';
                bulanSel.innerHTML = '';
                for (let i = 1; i <= 12; i++) {
                    const range = getMonthDateRangeDetailed(i, proj.tglMulai, proj.tglSelesai);
                    const opt = document.createElement('option');
                    opt.value = `Bulan ${i}`;
                    opt.textContent = range ? `Bulan ${i} (${range.labelShort})` : `Bulan ${i}`;
                    if (`Bulan ${i}` === curVal) opt.selected = true;
                    bulanSel.appendChild(opt);
                }
            }

            const selectedBulan = bulanSel ? bulanSel.value : 'Bulan 1';
            const selectedMonthNum = parseInt((selectedBulan || '').replace(/\D/g, ''), 10) || 1;
            const monthWeekRange = getMonthWeekRange(selectedMonthNum);

            // Tampilkan periode tanggal lengkap & detail (nama hari + nama bulan penuh) untuk bulan terpilih.
            if (periodeLabelEl) {
                const rangeDetailed = getMonthDateRangeDetailed(selectedMonthNum, proj.tglMulai, proj.tglSelesai);
                periodeLabelEl.innerHTML = rangeDetailed
                    ? `<i class="fa-solid fa-calendar-days mr-1"></i>Periode: <span class="text-purple-300 font-semibold">${rangeDetailed.labelFull}</span>`
                    : `<i class="fa-solid fa-calendar-days mr-1"></i>Tanggal Mulai Proyek belum diatur, periode tanggal tidak dapat dihitung.`;
            }

            tbody.innerHTML = '';
            const projRAB = rabData.filter(r => r.projId === activeProjectId);
            const subtotal = projRAB.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);

            const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
            const displayRAB = query
                ? projRAB.filter(r => [r.noDiv, r.div, r.sub, r.rincian, r.satuan].some(v => (v || '').toString().toLowerCase().includes(query)))
                : projRAB;

            if (displayRAB.length === 0) {
                tbody.innerHTML = `<tr><td colspan="18" class="p-6 text-center text-slate-500">${projRAB.length === 0 ? 'Belum ada data RAB / Pekerjaan.' : 'Tidak ada item yang cocok dengan pencarian.'}</td></tr>`;
            } else {
                // Kelompokkan per Divisi (sama persis seperti Laporan Mingguan), supaya total per divisi & total
                // keseluruhan bisa ditampilkan langsung di dalam list Laporan Bulanan.
                const divGroups = [];
                const divGroupMap = new Map();
                displayRAB.forEach(item => {
                    const key = (item.noDiv || '-') + '||' + (item.div || '-');
                    if (!divGroupMap.has(key)) {
                        const group = { noDiv: item.noDiv, div: item.div, items: [] };
                        divGroupMap.set(key, group);
                        divGroups.push(group);
                    }
                    divGroupMap.get(key).items.push(item);
                });
                divGroups.sort((ga, gb) => compareDivisionKey(ga.noDiv, gb.noDiv));

                let sumMoneyBulanIni = 0;
                let sumBobotBulanIni = 0;
                let grandJumlahHargaRab = 0, grandBobotRab = 0;
                let grandBobotLalu = 0, grandBobotIni = 0, grandBobotKum = 0, grandUang = 0;

                divGroups.forEach(group => {
                    let divJumlahHargaRab = 0, divBobotRab = 0;
                    let divBobotLalu = 0, divBobotIni = 0, divBobotKum = 0, divUang = 0;

                    group.items.forEach(item => {
                        // Jumlah Harga & Bobot (%) di sini PERSIS sama dengan kolom di list RAB / Laporan Mingguan
                        // (nilai & bobot penuh/rencana item ini terhadap keseluruhan proyek).
                        const itemTotalHarga = item.volume * item.harga;
                        const bobotItemRab = subtotal > 0 ? (itemTotalHarga / subtotal) * 100 : 0;

                        // Volume Bulan Ini & Bulan Lalu TIDAK diinput manual - diambil otomatis dengan menjumlahkan
                        // seluruh Volume Minggu Ini pada Laporan Mingguan (lapMingguanData) sesuai minggu-minggu
                        // yang termasuk dalam bulan terkait (1 Bulan = 4 Minggu).
                        const itemLmEntries = lapMingguanData.filter(l => l.rabId == item.id);
                        // Bulan 1 (mulai dari Minggu 1) tidak punya "bulan sebelumnya", jadi Vol. Bulan Lalu
                        // WAJIB 0. Baris dengan minggu tidak valid/kosong juga tidak dihitung sebagai "lalu".
                        const volLalu = monthWeekRange.start <= 1 ? 0 : itemLmEntries
                            .filter(l => {
                                const wk = parseInt((l.mingguKe || '').replace(/\D/g, ''), 10);
                                return wk >= 1 && wk < monthWeekRange.start;
                            })
                            .reduce((acc, cur) => acc + (Number(cur.volume) || 0), 0);
                        const bulanEntries = itemLmEntries.filter(l => {
                            const wk = parseInt((l.mingguKe || '').replace(/\D/g, ''), 10) || 0;
                            return wk >= monthWeekRange.start && wk <= monthWeekRange.end;
                        });
                        const volIni = bulanEntries.reduce((acc, cur) => acc + (Number(cur.volume) || 0), 0);
                        const volKum = volLalu + volIni;
                        const sisaVolume = Math.max(item.volume - volKum, 0);
                        // Keterangan: gabungan keterangan Laporan Mingguan pada minggu-minggu di bulan terkait.
                        const keterangan = bulanEntries.map(l => l.keterangan).filter(k => (k || '').trim() !== '').join('; ');

                        const bobotLalu = subtotal > 0 ? (volLalu * item.harga / subtotal) * 100 : 0;
                        const bobotIni = subtotal > 0 ? (volIni * item.harga / subtotal) * 100 : 0;
                        const bobotKum = subtotal > 0 ? (volKum * item.harga / subtotal) * 100 : 0;
                        const jumlahUang = volKum * item.harga;

                        // % Bobot Item = progress kumulatif item ini terhadap bobot RAB (rencana) miliknya SENDIRI,
                        // yaitu (Bobot Komulatif Bulan Ini / Bobot RAB item) x 100. Idealnya tidak lebih dari 100%;
                        // jika melebihi 100% berarti volume yang diinput sudah melebihi volume rencana RAB-nya.
                        const progressItemPersen = bobotItemRab > 0 ? (bobotKum / bobotItemRab) * 100 : 0;
                        const isOverProgress = progressItemPersen > 100;

                        divJumlahHargaRab += itemTotalHarga; divBobotRab += bobotItemRab;
                        divBobotLalu += bobotLalu; divBobotIni += bobotIni; divBobotKum += bobotKum;
                        divUang += jumlahUang;
                        sumMoneyBulanIni += (volIni * item.harga);
                        sumBobotBulanIni += bobotIni;

                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-slate-800/50 transition';
                        tr.innerHTML = `
                            <td class="p-3 font-mono font-bold text-amber-400">${item.noDiv || '-'}</td>
                            <td class="p-3 font-semibold text-white">${item.div || '-'}</td>
                            <td class="p-3">${item.sub}</td>
                            <td class="p-3 text-slate-400">${item.rincian || ''}</td>
                            <td class="p-3 font-mono">${item.satuan}</td>
                            <td class="p-3 font-mono">${formatAngka(item.volume)}</td>
                            <td class="p-3 font-mono">${formatRupiah(item.harga)}</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(itemTotalHarga)}</td>
                            <td class="p-3 font-mono font-bold text-sky-400">${bobotItemRab.toFixed(2)}%</td>
                            <td class="p-3 font-mono text-slate-400">${formatAngka(volLalu)}</td>
                            <td class="p-3">
                                <span class="font-mono text-white">${formatAngka(volIni)}</span>
                                <div class="text-[9px] text-slate-500 mt-0.5">Sisa: ${formatAngka(sisaVolume)} ${item.satuan}</div>
                            </td>
                            <td class="p-3 font-mono font-bold text-sky-300">${formatAngka(volKum)}</td>
                            <td class="p-3 font-mono text-slate-400">${bobotLalu.toFixed(2)}%</td>
                            <td class="p-3 font-mono font-bold text-amber-300">${bobotIni.toFixed(2)}%</td>
                            <td class="p-3 font-mono font-bold text-sky-400">${bobotKum.toFixed(2)}%</td>
                            <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(jumlahUang)}</td>
                            <td class="p-3">
                                <span class="font-mono font-bold ${isOverProgress ? 'text-red-400' : 'text-slate-300'}">${progressItemPersen.toFixed(2)}%</span>
                                ${isOverProgress ? `<div class="text-[9px] text-red-400 font-bold mt-0.5"><i class="fa-solid fa-triangle-exclamation"></i> Melebihi 100%!</div>` : ''}
                            </td>
                            <td class="p-3 text-slate-300">${escapeHtml(keterangan) || '-'}</td>
                        `;
                        tbody.appendChild(tr);
                    });

                    // Baris total per divisi: kolom "% Bobot Item" (progress per-item) TIDAK dijumlahkan karena
                    // itu murni rasio milik masing2 item sendiri, begitu juga kolom Volume (satuan berbeda2).
                    const subtotalTr = document.createElement('tr');
                    subtotalTr.className = 'bg-[#15203c] border-t border-b border-slate-700';
                    subtotalTr.innerHTML = `
                        <td class="p-3 font-bold text-purple-300 uppercase tracking-wide" colspan="7">Total ${group.noDiv || '-'} &mdash; ${group.div || '-'}</td>
                        <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(divJumlahHargaRab)}</td>
                        <td class="p-3 font-mono font-bold text-sky-300">${divBobotRab.toFixed(2)}%</td>
                        <td class="p-3 text-slate-600">-</td>
                        <td class="p-3 text-slate-600">-</td>
                        <td class="p-3 text-slate-600">-</td>
                        <td class="p-3 font-mono font-bold text-slate-300">${divBobotLalu.toFixed(2)}%</td>
                        <td class="p-3 font-mono font-bold text-amber-300">${divBobotIni.toFixed(2)}%</td>
                        <td class="p-3 font-mono font-bold text-sky-300">${divBobotKum.toFixed(2)}%</td>
                        <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(divUang)}</td>
                        <td class="p-3 text-slate-600">-</td>
                        <td class="p-3"></td>
                    `;
                    tbody.appendChild(subtotalTr);

                    grandJumlahHargaRab += divJumlahHargaRab; grandBobotRab += divBobotRab;
                    grandBobotLalu += divBobotLalu; grandBobotIni += divBobotIni; grandBobotKum += divBobotKum;
                    grandUang += divUang;
                });

                const grandTr = document.createElement('tr');
                grandTr.className = 'bg-purple-950/40 border-t-2 border-purple-500/60';
                grandTr.innerHTML = `
                    <td class="p-3 font-black text-purple-300 uppercase tracking-wide" colspan="7">Total Keseluruhan Divisi</td>
                    <td class="p-3 font-mono font-black text-emerald-300">${formatRupiah(grandJumlahHargaRab)}</td>
                    <td class="p-3 font-mono font-black text-sky-300">${grandBobotRab.toFixed(2)}%</td>
                    <td class="p-3 text-slate-600">-</td>
                    <td class="p-3 text-slate-600">-</td>
                    <td class="p-3 text-slate-600">-</td>
                    <td class="p-3 font-mono font-black text-slate-200">${grandBobotLalu.toFixed(2)}%</td>
                    <td class="p-3 font-mono font-black text-amber-300">${grandBobotIni.toFixed(2)}%</td>
                    <td class="p-3 font-mono font-black text-sky-300">${grandBobotKum.toFixed(2)}%</td>
                    <td class="p-3 font-mono font-black text-emerald-300">${formatRupiah(grandUang)}</td>
                    <td class="p-3 text-slate-600">-</td>
                    <td class="p-3"></td>
                `;
                tbody.appendChild(grandTr);

                // Kartu ringkasan atas: bobot rencana bulan ini diambil dari Time Schedule (jika ada jadwal),
                // dijumlahkan dari rencana mingguan pada minggu-minggu yang termasuk dalam bulan terpilih,
                // supaya deviasi rencana vs realisasi lebih akurat dibanding angka tetap.
                let planBobotBulan = 0;
                try {
                    const totalWeeks = getProjectScheduleWeeks();
                    const subKeys = [...new Set(projRAB.map(r => `${r.noDiv || '-'}|||${r.sub}`))];
                    subKeys.forEach(key => {
                        const [noDiv, sub] = key.split('|||');
                        const rencanaMingguan = getSubScheduleWeekly(noDiv, sub, totalWeeks, proj.tglMulai);
                        for (let w = monthWeekRange.start; w <= monthWeekRange.end; w++) {
                            if (w >= 1 && w <= totalWeeks) planBobotBulan += rencanaMingguan[w - 1] || 0;
                        }
                    });
                } catch (err) { planBobotBulan = 0; }

                document.getElementById('lbSumMoney').innerText = formatRupiah(sumMoneyBulanIni);
                document.getElementById('lbSumPlanBobot').innerText = planBobotBulan.toFixed(2) + '%';
                document.getElementById('lbSumRealBobot').innerText = sumBobotBulanIni.toFixed(2) + '%';
                const dev = sumBobotBulanIni - planBobotBulan;
                document.getElementById('lbSumDevBobot').innerText = (dev >= 0 ? '+' : '') + dev.toFixed(2) + '%';
                document.getElementById('lbSumKumBobot').innerText = grandBobotKum.toFixed(2) + '%';
                document.getElementById('lbSumStatus').innerText = dev >= 0 ? 'Sesuai / Ahead' : 'Delay / Lagging';
                document.getElementById('lbSumStatus').className = dev >= 0 ? 'text-xs font-bold text-emerald-400 mt-1' : 'text-xs font-bold text-red-400 mt-1';
            }
        }

        // ===================================================================
        // 3.1 TIME SCHEDULE & KURVA S
