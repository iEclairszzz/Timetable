/**
 * ChronoDept Timetable Predictor & Studio - Main Application Controller
 * Pune Institute of Computer Technology - Department of Computer Engineering
 */

document.addEventListener('DOMContentLoaded', () => {
    const store = window.dataStore;
    const validator = new TimetableValidator(store);
    const predictor = new TimetablePredictor(store, validator);

    let activeView = 'class'; // 'class' | 'batch' | 'teacher' | 'room' | 'allocator' | 'master' | 'audit'
    let selectedFilterId = 'SE-1';

    // DOM References
    const navButtons = document.querySelectorAll('.view-nav .nav-btn');
    const selectFilter = document.getElementById('selectFilter');
    const filterLabel = document.getElementById('filterLabel');
    const filterGroup = document.getElementById('filterGroup');
    const badgeProgress = document.getElementById('badgeProgress');
    const badgeProgressText = document.getElementById('badgeProgressText');
    const badgeAudit = document.getElementById('badgeAudit');
    const badgeAuditText = document.getElementById('badgeAuditText');
    const timetableContainer = document.getElementById('timetableContainer');

    // Action buttons
    const btnQuickAddInput = document.getElementById('btnQuickAddInput');
    const btnAutoAllocate = document.getElementById('btnAutoAllocate');
    const btnPredictSlot = document.getElementById('btnPredictSlot');
    const btnManageData = document.getElementById('btnManageData');
    const btnResetDefault = document.getElementById('btnResetDefault');
    const btnPrint = document.getElementById('btnPrint');
    const btnExportModal = document.getElementById('btnExportModal');

    // Modals
    const modalAllocate = document.getElementById('modalAllocate');
    const btnCloseAllocate = document.getElementById('btnCloseAllocate');
    const btnCancelAllocate = document.getElementById('btnCancelAllocate');
    const allocSubject = document.getElementById('allocSubject');
    const allocClass = document.getElementById('allocClass');
    const allocBatch = document.getElementById('allocBatch');
    const allocBatchWrapper = document.getElementById('allocBatchWrapper');
    const allocTeacher = document.getElementById('allocTeacher');
    const recomList = document.getElementById('recomList');

    const modalData = document.getElementById('modalData');
    const btnCloseDataModal = document.getElementById('btnCloseDataModal');
    const btnCloseDataModalFooter = document.getElementById('btnCloseDataModalFooter');
    const dataModalTabs = document.querySelectorAll('.modal-tabs .tab-btn');

    // Add Input Modal Elements
    const modalAddInput = document.getElementById('modalAddInput');
    const btnCloseAddInput = document.getElementById('btnCloseAddInput');
    const btnCloseAddInputFooter = document.getElementById('btnCloseAddInputFooter');
    const addInputTabs = document.querySelectorAll('#addInputTabs .tab-btn');
    const formModalAddDivision = document.getElementById('formModalAddDivision');
    const formModalAddBatch = document.getElementById('formModalAddBatch');
    const formModalAddRoom = document.getElementById('formModalAddRoom');
    const formSetupAddDivision = document.getElementById('formSetupAddDivision');
    const formSetupAddRoom = document.getElementById('formSetupAddRoom');

    // Faculty Add & Excel Import Elements
    const formModalAddTeacher = document.getElementById('formModalAddTeacher');
    const btnFacultyModeManual = document.getElementById('btnFacultyModeManual');
    const btnFacultyModeExcel = document.getElementById('btnFacultyModeExcel');
    const panelTeacherManual = document.getElementById('panelTeacherManual');
    const panelTeacherExcel = document.getElementById('panelTeacherExcel');
    const inputTeacherExcelFile = document.getElementById('inputTeacherExcelFile');
    const teacherExcelDropzone = document.getElementById('teacherExcelDropzone');
    const excelImportPreviewArea = document.getElementById('excelImportPreviewArea');
    const excelParsedCount = document.getElementById('excelParsedCount');
    const tableExcelPreview = document.querySelector('#tableExcelPreview tbody');
    const chkUpdateExistingTeachers = document.getElementById('chkUpdateExistingTeachers');
    const btnConfirmExcelImport = document.getElementById('btnConfirmExcelImport');
    const btnClearExcelImport = document.getElementById('btnClearExcelImport');
    const btnDownloadTeacherTemplate = document.getElementById('btnDownloadTeacherTemplate');
    const btnSetupDownloadTeacherTemplate = document.getElementById('btnSetupDownloadTeacherTemplate');
    const btnSetupOpenAddTeacher = document.getElementById('btnSetupOpenAddTeacher');
    const btnSetupImportExcel = document.getElementById('btnSetupImportExcel');
    const selectModalTeacherDesig = document.getElementById('selectModalTeacherDesig');
    const modalTeacherHours = document.getElementById('modalTeacherHours');

    let currentParsedFacultyList = [];

    const modalExport = document.getElementById('modalExport');
    const btnCloseExport = document.getElementById('btnCloseExport');
    const btnCloseExportFooter = document.getElementById('btnCloseExportFooter');
    const btnDownloadCSV = document.getElementById('btnDownloadCSV');
    const btnDownloadJSON = document.getElementById('btnDownloadJSON');
    const btnDownloadExcel = document.getElementById('btnDownloadExcel');
    const btnPrintModalBtn = document.getElementById('btnPrintModalBtn');

    // ----------------------------------------------------------------------
    // INITIALIZATION
    // ----------------------------------------------------------------------
    function init() {
        setupEventListeners();
        handleUrlParams();
        updateToolbarKPIs();
        updateFilterOptions();
        renderActiveView();
    }

    function handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');
        const idParam = params.get('id');

        if (viewParam && ['class', 'batch', 'teacher', 'room', 'allocator', 'master', 'audit'].includes(viewParam)) {
            activeView = viewParam;
            navButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === activeView);
            });
            if (idParam) {
                const decodedId = decodeURIComponent(idParam);
                if (viewParam === 'teacher') {
                    const matchT = store.data.teachers.find(t => t.id === decodedId || t.name.toLowerCase() === decodedId.toLowerCase());
                    selectedFilterId = matchT ? matchT.name : decodedId;
                } else {
                    selectedFilterId = decodedId;
                }
            }
        }

        // Open modals from hash if specified
        if (window.location.hash === '#setup') {
            renderSetupModalTables();
            modalData.classList.add('active');
        } else if (window.location.hash === '#addInput') {
            openAddInputModal('tabAddDivision');
        }
    }

    // ----------------------------------------------------------------------
    // EVENT LISTENERS
    // ----------------------------------------------------------------------
    function setupEventListeners() {
        // Nav View Switching
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeView = btn.dataset.view;
                updateFilterOptions();
                renderActiveView();
            });
        });

        // Filter Dropdown Change
        selectFilter.addEventListener('change', (e) => {
            selectedFilterId = e.target.value;
            renderActiveView();
        });

        // Auto-Allocate All
        btnAutoAllocate.addEventListener('click', () => {
            const res = predictor.autoAllocateAllSubjects();
            if (res.success) {
                showToast(res.message, 'success');
                updateToolbarKPIs();
                renderActiveView();
            } else {
                showToast(res.message, 'error');
            }
        });

        // Predict Slot Modal Open
        btnPredictSlot.addEventListener('click', () => {
            openPredictorModal();
        });

        // Department Setup Modal
        btnManageData.addEventListener('click', () => {
            renderSetupModalTables();
            modalData.classList.add('active');
        });
        btnCloseDataModal.addEventListener('click', () => modalData.classList.remove('active'));
        btnCloseDataModalFooter.addEventListener('click', () => modalData.classList.remove('active'));

        // Reset to Default
        btnResetDefault.addEventListener('click', () => {
            if (confirm("Reset timetable to the verified optimal department schedule? Any custom edits will be restored to default.")) {
                store.resetToDefault();
                updateToolbarKPIs();
                renderActiveView();
                showToast("Timetable restored to optimal baseline.", "success");
            }
        });

        // Print
        btnPrint.addEventListener('click', () => window.print());

        // Export Modal
        btnExportModal.addEventListener('click', () => modalExport.classList.add('active'));
        btnCloseExport.addEventListener('click', () => modalExport.classList.remove('active'));
        btnCloseExportFooter.addEventListener('click', () => modalExport.classList.remove('active'));

        btnDownloadCSV.addEventListener('click', exportCSV);
        btnDownloadJSON.addEventListener('click', exportJSON);
        btnDownloadExcel.addEventListener('click', exportExcel);
        btnPrintModalBtn.addEventListener('click', () => {
            modalExport.classList.remove('active');
            window.print();
        });

        // Predictor Modal Controls
        btnCloseAllocate.addEventListener('click', () => modalAllocate.classList.remove('active'));
        btnCancelAllocate.addEventListener('click', () => modalAllocate.classList.remove('active'));

        allocSubject.addEventListener('change', onPredictorParamChange);
        allocClass.addEventListener('change', onPredictorParamChange);
        allocBatch.addEventListener('change', onPredictorParamChange);
        allocTeacher.addEventListener('change', onPredictorParamChange);

        // Setup Modal Tabs
        dataModalTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                dataModalTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetId = tab.dataset.tab;
                document.querySelectorAll('#modalData .tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(targetId)?.classList.add('active');
            });
        });

        // ------------------------------------------------------------------
        // SEARCH NAVIGATION (ALL search inputs navigate to search.html)
        // ------------------------------------------------------------------
        function openSearchPage(rawQuery) {
            const q = (rawQuery || '').trim();
            if (q) {
                window.location.href = `search.html?q=${encodeURIComponent(q)}`;
            } else {
                window.location.href = 'search.html';
            }
        }

        // 1. Top Header Search Bar
        const topHeaderSearchForm = document.getElementById('topHeaderSearchForm');
        const topHeaderSearchInput = document.getElementById('topHeaderSearchInput');
        if (topHeaderSearchForm) {
            topHeaderSearchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                openSearchPage(topHeaderSearchInput ? topHeaderSearchInput.value : '');
            });
        }
        if (topHeaderSearchInput) {
            topHeaderSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    openSearchPage(topHeaderSearchInput.value);
                }
            });
        }

        // 2. Toolbar Global Search Bar
        const globalSearchForm = document.getElementById('globalSearchForm');
        const globalSearchInput = document.getElementById('globalSearchInput');
        if (globalSearchForm) {
            globalSearchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                openSearchPage(globalSearchInput ? globalSearchInput.value : '');
            });
        }
        if (globalSearchInput) {
            globalSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    openSearchPage(globalSearchInput.value);
                }
            });
        }

        // 3. Setup Modal Search Input (NEVER filters in place - ALWAYS goes to search.html)
        const formTeacherSearchModal = document.getElementById('formTeacherSearchModal');
        const searchTeacherInput = document.getElementById('searchTeacherInput');
        if (formTeacherSearchModal) {
            formTeacherSearchModal.addEventListener('submit', (e) => {
                e.preventDefault();
                openSearchPage(searchTeacherInput ? searchTeacherInput.value : '');
            });
        }
        if (searchTeacherInput) {
            searchTeacherInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    openSearchPage(searchTeacherInput.value);
                }
            });
        }

        // ------------------------------------------------------------------
        // ADD INPUT MODAL LISTENERS (Divisions, Batches, Classrooms)
        // ------------------------------------------------------------------
        if (btnQuickAddInput) {
            btnQuickAddInput.addEventListener('click', () => {
                openAddInputModal('tabAddDivision');
            });
        }
        if (btnCloseAddInput) {
            btnCloseAddInput.addEventListener('click', () => modalAddInput.classList.remove('active'));
        }
        if (btnCloseAddInputFooter) {
            btnCloseAddInputFooter.addEventListener('click', () => modalAddInput.classList.remove('active'));
        }

        // Add Input Modal Tabs
        addInputTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                addInputTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetId = tab.dataset.tab;
                document.querySelectorAll('#modalAddInput .tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(targetId)?.classList.add('active');
                if (targetId === 'tabAddBatch') {
                    updateModalBatchDivisionSummary();
                }
            });
        });

        // Add Input Form: Division
        if (formModalAddDivision) {
            formModalAddDivision.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = document.getElementById('modalDivId').value;
                const name = document.getElementById('modalDivName').value;
                const customRoom = document.getElementById('inputModalDivClassroomCustom').value.trim();
                const room = customRoom || document.getElementById('selectModalDivClassroom').value;
                const batches = document.getElementById('modalDivBatches').value;
                const cap = document.getElementById('modalDivCapacity').value;

                const res = store.addClass({ id, name, classroom: room, batches, capacity: cap });
                if (res.success) {
                    showToast(`Division "${res.class.name}" (${res.class.id}) created with ${res.class.batches.length} batches!`, 'success');
                    formModalAddDivision.reset();
                    modalAddInput.classList.remove('active');
                    selectedFilterId = res.class.id;
                    updateFilterOptions();
                    renderActiveView();
                    renderSetupModalTables();
                } else {
                    showToast(res.error, 'error');
                }
            });
        }

        // Add Input Form: Batch
        const selectModalBatchDivision = document.getElementById('selectModalBatchDivision');
        if (selectModalBatchDivision) {
            selectModalBatchDivision.addEventListener('change', updateModalBatchDivisionSummary);
        }

        if (formModalAddBatch) {
            formModalAddBatch.addEventListener('submit', (e) => {
                e.preventDefault();
                const divId = selectModalBatchDivision.value;
                const code = document.getElementById('modalBatchCode').value;

                const res = store.addBatchToClass(divId, code);
                if (res.success) {
                    showToast(`Batch "${res.batch}" added to division ${divId}!`, 'success');
                    document.getElementById('modalBatchCode').value = '';
                    updateModalBatchDivisionSummary();
                    updateFilterOptions();
                    renderActiveView();
                    renderSetupModalTables();
                } else {
                    showToast(res.error, 'error');
                }
            });
        }

        // Add Input Form: Classroom / Lab Room
        if (formModalAddRoom) {
            formModalAddRoom.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = document.getElementById('modalRoomId').value;
                const name = document.getElementById('modalRoomName').value;
                const type = document.getElementById('selectModalRoomType').value;
                const cap = document.getElementById('modalRoomCapacity').value;
                const isComp = document.getElementById('checkModalRoomIsCompLab').checked;

                const res = store.addRoom({ id, name, type, isComputerLab: isComp, capacity: cap });
                if (res.success) {
                    showToast(`Room "${res.room.name}" (${res.room.id}) registered!`, 'success');
                    formModalAddRoom.reset();
                    modalAddInput.classList.remove('active');
                    updateFilterOptions();
                    renderActiveView();
                    renderSetupModalTables();
                } else {
                    showToast(res.error, 'error');
                }
            });
        }

        // Faculty Mode Switcher in Add Faculty Tab
        if (btnFacultyModeManual && btnFacultyModeExcel) {
            btnFacultyModeManual.addEventListener('click', () => {
                btnFacultyModeManual.classList.add('active');
                btnFacultyModeExcel.classList.remove('active');
                if (panelTeacherManual) panelTeacherManual.style.display = 'block';
                if (panelTeacherExcel) panelTeacherExcel.style.display = 'none';
            });
            btnFacultyModeExcel.addEventListener('click', () => {
                btnFacultyModeExcel.classList.add('active');
                btnFacultyModeManual.classList.remove('active');
                if (panelTeacherManual) panelTeacherManual.style.display = 'none';
                if (panelTeacherExcel) panelTeacherExcel.style.display = 'flex';
            });
        }

        // Designation change auto-updates default hours
        if (selectModalTeacherDesig && modalTeacherHours) {
            selectModalTeacherDesig.addEventListener('change', () => {
                const desigId = selectModalTeacherDesig.value;
                const desig = store.getDesignation(desigId);
                if (desig) {
                    modalTeacherHours.value = desig.maxHours;
                }
            });
        }

        // Add Faculty Manual Form Submission
        if (formModalAddTeacher) {
            formModalAddTeacher.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('modalTeacherName').value;
                const id = document.getElementById('modalTeacherId').value;
                const desigId = selectModalTeacherDesig ? selectModalTeacherDesig.value : 'desig_asst';
                const maxHours = modalTeacherHours ? modalTeacherHours.value : 18;
                const theory = document.getElementById('modalTeacherTheory').value;
                const labs = document.getElementById('modalTeacherLabs').value;

                const res = store.addTeacher({
                    id,
                    name,
                    designationId: desigId,
                    maxHoursPerWeek: maxHours,
                    theorySubjects: theory,
                    labSubjects: labs
                });

                if (res.success) {
                    showToast(`Faculty member "${res.teacher.name}" added successfully!`, 'success');
                    formModalAddTeacher.reset();
                    if (modalTeacherHours) modalTeacherHours.value = 18;
                    modalAddInput.classList.remove('active');
                    updateFilterOptions();
                    renderActiveView();
                    renderSetupModalTables();
                } else {
                    showToast(res.error, 'error');
                }
            });
        }

        // Download Faculty Template Buttons
        const triggerDownloadTemplate = () => downloadTeacherTemplate();
        if (btnDownloadTeacherTemplate) btnDownloadTeacherTemplate.addEventListener('click', triggerDownloadTemplate);
        if (btnSetupDownloadTeacherTemplate) btnSetupDownloadTeacherTemplate.addEventListener('click', triggerDownloadTemplate);

        // Setup modal faculty quick actions
        if (btnSetupOpenAddTeacher) {
            btnSetupOpenAddTeacher.addEventListener('click', () => {
                modalData.classList.remove('active');
                openAddInputModal('tabAddTeacher', 'manual');
            });
        }
        if (btnSetupImportExcel) {
            btnSetupImportExcel.addEventListener('click', () => {
                modalData.classList.remove('active');
                openAddInputModal('tabAddTeacher', 'excel');
            });
        }

        // Excel File Input & Dropzone
        if (inputTeacherExcelFile) {
            inputTeacherExcelFile.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    handleFacultyFile(e.target.files[0]);
                }
            });
        }
        if (teacherExcelDropzone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                teacherExcelDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    teacherExcelDropzone.classList.add('dragover');
                });
            });
            ['dragleave', 'drop'].forEach(eventName => {
                teacherExcelDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    teacherExcelDropzone.classList.remove('dragover');
                });
            });
            teacherExcelDropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                teacherExcelDropzone.classList.remove('dragover');
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFacultyFile(e.dataTransfer.files[0]);
                }
            });
        }

        // Confirm Excel Import
        if (btnConfirmExcelImport) {
            btnConfirmExcelImport.addEventListener('click', () => {
                if (!currentParsedFacultyList || currentParsedFacultyList.length === 0) {
                    showToast('No faculty rows to import.', 'error');
                    return;
                }
                const updateExisting = chkUpdateExistingTeachers ? chkUpdateExistingTeachers.checked : true;
                const res = store.importTeachers(currentParsedFacultyList, { updateExisting });
                if (res.success) {
                    showToast(`Processed spreadsheet: ${res.addedCount} new faculty added, ${res.updatedCount} updated, ${res.skippedCount} skipped.`, 'success');
                    currentParsedFacultyList = [];
                    if (excelImportPreviewArea) excelImportPreviewArea.style.display = 'none';
                    if (inputTeacherExcelFile) inputTeacherExcelFile.value = '';
                    modalAddInput.classList.remove('active');
                    updateFilterOptions();
                    renderActiveView();
                    renderSetupModalTables();
                } else {
                    showToast(res.error || 'Failed to import faculty.', 'error');
                }
            });
        }

        // Clear / Cancel Excel Import Preview
        if (btnClearExcelImport) {
            btnClearExcelImport.addEventListener('click', () => {
                currentParsedFacultyList = [];
                if (excelImportPreviewArea) excelImportPreviewArea.style.display = 'none';
                if (inputTeacherExcelFile) inputTeacherExcelFile.value = '';
            });
        }

        // ------------------------------------------------------------------
        // SETUP MODAL INLINE FORMS & CRUD DELEGATION
        // ------------------------------------------------------------------
        if (formSetupAddDivision) {
            formSetupAddDivision.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = document.getElementById('setupDivId').value;
                const name = document.getElementById('setupDivName').value;
                const room = document.getElementById('setupDivRoom').value;
                const batches = document.getElementById('setupDivBatches').value;

                const res = store.addClass({ id, name, classroom: room, batches });
                if (res.success) {
                    showToast(`Division "${res.class.name}" (${res.class.id}) created!`, 'success');
                    formSetupAddDivision.reset();
                    renderSetupModalTables();
                    updateFilterOptions();
                    renderActiveView();
                } else {
                    showToast(res.error, 'error');
                }
            });
        }

        if (formSetupAddRoom) {
            formSetupAddRoom.addEventListener('submit', (e) => {
                e.preventDefault();
                const id = document.getElementById('setupRoomId').value;
                const name = document.getElementById('setupRoomName').value;
                const type = document.getElementById('setupRoomType').value;
                const cap = document.getElementById('setupRoomCapacity').value;

                const res = store.addRoom({ id, name, type, isComputerLab: type === 'lab' && (id.toUpperCase().startsWith('CL') || id.includes('COMP')), capacity: cap });
                if (res.success) {
                    showToast(`Room "${res.room.name}" (${res.room.id}) registered!`, 'success');
                    formSetupAddRoom.reset();
                    renderSetupModalTables();
                    updateFilterOptions();
                    renderActiveView();
                } else {
                    showToast(res.error, 'error');
                }
            });
        }

        // Delegation for Table Classes action buttons (Remove batch, Add batch, Delete division)
        const tableClasses = document.getElementById('tableClasses');
        if (tableClasses) {
            tableClasses.addEventListener('click', (e) => {
                const btnTagRemove = e.target.closest('.btn-tag-remove');
                if (btnTagRemove) {
                    const divId = btnTagRemove.dataset.div;
                    const batchCode = btnTagRemove.dataset.batch;
                    if (confirm(`Remove batch "${batchCode}" from division ${divId}?`)) {
                        store.removeBatchFromClass(divId, batchCode);
                        renderSetupModalTables();
                        updateFilterOptions();
                        renderActiveView();
                        showToast(`Batch "${batchCode}" removed from ${divId}.`, 'info');
                    }
                    return;
                }

                const btnTagAdd = e.target.closest('.btn-tag-add');
                if (btnTagAdd) {
                    const divId = btnTagAdd.dataset.div;
                    const code = prompt(`Enter new batch code for division ${divId} (e.g. J1, E5):`);
                    if (code && code.trim()) {
                        const res = store.addBatchToClass(divId, code.trim());
                        if (res.success) {
                            renderSetupModalTables();
                            updateFilterOptions();
                            renderActiveView();
                            showToast(`Batch "${res.batch}" added to ${divId}!`, 'success');
                        } else {
                            showToast(res.error, 'error');
                        }
                    }
                    return;
                }

                const btnDelDiv = e.target.closest('.btn-del-div');
                if (btnDelDiv) {
                    const divId = btnDelDiv.dataset.div;
                    if (confirm(`Are you sure you want to delete division ${divId}? All timetable schedule slots for this division will be cleared.`)) {
                        const res = store.deleteClass(divId);
                        if (res.success) {
                            renderSetupModalTables();
                            updateFilterOptions();
                            renderActiveView();
                            showToast(`Division "${divId}" deleted.`, 'info');
                        } else {
                            showToast(res.error, 'error');
                        }
                    }
                    return;
                }
            });
        }

        // Delegation for Table Rooms action buttons (Delete room)
        const tableRooms = document.getElementById('tableRooms');
        if (tableRooms) {
            tableRooms.addEventListener('click', (e) => {
                const btnDelRoom = e.target.closest('.btn-del-room');
                if (btnDelRoom) {
                    const roomId = btnDelRoom.dataset.room;
                    if (confirm(`Are you sure you want to delete room "${roomId}"?`)) {
                        const res = store.deleteRoom(roomId);
                        if (res.success) {
                            renderSetupModalTables();
                            updateFilterOptions();
                            renderActiveView();
                            showToast(`Room "${roomId}" deleted.`, 'info');
                        } else {
                            showToast(res.error, 'error');
                        }
                    }
                }
            });
        }

        // Delegation for Table Teachers action buttons (Delete teacher)
        const tableTeachers = document.getElementById('tableTeachers');
        if (tableTeachers) {
            tableTeachers.addEventListener('click', (e) => {
                const btnDelTeacher = e.target.closest('.btn-del-teacher');
                if (btnDelTeacher) {
                    const tId = btnDelTeacher.dataset.teacherId;
                    const tName = btnDelTeacher.dataset.teacherName;
                    if (confirm(`Are you sure you want to delete faculty member "${tName}"?`)) {
                        const res = store.deleteTeacher(tId);
                        if (res.success) {
                            renderSetupModalTables();
                            updateFilterOptions();
                            renderActiveView();
                            showToast(`Faculty member "${tName}" deleted.`, 'info');
                        } else {
                            showToast(res.error, 'error');
                        }
                    }
                }
            });
        }
    }

    // ----------------------------------------------------------------------
    // ADD INPUT MODAL HELPERS
    // ----------------------------------------------------------------------
    function openAddInputModal(defaultTab = 'tabAddDivision', subMode = 'manual') {
        // Populate classroom options in Add Division tab
        const selectClassroom = document.getElementById('selectModalDivClassroom');
        if (selectClassroom) {
            selectClassroom.innerHTML = '';
            store.data.rooms.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `${r.name} (${r.type.toUpperCase()})`;
                selectClassroom.appendChild(opt);
            });
        }

        // Populate division options in Add Batch tab
        const selectDivForBatch = document.getElementById('selectModalBatchDivision');
        if (selectDivForBatch) {
            selectDivForBatch.innerHTML = '';
            store.data.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name} (${(c.batches || []).length} batches)`;
                selectDivForBatch.appendChild(opt);
            });
            updateModalBatchDivisionSummary();
        }

        // Faculty Sub-Mode setup
        if (defaultTab === 'tabAddTeacher') {
            if (subMode === 'excel') {
                if (btnFacultyModeExcel) btnFacultyModeExcel.classList.add('active');
                if (btnFacultyModeManual) btnFacultyModeManual.classList.remove('active');
                if (panelTeacherManual) panelTeacherManual.style.display = 'none';
                if (panelTeacherExcel) panelTeacherExcel.style.display = 'flex';
            } else {
                if (btnFacultyModeManual) btnFacultyModeManual.classList.add('active');
                if (btnFacultyModeExcel) btnFacultyModeExcel.classList.remove('active');
                if (panelTeacherManual) panelTeacherManual.style.display = 'block';
                if (panelTeacherExcel) panelTeacherExcel.style.display = 'none';
            }
        }

        // Set active tab
        addInputTabs.forEach(t => {
            if (t.dataset.tab === defaultTab) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        document.querySelectorAll('#modalAddInput .tab-content').forEach(c => {
            if (c.id === defaultTab) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });

        modalAddInput.classList.add('active');
    }

    function updateModalBatchDivisionSummary() {
        const selectDiv = document.getElementById('selectModalBatchDivision');
        const targetDivId = selectDiv ? selectDiv.value : null;
        const currentListSpan = document.getElementById('modalBatchCurrentList');
        if (!targetDivId || !currentListSpan) return;
        const cls = store.getClass(targetDivId);
        if (cls) {
            currentListSpan.textContent = (cls.batches && cls.batches.length > 0) ? cls.batches.join(', ') : 'No batches registered yet';
        }
    }

    // ----------------------------------------------------------------------
    // TOOLBAR KPIS & FILTERS
    // ----------------------------------------------------------------------
    function updateToolbarKPIs() {
        const stats = store.getOverallAllocationProgress();
        badgeProgressText.textContent = `Allocated: ${stats.percentage}% (${stats.totalAllocated}/${stats.totalRequired} hrs)`;
        
        const audit = validator.runFullAudit();
        if (audit.valid) {
            badgeAudit.className = 'stat-pill success';
            badgeAuditText.textContent = '0 Conflicts • Validated';
        } else {
            badgeAudit.className = 'stat-pill warning';
            badgeAuditText.textContent = `${audit.totalIssues} Warnings / Overlaps`;
        }
    }

    function updateFilterOptions() {
        selectFilter.innerHTML = '';
        const data = store.data;

        if (activeView === 'class') {
            filterGroup.style.display = 'flex';
            filterLabel.textContent = 'Select Division:';
            data.classes.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name} (${c.classroom})`;
                selectFilter.appendChild(opt);
            });
            selectedFilterId = data.classes.some(c => c.id === selectedFilterId) ? selectedFilterId : (data.classes[0] ? data.classes[0].id : '');
            selectFilter.value = selectedFilterId;

        } else if (activeView === 'batch') {
            filterGroup.style.display = 'flex';
            filterLabel.textContent = 'Select Batch:';
            let firstBatchKey = '';
            data.classes.forEach(c => {
                (c.batches || []).forEach(b => {
                    const opt = document.createElement('option');
                    const key = `${c.id}_${b}`;
                    opt.value = key;
                    opt.textContent = `${c.name} • Batch ${b}`;
                    selectFilter.appendChild(opt);
                    if (!firstBatchKey) firstBatchKey = key;
                });
            });
            const allBatchOptions = Array.from(selectFilter.options).map(o => o.value);
            if (!allBatchOptions.includes(selectedFilterId)) {
                selectedFilterId = firstBatchKey || 'SE-1_E1';
            }
            selectFilter.value = selectedFilterId;

        } else if (activeView === 'teacher') {
            filterGroup.style.display = 'flex';
            filterLabel.textContent = 'Select Faculty:';
            data.teachers.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.name;
                const hours = store.getTeacherScheduledHours(t.id);
                opt.textContent = `${t.name} (${hours}/${t.maxHoursPerWeek} hrs)`;
                selectFilter.appendChild(opt);
            });
            selectedFilterId = data.teachers.some(t => t.name === selectedFilterId) ? selectedFilterId : (data.teachers[0] ? data.teachers[0].name : '');
            selectFilter.value = selectedFilterId;

        } else if (activeView === 'room') {
            filterGroup.style.display = 'flex';
            filterLabel.textContent = 'Select Room:';
            data.rooms.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `${r.name} [${r.type.toUpperCase()}]`;
                selectFilter.appendChild(opt);
            });
            selectedFilterId = data.rooms.some(r => r.id === selectedFilterId) ? selectedFilterId : (data.rooms[0] ? data.rooms[0].id : '');
            selectFilter.value = selectedFilterId;

        } else if (activeView === 'allocator' || activeView === 'master' || activeView === 'audit') {
            filterGroup.style.display = 'none';
        }
    }

    // ----------------------------------------------------------------------
    // VIEW DISPATCHER
    // ----------------------------------------------------------------------
    function renderActiveView() {
        updateToolbarKPIs();

        if (activeView === 'class') {
            renderClassView();
        } else if (activeView === 'batch') {
            renderBatchView();
        } else if (activeView === 'teacher') {
            renderTeacherView();
        } else if (activeView === 'room') {
            renderRoomView();
        } else if (activeView === 'allocator') {
            renderSubjectAllocatorStudio();
        } else if (activeView === 'master') {
            renderMasterDepartmentView();
        } else if (activeView === 'audit') {
            renderAuditView();
        }
    }

    // ----------------------------------------------------------------------
    // 1. CLASS VIEW (SE-1, SE-2, SE-3, SE-4 with Parallel Labs)
    // ----------------------------------------------------------------------
    function renderClassView() {
        const cls = store.getClass(selectedFilterId);
        if (!cls) {
            if (store.data.classes.length > 0) {
                selectedFilterId = store.data.classes[0].id;
                return renderClassView();
            }
            timetableContainer.innerHTML = '<div style="padding:2.5rem; text-align:center; color:var(--text-secondary); background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--border-subtle);"><h3 style="color:var(--text-accent); margin-bottom:0.5rem;">No Divisions Registered</h3><p>Please add a division using the <strong>+ Add Input</strong> button in the top bar.</p></div>';
            return;
        }

        const schedule = store.data.schedule;
        const days = store.data.days;
        const timeSlots = store.data.timeSlots;

        let html = `
            <div class="timetable-wrapper">
                <table class="timetable-grid">
                    <thead>
                        <tr>
                            <th>Day / Time</th>
                            <th>Slot 1<span class="slot-time">10:00 - 11:00</span></th>
                            <th>Slot 2<span class="slot-time">11:00 - 12:00</span></th>
                            <th class="break-cell">Lunch Break<span class="slot-time">12:00 - 12:45</span></th>
                            <th>Slot 3<span class="slot-time">12:45 - 01:45</span></th>
                            <th>Slot 4<span class="slot-time">01:45 - 02:45</span></th>
                            <th class="break-cell">Short Break<span class="slot-time">02:45 - 03:00</span></th>
                            <th>Slot 5<span class="slot-time">03:00 - 04:00</span></th>
                            <th>Slot 6<span class="slot-time">04:00 - 05:00</span></th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        days.forEach((day, dIdx) => {
            html += `<tr><td class="day-header">${day}</td>`;

            const slotSequence = [1, 2, 'break1', 3, 4, 'break2', 5, 6];

            slotSequence.forEach(slot => {
                if (slot === 'break1') {
                    html += `<td class="break-cell"><div class="break-content">🍱 Lunch Break</div></td>`;
                    return;
                }
                if (slot === 'break2') {
                    html += `<td class="break-cell"><div class="break-content">☕ Short Break</div></td>`;
                    return;
                }

                const session = schedule && schedule[dIdx] && schedule[dIdx][slot] ? schedule[dIdx][slot][cls.id] : null;

                if (!session) {
                    html += `
                        <td>
                            <div class="free-slot-cell">
                                <span>Free</span>
                                <button class="btn-add-session" onclick="window.quickAllocate('${cls.id}', ${dIdx}, ${slot})">+ Allocate</button>
                            </div>
                        </td>
                    `;
                } else if (session.type === 'lecture') {
                    html += `
                        <td>
                            <div class="lecture-card" title="Click to view or adjust allocation" onclick="window.quickAllocate('${cls.id}', ${dIdx}, ${slot}, '${session.subjectCode}')">
                                <div class="card-top">
                                    <span class="card-code">${session.subjectCode}</span>
                                    <span class="card-type-tag">Theory</span>
                                </div>
                                <div class="card-subj-name">${session.subjectName}</div>
                                <div class="card-meta">
                                    <span class="card-teacher">👨‍🏫 ${session.teacherName}</span>
                                    <span class="card-room">${session.roomNumber}</span>
                                </div>
                            </div>
                        </td>
                    `;
                } else if (session.type === 'lab' && session.batches) {
                    html += `
                        <td>
                            <div class="parallel-lab-container">
                                <div class="parallel-lab-header">
                                    <span>🔬 Parallel Batches (2h Block)</span>
                                </div>
                                <div class="batch-matrix-grid">
                                    ${Object.entries(session.batches).map(([bCode, bData]) => `
                                        <div class="batch-card" title="Batch ${bCode}: ${bData.subjectName} with ${bData.teacherName} in ${bData.roomNumber}">
                                            <div><span class="batch-badge">${bCode}:</span> <span class="batch-subj">${bData.subjectCode}</span></div>
                                            <div style="font-size:0.62rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${bData.teacherName.split(' ').slice(-1)[0]}</div>
                                            <div class="batch-room-chip">📍 ${bData.roomNumber}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </td>
                    `;
                }
            });

            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        timetableContainer.innerHTML = html;
    }

    // ----------------------------------------------------------------------
    // 2. INDIVIDUAL BATCH VIEW (Student View e.g. SE-1 E1)
    // ----------------------------------------------------------------------
    function renderBatchView() {
        if (!selectedFilterId || !selectedFilterId.includes('_')) {
            const firstCls = store.data.classes[0];
            if (firstCls && firstCls.batches && firstCls.batches.length > 0) {
                selectedFilterId = `${firstCls.id}_${firstCls.batches[0]}`;
            }
        }
        const [divId, bCode] = (selectedFilterId || '').split('_');
        const cls = store.getClass(divId);
        if (!cls || !bCode) {
            timetableContainer.innerHTML = '<div style="padding:2.5rem; text-align:center; color:var(--text-secondary); background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--border-subtle);"><h3 style="color:var(--text-accent); margin-bottom:0.5rem;">No Batches Available</h3><p>Please add a division and lab batches using the <strong>+ Add Input</strong> button in the top bar.</p></div>';
            return;
        }

        const schedule = store.data.schedule;
        const days = store.data.days;

        let html = `
            <div style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.85rem;">
                Displaying individualized student timetable for <strong>${cls.name} • Batch ${bCode}</strong>
            </div>
            <div class="timetable-wrapper">
                <table class="timetable-grid">
                    <thead>
                        <tr>
                            <th>Day / Time</th>
                            <th>Slot 1 (10-11)</th><th>Slot 2 (11-12)</th>
                            <th class="break-cell">Lunch</th>
                            <th>Slot 3 (12:45-1:45)</th><th>Slot 4 (1:45-2:45)</th>
                            <th class="break-cell">Tea</th>
                            <th>Slot 5 (3-4)</th><th>Slot 6 (4-5)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        days.forEach((day, dIdx) => {
            html += `<tr><td class="day-header">${day}</td>`;
            const slotSequence = [1, 2, 'break1', 3, 4, 'break2', 5, 6];

            slotSequence.forEach(slot => {
                if (slot === 'break1' || slot === 'break2') {
                    html += `<td class="break-cell"><div class="break-content">${slot === 'break1' ? 'Lunch' : 'Break'}</div></td>`;
                    return;
                }

                const divSession = schedule && schedule[dIdx] && schedule[dIdx][slot] ? schedule[dIdx][slot][divId] : null;

                if (!divSession) {
                    html += `<td><div class="free-slot-cell">Free Study</div></td>`;
                } else if (divSession.type === 'lecture') {
                    html += `
                        <td>
                            <div class="lecture-card">
                                <div class="card-top">
                                    <span class="card-code">${divSession.subjectCode}</span>
                                    <span class="card-type-tag">Lecture</span>
                                </div>
                                <div class="card-subj-name">${divSession.subjectName}</div>
                                <div class="card-meta">
                                    <span class="card-teacher">👨‍🏫 ${divSession.teacherName}</span>
                                    <span class="card-room">${divSession.roomNumber}</span>
                                </div>
                            </div>
                        </td>
                    `;
                } else if (divSession.type === 'lab' && divSession.batches) {
                    const myBatchData = divSession.batches[bCode];
                    if (myBatchData) {
                        html += `
                            <td>
                                <div class="parallel-lab-container" style="border-color: var(--cyan); background: var(--cyan-light);">
                                    <div class="card-top">
                                        <span class="card-code" style="color:#67e8f9;">${myBatchData.subjectCode}</span>
                                        <span class="card-type-tag" style="background:rgba(6,182,212,0.25); color:#a5f3fc;">Batch ${bCode}</span>
                                    </div>
                                    <div class="card-subj-name">${myBatchData.subjectName}</div>
                                    <div class="card-meta">
                                        <span class="card-teacher">👨‍🏫 ${myBatchData.teacherName}</span>
                                        <span class="card-room">🔬 ${myBatchData.roomNumber}</span>
                                    </div>
                                </div>
                            </td>
                        `;
                    } else {
                        html += `<td><div class="free-slot-cell">Free Slot</div></td>`;
                    }
                }
            });

            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        timetableContainer.innerHTML = html;
    }

    // ----------------------------------------------------------------------
    // 3. TEACHER SCHEDULE VIEW
    // ----------------------------------------------------------------------
    function renderTeacherView() {
        let teacher = store.getTeacher(selectedFilterId);
        if (!teacher) {
            if (store.data.teachers.length > 0) {
                selectedFilterId = store.data.teachers[0].name;
                teacher = store.data.teachers[0];
            } else {
                timetableContainer.innerHTML = '<div style="padding:2.5rem; text-align:center; color:var(--text-secondary); background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--border-subtle);"><h3 style="color:var(--text-accent); margin-bottom:0.5rem;">No Faculty Members Registered</h3><p>Please add faculty members using the <strong>+ Add Input</strong> button in the top bar or via Excel upload.</p></div>';
                return;
            }
        }

        const scheduledHours = store.getTeacherScheduledHours(teacher.id);
        const maxHours = teacher.maxHoursPerWeek || 18;
        const pct = Math.min(100, Math.round((scheduledHours / maxHours) * 100));
        const schedule = store.data.schedule;
        const days = store.data.days;

        let html = `
            <div style="background: var(--bg-surface); border:1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; display: flex; align-items:center; justify-content: space-between; flex-wrap:wrap; gap: 1rem;">
                <div>
                    <h3 style="font-size: 1.15rem; font-weight: 800;">👨‍🏫 ${teacher.name}</h3>
                    <p style="font-size: 0.8rem; color: var(--text-secondary);">
                        Quota Cap: <strong>${maxHours} hrs/week</strong> • Assigned Syllabi: ${[...teacher.theorySubjects, ...teacher.labSubjects].join(', ')}
                    </p>
                </div>
                <div style="min-width: 200px;">
                    <div style="display:flex; justify-content:space-between; font-size: 0.75rem; font-weight:600; margin-bottom: 0.25rem;">
                        <span>Workload: ${scheduledHours} / ${maxHours} hrs</span>
                        <span style="color: ${pct > 100 ? 'var(--rose)' : 'var(--emerald)'};">${pct}%</span>
                    </div>
                    <div style="height: 8px; background: var(--bg-surface-elevated); border-radius: var(--radius-full); overflow:hidden;">
                        <div style="width: ${pct}%; height:100%; background: ${pct > 100 ? 'var(--rose)' : 'var(--gradient-brand)'};"></div>
                    </div>
                </div>
            </div>

            <div class="timetable-wrapper">
                <table class="timetable-grid">
                    <thead>
                        <tr>
                            <th>Day / Time</th>
                            <th>Slot 1</th><th>Slot 2</th>
                            <th class="break-cell">Lunch</th>
                            <th>Slot 3</th><th>Slot 4</th>
                            <th class="break-cell">Tea</th>
                            <th>Slot 5</th><th>Slot 6</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        days.forEach((day, dIdx) => {
            html += `<tr><td class="day-header">${day}</td>`;
            const slotSequence = [1, 2, 'break1', 3, 4, 'break2', 5, 6];

            slotSequence.forEach(slot => {
                if (slot === 'break1' || slot === 'break2') {
                    html += `<td class="break-cell"><div class="break-content">Break</div></td>`;
                    return;
                }

                // Search for sessions taught by this teacher
                let foundSession = null;
                const slotMap = schedule && schedule[dIdx] && schedule[dIdx][slot];
                if (slotMap) {
                    for (const cId in slotMap) {
                        const sess = slotMap[cId];
                        if (sess.type === 'lecture' && (sess.teacherName === teacher.name || sess.teacherId === teacher.id)) {
                            foundSession = { type: 'lecture', classId: cId, subjectCode: sess.subjectCode, subjectName: sess.subjectName, room: sess.roomNumber };
                            break;
                        } else if (sess.type === 'lab' && sess.batches) {
                            for (const b in sess.batches) {
                                if (sess.batches[b].teacherName === teacher.name || sess.batches[b].teacherId === teacher.id) {
                                    foundSession = { type: 'lab', classId: `${cId} (${b})`, subjectCode: sess.batches[b].subjectCode, subjectName: sess.batches[b].subjectName, room: sess.batches[b].roomNumber };
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!foundSession) {
                    html += `<td><div class="free-slot-cell">Free</div></td>`;
                } else {
                    html += `
                        <td>
                            <div class="${foundSession.type === 'lab' ? 'parallel-lab-container' : 'lecture-card'}" style="min-height: 75px;">
                                <div class="card-top">
                                    <span class="card-code">${foundSession.subjectCode}</span>
                                    <span class="card-type-tag">${foundSession.classId}</span>
                                </div>
                                <div class="card-subj-name">${foundSession.subjectName}</div>
                                <div class="card-meta">
                                    <span class="card-room">📍 ${foundSession.room}</span>
                                </div>
                            </div>
                        </td>
                    `;
                }
            });

            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        timetableContainer.innerHTML = html;
    }

    // ----------------------------------------------------------------------
    // 4. ROOM OCCUPANCY VIEW
    // ----------------------------------------------------------------------
    function renderRoomView() {
        const room = store.getRoom(selectedFilterId);
        if (!room) return;

        const schedule = store.data.schedule;
        const days = store.data.days;

        let html = `
            <div style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.85rem;">
                Occupancy tracking for <strong>${room.name}</strong> • Type: <strong>${room.type.toUpperCase()}</strong> • Capacity: <strong>${room.capacity} Students</strong>
            </div>
            <div class="timetable-wrapper">
                <table class="timetable-grid">
                    <thead>
                        <tr>
                            <th>Day / Time</th>
                            <th>Slot 1</th><th>Slot 2</th>
                            <th class="break-cell">Lunch</th>
                            <th>Slot 3</th><th>Slot 4</th>
                            <th class="break-cell">Tea</th>
                            <th>Slot 5</th><th>Slot 6</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        days.forEach((day, dIdx) => {
            html += `<tr><td class="day-header">${day}</td>`;
            const slotSequence = [1, 2, 'break1', 3, 4, 'break2', 5, 6];

            slotSequence.forEach(slot => {
                if (slot === 'break1' || slot === 'break2') {
                    html += `<td class="break-cell"><div class="break-content">Break</div></td>`;
                    return;
                }

                let found = null;
                const slotMap = schedule && schedule[dIdx] && schedule[dIdx][slot];
                if (slotMap) {
                    for (const cId in slotMap) {
                        const sess = slotMap[cId];
                        if (sess.type === 'lecture' && (sess.roomId === room.id || sess.roomNumber === room.name)) {
                            found = { type: 'lecture', title: sess.subjectCode, desc: `${cId} • ${sess.teacherName}` };
                            break;
                        } else if (sess.type === 'lab' && sess.batches) {
                            for (const b in sess.batches) {
                                if (sess.batches[b].roomId === room.id || sess.batches[b].roomNumber === room.name) {
                                    found = { type: 'lab', title: `${sess.batches[b].subjectCode} (${b})`, desc: sess.batches[b].teacherName };
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!found) {
                    html += `<td><div class="free-slot-cell" style="color:var(--emerald);">Vacant</div></td>`;
                } else {
                    html += `
                        <td>
                            <div class="${found.type === 'lab' ? 'parallel-lab-container' : 'lecture-card'}" style="min-height: 75px;">
                                <div class="card-code">${found.title}</div>
                                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem;">${found.desc}</div>
                            </div>
                        </td>
                    `;
                }
            });

            html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        timetableContainer.innerHTML = html;
    }

    // ----------------------------------------------------------------------
    // 5. SUBJECT ALLOCATOR STUDIO VIEW
    // ----------------------------------------------------------------------
    function renderSubjectAllocatorStudio() {
        const stats = store.getOverallAllocationProgress();
        const subjects = store.data.subjects;

        let html = `
            <div class="allocator-studio">
                <div class="studio-header-card">
                    <div class="studio-title-group">
                        <h2>Subject Allocation & Curriculum Workload Studio</h2>
                        <p>Real-time tracking of all 12 subjects across 4 divisions and 16 batches for Semester 1 Computer Engineering.</p>
                    </div>
                    <button class="btn btn-primary" id="btnAutoAllocateStudio">
                        ⚡ Auto-Allocate All 12 Subjects
                    </button>
                </div>

                <div class="studio-stats-row">
                    <div class="stat-metric-card">
                        <span class="stat-metric-label">Curriculum Completion</span>
                        <span class="stat-metric-value">${stats.percentage}%</span>
                        <div class="stat-progress-bar">
                            <div class="stat-progress-fill" style="width: ${stats.percentage}%;"></div>
                        </div>
                    </div>
                    <div class="stat-metric-card">
                        <span class="stat-metric-label">Allocated Hours</span>
                        <span class="stat-metric-value">${stats.totalAllocated} <span style="font-size:1rem; color:var(--text-secondary);">/ ${stats.totalRequired} hrs</span></span>
                    </div>
                    <div class="stat-metric-card">
                        <span class="stat-metric-label">Curriculum Subjects</span>
                        <span class="stat-metric-value">${subjects.length} <span style="font-size:1rem; color:var(--text-secondary);">Subjects</span></span>
                    </div>
                    <div class="stat-metric-card">
                        <span class="stat-metric-label">Divisions & Batches</span>
                        <span class="stat-metric-value">${store.data.classes.length} <span style="font-size:1rem; color:var(--text-secondary);">Div / ${store.data.classes.reduce((sum, c) => sum + (c.batches ? c.batches.length : 0), 0)} Batches</span></span>
                    </div>
                </div>

                <div class="subject-allocation-grid">
        `;

        const totalBatchesCount = store.data.classes.reduce((sum, c) => sum + (c.batches ? c.batches.length : 0), 0);
        subjects.forEach(subj => {
            const sStat = store.getSubjectAllocationStats(subj.code);
            const isLab = subj.type === 'lab';
            const isCompLab = subj.isComputerLab;

            html += `
                <div class="subject-item-card">
                    <div class="subject-card-head">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="subject-code-tag">${subj.code}</span>
                            <span class="badge-tag ${isLab ? 'lab' : 'th'}">${subj.type.toUpperCase()}</span>
                            ${isCompLab ? '<span class="badge-tag cl">Comp Lab</span>' : ''}
                        </div>
                        <span style="font-size: 0.75rem; font-weight:700; color: ${sStat.percentage === 100 ? 'var(--emerald)' : 'var(--amber)'};">
                            ${sStat.percentage}% Complete
                        </span>
                    </div>

                    <div>
                        <div class="subject-name-text">${subj.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">
                            ${isLab ? `${subj.weeklyHours} hrs/week per batch (${totalBatchesCount} batches total)` : `${subj.weeklyHours} hrs/week per division (${store.data.classes.length} divisions)`}
                        </div>
                    </div>

                    <div>
                        <div class="subject-hours-meta">
                            <span>Scheduled: ${sStat.allocatedHours} hrs</span>
                            <span>Required: ${sStat.requiredHours} hrs</span>
                        </div>
                        <div class="stat-progress-bar">
                            <div class="stat-progress-fill" style="width: ${sStat.percentage}%; background: ${sStat.percentage === 100 ? 'var(--emerald)' : 'var(--gradient-brand)'};"></div>
                        </div>
                    </div>

                    <div class="subject-action-bar">
                        <button class="btn btn-secondary" style="flex:1; font-size:0.75rem; padding:0.4rem 0.6rem;" onclick="window.quickAllocateSubject('${subj.code}')">
                            + Predict & Allocate
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        timetableContainer.innerHTML = html;

        document.getElementById('btnAutoAllocateStudio')?.addEventListener('click', () => {
            const res = predictor.autoAllocateAllSubjects();
            if (res.success) {
                showToast(res.message, 'success');
                renderSubjectAllocatorStudio();
            }
        });
    }

    // ----------------------------------------------------------------------
    // 6. MASTER DEPARTMENT MATRIX VIEW
    // ----------------------------------------------------------------------
    function renderMasterDepartmentView() {
        const classes = store.data.classes;
        const schedule = store.data.schedule;
        const days = store.data.days;

        let html = `
            <div style="display:flex; flex-direction:column; gap:2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="font-size: 1.25rem; font-weight:800;">Master Department Timetable Matrix (${classes.map(c => c.id).join(', ')})</h2>
                    <span style="font-size:0.8rem; color:var(--text-secondary);">${classes.length} Divisions • ${classes.reduce((sum, c) => sum + (c.batches ? c.batches.length : 0), 0)} Parallel Batches</span>
                </div>
        `;

        classes.forEach(cls => {
            html += `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 1.25rem; border-radius: var(--radius-lg);">
                    <h3 style="color: var(--text-accent); font-size: 1rem; margin-bottom: 0.75rem; display:flex; align-items:center; gap:0.5rem;">
                        <span>🎓 ${cls.name}</span>
                        <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">(Classroom: ${cls.classroom})</span>
                    </h3>
                    <div class="timetable-wrapper">
                        <table class="timetable-grid">
                            <thead>
                                <tr>
                                    <th>Day</th><th>Slot 1</th><th>Slot 2</th><th class="break-cell">Lunch</th><th>Slot 3</th><th>Slot 4</th><th class="break-cell">Tea</th><th>Slot 5</th><th>Slot 6</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            days.forEach((day, dIdx) => {
                html += `<tr><td class="day-header" style="font-size:0.8rem; padding:0.4rem;">${day}</td>`;
                const slotSequence = [1, 2, 'break1', 3, 4, 'break2', 5, 6];

                slotSequence.forEach(slot => {
                    if (slot === 'break1' || slot === 'break2') {
                        html += `<td class="break-cell"><div class="break-content">Break</div></td>`;
                        return;
                    }

                    const sess = schedule && schedule[dIdx] && schedule[dIdx][slot] ? schedule[dIdx][slot][cls.id] : null;

                    if (!sess) {
                        html += `<td><div class="free-slot-cell" style="min-height:50px; font-size:0.65rem;">Free</div></td>`;
                    } else if (sess.type === 'lecture') {
                        html += `
                            <td>
                                <div class="lecture-card" style="min-height:50px; padding:0.4rem;">
                                    <div class="card-code" style="font-size:0.78rem;">${sess.subjectCode}</div>
                                    <div style="font-size:0.65rem; color:var(--text-secondary);">${sess.teacherName.split(' ').slice(-1)[0]}</div>
                                </div>
                            </td>
                        `;
                    } else if (sess.type === 'lab' && sess.batches) {
                        const subjs = Object.values(sess.batches).map(b => b.subjectCode).join(',');
                        html += `
                            <td>
                                <div class="parallel-lab-container" style="min-height:50px; padding:0.4rem;">
                                    <div style="font-weight:700; font-size:0.72rem; color:#6ee7b7;">Labs: ${subjs}</div>
                                    <div style="font-size:0.62rem; color:var(--text-secondary);">4 Batches Active</div>
                                </div>
                            </td>
                        `;
                    }
                });

                html += `</tr>`;
            });

            html += `</tbody></table></div></div>`;
        });

        html += `</div>`;
        timetableContainer.innerHTML = html;
    }

    // ----------------------------------------------------------------------
    // 7. AUDIT & CONFLICT INSPECTOR VIEW
    // ----------------------------------------------------------------------
    function renderAuditView() {
        const audit = validator.runFullAudit();
        const r = audit.results;

        let html = `
            <div class="audit-container">
                <div class="audit-score-banner">
                    <div class="audit-score-icon ${audit.valid ? 'success' : 'warning'}">
                        ${audit.valid ? '🛡️' : '⚠️'}
                    </div>
                    <div>
                        <h2 style="font-size: 1.35rem; font-weight:800;">
                            ${audit.valid ? 'Timetable Fully Verified & Conflict-Free' : `${audit.totalIssues} Constraint Warnings Detected`}
                        </h2>
                        <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;">
                            Checked ${r.totalSessionsChecked} timetable sessions across all days, slots, faculty members, and room locations.
                        </p>
                    </div>
                </div>

                <div class="audit-category-grid">
                    <div class="audit-card ${r.teacherConflicts.length === 0 ? 'pass' : 'fail'}">
                        <div class="audit-card-title">
                            <span>Faculty Overlaps</span>
                            <span>${r.teacherConflicts.length === 0 ? '✅ 0 Conflicts' : `❌ ${r.teacherConflicts.length}`}</span>
                        </div>
                        <div class="audit-card-desc">No teacher is scheduled in multiple classes simultaneously.</div>
                        ${r.teacherConflicts.map(c => `<div style="font-size:0.75rem; color:var(--rose);">${c.message}</div>`).join('')}
                    </div>

                    <div class="audit-card ${r.roomConflicts.length === 0 ? 'pass' : 'fail'}">
                        <div class="audit-card-title">
                            <span>Room / Lab Overlaps</span>
                            <span>${r.roomConflicts.length === 0 ? '✅ 0 Conflicts' : `❌ ${r.roomConflicts.length}`}</span>
                        </div>
                        <div class="audit-card-desc">No classroom or lab is assigned to two groups at the same time.</div>
                        ${r.roomConflicts.map(c => `<div style="font-size:0.75rem; color:var(--rose);">${c.message}</div>`).join('')}
                    </div>

                    <div class="audit-card ${r.computerLabCapacityViolations.length === 0 ? 'pass' : 'fail'}">
                        <div class="audit-card-title">
                            <span>Max 7 Computer Labs Cap</span>
                            <span>${r.computerLabCapacityViolations.length === 0 ? '✅ Compliant (<=7)' : `❌ Exceeded`}</span>
                        </div>
                        <div class="audit-card-desc">At no time do DSL and COAL sessions exceed the 7 available computer labs.</div>
                        ${r.computerLabCapacityViolations.map(c => `<div style="font-size:0.75rem; color:var(--rose);">${c.message}</div>`).join('')}
                    </div>

                    <div class="audit-card ${r.workloadOverages.length === 0 ? 'pass' : 'fail'}">
                        <div class="audit-card-title">
                            <span>Faculty Workload Caps</span>
                            <span>${r.workloadOverages.length === 0 ? '✅ 100% Within Quotas' : `❌ ${r.workloadOverages.length} Exceeded`}</span>
                        </div>
                        <div class="audit-card-desc">All teachers are scheduled strictly within their maximum weekly load limits.</div>
                        ${r.workloadOverages.map(c => `<div style="font-size:0.75rem; color:var(--rose);">${c.message}</div>`).join('')}
                    </div>

                    <div class="audit-card ${r.unallocatedSubjects.length === 0 ? 'pass' : 'fail'}">
                        <div class="audit-card-title">
                            <span>Syllabus Completeness</span>
                            <span>${r.unallocatedSubjects.length === 0 ? '✅ All 12 Subjects Complete' : `❌ Deficits`}</span>
                        </div>
                        <div class="audit-card-desc">All required hours for DS, DSL, COA, COAL, MDM, MDMT, DM, UHV, EEFM, CEP, FLS, PDCR are met.</div>
                        ${r.unallocatedSubjects.map(c => `<div style="font-size:0.75rem; color:var(--rose);">${c.message}</div>`).join('')}
                    </div>
                </div>
            </div>
        `;

        timetableContainer.innerHTML = html;
    }

    // ----------------------------------------------------------------------
    // PREDICTOR MODAL LOGIC
    // ----------------------------------------------------------------------
    function openPredictorModal(targetClass = 'SE-1', targetSubject = null) {
        populatePredictorForm(targetClass, targetSubject);
        onPredictorParamChange();
        modalAllocate.classList.add('active');
    }

    function populatePredictorForm(targetClass = 'SE-1', targetSubject = null) {
        // Subjects dropdown
        allocSubject.innerHTML = '';
        store.data.subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.code;
            opt.textContent = `${s.code} - ${s.name} (${s.type.toUpperCase()})`;
            allocSubject.appendChild(opt);
        });
        if (targetSubject) allocSubject.value = targetSubject;

        // Class dropdown - dynamically populated
        allocClass.innerHTML = '';
        store.data.classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name} (${c.classroom})`;
            allocClass.appendChild(opt);
        });
        if (targetClass && store.getClass(targetClass)) {
            allocClass.value = targetClass;
        } else if (store.data.classes.length > 0) {
            allocClass.value = store.data.classes[0].id;
        }

        // Update batches
        updatePredictorBatches();

        // Teachers dropdown
        allocTeacher.innerHTML = '';
        store.data.teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = t.name;
            allocTeacher.appendChild(opt);
        });
    }

    function updatePredictorBatches() {
        const clsId = allocClass.value;
        const cls = store.getClass(clsId);
        const subj = store.getSubject(allocSubject.value);
        const isLab = subj && subj.type === 'lab';

        allocBatch.innerHTML = '';
        if (isLab) {
            allocBatchWrapper.style.display = 'block';
            if (cls) {
                cls.batches.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b;
                    opt.textContent = `Batch ${b}`;
                    allocBatch.appendChild(opt);
                });
            }
        } else {
            allocBatchWrapper.style.display = 'none';
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Entire Class (Theory)';
            allocBatch.appendChild(opt);
        }
    }

    function onPredictorParamChange() {
        updatePredictorBatches();

        const sCode = allocSubject.value;
        const cId = allocClass.value;
        const bCode = allocBatch.value || null;
        const tName = allocTeacher.value || null;

        const recommendations = predictor.predictBestSlots(sCode, cId, bCode, tName);
        renderRecommendations(recommendations, sCode, cId, bCode, tName);
    }

    function renderRecommendations(recoms, sCode, cId, bCode, tName) {
        recomList.innerHTML = '';
        const topRecoms = recoms.slice(0, 8); // Top 8 slots

        if (topRecoms.length === 0) {
            recomList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:1rem;">No candidate slots found.</div>';
            return;
        }

        topRecoms.forEach(item => {
            const isOptimal = item.score >= 85;
            const div = document.createElement('div');
            div.className = `recommendation-item ${isOptimal ? 'optimal' : ''}`;
            div.innerHTML = `
                <div>
                    <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">
                        ${item.dayName} • Slot ${item.slotIndex} (${item.slotTime})
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.2rem;">
                        ${item.feasible ? `Recommended for ${item.span === 2 ? '2-Hour Lab Block' : '1-Hour Lecture'}` : item.reasons.join(' ')}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span class="recom-score">${item.score}/100</span>
                    <button class="btn btn-primary" style="padding:0.35rem 0.65rem; font-size:0.75rem;">
                        Apply Slot
                    </button>
                </div>
            `;

            div.querySelector('button').addEventListener('click', () => {
                const res = predictor.allocateSubjectSession(item.dayIndex, item.slotIndex, cId, sCode, item.teacherName, null, bCode);
                if (res.success) {
                    showToast(`Allocated ${sCode} to ${cId} on ${item.dayName} Slot ${item.slotIndex}!`, 'success');
                    modalAllocate.classList.remove('active');
                    updateToolbarKPIs();
                    renderActiveView();
                } else {
                    showToast(`Error: ${res.error}`, 'error');
                }
            });

            recomList.appendChild(div);
        });
    }

    // ----------------------------------------------------------------------
    // SETUP MODAL TABLE POPULATION
    // ----------------------------------------------------------------------
    function renderSetupModalTables() {
        const data = store.data;

        // Teachers Table
        const tbTeachers = document.querySelector('#tableTeachers tbody');
        tbTeachers.innerHTML = '';
        data.teachers.forEach(t => {
            const desig = store.getDesignation(t.designationId);
            const hours = store.getTeacherScheduledHours(t.id);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${t.name}</strong></td>
                <td>${desig ? desig.name : 'Faculty'}</td>
                <td>${t.maxHoursPerWeek} hrs/week</td>
                <td><span style="font-weight:700; color:${hours > t.maxHoursPerWeek ? 'var(--rose)' : 'var(--emerald)'};">${hours} hrs</span></td>
                <td><span style="font-size:0.75rem; color:var(--text-secondary);">${[...t.theorySubjects, ...t.labSubjects].join(', ')}</span></td>
                <td>
                    <button class="btn-table-del btn-del-teacher" data-teacher-id="${t.id}" data-teacher-name="${t.name}" title="Delete faculty member ${t.name}">
                        🗑️ Delete
                    </button>
                </td>
            `;
            tbTeachers.appendChild(tr);
        });

        const teacherCountDisplay = document.getElementById('teacherCountDisplay');
        if (teacherCountDisplay) {
            teacherCountDisplay.textContent = `${data.teachers.length} Faculty Members`;
        }

        // Subjects Table
        const tbSubjects = document.querySelector('#tableSubjects tbody');
        tbSubjects.innerHTML = '';
        data.subjects.forEach(s => {
            const stat = store.getSubjectAllocationStats(s.code);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${s.code}</strong></td>
                <td>${s.name}</td>
                <td><span class="badge-tag ${s.type === 'lab' ? 'lab' : 'th'}">${s.type}</span></td>
                <td>${s.weeklyHours} hrs/week</td>
                <td>${s.roomType.toUpperCase()}</td>
                <td><span style="font-weight:700; color:${stat.percentage === 100 ? 'var(--emerald)' : 'var(--amber)'};">${stat.allocatedHours}/${stat.requiredHours} hrs (${stat.percentage}%)</span></td>
            `;
            tbSubjects.appendChild(tr);
        });

        // Classes Table
        const tbClasses = document.querySelector('#tableClasses tbody');
        tbClasses.innerHTML = '';
        data.classes.forEach(c => {
            const tr = document.createElement('tr');
            const batchesHtml = (c.batches || []).map(b => `
                <span class="batch-tag-removable">
                    ${b}
                    <button class="btn-tag-remove" data-div="${c.id}" data-batch="${b}" title="Remove batch ${b}">&times;</button>
                </span>
            `).join('');

            tr.innerHTML = `
                <td>
                    <strong>${c.name}</strong>
                    <div style="font-size:0.7rem; color:var(--text-accent); font-family:var(--font-mono);">${c.id}</div>
                </td>
                <td>
                    <span class="badge-tag th" style="font-size:0.75rem;">${c.classroom}</span>
                </td>
                <td>
                    <div class="batch-chip-list">
                        ${batchesHtml}
                        <button class="btn-tag-add" data-div="${c.id}" title="Add batch to ${c.name}">+ Batch</button>
                    </div>
                </td>
                <td>~${c.capacity || 75} Students</td>
                <td>
                    <button class="btn-table-del btn-del-div" data-div="${c.id}" title="Delete division ${c.name}">
                        🗑️ Delete
                    </button>
                </td>
            `;
            tbClasses.appendChild(tr);
        });

        // Rooms Table
        const tbRooms = document.querySelector('#tableRooms tbody');
        tbRooms.innerHTML = '';
        data.rooms.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${r.name}</strong>
                    <div style="font-size:0.7rem; color:var(--text-accent); font-family:var(--font-mono);">${r.id}</div>
                </td>
                <td><span class="badge-tag ${r.type === 'lab' ? 'lab' : 'th'}">${r.type.toUpperCase()}</span></td>
                <td>${r.isComputerLab ? '💻 Yes (DSL/COAL)' : 'No'}</td>
                <td>${r.capacity} Capacity</td>
                <td>
                    <button class="btn-table-del btn-del-room" data-room="${r.id}" title="Delete room ${r.id}">
                        🗑️ Delete
                    </button>
                </td>
            `;
            tbRooms.appendChild(tr);
        });
    }

    // ----------------------------------------------------------------------
    // EXPORT HANDLERS
    // ----------------------------------------------------------------------
    function exportCSV() {
        const schedule = store.data.schedule;
        const days = store.data.days;
        const classes = store.data.classes;

        let csv = 'Division,Day,Slot,Type,Subject,Teacher,Room,Batches\n';

        classes.forEach(c => {
            days.forEach((day, dIdx) => {
                for (let s = 1; s <= 6; s++) {
                    const sess = schedule && schedule[dIdx] && schedule[dIdx][s] ? schedule[dIdx][s][c.id] : null;
                    if (!sess) {
                        csv += `"${c.name}","${day}",${s},"Free","---","---","---","---"\n`;
                    } else if (sess.type === 'lecture') {
                        csv += `"${c.name}","${day}",${s},"Lecture","${sess.subjectCode}","${sess.teacherName}","${sess.roomNumber}","ALL"\n`;
                    } else if (sess.type === 'lab' && sess.batches) {
                        for (const b in sess.batches) {
                            const bData = sess.batches[b];
                            csv += `"${c.name}","${day}",${s},"Lab","${bData.subjectCode}","${bData.teacherName}","${bData.roomNumber}","${b}"\n`;
                        }
                    }
                }
            });
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `PICT_SE_Timetable_2026_27.csv`;
        link.click();
        showToast("CSV timetable downloaded!", "success");
    }

    function exportJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.data, null, 2));
        const link = document.createElement('a');
        link.href = dataStr;
        link.download = "PICT_Timetable_Backup.json";
        link.click();
        showToast("JSON timetable backup downloaded!", "success");
    }

    function exportExcel() {
        if (typeof XLSX === 'undefined') {
            exportCSV();
            return;
        }

        const wb = XLSX.utils.book_new();
        const schedule = store.data.schedule;
        const days = store.data.days;
        const classes = store.data.classes;
        const teachers = store.data.teachers;
        const rooms = store.data.rooms;

        // Sheet 1: Master Schedule
        const schedRows = [
            ['Division', 'Day', 'Slot', 'Time', 'Session Type', 'Subject Code', 'Subject Name', 'Faculty Name', 'Room', 'Batches']
        ];
        const times = ['10:00-11:00', '11:00-12:00', '12:45-01:45', '01:45-02:45', '03:00-04:00', '04:00-05:00'];
        classes.forEach(c => {
            days.forEach((day, dIdx) => {
                for (let s = 1; s <= 6; s++) {
                    const sess = schedule && schedule[dIdx] && schedule[dIdx][s] ? schedule[dIdx][s][c.id] : null;
                    const slotTime = times[s - 1] || `Slot ${s}`;
                    if (!sess) {
                        schedRows.push([c.name, day, s, slotTime, 'Free', '-', '-', '-', '-', '-']);
                    } else if (sess.type === 'lecture') {
                        schedRows.push([c.name, day, s, slotTime, 'Theory Lecture', sess.subjectCode, sess.subjectName, sess.teacherName, sess.roomNumber, 'Entire Division']);
                    } else if (sess.type === 'lab' && sess.batches) {
                        for (const b in sess.batches) {
                            const bData = sess.batches[b];
                            schedRows.push([c.name, day, s, slotTime, 'Lab Practical', bData.subjectCode, bData.subjectName, bData.teacherName, bData.roomNumber, `Batch ${b}`]);
                        }
                    }
                }
            });
        });
        const wsSched = XLSX.utils.aoa_to_sheet(schedRows);
        XLSX.utils.book_append_sheet(wb, wsSched, 'Master_Schedule');

        // Sheet 2: Faculty Workload
        const teacherRows = [
            ['Faculty ID', 'Faculty Name', 'Designation', 'Max Cap (hrs/week)', 'Scheduled Hours', 'Workload Status', 'Theory Qualified', 'Labs Qualified']
        ];
        teachers.forEach(t => {
            const desig = store.getDesignation(t.designationId);
            const hrs = store.getTeacherScheduledHours(t.id);
            const status = hrs > t.maxHoursPerWeek ? 'Overloaded' : (hrs === t.maxHoursPerWeek ? 'Optimal (100%)' : 'Under Quota');
            teacherRows.push([
                t.id,
                t.name,
                desig ? desig.name : 'Faculty',
                t.maxHoursPerWeek,
                hrs,
                status,
                (t.theorySubjects || []).join(', '),
                (t.labSubjects || []).join(', ')
            ]);
        });
        const wsTeachers = XLSX.utils.aoa_to_sheet(teacherRows);
        XLSX.utils.book_append_sheet(wb, wsTeachers, 'Faculty_Workload');

        // Sheet 3: Divisions & Batches
        const divRows = [
            ['Division ID', 'Division Name', 'Default Classroom', 'Lab Batches', 'Student Capacity']
        ];
        classes.forEach(c => {
            divRows.push([
                c.id,
                c.name,
                c.classroom,
                (c.batches || []).join(', '),
                c.capacity || 75
            ]);
        });
        const wsDivs = XLSX.utils.aoa_to_sheet(divRows);
        XLSX.utils.book_append_sheet(wb, wsDivs, 'Divisions_Batches');

        // Sheet 4: Classrooms & Labs
        const roomRows = [
            ['Room Code', 'Room Name', 'Room Type', 'Computer Lab?', 'Capacity']
        ];
        rooms.forEach(r => {
            roomRows.push([
                r.id,
                r.name,
                r.type.toUpperCase(),
                r.isComputerLab ? 'Yes' : 'No',
                r.capacity
            ]);
        });
        const wsRooms = XLSX.utils.aoa_to_sheet(roomRows);
        XLSX.utils.book_append_sheet(wb, wsRooms, 'Classrooms_Labs');

        XLSX.writeFile(wb, 'PICT_Department_Timetable_Complete.xlsx');
        showToast('Comprehensive Excel workbook (.xlsx) downloaded with all 4 sheets!', 'success');
    }

    // ----------------------------------------------------------------------
    // FACULTY EXCEL IMPORT & TEMPLATE GENERATION
    // ----------------------------------------------------------------------
    function downloadTeacherTemplate() {
        if (typeof XLSX === 'undefined') {
            const csv = 'Faculty Name,Designation,Max Hours,Theory Subjects,Lab Subjects,Faculty ID\n' +
                '"Dr. S. K. Sharma","Professor",14,"DS, DM","DSL","t_33"\n' +
                '"Prof. P. V. Kulkarni","Associate Professor",16,"COA","COAL","t_34"\n' +
                '"Prof. M. R. Deshmukh","Assistant Professor",18,"MDM","MDMT, FLS","t_35"\n' +
                '"Prof. A. N. Joshi","Visiting Faculty",12,"UHV","","t_36"\n';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'Faculty_Load_Template.csv';
            link.click();
            showToast('Faculty CSV template downloaded!', 'success');
            return;
        }

        const wb = XLSX.utils.book_new();
        const headers = ['Faculty Name', 'Designation', 'Max Hours', 'Theory Subjects', 'Lab Subjects', 'Faculty ID'];
        const sampleData = [
            ['Dr. S. K. Sharma', 'Professor', 14, 'DS, DM', 'DSL', 't_33'],
            ['Prof. P. V. Kulkarni', 'Associate Professor', 16, 'COA', 'COAL', 't_34'],
            ['Prof. M. R. Deshmukh', 'Assistant Professor', 18, 'MDM', 'MDMT, FLS', 't_35'],
            ['Prof. A. N. Joshi', 'Visiting Faculty', 12, 'UHV', '', 't_36']
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        ws['!cols'] = [
            { wch: 26 },
            { wch: 22 },
            { wch: 12 },
            { wch: 22 },
            { wch: 22 },
            { wch: 14 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Faculty_Roster');
        XLSX.writeFile(wb, 'Faculty_Roster_Template.xlsx');
        showToast('Faculty Excel template (.xlsx) downloaded!', 'success');
    }

    function handleFacultyFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                let rows = [];

                if (typeof XLSX !== 'undefined') {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                } else {
                    const text = new TextDecoder().decode(data);
                    const lines = text.split(/\r?\n/).filter(Boolean);
                    if (lines.length > 1) {
                        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                        rows = lines.slice(1).map(l => {
                            const cells = l.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                            const obj = {};
                            headers.forEach((h, i) => obj[h] = cells[i] || '');
                            return obj;
                        });
                    }
                }

                if (!rows || rows.length === 0) {
                    showToast('No records found in spreadsheet.', 'error');
                    return;
                }

                currentParsedFacultyList = rows;
                renderExcelPreview(rows);
            } catch (err) {
                console.error('Failed to parse Excel file:', err);
                showToast('Failed to parse spreadsheet file: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function renderExcelPreview(rows) {
        if (!tableExcelPreview || !excelImportPreviewArea) return;
        tableExcelPreview.innerHTML = '';

        let validCount = 0;
        rows.slice(0, 50).forEach(r => {
            const name = r['Faculty Name'] || r['name'] || r['Name'] || r['Teacher Name'] || r['teacher_name'] || '';
            if (!name) return;
            validCount++;

            const desig = r['Designation'] || r['Post'] || r['designation'] || (name.startsWith('Dr.') ? 'Professor' : 'Assistant Professor');
            const hours = r['Max Hours'] || r['Total Load'] || r['total_load'] || r['Hours'] || 18;
            const theory = r['Theory Subjects'] || r['Theory'] || r['theory_subjects'] || '-';
            const labs = r['Lab Subjects'] || r['Labs'] || r['lab_subjects'] || '-';
            const exists = store.data.teachers.some(t => t.name.toLowerCase() === name.toLowerCase());

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${name}</strong></td>
                <td>${desig}</td>
                <td>${hours} hrs</td>
                <td><span style="font-size:0.75rem; color:var(--text-secondary);">${theory}</span></td>
                <td><span style="font-size:0.75rem; color:var(--text-secondary);">${labs}</span></td>
                <td>
                    <span class="badge-tag ${exists ? 'th' : 'lab'}" style="font-size:0.7rem;">
                        ${exists ? 'Existing (Update)' : 'New Faculty'}
                    </span>
                </td>
            `;
            tableExcelPreview.appendChild(tr);
        });

        if (excelParsedCount) {
            excelParsedCount.textContent = rows.length;
        }
        excelImportPreviewArea.style.display = 'flex';
        showToast(`Parsed ${rows.length} rows from spreadsheet! Review and click Confirm.`, 'info');
    }

    // ----------------------------------------------------------------------
    // UTILITIES
    // ----------------------------------------------------------------------
    function showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // Global hooks for inline card clicks
    window.quickAllocate = function(classId, dayIdx, slotIdx, subjectCode = null) {
        openPredictorModal(classId, subjectCode);
    };

    window.quickAllocateSubject = function(subjectCode) {
        openPredictorModal('SE-1', subjectCode);
    };

    // Run
    init();
});
