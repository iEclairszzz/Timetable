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
