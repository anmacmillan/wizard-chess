// Lessons with Professor Owl. Each lesson is a position, a goal and a story.
// goal 'mate': any checkmating move wins.
// goal 'moves': play solution[0], the owl replies with solution[1], and so on.
// accept: other first moves that also count as right. hint squares glow on the board.
export const LESSONS = [
  {
    id: 'backrank', group: 'Checkmate patterns', title: 'The back-rank mate',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', goal: 'mate',
    intro: "Black's king is stuck behind its own pawns. Can you checkmate in one move with your rook?",
    hint: 'Rooks move in straight lines. Which square on the back row can your rook reach?', hintSq: ['e1', 'e8'],
    done: "Checkmate! The king's own pawns blocked its escape. Give your own king an escape square so this never happens to you.",
  },
  {
    id: 'queenmate', group: 'Checkmate patterns', title: 'Queen and king',
    fen: '7k/8/5K2/8/8/8/6Q1/8 w - - 0 1', goal: 'mate',
    intro: 'Your king and queen work as a team. Find checkmate in one move.',
    hint: 'Put the queen right next to the black king, on a square your own king protects.', hintSq: ['g2', 'g7'],
    done: 'The queen gives check, your king guards her, and every escape square is covered.',
  },
  {
    id: 'ladder', group: 'Checkmate patterns', title: 'The rook ladder',
    fen: '3k4/R7/8/8/8/8/8/1R4K1 w - - 0 1', goal: 'mate',
    intro: 'Two rooks can climb the board like a ladder. The rook on a7 guards the 7th row. Checkmate with the other one!',
    hint: 'The rook on a7 stops the king coming forward. Use the other rook on the back row.', hintSq: ['b1', 'b8'],
    done: "One rook guards a row while the other gives check on the next. That's the ladder mate.",
  },
  {
    id: 'smothered', group: 'Checkmate patterns', title: 'Smothered mate',
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', goal: 'mate',
    intro: "Black's king is surrounded by its own pieces. A knight can jump in for checkmate!",
    hint: 'Knights jump in an L shape, over other pieces. Which square gives check to the king on h8?', hintSq: ['g5', 'f7'],
    done: "Smothered! The king couldn't move because its own rook and pawns were in the way. Only a knight can do this.",
  },
  {
    id: 'scholar', group: 'Checkmate patterns', title: "Scholar's Mate",
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', goal: 'mate',
    intro: "Your queen and bishop are both aiming at f7, the weakest square next to Black's king. Find checkmate!",
    hint: 'The queen can capture on f7, and the bishop on c4 protects her there.', hintSq: ['h5', 'f7', 'c4'],
    done: "That's Scholar's Mate: checkmate in four moves! Now you know the trick, guard f7 when someone tries it on you.",
  },
  {
    id: 'fork', group: 'Tactics', title: 'The knight fork',
    fen: 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', goal: 'moves', solution: ['b5c7', 'e8e7', 'c7a8'],
    intro: 'A fork attacks two pieces at once. Find a knight move that checks the king AND attacks the queen.',
    hint: 'Look for a square where your knight attacks both e8 and a8.', hintSq: ['b5', 'c7'],
    mid: 'Check! The king has to move. Now take the queen!',
    done: 'You forked the king and queen, then won the queen. Knights are the best forkers in chess.',
  },
  {
    id: 'skewer', group: 'Tactics', title: 'The skewer',
    fen: '4r3/8/8/4k3/8/8/8/R5K1 w - - 0 1', goal: 'moves', solution: ['a1e1', 'e5d6', 'e1e8'],
    intro: 'A skewer attacks through one piece onto another behind it. Check the king so it must move, then win the rook behind it.',
    hint: 'Put your rook on the same line as the king and the rook.', hintSq: ['a1', 'e1'],
    mid: 'Check! The king steps aside. What can your rook take now?',
    done: 'A skewer: the king in front had to move, and the rook behind it was lost.',
  },
  {
    id: 'centre', group: 'Openings', title: 'Take the centre',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', goal: 'moves', solution: ['e2e4'], accept: ['d2d4'],
    intro: 'The four middle squares are the most important on the board. Start the game by putting a pawn in the centre.',
    hint: 'Move the pawn in front of your king, or your queen, two squares forward.', hintSq: ['d4', 'e4', 'd5', 'e5'],
    done: 'Great start! Pawns in the centre give your knights and bishops room to come out.',
  },
  {
    id: 'castle', group: 'Openings', title: 'Castling',
    fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', goal: 'moves', solution: ['e1g1'],
    intro: 'Castling moves your king to safety and brings a rook into the game, all in one move. Castle now!',
    hint: 'Tap your king, then the square two steps towards the rook.', hintSq: ['e1', 'g1'],
    done: 'Your king is tucked in the corner behind its pawns, and the rook is ready to fight. Try to castle early in every game.',
  },
  {
    id: 'promote', group: 'Special moves and endgames', title: 'Make a queen',
    fen: '8/4P3/8/8/8/k7/8/4K3 w - - 0 1', goal: 'moves', solution: ['e7e8q'], accept: ['e7e8r', 'e7e8b', 'e7e8n'],
    intro: 'When a pawn reaches the far side, it turns into any piece you like. Push this pawn and make a queen!',
    hint: 'Move the pawn one square forward to the last row.', hintSq: ['e7', 'e8'],
    done: 'A brand new piece! A pawn with no enemy pawns in its way is called a passed pawn, and it can win the game.',
  },
  {
    id: 'enpassant', group: 'Special moves and endgames', title: 'En passant',
    fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', goal: 'moves', solution: ['e5d6'],
    intro: "Black's pawn just jumped two squares to d5, right next to yours. You may capture it as if it had moved only one square. This is called en passant: French for 'in passing'.",
    hint: 'Move your pawn diagonally to d6, behind the black pawn.', hintSq: ['e5', 'd6'],
    done: 'En passant! You only get this chance on the very next move, so watch for it.',
  },
];
