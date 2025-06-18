const lobbyView = document.getElementById('lobby-view');
const gameView = document.getElementById('game-view');
const playerNameInput = document.getElementById('player-name-input');
const lobbyCodeDisplay = document.getElementById('lobby-code-display');
const joinCodeInput = document.getElementById('join-code-input');
const joinLobbyBtn = document.getElementById('join-lobby-btn');
const connectionStatus = document.getElementById('connection-status');
const gameRoomName = document.getElementById('game-room-name');
const textToType = document.getElementById('text-to-type');
const userInput = document.getElementById('user-input');
const playersProgress = document.getElementById('players-progress');
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
    peer = new Peer(peerConfig);
    peer.on('open', (id) => {
        lobbyCodeDisplay.textContent = id;
    });

    peer.on('connection', (newConn) => {
        isHost = true;
        conn = newConn;
        setupConnectionEvents();
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        connectionStatus.textContent = `Error: ${err.type}. Try refreshing.`;
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
            textToType.textContent = sentence;
            startGame();
        }
    });

    conn.on('data', (data) => {
        switch (data.type) {
            case 'name':
                opponentName = data.payload;
                gameRoomName.textContent = `Racing against ${opponentName}`;
                break;
            case 'sentence':
                textToType.textContent = data.payload;
                startGame();
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

function startGame() {
    userInput.disabled = false;
    userInput.value = '';
    userInput.focus();
    startTime = new Date().getTime();
    timerInterval = setInterval(updateTimer, 500);
    gameFinished = false;
    wpmDisplay.textContent = 'WPM: 0';
    timerDisplay.textContent = 'Time: 0s';
    playersProgress.innerHTML = '';
}

function updateTimer() {
    if (gameFinished) return;
    const elapsedTime = Math.floor((new Date().getTime() - startTime) / 1000);
    timerDisplay.textContent = `Time: ${elapsedTime}s`;
    const wpm = calculateWPM(userInput.value, elapsedTime);
    wpmDisplay.textContent = `WPM: ${wpm}`;

    if (conn) {
        const progress = (userInput.value.length / textToType.textContent.length) * 100;
        conn.send({ type: 'progress', payload: { wpm, progress } });
    }
}

function calculateWPM(text, elapsedTime) {
    if (elapsedTime > 0) {
        const typedWords = text.trim().split(/\s+/).filter(Boolean).length;
        return Math.round((typedWords / elapsedTime) * 60);
    }
    return 0;
}

function checkInput() {
    if (gameFinished) return;

    const originalText = textToType.textContent;
    const typedText = userInput.value;

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
    let opponentProgressDiv = document.getElementById(`progress-${conn.peer}`);
    if (!opponentProgressDiv) {
        opponentProgressDiv = document.createElement('div');
        opponentProgressDiv.className = 'player-progress-item';
        opponentProgressDiv.id = `progress-${conn.peer}`;
        opponentProgressDiv.innerHTML = `
            <div class="name">${opponentName || conn.peer}</div>
            <div class="progress-bar-container">
                <div class="progress-bar"></div>
            </div>
            <div class="wpm-display">WPM: 0</div>
        `;
        playersProgress.appendChild(opponentProgressDiv);
    }

    const progressBar = opponentProgressDiv.querySelector('.progress-bar');
    const wpmDisplay = opponentProgressDiv.querySelector('.wpm-display');

    progressBar.style.width = `${data.progress}%`;
    wpmDisplay.textContent = `WPM: ${data.wpm}`;
}

function handleOpponentFinished(result) {
    if (!gameFinished) {
        alert(`Opponent finished in ${result.time} seconds with ${result.wpm} WPM!`);
    }
    const opponentWpmDisplay = document.querySelector(`#progress-${conn.peer} .wpm-display`);
    if(opponentWpmDisplay) {
        opponentWpmDisplay.textContent = `Finished! WPM: ${result.wpm}`;
    }
}

function resetGame() {
    clearInterval(timerInterval);
    if (conn) {
        conn.close();
        conn = null;
    }
    userInput.disabled = true;
    userInput.value = '';
    textToType.textContent = '...';
    gameFinished = false;
    isHost = false;
}

joinLobbyBtn.addEventListener('click', joinGame);
leaveRoomBtn.addEventListener('click', switchToLobbyView);
userInput.addEventListener('input', checkInput);

initializePeer();