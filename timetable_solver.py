import json
import os
import pandas as pd
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from ortools.sat.python import cp_model
from docx_parser import LoadAllocationParser

class TimetableSolver:
    """
    Constraint Programming Timetable Solver for SE Computer Engineering (4 Divisions, 16 Batches).
    Enforces timing rules, lab block alignments, teacher load caps, no teacher overlaps,
    and the 7 Computer Lab capacity constraint for DSL/COAL.
    """
    DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    SLOTS = [
        '10:00-11:00', '11:00-12:00',
        '12:45-01:45', '01:45-02:45',
        '03:00-04:00', '04:00-05:00'
    ]
    
    # 2-hour lab start slots: 0 (10:00-12:00), 2 (12:45-02:45), 4 (03:00-05:00)
    LAB_START_SLOTS = [0, 2, 4]

    def __init__(self, subjects_csv='subjects.csv', load_allocation_file='load_allocation_se_2026_27.csv'):
        self.subjects_csv = subjects_csv
        self.load_allocation_file = load_allocation_file
        
        self.divisions = ['SE-1', 'SE-2', 'SE-3', 'SE-4']
        self.batch_names = ['E', 'F', 'G', 'H']
        
        self.subjects = {} # code -> {name, type, hours}
        self.teachers = {} # teacher_name -> details
        self.specific_assignments = {} # (type, subject, class/batch) -> teacher_name
        
        self._load_inputs()

    def _load_inputs(self):
        # 1. Load Subjects
        df_subj = pd.read_csv(self.subjects_csv)
        for _, row in df_subj.iterrows():
            code = str(row['subject_code']).strip()
            self.subjects[code] = {
                'id': str(row['subject_id']),
                'name': str(row['subject_name']),
                'type': str(row['type']).strip(),
                'hours': int(row['weekly_hours'])
            }
            
        # 2. Parse Teacher Load Allocation
        parser = LoadAllocationParser(self.load_allocation_file)
        self.teachers = parser.parse()

        # Build specific teacher assignment mapping if provided in load allocation file
        for t_name, t_data in self.teachers.items():
            for assign in t_data['assignments']:
                a_type = assign['type']
                a_subj = assign['subject']
                a_cls = assign['class'].strip()
                if a_cls:
                    self.specific_assignments[(a_type, a_subj, a_cls)] = t_name

    def solve(self):
        model = cp_model.CpModel()

        theory_vars = {}
        lab_vars = {}

        theory_subjs = [code for code, data in self.subjects.items() if data['type'] == 'Theory' and code != 'MDMT']
        lab_subjs = [code for code, data in self.subjects.items() if data['type'] == 'Lab']
        if 'MDMT' in self.subjects:
            lab_subjs.append('MDMT')

        num_days = len(self.DAYS)
        num_slots = len(self.SLOTS)

        # 1. Decision Variables for Theory
        for div in self.divisions:
            for code in theory_subjs:
                for d_idx in range(num_days):
                    for s_idx in range(num_slots):
                        specific_key = ('theory', code, div)
                        if specific_key in self.specific_assignments:
                            candidate_teachers = [self.specific_assignments[specific_key]]
                        else:
                            candidate_teachers = [t for t, d in self.teachers.items() if code in d['theory_subjects']]

                        for t_name in candidate_teachers:
                            var_name = f"th_{div}_{code}_d{d_idx}_s{s_idx}_{t_name}"
                            theory_vars[(div, code, d_idx, s_idx, t_name)] = model.NewBoolVar(var_name)

        # 2. Decision Variables for Labs & Tutorials
        for div in self.divisions:
            div_num = div.split('-')[1]
            for b in self.batch_names:
                batch_code = f"{div} ({b}{div_num})" # e.g. SE-1 (E1)
                for code in lab_subjs:
                    for d_idx in range(num_days):
                        for s_idx in self.LAB_START_SLOTS:
                            specific_key = ('lab', code, batch_code)
                            if specific_key in self.specific_assignments:
                                candidate_teachers = [self.specific_assignments[specific_key]]
                            else:
                                candidate_teachers = [t for t, d in self.teachers.items() if code in d['lab_subjects']]

                            for t_name in candidate_teachers:
                                var_name = f"lab_{div}_{b}_{code}_d{d_idx}_s{s_idx}_{t_name}"
                                lab_vars[(div, b, code, d_idx, s_idx, t_name)] = model.NewBoolVar(var_name)

        # --- CONSTRAINTS ---

        # Constraint 1: Theory Subject Weekly Hours
        for div in self.divisions:
            for code in theory_subjs:
                req_hours = self.subjects[code]['hours']
                model.Add(
                    sum(
                        theory_vars[(div, code, d_idx, s_idx, t_name)]
                        for d_idx in range(num_days)
                        for s_idx in range(num_slots)
                        for t_name in self.teachers
                        if (div, code, d_idx, s_idx, t_name) in theory_vars
                    ) == req_hours
                )

        # Constraint 2: Lab & Tutorial Weekly Sessions per Batch
        for div in self.divisions:
            for b in self.batch_names:
                for code in lab_subjs:
                    if code == 'MDMT':
                        req_sessions = 1 # 1 hr tutorial
                    elif code == 'DSL':
                        req_sessions = 2 # 4 hrs = 2 sessions of 2 hrs
                    else:
                        req_sessions = 1 # 2 hrs = 1 session of 2 hrs

                    model.Add(
                        sum(
                            lab_vars[(div, b, code, d_idx, s_idx, t_name)]
                            for d_idx in range(num_days)
                            for s_idx in self.LAB_START_SLOTS
                            for t_name in self.teachers
                            if (div, b, code, d_idx, s_idx, t_name) in lab_vars
                        ) == req_sessions
                    )

        # Constraint 3: Batch Non-Overlap
        for div in self.divisions:
            for b in self.batch_names:
                for d_idx in range(num_days):
                    for s_idx in range(num_slots):
                        active_items = []
                        for code in theory_subjs:
                            for t_name in self.teachers:
                                if (div, code, d_idx, s_idx, t_name) in theory_vars:
                                    active_items.append(theory_vars[(div, code, d_idx, s_idx, t_name)])
                        
                        for code in lab_subjs:
                            for start_s in self.LAB_START_SLOTS:
                                covers = [start_s, start_s + 1] if code != 'MDMT' else [start_s]
                                if s_idx in covers:
                                    for t_name in self.teachers:
                                        if (div, b, code, d_idx, start_s, t_name) in lab_vars:
                                            active_items.append(lab_vars[(div, b, code, d_idx, start_s, t_name)])

                        model.Add(sum(active_items) <= 1)

        # Constraint 4: Teacher Non-Overlap
        for t_name in self.teachers:
            for d_idx in range(num_days):
                for s_idx in range(num_slots):
                    t_active = []
                    for div in self.divisions:
                        for code in theory_subjs:
                            if (div, code, d_idx, s_idx, t_name) in theory_vars:
                                t_active.append(theory_vars[(div, code, d_idx, s_idx, t_name)])
                                
                    for div in self.divisions:
                        for b in self.batch_names:
                            for code in lab_subjs:
                                for start_s in self.LAB_START_SLOTS:
                                    covers = [start_s, start_s + 1] if code != 'MDMT' else [start_s]
                                    if s_idx in covers:
                                        if (div, b, code, d_idx, start_s, t_name) in lab_vars:
                                            t_active.append(lab_vars[(div, b, code, d_idx, start_s, t_name)])

                    model.Add(sum(t_active) <= 1)

        # Constraint 5: Teacher Max Weekly Load Limit
        for t_name, t_data in self.teachers.items():
            max_load = t_data['total_load']
            t_total_hrs = []
            
            for key, var in theory_vars.items():
                if key[4] == t_name:
                    t_total_hrs.append(var * 1)
                    
            for key, var in lab_vars.items():
                if key[5] == t_name:
                    hrs = 1 if key[2] == 'MDMT' else 2
                    t_total_hrs.append(var * hrs)
            
            if t_total_hrs:
                model.Add(sum(t_total_hrs) <= max_load)

        # Constraint 6: Daily Max 1 Theory Lecture per Subject per Division
        for div in self.divisions:
            for code in theory_subjs:
                for d_idx in range(num_days):
                    model.Add(
                        sum(
                            theory_vars[(div, code, d_idx, s_idx, t_name)]
                            for s_idx in range(num_slots)
                            for t_name in self.teachers
                            if (div, code, d_idx, s_idx, t_name) in theory_vars
                        ) <= 1
                    )

        # Constraint 7: Computer Lab Capacity Constraint (Max 7 Computer Labs per slot across all 4 divisions)
        for d_idx in range(num_days):
            for start_s in self.LAB_START_SLOTS:
                comp_lab_sessions = []
                for div in self.divisions:
                    for b in self.batch_names:
                        for code in ['DSL', 'COAL']:
                            for t_name in self.teachers:
                                if (div, b, code, d_idx, start_s, t_name) in lab_vars:
                                    comp_lab_sessions.append(lab_vars[(div, b, code, d_idx, start_s, t_name)])
                model.Add(sum(comp_lab_sessions) <= 7)

        # Objective: Balance lab placement and prefer smooth distribution
        obj_terms = []
        for key, var in lab_vars.items():
            d_idx = key[3]
            obj_terms.append(var * (10 - d_idx))
        model.Maximize(sum(obj_terms))

        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30.0
        status = solver.Solve(model)

        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            print(f"CP-SAT Solver Status: {solver.StatusName(status)}")
            return self._format_solution(solver, theory_vars, lab_vars)
        else:
            print("No valid solution found under constraints.")
            return None

    def _format_solution(self, solver, theory_vars, lab_vars):
        timetable = {div: {day: {slot: {'type': 'FREE', 'details': None} for slot in self.SLOTS} for day in self.DAYS} for div in self.divisions}
        batch_timetables = {div: {b: {day: {slot: {'type': 'FREE', 'details': None} for slot in self.SLOTS} for day in self.DAYS} for b in self.batch_names} for div in self.divisions}

        # Extract Theory
        for (div, code, d_idx, s_idx, t_name), var in theory_vars.items():
            if solver.Value(var) == 1:
                day_name = self.DAYS[d_idx]
                slot_name = self.SLOTS[s_idx]
                subj_name = self.subjects[code]['name']
                
                details = {
                    'type': 'Theory',
                    'subject_code': code,
                    'subject_name': subj_name,
                    'teacher': t_name,
                    'batch': 'ALL'
                }
                timetable[div][day_name][slot_name] = details
                for b in self.batch_names:
                    batch_timetables[div][b][day_name][slot_name] = details

        # Extract Labs
        for (div, b, code, d_idx, start_s, t_name), var in lab_vars.items():
            if solver.Value(var) == 1:
                day_name = self.DAYS[d_idx]
                subj_name = self.subjects[code]['name']
                duration = 1 if code == 'MDMT' else 2
                
                div_num = div.split('-')[1]
                b_code = f"{b}{div_num}"
                
                for offset in range(duration):
                    s_idx = start_s + offset
                    slot_name = self.SLOTS[s_idx]
                    
                    details = {
                        'type': 'Lab' if code != 'MDMT' else 'Tutorial',
                        'subject_code': code,
                        'subject_name': subj_name,
                        'teacher': t_name,
                        'batch': b_code
                    }
                    
                    batch_timetables[div][b][day_name][slot_name] = details
                    
                    div_cell = timetable[div][day_name][slot_name]
                    if div_cell['type'] == 'FREE':
                        timetable[div][day_name][slot_name] = {
                            'type': 'Parallel_Labs',
                            'batches': {b_code: details}
                        }
                    elif div_cell['type'] == 'Parallel_Labs':
                        div_cell['batches'][b_code] = details

        return {
            'division_timetables': timetable,
            'batch_timetables': batch_timetables
        }

    def print_ascii_table(self, solution):
        div_tt = solution['division_timetables']
        for div in self.divisions:
            print(f"\n==========================================================================================")
            print(f"                                CLASS TIMETABLE: {div}")
            print(f"==========================================================================================")
            header = f"{'Time Slot':15s} | " + " | ".join([f"{d:14s}" for d in self.DAYS])
            print(header)
            print("-" * len(header))
            
            for s_idx, slot in enumerate(self.SLOTS):
                row_str = f"{slot:15s} | "
                day_cells = []
                for day in self.DAYS:
                    cell = div_tt[div][day][slot]
                    if cell['type'] == 'Theory':
                        val = f"{cell['subject_code']} ({cell['teacher'].split()[-1]})"
                    elif cell['type'] == 'Parallel_Labs':
                        b_list = list(cell['batches'].keys())
                        subjs = set(b['subject_code'] for b in cell['batches'].values())
                        val = f"Labs: {','.join(subjs)} ({len(b_list)}b)"
                    else:
                        val = "---"
                    day_cells.append(f"{val:14s}")
                print(row_str + " | ".join(day_cells))
            print("-" * len(header))

    def export_excel(self, solution, output_path='SE_Timetable_2026_27.xlsx'):
        writer = pd.ExcelWriter(output_path, engine='openpyxl')
        div_tt = solution['division_timetables']
        
        for div in self.divisions:
            rows = []
            for slot in self.SLOTS:
                r = {'Time Slot': slot}
                for day in self.DAYS:
                    cell = div_tt[div][day][slot]
                    if cell['type'] == 'Theory':
                        r[day] = f"{cell['subject_code']} ({cell['teacher']})"
                    elif cell['type'] == 'Parallel_Labs':
                        lines = [f"{info['subject_code']} {b_code}: {info['teacher']}" for b_code, info in cell['batches'].items()]
                        r[day] = "\n".join(lines)
                    else:
                        r[day] = "---"
                rows.append(r)
            df_div = pd.DataFrame(rows)
            df_div.to_excel(writer, sheet_name=div, index=False)

        writer.close()
        print(f"Exported Excel timetable to {output_path}")

    def export_docx(self, solution, output_path='SE_Timetable_2026_27.docx'):
        doc = docx.Document()
        sections = doc.sections
        for section in sections:
            section.top_margin = Inches(0.5)
            section.bottom_margin = Inches(0.5)
            section.left_margin = Inches(0.5)
            section.right_margin = Inches(0.5)

        div_tt = solution['division_timetables']
        
        for div in self.divisions:
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(f"PUNE INSTITUTE OF COMPUTER TECHNOLOGY, PUNE-43\nDEPARTMENT OF COMPUTER ENGINEERING\nCLASS TIMETABLE (ACADEMIC YEAR 2026-27 SEM-I) - CLASS {div}")
            run.bold = True
            run.font.size = Pt(11)

            table = doc.add_table(rows=1, cols=6)
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            
            hdr_cells = table.rows[0].cells
            hdr_cells[0].text = "Time Slot"
            for i, day in enumerate(self.DAYS):
                hdr_cells[i+1].text = day
                
            for cell in hdr_cells:
                cell.paragraphs[0].runs[0].bold = True
                cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
                shd = parse_xml(r'<w:shd {} w:fill="1F4E78"/>'.format(nsdecls('w')))
                cell._tc.get_or_add_tcPr().append(shd)
                cell.paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)

            for slot in self.SLOTS:
                row_cells = table.add_row().cells
                row_cells[0].text = slot
                row_cells[0].paragraphs[0].runs[0].bold = True
                
                for i, day in enumerate(self.DAYS):
                    cell_data = div_tt[div][day][slot]
                    if cell_data['type'] == 'Theory':
                        row_cells[i+1].text = f"{cell_data['subject_code']}\n({cell_data['teacher']})"
                    elif cell_data['type'] == 'Parallel_Labs':
                        lines = []
                        for b_code, b_info in cell_data['batches'].items():
                            lines.append(f"{b_info['subject_code']} {b_code}: {b_info['teacher'].split()[-1]}")
                        row_cells[i+1].text = "\n".join(lines)
                    else:
                        row_cells[i+1].text = "---"

            doc.add_page_break()

        doc.save(output_path)
        print(f"Exported DOCX timetable to {output_path}")

    def export_markdown(self, solution, output_path='SE_Timetable_2026_27.md'):
        div_tt = solution['division_timetables']
        md_content = "# SE Computer Engineering Class Timetables (2026-27 Sem-I)\n\n"
        
        for div in self.divisions:
            md_content += f"## Timetable for Class {div}\n\n"
            md_content += f"| Time Slot | " + " | ".join(self.DAYS) + " |\n"
            md_content += f"| --- | " + " | ".join(["---"] * len(self.DAYS)) + " |\n"
            
            for slot in self.SLOTS:
                row_str = f"| **{slot}** | "
                day_vals = []
                for day in self.DAYS:
                    cell = div_tt[div][day][slot]
                    if cell['type'] == 'Theory':
                        day_vals.append(f"**{cell['subject_code']}**<br>({cell['teacher']})")
                    elif cell['type'] == 'Parallel_Labs':
                        lines = [f"**{info['subject_code']}** {b_code} ({info['teacher'].split()[-1]})" for b_code, info in cell['batches'].items()]
                        day_vals.append("<br>".join(lines))
                    else:
                        day_vals.append("---")
                row_str += " | ".join(day_vals) + " |\n"
            md_content += row_str + "\n\n"

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"Exported Markdown timetable to {output_path}")

if __name__ == '__main__':
    solver = TimetableSolver()
    result = solver.solve()
    if result:
        solver.print_ascii_table(result)
        solver.export_docx(result)
        solver.export_excel(result)
        solver.export_markdown(result)
