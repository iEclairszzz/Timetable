/**
 * ChronoDept Timetable Predictor - Comprehensive Search Engine Controller
 * Dedicated Search Results Page (search.html)
 */

document.addEventListener('DOMContentLoaded', () => {
    const store = window.dataStore;
    if (!store) {
        console.error('DataStore not found. Please ensure js/data.js and js/default_data.js are loaded.');
        return;
    }

    class TimetableSearchApp {
        constructor() {
            this.store = store;
            this.currentQuery = '';
            this.activeCategory = 'all';
            this.results = {
                teachers: [],
                subjects: [],
                classes: [],
                batches: [],
                rooms: [],
                sessions: [],
                total: 0
            };

            // DOM elements
            this.searchInput = document.getElementById('searchPageInput');
            this.searchForm = document.getElementById('searchPageForm');
            this.btnClearSearch = document.getElementById('btnClearSearch');
            this.categoryTabs = document.querySelectorAll('.search-cat-tab');
            this.resultsContainer = document.getElementById('searchResultsContainer');
            this.searchMetaSummary = document.getElementById('searchMetaSummary');
            this.btnPrintSearch = document.getElementById('btnPrintSearch');
            this.suggestionChips = document.querySelectorAll('.suggestion-chip');
            this.newTabCheckbox = document.getElementById('checkNewTab');

            this.init();
        }

        init() {
            // Read query from URL (?q=... or ?query=...)
            const urlParams = new URLSearchParams(window.location.search);
            const queryParam = urlParams.get('q') || urlParams.get('query') || '';
            const catParam = urlParams.get('category') || 'all';

            this.activeCategory = catParam;
            this.setActiveTab(this.activeCategory);

            if (queryParam.trim()) {
                this.searchInput.value = queryParam.trim();
                this.performSearch(queryParam.trim());
            } else {
                this.renderEmptyState();
            }

            this.setupListeners();
        }

        setupListeners() {
            // Form submit
            if (this.searchForm) {
                this.searchForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const q = this.searchInput.value.trim();
                    if (this.newTabCheckbox && this.newTabCheckbox.checked) {
                        window.open(`search.html?q=${encodeURIComponent(q)}&category=${this.activeCategory}`, '_blank');
                    } else {
                        this.performSearch(q);
                    }
                });
            }

            // Real-time input (debounced)
            let debounceTimer = null;
            if (this.searchInput) {
                this.searchInput.addEventListener('input', (e) => {
                    const q = e.target.value.trim();
                    if (this.btnClearSearch) {
                        this.btnClearSearch.style.display = q ? 'flex' : 'none';
                    }
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        this.performSearch(q);
                    }, 280);
                });
            }

            // Clear button
            if (this.btnClearSearch) {
                this.btnClearSearch.addEventListener('click', () => {
                    this.searchInput.value = '';
                    this.btnClearSearch.style.display = 'none';
                    this.searchInput.focus();
                    this.performSearch('');
                });
            }

            // Category tabs
            this.categoryTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const cat = tab.dataset.category || 'all';
                    this.activeCategory = cat;
                    this.setActiveTab(cat);
                    this.renderResults();
                });
            });

            // Suggestion chips
            this.suggestionChips.forEach(chip => {
                chip.addEventListener('click', () => {
                    const text = chip.dataset.query || chip.textContent.trim();
                    this.searchInput.value = text;
                    if (this.btnClearSearch) this.btnClearSearch.style.display = 'flex';
                    this.performSearch(text);
                });
            });

            // Print
            if (this.btnPrintSearch) {
                this.btnPrintSearch.addEventListener('click', () => window.print());
            }
        }

        setActiveTab(category) {
            this.categoryTabs.forEach(t => {
                t.classList.toggle('active', t.dataset.category === category);
            });
        }

        performSearch(rawQuery) {
            const query = (rawQuery || '').trim();
            this.currentQuery = query;

            // Update clear button visibility
            if (this.btnClearSearch) {
                this.btnClearSearch.style.display = query ? 'flex' : 'none';
            }

            // Update URL query string without reloading page (safely wrapped for file:/// and http://)
            try {
                const newUrl = query 
                    ? `${window.location.pathname}?q=${encodeURIComponent(query)}&category=${encodeURIComponent(this.activeCategory)}`
                    : `${window.location.pathname}`;
                window.history.replaceState({ query }, '', newUrl);
            } catch (err) {
                // file:/// protocol may restrict replaceState, ignore gracefully
            }

            if (!query) {
                this.renderEmptyState();
                return;
            }

            const qLower = query.toLowerCase();
            const data = this.store.data;

            // 1. MATCH TEACHERS
            const matchedTeachers = [];
            data.teachers.forEach(t => {
                const desig = this.store.getDesignation(t.designationId);
                const desigName = desig ? desig.name : '';
                const theoryStr = (t.theorySubjects || []).join(' ');
                const labStr = (t.labSubjects || []).join(' ');
                const fullText = `${t.name} ${t.id} ${desigName} ${theoryStr} ${labStr}`.toLowerCase();

                let matchesAssignment = false;
                if (t.assignments) {
                    matchesAssignment = t.assignments.some(a => 
                        `${a.subject} ${a.class}`.toLowerCase().includes(qLower)
                    );
                }

                if (fullText.includes(qLower) || matchesAssignment) {
                    const scheduledHrs = this.store.getTeacherScheduledHours(t.id);
                    matchedTeachers.push({
                        teacher: t,
                        designation: desig,
                        scheduledHours: scheduledHrs,
                        isOverloaded: scheduledHrs > t.maxHoursPerWeek
                    });
                }
            });

            // 2. MATCH SUBJECTS
            const matchedSubjects = [];
            data.subjects.forEach(s => {
                const fullText = `${s.code} ${s.name} ${s.type} ${s.roomType}`.toLowerCase();
                if (fullText.includes(qLower)) {
                    const stats = this.store.getSubjectAllocationStats(s.code);
                    matchedSubjects.push({
                        subject: s,
                        stats: stats
                    });
                }
            });

            // 3. MATCH CLASSES (DIVISIONS) & BATCHES
            const matchedClasses = [];
            const matchedBatches = [];

            data.classes.forEach(c => {
                const classText = `${c.name} ${c.id} ${c.classroom}`.toLowerCase();
                if (classText.includes(qLower)) {
                    matchedClasses.push(c);
                }

                // Check batches
                (c.batches || []).forEach(bCode => {
                    const batchText = `${bCode} ${c.name} ${c.id}`.toLowerCase();
                    if (bCode.toLowerCase().includes(qLower) || (qLower.length <= 2 && batchText.includes(qLower))) {
                        matchedBatches.push({
                            batchCode: bCode,
                            division: c
                        });
                    }
                });
            });

            // 4. MATCH ROOMS & LABS
            const matchedRooms = [];
            data.rooms.forEach(r => {
                const fullText = `${r.id} ${r.name} ${r.type} ${r.isComputerLab ? 'computer lab cl' : ''}`.toLowerCase();
                if (fullText.includes(qLower)) {
                    matchedRooms.push(r);
                }
            });

            // 5. MATCH TIMETABLE SESSIONS
            const matchedSessions = [];
            const schedule = data.schedule;
            if (schedule) {
                for (let d = 0; d < 5; d++) {
                    const dayName = data.days[d];
                    for (let s = 1; s <= 6; s++) {
                        const timeSlot = data.timeSlots.find(ts => ts.id === s);
                        const slotTime = timeSlot ? timeSlot.time : `Slot ${s}`;
                        const slotMap = schedule[d] && schedule[d][s];
                        if (!slotMap) continue;

                        for (const classId in slotMap) {
                            const sess = slotMap[classId];
                            if (sess.type === 'lecture') {
                                const text = `${sess.subjectCode} ${sess.subjectName} ${sess.teacherName} ${sess.roomId} ${sess.className} ${dayName} ${slotTime}`.toLowerCase();
                                if (text.includes(qLower)) {
                                    matchedSessions.push({
                                        dayIndex: d,
                                        dayName: dayName,
                                        slotIndex: s,
                                        slotTime: slotTime,
                                        classId: classId,
                                        className: sess.className || classId,
                                        type: 'lecture',
                                        subjectCode: sess.subjectCode,
                                        subjectName: sess.subjectName,
                                        teacherName: sess.teacherName,
                                        roomNumber: sess.roomNumber || sess.roomId,
                                        batches: null
                                    });
                                }
                            } else if (sess.type === 'lab' && sess.batches) {
                                for (const bCode in sess.batches) {
                                    const bData = sess.batches[bCode];
                                    const text = `${bData.subjectCode} ${bData.subjectName} ${bData.teacherName} ${bData.roomNumber} ${bCode} ${sess.className} ${dayName} ${slotTime}`.toLowerCase();
                                    if (text.includes(qLower)) {
                                        matchedSessions.push({
                                            dayIndex: d,
                                            dayName: dayName,
                                            slotIndex: s,
                                            slotTime: slotTime,
                                            classId: classId,
                                            className: sess.className || classId,
                                            type: 'lab',
                                            batchCode: bCode,
                                            subjectCode: bData.subjectCode,
                                            subjectName: bData.subjectName,
                                            teacherName: bData.teacherName,
                                            roomNumber: bData.roomNumber || bData.roomId
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const total = matchedTeachers.length + matchedSubjects.length + matchedClasses.length + matchedBatches.length + matchedRooms.length + matchedSessions.length;

            this.results = {
                teachers: matchedTeachers,
                subjects: matchedSubjects,
                classes: matchedClasses,
                batches: matchedBatches,
                rooms: matchedRooms,
                sessions: matchedSessions,
                total: total
            };

            this.updateCategoryBadges();
            this.renderResults();
        }

        updateCategoryBadges() {
            const countAll = document.getElementById('countAll');
            const countTeachers = document.getElementById('countTeachers');
            const countSubjects = document.getElementById('countSubjects');
            const countClasses = document.getElementById('countClasses');
            const countRooms = document.getElementById('countRooms');
            const countSessions = document.getElementById('countSessions');

            if (countAll) countAll.textContent = this.results.total;
            if (countTeachers) countTeachers.textContent = this.results.teachers.length;
            if (countSubjects) countSubjects.textContent = this.results.subjects.length;
            if (countClasses) countClasses.textContent = this.results.classes.length + this.results.batches.length;
            if (countRooms) countRooms.textContent = this.results.rooms.length;
            if (countSessions) countSessions.textContent = this.results.sessions.length;
        }

        renderEmptyState() {
            this.updateCategoryBadges();
            if (this.searchMetaSummary) {
                this.searchMetaSummary.innerHTML = `
                    <div class="search-empty-prompt">
                        <span class="prompt-icon">🔍</span>
                        <h2>Explore Department Timetable Records</h2>
                        <p>Search by <strong>Faculty Name</strong>, <strong>Subject Code (DS, DSL, COA...)</strong>, <strong>Division (SE-1..SE-4)</strong>, <strong>Batch (E1..H4)</strong>, or <strong>Classroom / Computer Lab (CL-1, CR-101...)</strong>.</p>
                    </div>
                `;
            }

            const teachersList = this.store.data.teachers.slice(0, 12);
            const subjectsList = this.store.data.subjects;
            const roomsList = this.store.data.rooms;

            this.resultsContainer.innerHTML = `
                <div class="empty-state-showcase">
                    <div class="showcase-card">
                        <div class="showcase-header">
                            <span class="badge-tag th">Faculty Directory</span>
                            <h3>Faculty Members (${this.store.data.teachers.length})</h3>
                        </div>
                        <div class="quick-chip-grid">
                            ${teachersList.map(t => `
                                <button class="quick-btn-chip" onclick="window.timetableSearch.quickSearch('${t.name}')">
                                    👤 ${t.name}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="showcase-card">
                        <div class="showcase-header">
                            <span class="badge-tag lab">Syllabus & Subjects</span>
                            <h3>All 12 Curriculum Subjects</h3>
                        </div>
                        <div class="quick-chip-grid">
                            ${subjectsList.map(s => `
                                <button class="quick-btn-chip" onclick="window.timetableSearch.quickSearch('${s.code}')">
                                    📚 ${s.code} - ${s.name}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="showcase-card">
                        <div class="showcase-header">
                            <span class="badge-tag cl">Facilities</span>
                            <h3>Classrooms & Computer Labs</h3>
                        </div>
                        <div class="quick-chip-grid">
                            ${roomsList.map(r => `
                                <button class="quick-btn-chip" onclick="window.timetableSearch.quickSearch('${r.name || r.id}')">
                                    🏫 ${r.name} (${r.type})
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        renderResults() {
            const query = this.currentQuery;
            if (!query) {
                this.renderEmptyState();
                return;
            }

            // Summary Header
            if (this.searchMetaSummary) {
                this.searchMetaSummary.innerHTML = `
                    <div class="search-summary-bar">
                        <div>
                            <span class="summary-results-count">${this.results.total} results found</span>
                            for "<span class="summary-query-text">${this.escapeHtml(query)}</span>"
                        </div>
                        <div class="summary-actions">
                            <button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Print Report</button>
                            <a href="index.html" class="btn btn-secondary btn-sm">⬅ Return to Main Timetable</a>
                        </div>
                    </div>
                `;
            }

            if (this.results.total === 0) {
                this.resultsContainer.innerHTML = `
                    <div class="no-results-card">
                        <div class="no-results-icon">❓</div>
                        <h3>No timetable records matching "${this.escapeHtml(query)}"</h3>
                        <p>We could not find any teachers, subjects, divisions, batches, or classrooms matching your search query.</p>
                        <div class="no-results-hints">
                            <strong>Suggestions:</strong>
                            <ul>
                                <li>Check for spelling errors or try shorter keywords.</li>
                                <li>Try searching by subject code (e.g. <code>DS</code>, <code>DSL</code>, <code>COAL</code>, <code>MDM</code>).</li>
                                <li>Search by faculty surname (e.g. <code>Phakatkar</code>, <code>Ghotkar</code>, <code>Kale</code>).</li>
                                <li>Search by division (e.g. <code>SE-1</code>) or batch (e.g. <code>E1</code>, <code>H2</code>).</li>
                                <li>Search by room code (e.g. <code>CL-1</code>, <code>CR-101</code>).</li>
                            </ul>
                        </div>
                        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                            <button class="btn btn-secondary" onclick="window.timetableSearch.quickSearch('DS')">Search 'DS'</button>
                            <button class="btn btn-secondary" onclick="window.timetableSearch.quickSearch('Dr. A. G. Phakatkar')">Search 'Dr. Phakatkar'</button>
                            <button class="btn btn-secondary" onclick="window.timetableSearch.quickSearch('CL-1')">Search 'CL-1'</button>
                            <a href="index.html" class="btn btn-primary">Go to Main Timetable</a>
                        </div>
                    </div>
                `;
                return;
            }

            let html = '';
            const cat = this.activeCategory;

            // 1. TEACHERS SECTION
            if ((cat === 'all' || cat === 'teachers') && this.results.teachers.length > 0) {
                html += `
                    <section class="search-category-section">
                        <div class="cat-section-header">
                            <h2>
                                <span class="cat-icon">👨‍🏫</span>
                                Faculty Members (${this.results.teachers.length})
                            </h2>
                            <span class="cat-subtitle">Workload caps, scheduled teaching hours, and weekly calendar</span>
                        </div>
                        <div class="cards-grid">
                            ${this.results.teachers.map(tData => this.renderTeacherCard(tData)).join('')}
                        </div>
                    </section>
                `;
            }

            // 2. SUBJECTS SECTION
            if ((cat === 'all' || cat === 'subjects') && this.results.subjects.length > 0) {
                html += `
                    <section class="search-category-section">
                        <div class="cat-section-header">
                            <h2>
                                <span class="cat-icon">📚</span>
                                Curriculum Subjects (${this.results.subjects.length})
                            </h2>
                            <span class="cat-subtitle">Lecture & Lab allocations across all 4 divisions and 16 batches</span>
                        </div>
                        <div class="cards-grid">
                            ${this.results.subjects.map(sData => this.renderSubjectCard(sData)).join('')}
                        </div>
                    </section>
                `;
            }

            // 3. CLASSES & BATCHES SECTION
            if ((cat === 'all' || cat === 'classes') && (this.results.classes.length > 0 || this.results.batches.length > 0)) {
                html += `
                    <section class="search-category-section">
                        <div class="cat-section-header">
                            <h2>
                                <span class="cat-icon">🎓</span>
                                Divisions & Batches (${this.results.classes.length + this.results.batches.length})
                            </h2>
                            <span class="cat-subtitle">Student division rosters, classrooms, and batch schedules</span>
                        </div>
                        <div class="cards-grid">
                            ${this.results.classes.map(c => this.renderClassCard(c)).join('')}
                            ${this.results.batches.map(b => this.renderBatchCard(b)).join('')}
                        </div>
                    </section>
                `;
            }

            // 4. ROOMS & LABS SECTION
            if ((cat === 'all' || cat === 'rooms') && this.results.rooms.length > 0) {
                html += `
                    <section class="search-category-section">
                        <div class="cat-section-header">
                            <h2>
                                <span class="cat-icon">🏫</span>
                                Classrooms & Computer Labs (${this.results.rooms.length})
                            </h2>
                            <span class="cat-subtitle">Room capacity, equipment specs, and full weekly occupancy breakdown</span>
                        </div>
                        <div class="cards-grid">
                            ${this.results.rooms.map(r => this.renderRoomCard(r)).join('')}
                        </div>
                    </section>
                `;
            }

            // 5. MATCHING SESSIONS / SLOTS SECTION
            if ((cat === 'all' || cat === 'sessions') && this.results.sessions.length > 0) {
                html += `
                    <section class="search-category-section">
                        <div class="cat-section-header">
                            <h2>
                                <span class="cat-icon">⏱️</span>
                                Scheduled Sessions (${this.results.sessions.length})
                            </h2>
                            <span class="cat-subtitle">Exact time slots where sessions matching your query take place</span>
                        </div>
                        <div class="table-wrapper card-panel" style="padding: 0; overflow-x: auto;">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Day</th>
                                        <th>Slot & Timing</th>
                                        <th>Division / Batch</th>
                                        <th>Subject</th>
                                        <th>Type</th>
                                        <th>Assigned Faculty</th>
                                        <th>Classroom / Lab</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${this.results.sessions.map(sess => this.renderSessionRow(sess)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                `;
            }

            this.resultsContainer.innerHTML = html;
        }

        // ------------------------------------------------------------------
        // ITEM CARD RENDERERS
        // ------------------------------------------------------------------

        renderTeacherCard({ teacher, designation, scheduledHours, isOverloaded }) {
            const maxCap = teacher.maxHoursPerWeek || (designation ? designation.maxHours : 18);
            const loadPercent = Math.min(100, Math.round((scheduledHours / maxCap) * 100));
            const data = this.store.data;
            const schedule = data.schedule;

            // Compute weekly timetable matrix for this teacher
            const weekMatrix = [];
            const freeSlots = [];

            for (let d = 0; d < 5; d++) {
                const dayName = data.days[d];
                for (let s = 1; s <= 6; s++) {
                    const timeSlot = data.timeSlots.find(ts => ts.id === s);
                    const slotTime = timeSlot ? timeSlot.time : `Slot ${s}`;
                    let sessionTaught = null;

                    if (schedule && schedule[d] && schedule[d][s]) {
                        for (const cId in schedule[d][s]) {
                            const item = schedule[d][s][cId];
                            if (item.type === 'lecture' && (item.teacherName === teacher.name || item.teacherId === teacher.id)) {
                                sessionTaught = {
                                    type: 'lecture',
                                    subjectCode: item.subjectCode,
                                    class: item.className || cId,
                                    room: item.roomNumber || item.roomId
                                };
                                break;
                            } else if (item.type === 'lab' && item.batches) {
                                for (const b in item.batches) {
                                    const bData = item.batches[b];
                                    if (bData.teacherName === teacher.name || bData.teacherId === teacher.id) {
                                        sessionTaught = {
                                            type: 'lab',
                                            subjectCode: bData.subjectCode,
                                            class: `${item.className || cId} (${b})`,
                                            room: bData.roomNumber || bData.roomId
                                        };
                                        break;
                                    }
                                }
                                if (sessionTaught) break;
                            }
                        }
                    }

                    if (sessionTaught) {
                        weekMatrix.push({
                            day: dayName,
                            slot: s,
                            time: slotTime,
                            ...sessionTaught
                        });
                    } else {
                        freeSlots.push(`${dayName.slice(0, 3)} S${s}`);
                    }
                }
            }

            const highlightedName = this.highlightMatch(teacher.name, this.currentQuery);
            const highlightedDesig = designation ? this.highlightMatch(designation.name, this.currentQuery) : 'Faculty';

            return `
                <div class="search-result-card teacher-card-enhanced">
                    <div class="result-card-header">
                        <div class="card-identity">
                            <div class="avatar-box">👨‍🏫</div>
                            <div>
                                <h3 class="card-entity-title">${highlightedName}</h3>
                                <p class="card-entity-sub">${highlightedDesig} • ID: <code>${teacher.id}</code></p>
                            </div>
                        </div>
                        <div class="card-header-badge">
                            <span class="badge-tag ${isOverloaded ? 'badge-danger' : 'badge-success'}">
                                ${scheduledHours}/${maxCap} hrs (${loadPercent}%)
                            </span>
                        </div>
                    </div>

                    <div class="workload-progress-bar-wrap">
                        <div class="workload-progress-fill ${isOverloaded ? 'danger' : ''}" style="width: ${loadPercent}%;"></div>
                    </div>

                    <div class="card-section-row">
                        <span class="section-label">Theory Subjects:</span>
                        <div class="tag-group">
                            ${(teacher.theorySubjects || []).length > 0 
                                ? teacher.theorySubjects.map(s => `<span class="badge-tag th">${this.highlightMatch(s, this.currentQuery)}</span>`).join('') 
                                : '<span class="text-muted">None</span>'}
                        </div>
                    </div>

                    <div class="card-section-row">
                        <span class="section-label">Lab Subjects:</span>
                        <div class="tag-group">
                            ${(teacher.labSubjects || []).length > 0 
                                ? teacher.labSubjects.map(s => `<span class="badge-tag lab">${this.highlightMatch(s, this.currentQuery)}</span>`).join('') 
                                : '<span class="text-muted">None</span>'}
                        </div>
                    </div>

                    <!-- Mini Weekly Teaching Schedule -->
                    <div class="teaching-schedule-box">
                        <div class="box-title">Weekly Sessions (${weekMatrix.length} hrs total)</div>
                        <div class="mini-session-chips">
                            ${weekMatrix.map(sess => `
                                <div class="mini-session-pill ${sess.type === 'lab' ? 'lab' : 'th'}">
                                    <span class="sess-time">${sess.day.slice(0, 3)} S${sess.slot} (${sess.time})</span>
                                    <strong class="sess-code">${sess.subjectCode}</strong>
                                    <span class="sess-class">${sess.class}</span>
                                    <span class="sess-room">📍 ${sess.room}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Available Free Slots -->
                    <div class="free-slots-summary">
                        <span class="free-icon">🟢 Free Slots:</span>
                        <span class="free-text">${freeSlots.slice(0, 10).join(', ')}${freeSlots.length > 10 ? ' ...' : ''} (${freeSlots.length} free hrs)</span>
                    </div>

                    <div class="result-card-footer">
                        <a href="index.html?view=teacher&id=${encodeURIComponent(teacher.name)}" class="btn btn-primary btn-sm">
                            Open in Faculty Timetable ↗
                        </a>
                    </div>
                </div>
            `;
        }

        renderSubjectCard({ subject, stats }) {
            const data = this.store.data;
            const schedule = data.schedule;
            const occurrences = [];

            if (schedule) {
                for (let d = 0; d < 5; d++) {
                    const dayName = data.days[d];
                    for (let s = 1; s <= 6; s++) {
                        const timeSlot = data.timeSlots.find(ts => ts.id === s);
                        const slotTime = timeSlot ? timeSlot.time : `Slot ${s}`;
                        const slotMap = schedule[d] && schedule[d][s];
                        if (!slotMap) continue;

                        for (const classId in slotMap) {
                            const sess = slotMap[classId];
                            if (sess.type === 'lecture' && sess.subjectCode === subject.code) {
                                occurrences.push({
                                    day: dayName,
                                    slot: s,
                                    time: slotTime,
                                    target: sess.className || classId,
                                    teacher: sess.teacherName,
                                    room: sess.roomNumber || sess.roomId,
                                    isLab: false
                                });
                            } else if (sess.type === 'lab' && sess.batches) {
                                for (const b in sess.batches) {
                                    const bData = sess.batches[b];
                                    if (bData.subjectCode === subject.code) {
                                        occurrences.push({
                                            day: dayName,
                                            slot: s,
                                            time: slotTime,
                                            target: `${sess.className || classId} (${b})`,
                                            teacher: bData.teacherName,
                                            room: bData.roomNumber || bData.roomId,
                                            isLab: true
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const highlightedCode = this.highlightMatch(subject.code, this.currentQuery);
            const highlightedName = this.highlightMatch(subject.name, this.currentQuery);

            return `
                <div class="search-result-card subject-card-enhanced">
                    <div class="result-card-header">
                        <div class="card-identity">
                            <div class="avatar-box ${subject.type === 'lab' ? 'lab-avatar' : 'th-avatar'}">
                                ${subject.type === 'lab' ? '🔬' : '📖'}
                            </div>
                            <div>
                                <h3 class="card-entity-title">${highlightedCode} - ${highlightedName}</h3>
                                <p class="card-entity-sub">
                                    ${subject.type.toUpperCase()} • ${subject.weeklyHours} hrs/week • Room: ${subject.roomType.toUpperCase()}
                                    ${subject.isComputerLab ? ' (Computer Lab Required)' : ''}
                                </p>
                            </div>
                        </div>
                        <div class="card-header-badge">
                            <span class="badge-tag ${stats.percentage === 100 ? 'badge-success' : 'badge-warning'}">
                                ${stats.allocatedHours}/${stats.requiredHours} hrs (${stats.percentage}%)
                            </span>
                        </div>
                    </div>

                    <div class="workload-progress-bar-wrap">
                        <div class="workload-progress-fill success" style="width: ${stats.percentage}%;"></div>
                    </div>

                    <!-- Scheduled Timings Breakdown -->
                    <div class="teaching-schedule-box">
                        <div class="box-title">Scheduled Sessions across Department (${occurrences.length} slots)</div>
                        <div class="mini-session-chips">
                            ${occurrences.slice(0, 16).map(occ => `
                                <div class="mini-session-pill ${occ.isLab ? 'lab' : 'th'}">
                                    <span class="sess-time">${occ.day.slice(0, 3)} S${occ.slot} (${occ.time})</span>
                                    <strong class="sess-code">${occ.target}</strong>
                                    <span class="sess-class">👤 ${occ.teacher}</span>
                                    <span class="sess-room">📍 ${occ.room}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="result-card-footer">
                        <a href="index.html?view=allocator" class="btn btn-primary btn-sm">
                            Open in Subject Allocator ↗
                        </a>
                        <a href="index.html?view=class" class="btn btn-secondary btn-sm">
                            View Department Schedule ↗
                        </a>
                    </div>
                </div>
            `;
        }

        renderClassCard(division) {
            const highlightedName = this.highlightMatch(division.name, this.currentQuery);
            return `
                <div class="search-result-card class-card-enhanced">
                    <div class="result-card-header">
                        <div class="card-identity">
                            <div class="avatar-box class-avatar">🎓</div>
                            <div>
                                <h3 class="card-entity-title">${highlightedName} (${division.id})</h3>
                                <p class="card-entity-sub">Default Classroom: <strong>${division.classroom}</strong> • ~75 Students</p>
                            </div>
                        </div>
                        <div class="card-header-badge">
                            <span class="badge-tag cl">${division.batches.length} Batches</span>
                        </div>
                    </div>

                    <div class="card-section-row">
                        <span class="section-label">Registered Batches:</span>
                        <div class="tag-group">
                            ${division.batches.map(b => `
                                <a href="index.html?view=batch&id=${encodeURIComponent(division.id + '_' + b)}" class="badge-tag cl interactive-tag">
                                    Batch ${this.highlightMatch(b, this.currentQuery)} ↗
                                </a>
                            `).join('')}
                        </div>
                    </div>

                    <div class="result-card-footer">
                        <a href="index.html?view=class&id=${encodeURIComponent(division.id)}" class="btn btn-primary btn-sm">
                            Open Division Timetable ↗
                        </a>
                    </div>
                </div>
            `;
        }

        renderBatchCard({ batchCode, division }) {
            const highlightedBatch = this.highlightMatch(batchCode, this.currentQuery);
            return `
                <div class="search-result-card batch-card-enhanced">
                    <div class="result-card-header">
                        <div class="card-identity">
                            <div class="avatar-box batch-avatar">🏷️</div>
                            <div>
                                <h3 class="card-entity-title">Batch ${highlightedBatch}</h3>
                                <p class="card-entity-sub">Division: <strong>${division.name} (${division.id})</strong></p>
                            </div>
                        </div>
                        <div class="card-header-badge">
                            <span class="badge-tag cl">Sub-group</span>
                        </div>
                    </div>

                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom: 0.75rem;">
                        Participates in division theory lectures in <strong>${division.classroom}</strong> and specialized 2-hour lab sessions in parallel rotation.
                    </p>

                    <div class="result-card-footer">
                        <a href="index.html?view=batch&id=${encodeURIComponent(division.id + '_' + batchCode)}" class="btn btn-primary btn-sm">
                            Open Batch ${batchCode} Timetable ↗
                        </a>
                    </div>
                </div>
            `;
        }

        renderRoomCard(room) {
            const data = this.store.data;
            const schedule = data.schedule;
            let occupiedSlots = 0;
            const roomSchedule = [];

            if (schedule) {
                for (let d = 0; d < 5; d++) {
                    const dayName = data.days[d];
                    for (let s = 1; s <= 6; s++) {
                        const timeSlot = data.timeSlots.find(ts => ts.id === s);
                        const slotTime = timeSlot ? timeSlot.time : `Slot ${s}`;
                        let sessionInRoom = null;

                        if (schedule[d] && schedule[d][s]) {
                            for (const cId in schedule[d][s]) {
                                const sess = schedule[d][s][cId];
                                if (sess.type === 'lecture' && (sess.roomId === room.id || sess.roomNumber === room.name)) {
                                    sessionInRoom = {
                                        type: 'lecture',
                                        subject: sess.subjectCode,
                                        class: sess.className || cId,
                                        teacher: sess.teacherName
                                    };
                                    break;
                                } else if (sess.type === 'lab' && sess.batches) {
                                    for (const b in sess.batches) {
                                        const bData = sess.batches[b];
                                        if (bData.roomId === room.id || bData.roomNumber === room.name) {
                                            sessionInRoom = {
                                                type: 'lab',
                                                subject: bData.subjectCode,
                                                class: `${sess.className || cId} (${b})`,
                                                teacher: bData.teacherName
                                            };
                                            break;
                                        }
                                    }
                                    if (sessionInRoom) break;
                                }
                            }
                        }

                        if (sessionInRoom) {
                            occupiedSlots++;
                            roomSchedule.push({
                                day: dayName,
                                slot: s,
                                time: slotTime,
                                ...sessionInRoom
                            });
                        }
                    }
                }
            }

            const totalSlots = 30; // 5 days * 6 slots
            const utilization = Math.round((occupiedSlots / totalSlots) * 100);
            const highlightedName = this.highlightMatch(room.name, this.currentQuery);
            const highlightedId = this.highlightMatch(room.id, this.currentQuery);

            return `
                <div class="search-result-card room-card-enhanced">
                    <div class="result-card-header">
                        <div class="card-identity">
                            <div class="avatar-box ${room.type === 'lab' ? 'lab-avatar' : 'class-avatar'}">
                                ${room.isComputerLab ? '💻' : (room.type === 'lab' ? '🔬' : '🏫')}
                            </div>
                            <div>
                                <h3 class="card-entity-title">${highlightedName} (<code>${highlightedId}</code>)</h3>
                                <p class="card-entity-sub">
                                    Type: <strong>${room.type.toUpperCase()}</strong> • Capacity: <strong>${room.capacity} students</strong>
                                    ${room.isComputerLab ? ' • <span class="badge-tag cl">Computer Lab</span>' : ''}
                                </p>
                            </div>
                        </div>
                        <div class="card-header-badge">
                            <span class="badge-tag ${utilization > 85 ? 'badge-warning' : 'badge-success'}">
                                ${occupiedSlots}/30 hrs (${utilization}% Utilized)
                            </span>
                        </div>
                    </div>

                    <div class="workload-progress-bar-wrap">
                        <div class="workload-progress-fill" style="width: ${utilization}%;"></div>
                    </div>

                    <!-- Room Occupancy List -->
                    <div class="teaching-schedule-box">
                        <div class="box-title">Weekly Sessions Scheduled Here (${occupiedSlots} hours)</div>
                        <div class="mini-session-chips">
                            ${roomSchedule.map(sess => `
                                <div class="mini-session-pill ${sess.type === 'lab' ? 'lab' : 'th'}">
                                    <span class="sess-time">${sess.day.slice(0, 3)} S${sess.slot} (${sess.time})</span>
                                    <strong class="sess-code">${sess.subject}</strong>
                                    <span class="sess-class">${sess.class}</span>
                                    <span class="sess-room">👤 ${sess.teacher}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="result-card-footer">
                        <a href="index.html?view=room&id=${encodeURIComponent(room.id)}" class="btn btn-primary btn-sm">
                            Open Room Occupancy View ↗
                        </a>
                    </div>
                </div>
            `;
        }

        renderSessionRow(sess) {
            const isLab = sess.type === 'lab';
            return `
                <tr>
                    <td><strong>${this.highlightMatch(sess.dayName, this.currentQuery)}</strong></td>
                    <td>
                        <span class="badge-tag">${sess.slotIndex === 1 ? 'Slot 1' : 'Slot ' + sess.slotIndex}</span>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${sess.slotTime}</div>
                    </td>
                    <td>
                        <strong>${this.highlightMatch(sess.className, this.currentQuery)}</strong>
                        ${sess.batchCode ? `<span class="badge-tag cl" style="margin-left:0.3rem;">Batch ${sess.batchCode}</span>` : ''}
                    </td>
                    <td>
                        <span class="badge-tag ${isLab ? 'lab' : 'th'}">${this.highlightMatch(sess.subjectCode, this.currentQuery)}</span>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">${this.highlightMatch(sess.subjectName, this.currentQuery)}</div>
                    </td>
                    <td><span class="badge-tag ${isLab ? 'lab' : 'th'}">${isLab ? 'Lab Block' : 'Theory Lecture'}</span></td>
                    <td><strong>${this.highlightMatch(sess.teacherName, this.currentQuery)}</strong></td>
                    <td><code>${this.highlightMatch(sess.roomNumber, this.currentQuery)}</code></td>
                    <td>
                        <a href="index.html?view=${isLab ? 'batch' : 'class'}&id=${encodeURIComponent(sess.classId + (sess.batchCode ? '_' + sess.batchCode : ''))}" class="btn btn-outline btn-sm">
                            View ↗
                        </a>
                    </td>
                </tr>
            `;
        }

        // ------------------------------------------------------------------
        // UTILITIES
        // ------------------------------------------------------------------

        quickSearch(text) {
            if (this.searchInput) {
                this.searchInput.value = text;
                this.performSearch(text);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        highlightMatch(text, query) {
            if (!text || !query) return this.escapeHtml(text || '');
            const safeText = String(text);
            const safeQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (!safeQuery) return this.escapeHtml(safeText);

            try {
                const regex = new RegExp(`(${safeQuery})`, 'gi');
                return safeText.replace(regex, '<mark class="search-match">$1</mark>');
            } catch (e) {
                return this.escapeHtml(safeText);
            }
        }

        escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
    }

    window.timetableSearch = new TimetableSearchApp();
});
