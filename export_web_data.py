import json
import os
import pandas as pd
from timetable_solver import TimetableSolver
from docx_parser import LoadAllocationParser

def generate_web_data():
    solver = TimetableSolver('subjects.csv', 'load_allocation_se_2026_27.csv')
    solution = solver.solve()
    if not solution:
        print("Error: Could not solve timetable.")
        return

    # Parse subjects
    df_subj = pd.read_csv('subjects.csv')
    subjects = []
    for _, row in df_subj.iterrows():
        code = str(row['subject_code']).strip()
        stype = 'lab' if str(row['type']).strip() == 'Lab' or code == 'MDMT' else 'lecture'
        subjects.append({
            'id': str(row['subject_id']).strip(),
            'code': code,
            'name': str(row['subject_name']).strip(),
            'type': stype,
            'weeklyHours': int(row['weekly_hours']),
            'roomType': 'lab' if stype == 'lab' else 'classroom',
            'isComputerLab': code in ['DSL', 'COAL']
        })

    # Parse teachers
    parser = LoadAllocationParser('load_allocation_se_2026_27.csv')
    teachers_raw = parser.parse()
    teachers = []
    t_id_map = {}
    
    # Designations
    designations = [
        {'id': 'desig_prof', 'name': 'Professor', 'maxHours': 14},
        {'id': 'desig_assoc', 'name': 'Associate Professor', 'maxHours': 16},
        {'id': 'desig_asst', 'name': 'Assistant Professor', 'maxHours': 18},
        {'id': 'desig_guest', 'name': 'Visiting Faculty', 'maxHours': 12}
    ]

    for idx, (t_name, t_data) in enumerate(teachers_raw.items(), 1):
        t_id = f"t_{idx:02d}"
        t_id_map[t_name] = t_id
        
        # Determine designation based on title or load
        desig_id = 'desig_asst'
        if t_name.startswith('Dr.'):
            desig_id = 'desig_prof' if t_data['total_load'] <= 14 else 'desig_assoc'
        
        teachers.append({
            'id': t_id,
            'name': t_name,
            'designationId': desig_id,
            'maxHoursPerWeek': t_data['total_load'],
            'theorySubjects': list(t_data['theory_subjects']),
            'labSubjects': list(t_data['lab_subjects']),
            'assignments': t_data['assignments']
        })

    # Divisions & Batches
    classes = [
        {
            'id': 'SE-1',
            'name': 'SE Computer 1',
            'classroom': 'CR-101',
            'batches': ['E1', 'F1', 'G1', 'H1']
        },
        {
            'id': 'SE-2',
            'name': 'SE Computer 2',
            'classroom': 'CR-102',
            'batches': ['E2', 'F2', 'G2', 'H2']
        },
        {
            'id': 'SE-3',
            'name': 'SE Computer 3',
            'classroom': 'CR-103',
            'batches': ['E3', 'F3', 'G3', 'H3']
        },
        {
            'id': 'SE-4',
            'name': 'SE Computer 4',
            'classroom': 'CR-104',
            'batches': ['E4', 'F4', 'G4', 'H4']
        }
    ]

    # Rooms
    rooms = [
        {'id': 'CR-101', 'name': 'Classroom 101', 'type': 'classroom', 'capacity': 75},
        {'id': 'CR-102', 'name': 'Classroom 102', 'type': 'classroom', 'capacity': 75},
        {'id': 'CR-103', 'name': 'Classroom 103', 'type': 'classroom', 'capacity': 75},
        {'id': 'CR-104', 'name': 'Classroom 104', 'type': 'classroom', 'capacity': 75},
        
        {'id': 'CL-1', 'name': 'Computer Lab 1 (A-201)', 'type': 'lab', 'isComputerLab': True, 'capacity': 25},
        {'id': 'CL-2', 'name': 'Computer Lab 2 (A-202)', 'type': 'lab', 'isComputerLab': True, 'capacity': 25},
        {'id': 'CL-3', 'name': 'Computer Lab 3 (A-203)', 'type': 'lab', 'isComputerLab': True, 'capacity': 25},
        {'id': 'CL-4', 'name': 'Computer Lab 4 (A-204)', 'type': 'lab', 'isComputerLab': True, 'capacity': 25},
        {'id': 'CL-5', 'name': 'Computer Lab 5 (A-205)', 'type': 'lab', 'isComputerLab': True, 'capacity': 25},
        {'id': 'CL-6', 'name': 'Computer Lab 6 (A-206)', 'type': 'lab', 'isComputerLab': True, 'capacity': 25},
        {'id': 'CL-7', 'name': 'Computer Lab 7 (A-207)', 'type': 'lab', 'isComputerLab': True, 'capacity': 25},
        
        {'id': 'LAB-FLS-1', 'name': 'Linux Systems Lab 1', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-FLS-2', 'name': 'Linux Systems Lab 2', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-FLS-3', 'name': 'Linux Systems Lab 3', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-FLS-4', 'name': 'Linux Systems Lab 4', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},

        {'id': 'LAB-CEP-1', 'name': 'Hardware & Practice Lab 1', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-CEP-2', 'name': 'Hardware & Practice Lab 2', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-CEP-3', 'name': 'Hardware & Practice Lab 3', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-CEP-4', 'name': 'Hardware & Practice Lab 4', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},

        {'id': 'LAB-PDCR-1', 'name': 'Language & Comm Lab 1', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-PDCR-2', 'name': 'Language & Comm Lab 2', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-PDCR-3', 'name': 'Language & Comm Lab 3', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'LAB-PDCR-4', 'name': 'Language & Comm Lab 4', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},

        {'id': 'TR-101', 'name': 'Tutorial Room 101', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'TR-102', 'name': 'Tutorial Room 102', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'TR-103', 'name': 'Tutorial Room 103', 'type': 'lab', 'isComputerLab': False, 'capacity': 25},
        {'id': 'TR-104', 'name': 'Tutorial Room 104', 'type': 'lab', 'isComputerLab': False, 'capacity': 25}
    ]

    timeSlots = [
        {'id': 1, 'name': 'Slot 1', 'time': '10:00 - 11:00', 'block': 1, 'isLabStart': True},
        {'id': 2, 'name': 'Slot 2', 'time': '11:00 - 12:00', 'block': 1, 'isLabStart': False},
        # Lunch Break: 12:00 - 12:45
        {'id': 3, 'name': 'Slot 3', 'time': '12:45 - 01:45', 'block': 2, 'isLabStart': True},
        {'id': 4, 'name': 'Slot 4', 'time': '01:45 - 02:45', 'block': 2, 'isLabStart': False},
        # Short Break: 02:45 - 03:00
        {'id': 5, 'name': 'Slot 5', 'time': '03:00 - 04:00', 'block': 3, 'isLabStart': True},
        {'id': 6, 'name': 'Slot 6', 'time': '04:00 - 05:00', 'block': 3, 'isLabStart': False}
    ]

    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

    # Dynamically assign rooms without collision
    # For DSL/COAL: CL-1 to CL-7
    # For CEP: LAB-CEP-1 to LAB-CEP-5
    # For FLS: LAB-FLS-1 to LAB-FLS-5
    # For PDCR: LAB-PDCR-1 to LAB-PDCR-5
    # For MDMT: TR-101 to TR-105

    all_rooms_catalog = [
        {'id': 'CR-101', 'name': 'Classroom 101', 'type': 'classroom', 'capacity': 75},
        {'id': 'CR-102', 'name': 'Classroom 102', 'type': 'classroom', 'capacity': 75},
        {'id': 'CR-103', 'name': 'Classroom 103', 'type': 'classroom', 'capacity': 75},
        {'id': 'CR-104', 'name': 'Classroom 104', 'type': 'classroom', 'capacity': 75},
    ]
    for i in range(1, 8):
        all_rooms_catalog.append({'id': f'CL-{i}', 'name': f'Computer Lab {i}', 'type': 'lab', 'isComputerLab': True, 'capacity': 25})
    for i in range(1, 6):
        all_rooms_catalog.append({'id': f'LAB-CEP-{i}', 'name': f'Hardware & Practice Lab {i}', 'type': 'lab', 'isComputerLab': False, 'capacity': 25})
        all_rooms_catalog.append({'id': f'LAB-FLS-{i}', 'name': f'Linux Systems Lab {i}', 'type': 'lab', 'isComputerLab': False, 'capacity': 25})
        all_rooms_catalog.append({'id': f'LAB-PDCR-{i}', 'name': f'Language & Comm Lab {i}', 'type': 'lab', 'isComputerLab': False, 'capacity': 25})
        all_rooms_catalog.append({'id': f'TR-10{i}', 'name': f'Tutorial Room 10{i}', 'type': 'lab', 'isComputerLab': False, 'capacity': 25})

    rooms = all_rooms_catalog

    div_timetables = solution['division_timetables']
    batch_timetables = solution['batch_timetables']
    schedule = {d: {s: {} for s in range(1, 7)} for d in range(5)}
    occupied_rooms = {d: {s: set() for s in range(1, 7)} for d in range(5)}
    lab_block_room_cache = {}

    for d_idx, day in enumerate(days):
        for s_idx, slot_str in enumerate(solver.SLOTS, 1):
            for div in solver.divisions:
                cell = div_timetables[div][day][slot_str]
                if cell['type'] == 'Theory':
                    th_room = 'CR-101' if div == 'SE-1' else ('CR-102' if div == 'SE-2' else ('CR-103' if div == 'SE-3' else 'CR-104'))
                    schedule[d_idx][s_idx][div] = {
                        'type': 'lecture',
                        'subjectCode': cell['subject_code'],
                        'subjectName': cell['subject_name'],
                        'classId': div,
                        'className': div,
                        'teacherName': cell['teacher'],
                        'teacherId': t_id_map.get(cell['teacher'], ''),
                        'roomId': th_room,
                        'roomNumber': th_room,
                        'span': 1
                    }
                    occupied_rooms[d_idx][s_idx].add(th_room)
                elif cell['type'] == 'Parallel_Labs':
                    batch_details = {}
                    for b_code, b_item in cell['batches'].items():
                        subj_code = b_item['subject_code']
                        
                        # Determine category room pool
                        if subj_code in ['DSL', 'COAL']:
                            room_pool = [f'CL-{i}' for i in range(1, 8)]
                        elif subj_code == 'FLS':
                            room_pool = [f'LAB-FLS-{i}' for i in range(1, 6)]
                        elif subj_code == 'CEP':
                            room_pool = [f'LAB-CEP-{i}' for i in range(1, 6)]
                        elif subj_code == 'PDCR':
                            room_pool = [f'LAB-PDCR-{i}' for i in range(1, 6)]
                        else:
                            room_pool = [f'TR-10{i}' for i in range(1, 6)]

                        # Check if cached from continuation of 2-hr block
                        cache_key = (d_idx, div, b_code, subj_code)
                        assigned_room = None
                        if s_idx in [2, 4, 6] and cache_key in lab_block_room_cache:
                            assigned_room = lab_block_room_cache[cache_key]
                        else:
                            for cand in room_pool:
                                if cand not in occupied_rooms[d_idx][s_idx]:
                                    assigned_room = cand
                                    break
                            if not assigned_room:
                                assigned_room = room_pool[0]
                            if s_idx in [1, 3, 5]:
                                lab_block_room_cache[cache_key] = assigned_room

                        occupied_rooms[d_idx][s_idx].add(assigned_room)

                        batch_details[b_code] = {
                            'batchCode': b_code,
                            'subjectCode': subj_code,
                            'subjectName': b_item['subject_name'],
                            'teacherName': b_item['teacher'],
                            'teacherId': t_id_map.get(b_item['teacher'], ''),
                            'roomId': assigned_room,
                            'roomNumber': assigned_room,
                            'type': 'tutorial' if subj_code == 'MDMT' else 'lab'
                        }

                    schedule[d_idx][s_idx][div] = {
                        'type': 'lab',
                        'classId': div,
                        'className': div,
                        'batches': batch_details,
                        'span': 1
                    }

    data_payload = {
        'departmentName': 'Pune Institute of Computer Technology',
        'subTitle': 'Department of Computer Engineering (S.Y. 2026-27 Sem-I)',
        'academicYear': '2026-27',
        'semester': 'Semester I',
        'days': days,
        'timeSlots': timeSlots,
        'designations': designations,
        'classes': classes,
        'subjects': subjects,
        'teachers': teachers,
        'rooms': rooms,
        'schedule': schedule,
        'batchTimetables': batch_timetables
    }

    os.makedirs('js', exist_ok=True)
    with open('js/default_data.js', 'w', encoding='utf-8') as f:
        f.write("/**\n * Pre-computed Optimal S.Y. 2026-27 Computer Engineering Timetable Data\n * Pune Institute of Computer Technology\n */\n\n")
        f.write("window.DEFAULT_TIMETABLE_DATA = " + json.dumps(data_payload, indent=2) + ";\n")

    with open('timetable_data.json', 'w', encoding='utf-8') as f:
        json.dump(data_payload, f, indent=2)

    print("Successfully exported web data to js/default_data.js and timetable_data.json!")

if __name__ == '__main__':
    generate_web_data()
