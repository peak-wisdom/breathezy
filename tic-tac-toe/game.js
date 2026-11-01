(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const key = 'still-xo-computer-v1';
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const order = [4,0,2,6,8,1,3,5,7];
  let state = {moves:[], human:'X', scores:{human:0,computer:0,draw:0}};
  let pending = null;
  function boardFor(moves) {
    const board = Array(9).fill('');
    moves.forEach((cell,index) => {board[cell] = index%2 === 0 ? 'X' : 'O';});
    return board;
  }
  function result(board) {
    for (const line of lines) if (board[line[0]] && line.every(cell => board[cell] === board[line[0]])) return {winner:board[line[0]], line};
    return board.every(Boolean) ? {winner:'draw',line:[]} : null;
  }
  function valid(saved) {
    if (!saved || !['X','O'].includes(saved.human) || !Array.isArray(saved.moves) || saved.moves.length > 9 || !saved.scores || !['human','computer','draw'].every(key => Number.isSafeInteger(saved.scores[key]) && saved.scores[key] >= 0)) return false;
    const seen = new Set();
    for (let i=0; i<saved.moves.length; i++) {
      const cell = saved.moves[i];
      if (!Number.isInteger(cell) || cell<0 || cell>8 || seen.has(cell) || result(boardFor(saved.moves.slice(0,i)))) return false;
      seen.add(cell);
    }
    return true;
  }
  try { const saved = JSON.parse(localStorage.getItem(key)); if (valid(saved)) state = saved; }
  catch { $('saveStatus').textContent = 'Play works for this visit. Browser storage is unavailable.'; }
  function save() {
    try {localStorage.setItem(key, JSON.stringify(state));}
    catch {$('saveStatus').textContent = 'Play works for this visit. Browser storage is unavailable.';}
  }
  function turn() { return state.moves.length%2 === 0 ? 'X' : 'O'; }
  // Explore every possible reply so the computer never overlooks a win or block.
  function bestMove(board) {
    const computer = state.human === 'X' ? 'O' : 'X';
    const memo = new Map();
    function score(mark) {
      const outcome = result(board);
      if (outcome) {
        const filled = board.filter(Boolean).length;
        return outcome.winner === 'draw' ? 0 : outcome.winner === computer ? 10-filled : filled-10;
      }
      const cacheKey = board.join('.')+mark;
      if (memo.has(cacheKey)) return memo.get(cacheKey);
      let value = mark === computer ? -Infinity : Infinity;
      for (const cell of order) if (!board[cell]) {
        board[cell] = mark;
        const next = score(mark === 'X' ? 'O' : 'X');
        board[cell] = '';
        value = mark === computer ? Math.max(value,next) : Math.min(value,next);
      }
      memo.set(cacheKey,value); return value;
    }
    let selected = -1, value = -Infinity;
    for (const cell of order) if (!board[cell]) {
      board[cell] = computer;
      const next = score(state.human);
      board[cell] = '';
      if (next > value) {value=next; selected=cell;}
    }
    return selected;
  }
  const cells = [];
  function render() {
    const board = boardFor(state.moves), outcome = result(board);
    $('humanMark').value = state.human;
    $('status').textContent = outcome ? outcome.winner === 'draw' ? "It's a draw! Play another round?" : outcome.winner === state.human ? 'You win! Three in a row.' : 'Computer wins! Try another round.' : turn() === state.human ? 'Your turn · '+state.human : 'Computer is thinking…';
    cells.forEach((button,index) => {
      button.textContent = board[index];
      button.disabled = Boolean(board[index] || outcome || turn() !== state.human);
      button.classList.toggle('winner', Boolean(outcome?.line.includes(index)));
      button.setAttribute('aria-label', 'Row '+(Math.floor(index/3)+1)+', column '+(index%3+1)+': '+(board[index] || 'empty'));
    });
    $('humanScore').textContent=state.scores.human; $('computerScore').textContent=state.scores.computer; $('drawScore').textContent=state.scores.draw;
  }
  function playMove(cell) {
    const board = boardFor(state.moves);
    if (cell<0 || board[cell] || result(board)) return;
    state.moves.push(cell);
    const outcome = result(boardFor(state.moves));
    if (outcome) state.scores[outcome.winner === 'draw' ? 'draw' : outcome.winner === state.human ? 'human' : 'computer']++;
    save(); render();
    if (outcome) $('newGame').focus();
  }
  function queueComputer() {
    if (pending !== null || result(boardFor(state.moves)) || turn() === state.human) return;
    pending = setTimeout(() => {
      pending = null;
      if (result(boardFor(state.moves)) || turn() === state.human) return;
      playMove(bestMove(boardFor(state.moves)));
    }, 350);
  }
  function newGame(resetScores=false) {
    if (pending !== null) clearTimeout(pending);
    pending=null; state.moves=[];
    if (resetScores) state.scores={human:0,computer:0,draw:0};
    save(); render(); queueComputer();
    if (state.human === 'X') cells[0].focus();
  }
  for (let index=0; index<9; index++) {
    const button=document.createElement('button'); button.type='button'; button.className='cell';
    button.addEventListener('click', () => {if (turn() !== state.human) return; playMove(index); queueComputer();});
    cells.push(button); $('board').append(button);
  }
  $('humanMark').addEventListener('change', () => {state.human=$('humanMark').value;newGame();});
  $('newGame').addEventListener('click', () => newGame());
  $('resetScores').addEventListener('click', () => newGame(true));
  render(); queueComputer();
})();
