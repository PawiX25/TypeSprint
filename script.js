const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const playerNameInput = document.getElementById('player-name-input');
const lobbyCodeDisplay = document.getElementById('lobby-code-display');
const joinCodeInput = document.getElementById('join-code-input');
const joinLobbyBtn = document.getElementById('join-lobby-btn');
const connectionStatus = document.getElementById('connection-status');
const gameRoomName = document.getElementById('game-room-name');
const myTextDisplay = document.getElementById('my-text-display');
const opponentTextDisplay = document.getElementById('opponent-text-display');
const userInput = document.getElementById('user-input');
const timerDisplay = document.getElementById('timer');
const wpmDisplay = document.getElementById('wpm');
const leaveRoomBtn = document.getElementById('leave-room-btn');

let peer;
let conn;
let playerName = '';
let opponentName = '';
let isHost = false;
let gameFinished = false;
let startTime;
let timerInterval;
let originalText = '';

const sentences = [
    "The quick brown fox jumps over the lazy dog.",
    "Never underestimate the power of a good book.",
    "The early bird catches the worm.",
    "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.",
    "The journey of a thousand miles begins with a single step."
];

const peerConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

function initializePeer() {
    peer = new Peer();

    peer.on('open', (id) => {
        lobbyCodeDisplay.textContent = id;
    });

    peer.on('connection', (newConn) => {
        if (conn) { 
            newConn.close();
            return;
        }
        isHost = true;
        conn = newConn;
        setupConnectionEvents();
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        connectionStatus.textContent = `Error: ${err.type}. Try a new code.`;
    });
}

function joinGame() {
    playerName = playerNameInput.value.trim();
    if (!playerName) {
        alert('Please enter your name.');
        return;
    }

    const joinCode = joinCodeInput.value.trim();
    if (!joinCode) {
        alert('Please enter a lobby code to join.');
        return;
    }
    
    if (conn) conn.close();

    isHost = false;
    conn = peer.connect(joinCode);
    setupConnectionEvents();
}

function setupConnectionEvents() {
    conn.on('open', () => {
        conn.send({ type: 'name', payload: playerName });
        switchToGameView();

        if (isHost) {
            const sentence = sentences[Math.floor(Math.random() * sentences.length)];
            conn.send({ type: 'sentence', payload: sentence });
            startGame(sentence);
        }
    });

    conn.on('data', (data) => {
        switch (data.type) {
            case 'name':
                opponentName = data.payload;
                gameRoomName.textContent = `Racing against ${opponentName}`;
                break;
            case 'sentence':
                startGame(data.payload);
                break;
            case 'progress':
                updateOpponentProgress(data.payload);
                break;
            case 'finished':
                handleOpponentFinished(data.payload);
                break;
        }
    });

    conn.on('close', () => {
        alert(`${opponentName || 'Opponent'} has left the game.`);
        switchToLobbyView();
    });
}

function switchToLobbyView() {
    gameView.classList.add('hidden');
    lobbyView.classList.remove('hidden');
    resetGame();
}

function switchToGameView() {
    lobbyView.classList.add('hidden');
    gameView.classList.remove('hidden');
    gameRoomName.textContent = 'Waiting for opponent...';
}

function populateTextDisplay(container, text) {
    container.innerHTML = '';
    text.split('').forEach(char => {
        const span = document.createElement('span');
        span.textContent = char;
        span.className = 'text-gray-400 relative'; 
        container.appendChild(span);
    });
}

function startGame(sentence) {
    originalText = sentence;
    populateTextDisplay(myTextDisplay, sentence);
    populateTextDisplay(opponentTextDisplay, sentence);

    userInput.disabled = false;
    userInput.value = '';
    userInput.focus();
    
    updateTextDisplay(myTextDisplay, '', 'my-view');

    startTime = new Date().getTime();
    timerInterval = setInterval(updateTimer, 500);
    gameFinished = false;
    wpmDisplay.textContent = 'WPM: 0';
    timerDisplay.textContent = 'Time: 0s';
}

function updateTimer() {
    if (gameFinished) return;
    const elapsedTime = Math.floor((new Date().getTime() - startTime) / 1000);
    timerDisplay.textContent = `Time: ${elapsedTime}s`;
    const wpm = calculateWPM(userInput.value, elapsedTime);
    wpmDisplay.textContent = `WPM: ${wpm}`;

    if (conn) {
        conn.send({ type: 'progress', payload: { wpm, typedText: userInput.value } });
    }
}

function calculateWPM(text, elapsedTime) {
    if (elapsedTime > 0) {
        const correctChars = text.split('').filter((char, index) => char === originalText[index]).length;
        const words = correctChars / 5;
        return Math.round((words / elapsedTime) * 60);
    }
    return 0;
}

function updateTextDisplay(container, typedText, viewType) {
    const spans = container.querySelectorAll('span');
    spans.forEach(span => span.classList.remove('cursor', `${viewType}`));

    typedText.split('').forEach((char, index) => {
        if (spans[index]) {
            spans[index].classList.remove('text-gray-400', 'text-green-500', 'text-red-500');
            if (char === originalText[index]) {
                spans[index].classList.add('text-green-500');
            } else {
                spans[index].classList.add('text-red-500');
            }
        }
    });

    if (typedText.length < originalText.length) {
        spans[typedText.length].classList.add('cursor', viewType);
    }
}

function checkInput() {
    if (gameFinished) return;

    const typedText = userInput.value;
    updateTextDisplay(myTextDisplay, typedText, 'my-view');

    if (typedText === originalText) {
        finishGame();
    }
}

function finishGame() {
    gameFinished = true;
    clearInterval(timerInterval);
    userInput.disabled = true;
    const finalTime = Math.floor((new Date().getTime() - startTime) / 1000);
    const wpm = calculateWPM(userInput.value, finalTime);
    const result = { time: finalTime, wpm: wpm };
    alert(`You finished in ${result.time} seconds with ${result.wpm} WPM!`);
    if (conn) {
        conn.send({ type: 'finished', payload: result });
    }
}

function updateOpponentProgress(data) {
    updateTextDisplay(opponentTextDisplay, data.typedText, 'opponent-view');
}

function handleOpponentFinished(result) {
    if (!gameFinished) {
        alert(`Opponent finished in ${result.time} seconds with ${result.wpm} WPM!`);
    }
    opponentTextDisplay.classList.add('opacity-50');
}

function resetGame() {
    clearInterval(timerInterval);
    if (conn) {
        conn.close();
        conn = null;
    }
    userInput.disabled = true;
    userInput.value = '';
    myTextDisplay.innerHTML = '';
    opponentTextDisplay.innerHTML = '';
    opponentTextDisplay.classList.remove('opacity-50');
    originalText = '';
    gameFinished = false;
    isHost = false;
}

joinLobbyBtn.addEventListener('click', joinGame);
leaveRoomBtn.addEventListener('click', switchToLobbyView);
userInput.addEventListener('input', checkInput);
playerNameInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        joinCodeInput.focus();
    }
});
joinCodeInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        joinGame();
    }
});

initializePeer();