/**
 * ChronoDept Timetable Predictor & Allocator - Constraint Validator & Auditor
 * Real-time detection of schedule conflicts, capacity overages, and break violations.
 */

class TimetableValidator {
    constructor(dataStore) {
        this.store = dataStore;
    }

    /**
     * Validate an individual placement before committing it
     */
    validatePlacement(dayIdx, slotIdx, classId, sessionData) {
        const schedule = this.store.data.schedule;
        const conflicts = [];
        const warnings = [];

        if (!schedule || !schedule[dayIdx] || !schedule[dayIdx][slotIdx]) {
            return { valid: true, conflicts: [], warnings: [] };
        }

        const currentSlotMap = schedule[dayIdx][slotIdx];
        const isLab = sessionData.type === 'lab';

        // 1. Break Boundary Check for 2-hour labs
        if (isLab && sessionData.span === 2) {
            const validLabStarts = [1, 3, 5];
            if (!validLabStarts.includes(slotIdx)) {
                conflicts.push(`2-Hour Labs cannot begin at Slot ${slotIdx} because it would be interrupted by a break. Valid lab start slots are Slot 1 (10:00), Slot 3 (12:45), or Slot 5 (03:00).`);
            }
        }

        // 2. Class conflict check
        if (currentSlotMap[classId]) {
            conflicts.push(`Class ${classId} already has an active session scheduled in this time slot.`);
        }

        // 3. Teacher and Room Conflict Checks
        if (sessionData.type === 'lecture') {
            const tName = sessionData.teacherName;
            const rId = sessionData.roomId;

            // Check if teacher is busy elsewhere in this slot
            for (const otherClassId in currentSlotMap) {
                const otherSession = currentSlotMap[otherClassId];
                if (otherSession.type === 'lecture') {
                    if (otherSession.teacherName === tName) {
                        conflicts.push(`Teacher ${tName} is already teaching lecture "${otherSession.subjectCode}" for ${otherClassId} at this slot.`);
                    }
                    if (otherSession.roomId === rId) {
                        conflicts.push(`Classroom ${rId} is already occupied by ${otherClassId} for lecture "${otherSession.subjectCode}".`);
                    }
                } else if (otherSession.type === 'lab' && otherSession.batches) {
                    for (const bCode in otherSession.batches) {
                        const bItem = otherSession.batches[bCode];
                        if (bItem.teacherName === tName) {
                            conflicts.push(`Teacher ${tName} is already conducting lab "${bItem.subjectCode}" for batch ${bCode} at this slot.`);
                        }
                        if (bItem.roomId === rId) {
                            conflicts.push(`Room ${rId} is already in use by batch ${bCode} for lab "${bItem.subjectCode}".`);
                        }
                    }
                }
            }

            // Check max 1 lecture of same subject per day
            for (let s = 1; s <= 6; s++) {
                const cell = schedule[dayIdx] && schedule[dayIdx][s] && schedule[dayIdx][s][classId];
                if (cell && cell.type === 'lecture' && cell.subjectCode === sessionData.subjectCode) {
                    warnings.push(`Class ${classId} already has a "${sessionData.subjectCode}" lecture scheduled earlier/later on this day.`);
                }
            }
        } else if (sessionData.type === 'lab' && sessionData.batches) {
            // Lab batches check
            for (const bCode in sessionData.batches) {
                const bItem = sessionData.batches[bCode];
                for (const otherClassId in currentSlotMap) {
                    const otherSession = currentSlotMap[otherClassId];
                    if (otherSession.type === 'lecture') {
                        if (otherSession.teacherName === bItem.teacherName) {
                            conflicts.push(`Teacher ${bItem.teacherName} (assigned to ${bCode}) is already teaching ${otherClassId}.`);
                        }
                        if (otherSession.roomId === bItem.roomId) {
                            conflicts.push(`Room ${bItem.roomId} (assigned to ${bCode}) is occupied by ${otherClassId}.`);
                        }
                    } else if (otherSession.type === 'lab' && otherSession.batches) {
                        for (const obCode in otherSession.batches) {
                            const obItem = otherSession.batches[obCode];
                            if (obItem.teacherName === bItem.teacherName) {
                                conflicts.push(`Teacher ${bItem.teacherName} is double-booked between batch ${bCode} and batch ${obCode}.`);
                            }
                            if (obItem.roomId === bItem.roomId) {
                                conflicts.push(`Lab room ${bItem.roomId} is double-booked between batch ${bCode} and batch ${obCode}.`);
                            }
                        }
                    }
                }
            }

            // Computer Lab limit check (Max 7 Computer Labs across department)
            let compLabsInSlot = 0;
            for (const cId in currentSlotMap) {
                const sess = currentSlotMap[cId];
                if (sess.type === 'lab' && sess.batches) {
                    for (const bCode in sess.batches) {
                        if (['DSL', 'COAL'].includes(sess.batches[bCode].subjectCode)) {
                            compLabsInSlot++;
                        }
                    }
                }
            }
            let newCompLabs = 0;
            for (const bCode in sessionData.batches) {
                if (['DSL', 'COAL'].includes(sessionData.batches[bCode].subjectCode)) {
                    newCompLabs++;
                }
            }
            if (compLabsInSlot + newCompLabs > 7) {
                conflicts.push(`Exceeds maximum Computer Lab capacity! Slot already has ${compLabsInSlot} active computer labs; adding ${newCompLabs} would exceed the department limit of 7 computer labs.`);
            }
        }

        return {
            valid: conflicts.length === 0,
            conflicts,
            warnings
        };
    }

    /**
     * Comprehensive department-wide audit of all timetable constraints
     */
    runFullAudit() {
        const data = this.store.data;
        const schedule = data.schedule;

        const results = {
            totalSessionsChecked: 0,
            teacherConflicts: [],
            roomConflicts: [],
            computerLabCapacityViolations: [],
            breakSplittingErrors: [],
            workloadOverages: [],
            unallocatedSubjects: []
        };

        if (!schedule) {
            return {
                valid: false,
                totalIssues: 1,
                issues: ['No timetable schedule generated yet.'],
                results
            };
        }

        const days = data.days;

        // 1. Slot-by-slot resource contention checks
        for (let d = 0; d < 5; d++) {
            for (let s = 1; s <= 6; s++) {
                const daySlot = schedule[d] && schedule[d][s];
                if (!daySlot) continue;

                const teachersInSlot = new Map(); // teacherName -> [ { classId, subject, room } ]
                const roomsInSlot = new Map();     // roomId -> [ { classId, subject, teacher } ]
                let compLabsCount = 0;

                for (const classId in daySlot) {
                    const session = daySlot[classId];
                    results.totalSessionsChecked++;

                    if (session.type === 'lecture') {
                        // Teacher tracking
                        const tName = session.teacherName;
                        if (!teachersInSlot.has(tName)) teachersInSlot.set(tName, []);
                        teachersInSlot.get(tName).push({ classId, subject: session.subjectCode, room: session.roomNumber });

                        // Room tracking
                        const rId = session.roomId;
                        if (!roomsInSlot.has(rId)) roomsInSlot.set(rId, []);
                        roomsInSlot.get(rId).push({ classId, subject: session.subjectCode, teacher: tName });

                    } else if (session.type === 'lab' && session.batches) {
                        for (const bCode in session.batches) {
                            const bItem = session.batches[bCode];
                            const tName = bItem.teacherName;
                            const rId = bItem.roomId;

                            if (['DSL', 'COAL'].includes(bItem.subjectCode)) {
                                compLabsCount++;
                            }

                            if (!teachersInSlot.has(tName)) teachersInSlot.set(tName, []);
                            teachersInSlot.get(tName).push({ classId: `${classId} (${bCode})`, subject: bItem.subjectCode, room: rId });

                            if (!roomsInSlot.has(rId)) roomsInSlot.set(rId, []);
                            roomsInSlot.get(rId).push({ classId: `${classId} (${bCode})`, subject: bItem.subjectCode, teacher: tName });
                        }
                    }
                }

                // Identify teacher overlaps
                for (const [tName, bookings] of teachersInSlot.entries()) {
                    if (bookings.length > 1) {
                        results.teacherConflicts.push({
                            day: days[d],
                            slot: s,
                            teacher: tName,
                            message: `Teacher "${tName}" is double-booked on ${days[d]} at Slot ${s} across: ${bookings.map(b => `${b.classId} (${b.subject})`).join(', ')}.`
                        });
                    }
                }

                // Identify room overlaps
                for (const [rId, bookings] of roomsInSlot.entries()) {
                    if (bookings.length > 1) {
                        results.roomConflicts.push({
                            day: days[d],
                            slot: s,
                            room: rId,
                            message: `Room "${rId}" is double-booked on ${days[d]} at Slot ${s} by: ${bookings.map(b => `${b.classId} (${b.subject})`).join(', ')}.`
                        });
                    }
                }

                // Computer lab limit check (<= 7)
                if (compLabsCount > 7) {
                    results.computerLabCapacityViolations.push({
                        day: days[d],
                        slot: s,
                        count: compLabsCount,
                        message: `Computer Lab capacity exceeded on ${days[d]} Slot ${s}: ${compLabsCount} simultaneous computer labs active (Max allowed: 7).`
                    });
                }
            }
        }

        // 2. Check Teacher Workload Quotas
        for (const teacher of data.teachers) {
            const scheduledHours = this.store.getTeacherScheduledHours(teacher.id);
            const maxAllowed = teacher.maxHoursPerWeek || 18;
            if (scheduledHours > maxAllowed) {
                results.workloadOverages.push({
                    teacher: teacher.name,
                    scheduled: scheduledHours,
                    max: maxAllowed,
                    message: `Teacher "${teacher.name}" is scheduled for ${scheduledHours} hrs/week, exceeding workload cap of ${maxAllowed} hrs/week.`
                });
            }
        }

        // 3. Check Subject Allocation Deficits
        for (const subj of data.subjects) {
            const stats = this.store.getSubjectAllocationStats(subj.code);
            if (stats.allocatedHours < stats.requiredHours) {
                results.unallocatedSubjects.push({
                    subject: subj.name,
                    code: subj.code,
                    allocated: stats.allocatedHours,
                    required: stats.requiredHours,
                    deficit: stats.requiredHours - stats.allocatedHours,
                    message: `Subject "${subj.code} - ${subj.name}" is under-allocated (${stats.allocatedHours}/${stats.requiredHours} hours). Missing ${stats.requiredHours - stats.allocatedHours} hours.`
                });
            }
        }

        const totalIssues = results.teacherConflicts.length +
                            results.roomConflicts.length +
                            results.computerLabCapacityViolations.length +
                            results.breakSplittingErrors.length +
                            results.workloadOverages.length +
                            results.unallocatedSubjects.length;

        return {
            valid: totalIssues === 0,
            totalIssues,
            results
        };
    }
}

window.TimetableValidator = TimetableValidator;
