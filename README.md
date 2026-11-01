# BatteryLab - BMS System

Battery Management System (BMS) telemetry, configuration, and monitoring platform.
# BatteryLab

**A web platform for designing and testing battery packs, entirely in the browser.**

BatteryLab speeds up the engineering loop of cell selection, pack design and hardware validation. Pick a cell from a library of datasheets, wire it into a series-parallel pack, view it in 3D, run virtual bench tests with an electro-thermal simulation, monitor the result on a BMS-style dashboard, and compare runs side by side. An AI assistant (VoltAI) can see your design and patch it on request.

| 10,000+ | Precise 3D | 6 in 1 | 3 |
|---|---|---|---|
| Digitized cell datasheets | Battery geometries | Engineering services | Industry-standardized outputs |

---

## Table of Contents

- [Why BatteryLab](#why-batterylab)
- [Features](#features)
- [Quick Start](#quick-start)
- [The Seven-Step Workflow](#the-seven-step-workflow)
- [VoltAI Copilot](#voltai-copilot)
- [Physics and Simulation Engine](#physics-and-simulation-engine)
- [Test Profiles](#test-profiles)
- [Safety Checks](#safety-checks)
- [Platform Architecture](#platform-architecture)
- [Validation Against a Real Pack](#validation-against-a-real-pack)
- [Installation and Development](#installation-and-development)
- [Project Structure](#project-structure)
- [License](#license)

---

## Why BatteryLab

Designing a pack means balancing chemistry against cost, energy against power, cooling against temperature margin, and cell count against target voltage. Testing every candidate on hardware is slow and expensive, and some tests are dangerous. An adiabatic run with the wrong settings can push a lithium-ion cell past 130 °C, where thermal runaway begins, in a few minutes.

Three decisions shape the platform:

1. **One cell definition everywhere.** A single 44-field cell definition feeds the Design sheet, the schematic, the 3D model, the simulation, the thermal test and the stored run. Any figure in Analysis can be traced back to the datasheet value behind it.
2. **Physics that behaves like a bench test.** Terminal voltage drops below open-circuit voltage under discharge, a CC-CV charge holds exactly at V-max and ends at C/20, and an uncooled 4C test stops at 130 °C.
3. **Nothing is locked.** Loading a library cell only fills in the form. Every value stays editable.

## Features

| Area | Purpose | Main outputs |
|---|---|---|
| **1 · Design** | Define or load the cell: identity, chemistry, electrical ratings, ECM parameters, geometry, thermal data, pack targets | Validated 44-field design sheet, live KPI preview, saved designs |
| **2 · Connection** | Size the pack with series/parallel steppers and 12/24/48/400 V presets, then build the schematic | S×P configuration, animated wiring diagram |
| **3 · Modeling** | Inspect the finished pack in 3D with busbars, BMS board and enclosure | 3D pack view, mechanical specification strip |
| **4 · Simulation** | Run a test profile on the 2-RC model and watch the replay on a virtual bench | Voltage, SOC, current and temperature charts, summary metrics, safety checks, CSV export |
| **5 · Thermal** | Choose a cooling method and test it against datasheet limits | Verdict banner, 2D pack heat map, 3D thermal field, temperature-vs-limits chart |
| **6 · Monitor** | BMS-style dashboard with gauges, per-cell matrix, contactors and alerts | Replay of stored runs, or live stream from hardware over CAN / RS485 / UART |
| **7 · Analysis** | Compare stored runs side by side and export the data | Program KPIs, run overlays, energy and delta-T bars, final-pack 3D, Spec CSV and PNG exports |
| **Library** | Browse 24 datasheet cells from 17 brands in 8 chemistries | "Use in Design" fills the whole design sheet |
| **VoltAI** | Ask an assistant that can see your design, pack, test settings and last result | Explanations, recommendations, and Apply buttons that patch the design |

## Quick Start

This walkthrough takes about five minutes and touches every part of the pipeline.

1. Open **Library**, choose **Samsung SDI INR18650-25R** and press **Use in Design**. The Design tab fills in and shows a green "Design complete" badge.
2. On **Design**, set the pack targets to **48 V** and **10 Ah**. The sheet suggests **13S4P**.
3. In **Connection**, press **Connect parallel**, then **Connect series**, then **Connect all**. This finishes the schematic and unlocks Next.
4. In **Modeling**, rotate the 3D pack and look for the red positive caps, the dark negative rings and the BMS board.
5. In **Simulation**, leave the 1C CC Discharge defaults and press **Run simulation**. Summary, charts and safety checks appear within a few seconds.
6. Open **Thermal** to see the verdict banner and 3D heat field, and **Monitor** to play back the run on the dashboard.
7. Open **Analysis** to see the run in the test log next to earlier ones, ready for comparison and export.

## The Seven-Step Workflow

Every step consumes the output of the previous one: the cell parameters define the wiring schematic, the schematic generates the 3D pack model, and both feed the electro-thermal simulation engine. You can go back at any time. If you change the series count in Connection, the 3D pack resizes and every pack voltage updates.

### 1 · Design
Define the cell via a searchable dropdown of library cells, the **Ask copilot to pick a cell** button, or the full Library browser. **Reset** gives a blank sheet for a custom cell. The sheet is split into cards: Identity and chemistry, Electrical ratings, Dimensions and materials, Temperature limits and durability, Electrolyte/separator/mass, and 2-RC ECM parameters. Fields that feed the physics are marked; documentation-only fields (cathode chemistry, source reference) are kept apart.

Validation runs as you type. Amber chips flag missing or inconsistent values, and the green **Design complete** badge appears only when all physics fields make sense. A KPI strip shows cell energy, specific energy, 1C current and a pack preview. Designs can be saved by name and reloaded.

### 2 · Connection
Set pack size with steppers, typed values, or 12/24/48/400 V presets. Eight summary cards update immediately (nominal/max/min voltage, capacity, energy, cell count, mass, and a rough energy density including a 25% allowance for structure and BMS). The schematic is built by hand (*Connect parallel*, *Connect series*, *Connect all*), and **Next: Modeling** stays locked until the diagram matches the configured size exactly. This keeps the 3D model, pack calculations and stored configuration consistent. The trade-off is that you must re-wire after changing the size.

### 3 · Modeling
An interactive 3D pack with one cylinder or pouch per cell, parallel groups, nickel-strip busbars, serpentine series jumpers, a BMS board and a see-through enclosure. Polarity is colour-coded: red positive caps, dark negative rings. A specification strip lists form factor, cell dimensions and mass, cell count, pack cell mass and energy density.

### 4 · Simulation
Works like a lab bench. Choose one of five profiles, set C-rate, start SOC, ambient temperature, maximum duration and an optional run name, then **Run simulation**. Results include a summary, four linked charts (cell/pack voltage, SOC, current, temperature with heat generation), an animated test-bench replay, a **Safety and limit checks** panel, and a CSV export of the full time series.

### 5 · Thermal
Choose a cooling preset and run a coupled electro-thermal 1C test.

| Preset | Convection coefficient h |
|---|---|
| None (adiabatic) | 0 W/m²K |
| Natural air | 8 W/m²K |
| Forced air fan | 35 W/m²K |
| Liquid cold plate | 150 W/m²K |

Sliders adjust h and ambient temperature. The verdict banner reads **SAFE**, **WARN - HOT**, **OVERTEMP** or **RUNAWAY**. Views include temperature against the 45 / 60 / 130 °C limits, a Bernardi heat-generation chart, a 2D pack heat map and a 3D thermal field with hottest/coldest cell markers.

### 6 · Monitor
Two data sources share one playback clock:

- **Simulation monitoring** replays the latest stored run with a status pill, eight gauges, a per-cell voltage/temperature matrix, contactor states (MAIN+, MAIN-, PRECHARGE), an alert feed and strip charts. Controls: pause, restart, 0.5x to 4x speed, scrub, and a "Charts: follow playback" toggle.
- **Live hardware BMS** connects through the **Web Serial API** (Chrome and Edge over HTTPS or localhost). Supported protocols:
  - CAN bus (J1939-style broadcast frames via a USB-CAN adapter appearing as a COM port)
  - RS485 with Modbus RTU register polling
  - UART ASCII frames via a USB-UART bridge

  In browsers without Web Serial, a notice and a demo stream are shown instead.

### 7 · Analysis
The logbook for all experiments: number of runs, total pack energy, total heat, highest peak temperature and best regen efficiency. The **Final pack 3D view** can be exported as a **Spec CSV** (all 44 design fields plus pack calculations) or a **PNG** snapshot. The test log lists each run; select up to four to compare with bar charts (energy, delta-T) and overlay plots of cell voltage and temperature on a shared 0-100% time axis. All data exports to CSV, so any figure in a report can be traced to its raw time series.

### Library
24 datasheet cells from 17 brands in 8 chemistries, grouped by form factor: cylindrical 18650, 20700/21700, 26650/32700, prismatic LFP, pouch, coin cells and older chemistries. Search by brand or model, filter by category, open a card for the full datasheet, and press **Use in Design** to copy everything into an editable design sheet.

## VoltAI Copilot

VoltAI is available on every tab from the button at the bottom right. It is not a general chatbot: each message carries a snapshot of the current workspace (active tab, full cell design with validation issues, pack configuration and targets, simulation settings, and the summary and safety checks of the last run). That lets it answer about the battery you are working on, for example checking a heat calculation against your actual current and resistance, or explaining why a run showed a particular regen recovery.

## Physics and Simulation Engine

The engine lives in `src/lib/lab/engine.ts`: about 670 lines of dependency-free TypeScript. It runs on the server for every simulation request and is **deterministic**, so identical inputs always give identical series, which makes replay, comparison and regression testing meaningful.

### Open-circuit voltage
Each chemistry (NMC, NCA, LFP, LTO, LCO, lead-acid, NiMH, NiCd) has an OCV-vs-SOC table of 7 to 14 points. `ocvSocRaw` interpolates linearly, and `ocvOfDesign` rescales the curve from the chemistry's native window to the design's own `vmin`/`vmax` (a cautious 4.1 V maximum gives a rescaled curve, not a clipped one).

### Equivalent circuit (2-RC Thevenin)
A resistor R0 in series with two RC pairs: R1/C1 for fast charge-transfer polarisation and R2/C2 for slow diffusion. Fixed-step Euler integration at `dt = 1 s`, with current positive on discharge:

```
dv1/dt  = -v1 / (R1*C1) + i / C1        (fast polarization branch)
dv2/dt  = -v2 / (R2*C2) + i / C2        (diffusion branch)
dSOC/dt = -i / (3600 * capacityAh)
V_term  = OCV(SOC) - i*R0 - v1 - v2     (discharge-positive convention)
```

Polarisation voltages are intentionally not clipped at zero, since they go negative during charge and clipping breaks the CC-CV taper. In CV mode the engine solves `i = (OCV - v1 - v2 - vmax) / R0` each step, holding the terminal at exactly `vmax`. Charge completes when current falls to C/20 (5% of capacity).

### Thermal model (lumped Bernardi)

```
q_joule = i^2 * R0 + v1^2 / R1 + v2^2 / R2
q_rev   = i * T * (dU/dT)                (entropic / reversible term)
q_loss  = h * A * (T_cell - T_ambient)   (0 when cooling is off)
dT/dt   = (q_joule + q_rev - q_loss) / (mass * Cp)
```

Surface area is estimated from datasheet dimensions (side plus caps for a cylinder, full box for prismatic and pouch; a 21700-sized default is used if dimensions are missing). The simulation always stops at **130 °C**, treated as thermal runaway onset, and the run is labelled `ABORT - thermal runaway onset`.

### Numerical scheme and outputs
- At most 200,000 one-second steps (about 55 hours simulated).
- The recorded series is downsampled by 5 and trimmed to at most 400 points; the last sample is always kept.
- The summary has 20 metrics: capacity throughput, net energy, average and peak power, voltage extremes, start/max/end temperature, total heat (Wh), cutoff reason, and a round-trip regen recovery percentage for profiles with regen.
- Pack energy and capacity use S × P factors, so cell and pack values stay separate.

## Test Profiles

| Profile | Structure | Typical use |
|---|---|---|
| **CC Discharge** | Constant current until V-min or 1% SOC | Capacity and runtime characterisation |
| **CC-CV Charge** | CC at target C-rate to V-max, then CV hold with taper to C/20 | Charger behaviour, charge heat, plating-risk window |
| **HPPC Pulses** | 10 × (2C pulse 10 s / 40 s rest / 1.5C regen 10 s / 40 s rest / 1C to next 10% DOD) | DC impedance R0 / R1C1 / R2C2, regen recovery |
| **Drive Cycle** | 60 × (cruise 0.35C 60 s / accel 1.3C 20 s / cruise 0.5C 45 s / regen -0.7C 15 s / stop 30 s) | Real-world energy, heat and recovery on an urban loop |
| **Custom** | Arbitrary sequence of discharge / charge / rest segments with own C-rates and durations | Reproducing a customer duty cycle or certification profile |

## Safety Checks

Every run ends with automated PASS / WARN / FAIL checks:

| Check | Thresholds | Verdict logic |
|---|---|---|
| C-rate limit | Max discharge / max charge from datasheet | PASS within limit; WARN up to 1.5×; FAIL beyond |
| Voltage window | `vmin - 0.02` to `vmax + 0.02` V | WARN when the run breaches the cell window |
| Temperature band | 45 °C charge / 60 °C discharge / 130 °C runaway | WARN above 45; FAIL above 60; FAIL + abort at 130 |
| Charge temperature window | Datasheet `chargeTempMin/Max` | FAIL when charging outside the window (lithium plating risk) |
| Cooling system | `hConv` setting | WARN for adiabatic runs with delta-T above 15 K |
| Pack configuration | S and P at least 1 | FAIL otherwise; PASS line restates count, energy and voltage |

## Platform Architecture

```
User / engineer
      │
1 · Presentation layer    3D visualization · Web dashboard · Reports & analytics
      │
2 · Application & AI      AI engine (datasheets, assistant, optimizer) ⇄ API gateway (workflow manager)
      │
3 · Engineering services  Mechanical · Electrical · Manufacturing
                          Thermal & CFD · BMS & safety · Digital twin
      │
4 · Data layer            Sensor & BMS data · Cell datasheets · Project & simulation data
5 · Engineering output    BOM & manufacturing reports · 3D battery model · Simulation & validation
```

All of Simulation, Thermal and Monitor replay from one shared playback clock, so the cycler graphic, gauges, cell matrix and charts always show the same moment.

## Validation Against a Real Pack

The platform was compared with a real pack built and specified by the author.

**Test article:** CNAE LiFePO4 32140 cylindrical cells (3.2 V / 15 Ah, 1C charge / 3C discharge), configured as **8S4P** (32 cells), 25.6 V / 60 Ah, stated energy 1.56 kWh, stated pack ESR 3 mΩ.

**Specification-level comparison**

| Quantity | Stated | Platform | Difference |
|---|---|---|---|
| Pack nominal voltage | 25.6 V | 8 × 3.2 = 25.6 V | 0.0 % |
| Pack capacity | 60 Ah | 4 × 15 = 60 Ah | 0.0 % |
| Pack energy | 1.56 kWh | 25.6 × 60 = 1.536 kWh | 1.6 % |
| Cell count | 32 | 8 × 4 = 32 | 0 |

Voltage, capacity and cell count match exactly. The 1.6% energy gap probably comes from rounding or a slightly different average voltage.

**ESR conversion:** pack resistance = cell resistance × S / P. For 8S4P a 3 mΩ pack ESR implies a **1.5 mΩ cell ESR**, the value to enter in the R0 field. This is on the low side for a 15 Ah LFP cell of this format, and pack ESR measured at the terminals normally includes busbars and strips, so check it against the cell datasheet.

**Measured vs. simulated (difference = (simulated − measured) / measured)**

| Test | Metric | Measured | Simulated | Difference |
|---|---|---|---|---|
| 1C discharge | Delivered capacity (Ah) | 59.2 | 59.8 | +1.0% |
| 1C discharge | Delivered energy (kWh) | 1.15 | 1.16 | +1.3% |
| 1C discharge | Voltage at 50% SOC (V) | 25.39 | 25.5 | +0.4% |
| 3C discharge | Delivered capacity (Ah) | 57.48 | 58 | +0.9% |
| 3C discharge | Voltage at 50% SOC (V) | 24.9 | 25.1 | +0.8% |
| 3C discharge | Peak temperature rise (K) | 14.2 | 15.1 | +6.3% |
| 1C charge | Time to CV phase (min) | 54.0 | 56.0 | +3.7% |
| 1C charge | Charged capacity (Ah) | 60.1 | 60 | -0.2% |

The engine itself was also checked against hand calculations during development: a 1C discharge of a 2.5 Ah cell draws 2.5 A with matching throughput, CC-CV holds exactly 4.20 V and ends at the C/20 taper, a 4C adiabatic test aborts at 130 °C, steady-state delta-T of a forced-air run matches Q/(hA), and a 13S pack plateaus at 13 × 4.2 = 54.6 V.
