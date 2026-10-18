# Wizard Chess

Chess for Manon, with stone pieces that smash each other. You play friends one move at a time from separate iPads.

Play: https://anmacmillan.github.io/wizard-chess/

## How it works

- Start a game, make your move, tap **Send move**, then **Send the invite** and pick Messages, Signal or WhatsApp from the share sheet.
- Or give your friend the six-letter game code (Menu shows it). They open the site, type it under **Join a friend's game** and tap their name.
- Moves save to a Firebase Realtime Database (project `wizard-chess-manon`, Belgium), so an open board updates by itself and any old link opens the latest position. **Nudge** sends a reminder.
- Without the database (empty `firebase-config.js`) the whole game travels in the link instead.
- Add it to the iPad home screen from Safari's share button. The home-screen app keeps its own list of games, so join games there with the code.
- "Both players on this iPad" turns the board round after each move instead.

## Live sync setup

Put the Realtime Database URL in `firebase-config.js`. Database rules (`database.rules.json`) allow reading and writing a single game by its id and nothing else.

## Credits

- Chess rules: [chess.js](https://github.com/jhlywa/chess.js) 1.0.0, BSD 2-Clause (licence header in `chess.js`).
- Pieces: "cburnett" set by [Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett), GPLv2+, via [Lichess](https://github.com/lichess-org/lila).
- Hero pieces: RPG Character Pack by [Quaternius](https://quaternius.com) (Quaternius Asset License: free to use in games, not to be redistributed as assets). Converted from glTF to GLB in `models/`.
