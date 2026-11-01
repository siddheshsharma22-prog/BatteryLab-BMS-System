# BatteryLab - BMS System

Battery Management System (BMS) telemetry, configuration, and monitoring platform.
# BatteryLab 🔋

**Virtual Battery Design & Test Platform**

BatteryLab is a browser-based virtual battery engineering platform that compresses the traditional cell-selection, pack-design, and thermal-testing cycle into a single guided workspace[span_0](start_span)[span_0](end_span). Instead of ordering cells, wiring a bench, and running a cycler, you can define a cell from a curated datasheet library, assemble it into a series-parallel pack, and run electro-thermal experiments that behave exactly like real bench tests[span_1](start_span)[span_1](end_span). 

## ✨ Key Features

The application is organized into a sequential seven-step wizard, ensuring every phase logically feeds the next[span_2](start_span)[span_2](end_span):

* **1. Design:** Define a cell using a 44-field design sheet or load one of 24 real datasheet cells across 8 chemistries[span_3](start_span)[span_3](end_span)[span_4](start_span)[span_4](end_span).
* **2. Connection:** Size the pack with series/parallel steppers (e.g., 13S4P) and manually wire the interactive schematic[span_5](start_span)[span_5](end_span).
* **3. Modeling:** Inspect the finished pack in fully interactive 3D, complete with busbars, BMS boards, and color-coded polarities[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span). 
* **4. Simulation:** Run electrical test profiles (CC Discharge, CC-CV Charge, HPPC, Drive Cycle, or Custom) against the 2-RC model, animated on a shared playback clock[span_8](start_span)[span_8](end_span)[span_9](start_span)[span_9](end_span).
* **5. Thermal:** Apply cooling strategies (natural air, forced air, liquid cold plate) to test heat rejection, generating 2D/3D thermal maps and safety verdicts[span_10](start_span)[span_10](end_span).
* **6. Monitor:** Watch telemetry like a real BMS dashboard[span_11](start_span)[span_11](end_span)[span_12](start_span)[span_12](end_span). Connects to physical hardware via the Web Serial API to stream live telemetry over CAN, RS485, or UART[span_13](start_span)[span_13](end_span).
* **7. Analysis:** Compare every stored run side-by-side using normalized overlay plots, and export time-series data to CSV[span_14](start_span)[span_14](end_span)[span_15](start_span)[span_15](end_span).

### 🤖 VoltAI Copilot
An embedded, context-aware engineering assistant that sees your live workspace[span_16](start_span)[span_16](end_span). VoltAI can calculate parameters based on your current inputs, recommend configurations, and execute one-click JSON patches to update your design sheet safely[span_17](start_span)[span_17](end_span).

## 🧮 Physics & Simulation Engine

BatteryLab does not hide the math. The physics run on a deterministic server-side TypeScript engine[span_18](start_span)[span_18](end_span)[span_19](start_span)[span_19](end_span):
* **Electrical:** 2-RC Thevenin equivalent-circuit model integrated at one-second steps[span_20](start_span)[span_20](end_span)[span_21](start_span)[span_21](end_span).
* **Thermal:** Bernardi heat-generation equation coupled with a lumped thermal mass[span_22](start_span)[span_22](end_span)[span_23](start_span)[span_23](end_span).
* **Safety:** Automatic aborts at the 130°C thermal runaway onset, with strict flagging for C-rate and voltage window limits[span_24](start_span)[span_24](end_span)[span_25](start_span)[span_25](end_span).


### Installation

Clone the repository and spin up the local development server:

```bash
git clone <project> && cd batterylab
bun install
bunx prisma generate
bunx prisma db push
bun run dev
