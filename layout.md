# Office game – layout spec (4e verdiep + 3e verdiep)

Master spec for the office. The main floor in the model is the **4e verdiep** (called "1st floor" earlier); below it the **3e verdiep** is built for the Entrance and Stille ruimte part only. The 3D build (`index.html`) uses exactly these numbers.
Everything below describes the 4e verdiep unless it is in the **3e verdiep** section at the end.

## Coordinate system

All measurements are in meters.

- **x**: along the length of the building, 0 → 50. x = 0 is the Landscape end, x = 50 is the Stille ruimte / kitchen end.
- **z**: across the width, 0 → 13. z = 0 is **side A**, z = 13 is **side B**.
- **y**: height, with 0 = floor of the 4e verdiep. The 3e verdiep floor is at y = −3.06.
- Interior walls are 0.1 m thick and centred on the coordinate given.
- Doors are 0.96 m wide and 2.1 m high, with wall above up to the ceiling, unless stated otherwise.

## Building shell

| Item | Value |
|---|---|
| Footprint | **50 × 13 m** (1 m longer on the kitchen end) |
| Concrete pillars | 0.7 × 0.7 m, every 7 m (x = 0, 7, 14 … 42) along both long walls, plus the corner pillars at x = 50. The wall B pillars at x = 28 and x = 35 do not stick into the Men's and Ladies' rooms |
| Bays | Bays of 7 m. Bay 1 = 0–7 … bay 6 = 35–42; the last bay is 8 m (42–50) |
| Long walls (sides A and B) | 0–1 m solid wall, **1–2.5 m window band (1.5 m high)** along the full length, 2.5–3.1 m solid wall. Wall top at **3.1 m** |
| End walls (x = 0 and x = 50) | Solid from 0 to 3.1 m, with a **glass emergency door** in the centre (z 6.02–6.98, 0.96 m wide, 2.1 m high, push bar inside, green "Emergency exit" sign above). Above 3.1 m: **curved glass window** filling the roof curve from pillar to pillar (z 0.4–12.6), with **vertical frames only** (no horizontal bars) |
| Roof over Landscape (x 0–14) and Stille ruimte (x 35–50) | Open, curved roof spanning A→B. It starts at **3.1 m** on both long walls and peaks at **6.0 m** in the middle (z = 6.5). Profile used: y = 3.1 + 2.9·(1 − ((z − 6.5)/6.5)²). **Finish:** the visible underside is made of long **gray metal beams** running the length of the building (along x), ≈ 0.18 m wide, ≈ 0.26 m apart along the curve, over a dark gray backing. The cross arches at x = 7 and x = 42 are gray metal too |
| Everything else | Flat ceiling at 2.6 m: meeting zone x 14–28, Entrance x 28–35, HR, Boekentoren and the corridor between them (x 35–39.03). The window band (top 2.5 m) stays below it |
| Wall above 2.6 m at x = 14 and x = 35 | Closes the curved roof off from the flat-ceiling zone. Solid (no glass) |

## Zones

| Zone | x | Notes |
|---|---|---|
| Landscape (desks) | 0–14 | Bays 1–2 |
| Meetings (rooms) | 14–28 | Bays 3–4 |
| Entrance | 28–35 | Bay 5 |
| Stille ruimte | 35–50 | Bays 6–7 (bay 7 is 8 m) |

## Central corridor

- Runs the **full length**, z 5.32 → 7.68 (2.36 m wide), ending at the glass emergency door in each end wall.
- Wall at x = 14 across the full width, with an opening as wide as the corridor (z 5.32–7.68, full height).
- Walls at x = 28 (Entrance ↔ Landscape / meetings side) and x = 35 (Entrance ↔ Stille ruimte), each with a **double door** at z 5.58–7.42 (1.84 m wide, 2.3 m high), two **plain white** leaves in a white frame. The **leaf nearest the lifts (z 5.58–6.5) is always closed**; the other leaf (z 6.5–7.42) **stands open**, swung into the hall against the wall.
- **Decoration:** framed business-process prints (≈ 0.75–0.9 m wide, centred at 1.55 m) on the white corridor walls of the meetings zone: Management (x 20.95), Rabot (x 22.45), Prinsenhof (x 27.5) and the server room (x 26.0). Placeholders in the Orbid colours (flow diagram, chart, document flow, gears) until real photos are supplied. In the **Stille ruimte only one team photo** (the real Orbid team picture, 1.4 × 0.73 m, centred at 1.55 m) on the Boekentoren wall (x 38.45); no other prints or plants there.
- **Standing plants** in tall dark pots along the meetings-zone corridor walls at (x, z) ≈ (21.3, 5.6), (27.75, 5.6), (26.25, 7.4), clear of all doors.

## Floors

| Floor | Where |
|---|---|
| **Blue carpet** | All Landscape desk areas, all meeting rooms (incl. Print, Admin storage, Server), HR, Boekentoren, side A of the Stille ruimte (z 0–5.32, x 35–50) |
| **Laminate (beige wood, click)** | The full-length corridor; the whole Entrance hall incl. the toilet corridor and Utility (x 28–35, z 3.14–13 except the toilets); side B of the Stille ruimte incl. the kitchen (x 39.03–50, z 7.68–13) |
| **Stone tile (gray)** | Stairwell (x 28–35, z 0–3.14) and stair hallway (x 33.86–35, z 3.14–5.32); inside the Men's and Ladies rooms |
| **No floor** | Elevator shafts (x 28–33.86, z 3.14–5.32) |

## Landscape (x 0–14)

Desk islands, 6 seats each (3 per side), long axis along z: they run from the long wall to the corridor edge. **Seats sit close to the desks and tables everywhere** (chair centre 0.3 m from a desk edge, 0.28 m from a table edge).
Each has a central screen and a **plant divider** on its corridor end (0.44 m deep, standing on the corridor).

| Desk | x | z | Plant divider z |
|---|---|---|---|
| 1 | 1.22–2.80 | 0–5.32 (side A) | 5.32–5.76 |
| 2 | 4.55–6.12 | 0–5.32 | 5.32–5.76 |
| *(3)* | — | — | Not a desk. **3 yellow phone booths**, see below |
| 4 | 10.76–12.34 (moved 0.35 m away from the 14 m wall) | 0–5.32 | 5.32–5.76 |
| 5 | 1.22–2.80 | 7.68–13 (side B) | 7.24–7.68 |
| 6 | 4.55–6.12 | 7.68–13 | 7.24–7.68 |
| 7 | 7.79–9.36 | 7.68–13 | 7.24–7.68 |
| 8 | 11.11–12.69 | 7.68–13 | 7.24–7.68 |

### Next to desk 4

| Item | Position | Notes |
|---|---|---|
| Drawer cabinet | x 13.5–13.95, z 1.75–3.55, 1.1 m high | **Dark gray** drawer unit (3 drawers) against the 14 m wall |
| Whiteboard | On the 14 m wall, z 1.65–3.65, 1.3–2.35 m high | Above the drawer cabinet, with a marker tray |

### Phone booths (desk 3 slot)

3 yellow phone booths, 1.5 × 1.5 m, 2.2 m high, at x 7.875–9.36, each with a glass door and a number sign. Numbered from the corridor.

| Booth | z | Glass door |
|---|---|---|
| 1 | 3.6–5.1 (corridor end) | Desk 2 side (x = 7.875) |
| 2 | 1.97–3.47 | Desk 2 side (x = 7.875) |
| 3 | 0.35–1.85 (wall A end) | Desk 4 side (x = 9.36) |

### Room dividers

Two dividers along z, each in **3 equal parts**: solid panels (**1.8 m high**) at both ends and an **open, see-through shelf** in the middle with wooden planks (empty for now, to be filled later).

| Divider | x | z |
|---|---|---|
| Between desk 1 and desk 2 | 3.675 | 0.1–5.3 (wall A to corridor) |
| Between desk 6 and desk 7 | 6.955 | 7.72–12.6 (corridor to the pillar at wall B) |

## Meetings zone (x 14–28)

Walls between rooms are solid unless stated. Each corridor front is described per room below. **All meeting-room doors on the corridor go up to the ceiling (2.6 m)**; doors with **side lights** have 30 cm of clear glass left and right of the door, also up to the ceiling. Room name signs hang on the wall beside the door.

**Milk glass** (CEO front, Portus Ganda's corridor front, Print's corridor front next to its doorway): not see-through from the floor up to 2.1 m, then the **top 50 cm is clear glass** up to the 2.6 m ceiling, with no frame between the two.

### Side A (z 0 → 5.32), doors onto the corridor at z = 5.32

| Room | x | Door (x) | Corridor front |
|---|---|---|---|
| CEO | 14–18.03 | 14.35–15.31 (corner by the 14 m wall, shifted 0.17 m to fit the side light), up to the ceiling | **Milk glass**. Door with 30 cm clear side lights |
| Management | 18.03–21.96 | 18.73–19.69, up to the ceiling | **Wall**. Only the door and its 30 cm side lights |
| Rabot | 21.96–25.03 | 23.31–24.28, up to the ceiling | **Wall**. Only the door and its 30 cm side lights. Table 1.0 × 2.6 m (x 23.0–24.0, z 1.3–3.9), 6 chairs. **Large TV** (~85", 1.9 m wide) on a stand in front of the window |
| Prinsenhof | 25.03–28 | 25.73–26.70, up to the ceiling | **Wall**. Only the door and its 30 cm side lights. Table 1.0 × 2.6 m (x 26.0–27.0, z 1.3–3.9), 6 chairs. **Large TV** (~85", 1.9 m wide) on a stand in front of the window |

### CEO and Management furniture

Both rooms have the same **3-desk setup against the window**: each desk 1.6 × 0.8 m with a PC screen and a chair. Desks 1 and 2 are pushed together face to face (long side along z, starting at the window); desk 3 sits crosswise against their corridor-side end, its user facing the window.

| Room | Desk group centre (x) | Desks | Other |
|---|---|---|---|
| CEO | 16.0 (room centre) | 1: x 15.22–16.02, 2: x 16.02–16.82 (z 0.05–1.65); 3: x 15.22–16.82, z 1.65–2.45 | No closets |
| Management | 19.7 (nudged left to clear the cabinets) | 1: x 18.9–19.7, 2: x 19.7–20.5 (z 0.05–1.65); 3: x 18.9–20.5, z 1.65–2.45 | **Gray office cabinets** along the wall shared with Rabot (x = 21.96): x 21.46–21.91, z 0.5–4.9, 1.95 m high, 5 double-door units of 0.8 m with handles |

### Whiteboards (side A meeting rooms)

All 2 m (Rabot, Prinsenhof) or 1.8 m (Management, CEO) wide, 1.0–2.1 m high, with a marker tray. "Left" and "right" are as seen standing in the room facing the window.

| Room | Wall | Position |
|---|---|---|
| CEO | Right wall (x = 18.03, shared with Management) | z 3.1–4.9, the corridor end of the wall |
| Management | Left wall (x = 18.03, shared with CEO) | z 3.1–4.9, the corridor end of the wall (back to back with the CEO board) |
| Rabot | Left wall (x = 21.96, shared with Management) | z 3.1–5.1, toward the corridor (to the left, seen facing that wall) |
| Prinsenhof | Right wall (x = 28, shared with the Entrance) | z 3.1–5.1, toward the corridor (to the right, seen facing that wall) |

### Side B (z 7.68 → 13)

| Room | x | z | Door |
|---|---|---|---|
| Print | 14–17.03 | 7.68–9.95 | Doorway on the corridor, x 14.18–15.14 (corner), **up to the ceiling with the frame continuing along the ceiling** (same as Portus Ganda). Corridor front from the doorway to Portus Ganda (x 15.14–17.03) is **milk glass**. **Gray printer** against the Portus Ganda wall (x 16.3–16.98, z 8.3–9.3). **Orange bench** along the long wall shared with Admin storage (x 14.4–16.1, z 9.45–9.9) |
| Admin storage | 14–17.03 | 9.95–13 | Door in the 14 m wall from the Landscape, z 11.5–12.46 (kept clear of the pillar at z 12.6–13), sign above it. **Empty** for now |
| Portus Ganda (large meeting) | 17.03–25.46 | 7.68–13 | Corridor, x 24.41–25.37 (right corner), up to the ceiling; the door frame profile continues along the ceiling. **Milk glass** corridor front; **normal walls** toward Print / Admin storage (x = 17.03) and the server room (x = 25.46). Meeting table 5.4 × 2.2 m (x 18.5–23.9, z 9.25–11.45) with chairs on both long sides; **2 TVs side by side** on the end wall toward Print / Admin storage (x = 17.03, z 8.6–10.3 and 10.4–12.1) |
| Server room | 25.46–28 | 7.68–13 | Corridor door at x 26.99–27.95 (fully left as seen from the corridor, in the corner by the Entrance wall). **Fingerprint reader** on the corridor wall beside the door (x ≈ 26.84, 1.1–1.4 m high) |

## Entrance (x 28–35)

| Part | x | z | Notes |
|---|---|---|---|
| Stairwell | 28–35 | 0–3.14 | **U-stair** down to the 3e verdiep (3.06 m, 9 + 9 risers of 0.17 m, treads 0.3 m). Flight A (z 1.6–2.94) goes down from the top landing (x 33.95) to a half landing at x 30.0–31.55 (y −1.53); flight B (z 0.2–1.54) goes on down back toward x 33.95 and arrives on the 3e next to the stairwell door. Between the two flights a **metal railing** instead of a wall: a sloped handrail 0.95 m above the nosings on the inner edge of each flight, a mid rail, a baluster on every tread, end posts and a short rail across the gap at the half landing. The stair is one clean **double-height shaft** (3e floor → 4e ceiling) between a full-height wall at x = 30 (left) and the wall at x = 35 (right); the part west of x = 30 is closed off. **One big window** in wall A over both floors (x 30.0–34.65, from 0.15 m above the 3e floor up to the 4e ceiling, vertical frames only, a gray window profile as sill; the 4e floor stops at the shaft so there is no floor strip along the window) instead of the two window bands. Railing at the 4e top landing (x = 33.95). Wall at z = 3.14 with door at x 33.86–34.82 (end of stair hallway) |
| Elevators (2) | 28.88–30.81 and 31.15–33.08 | 3.32–5.24 | Shafts with no floor. Front wall at z = 5.32 runs left to right, with elevator doors at x 29.23–30.46 and 31.50–32.73; wall between shafts at x = 30.98 |
| Stair hallway | 33.86–35 | 3.14–5.32 | Wall at x = 33.86 lines up with the stairwell door. Door from the hall at z = 5.32, x 33.95–34.91. Door into the stairwell at the end |
| Hall | 28–35 | 5.32–7.68 | Between the two double doors. **2 floor mats** (1.2 × 0.8 m, darker gray with the Orbid logo) in front of the lift doors, x 29.25–30.45 and 31.52–32.72, z 5.42–6.22, readable when stepping out of the lifts |
| Men | 28–30.45 | 7.68–13 | Door in wall x = 30.45 at z 8.55–9.51, from the toilet corridor. **Green tiled walls, no windows** (window band on wall B closed off). **Toilet cubicle in the corner** of wall B and the entrance wall (x 29.3–30.45, z 11.3–13), door in its front at x 29.5–30.2, toilet against wall B. **3 wall-hung urinals** on the wall facing the entrance (x = 28) evenly spread between the corner block and wall B (z ≈ 9.28, 10.75, 12.21), with small privacy screens between them. **Washbasin** on the corridor-side wall (z = 7.68), to the right (x 29.75–30.3), with a **mirror** above it. The corner to the left of it **juts out** (x 28–28.95, z 7.68–8.55, full height, tiled), as if another room sits behind it. **No pillar** in the room (the wall B pillar at x = 28 stops at the Men's room wall) |
| Toilet corridor | 30.45–32.55 | 7.68–11.17 | Open to the hall |
| Ladies | 32.55–35 | 7.68–13 | Door in wall x = 32.55 at z 8.55–9.51, from the toilet corridor. **Mirror image of the Men's room**: green tiled walls, no windows, no pillar sticking in, corner block (x 34.05–35, z 7.68–8.55), washbasin with mirror on the corridor-side wall (x 32.7–33.25). Instead of urinals: **2 toilet cubicles side by side** along wall B (x 32.6–33.78 and 33.78–35, z 11.3–13), doors at x 32.8–33.5 and 34.05–34.75 |
| Utility (cleaning) | 30.45–32.55 | 11.17–13 | At the end of the toilet corridor, door at x 30.98–32.03 |

## Stille ruimte (x 35–50)

### Rooms (same size as CEO)

| Room | x | z | Door / furniture |
|---|---|---|---|
| **Duivelsteen (HR)** | 35–39.03 | 0–5.32 (side A) | Corridor front: **1 m of wall, glass above up to the ceiling**. Door x 37.97–38.94 (right corner). **Big table** 1.4 × 3.0 m (x 36.1–37.5, z 1.0–4.0) with 8 chairs. **Dark gray drawer cabinet** (same as by desk 4) on the right wall (x = 39.03), z 1.6–3.4. **Whiteboard** on the left wall (x = 35), z 1.5–3.5 |
| Boekentoren | 35–39.03 | 7.68–13 (side B) | **Solid** corridor wall. Door x 35.09–36.04 (left corner). No bookcase. **4 small desks** (0.7 × 1.2 m, long side along z, no monitors) in a 2 × 2 block (x 36.35–37.75, z 8.7–11.1), chairs on the outer sides, **separator screens** between left and right and between front and back. **2 beanbags** (zitzakken) at the far end by wall B (x ≈ 36.2 and 37.9, z ≈ 12.2) |

### Side A open area (blue carpet)

The space between the HR wall (x 39.03) and the white closets at the end wall (x 49.5) is divided evenly: couch | high table + U booth | divider | desk 9 (with chairs), with five equal gaps of ≈ 0.65 m. The couch also sits 0.65 m off wall A.

| Item | Position | Notes |
|---|---|---|
| L-shaped couch | Long part x 39.68–41.78, z 0.65–1.52 (backrest toward wall A). Short part x 40.90–41.78, z 1.52–4.14 | 0.65 m from the HR wall and from wall A, clear of the pillar at x = 42 |
| High table for 4 | x 42.71–44.19, z 0.87–1.66, 1.05 m high | Centred on the U booth column. Parallel to wall A, 2 high stools on each long side |
| Private 4-seat booth | Column x 42.43–44.47 (backs, 2.04 m wide). Benches x 42.57–43.00 and 43.90–44.33, z 2.7–4.45. Between them **2 small low tables**, 30 cm wide × 0.55 m, 0.5 m high (z 2.95–3.5 and 3.65–4.2) | **Yellow**, same as the phone booths. High backs (1.4 m) on 3 sides: left, right and the side-A end. Open toward the corridor |
| Divider | Along z at x = 45.34 | Wall A half (z 0.17–2.62): **open see-through shelf** with planks, 1.8 m high, same style as the Landscape dividers (empty for now). Corridor half (z 2.7–5.15): **planter**, like the Landscape plant dividers |
| Desk 9 | x 46.74–48.32, z 0–5.32 | 6-seat desk island, no plant divider. Chairs on both sides; 0.65 m from the outer chairs to the white closets |
| White closets | x 49.5–49.95, z 0.45–5.95, 2.1 m high | Against the end wall (x = 50) behind desk 9, from wall A (past the corner pillar) to the emergency door. 7 double-door units with handles |

### Side B: kitchen (laminate), U-shaped, next to Boekentoren

The Boekentoren's solid corridor wall (z = 7.68) continues past the kitchen and **stops at the end of the bar (x = 42.35)**. It runs behind the corridor-side counter and the bar, so the kitchen is reached from the open side B area (x > 42.35).

| Part | Position | Contents |
|---|---|---|
| Appliance counter, against the Boekentoren wall | x 39.03–39.73, z 7.68–13 | From the corridor toward wall B: **sink** (with storage above), **fridge**, **microwave + storage**, **worktop** |
| Corridor-side counter | x 39.73–41.65, z 7.68–8.38 | Worktop with storage above, against the corridor wall |
| Bar | x 41.65–42.35, z 7.68–11.34, 1.1 m high | Starts at the corridor wall, runs toward side B. 3 bar stools on the outside |
| Kitchen seating | x 42.35–50, z 7.68–13 | **White** tables and **white** chairs, 0.9 m deep: one 1.8 m six-seat table under the stairs and one long 12-seat table along wall B |
| Table under the stairs | x 44.375–46.175, z 8.55–9.45 | Under the staircase; starts in line with the long table (x = 44.375). Chairs sit either side of the stair |
| Long table along wall B | x 44.375–47.975, z 11.35–12.25 | Two 1.8 m six-seat tables joined end to end (3.6 × 0.9 m, 12 seats). Between the bar and the drinks storage; chairs on the wall side keep ≈ 0.3 m to wall B |
| Drinks storage | x 49.1–50, z 7.03–13 | Small room at the end of the kitchen (0.9 m deep), against the end wall, from the emergency door to wall B. **Empty** for now. Doorway on the right (wall B end), z 11.6–12.5; own ceiling at 2.6 m |
| Dartboard | On the kitchen side of the drinks storage wall (x ≈ 49), centre z = 10.4, bull at 1.73 m | Centred on the aisle between the table under the stairs and the long table. No backing, throw line on the floor 2.37 m away (x ≈ 46.66) |

## Mezzanine (upper level, x 39.03–43.35)

An upper level above the couch corner, the corridor and the kitchen. It does **not** go over HR or Boekentoren: the rooms start at their wall (x = 39.03). The rooms are as deep as the kitchen (x 39.03–42.35, ending in line with the end of the bar), and the walkway starts at the end of the bar.

| Item | Value |
|---|---|
| Floor level | **3.0 m**, **blue carpet** in both rooms and on the walkway, slab underside 2.75 m (ceiling of the couch corner, corridor and kitchen below). HR and Boekentoren keep their 2.6 m ceiling, with the open roof above them as before |
| Back wall | x = 39.03, from the mezzanine floor up to the roof curve |
| Knee walls | Along x at z = 2.0 and z = 11.0, from the 3.0 m floor up to the roof (≈ 1.6 m high). They hide the low part of the curved roof. |
| **Graslei** | x 39.03–42.35, z 2.0–6.5 (side A half, 4.5 m wide). Blue carpet. Table 2.4 × 1.0 m (long side along z) with 6 chairs, **TV on the shared middle wall** (z = 6.5), at the end of the table |
| **Korenlei** | x 39.03–42.35, z 6.5–11.0 (side B half, 4.5 m wide). Mirror of Graslei |
| Wall between the rooms | z = 6.5, up to the roof peak |
| Fronts | At x = 42.35. Glass door 0.96 m wide next to the middle wall (Graslei z 5.39–6.35, Korenlei z 6.65–7.61), **fixed glass** beside the door up to door height (Graslei z 3.72–5.39, Korenlei z 6.55–6.65 and 7.61–9.28); the **outer panel, where the roof curve comes down, is wall** (Graslei z 2.05–3.72, Korenlei z 9.28–10.95) (5.1 m, i.e. 2.1 m above the upstairs floor; lower near the knee walls where the roof comes down), and a **solid wall above the door across the full width** up to the roof curve. Metal frames. Outside the walkway, Graslei's glass (z 3.72–5.39) looks out over the couch corner |
| Walkway | x 42.35–43.35 (1 m), from the stairs (z = 9.5) to the Graslei door (z = 5.39). Blue carpet. Nothing beyond the stairs on side B (no walkway, no wall) |
| Railing | Metal, 1.0 m high, with vertical bars. Along x = 43.35 from z 5.39 to the stairs (z 8.5), and across both walkway ends (z = 5.39 at the Graslei door, z = 9.5 next to the stairs) |

### Metal staircase

| Item | Value |
|---|---|
| Position | z 8.5–9.5 (1 m wide), from the walkway edge x = 43.35 down toward x = 50, landing at x = 47.6 |
| Steps | 16 risers of 0.1875 m, 15 treads with ≈ 0.283 m going (run 4.25 m, ≈ 33.5°). Open metal treads, metal side stringers |
| Handrails | Metal, 1.0 m above the steps on both sides |
| Under the stairs | The six-seat table (see kitchen seating) |

## 3e verdiep (one floor below, x 28–50)

A copy of the **Entrance** and the **Stille ruimte** footprint: walls plus a copy of the toilets and six rooms (Kitchen (3e), Belfort and Service Desk on side B; Vlasmarkt, Dulle Griet and Gravensteen on side A) (Kitchen (3e) and Belfort); no furniture, kitchen, desks, meeting rooms, mezzanine, drinks storage or decoration. Flat **2.6 m ceiling** everywhere (no curved roof), open only above the stairs.

| Item | Value |
|---|---|
| Floor level | y = −3.06 (3.06 m below the 4e). Ceiling at y = −0.46; the slab up to the 4e floor above it |
| Floors | **Blue carpet everywhere**, except stone tile in the stairwell, the stair hallway and the toilets |
| Long walls (A and B) | x 28–50, same 1 m wall / 1.5 m window band / wall above, up to the slab. Pillars at x 28, 35, 42 and 50 (not sticking into the toilets). In wall A the stairwell has the big double-height window instead (x 30.0–34.65) |
| End wall x = 50 | Solid with the glass emergency door in the centre (z 6.02–6.98) |
| **Entrance (3e)** (x 28–35) | Same walls as upstairs: stairwell wall z = 3.14 with door, stair hallway, 2 lifts with doors, toilet walls (Men, Ladies, Utility, toilet corridor). **Toilets copied from the 4e** (Men: corner cubicle, 3 urinals, washbasin + mirror, corner block; Ladies: 2 cubicles, washbasin + mirror, corner block; window band closed) but with **light gray tiles** instead of green. West wall x = 28: double door with **both leaves closed** (nothing beyond is built) |
| Wall x = 35 | Double door like upstairs: leaf nearest the lifts closed, the other open |
| **3e verdiep** (x 35–50) | **Corridor 3.36 m wide (z 4.82–8.18, 0.5 m wider per side than upstairs)** from the Entrance (x = 35) to a **cross wall at x = 43.06**; four rooms between the pillars x 35 and 42 (two per side) and two rooms at the end (x 42–50) (the HR / Boekentoren room walls from upstairs are not built) |
| **Kitchen (3e)** | x 35–38.0 (3.0 m), z 8.18–13 (side B, next to the Entrance / Ladies). Wall to Belfort at x = 38.0. Door on the corridor x 36.02–36.98 (centred), sign beside it. Contents: see below |
| Kitchen (3e) contents | **Right wall** (x = 35, seen from the corridor), from left to right: **kitchen counter** z 9.98–12.55 (0.6 m deep, 0.9 m high, white units, dark worktop, stops at the pillar) with a **coffee machine** (z ≈ 12.0–12.35), a free **worktop** (z ≈ 11.0–11.9) and a **sink** with tap (z 10.2–10.85), **white wall cabinets** above (1.5–2.2 m). Then **≈ 1 m of free wall** (z 8.98–9.98) with a **dartboard** (bull at 1.73 m, z 9.48), throw line 2.37 m out (x ≈ 37.44). **Standalone fridge** in the right corner by the corridor wall (x 35.05–35.75, z 8.28–8.98, 1.85 m). **Whiteboard** on the left wall (x = 38, shared with Belfort), z 10.0–12.0. **2 round standing tables** (Ø 0.7 m, 1.07 m high) at (36.85, 10.6) and (36.85, 12.1) |
| **Belfort** | x 38.0–42 (4.0 m), z 8.18–13 (side B, up to the pillar at x = 42). Wall at x = 42. Door on the corridor x 39.52–40.48 (centred), sign beside it. **TV** (1.65 m wide, wall-mounted) on the Kitchen side wall (x = 38), meeting table 2.4 × 1.0 m (x 39.0–41.4, z 10.09–11.09) with 6 chairs |
| **Vlasmarkt** | Mirror of Kitchen (3e) on side A: x 35–38.0 (3.0 m), z 0–4.82. Wall to Dulle Griet at x = 38.0. Door on the corridor (z = 4.82) x 36.02–36.98, sign beside it. Empty for now |
| **Dulle Griet** | Mirror of Belfort on side A: x 38.0–42 (4.0 m), z 0–4.82, up to the pillar at x = 42. Door on the corridor x 39.52–40.48, sign beside it. **TV** (1.65 m wide, wall-mounted) on the Vlasmarkt side wall (x = 38), meeting table 2.4 × 1.0 m (x 39.0–41.4, z 1.91–2.91) with 6 chairs |
| **Gravensteen** | Side A end room: x 42–50, z 0–4.82. Door on the corridor (z = 4.82) right next to Dulle Griet, x 42.05–43.01, sign above it. **Large TV** (2.0 m wide, wall-mounted) on the wall against Dulle Griet (x = 42). **One big meeting table** 5.5 × 1.95 m (x 43.4–48.9, z 1.45–3.4) filling the room, 7 chairs per long side and 1 at the far end (15 seats) |
| **Service Desk** | Side B end room: x 42–50, z 8.18–13, plus x 43.06–50 from z = 4.82 (made bigger: the wall to Gravensteen is in line with the Gravensteen door). Door on the corridor (z = 8.18) right next to Belfort, x 42.05–43.01, sign above it. Contains the **glass emergency door** in the end wall (z 6.02–6.98). Contents: see below |
| Service Desk contents | Laid out after the team's seat plan (17 seats, every desk with a PC screen and chair; desks 0.7 m deep), spread out over the bigger room with ≈ 1.25 m between facing chairs. **Seats 1–4**: 4 desks of 1.75 m in a row against wall B (x 42.5–49.5, z 12.25–12.95), users facing the wall. **Island 1** (seats 6–11): 3 × 2 desks of 1.55 m back to back, x 43.9–48.55, z 9.0–10.4; **seat 5**: end desk x 48.55–49.2 (crosswise), user facing the island. **Island 2** (seats 12–17): same, x 43.9–48.55, z 5.75–7.15. **Dark gray cabinet** (1.1 m high) on the wall shared with Belfort (x = 42), z 9.85–11.25, with a **wall-mounted TV** (1.25 m wide) above it. Walking room along the cross wall, between all rows and along the end wall to the emergency door |
| Room fronts on the corridor | Vlasmarkt, Dulle Griet, Kitchen (3e) and Belfort: a **short solid wall piece where a room wall meets the front** (0.25 m on each side of the wall at x = 38, i.e. x 37.75–38.25, and 0.25 m at the pillar end, x 41.75–42), so no wall end is seen through glass. The windows of Kitchen and Vlasmarkt run **right up to the Entrance wall** (x = 35). Windows on both sides of each door: 1 m of wall, glass from 1.0 to 2.1 m (door height), wall above up to the 2.6 m ceiling, metal frames. Windows at x 35.05–36.02, 36.98–37.75, 38.25–39.52 and 40.48–41.75. Gravensteen and Service Desk keep solid walls |
| Corridor end / room divider | Wall across the corridor at x = 43.06 (z 4.82–8.18), joining the ends of the two doors. Dividing wall between Gravensteen and Service Desk at **z = 4.82**, in line with the Gravensteen door / corridor wall, from x = 43.06 to the end wall; the emergency door belongs to Service Desk |
| Stairs | Arrive from flight B of the U-stair next to the stairwell door (x 33.95–35). Since there is no floor further down, the **space under flight A** (the flight up to the 4e) is **closed off by a wall** at x = 33.86, in line with the stair hallway wall (z 1.57–3.14, from the 3e floor up to the underside of flight A), so on the 3e you only see the stairs going up. The space under the half landing is closed off too |

## Doors (both floors)

Every doorway has a real door leaf that swings into its room (hinged at the side nearest a wall where possible). **4e verdiep: gray doors** (same color as the metal profiles); **3e verdiep: white doors**. Exceptions on both floors: **stairway doors** (Stairwell, Stair hallway) are **blue**; **toilet doors** (Men, Ladies) and **Utility** are **green**. On the 4e the **Boekentoren** and **Server room** doors are **white**, and **Graslei / Korenlei** have **glass doors** in a gray frame. The 3e Kitchen door opens inward, hinged on the Belfort side. Doors start **closed** and block the way; in the 3D model a prompt appears when you stand in front of one (**"Press E to open / close · room name"**, tap the prompt on touch screens).

| Floor | Doors |
|---|---|
| 4e | CEO, Management, Rabot, Prinsenhof, Print, Portus Ganda (all up to the ceiling); Server room, Admin storage, Stair hallway, Stairwell, Men, Ladies, Utility, Duivelsteen (HR), Boekentoren, Drinks storage (opens out into the kitchen); Graslei and Korenlei on the mezzanine |
| 3e | Stairwell, Stair hallway, Men, Ladies, Utility, Vlasmarkt, Dulle Griet, Gravensteen, Kitchen (3e), Belfort, Service Desk |

Not changed: the double doors at x = 28 / 35 (plain white, fixed as before), the lift doors, the glass emergency doors, the phone-booth glass doors and the toilet cubicle doors.

## Open questions / assumptions

- CEO front: "tempered glass" interpreted as the same milk glass as Portus Ganda. To confirm.
- Floors of Print, Admin storage and Server: assumed carpet. Print and Server are confirmed.
- Stairwell: drawn as a U-stair with a half landing so it arrives on the 3e next to the stairwell door. To confirm.
- Floor-to-floor height 4e → 3e: 3.06 m (3e ceiling at 2.6 m). To confirm.
- Ceiling lights: generic panels and hanging light strips under the curved roof.
- Flat ceiling kept at 2.6 m after the window change (windows now end at 2.5 m, just under it). To confirm.
- End walls: the curved glass starts at 3.1 m (the top of the long walls); below that the end wall is solid apart from the emergency door. Emergency door width 0.96 m is the default. To confirm.
- Mezzanine: rooms widened to 4.5 m each (knee walls at z 2.0 / 11.0, ≈ 1.6 m high) and room doors next to the middle wall. Furniture in Graslei / Korenlei is a guess. To confirm.
- Phone booth numbering (1 = corridor end) is a guess. To confirm.
- Men's room tiles: "walls are green tiles, except for inside the toilet itself that is green tile" — drawn as green tiles everywhere, including inside the cubicle. To confirm what the exception should be.
- 3e verdiep: only the Entrance and Stille ruimte part (x 28–50) is built; the rest of that floor is not described yet. Room names on the 3e other than "Entrance (3e)" and "3e verdiep" are not known.
