# Timetable Generator

A Python-based Constraint Programming Timetable Solver for SE Computer Engineering (4 Divisions, 16 Batches). 
This tool automates the scheduling of theory lectures, labs, and tutorials, enforcing timing rules, lab block alignments, teacher load caps, and specific room capacities (e.g., 7 Computer Labs limit).

## Features
- Generates a non-overlapping timetable for all divisions and batches.
- Handles teacher load caps and prevents teacher scheduling conflicts.
- Adheres to specific constraints like parallel lab sessions and computer lab capacity limits.
- Supports input configuration via CSV and load allocation from DOCX files.
- Exports results in multiple formats: ASCII table, Excel (`.xlsx`), Word (`.docx`), and Markdown (`.md`).

## Tech Stack
- **Python 3.x**
- **ortools**: Constraint Programming (CP-SAT) solver for the core scheduling logic.
- **pandas**: Data manipulation and export to Excel.
- **python-docx**: Parsing input and exporting schedules to Word documents.
- **openpyxl**: Excel writing support.

## Project Structure
- `timetable_solver.py`: Main solver logic utilizing `ortools.sat.python.cp_model`.
- `docx_parser.py`: Logic to parse teacher load allocation from DOCX files.
- `create_load_allocation.py`: Script/utility related to generating load allocations.
- `subjects.csv`: Input file defining the subjects and their type (Theory/Lab) and hours.
- `load_allocation_se_2026_27.csv`: Exported load allocation data.
- Input data files (`.docx`, `.xlsx`, `.pdf`) for timetable specs and allocations.

## Installation

1. Ensure you have Python installed.
2. Install the required dependencies:
   ```bash
   pip install pandas ortools python-docx openpyxl
   ```

## How to Run

Execute the main solver script:
```bash
python timetable_solver.py
```
This will run the CP-SAT solver. If a valid timetable is found, it will print an ASCII table in the console and export the schedule to `.xlsx`, `.docx`, and `.md` formats.

## Configuration / Environment Variables

Currently, the configuration is file-based:
- **`subjects.csv`**: Defines the curriculum and subject requirements.
- **`load_allocation_se_2026_27.csv`**: Represents the teacher load requirements.
- Other parameters like `divisions`, `batch_names`, and `LAB_START_SLOTS` are defined within the `TimetableSolver` class in `timetable_solver.py`.

No specific `.env` file or environment variables are required out of the box.
