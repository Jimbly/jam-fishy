Game Jam - Fishy
============================

Worlds FRVR Game Jam - Fishy Entry by Jimbly - "Fish for Catfish"

* Play here: [dashingstrike.com/LudumDare/fishy/](http://www.dashingstrike.com/LudumDare/fishy/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Start with: `npm start` (after running `npm i` once)

TODO:
* Text colors on each difficulty for: win and lose
* After finding all fish type, have a 1-time, unfailable "special" level, where you find your long lost friend, who stands with you from now on
* and/or: rework flow so that high score is time to catch each type of fish?
* Fish shadows / shark fins going back and forth
* Timing / Balance
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

* "Perfect" bonus (fish always needs to start under cursor?)
* Animate line flowing out during cast (shoot out and then interp from 45 degree angle to actual position?)
