# Wizard Chess

Chess for Manon, with stone pieces that smash each other. You play friends one move at a time, sending each move by Signal (or any messaging app), the way you'd send an owl.

Play: https://anmacmillan.github.io/wizard-chess/

## How it works

- Start a game, make your move, tap **Send move**, then **Send the invite** and pick Signal from the share sheet.
- Your friend opens the link, sees your move arrive, makes theirs and sends it back.
- The whole game lives in the link. With live sync switched on (`firebase-config.js`), moves also save to a Firebase Realtime Database, so an open board updates by itself and an old link always opens the latest position.
- "Both players on this iPad" turns the board round after each move instead.

## Live sync setup

Put the Realtime Database URL in `firebase-config.js`. Database rules (`database.rules.json`) allow reading and writing a single game by its id and nothing else.

## Credits

- Chess rules: [chess.js](https://github.com/jhlywa/chess.js) 1.0.0, BSD 2-Clause (licence header in `chess.js`).
- Pieces: "cburnett" set by [Colin M.L. Burnett](https://en.wikipedia.org/wiki/User:Cburnett), GPLv2+, via [Lichess](https://github.com/lichess-org/lila).
