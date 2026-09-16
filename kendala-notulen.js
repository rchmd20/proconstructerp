        // ===================================================================
        // Cari data kendala/notulen milik proyek aktif untuk tanggal tertentu
        function findLhKendalaByDate(tanggal) {
            return lapHarianKendalaData.find(k => k.tanggal === tanggal && k.projId === activeProjectId);
        }

        // ------------------------------------------------------------------
        // Anti-kehilangan teks: melacak apakah user sudah mengetik sesuatu di
        // Kendala/Notulen SEBELUM tanggal dipilih/diganti. Jika sudah ada teks
        // yang belum tersimpan, jangan langsung ditimpa saat tanggal diisi/diubah -
        // tanya dulu ke user.
        // ------------------------------------------------------------------
        let lhKendalaDirty = false;
        function markLhKendalaDirty() {
            lhKendalaDirty = true;
        }

        // Saat tanggal pada form Kendala & Notulen diganti, otomatis muat data existing (jika ada) agar bisa diedit.
        // forceOverwrite=true dipakai oleh editLhKendala() supaya tidak perlu konfirmasi (karena user sengaja klik Edit).
        function loadLhKendalaByDate(forceOverwrite) {
            const tanggal = document.getElementById('lhkTanggal').value;
            if (!tanggal) return;

            const kendalaEl = document.getElementById('lhKendala');
            const notulenEl = document.getElementById('lhNotulen');
            const adaTeksBelumTersimpan = !forceOverwrite && lhKendalaDirty && (kendalaEl.value.trim() !== '' || notulenEl.value.trim() !== '');

            if (adaTeksBelumTersimpan) {
                const lanjut = confirm('Anda sudah mengetik Kendala/Notulen sebelum memilih tanggal. Jika dilanjutkan, isian ini akan diganti dengan data pada tanggal yang dipilih (jika ada).\n\nKlik "OK" untuk memuat data tanggal tersebut (isian saat ini akan hilang), atau "Batal" untuk TETAP menyimpan teks yang sudah diketik.');
                if (!lanjut) {
                    // User memilih tetap mempertahankan teks yang sudah diketik -> jangan sentuh textarea sama sekali.
                    return;
                }
            }

            const existing = findLhKendalaByDate(tanggal);
            if (existing) {
                document.getElementById('lhkEditId').value = existing.id;
                kendalaEl.value = existing.kendala || '';
                notulenEl.value = existing.notulen || '';
                document.getElementById('lhKendalaFormTitle').innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-400"></i><span>Edit Kendala & Notulen (${tanggal})</span>`;
                document.getElementById('btnCancelLhkEdit').classList.remove('hidden');
            } else {
                document.getElementById('lhkEditId').value = '';
                kendalaEl.value = '';
                notulenEl.value = '';
                document.getElementById('lhKendalaFormTitle').innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-400"></i><span>Kendala & Notulen Harian (1x Input per Tanggal)</span>`;
                document.getElementById('btnCancelLhkEdit').classList.add('hidden');
            }
            lhKendalaDirty = false;
        }

        function handleLhKendalaSubmit(e) {
            e.preventDefault();
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            const editId = document.getElementById('lhkEditId').value;
            const tanggal = document.getElementById('lhkTanggal').value;
            const kendala = document.getElementById('lhKendala').value.trim();
            const notulen = document.getElementById('lhNotulen').value.trim();

            // Jaga-jaga: 1x input per tanggal per proyek -> jika sudah ada data untuk tanggal ini, timpa (edit) datanya
            const existing = findLhKendalaByDate(tanggal);
            if (editId || existing) {
                const targetId = editId || existing.id;
                const idx = lapHarianKendalaData.findIndex(k => k.id == targetId);
                if (idx !== -1) {
                    lapHarianKendalaData[idx] = { ...lapHarianKendalaData[idx], tanggal, kendala, notulen };
                }
            } else {
                lapHarianKendalaData.push({ id: Date.now(), projId: activeProjectId, tanggal, kendala, notulen });
            }

            localStorage.setItem('erp_lap_harian_kendala', JSON.stringify(lapHarianKendalaData));
            cancelLhKendalaEdit();
            renderLapHarian();
        }

        function editLhKendala(tanggal) {
            document.getElementById('lhkTanggal').value = tanggal;
            loadLhKendalaByDate(true); // true = paksa muat, tanpa konfirmasi (aksi Edit disengaja oleh user)
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const formCard = document.getElementById('formLhKendala');
            if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function deleteLhKendala(id) {
            if (!canUserEdit()) { alert('Akses ditolak. Admin telah menonaktifkan izin edit akun Anda untuk proyek ini.'); return; }
            if (confirm('Hapus catatan kendala & notulen tanggal ini?')) {
                lapHarianKendalaData = lapHarianKendalaData.filter(k => k.id != id);
                localStorage.setItem('erp_lap_harian_kendala', JSON.stringify(lapHarianKendalaData));
                cancelLhKendalaEdit();
                renderLapHarian();
            }
        }

        function cancelLhKendalaEdit() {
            document.getElementById('lhkEditId').value = '';
            document.getElementById('formLhKendala').reset();
            document.getElementById('lhKendalaFormTitle').innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-400"></i><span>Kendala & Notulen Harian (1x Input per Tanggal)</span>`;
            document.getElementById('btnCancelLhkEdit').classList.add('hidden');
            lhKendalaDirty = false;
        }

        // ------------------------------------------------------------------
        // Auto-lanjut penomoran/simbol list pada textarea (dipakai di Kendala & Notulen
        // Laporan Harian). Saat user menekan Enter di baris yang diawali "1. ", "1) ",
        // "- ", "* ", atau "• ", baris baru otomatis diawali penomoran/simbol lanjutannya
        // (mis. "2. "). Jika baris list terakhir dikosongkan lalu Enter ditekan lagi,
        // penomoran otomatis dihentikan (perilaku umum seperti di Word/Notion).
        // ------------------------------------------------------------------
        function handleAutoListKeydown(e) {
            if (e.key !== 'Enter') return;
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;

            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const currentLine = value.substring(lineStart, start);

            const numberedMatch = currentLine.match(/^(\s*)(\d+)([.\)])(\s+)/);
            const bulletMatch = !numberedMatch && currentLine.match(/^(\s*)([-*•])(\s+)/);

            if (!numberedMatch && !bulletMatch) return; // biarkan Enter berjalan normal

            e.preventDefault();
            const markerLength = (numberedMatch || bulletMatch)[0].length;
            const restOfLine = currentLine.substring(markerLength);

            if (restOfLine.trim() === '') {
                // Baris list kosong (cuma ada nomor/simbol tanpa isi) -> hentikan list, hapus nomor/simbol tsb
                const newValue = value.substring(0, lineStart) + value.substring(start);
                textarea.value = newValue;
                textarea.selectionStart = textarea.selectionEnd = lineStart;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }

            let insertion;
            if (numberedMatch) {
                const indent = numberedMatch[1];
                const nextNum = parseInt(numberedMatch[2], 10) + 1;
                const sep = numberedMatch[3];
                insertion = `\n${indent}${nextNum}${sep} `;
            } else {
                const indent = bulletMatch[1];
                const symbol = bulletMatch[2];
                insertion = `\n${indent}${symbol} `;
            }

            const newValue = value.substring(0, start) + insertion + value.substring(end);
            textarea.value = newValue;
            const newPos = start + insertion.length;
            textarea.selectionStart = textarea.selectionEnd = newPos;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // ===================================================================
        // 2.2 LAPORAN MINGGUAN
