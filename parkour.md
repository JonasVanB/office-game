# Rooftop parkour – layout and build notes

An outdoor time-trial course around and on top of our building ([parkour.js](parkour.js)). The movement is first-person, fluid and built on momentum: wall runs, vaults, ledge grabs, wall climbs, slides, rolls and a zipline. **Yellow means touch this:** every ledge, wall-run panel, climb strip, obstacle top and the zipline on the route is yellow. Everything around it is grey, white or concrete.

Coordinates follow [layout.md](layout.md): x 0 → 50 along the building, z 0 (side A) → 13 (side B), y = 0 is the 4e floor. The outer walls stand at x −0.25 / 50.25 and z −0.25 / 13.25.

## The roofs

| Roof | Where | Height |
|---|---|---|
| Flat roof (new, gravel) | x 14–35 | top **3.2**. The concrete pillars at x 21 and 28 stick out 0.45 m (steppable stubs) |
| Curved roofs (outer skin, standing seams) | x −0.32–14 and 35–50.32 | y = 3.4 + 2.9·(1 − ((z − 6.5)/6.82)²): **6.3** at the ridge, 3.4 at the eaves |

## The route

Start at the **east** emergency door, run over the neighbour's roof, go west along the side A facade, climb onto our roof, cross it, go up onto the west curved roof, run along its ridge and take the zipline down to a finish pad next to the race deck. From there you walk back in over the race bridge.

| # | Section | Where | What you do |
|---|---|---|---|
| 0 | **Start balcony** | x 50.25–53.5, z 4.5–8.5, y 0 | Press E at the east emergency door (inside) to step out. The timer starts at the **start line, x = 52**. A leaderboard hangs on the end wall (z 9–12.4) |
| 1 | **The Gap** | x 53.5 → 56 | Jump 2.5 m onto the neighbour's roof (y −0.8) |
| 2 | **Neighbour roof** | x 56–70, z −10…11 | Vault the AC unit (x 60.5–61.5, 1 m tall). The plant room (x 65–70) turns you south. Slide under the duct (z 0.6–1.2, 0.95 m clearance), turn west, vault the second AC unit, then jump 2.5 m from the yellow edge at x 56 to the landing platform |
| 3 | **Facade run** ⚑1 | Side A, gantries at y −0.4, z −1.0…−0.25 | Landing platform x 50.25–53.5 (z −4…), a wide gantry round the corner (x 47.8–50.25), then gantries x 46–47.8, 37.5–42 and 28–33. **Wall-run panels** cross the gaps x 42–46 and x 33–37.5. Vault the cleaning cart at x 38.9–39.4. Checkpoint 1 is on the middle gantry |
| 4 | **The Climb** | x 29.3–30.7 | A yellow climb strip on the facade: face the wall, jump to wall-climb, then grab the yellow roof edge at 3.2 m |
| 5 | **Rooftop flow** ⚑2 | Flat roof | Vault the HVAC unit (x 26–27) and slide under the pipe bridge (x 22.4–22.9, 0.95 m clearance). Checkpoint 2 is between the pipe and the lift motor room |
| 6 | **The Chimney** | x 14–19 | Jump at the lift motor room (x 16.2–19, top 5.0) and grab its yellow edge. Run across it and jump to the yellow gable top of the west curved roof (6.3 m) |
| 7 | **Ridge run** ⚑3 | x 13.8 → −0.25 | A 1.2 m grating walkway on the ridge (top 6.38). Vault the ridge vent at x 7 |
| 8 | **Zipline** | (0.2, 8.3, 6.6) → (−6.6, 3.45, 11.7) | Run or jump off the end of the walkway: you grab the cable automatically and ride it down at up to 14 m/s. Space lets go early |
| 9 | **Finish pad** | x −8.2…−5.25, z 8.7–14.4, y 0 | Land on the yellow-and-black pad to stop the clock. The results card and a second leaderboard (facing the pad) appear |

⚑ = checkpoint (yellow lamp, green once passed). Falling below y −4.5 fades the screen and puts you back at the last checkpoint. The timer keeps running and the fall is counted.

**Times:** a scripted, perfect-input run takes **14.7 s**. Expect about 25–40 s for a good human run, and a minute or more for a first try.

## Movement

| Move | Input | Behaviour |
|---|---|---|
| Run | W | Momentum: 5.6 m/s quickly, then up to **7.8 m/s** after about 1.5 s of running straight. Walls, hard landings and stopping reset it. Shift = walk |
| Jump | Space | 5.7 m/s up. Holding Space jumps higher (lighter gravity going up). **Coyote time** 0.12 s, **jump buffer** 0.15 s. Low air control, so momentum carries you |
| Vault | automatic when running (or Space) | Obstacles 0.42–1.3 m high: over it if it is ≤ 1.9 m deep, otherwise a quick hop onto it. Keeps ~97% of your speed. Also works from a standstill when you push forward against it |
| Ledge grab + mantle | automatic | An edge 0.5–2.35 m above your feet, in front of you, while in the air: grab and pull up (0.2 s + 0.1 s per metre) |
| Wall run | jump alongside a wall, holding W | At ≥ 3.8 m/s and mostly parallel to the wall: a short arc (about 0.5 m up, max 1.3 s) with the camera tilted. Space kicks off at an angle. Something low ahead on the wall run: you vault onto it |
| Wall climb | Space while running at a tall wall (or run into it in the air holding W) | About 2 m up the wall. A ledge in reach is grabbed. Space during the climb turns you around and kicks you off |
| Slide | C while running | Low and fast under 0.95 m gaps. Keeps going while you hold C, and speeds up on the curved roofs |
| Roll | C just before a big landing | Landing from more than ~2 m: with C you roll and keep your speed. Without a roll, a landing at more than 12.5 m/s staggers you |
| Zipline | jump or run off into the cable | Snaps on within ~1 m of the cable. Space lets go |
| Respawn | R / hold R | R = back to the last checkpoint · hold R (0.7 s) = restart at the start |
| Leave | E | On the balcony: back inside. After the finish: walk on from the race deck |

**Feel:** the FOV widens with speed (up to +15°), with head bob and footsteps in step, a landing dip that scales with the impact, camera roll on wall runs, a dip on vaults and mantles, a smooth turn on a climb kick-off, speed lines, wind noise that grows with speed, and a zipline trolley sound. The sounds live in sound.js: pkStep, pkLand, pkGrab, pkSlide, pkCheck, pkFinish, plus the wind and zip loops.

**Touch:** left half = move stick, right half = look, plus Jump (hold for higher) and Slide buttons.

## Leaderboard, ghost and achievements

- **Shared:** `parkour/<account id>` = {t (ms), n, s (splits), d}, through `G.mp.parkour` in mp.js. Firebase only accepts 8 s – 30 min and never a slower time than the one stored (database.rules.json). Local test mode keeps it in localStorage
- **In the world:** leaderboards on the east wall by the balcony and at the finish pad (top 10, your row highlighted)
- **HUD:** time, checkpoint count, best time and speed. Each checkpoint flashes your split versus your PB (green −, red +)
- **Ghost:** your best run is recorded every 0.1 s (localStorage `office.parkour`) and replays as a translucent runner
- **Achievements (progress.js, "Parkour"):** Free runner (step out), Rooftop run (finish), Quick feet (< 30 s), Flow state (< 20 s), No safety net (no falls), Beat the ghost (new PB), King of the roof (#1), Wall runner (50 wall runs)

## Build

- `parkour.js` builds the course and has its own 3D physics. Solids are axis-aligned boxes plus the curved roofs as a height function (`roofF`). It takes `GAME.controlLock` while you are outside, sets the camera itself (roll, FOV) and reports your feet height through `GAME.feetY`
- `index.html` hooks: `GAME.feetY` (shared y + no stair/level switching while outside) and `GAME.zoneOverride` ("Rooftop parkour")
- Console helpers: `PARKOUR.enter()`, `PARKOUR.go(n)` (jump to checkpoint n), `PARKOUR.restart()`, `PARKOUR.me`
