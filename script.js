const textToType = document.getElementById('text-to-type');
const userInput = document.getElementById('user-input');
const timerDisplay = document.getElementById('timer');
const wpmDisplay = document.getElementById('wpm');
const myIdDisplay = document.getElementById('my-id');
const peerIdInput = document.getElementById('peer-id-input');
const connectBtn = document.getElementById('connect-btn');
const connectionStatus = document.getElementById('connection-status');
const opponentProgress = document.getElementById('opponent-progress');
const opponentStats = document.getElementById('opponent-stats');

let peer;
let conn;
let startTime;
let timerInterval;
let gameFinished = false;

const sentences = [
    "The quick brown fox jumps over the lazy dog.",
    "Never underestimate the power of a good book.",
    "The early bird catches the worm.",
    "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.",
    "The journey of a thousand miles begins with a single step."
];

function initializePeer() {
    peer = new Peer();
    peer.on('open', (id) => {
        myIdDisplay.textContent = id;
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnectionEvents(true);
    });
}

function connectToPeer() {
    const peerId = peerIdInput.value;
    if (peerId) {
        conn = peer.connect(peerId);
        setupConnectionEvents(false);
    } else {
        alert("Please enter a peer ID.");
    }
}

function setupConnectionEvents(isHost) {
    conn.on('open', () => {
        connectionStatus.textContent = `Connected to ${conn.peer}`;
        if (isHost) {
            const sentence = sentences[Math.floor(Math.random() * sentences.length)];
            textToType.textContent = sentence;
            conn.send({ type: 'sentence', payload: sentence });
            startGame();
        }
    });

    conn.on('data', (data) => {
        switch (data.type) {
            case 'sentence':
                textToType.textContent = data.payload;
                startGame();
                break;
            case 'progress':
                opponentProgress.textContent = data.payload.text;
                updateOpponentStats(data.payload.wpm);
                break;
            case 'finished':
                handleOpponentFinished(data.payload);
                break;
        }
    });

    conn.on('close', () => {
        connectionStatus.textContent = "Connection closed.";
        resetGame();
    });

    conn.on('error', (err) => {
        console.error(err);
        connectionStatus.textContent = `Connection error: ${err.type}`;
    });
}

function startGame() {
    userInput.disabled = false;
    userInput.value = '';
    userInput.focus();
    startTime = new Date().getTime();
    timerInterval = setInterval(updateTimer, 1000);
    gameFinished = false;
    opponentProgress.textContent = '';
    opponentStats.textContent = 'WPM: 0';
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
        conn.send({ type: 'progress', payload: { text: userInput.value, wpm: wpm } });
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
    wpmDisplay.textContent = `WPM: ${wpm}`;
    const result = { time: finalTime, wpm: wpm };
    alert(`You finished in ${result.time} seconds with ${result.wpm} WPM!`);
    if (conn) {
        conn.send({ type: 'finished', payload: result });
    }
}

function handleOpponentFinished(result) {
    if (!gameFinished) {
        alert(`Opponent finished in ${result.time} seconds with ${result.wpm} WPM!`);
    }
    opponentStats.textContent = `Finished! WPM: ${result.wpm}`;
}

function updateOpponentStats(wpm) {
    opponentStats.textContent = `WPM: ${wpm}`;
}

function resetGame() {
    clearInterval(timerInterval);
    userInput.disabled = true;
    userInput.value = '';
    textToType.textContent = 'Waiting for opponent...';
    timerDisplay.textContent = 'Time: 0s';
    wpmDisplay.textContent = 'WPM: 0';
    opponentProgress.textContent = '';
    opponentStats.textContent = 'WPM: 0';
    gameFinished = false;
}

connectBtn.addEventListener('click', connectToPeer);
userInput.addEventListener('input', checkInput);

initializePeer();