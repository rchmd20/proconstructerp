        // ===================================================================
        function renderHomeDashboard() {
            if (!currentUser) return;
            const proj = projects.find(p => p.id === activeProjectId) || null;
            const nowDate = new Date();
            const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const bulanList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const tglEl = document.getElementById('homeTodayDate');
            if (tglEl) {
                const spanEl = tglEl.querySelector('span');
                if (spanEl) spanEl.innerText = `${hariList[nowDate.getDay()]}, ${nowDate.getDate()} ${bulanList[nowDate.getMonth()]} ${nowDate.getFullYear()}`;
            }

            const namaUser = currentUser.name || 'User';
            const jamSekarang = nowDate.getHours();
            let sapaan = 'Selamat Datang';
            if (jamSekarang < 11) sapaan = 'Selamat Pagi';
            else if (jamSekarang < 15) sapaan = 'Selamat Siang';
            else if (jamSekarang < 18) sapaan = 'Selamat Sore';
            else sapaan = 'Selamat Malam';
            document.getElementById('homeGreetingText').innerHTML = `<i class="fa-solid fa-helmet-safety text-amber-400"></i> <span>${sapaan}, ${namaUser}</span>`;
            document.getElementById('homeGreetingSub').innerText = `${currentUser.position || currentUser.role || ''} — berikut ringkasan kondisi proyek Anda hari ini.`;

            // Info Proyek Aktif
            document.getElementById('homeProjectName').innerText = proj ? proj.nama : 'Belum ada proyek aktif';
            document.getElementById('homeProjectLoc').innerText = proj ? (proj.lokasi || '-') : '-';
            let sisaHariText = '-';
            if (proj && proj.tglSelesai) {
                const end = new Date(proj.tglSelesai);
                const diffMs = end.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                sisaHariText = diffDays > 0 ? `${diffDays} hari lagi` : (diffDays === 0 ? 'Selesai hari ini' : `Lewat ${Math.abs(diffDays)} hari`);
            }
            document.getElementById('homeProjectSisaHari').innerText = sisaHariText;

            const btnQuickKaryawan = document.getElementById('homeQuickKaryawan');
            if (btnQuickKaryawan) btnQuickKaryawan.classList.toggle('hidden', !isAdminUser());

            if (!proj) {
                document.getElementById('homeKpiTotalAnggaran').innerText = 'Rp 0';
                document.getElementById('homeKpiProgress').innerText = '0%';
                document.getElementById('homeKpiItemRab').innerText = '0';
                document.getElementById('homeKpiKaryawan').innerText = '0';
                document.getElementById('homeKpiAbsenHariIni').innerText = '0';
                document.getElementById('homeKpiMaterial').innerText = '0';
                document.getElementById('homeProgressBar').style.width = '0%';
                document.getElementById('homeProgressLabel').innerText = '0%';
                document.getElementById('homeWeeklyProgressPeriod').innerText = '-';
                document.getElementById('homeWeeklyProgressContent').classList.add('hidden');
                document.getElementById('homeWeeklyProgressEmpty').classList.remove('hidden');
                if (homeBudgetChartInstance) { homeBudgetChartInstance.destroy(); homeBudgetChartInstance = null; }
                const emptyEl = document.getElementById('homeChartEmptyState');
                if (emptyEl) emptyEl.classList.remove('hidden');
                return;
            }

            const projRAB = rabData.filter(r => r.projId === activeProjectId);
            const subtotal = projRAB.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);
            const biayaTambahan = Array.isArray(proj.biayaTambahan) ? proj.biayaTambahan : [];
            const totalPersenTambahan = biayaTambahan.reduce((acc, cur) => acc + (Number(cur.persen) || 0), 0);
            const tambahanVal = subtotal * (totalPersenTambahan / 100);
            const dasarPpn = subtotal + tambahanVal;
            const ppnVal = dasarPpn * ((proj.ppn || 0) / 100);
            const pphVal = subtotal * ((proj.pph || 0) / 100);
            const grandTotal = subtotal + tambahanVal + ppnVal + pphVal;
            document.getElementById('homeKpiTotalAnggaran').innerText = formatRupiah(grandTotal);
            document.getElementById('homeKpiItemRab').innerText = projRAB.length;

            // Progres Fisik Komulatif: HARUS mengikuti Bobot Komulatif pada Laporan Mingguan (bukan dihitung
            // ulang terpisah dari Laporan Harian), diambil s/d minggu TERAKHIR yang sudah ada data realisasi
            // (opname) - dengan begitu bobot terbaru yang ada di Laporan Mingguan selalu langsung terbaca di
            // sini, walau user belum sempat buka/pilih minggu terakhir itu secara manual di halaman Laporan
            // Mingguan. bqOpnameNetVolumeCumulative(item.id, undefined) = jumlahkan SELURUH minggu yang
            // tercatat datanya (tidak dibatasi sampai minggu tertentu) = sama persis dengan Bobot Komulatif
            // yang akan tampil di Laporan Mingguan pada minggu terakhir yang sudah diisi.
            let bobotKumTotal = 0;
            if (subtotal > 0) {
                projRAB.forEach(item => {
                    const volKum = bqOpnameNetVolumeCumulative(item.id, undefined);
                    const volKumClamped = Math.min(Math.max(volKum, 0), item.volume);
                    bobotKumTotal += (volKumClamped * item.harga / subtotal) * 100;
                });
            }
            bobotKumTotal = Math.max(0, Math.min(100, bobotKumTotal));
            document.getElementById('homeKpiProgress').innerText = bobotKumTotal.toFixed(1) + '%';
            document.getElementById('homeProgressBar').style.width = bobotKumTotal.toFixed(1) + '%';
            document.getElementById('homeProgressLabel').innerText = bobotKumTotal.toFixed(1) + '%';

            // Karyawan
            const projKaryawan = karyawanData.filter(k => k.projId === activeProjectId);
            document.getElementById('homeKpiKaryawan').innerText = projKaryawan.length;

            // Absen masuk hari ini
            const todayStr = new Date().toISOString().split('T')[0];
            const absenHariIni = absenMasukData.filter(a => a.projId === activeProjectId && a.tanggal === todayStr).length;
            document.getElementById('homeKpiAbsenHariIni').innerText = absenHariIni;

            // Material
            const projMaterial = kebutuhanMatData.filter(m => m.projId === activeProjectId);
            document.getElementById('homeKpiMaterial').innerText = projMaterial.length;

            // Progress Minggu Ini (Kumulatif): Rencana Kumulatif, Realisasi Kumulatif, & Deviasi
            // dihitung sampai dengan minggu berjalan saat ini, mengikuti Rencana Jadwal (Time Schedule)
            renderHomeWeeklyProgress(proj);

            // Chart Komposisi Anggaran per Divisi
            const chartCanvas = document.getElementById('homeBudgetChart');
            const emptyStateEl = document.getElementById('homeChartEmptyState');
            if (homeBudgetChartInstance) { homeBudgetChartInstance.destroy(); homeBudgetChartInstance = null; }
            if (projRAB.length === 0 || subtotal <= 0) {
                if (emptyStateEl) emptyStateEl.classList.remove('hidden');
                if (chartCanvas) chartCanvas.classList.add('hidden');
            } else {
                if (emptyStateEl) emptyStateEl.classList.add('hidden');
                if (chartCanvas) chartCanvas.classList.remove('hidden');
                const divTotals = {};
                projRAB.forEach(item => {
                    const key = item.div || 'Lainnya';
                    divTotals[key] = (divTotals[key] || 0) + (item.volume * item.harga);
                });
                const palette = ['#f59e0b', '#0ea5e9', '#10b981', '#6366f1', '#f43f5e', '#a855f7', '#eab308', '#14b8a6'];
                const labels = Object.keys(divTotals);
                const values = Object.values(divTotals);
                homeBudgetChartInstance = new Chart(chartCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels,
                        datasets: [{
                            data: values,
                            backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                            borderColor: '#1e293b',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: window.innerWidth < 768 ? 'bottom' : 'right', labels: { color: '#cbd5e1', boxWidth: 10, font: { size: 10 } } },
                            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatRupiah(ctx.parsed)}` } }
                        }
                    }
                });
            }
        }

        // Progress Minggu Ini (Kumulatif) pada Beranda: Rencana Kumulatif, Realisasi Kumulatif, & Deviasi
        // dihitung sampai dengan minggu berjalan saat ini (berdasarkan tanggal hari ini terhadap Tanggal
        // Mulai proyek), memakai data Rencana Jadwal yang sama dengan Kurva-S pada halaman Time Schedule.
        function renderHomeWeeklyProgress(proj) {
            const contentEl = document.getElementById('homeWeeklyProgressContent');
            const emptyEl = document.getElementById('homeWeeklyProgressEmpty');
            const periodEl = document.getElementById('homeWeeklyProgressPeriod');
            if (!contentEl || !emptyEl || !periodEl) return;

            if (!proj || !proj.tglMulai) {
                contentEl.classList.add('hidden');
                emptyEl.classList.remove('hidden');
                emptyEl.innerText = 'Tanggal Mulai proyek belum diisi (isi di menu Kelola Proyek).';
                periodEl.innerText = '-';
                return;
            }

            const { totalWeeks, planCumulative, realCumulative } = computeProjectCumulativeSCurve();
            const hasSchedule = divScheduleData.some(d => d.projId === activeProjectId && (d.weeks || []).length > 0);
            if (!hasSchedule) {
                contentEl.classList.add('hidden');
                emptyEl.classList.remove('hidden');
                emptyEl.innerText = 'Rencana jadwal (Time Schedule) belum diisi untuk proyek ini.';
                periodEl.innerText = '-';
                return;
            }

            const todayStr = new Date().toISOString().split('T')[0];
            let currentWeek = getWeekIndexFromProjectStart(todayStr, proj.tglMulai, totalWeeks);
            // Kalau hari ini sebelum Tanggal Mulai proyek (belum mulai), tampilkan posisi Minggu 1 (belum berjalan)
            if (!currentWeek) currentWeek = 1;
            currentWeek = Math.max(1, Math.min(currentWeek, totalWeeks));

            const range = getWeekDateRangeDetailed(currentWeek, proj.tglMulai, proj.tglSelesai);
            periodEl.innerText = range ? `Minggu ${currentWeek}: ${range.labelShort}` : `Minggu ${currentWeek}`;

            const rencanaKumulatif = planCumulative[currentWeek - 1] || 0;
            const realisasiKumulatif = realCumulative[currentWeek - 1] || 0;
            const deviasi = realisasiKumulatif - rencanaKumulatif;

            contentEl.classList.remove('hidden');
            emptyEl.classList.add('hidden');
            document.getElementById('homeWeeklyRencana').innerText = formatAngka(rencanaKumulatif) + '%';
            document.getElementById('homeWeeklyRealisasi').innerText = formatAngka(realisasiKumulatif) + '%';

            const deviasiEl = document.getElementById('homeWeeklyDeviasi');
            const deviasiBoxEl = document.getElementById('homeWeeklyDeviasiBox');
            const deviasiLabelEl = document.getElementById('homeWeeklyDeviasiLabel');
            const deviasiText = (deviasi >= 0 ? '+' : '') + formatAngka(deviasi) + '%';
            deviasiEl.innerText = deviasiText;
            if (deviasi >= 0) {
                deviasiEl.className = 'text-xl font-extrabold font-mono mt-1 break-words leading-tight text-emerald-400';
                deviasiBoxEl.className = 'bg-[#0b132b] border border-emerald-500/30 rounded-xl p-3';
                deviasiLabelEl.innerHTML = '<i class="fa-solid fa-arrow-up mr-1"></i>Lebih cepat dari rencana';
                deviasiLabelEl.className = 'text-[10px] mt-0.5 text-emerald-400';
            } else {
                deviasiEl.className = 'text-xl font-extrabold font-mono mt-1 break-words leading-tight text-red-400';
                deviasiBoxEl.className = 'bg-[#0b132b] border border-red-500/30 rounded-xl p-3';
                deviasiLabelEl.innerHTML = '<i class="fa-solid fa-arrow-down mr-1"></i>Terlambat dari rencana';
                deviasiLabelEl.className = 'text-[10px] mt-0.5 text-red-400';
            }
        }

        function initDropdowns() {
            // Populate Dropdowns like employee selects, RAB item selects, etc.
            const empSelect = document.getElementById('absenNamaSelect');
            if (empSelect) {
                empSelect.innerHTML = '';
                const projEmps = karyawanData.filter(e => e.projId === activeProjectId);
                projEmps.forEach(e => {
                    const opt = document.createElement('option');
                    opt.value = e.nama;
                    opt.textContent = `${e.nama} - ${e.jabatan}`;
                    empSelect.appendChild(opt);
                });
            }

            // Populate time schedule pekerjaan select (kepala Sub Pekerjaan RAB, bukan Divisi)
            populateTsSubSelect();
        }

        // Populate dropdown "Pilih Schedule" pada Time Schedule: isinya kepala Sub Pekerjaan (bukan Divisi),
        // diberi label No Divisi + Kepala Sub, dan berurutan mengikuti nomor divisinya (urutan RAB).
        // Dipakai bersama oleh initDropdowns() & renderTimeSchedule() supaya selalu konsisten & tidak duplikat logic.
        function populateTsSubSelect() {
            const tsDivSelect = document.getElementById('tsDivSelect');
            if (!tsDivSelect) return;
            const prevVal = tsDivSelect.value;
            tsDivSelect.innerHTML = '';
            const projRab = rabData.filter(r => r.projId === activeProjectId);
            const subKeys = [...new Set(projRab.map(r => `${r.noDiv || '-'}|||${r.sub}`))]
                .sort((a, b) => compareDivisionKey(a.split('|||')[0], b.split('|||')[0]));
            subKeys.forEach(key => {
                const [noDiv, sub] = key.split('|||');
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = `${noDiv} - ${sub}`;
                tsDivSelect.appendChild(opt);
            });
            if (prevVal && subKeys.includes(prevVal)) tsDivSelect.value = prevVal;
        }

        // ===================================================================
        // 1. RAB MODULE & EXCEL IMPORT WITH FORMAT GUIDE & SHEET SELECTOR
