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
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');
const gameStatus = document.getElementById('game-status');
const yourLobbyInfo = document.getElementById('your-lobby-info');
const myNameDisplay = document.getElementById('my-name-display');
const opponentNameDisplay = document.getElementById('opponent-name-display');

let peer;
let conn;
let playerName = '';
let opponentName = '';
let isHost = false;
let gameFinished = false;
let opponentFinished = false; 
let myResult = null;
let opponentResult = null;
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

function showModal(title, message, onclose) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('fade-in');
    modalCloseBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('fade-in');
        if (onclose) onclose();
    };
}

function setLobbyCode(id) {
    lobbyCodeDisplay.innerHTML = ''; // Clear "Loading..."
    id.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.animationDelay = `${index * 0.05}s`;
        lobbyCodeDisplay.appendChild(span);
    });
}

function initializePeer() {
    peer = new Peer();

    yourLobbyInfo.style.display = 'none';
    playerNameInput.addEventListener('input', () => {
        if (playerNameInput.value.trim()) {
            if (yourLobbyInfo.style.display === 'none') {
                yourLobbyInfo.style.display = 'block';
                lobbyCodeDisplay.classList.add('animate-code-display');
            }
        } else {
            yourLobbyInfo.style.display = 'none';
            lobbyCodeDisplay.classList.remove('animate-code-display');
        }
    });

    peer.on('open', (id) => {
        setLobbyCode(id);
    });

    peer.on('connection', (newConn) => {
        if (conn) { 
            newConn.close();
            return;
        }
        isHost = true;
        conn = newConn;
        playerName = playerNameInput.value.trim() || 'Host';
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
        showModal('Input Error', 'Please enter your name.');
        return;
    }

    const joinCode = joinCodeInput.value.trim();
    if (!joinCode) {
        showModal('Input Error', 'Please enter a lobby code to join.');
        return;
    }
    
    if (conn) conn.close();

    isHost = false;
    conn = peer.connect(joinCode);
    setupConnectionEvents();
}

function setupConnectionEvents() {
    conn.on('open', () => {
        connectionStatus.textContent = '';
        conn.send({ type: 'name', payload: playerName });
    });

    conn.on('data', (data) => {
        switch (data.type) {
            case 'name':
                opponentName = data.payload;
                opponentNameDisplay.textContent = opponentName;
                if (isHost) {
                    startGame();
                }
                break;
            case 'start-game':
                originalText = data.payload;
                startGame(originalText);
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
        showModal('Connection Lost', `${opponentName} has disconnected.`, resetToLobby);
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
    gameStatus.textContent = '';
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

function startGame(text) {
    gameFinished = false;
    opponentFinished = false;
    myResult = null;
    opponentResult = null;
    
    lobbyView.classList.add('hidden');
    gameView.classList.remove('hidden');
    gameView.classList.add('fade-in');

    myNameDisplay.textContent = playerName;
    opponentNameDisplay.textContent = opponentName || 'Opponent';

    if (isHost) {
        originalText = sentences[Math.floor(Math.random() * sentences.length)];
        conn.send({ type: 'start-game', payload: originalText });
    } else {
        originalText = text;
    }

    userInput.maxLength = originalText.length;

    userInput.disabled = true;
    userInput.value = '';
    
    populateTextDisplay(myTextDisplay, originalText);
    populateTextDisplay(opponentTextDisplay, originalText);

    updateTextDisplay(myTextDisplay, '', 'my-view');

    wpmDisplay.innerHTML = `WPM: <span class="font-mono">0</span>`;
    timerDisplay.innerHTML = `Time: <span class="font-mono">0s</span>`;
    startCountdown();
}

function startCountdown() {
    gameStatus.textContent = 'Get Ready...';
    setTimeout(() => {
        gameStatus.textContent = '3...';
    }, 1000);
    setTimeout(() => {
        gameStatus.textContent = '2...';
    }, 2000);
    setTimeout(() => {
        gameStatus.textContent = '1...';
    }, 3000);
    setTimeout(() => {
        gameStatus.textContent = 'GO!';
        beginTyping();
        setTimeout(() => {
            gameStatus.textContent = '';
        }, 1000); 
    }, 4000);
}

function beginTyping() {
    userInput.disabled = false;
    userInput.focus();
    startTime = new Date().getTime();
    timerInterval = setInterval(updateTimer, 500);
}

function updateTimer() {
    if (gameFinished) return;
    const elapsedTime = Math.floor((new Date().getTime() - startTime) / 1000);
    timerDisplay.innerHTML = `Time: <span class="font-mono">${elapsedTime}s</span>`;
    const wpm = calculateWPM(userInput.value, elapsedTime);
    wpmDisplay.innerHTML = `WPM: <span class="font-mono">${wpm}</span>`;

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
    if (gameFinished) return;
    gameFinished = true;
    clearInterval(timerInterval);
    userInput.disabled = true;
    const finalTime = Math.floor((new Date().getTime() - startTime) / 1000);
    const wpm = calculateWPM(userInput.value, finalTime);
    myResult = { time: finalTime, wpm: wpm };
    
    if (conn) {
        conn.send({ type: 'finished', payload: myResult });
    }

    if (opponentFinished) {
        showGameOverScreen();
    } else {
        showModal('Race Finished!', `You finished in ${myResult.time} seconds with ${myResult.wpm} WPM!\nWaiting for opponent...`);
    }
}

function updateOpponentProgress(data) {
    updateTextDisplay(opponentTextDisplay, data.typedText, 'opponent-view');
}

function handleOpponentFinished(result) {
    if (opponentFinished) return;
    opponentFinished = true;
    opponentResult = result;
    opponentTextDisplay.classList.add('opacity-50');

    if (gameFinished) {
        showGameOverScreen();
    } else {
        gameStatus.textContent = `Opponent finished in ${result.time}s with ${result.wpm} WPM! Keep going!`;
    }
}

function showGameOverScreen() {
    let title, message;
    if (myResult.wpm > opponentResult.wpm) {
        title = 'You Win!';
        message = `Congratulations, ${playerName}!\n\nYour score: ${myResult.wpm} WPM (in ${myResult.time}s)\n${opponentName}'s score: ${opponentResult.wpm} WPM (in ${opponentResult.time}s)`;
    } else if (myResult.wpm < opponentResult.wpm) {
        title = 'You Lost!';
        message = `Good effort, ${playerName}!\n\n${opponentName}'s score: ${opponentResult.wpm} WPM (in ${opponentResult.time}s)\nYour score: ${myResult.wpm} WPM (in ${myResult.time}s)`;
    } else {
        title = 'It\'s a Tie!';
        message = `Incredible! You both got ${myResult.wpm} WPM.`;
    }
    showModal(title, message, switchToLobbyView);
}

function resetGame() {
    clearInterval(timerInterval);
    if (conn) {
        conn.close();
        conn = null;
    }
    userInput.removeAttribute('maxlength');
    userInput.disabled = true;
    userInput.value = '';
    myTextDisplay.innerHTML = '';
    opponentTextDisplay.innerHTML = '';
    opponentTextDisplay.classList.remove('opacity-50');
    originalText = '';
    gameFinished = false;
    isHost = false;
    opponentFinished = false;
    myResult = null;
    opponentResult = null;
    gameStatus.textContent = '';
    modal.classList.add('hidden');
}

function resetToLobby() {
    if (peer) {
        peer.destroy();
    }
    initializePeer();

    lobbyView.classList.remove('hidden');
    gameView.classList.add('hidden');
    lobbyView.classList.add('fade-in');

    playerName = '';
    opponentName = '';
    isHost = false;
    conn = null;
    gameFinished = false;
    opponentFinished = false;
    myResult = null;
    opponentResult = null;
    originalText = '';
    
    joinCodeInput.value = '';
    userInput.value = '';
    connectionStatus.textContent = '';
    gameStatus.textContent = '';
    timerDisplay.innerHTML = `Time: <span class="font-mono">0s</span>`;
    wpmDisplay.innerHTML = `WPM: <span class="font-mono">0</span>`;
    myNameDisplay.textContent = 'You';
    opponentNameDisplay.textContent = 'Opponent';
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