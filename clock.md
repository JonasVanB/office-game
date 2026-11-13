# Game clock – template

Fill in or change whatever you like. Lines marked **(?)** are my suggestions or guesses; delete or overwrite them. Leave a field empty if you don't know yet.

---

## 1. Speed

How long does one game day take in real time?

- **Real minutes per game hour:** 5
  _(5 → a 7:00–17:00 day takes 50 real minutes; 6 → 1 hour)_
- **Does the clock run 24/7, or only the office hours?** 24/7, nights go faster
- **Real minutes per game hour at night (17:00–7:00):** 1
- **Does the game skip weekends?** Yes, Friday 23:59 → Monday 0:00
- **Which day of the week does the game start on?** Follows a fixed cycle Mon→Fri for everyone

## 2. Office hours

- **Building opens:** 7:00
- **Office hours end:** 17:00
- **Building closes / alarm armed:** 19:00
- **Who is in early (7:00–8:00)?** Jonas and Wolf
- **Who stays late?**

## 3. Daily schedule (every working day)

| Time        | What happens                  | Where                  | Who      | What it looks/sounds like in the game        |
| ----------- | ----------------------------- | ---------------------- | -------- | -------------------------------------------- |
| 7:00        | Building opens, lights on     | Whole office           | –        | Lights switch on floor by floor              |
| 8:00–9:00   | Most people arrive            | Entrance, lifts, desks | Everyone | NPCs walk in from the lifts                  |
| 9:00-9:30   | Coffee                        | Kitchen (3rd floor)    | Everyone | Announcement / bell, NPCs walk to the coffee |
| 12:00–13:00 | Lunch                         | Kitchen (4th floor)    | Everyone | Announcement / bell                          |
| 15:00       | Afternoon dip / second coffee | Kitchen (3rd floor)    | Everyone | Announcement / bell                          |
| 17:00       | End of office hours           |                        |          | NPCs pack up and leave                       |
|             |                               |                        |          |                                              |

## 4. Weekly schedule

| Day       | Time        | What happens       | Where               | Who      | Notes |
| --------- | ----------- | ------------------ | ------------------- | -------- | ----- |
| Monday    |             |                    |                     |          |       |
| Tuesday   |             |                    |                     |          |       |
| Wednesday |             |                    |                     |          |       |
| Thursday  |             |                    |                     |          |       |
| Friday    | 15:00       | Team meeting       | Portus Ganda        | Everyone |       |
| Friday    | 11:30–12:30 | Friday fries       | Kitchen (4th floor) | Everyone |       |
| Friday    | 16:00       | After work + games | Stille ruimte       | Everyone |       |

## 5. Monthly / special days (optional)

Nothing yet

## 6. After hours (17:00 – 7:00)

| Time        | What can happen             | Chance (always / sometimes / rare) | Notes |
| ----------- | --------------------------- | ---------------------------------- | ----- |
| 17:00–19:00 | Some people stay late       | always                             |       |
| 19:00       | Alarm armed, lights off     | always                             |       |
| 21:00–03:40 | Fire alarm                  | rare (7%)                          | ~2 real minutes |
| 22:30–00:30 | Spooky night                | sometimes (15%)                    | ~3.5 real minutes |
| 20:20–04:00 | Power failure *(added)*     | sometimes (12%)                    | ~75 real seconds; can happen on top of other events |
| 22:00–03:40 | Burglar alarm               | rare (8%)                          | ~2 real minutes |
| 20:00–04:40 | Server room alert / on-call | sometimes (35%)                    | 12 IT alerts, e.g. "Disk C: on SQL-PROD-01 is 96% full" |
| 17:20–19:00 | Cleaners *(added by Claude)* | often (70%)                       | A cleaner walks around one area with a vacuum; a cart with a bucket and mop |
| 18:00–23:00 | A Teams call rings at an empty desk *(added)* | sometimes (40%)  | Sound only |
| 02:00       | Nightly build *(added)*     | always                             | Banner, server fans louder; at 02:25 succeeded (80%) or "failed: 4 tests red. Fun stand-up tomorrow" |
| 03:00       | Windows Update restarts every PC *(added)* | sometimes (25%)     | All monitors glow blue for half an hour |
| Night       | Building creaks *(added)*   | always                             | Random creaks when it's quiet |
| Fri 16:30   | Someone deploys to production on a Friday *(added)* | rare (15%) | Banner only, for now |

Only one of fire / burglar / spooky can happen per night. Everything is random but the same for every player (seeded by the game day).

Every big event has a clear start banner (what and where), a line under the clock while it lasts, and an ending banner. The ghosts, the burglar and the cleaner are in the same place for every player; only the scares are per player.

- **Spooky night** 👻: "The office is haunted tonight!". Ghost orbs drift around you and now and then a ghost face appears at a window with a whisper. Four glowing sheet ghosts float along the Landscape, the meeting corridor, the Stille ruimte corridor and the 3e corridor, through doors and walls. Come within 2 m and the ghost rushes at you with a moan and vanishes, coming back 10 s later. The office turns dark and cold blue with purple fog, the lights barely work and keep flickering, TVs show static with a ghost face now and then, a low drone and wind play, plus whispers, footsteps, creaks, evil laughs, the printer printing by itself and doors opening or slamming by themselves (for everyone). The clock turns purple: "👻 Haunted until 02:30". Ends with "🌅 The ghosts are gone… for now".
- **Fire** 🔥: starts in one of three places, each with a cause: the printer in the Print room, the toaster in the 4e kitchen or the coffee machine in the 3e kitchen. Flames, embers and an orange glow; black smoke rises to the ceiling and spreads; the floor fills with smoke (thicker the closer you are); crackling; red flashing beacons near the exits; two-tone alarm; red pulsing light; TVs show "FIRE ALARM". Getting close gives "It's getting really hot here. Get out!". After about 2 minutes: "🚒 The fire brigade put out the fire".
- **Burglar** 🚨: a burglar in black with a beanie, a mask, a loot sack and a flashlight (beam on the floor) sneaks up and down the 4e. Get within 4.5 m and he runs off ("The burglar spotted you and ran off!"). Siren, red/blue flashing beacons. Ends with "🚓 The police caught the burglar".
- **Server room alert** 🖥️: a rotating red beacon above the server room door, a red glow in the server room, beeps, and all TVs show the alert. Ends with "✅ Server alert resolved".
- **Power failure** ⚡: the whole office goes pitch dark. Green emergency lights and exit signs glow, PCs and TVs go off, and the UPS in the server room beeps. Press **F** for your flashlight (on phones it switches on by itself). The clock shows "⚡ Power failure until … · F: flashlight". Ends with "💡 Power is back".
- **Flashlight** 🔦: F toggles it any time, handy at night when the motion-sensor lights are off.

## 7. Light and atmosphere

- **Daylight through the windows follows the clock?** Yes
- **Sunrise / sunset times:** follow the real season
- **Ceiling lights:** on 7:00–19:00 (4e at 7:00, 3e at 7:10). After 19:00 a motion sensor: the lights stay on while you move and fade out after 60 s standing still; they flicker once when they switch back on. No flickering while walking from room to room. The clock always says what the lights are doing: "💡 motion-sensor lights", "💡 lights off: walk to turn them on", "👻 Haunted · lights failing" or "⚡ Power failure".
- **Sounds:** coffee machine, keyboards, printer, lift bell, plus *(added)*: office PA chime for announcements, air conditioning hum, people murmuring (louder at coffee, lunch, the meeting and after work), server room fans, Teams ringtone, cleaners' vacuum, night creaks, alarms. All sounds get quieter with distance and come from the left or right. M (or clicking the clock) turns sound on/off.
- **Implemented:** sky colour (night blue → dawn pink → day) follows the real sunrise and sunset in Ghent for today's date. Lights flick on like fluorescent tubes: 4e at 7:00, 3e at 7:10 ("floor by floor"). After 19:00 the lights switch on where you walk and go off after 45 s standing still. PC screens are on from 7:50 to 17:30.

## 8. On screen

- **Clock format:** `Fri 09:00` but in dutch
- **Where:** top right, next to the minimap
- **Announcements as a banner?** e.g. "☕ Coffee time!"
- **Can players see the week schedule somewhere?** on all the tv screens

## 9. Other ideas or rules

Done *(added by Claude)*:
- The clock shows what's happening now ("☕ Coffee · Kitchen (3e)") or what's next ("Next: 🥪 Lunch 12:00").
- A warning banner 5 game minutes before every event ("☕ Coffee in 5 minutes · Kitchen (3e)").
- Monday 7:00: "Monday again. The office is open", and at 9:05 "The coffee machine is working overtime today".
- Friday 17:00: "Office hours are over. After work continues in the Stille ruimte".
- The weekly TV screens show today's events (the current one highlighted) and the week with icons.

Later, once NPCs exist:
- NPCs follow the schedule: arrive from the lifts 8:00–9:00, walk to the coffee, sit in the Friday meeting, leave at 17:00.
- Jonas and Wolf already in at 7:00 (section 2).
- Being in the right room at the right time (coffee, meeting) could give points or unlock things.

## Testing the clock

Add to the address: `?t=vr-08:55` jumps to that game time, `?speed=20` runs the clock 20× faster (only in your own browser). In the browser console: `CLOCK.trigger('fire')` (or `burglar`, `spooky`, `server`, `cleaners`, `winupdate`) starts an event now, and `CLOCK.events()` lists today's and tonight's events. Best at night: `?t=ma-23:00`. `CLOCK.trigger('fire', 120, 1)` picks the fire spot (0 Print room, 1 4e kitchen, 2 3e kitchen).
