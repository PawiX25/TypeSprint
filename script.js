const lobbyView = document.getElementById('lobby-view');
const lobbyPlayers = document.getElementById('lobby-players');
const playerList = document.getElementById('player-list');
const readyBtn = document.getElementById('ready-btn');
const startGameBtn = document.getElementById('start-game-btn');
const gameView = document.getElementById('game-view');
const playerNameInput = document.getElementById('player-name-input');
const lobbyCodeDisplay = document.getElementById('lobby-code-display');
const joinCodeInput = document.getElementById('join-code-input');
const joinLobbyBtn = document.getElementById('join-lobby-btn');
const connectionStatus = document.getElementById('connection-status');
const gameRoomName = document.getElementById('game-room-name');
const playerViewsContainer = document.getElementById('player-views-container');
const timerDisplay = document.getElementById('timer');
const wpmDisplay = document.getElementById('wpm');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');
const gameStatus = document.getElementById('game-status');
const yourLobbyInfo = document.getElementById('your-lobby-info');
const scrollingViewToggle = document.getElementById('scrolling-view-toggle');
const smoothCursorToggle = document.getElementById('smooth-cursor-toggle');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsModalContent = document.getElementById('settings-modal-content');
const textGenerationSection = document.getElementById('text-generation-section');
const customTextInput = document.getElementById('custom-text-input');
const generateTextBtn = document.getElementById('generate-text-btn');
const chartContainer = document.getElementById('chart-container');
const statsChart = document.getElementById('stats-chart');

let peer;
let conn;
let connections = {};
let playerName = '';
let isHost = false;
let players = {};
let gameFinished = false;
let startTime;
let timerInterval;
let originalText = '';
let scrollingViewEnabled = false;
let smoothCursorEnabled = false;
let raceStats = [];
let statsChartInstance;

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
    modalMessage.innerHTML = '';
    modalMessage.appendChild(document.createTextNode(message));

    modal.classList.remove('hidden');
    modal.classList.add('fade-in');
    chartContainer.style.display = 'none';

    modalCloseBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('fade-in');
        if (onclose) onclose();
    };
}

function updatePlayerList() {
    playerList.innerHTML = '';
    for (const id in players) {
        const player = players[id];
        const playerDiv = document.createElement('div');
        playerDiv.className = 'flex items-center justify-between p-3 bg-gray-800 rounded-lg';
        playerDiv.innerHTML = `
            <span class="font-medium text-gray-300">${player.name} ${id === peer.id ? '(You)' : ''}</span>
            <span class="text-sm font-semibold ${player.ready ? 'text-green-400' : 'text-yellow-400'}">
                ${player.ready ? 'Ready' : 'Not Ready'}
            </span>
        `;
        playerList.appendChild(playerDiv);
    }

    if (isHost) {
        startGameBtn.style.display = 'block';
        textGenerationSection.style.display = 'block';
        const allReady = Object.values(players).every(p => p.ready || p.id === peer.id);
        if (allReady && Object.keys(players).length > 1) {
            startGameBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            startGameBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}

function showLobbyView() {
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('your-lobby-info').style.display = 'none';
    document.getElementById('join-lobby-section').style.display = 'none';
    document.querySelector('.relative.flex.py-2.items-center').style.display = 'none';

    lobbyPlayers.style.display = 'block';
    if (isHost) {
        startGameBtn.style.display = 'block';
        textGenerationSection.style.display = 'block';
    }
    updatePlayerList();
}

function setLobbyCode(id) {
    lobbyCodeDisplay.innerHTML = '';
    id.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.animationDelay = `${index * 0.05}s`;
        lobbyCodeDisplay.appendChild(span);
    });
}

function initializePeer() {
    peer = new Peer(null, { debug: 2 });
    connections = {};
    players = {};

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
        if (!isHost) {
            isHost = true;
            playerName = playerNameInput.value.trim() || 'Host';
            players[peer.id] = { id: peer.id, name: playerName, ready: false, finished: false, result: null, typedText: '' };
            showLobbyView();
        }
        connections[newConn.peer] = newConn;
        setupConnectionEvents(newConn);
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

    connections = {};
    isHost = false;
    conn = peer.connect(joinCode);
    setupConnectionEvents(conn);
}

function broadcast(data) {
    Object.values(connections).forEach(c => c.send(data));
}

function handleData(data, senderId) {
    if (isHost) {
        switch (data.type) {
            case 'name':
                players[data.payload.id] = { id: data.payload.id, name: data.payload.name, ready: false, finished: false, result: null, typedText: '' };
                broadcast({ type: 'player-update', payload: players });
                updatePlayerList();
                break;
            case 'ready':
                if (players[data.payload.id]) {
                    players[data.payload.id].ready = data.payload.ready;
                    broadcast({ type: 'player-update', payload: players });
                    updatePlayerList();
                }
                break;
            case 'progress':
                if (players[senderId]) {
                    players[senderId].typedText = data.payload.typedText;
                }
                const progressData = { id: senderId, ...data.payload };
                updateOpponentProgress(progressData);
                broadcast({ type: 'progress', payload: progressData });
                break;
            case 'finished':
                if (players[senderId]) {
                    const finishedData = { id: senderId, result: data.payload };
                    handleOpponentFinished(finishedData);
                    broadcast({ type: 'finished', payload: finishedData });
                }
                break;
        }
    } else {
        switch (data.type) {
            case 'player-update':
                players = data.payload;
                updatePlayerList();
                break;
            case 'start-game':
                startGame(data.payload.text);
                break;
            case 'progress':
                if (data.payload.id !== peer.id) {
                    if (players[data.payload.id]) {
                        players[data.payload.id].typedText = data.payload.typedText;
                    }
                    updateOpponentProgress(data.payload);
                }
                break;
            case 'finished':
                if (data.payload.id !== peer.id) {
                    handleOpponentFinished(data.payload);
                }
                break;
            case 'host-left':
                showModal('Game Over', 'The host has left the game.', resetToLobby);
                break;
        }
    }
}

function setupConnectionEvents(c) {
    c.on('open', () => {
        if (!isHost) {
            connectionStatus.textContent = '';
            players[peer.id] = { id: peer.id, name: playerName, ready: false, finished: false, result: null, typedText: '' };
            c.send({ type: 'name', payload: {id: peer.id, name: playerName} });
            showLobbyView();
        }
    });

    c.on('data', (data) => {
        handleData(data, c.peer);
    });

    c.on('close', () => {
        if (isHost) {
            const disconnectedPlayerName = players[c.peer]?.name || 'A player';
            showModal('Player Left', `${disconnectedPlayerName} has disconnected.`);
            delete connections[c.peer];
            delete players[c.peer];
            broadcast({ type: 'player-update', payload: players });
            updatePlayerList();
        } else {
            showModal('Connection Lost', 'The host has disconnected.', resetToLobby);
        }
    });
}

function switchToLobbyView() {
    gameView.classList.add('hidden');
    lobbyView.classList.remove('hidden');
    
    gameFinished = false;
    Object.values(players).forEach(p => {
        p.ready = false;
        p.finished = false;
        p.result = null;
    });
    originalText = '';
    clearInterval(timerInterval);
    
    readyBtn.textContent = 'Ready Up';
    readyBtn.className = 'w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors';
    updatePlayerList();
    if (isHost) {
        broadcast({ type: 'player-update', payload: players });
    }
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

function createPlayerView(playerId, isMe) {
    const player = players[playerId];
    const view = document.createElement('div');
    view.id = `player-view-${playerId}`;
    view.className = 'glassmorphism p-6 rounded-lg';

    const nameColor = isMe ? 'text-cyan-300' : 'text-red-400';
    const textColor = isMe ? 'text-gray-300' : 'text-gray-500';

    const textDisplayContainerClass = "relative";
    const textDisplayClass = `text-2xl font-mono select-none tracking-wide leading-relaxed ${textColor}`;

    let content = `
        <p class="text-lg font-medium mb-3 ${nameColor}">${player.name} ${isMe ? '(You)' : ''}</p>
        <div class="relative">
            <div id="text-display-container-${playerId}" class="${textDisplayContainerClass}">
                <div id="text-display-${playerId}" class="${textDisplayClass}" style="pointer-events: none;"></div>
                <div id="split-cursor-${playerId}" class="cursor-element ${isMe ? 'bg-cyan-300' : 'bg-red-300'}" style="display: none; position: absolute; top: 0; left: 0; width: 2px; transition: left 0.05s ease-out, top 0.05s ease-out;"></div>
            </div>
        </div>
    `;
    
    view.innerHTML = content;
    return view;
}

function updateScrollingView(typedText) {
    const textDisplay = document.getElementById('text-display-shared');
    if (!textDisplay) return;
    const spans = textDisplay.querySelectorAll('span');

    for (let i = 0; i < spans.length; i++) {
        const span = spans[i];
        span.classList.remove('text-gray-400', 'text-green-500', 'text-red-500');

        if (i < typedText.length) {
            if (typedText[i] === originalText[i]) {
                span.classList.add('text-green-500');
            } else {
                span.classList.add('text-red-500');
            }
        } else {
            span.classList.add('text-gray-400');
        }
    }

    const myCursor = document.getElementById(`cursor-${peer.id}`);
    if (myCursor) {
        if (typedText.length < spans.length) {
            myCursor.style.left = `${spans[typedText.length].offsetLeft}px`;
        } else if (typedText.length === spans.length) {
            const lastSpan = spans[spans.length - 1];
            myCursor.style.left = `${lastSpan.offsetLeft + lastSpan.offsetWidth}px`;
        }
    }

    const textContainer = textDisplay.parentElement;
    const containerRect = textContainer.getBoundingClientRect();
    const cursorLeft = myCursor ? (spans[typedText.length]?.offsetLeft || 0) : 0;
    const scrollOffset = cursorLeft - (containerRect.width / 2);
    textDisplay.style.transform = `translateX(-${scrollOffset}px)`;
    
    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.scrollLeft = scrollOffset;
    }
}

function startGame(text) {
    gameFinished = false;
    Object.keys(players).forEach(id => {
        players[id].finished = false;
        players[id].result = null;
        players[id].typedText = '';
    });
    
    lobbyView.classList.add('hidden');
    gameView.classList.remove('hidden');
    gameView.classList.add('fade-in');

    playerViewsContainer.innerHTML = '';
    originalText = text;

    const standardViewWrapper = document.createElement('div');
    standardViewWrapper.id = 'standard-view-wrapper';
    standardViewWrapper.className = 'grid grid-cols-1 md:grid-cols-2 gap-8';

    const myPlayerView = createPlayerView(peer.id, true);
    standardViewWrapper.appendChild(myPlayerView);
    const myTextDisplay = myPlayerView.querySelector(`#text-display-${peer.id}`);
    populateTextDisplay(myTextDisplay, originalText);

    Object.keys(players).forEach(playerId => {
        if (playerId === peer.id) return;
        const playerView = createPlayerView(playerId, false);
        standardViewWrapper.appendChild(playerView);
        const textDisplay = playerView.querySelector(`#text-display-${playerId}`);
        populateTextDisplay(textDisplay, originalText);
    });

    const scrollingViewWrapper = document.createElement('div');
    scrollingViewWrapper.id = 'scrolling-view-wrapper';
    scrollingViewWrapper.className = 'grid grid-cols-1 gap-8';
    const scrollingViewContent = document.createElement('div');
    scrollingViewContent.className = 'glassmorphism p-6 rounded-lg';
    scrollingViewContent.innerHTML = `
        <div class="relative">
            <div class="overflow-hidden" style="pointer-events: none;">
                <div id="text-display-shared" class="text-2xl font-mono select-none tracking-wide leading-relaxed text-gray-300 whitespace-nowrap relative transition-transform duration-300 ease-out">
                </div>
            </div>
        </div>
    `;
    scrollingViewWrapper.appendChild(scrollingViewContent);
    const sharedTextDisplay = scrollingViewContent.querySelector('#text-display-shared');
    populateTextDisplay(sharedTextDisplay, originalText);

    Object.keys(players).forEach(playerId => {
        const isMe = playerId === peer.id;
        const cursor = document.createElement('div');
        cursor.id = `cursor-${playerId}`;
        cursor.className = `cursor-element ${isMe ? 'bg-cyan-300' : 'bg-red-300'}`;
        sharedTextDisplay.appendChild(cursor);
    });

    playerViewsContainer.appendChild(standardViewWrapper);
    playerViewsContainer.appendChild(scrollingViewWrapper);
    
    const userInput = document.createElement('textarea');
    userInput.id = 'user-input';
    userInput.rows = 5;
    userInput.className = 'absolute top-0 left-0 w-full h-full p-0 bg-transparent border-none outline-none resize-none text-2xl font-mono tracking-wide leading-relaxed';
    userInput.addEventListener('input', checkInput);
    userInput.maxLength = originalText.length;
    userInput.disabled = true;
    userInput.value = '';

    if (scrollingViewEnabled) {
        standardViewWrapper.style.display = 'none';
        scrollingViewWrapper.style.display = 'grid';
        scrollingViewContent.querySelector('.relative').appendChild(userInput);
        userInput.style.color = 'transparent';
        userInput.style.caretColor = 'white';
    } else {
        standardViewWrapper.style.display = 'grid';
        scrollingViewWrapper.style.display = 'none';
        standardViewWrapper.querySelector(`#player-view-${peer.id} .relative`).appendChild(userInput);
        const myTextDisplay = document.getElementById(`text-display-${peer.id}`);
        updateTextDisplay(myTextDisplay, '', 'my-view');
    }
    
    wpmDisplay.innerHTML = `WPM: <span class="font-mono">0</span>`;
    timerDisplay.innerHTML = `Time: <span class="font-mono">0s</span>`;
    startCountdown();
}

function startCountdown() {
    gameStatus.textContent = 'Get Ready...';
    setTimeout(() => {
        gameStatus.innerHTML = '<span class="countdown-animation">3...</span>';
    }, 1000);
    setTimeout(() => {
        gameStatus.innerHTML = '<span class="countdown-animation">2...</span>';
    }, 2000);
    setTimeout(() => {
        gameStatus.innerHTML = '<span class="countdown-animation">1...</span>';
    }, 3000);
    setTimeout(() => {
        gameStatus.innerHTML = '<span class="countdown-animation">GO!</span>';
        beginTyping();
        setTimeout(() => {
            gameStatus.textContent = '';
        }, 1000); 
    }, 4000);
}

function beginTyping() {
    const userInput = document.getElementById('user-input');
    userInput.disabled = false;
    userInput.focus();
    startTime = new Date().getTime();
    timerInterval = setInterval(updateTimer, 500);
}

function updateTimer() {
    if (gameFinished) return;
    const userInput = document.getElementById('user-input');
    const elapsedTime = Math.floor((new Date().getTime() - startTime) / 1000);
    timerDisplay.innerHTML = `Time: <span class="font-mono">${elapsedTime}s</span>`;
    
    const typedText = userInput.value;
    const errors = calculateErrors(typedText, originalText);
    const grossWPM = calculateGrossWPM(typedText, elapsedTime);
    const netWPM = calculateNetWPM(grossWPM, errors, elapsedTime);
    wpmDisplay.innerHTML = `WPM: <span class="font-mono">${netWPM}</span>`;
    
    const accuracy = calculateAccuracy(userInput.value, originalText);
    raceStats.push({ time: elapsedTime, wpm: netWPM, accuracy });
}

function calculateErrors(typed, original) {
    const n = typed.length;
    const m = original.length;

    const target = original.slice(0, n);

    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Array(target.length + 1).fill(0);

    for (let i = 0; i <= n; i++) dp[i][0] = i;
    for (let j = 0; j <= target.length; j++) dp[0][j] = j;

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= target.length; j++) {
            if (typed[i - 1] === target[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],
                    dp[i][j - 1],
                    dp[i - 1][j - 1]
                );
            }
        }
    }

    return dp[n][target.length];
}

function calculateGrossWPM(text, elapsedTime) {
    if (elapsedTime > 0) {
        const totalKeystrokes = text.length;
        const timeInMinutes = elapsedTime / 60;
        return (totalKeystrokes / 5) / timeInMinutes;
    }
    return 0;
}

function calculateNetWPM(grossWPM, errors, elapsedTime) {
    if (elapsedTime > 0) {
        const timeInMinutes = elapsedTime / 60;
        const errorRate = errors / timeInMinutes;
        const netWPM = grossWPM - errorRate;
        return Math.round(Math.max(0, netWPM));
    }
    return 0;
}

function calculateAccuracy(typed, original) {
    if (typed.length === 0) return 100;
    const errors = calculateErrors(typed, original);
    const correct = typed.length - errors;
    return Math.max(0, Math.round((correct / typed.length) * 100));
}

function updateTextDisplay(container, typedText, viewType) {
    const spans = container.querySelectorAll('span');
    spans.forEach(span => span.classList.remove('cursor', `${viewType}`));

    for (let i = 0; i < spans.length; i++) {
        const span = spans[i];
        span.classList.remove('text-gray-400', 'text-green-500', 'text-red-500');

        if (i < typedText.length) {
            if (typedText[i] === originalText[i]) {
                span.classList.add('text-green-500');
            } else {
                span.classList.add('text-red-500');
            }
        } else {
            span.classList.add('text-gray-400');
        }
    }

    const playerId = container.id.replace('text-display-', '');
    const cursor = document.getElementById(`split-cursor-${playerId}`);

    if (smoothCursorEnabled) {
        if (cursor) {
            cursor.style.display = 'block';
            cursor.style.transition = 'left 0.05s ease-out, top 0.05s ease-out';

            if (typedText.length < originalText.length) {
                const span = spans[typedText.length];
                cursor.style.left = `${span.offsetLeft}px`;
                cursor.style.top = `${span.offsetTop}px`;
                cursor.style.height = `${span.offsetHeight}px`;
            } else if (typedText.length === originalText.length && spans.length > 0) {
                const lastSpan = spans[spans.length - 1];
                cursor.style.left = `${lastSpan.offsetLeft + lastSpan.offsetWidth}px`;
                cursor.style.top = `${lastSpan.offsetTop}px`;
                cursor.style.height = `${lastSpan.offsetHeight}px`;
            } else {
                cursor.style.display = 'none';
            }
        }
    } else {
        if (cursor) {
            cursor.style.display = 'block';
            cursor.style.transition = 'none';

            if (typedText.length < originalText.length) {
                const span = spans[typedText.length];
                cursor.style.left = `${span.offsetLeft}px`;
                cursor.style.top = `${span.offsetTop}px`;
                cursor.style.height = `${span.offsetHeight}px`;
            } else if (typedText.length === originalText.length && spans.length > 0) {
                const lastSpan = spans[spans.length - 1];
                cursor.style.left = `${lastSpan.offsetLeft + lastSpan.offsetWidth}px`;
                cursor.style.top = `${lastSpan.offsetTop}px`;
                cursor.style.height = `${lastSpan.offsetHeight}px`;
            } else {
                cursor.style.display = 'none';
            }
        }
    }
}

function checkInput() {
    if (gameFinished) return;

    const userInput = document.getElementById('user-input');
    const typedText = userInput.value;
    
    if (scrollingViewEnabled) {
        updateScrollingView(typedText);
    } else {
        const myTextDisplay = document.getElementById(`text-display-${peer.id}`);
        updateTextDisplay(myTextDisplay, typedText, 'my-view');
    }

    if (players[peer.id]) {
        players[peer.id].typedText = typedText;
    }

    if (isHost) {
        broadcast({ type: 'progress', payload: { id: peer.id, typedText: typedText } });
    } else {
        conn.send({ type: 'progress', payload: { typedText: typedText } });
    }

    const normalizedTypedText = typedText.replace(/\r\n/g, '\n');
    const normalizedOriginalText = originalText.replace(/\r\n/g, '\n');

    if (normalizedTypedText.length >= normalizedOriginalText.length) {
        finishGame();
    }
}

function finishGame() {
    if (players[peer.id].finished) return;
    
    players[peer.id].finished = true;
    clearInterval(timerInterval);
    
    const userInput = document.getElementById('user-input');
    userInput.disabled = true;

    // Trim typed text to original length if it's longer
    let typedText = userInput.value;
    if (typedText.length > originalText.length) {
        typedText = typedText.substring(0, originalText.length);
        userInput.value = typedText;
    }

    const finalTime = Math.max(1, Math.floor((new Date().getTime() - startTime) / 1000));
    
    const errors = calculateErrors(typedText, originalText);
    const grossWPM = calculateGrossWPM(typedText, finalTime);
    const netWPM = calculateNetWPM(grossWPM, errors, finalTime);
    const accuracy = calculateAccuracy(typedText, originalText);
    
    players[peer.id].result = { time: finalTime, wpm: netWPM, accuracy: accuracy, errors: errors };
    
    const myResult = players[peer.id].result;

    if (isHost) {
        broadcast({ type: 'finished', payload: { id: peer.id, result: myResult } });
    } else if (conn) {
        conn.send({ type: 'finished', payload: myResult });
    }

    if (scrollingViewEnabled && isHost) {
        const textDisplay = document.getElementById('text-display-shared');
        if(textDisplay) textDisplay.style.transform = 'translateX(0px)';
    }

    const allFinished = Object.values(players).every(p => p.finished);
    if (allFinished) {
        setTimeout(checkAllFinished, 100);
    } else if (!gameFinished) {
        gameFinished = true;
        showModal('Race Finished!', `You finished in ${myResult.time}s with ${myResult.wpm} Net WPM and ${myResult.accuracy}% accuracy!\n\nWaiting for other players...`);
    }
}

function checkAllFinished() {
    const allFinished = Object.values(players).every(p => p.finished);
    if (allFinished) {
        showGameOverScreen();
    }
}

function updateOpponentProgress(data) {
    if (scrollingViewEnabled) {
        const cursor = document.getElementById(`cursor-${data.id}`);
        const textDisplay = document.getElementById('text-display-shared');
        if (cursor && textDisplay) {
            const spans = textDisplay.querySelectorAll('span');
            if (data.typedText.length < spans.length) {
                cursor.style.left = `${spans[data.typedText.length].offsetLeft}px`;
            } else if (data.typedText.length === spans.length) {
                const lastSpan = spans[spans.length - 1];
                cursor.style.left = `${lastSpan.offsetLeft + lastSpan.offsetWidth}px`;
            }
        }
        return;
    }

    const opponentTextDisplay = document.getElementById(`text-display-${data.id}`);
    if (opponentTextDisplay) {
        updateTextDisplay(opponentTextDisplay, data.typedText, 'opponent-view');
    }
}

function handleOpponentFinished(data) {
    if (players[data.id] && !players[data.id].finished) {
        players[data.id].finished = true;
        players[data.id].result = data.result;

        const playerView = document.getElementById(`player-view-${data.id}`);
        if (playerView) {
            playerView.classList.add('border-green-500', 'border-2', 'opacity-75');
            const nameElement = playerView.querySelector('p.font-medium');
            if (nameElement && !nameElement.textContent.includes('(Finished)')) {
                nameElement.innerHTML += ' <span class="text-green-400 font-bold">(Finished)</span>';
            }
        }
        
        const allFinished = Object.values(players).every(p => p.finished);
        if (allFinished) {
            showGameOverScreen();
        }
    }
}

function showGameOverScreen() {
    const sortedPlayers = Object.values(players).sort((a, b) => {
        if (!a.result || !b.result) return a.result ? -1 : 1;
        if (b.result.wpm !== a.result.wpm) {
            return b.result.wpm - a.result.wpm;
        }
        return a.result.time - b.result.time;
    });

    let title = 'Race Over!';
    if (sortedPlayers.length > 1 && sortedPlayers[0].id === peer.id) {
        title = 'You Won! 🎉';
    } else if (sortedPlayers.length === 1) {
        title = 'Practice Complete!';
    }

    const resultsHTML = sortedPlayers.map((p, index) => {
        if (!p.result) return '';
        const isMe = p.id === peer.id;
        const rankColor = index === 0 ? 'text-yellow-300' : (index === 1 ? 'text-gray-300' : (index === 2 ? 'text-orange-400' : 'text-gray-500'));
        const bgClass = isMe ? 'bg-white/10' : 'bg-white/5';
        
        return `
            <div class="flex items-center justify-between p-3 rounded-lg ${bgClass} transition-all duration-300 hover:bg-white/20">
                <div class="flex items-center gap-3">
                    <span class="font-bold text-xl w-8 text-center ${rankColor}">${index + 1}</span>
                    <span class="font-semibold ${isMe ? 'text-cyan-300' : 'text-gray-200'}">${p.name}</span>
                </div>
                <div class="text-right">
                    <div class="font-bold text-lg">${p.result.wpm} <span class="text-sm font-normal text-gray-400">Net WPM</span></div>
                    <div class="text-xs text-gray-400">${p.result.accuracy}% Acc | ${p.result.errors} errs</div>
                </div>
            </div>
        `;
    }).join('');

    modalTitle.textContent = title;
    modalMessage.innerHTML = `<div class="space-y-2 text-left">${resultsHTML}</div>`;
    modal.classList.remove('hidden');
    modal.classList.add('fade-in');

    modalCloseBtn.onclick = () => {
        modal.classList.add('hidden');
        modal.classList.remove('fade-in');
        switchToLobbyView();
        if (statsChartInstance) {
            statsChartInstance.destroy();
            statsChartInstance = null;
        }
        chartContainer.style.display = 'none';
    };

    if (players[peer.id].finished) {
        displayStatsGraph();
    }
}

function displayStatsGraph() {
    chartContainer.style.display = 'block';
    if (statsChartInstance) {
        statsChartInstance.destroy();
    }

    const labels = raceStats.map(s => s.time);
    const wpmData = raceStats.map(s => s.wpm);
    const accuracyData = raceStats.map(s => s.accuracy);

    statsChartInstance = new Chart(statsChart, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'WPM',
                    data: wpmData,
                    borderColor: '#67e8f9', // cyan-300
                    backgroundColor: 'rgba(103, 232, 249, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y',
                },
                {
                    label: 'Accuracy (%)',
                    data: accuracyData,
                    borderColor: '#fca5a5', // red-300
                    backgroundColor: 'rgba(252, 165, 165, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { color: '#e5e5e5', boxWidth: 12, padding: 20 }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 10, 10, 0.8)',
                    titleColor: '#e5e5e5',
                    bodyColor: '#e5e5e5',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                                if (context.dataset.yAxisID === 'y1') {
                                    label += '%';
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Time (s)', color: '#a3a3a3' },
                    ticks: { color: '#a3a3a3' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'WPM', color: '#67e8f9' },
                    ticks: { color: '#67e8f9', stepSize: 20 },
                    grid: { color: 'rgba(103, 232, 249, 0.1)' },
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: Math.max(0, Math.min(...accuracyData) - 10),
                    max: 100,
                    title: { display: true, text: 'Accuracy (%)', color: '#fca5a5' },
                    ticks: { color: '#fca5a5', stepSize: 10 },
                    grid: { drawOnChartArea: false },
                },
            },
            elements: {
                point:{
                    radius: 0,
                    hoverRadius: 5,
                    hitRadius: 10
                }
            }
        }
    });
}

function resetGame() {
    gameFinished = false;
    clearInterval(timerInterval);
    if (isHost) {
        broadcast({ type: 'host-left' });
        Object.values(connections).forEach(c => c.close());
    } else if (conn) {
        conn.close();
    }
    conn = null;
    connections = {};

    const userInput = document.getElementById('user-input');
    if (userInput) {
        userInput.removeAttribute('maxlength');
        userInput.disabled = true;
        userInput.value = '';
    }
    playerViewsContainer.innerHTML = '';
    originalText = '';
    gameFinished = false;
    isHost = false;
    myResult = null;
    opponentResult = null;
    gameStatus.textContent = '';
    modal.classList.add('hidden');
}

function resetToLobby() {
    if (isHost) {
        broadcast({ type: 'host-left' });
    }
    if (peer) {
        peer.destroy();
    }
    initializePeer();

    lobbyView.classList.remove('hidden');
    gameView.classList.add('hidden');
    lobbyPlayers.style.display = 'none';
    document.getElementById('user-info').style.display = 'block';
    yourLobbyInfo.style.display = 'none';
    document.getElementById('join-lobby-section').style.display = 'block';
    document.querySelector('.relative.flex.py-2.items-center').style.display = 'flex';


    lobbyView.classList.add('fade-in');

    playerName = '';
    isHost = false;
    conn = null;
    players = {};
    gameFinished = false;
    originalText = '';
    
    joinCodeInput.value = '';
    connectionStatus.textContent = '';
    gameStatus.textContent = '';
    timerDisplay.innerHTML = `Time: <span class="font-mono">0s</span>`;
    wpmDisplay.innerHTML = `WPM: <span class="font-mono">0</span>`;
}

readyBtn.addEventListener('click', () => {
    const myPlayer = players[peer.id];
    myPlayer.ready = !myPlayer.ready;
    readyBtn.textContent = myPlayer.ready ? 'Unready' : 'Ready Up';
    readyBtn.classList.toggle('bg-green-600', myPlayer.ready);
    readyBtn.classList.toggle('hover:bg-green-700', myPlayer.ready);
    readyBtn.classList.toggle('bg-yellow-600', !myPlayer.ready);
    readyBtn.classList.toggle('hover:bg-yellow-700', !myPlayer.ready);

    const payload = { type: 'ready', payload: { id: peer.id, ready: myPlayer.ready } };
    if (isHost) {
        handleData(payload, peer.id);
    } else {
        conn.send(payload);
    }
    updatePlayerList();
});

startGameBtn.addEventListener('click', () => {
    if (isHost) {
        const allReady = Object.values(players).every(p => p.ready || p.id === peer.id);
        if (!allReady || Object.keys(players).length <= 1) return;

        let textToRace = customTextInput.value.trim();
        if (!textToRace) {
            textToRace = sentences[Math.floor(Math.random() * sentences.length)];
        }

        broadcast({ type: 'start-game', payload: { text: textToRace } });
        startGame(textToRace);
    }
});

joinLobbyBtn.addEventListener('click', joinGame);
leaveRoomBtn.addEventListener('click', resetToLobby);

generateTextBtn.addEventListener('click', async () => {
    const prompt = customTextInput.value.trim();
    if (!prompt) {
        showModal('Error', 'Please enter a prompt for the AI.');
        return;
    }

    generateTextBtn.disabled = true;
    generateTextBtn.textContent = 'Generating...';

    try {
        const response = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: `Generate a paragraph for a typing race with the theme "${prompt}". Only return the raw text for the paragraph, without any extra formatting, introductory phrases, or quotation marks.` }]
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        let generatedText = data.choices[0].message.content.trim();
        
        const colonIndex = generatedText.lastIndexOf(':');
        if (colonIndex > -1) {
            generatedText = generatedText.substring(colonIndex + 1).trim();
        }

        if (generatedText.startsWith('"') && generatedText.endsWith('"')) {
            generatedText = generatedText.slice(1, -1);
        }
        
        customTextInput.value = generatedText;

    } catch (error) {
        console.error('AI generation error:', error);
        showModal('Error', 'Failed to generate text. Please try again or paste your own text.');
    } finally {
        generateTextBtn.disabled = false;
        generateTextBtn.textContent = 'Generate with AI';
    }
});

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

settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    settingsModal.classList.add('fade-in');
    settingsModalContent.classList.add('scale-up');
});

settingsCloseBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    settingsModal.classList.remove('fade-in');
    settingsModalContent.classList.remove('scale-up');
});

smoothCursorToggle.addEventListener('change', (e) => {
    smoothCursorEnabled = e.target.checked;
});

scrollingViewToggle.addEventListener('change', (e) => {
    scrollingViewEnabled = e.target.checked;

    updateSettingsVisibility();

    if (!startTime || gameFinished) {
        return;
    }

    const userInput = document.getElementById('user-input');
    const typedText = userInput.value;
    const selectionStart = userInput.selectionStart;
    const selectionEnd = userInput.selectionEnd;

    const standardViewWrapper = document.getElementById('standard-view-wrapper');
    const scrollingViewWrapper = document.getElementById('scrolling-view-wrapper');

    if (scrollingViewEnabled) {
        standardViewWrapper.style.display = 'none';
        scrollingViewWrapper.style.display = 'grid';
        
        const scrollingViewContent = scrollingViewWrapper.querySelector('.glassmorphism .relative');
        scrollingViewContent.appendChild(userInput);

        userInput.style.color = 'transparent';
        userInput.style.caretColor = 'white';

        updateScrollingView(typedText);
        Object.values(players).forEach(p => {
            if (p.id !== peer.id && p.typedText) {
                updateOpponentProgress({ id: p.id, typedText: p.typedText });
            }
        });
    } else {
        scrollingViewWrapper.style.display = 'none';
        standardViewWrapper.style.display = 'grid';
        
        const myPlayerView = standardViewWrapper.querySelector(`#player-view-${peer.id} .relative`);
        myPlayerView.appendChild(userInput);

        userInput.style.color = ''; 
        userInput.style.caretColor = '';

        Object.values(players).forEach(p => {
            const isMe = p.id === peer.id;
            const textDisplay = document.getElementById(`text-display-${p.id}`);
            if (textDisplay) {
                updateTextDisplay(textDisplay, p.typedText, isMe ? 'my-view' : 'opponent-view');
            }
        });
    }

    userInput.focus();
    userInput.setSelectionRange(selectionStart, selectionEnd);
});

function updateSettingsVisibility() {
    const smoothSetting = document.getElementById('smooth-cursor-setting');
    if (smoothSetting) {
        smoothSetting.style.display = scrollingViewToggle.checked ? 'none' : 'flex';
    }
}

updateSettingsVisibility();

initializePeer();