        // ===================================================================
        function renderRAB() {
            const tbody = document.getElementById('rabTableBody');
            tbody.innerHTML = '';
            const projRAB = rabData.filter(r => r.projId === activeProjectId);

            const subtotal = projRAB.reduce((acc, cur) => acc + (cur.volume * cur.harga), 0);
            const proj = projects.find(p => p.id === activeProjectId) || { ppn: 11, pph: 2, biayaTambahan: [] };
            const biayaTambahan = Array.isArray(proj.biayaTambahan) ? proj.biayaTambahan : [];
            const totalPersenTambahan = biayaTambahan.reduce((acc, cur) => acc + (Number(cur.persen) || 0), 0);
            const tambahanVal = subtotal * (totalPersenTambahan / 100);
            // PPN dihitung dari Subtotal Fisik Pekerjaan DITAMBAH Nominal Tambahan (%), sehingga
            // biaya tambahan juga ikut kena PPN, bukan hanya dari subtotal fisik pekerjaan saja.
            const dasarPpn = subtotal + tambahanVal;
            const ppnVal = dasarPpn * (proj.ppn / 100);
            const pphVal = subtotal * (proj.pph / 100);
            // Subtotal + Biaya Tambahan + PPN (atas subtotal & tambahan) + PPH dijumlahkan ke Total Anggaran Proyek.
            const grandTotal = subtotal + tambahanVal + ppnVal + pphVal;

            document.getElementById('rabPpnInput').value = proj.ppn;
            document.getElementById('rabPphInput').value = proj.pph;
            document.getElementById('ppnLabel').innerText = proj.ppn + '%';
            document.getElementById('pphLabel').innerText = proj.pph + '%';
            document.getElementById('tambahanLabel').innerText = totalPersenTambahan.toFixed(2).replace(/\.00$/, '') + '%';

            document.getElementById('rabSubtotalSum').innerText = formatRupiah(subtotal);
            document.getElementById('rabPpnSum').innerText = formatRupiah(ppnVal);
            document.getElementById('rabPphSum').innerText = formatRupiah(pphVal);
            document.getElementById('rabTambahanSum').innerText = formatRupiah(tambahanVal);
            document.getElementById('rabTotalGrandSum').innerText = formatRupiah(grandTotal);

            // Render daftar item Biaya Tambahan (%) - bisa ditambah/dihapus, terhubung ke total di atas.
            const tambahanListEl = document.getElementById('rabTambahanList');
            const adminForTambahan = isAdminUser();
            if (biayaTambahan.length === 0) {
                tambahanListEl.innerHTML = `<div class="text-[11px] text-slate-500 italic">Belum ada biaya tambahan. Tambahkan jika ada persentase lain di luar PPN/PPH.</div>`;
            } else {
                tambahanListEl.innerHTML = biayaTambahan.map(b => {
                    const nominal = subtotal * ((Number(b.persen) || 0) / 100);
                    const removeBtn = adminForTambahan
                        ? `<button type="button" onclick="removeBiayaTambahan(${b.id})" class="text-red-400 hover:text-red-300 px-2" title="Hapus"><i class="fa-solid fa-xmark"></i></button>`
                        : '';
                    return `<div class="flex items-center justify-between bg-[#0b132b] border border-slate-700 rounded-lg px-3 py-1.5 text-xs">
                        <span class="text-slate-200 font-medium">${b.label}</span>
                        <div class="flex items-center space-x-3">
                            <span class="font-mono font-bold text-indigo-300">${Number(b.persen) || 0}%</span>
                            <span class="font-mono text-slate-400">${formatRupiah(nominal)}</span>
                            ${removeBtn}
                        </div>
                    </div>`;
                }).join('');
            }

            if (projRAB.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-500">Belum ada data RAB untuk proyek ini. Silakan input atau import Excel.</td></tr>`;
                return;
            }

            // Fitur pencarian pada list RAB: filter hanya baris yang ditampilkan, subtotal/bobot tetap dihitung dari seluruh data RAB proyek
            const rabSearchEl = document.getElementById('rabSearchInput');
            const rabSearchQuery = rabSearchEl ? rabSearchEl.value.trim().toLowerCase() : '';
            const displayRAB = rabSearchQuery
                ? projRAB.filter(r => `${r.noDiv} ${r.div} ${r.sub} ${r.rincian} ${r.satuan}`.toLowerCase().includes(rabSearchQuery))
                : projRAB;

            if (displayRAB.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-500">Tidak ada item RAB yang cocok dengan pencarian "${rabSearchEl ? rabSearchEl.value : ''}".</td></tr>`;
                applyRoleBasedUI();
                initDropdowns();
                return;
            }

            const admin = isAdminUser();
            const canReorder = admin && !rabSearchQuery; // Urutan drag naik/turun hanya valid saat list tidak sedang difilter pencarian

            // Kelompokkan item per Divisi (No/Div + Nama Divisi) sesuai urutan kemunculan pertama,
            // supaya total harga & total bobot per divisi bisa ditampilkan langsung di dalam list,
            // lalu diakhiri baris Total Keseluruhan Divisi.
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

            // Urutkan kelompok Divisi sesuai nilai nomor divisinya (mendukung angka Romawi bertingkat
            // seperti V.01, V.02, VI.01, VI.02), supaya urutan tampil di list selalu rapi berurutan
            // dan tidak loncat-loncat, terlepas dari urutan input/drag data aslinya.
            divGroups.sort((ga, gb) => compareDivisionKey(ga.noDiv, gb.noDiv));

            let grandDisplayedHarga = 0;
            let grandDisplayedBobot = 0;

            divGroups.forEach(group => {
                let divHarga = 0;
                let divBobot = 0;

                group.items.forEach((item, idxInGroup) => {
                    const totalHarga = item.volume * item.harga;
                    const bobotNum = subtotal > 0 ? (totalHarga / subtotal) * 100 : 0;
                    divHarga += totalHarga;
                    divBobot += bobotNum;

                    const isFirstInGroup = idxInGroup === 0;
                    const isLastInGroup = idxInGroup === group.items.length - 1;
                    const reorderCell = canReorder
                        ? `<div class="flex items-center justify-center space-x-0.5 mr-1">
                                <button onclick="moveRABItem(${item.id}, 'up')" ${isFirstInGroup ? 'disabled' : ''} class="p-1 rounded-lg transition ${isFirstInGroup ? 'text-slate-700 cursor-not-allowed' : 'bg-slate-700/40 hover:bg-slate-600 text-slate-300 hover:text-white'}" title="Naikkan urutan (dalam divisi yang sama)">
                                    <i class="fa-solid fa-arrow-up text-[10px]"></i>
                                </button>
                                <button onclick="moveRABItem(${item.id}, 'down')" ${isLastInGroup ? 'disabled' : ''} class="p-1 rounded-lg transition ${isLastInGroup ? 'text-slate-700 cursor-not-allowed' : 'bg-slate-700/40 hover:bg-slate-600 text-slate-300 hover:text-white'}" title="Turunkan urutan (dalam divisi yang sama)">
                                    <i class="fa-solid fa-arrow-down text-[10px]"></i>
                                </button>
                            </div>`
                        : '';

                    const actionCell = admin
                        ? `<div class="flex items-center justify-center space-x-1">
                                ${reorderCell}
                                <button onclick="editRABItem(${item.id})" class="bg-sky-600/20 hover:bg-sky-600 text-sky-400 hover:text-white p-1.5 rounded-lg transition" title="Edit">
                                    <i class="fa-solid fa-pen text-xs"></i>
                                </button>
                                <button onclick="deleteRABItem(${item.id})" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1.5 rounded-lg transition" title="Hapus">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>`
                        : `<span class="text-slate-600 text-[10px]" title="Hanya Admin yang dapat mengubah/menghapus data RAB"><i class="fa-solid fa-lock"></i></span>`;

                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-slate-800/50 transition';
                    tr.innerHTML = `
                        <td class="p-3 font-mono font-bold text-amber-400">${item.noDiv}</td>
                        <td class="p-3 font-semibold text-white">${item.div}</td>
                        <td class="p-3">${item.sub}</td>
                        <td class="p-3 text-slate-400">${item.rincian}</td>
                        <td class="p-3 font-mono">${item.satuan}</td>
                        <td class="p-3 font-mono">${formatAngka(item.volume)}</td>
                        <td class="p-3 font-mono">${formatRupiah(item.harga)}</td>
                        <td class="p-3 font-mono font-bold text-emerald-400">${formatRupiah(totalHarga)}</td>
                        <td class="p-3 font-mono font-bold text-sky-400">${bobotNum.toFixed(2)}%</td>
                        <td class="p-3 text-center col-aksi">${actionCell}</td>
                    `;
                    tbody.appendChild(tr);
                });

                grandDisplayedHarga += divHarga;
                grandDisplayedBobot += divBobot;

                const subtotalTr = document.createElement('tr');
                subtotalTr.className = 'bg-[#15203c] border-t border-b border-slate-700';
                subtotalTr.innerHTML = `
                    <td class="p-3 font-bold text-amber-300 uppercase tracking-wide" colspan="7">Total ${group.noDiv || '-'} &mdash; ${group.div || '-'}</td>
                    <td class="p-3 font-mono font-bold text-emerald-300">${formatRupiah(divHarga)}</td>
                    <td class="p-3 font-mono font-bold text-sky-300">${divBobot.toFixed(2)}%</td>
                    <td class="p-3"></td>
                `;
                tbody.appendChild(subtotalTr);
            });

            const grandTr = document.createElement('tr');
            grandTr.className = 'bg-emerald-950/40 border-t-2 border-emerald-500/60';
            grandTr.innerHTML = `
                <td class="p-3 font-black text-emerald-300 uppercase tracking-wide" colspan="7">Total Keseluruhan Divisi</td>
                <td class="p-3 font-mono font-black text-emerald-300">${formatRupiah(grandDisplayedHarga)}</td>
                <td class="p-3 font-mono font-black text-emerald-300">${grandDisplayedBobot.toFixed(2)}%</td>
                <td class="p-3"></td>
            `;
            tbody.appendChild(grandTr);

            applyRoleBasedUI();
            initDropdowns();
        }

        function handleRABSubmit(e) {
            e.preventDefault();
            // Diperiksa langsung dari currentUser.role (bukan hanya isAdminUser()) agar akun Admin yang
            // baru saja daftar/login tetap bisa langsung mengedit/menambah RAB tanpa kendala apapun.
            if (!currentUser || currentUser.role !== 'Admin') {
                alert('Akses ditolak. Hanya Admin yang dapat menambah/mengubah data RAB.');
                return;
            }
            const editId = document.getElementById('rabEditId').value;
            const formValues = {
                noDiv: document.getElementById('rabNoDiv').value.trim(),
                div: document.getElementById('rabDiv').value.trim(),
                sub: document.getElementById('rabSub').value.trim(),
                rincian: document.getElementById('rabRincian').value.trim(),
                satuan: document.getElementById('rabSatuan').value.trim(),
                volume: parseFloat(document.getElementById('rabVolume').value) || 0,
                harga: parseFloat(document.getElementById('rabHarga').value) || 0
            };

            if (editId) {
                // Mode Edit: perbarui item RAB yang sudah ada (rekapitulasi RAB bisa diedit oleh Admin)
                const idx = rabData.findIndex(r => r.id === Number(editId) || r.id === editId);
                if (idx !== -1) {
                    rabData[idx] = { ...rabData[idx], ...formValues };
                    localStorage.setItem('erp_rab', JSON.stringify(rabData));
                }
                cancelEditRABItem();
            } else {
                const newItem = { id: Date.now(), projId: activeProjectId, ...formValues };
                rabData.push(newItem);
                localStorage.setItem('erp_rab', JSON.stringify(rabData));
                document.getElementById('formRAB').reset();
            }
            renderRAB();
        }

        // Isi form RAB dengan data item yang dipilih agar Admin bisa mengedit data rekapitulasi RAB.
        function editRABItem(id) {
            if (!currentUser || currentUser.role !== 'Admin') {
                alert('Akses ditolak. Hanya Admin yang dapat mengubah data RAB.');
                return;
            }
            const item = rabData.find(r => r.id === id);
            if (!item) return;

            document.getElementById('rabEditId').value = item.id;
            document.getElementById('rabNoDiv').value = item.noDiv;
            document.getElementById('rabDiv').value = item.div;
            document.getElementById('rabSub').value = item.sub;
            document.getElementById('rabRincian').value = item.rincian;
            document.getElementById('rabSatuan').value = item.satuan;
            document.getElementById('rabVolume').value = item.volume;
            document.getElementById('rabHarga').value = item.harga;

            document.getElementById('rabFormTitle').innerText = 'Edit Item RAB';
            const submitBtn = document.getElementById('rabSubmitBtn');
            submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Simpan Perubahan';
            document.getElementById('rabCancelEditBtn').classList.remove('hidden');
            document.getElementById('rabFormCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function cancelEditRABItem() {
            document.getElementById('formRAB').reset();
            document.getElementById('rabEditId').value = '';
            document.getElementById('rabFormTitle').innerText = 'Form Input Item RAB';
            document.getElementById('rabSubmitBtn').innerHTML = '<i class="fa-solid fa-plus mr-1"></i> Tambah Item RAB';
            document.getElementById('rabCancelEditBtn').classList.add('hidden');
        }

        function deleteRABItem(id) {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat menghapus data RAB.');
                return;
            }
            if (confirm('Hapus item RAB ini?')) {
                rabData = rabData.filter(r => r.id !== id);
                localStorage.setItem('erp_rab', JSON.stringify(rabData));
                renderRAB();
            }
        }

        // Naik/turunkan urutan tampil 1 item RAB, TERBATAS hanya di dalam Divisi yang sama (tidak bisa
        // melewati/melompat ke divisi lain). Dilakukan dengan menukar posisi item ini dengan tetangganya
        // (item lain di divisi yang sama, urutan sebelum/sesudahnya) langsung di dalam array rabData,
        // sehingga urutan tampil di list RAB (dan seluruh grouping per divisi) ikut berubah & tersimpan.
        function moveRABItem(id, direction) {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat mengubah urutan item RAB.');
                return;
            }
            const projRAB = rabData.filter(r => r.projId === activeProjectId);
            const item = projRAB.find(r => r.id === id || r.id == id);
            if (!item) return;

            // Kelompok "1 divisi" = item lain dengan No/Div + Nama Divisi yang sama, dalam urutan
            // kemunculannya saat ini di projRAB (persis mengikuti logika grouping pada renderRAB).
            const divKey = (item.noDiv || '-') + '||' + (item.div || '-');
            const groupItems = projRAB.filter(r => (r.noDiv || '-') + '||' + (r.div || '-') === divKey);
            const idxInGroup = groupItems.findIndex(r => r.id === item.id);
            const targetItem = direction === 'up' ? groupItems[idxInGroup - 1] : groupItems[idxInGroup + 1];
            if (!targetItem) return; // Sudah di ujung divisi (atas/bawah) - tidak bisa naik/turun melewati divisi lain

            // Tukar posisi kedua item langsung di dalam array rabData (yang berisi data semua proyek),
            // supaya urutan tampil berubah persis & tersimpan permanen, tanpa mengganggu urutan proyek lain.
            const realIdxA = rabData.findIndex(r => r.id === item.id);
            const realIdxB = rabData.findIndex(r => r.id === targetItem.id);
            if (realIdxA === -1 || realIdxB === -1) return;
            [rabData[realIdxA], rabData[realIdxB]] = [rabData[realIdxB], rabData[realIdxA]];

            localStorage.setItem('erp_rab', JSON.stringify(rabData));
            renderRAB();
        }

        function updateProjectTaxes() {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat mengubah PPN/PPH proyek.');
                renderRAB();
                return;
            }
            const ppn = parseFloat(document.getElementById('rabPpnInput').value) || 0;
            const pph = parseFloat(document.getElementById('rabPphInput').value) || 0;
            const p = projects.find(x => x.id === activeProjectId);
            if (p) {
                p.ppn = ppn;
                p.pph = pph;
                localStorage.setItem('erp_projects', JSON.stringify(projects));
                renderRAB();
            }
        }

        // Biaya Tambahan (%): daftar persentase tambahan (di luar PPN/PPH) yang bisa ditambah & dihapus
        // bebas oleh Admin, masing-masing dihitung dari Subtotal Fisik Pekerjaan lalu otomatis
        // terjumlah ke Total Anggaran Proyek pada halaman RAB.
        function addBiayaTambahan() {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat menambah biaya tambahan.');
                return;
            }
            const labelEl = document.getElementById('rabTambahanLabel');
            const persenEl = document.getElementById('rabTambahanPersen');
            const label = labelEl.value.trim();
            const persen = parseFloat(persenEl.value);

            if (!label) {
                alert('Nama biaya tambahan wajib diisi.');
                return;
            }
            if (isNaN(persen) || persen <= 0) {
                alert('Persentase biaya tambahan harus berupa angka lebih dari 0.');
                return;
            }

            const p = projects.find(x => x.id === activeProjectId);
            if (!p) return;
            if (!Array.isArray(p.biayaTambahan)) p.biayaTambahan = [];
            p.biayaTambahan.push({ id: Date.now(), label, persen });
            localStorage.setItem('erp_projects', JSON.stringify(projects));

            labelEl.value = '';
            persenEl.value = '';
            renderRAB();
        }

        function removeBiayaTambahan(id) {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat menghapus biaya tambahan.');
                return;
            }
            const p = projects.find(x => x.id === activeProjectId);
            if (!p || !Array.isArray(p.biayaTambahan)) return;
            p.biayaTambahan = p.biayaTambahan.filter(b => b.id !== id);
            localStorage.setItem('erp_projects', JSON.stringify(projects));
            renderRAB();
        }

        // Excel Import Modal Functions for RAB
        function openExcelImportModal() {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat mengimpor data RAB dari Excel.');
                return;
            }
            document.getElementById('excelImportModal').classList.remove('hidden');
            document.getElementById('rabExcelFileInput').value = '';
            document.getElementById('excelSheetSelectorBox').classList.add('hidden');
            tempExcelWorkbook = null;
        }

        function closeExcelImportModal() {
            document.getElementById('excelImportModal').classList.add('hidden');
        }

        function handleExcelFileSelected(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    tempExcelWorkbook = XLSX.read(data, { type: 'array' });
                    tempExcelSheetNames = tempExcelWorkbook.SheetNames;

                    const sheetSelect = document.getElementById('excelSheetSelect');
                    sheetSelect.innerHTML = '';
                    tempExcelSheetNames.forEach(name => {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        sheetSelect.appendChild(opt);
                    });

                    document.getElementById('excelSheetSelectorBox').classList.remove('hidden');
                } catch (err) {
                    alert('Gagal membaca file Excel: ' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
        }

        function executeExcelImport() {
            if (!isAdminUser()) {
                alert('Akses ditolak. Hanya Admin yang dapat mengimpor data RAB dari Excel.');
                return;
            }
            if (!tempExcelWorkbook) {
                alert('Silakan pilih file Excel terlebih dahulu!');
                return;
            }
            const selectedSheetName = document.getElementById('excelSheetSelect').value;
            const worksheet = tempExcelWorkbook.Sheets[selectedSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (jsonRows.length === 0) {
                alert('Sheet yang dipilih kosong!');
                return;
            }

            let importedCount = 0;
            jsonRows.forEach(row => {
                // Flexible column mapping
                const noDiv = row['NoDiv'] || row['nodiv'] || row['No'] || 'DIV-01';
                const div = row['Divisi'] || row['divisi'] || 'Pekerjaan Umum';
                const sub = row['SubPekerjaan'] || row['subpekerjaan'] || row['Sub Pekerjaan'] || '';
                const rincian = row['Rincian'] || row['rincian'] || '';
                const satuan = row['Satuan'] || row['satuan'] || 'ls';
                const volume = parseFloat(row['Volume'] || row['volume'] || 1);
                const harga = parseFloat(row['HargaSatuan'] || row['hargasatuan'] || row['Harga'] || 0);

                if (sub) {
                    rabData.push({
                        id: Date.now() + Math.random(),
                        projId: activeProjectId,
                        noDiv: String(noDiv),
                        div: String(div),
                        sub: String(sub),
                        rincian: String(rincian),
                        satuan: String(satuan),
                        volume,
                        harga
                    });
                    importedCount++;
                }
            });

            localStorage.setItem('erp_rab', JSON.stringify(rabData));
            closeExcelImportModal();
            renderRAB();
            alert(`Berhasil mengimport ${importedCount} item RAB dari sheet "${selectedSheetName}"!`);
        }

        // ===================================================================
        // 2.1 LAPORAN HARIAN (GROUPED PER DATE: WEATHER & MATERIALS COMBINED)
