import os
import re
import docx
import pandas as pd

class LoadAllocationParser:
    """
    Parser for Load Allocation documents (.docx, .csv, .xlsx).
    Extracts teacher profiles, total weekly load limits, and SE subject assignments.
    """
    
    # Ordered mapping table for subject aliases (longer strings first)
    SUBJECT_ALIASES = [
        ('MDM TUT', 'MDMT'), ('MDMT', 'MDMT'),
        ('MDM', 'MDM'), ('MATHEMATICS FOR DATA MODELING', 'MDM'),
        ('DSL', 'DSL'), ('DSAL', 'DSL'), ('DATA STRUCTURES LAB', 'DSL'),
        ('COAL', 'COAL'), ('MPL', 'COAL'), ('COMPUTER ORGANIZATION LAB', 'COAL'),
        ('PDCR', 'PDCR'), ('PROFESSIONAL DEVELOPMENT', 'PDCR'),
        ('CEP', 'CEP'), ('PBL', 'CEP'), ('COMPUTER ENGINEERING PRACTICE', 'CEP'),
        ('FLS', 'FLS'), ('OE-FLS', 'FLS'), ('LINUX', 'FLS'),
        ('DS', 'DS'), ('DSA', 'DS'), ('DATA STRUCTURES', 'DS'),
        ('DM', 'DM'), ('DISCRETE MATHEMATICS', 'DM'),
        ('COA', 'COA'), ('COMPUTER ORGANIZATION', 'COA'), ('MP', 'COA'),
        ('UHV', 'UHV'), ('UNIVERSAL HUMAN VALUES', 'UHV'),
        ('EEFM', 'EEFM'), ('ECONOMICS', 'EEFM')
    ]

    def __init__(self, file_path):
        self.file_path = file_path
        self.teachers = {} # teacher_name -> {'total_load': int, 'theory_subjects': set(), 'lab_subjects': set(), 'assignments': []}

    def parse(self):
        ext = os.path.splitext(self.file_path)[1].lower()
        if ext == '.docx':
            return self._parse_docx()
        elif ext == '.csv':
            return self._parse_csv()
        elif ext in ['.xlsx', '.xls']:
            return self._parse_excel()
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    def _normalize_subject(self, raw_subj):
        if not raw_subj or pd.isna(raw_subj):
            return ""
        s_up = str(raw_subj).strip().upper()
        for alias, code in self.SUBJECT_ALIASES:
            if alias == s_up or f" {alias} " in f" {s_up} " or s_up.startswith(alias):
                return code
        return s_up

    def _parse_docx(self):
        doc = docx.Document(self.file_path)
        current_teacher = None

        for table in doc.tables:
            for r_idx in range(len(table.rows)):
                row = table.rows[r_idx]
                cells = [c.text.strip().replace('\n', ' ') for c in row.cells]
                if len(cells) < 7:
                    continue
                
                # Header filter
                if 'Teacher' in cells[0] or 'SUBJECT' in cells[0] or 'DEPARTMENT' in cells[0]:
                    continue
                
                name = cells[0].strip()
                if name:
                    current_teacher = name

                if not current_teacher:
                    continue

                if current_teacher not in self.teachers:
                    self.teachers[current_teacher] = {
                        'total_load': 18, # default cap
                        'theory_subjects': set(),
                        'lab_subjects': set(),
                        'assignments': []
                    }

                # Extract total load
                for val in reversed(cells):
                    if val.isdigit():
                        self.teachers[current_teacher]['total_load'] = int(val)
                        break

                th_subj = self._normalize_subject(cells[1])
                th_cls = cells[2]
                th_hrs = int(cells[3]) if cells[3].isdigit() else 0

                pr_subj = self._normalize_subject(cells[4])
                pr_cls = cells[5]
                pr_hrs = int(cells[6]) if cells[6].isdigit() else 0

                if th_subj and ('SE' in th_cls or th_hrs > 0):
                    self.teachers[current_teacher]['theory_subjects'].add(th_subj)
                    self.teachers[current_teacher]['assignments'].append({
                        'type': 'theory', 'subject': th_subj, 'class': th_cls, 'hours': th_hrs
                    })

                if pr_subj and ('SE' in pr_cls or pr_hrs > 0):
                    self.teachers[current_teacher]['lab_subjects'].add(pr_subj)
                    self.teachers[current_teacher]['assignments'].append({
                        'type': 'lab', 'subject': pr_subj, 'class': pr_cls, 'hours': pr_hrs
                    })

        return self.teachers

    def _parse_csv(self):
        df = pd.read_csv(self.file_path)
        return self._parse_dataframe(df)

    def _parse_excel(self):
        df = pd.read_excel(self.file_path)
        return self._parse_dataframe(df)

    def _parse_dataframe(self, df):
        current_teacher = None
        for _, row in df.iterrows():
            t_name = str(row.get('teacher_name', '')).strip()
            if t_name and t_name != 'nan':
                current_teacher = t_name

            if not current_teacher:
                continue

            if current_teacher not in self.teachers:
                total_load = int(row.get('total_load', 18)) if pd.notna(row.get('total_load')) else 18
                self.teachers[current_teacher] = {
                    'total_load': total_load,
                    'theory_subjects': set(),
                    'lab_subjects': set(),
                    'assignments': []
                }

            th_subj = self._normalize_subject(row.get('theory_subject'))
            th_cls = str(row.get('theory_class', ''))
            th_hrs = int(row.get('theory_hours', 0)) if pd.notna(row.get('theory_hours')) else 0

            pr_subj = self._normalize_subject(row.get('practical_subject'))
            pr_cls = str(row.get('practical_batch', ''))
            pr_hrs = int(row.get('practical_hours', 0)) if pd.notna(row.get('practical_hours')) else 0

            if th_subj:
                self.teachers[current_teacher]['theory_subjects'].add(th_subj)
                self.teachers[current_teacher]['assignments'].append({
                    'type': 'theory', 'subject': th_subj, 'class': th_cls, 'hours': th_hrs
                })
            if pr_subj:
                self.teachers[current_teacher]['lab_subjects'].add(pr_subj)
                self.teachers[current_teacher]['assignments'].append({
                    'type': 'lab', 'subject': pr_subj, 'class': pr_cls, 'hours': pr_hrs
                })

        return self.teachers

if __name__ == '__main__':
    parser = LoadAllocationParser('load_allocation_se_2026_27.csv')
    res = parser.parse()
    print(f"Parsed {len(res)} teachers successfully.")
