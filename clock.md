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
| Night       | Fire alarm                  | rare                               |       |
| Night       | Spooky event                | rare                               |       |
| Night       | Burglar alarm               | rare                               |       |
| Night       | Server room alert / on-call | sometimes                          | 12 IT alerts, e.g. "Disk C: on SQL-PROD-01 is 96% full"; red lamp blinks above the server door, beeps |
| 17:30–19:00 | Cleaners vacuuming *(added by Claude)* | sometimes (70%)         | Vacuum sound moving around one area |
| 18:00–23:00 | A Teams call rings at an empty desk *(added)* | sometimes (40%)  | Sound only |
| 02:00       | Nightly build *(added)*     | always                             | Banner, server fans louder; at 02:25 succeeded (80%) or "failed: 4 tests red. Fun stand-up tomorrow" |
| 03:00       | Windows Update restarts every PC *(added)* | sometimes (25%)     | All monitors glow blue for half an hour |
| Night       | Building creaks *(added)*   | always                             | Random creaks when it's quiet |
| Fri 16:30   | Someone deploys to production on a Friday *(added)* | rare (15%) | Banner only, for now |

Only one of fire / burglar / spooky can happen per night. Everything is random but the same for every player (seeded by the game day).

- **Fire alarm:** two-tone alarm everywhere, red pulsing light, all TVs turn red with "Leave the building via the stairs".
- **Burglar alarm:** siren, lights flash red/blue.
- **Spooky:** lights flicker, whispers, footsteps, creaks, the printer prints one page by itself, a door near you opens or slams shut. Banner: "👻 Did you hear that?"

## 7. Light and atmosphere

- **Daylight through the windows follows the clock?** Yes
- **Sunrise / sunset times:** follow the real season
- **Ceiling lights:** on 7:00–19:00, motion sensor after that
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

Add to the address: `?t=vr-08:55` jumps to that game time, `?speed=20` runs the clock 20× faster (only in your own browser). In the browser console: `CLOCK.trigger('fire')` (or `burglar`, `spooky`, `server`, `cleaners`, `winupdate`) starts an event now, and `CLOCK.events()` lists today's and tonight's events.
