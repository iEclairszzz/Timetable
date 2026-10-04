/**
 * ChronoDept Timetable Predictor & Allocator - Data Management
 * Pune Institute of Computer Technology - Computer Engineering Dept
 */

const STORAGE_KEY = 'PICT_TIMETABLE_PREDICTOR_DATA_V2';

class DataStore {
    constructor() {
        this.data = this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.subjects && parsed.teachers && parsed.classes && parsed.schedule) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn("Could not read localStorage, falling back to default optimal dataset.", e);
        }
        return this.getDefaultData();
    }

    getDefaultData() {
        if (typeof window.DEFAULT_TIMETABLE_DATA !== 'undefined') {
            return JSON.parse(JSON.stringify(window.DEFAULT_TIMETABLE_DATA));
        }
        return {
            departmentName: "Pune Institute of Computer Technology",
            subTitle: "Department of Computer Engineering (S.Y. 2026-27 Sem-I)",
            academicYear: "2026-27",
            semester: "Semester I",
            days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            timeSlots: [
                { id: 1, name: "Slot 1", time: "10:00 - 11:00", block: 1, isLabStart: true },
                { id: 2, name: "Slot 2", time: "11:00 - 12:00", block: 1, isLabStart: false },
                { id: 3, name: "Slot 3", time: "12:45 - 01:45", block: 2, isLabStart: true },
                { id: 4, name: "Slot 4", time: "01:45 - 02:45", block: 2, isLabStart: false },
                { id: 5, name: "Slot 5", time: "03:00 - 04:00", block: 3, isLabStart: true },
                { id: 6, name: "Slot 6", time: "04:00 - 05:00", block: 3, isLabStart: false }
            ],
            designations: [],
            classes: [],
            subjects: [],
            teachers: [],
            rooms: [],
            schedule: null,
            batchTimetables: null
        };
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("Failed to save to localStorage:", e);
        }
    }

    resetToDefault() {
        this.data = this.getDefaultData();
        this.save();
        return this.data;
    }

    // Accessors
    getSubject(idOrCode) {
        return this.data.subjects.find(s => s.id === idOrCode || s.code === idOrCode);
    }

    getTeacher(idOrName) {
        return this.data.teachers.find(t => t.id === idOrName || t.name === idOrName);
    }

    getClass(id) {
        return this.data.classes.find(c => c.id === id);
    }

    getRoom(idOrName) {
        return this.data.rooms.find(r => r.id === idOrName || r.name === idOrName);
    }

    getDesignation(id) {
        return this.data.designations.find(d => d.id === id);
    }

    /**
     * Add a new division (class)
     */
    addClass({ id, name, classroom, batches = [], capacity = 75 }) {
        if (!id || !String(id).trim()) {
            return { success: false, error: 'Division Code / ID is required (e.g. SE-5, TE-1).' };
        }
        const cleanId = String(id).trim().toUpperCase();
        if (this.getClass(cleanId)) {
            return { success: false, error: `Division "${cleanId}" already exists.` };
        }

        const cleanName = name && String(name).trim() ? String(name).trim() : `Class ${cleanId}`;
        const cleanRoom = classroom && String(classroom).trim() ? String(classroom).trim().toUpperCase() : 'CR-101';

        // Parse batches
        let batchList = [];
        if (Array.isArray(batches)) {
            batchList = batches.map(b => String(b).trim()).filter(Boolean);
        } else if (typeof batches === 'string') {
            batchList = batches.split(',').map(b => b.trim()).filter(Boolean);
        }
        if (batchList.length === 0) {
            const suffix = cleanId.includes('-') ? cleanId.split('-')[1] : cleanId.slice(-1);
            batchList = [`E${suffix}`, `F${suffix}`, `G${suffix}`, `H${suffix}`];
        }
        // Deduplicate batches
        batchList = [...new Set(batchList)];

        const newClass = {
            id: cleanId,
            name: cleanName,
            classroom: cleanRoom,
            batches: batchList,
            capacity: parseInt(capacity) || 75
        };

        this.data.classes.push(newClass);

        // Auto-register classroom if it doesn't already exist in rooms catalog
        if (cleanRoom && !this.getRoom(cleanRoom)) {
            this.addRoom({
                id: cleanRoom,
                name: `Classroom ${cleanRoom}`,
                type: 'classroom',
                isComputerLab: false,
                capacity: parseInt(capacity) || 75
            });
        }

        // Initialize empty slot containers in schedule if needed
        if (this.data.schedule) {
            for (let d = 0; d < 5; d++) {
                if (!this.data.schedule[d]) this.data.schedule[d] = {};
                for (let s = 1; s <= 6; s++) {
                    if (!this.data.schedule[d][s]) this.data.schedule[d][s] = {};
                }
            }
        }

        this.save();
        return { success: true, class: newClass };
    }

    /**
     * Delete a division and clean up its schedule references
     */
    deleteClass(id) {
        const cleanId = String(id).trim().toUpperCase();
        const index = this.data.classes.findIndex(c => c.id === cleanId);
        if (index === -1) {
            return { success: false, error: `Division "${cleanId}" not found.` };
        }

        this.data.classes.splice(index, 1);

        // Remove from active schedule
        if (this.data.schedule) {
            for (let d = 0; d < 5; d++) {
                for (let s = 1; s <= 6; s++) {
                    if (this.data.schedule[d] && this.data.schedule[d][s] && this.data.schedule[d][s][cleanId]) {
                        delete this.data.schedule[d][s][cleanId];
                    }
                }
            }
        }

        this.save();
        return { success: true };
    }

    /**
     * Add a batch to an existing division
     */
    addBatchToClass(classId, batchCode) {
        const cls = this.getClass(classId);
        if (!cls) {
            return { success: false, error: `Division "${classId}" not found.` };
        }
        if (!batchCode || !String(batchCode).trim()) {
            return { success: false, error: 'Batch code is required (e.g. E1, F2, J1).' };
        }
        const cleanBatch = String(batchCode).trim().toUpperCase();
        if (cls.batches.includes(cleanBatch)) {
            return { success: false, error: `Batch "${cleanBatch}" already exists in division ${cls.name}.` };
        }

        cls.batches.push(cleanBatch);
        this.save();
        return { success: true, batch: cleanBatch };
    }

    /**
     * Remove a batch from a division
     */
    removeBatchFromClass(classId, batchCode) {
        const cls = this.getClass(classId);
        if (!cls) {
            return { success: false, error: `Division "${classId}" not found.` };
        }
        const cleanBatch = String(batchCode).trim();
        cls.batches = cls.batches.filter(b => b !== cleanBatch);

        // Clean up from schedule lab slots if present
        if (this.data.schedule) {
            for (let d = 0; d < 5; d++) {
                for (let s = 1; s <= 6; s++) {
                    const sess = this.data.schedule[d] && this.data.schedule[d][s] && this.data.schedule[d][s][cls.id];
                    if (sess && sess.type === 'lab' && sess.batches && sess.batches[cleanBatch]) {
                        delete sess.batches[cleanBatch];
                    }
                }
            }
        }

        this.save();
        return { success: true };
    }

    /**
     * Add a new Classroom or Lab Room
     */
    addRoom({ id, name, type = 'classroom', isComputerLab = false, capacity = 75 }) {
        if (!id || !String(id).trim()) {
            return { success: false, error: 'Room Code / ID is required (e.g. CR-105, CL-8, TR-105).' };
        }
        const cleanId = String(id).trim().toUpperCase();
        if (this.getRoom(cleanId)) {
            return { success: false, error: `Room "${cleanId}" already exists.` };
        }

        const cleanName = name && String(name).trim() ? String(name).trim() : `Room ${cleanId}`;
        const cleanType = ['classroom', 'lab', 'tutorial'].includes(type) ? type : (isComputerLab ? 'lab' : 'classroom');
        const isComp = Boolean(isComputerLab);
        const cap = parseInt(capacity) || (cleanType === 'classroom' ? 75 : 25);

        const newRoom = {
            id: cleanId,
            name: cleanName,
            type: cleanType,
            isComputerLab: isComp,
            capacity: cap
        };

        this.data.rooms.push(newRoom);
        this.save();
        return { success: true, room: newRoom };
    }

    /**
     * Delete a Classroom or Lab Room
     */
    deleteRoom(id) {
        const cleanId = String(id).trim().toUpperCase();
        const index = this.data.rooms.findIndex(r => r.id === cleanId);
        if (index === -1) {
            return { success: false, error: `Room "${cleanId}" not found.` };
        }

        this.data.rooms.splice(index, 1);
        this.save();
        return { success: true };
    }

    /**
     * Add a single faculty member manually
     */
    addTeacher({ id, name, designationId, maxHoursPerWeek, theorySubjects = [], labSubjects = [], assignments = [] }) {
        if (!name || !String(name).trim()) {
            return { success: false, error: 'Faculty name is required (e.g. Dr. S. K. Sharma, Prof. P. V. Kulkarni).' };
        }
        const cleanName = String(name).trim();

        // Check duplicate by name
        if (this.data.teachers.some(t => t.name.toLowerCase() === cleanName.toLowerCase())) {
            return { success: false, error: `Faculty member "${cleanName}" already exists.` };
        }

        // Generate or clean ID
        let cleanId = id && String(id).trim() ? String(id).trim() : '';
        if (!cleanId) {
            let maxIdx = 0;
            this.data.teachers.forEach(t => {
                const match = t.id && t.id.match(/^t_(\d+)$/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxIdx) maxIdx = num;
                }
            });
            cleanId = `t_${String(maxIdx + 1).padStart(2, '0')}`;
        }
        if (this.data.teachers.some(t => t.id === cleanId)) {
            return { success: false, error: `Faculty ID "${cleanId}" already exists.` };
        }

        // Designation
        let desigId = designationId && String(designationId).trim() ? String(designationId).trim() : '';
        if (!desigId || !this.getDesignation(desigId)) {
            if (cleanName.startsWith('Dr.') || cleanName.toLowerCase().includes('dr.')) {
                desigId = 'desig_prof';
            } else if (cleanName.toLowerCase().includes('assoc')) {
                desigId = 'desig_assoc';
            } else {
                desigId = 'desig_asst';
            }
        }

        const desigObj = this.getDesignation(desigId);
        const defaultMaxHours = desigObj ? desigObj.maxHours : 18;
        const cleanMaxHours = (maxHoursPerWeek !== undefined && maxHoursPerWeek !== null && maxHoursPerWeek !== '')
            ? (parseInt(maxHoursPerWeek) || defaultMaxHours)
            : defaultMaxHours;

        // Parse subjects
        const parseSubj = (val) => {
            if (Array.isArray(val)) return val.map(s => String(s).trim().toUpperCase()).filter(Boolean);
            if (typeof val === 'string') return val.split(/[,;\/]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
            return [];
        };

        const cleanTheory = parseSubj(theorySubjects);
        const cleanLab = parseSubj(labSubjects);

        const newTeacher = {
            id: cleanId,
            name: cleanName,
            designationId: desigId,
            maxHoursPerWeek: cleanMaxHours,
            theorySubjects: cleanTheory,
            labSubjects: cleanLab,
            assignments: Array.isArray(assignments) ? assignments : []
        };

        this.data.teachers.push(newTeacher);
        this.save();
        return { success: true, teacher: newTeacher };
    }

    /**
     * Bulk import faculty from parsed Excel or CSV rows
     */
    importTeachers(rawRows, { updateExisting = false } = {}) {
        if (!Array.isArray(rawRows) || rawRows.length === 0) {
            return { success: false, error: 'No data rows found to import.' };
        }

        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const errors = [];

        rawRows.forEach((row, idx) => {
            if (!row || typeof row !== 'object') return;

            // Flexible key finding
            const findVal = (possibleKeys) => {
                for (const k of possibleKeys) {
                    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
                        return row[k];
                    }
                    const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
                        return row[foundKey];
                    }
                }
                return null;
            };

            const rawName = findVal(['name', 'faculty_name', 'teacher_name', 'Teacher Name', 'Faculty Name', 'Name', 'Faculty', 'Teacher', 'teacher', 'faculty']);
            if (!rawName) {
                if (Object.values(row).every(v => v === '' || v === null || v === undefined)) return;
                errors.push(`Row ${idx + 1}: Missing faculty name`);
                return;
            }

            const cleanName = String(rawName).trim();
            const rawId = findVal(['id', 'ID', 'teacher_id', 'faculty_id', 'Teacher ID', 'Faculty ID', 'Code', 'Short Code']);
            const rawDesig = findVal(['designation', 'Designation', 'post', 'Post', 'Role', 'designation_id', 'Designation ID', 'Title']);
            const rawHours = findVal(['max_hours', 'maxHours', 'Max Hours', 'total_load', 'Total Load', 'Hours', 'Weekly Hours', 'Max Load', 'max_hours_per_week', 'Load']);
            const rawTheory = findVal(['theory_subjects', 'theory_subject', 'Theory Subjects', 'Theory', 'Theory Subject', 'Subjects', 'theorySubjects']);
            const rawLabs = findVal(['lab_subjects', 'practical_subject', 'Lab Subjects', 'Labs', 'Practical Subjects', 'Practicals', 'labSubjects', 'Practical']);

            let desigId = 'desig_asst';
            if (rawDesig) {
                const dStr = String(rawDesig).toLowerCase();
                if (dStr.includes('guest') || dStr.includes('visiting') || dStr.includes('adjunct')) desigId = 'desig_guest';
                else if (dStr.includes('assoc')) desigId = 'desig_assoc';
                else if (dStr.includes('prof') && !dStr.includes('asst') && !dStr.includes('assistant')) desigId = 'desig_prof';
                else if (dStr.includes('asst') || dStr.includes('assistant')) desigId = 'desig_asst';
            } else if (cleanName.startsWith('Dr.') || cleanName.toLowerCase().includes('dr.')) {
                desigId = 'desig_prof';
            }

            const desigObj = this.getDesignation(desigId);
            const defaultHours = desigObj ? desigObj.maxHours : 18;
            const cleanHours = rawHours ? (parseInt(rawHours) || defaultHours) : defaultHours;

            const parseSubj = (val) => {
                if (Array.isArray(val)) return val.map(s => String(s).trim().toUpperCase()).filter(Boolean);
                if (typeof val === 'string') return val.split(/[,;\/|]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
                return [];
            };

            const theorySubjs = parseSubj(rawTheory);
            const labSubjs = parseSubj(rawLabs);

            const existing = this.data.teachers.find(t => 
                (rawId && t.id.toLowerCase() === String(rawId).trim().toLowerCase()) ||
                t.name.toLowerCase() === cleanName.toLowerCase()
            );

            if (existing) {
                if (updateExisting) {
                    existing.designationId = desigId;
                    existing.maxHoursPerWeek = cleanHours;
                    if (theorySubjs.length > 0) existing.theorySubjects = [...new Set([...existing.theorySubjects, ...theorySubjs])];
                    if (labSubjs.length > 0) existing.labSubjects = [...new Set([...existing.labSubjects, ...labSubjs])];
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                let cleanId = rawId ? String(rawId).trim() : '';
                if (!cleanId) {
                    let maxIdx = 0;
                    this.data.teachers.forEach(t => {
                        const m = t.id && t.id.match(/^t_(\d+)$/);
                        if (m) {
                            const n = parseInt(m[1], 10);
                            if (n > maxIdx) maxIdx = n;
                        }
                    });
                    cleanId = `t_${String(maxIdx + 1 + addedCount).padStart(2, '0')}`;
                }

                this.data.teachers.push({
                    id: cleanId,
                    name: cleanName,
                    designationId: desigId,
                    maxHoursPerWeek: cleanHours,
                    theorySubjects: theorySubjs,
                    labSubjects: labSubjs,
                    assignments: []
                });
                addedCount++;
            }
        });

        if (addedCount > 0 || updatedCount > 0) {
            this.save();
        }

        return {
            success: true,
            addedCount,
            updatedCount,
            skippedCount,
            totalProcessed: rawRows.length,
            errors
        };
    }

    /**
     * Delete a faculty member
     */
    deleteTeacher(idOrName) {
        const cleanQuery = String(idOrName).trim().toLowerCase();
        const index = this.data.teachers.findIndex(t => 
            t.id.toLowerCase() === cleanQuery || t.name.toLowerCase() === cleanQuery
        );
        if (index === -1) {
            return { success: false, error: `Faculty member "${idOrName}" not found.` };
        }

        const teacher = this.data.teachers[index];
        this.data.teachers.splice(index, 1);
        this.save();
        return { success: true, teacherName: teacher.name };
    }

    /**
     * Compute actual scheduled hours for a teacher from the current timetable
     */
    getTeacherScheduledHours(teacherNameOrId) {
        const teacher = this.getTeacher(teacherNameOrId);
        if (!teacher) return 0;
        const tName = teacher.name;

        let totalHours = 0;
        const schedule = this.data.schedule;
        if (!schedule) return 0;

        for (let d = 0; d < 5; d++) {
            for (let s = 1; s <= 6; s++) {
                const daySlot = schedule[d] && schedule[d][s];
                if (!daySlot) continue;

                for (const classId in daySlot) {
                    const session = daySlot[classId];
                    if (session.type === 'lecture' && (session.teacherName === tName || session.teacherId === teacher.id)) {
                        totalHours += 1;
                    } else if (session.type === 'lab' && session.batches) {
                        for (const bCode in session.batches) {
                            const bData = session.batches[bCode];
                            if (bData.teacherName === tName || bData.teacherId === teacher.id) {
                                totalHours += 1; // 1 hr per slot
                                break; // Don't double count if same teacher teaches multiple parallel in same room
                            }
                        }
                    }
                }
            }
        }
        return totalHours;
    }

    /**
     * Get Subject Allocation Stats across all divisions & batches
     */
    getSubjectAllocationStats(subjectCode) {
        const subj = this.getSubject(subjectCode);
        if (!subj) return { requiredHours: 0, allocatedHours: 0, percentage: 0 };

        const isLab = subj.type === 'lab';
        const schedule = this.data.schedule;
        
        let totalRequired = 0;
        let totalAllocated = 0;

        if (!isLab) {
            // Theory: requiredHours per division
            totalRequired = subj.weeklyHours * this.data.classes.length;
            if (schedule) {
                for (let d = 0; d < 5; d++) {
                    for (let s = 1; s <= 6; s++) {
                        const daySlot = schedule[d] && schedule[d][s];
                        if (!daySlot) continue;
                        for (const classId in daySlot) {
                            const item = daySlot[classId];
                            if (item.type === 'lecture' && item.subjectCode === subjectCode) {
                                totalAllocated += 1;
                            }
                        }
                    }
                }
            }
        } else {
            // Lab / Tutorial: required per batch across all 16 batches
            const totalBatches = this.data.classes.reduce((sum, c) => sum + c.batches.length, 0);
            totalRequired = subj.weeklyHours * totalBatches;

            if (schedule) {
                for (let d = 0; d < 5; d++) {
                    for (let s = 1; s <= 6; s++) {
                        const daySlot = schedule[d] && schedule[d][s];
                        if (!daySlot) continue;
                        for (const classId in daySlot) {
                            const item = daySlot[classId];
                            if (item.type === 'lab' && item.batches) {
                                for (const bCode in item.batches) {
                                    if (item.batches[bCode].subjectCode === subjectCode) {
                                        totalAllocated += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        const percentage = totalRequired > 0 ? Math.min(100, Math.round((totalAllocated / totalRequired) * 100)) : 100;
        return {
            requiredHours: totalRequired,
            allocatedHours: totalAllocated,
            percentage: percentage
        };
    }

    /**
     * Get overall department allocation percentage
     */
    getOverallAllocationProgress() {
        let totalReq = 0;
        let totalAlloc = 0;

        for (const subj of this.data.subjects) {
            const stats = this.getSubjectAllocationStats(subj.code);
            totalReq += stats.requiredHours;
            totalAlloc += stats.allocatedHours;
        }

        return {
            totalRequired: totalReq,
            totalAllocated: totalAlloc,
            percentage: totalReq > 0 ? Math.min(100, Math.round((totalAlloc / totalReq) * 100)) : 100
        };
    }

    /**
     * Clear schedule completely (for manual or clean predictor generation)
     */
    clearSchedule() {
        this.data.schedule = { 0: {}, 1: {}, 2: {}, 3: {}, 4: {} };
        for (let d = 0; d < 5; d++) {
            for (let s = 1; s <= 6; s++) {
                this.data.schedule[d][s] = {};
            }
        }
        this.save();
    }
}

window.dataStore = new DataStore();
