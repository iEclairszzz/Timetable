# Timetable Generator & Predictor Studio

A modern, interactive Web Application and Constraint Programming Timetable Predictor for Pune Institute of Computer Technology (PICT) - Department of Computer Engineering (S.Y. 2026-27 Sem-I, 4 Divisions, 16 Batches).

Automates the scheduling and predictive allocation of all 12 theory lectures, labs, and tutorials, enforcing timing rules, 2-hour continuous non-split lab blocks, faculty workload caps, and room capacity limits (such as the 7 Computer Labs limit for DSL/COAL).

---

## 🚀 Web Application Features

1. **Class View (SE-1 to SE-4)**:
   - Full timetable grid for each division with color-coded theory lectures and parallel lab session blocks.
   - 4-Batch Parallel Matrix: shows all 4 batches (e.g. E1, F1, G1, H1) with their respective teachers and lab rooms.
2. **Individual Batch View**:
   - Personalized student timetables for any of the 16 batches (E1..H1, E2..H2, E3..H3, E4..H4).
3. **Teacher Schedule View**:
   - Complete weekly schedules for all 32+ faculty members with workload meters, weekly caps, and free slot indicators.
4. **Room & Lab Occupancy View**:
   - Live occupancy tracking across classrooms (CR-101 to CR-104), Computer Labs (CL-1 to CL-7), Linux Lab, Hardware Lab, and Language Lab.
5. **Subject Allocator Studio**:
   - Comprehensive dashboard tracking all 12 subjects (DS, DSL, COA, COAL, MDM, MDMT, DM, UHV, EEFM, CEP, FLS, PDCR).
   - Real-time progress bars, required vs allocated contact hours, and one-click predictive slot allocation.
6. **AI / Heuristic Slot Predictor**:
   - Evaluates any subject/class/batch/teacher and predicts optimal conflict-free time slots scored from 0 to 100 based on student fatigue balance, teacher gap minimization, and lab block alignment.
7. **Department Conflict Auditor**:
   - Real-time constraint validation checking for faculty double-booking, room collisions, break-splitting violations, computer lab capacity (>7), and syllabus deficits.
8. **Dedicated Search Portal (`search.html`)**:
   - Universal cross-department search engine opening dedicated results pages instead of in-place filtering.
   - Searches across Faculty (workload, weekly calendars, free slots), Curriculum Subjects (all 12 subjects across 4 divisions & 16 batches), Divisions & Batches, and Classrooms & Computer Labs.
   - Deep-linking back into the main timetable grid with one-click return.
9. **Dynamic Department & Faculty Inputs**:
   - **Custom Divisions & Batches**: Add new divisions (e.g. SE-5, TE-1), append custom batches, or delete divisions with auto-cleaned schedule references.
   - **Classrooms & Specialized Labs**: Register lecture classrooms and specialized computer labs with tracking for concurrent lab limits.
   - **Faculty Management (Manual Entry & Excel Import)**:
     - Add faculty members manually with designation, max weekly hours quota, and qualified theory/lab subjects.
     - **Spreadsheet Import**: Drag-and-drop or select any `.xlsx`, `.xls`, or `.csv` file. Real-time preview with row count, status badges, and duplicate updating.
     - **Template Generator**: One-click download of formatted `Faculty_Roster_Template.xlsx` with official department column headers.
10. **Export & Print**:
   - Export multi-sheet Excel workbooks (.xlsx) with schedule, faculty workload, divisions, and rooms, plus CSV, clean printable PDF, and JSON backups.

---

## 📂 Web App Structure

- `index.html`: Main application interface with PICT branding, view navigators, and modals.
- `styles.css`: Modern glassmorphism dark-theme styling, responsive tables, and print stylesheets.
- `js/default_data.js`: Verified optimal baseline schedule generated from CP-SAT solver.
- `js/data.js`: LocalStorage state management and curriculum statistics.
- `js/validator.js`: Real-time conflict detector and full department auditor.
- `js/predictor.js`: Intelligent slot predictor and automated subject allocator engine.
- `js/app.js`: Main UI controller and interaction handlers.
- `export_web_data.py`: Pipeline connecting python CP-SAT solver solutions to the web application.

---

## 🏃‍♂️ How to Run Locally

### Option 1: Open Directly in Browser
Simply double-click or open `index.html` in any modern web browser.

### Option 2: Run with Local HTTP Server
```bash
# Using Python
python -m http.server 8080

# Or with Node.js
npx serve .
```
Then visit `http://localhost:8080` in your web browser.

---

## ⚙️ Python CP-SAT Solver (CLI)

The underlying mathematical constraint solver can also be executed directly via Python:
```bash
python timetable_solver.py
```
Outputs ASCII schedule in console and exports `SE_Timetable_2026_27.xlsx`, `SE_Timetable_2026_27.docx`, and `SE_Timetable_2026_27.md`.
