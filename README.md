Game Jam - Fishy
============================

Worlds FRVR Game Jam - Fishy Entry by Jimbly - "Fish for Catfish"

* Play here: [dashingstrike.com/LudumDare/fishy/](http://www.dashingstrike.com/LudumDare/fishy/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Start with: `npm start` (after running `npm i` once)

TODO:
* Play through whole game one, see how balance feels
* Post to itch.io and in Slack!
* Animate line flowing out during cast (shoot out and then interp from 45 degree angle to actual position?)

* Timing / Balance Notes
  * Catching a fish relatively easily: 22s
  * Catching a fish with difficulty: ?s (aim for 60s?)
  * Skills
    * Decrease gravity / "Stability"
    * Increase cursor size
    * Attract rare fish / "Rarity+"
    * Decrease progress fail speed
    * Increase progress bonus speed
    * Clingyness (attracts cursor to catch, will stay attached for a slow moving fish) - maybe part of gravity?
  * 3 skills @ 3 levels each, cost 1, 2, 4 SP each, total 7x5 = 35 SP
  * Want a 10 minute game session
    * That's only about 13 fish caught, maybe aim for 15 fish
    * Each fish gives 1-2 SP (1 for easy, 2 for hard), that works out