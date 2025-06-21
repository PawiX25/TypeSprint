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
    modal.classList.remove('hidden');
    modal.classList.add('fade-in');
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
            players[peer.id] = { name: playerName, ready: false, finished: false, result: null };
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
                players[data.payload.id] = { name: data.payload.name, ready: false, finished: false, result: null };
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
            players[peer.id] = { name: playerName, ready: false, finished: false, result: null };
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

    let textDisplayContainerClass = "relative";
    let textDisplayClass = `text-2xl font-mono select-none tracking-wide leading-relaxed ${textColor}`;

    if (isMe && scrollingViewEnabled) {
        textDisplayContainerClass += " overflow-hidden";
        textDisplayClass += " whitespace-nowrap transition-transform duration-200 ease-linear";
    }

    let content = `
        <p class="text-lg font-medium mb-3 ${nameColor}">${player.name} ${isMe ? '(You)' : ''}</p>
        <div class="relative">
            <div id="text-display-container-${playerId}" class="${textDisplayContainerClass}">
                <div id="text-display-${playerId}" class="${textDisplayClass}"></div>
            </div>
    `;

    if (isMe) {
        content += `
            <textarea id="user-input" rows="5"
                      class="absolute top-0 left-0 w-full h-full p-0 bg-transparent border-none outline-none resize-none text-2xl font-mono tracking-wide leading-relaxed"></textarea>
        `;
    }
    
    content += `</div>`;
    view.innerHTML = content;
    return view;
}

function updateScrollingView(typedText) {
    const textDisplay = document.getElementById('text-display-shared');
    if (!textDisplay) return;
    const spans = textDisplay.querySelectorAll('span');

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
}

function startGame(text) {
    gameFinished = false;
    Object.keys(players).forEach(id => {
        players[id].finished = false;
        players[id].result = null;
    });
    
    lobbyView.classList.add('hidden');
    gameView.classList.remove('hidden');
    gameView.classList.add('fade-in');

    playerViewsContainer.innerHTML = '';

    originalText = text;

    if (scrollingViewEnabled) {
        playerViewsContainer.className = 'grid grid-cols-1 gap-8';
        const view = document.createElement('div');
        view.className = 'glassmorphism p-6 rounded-lg';
        let content = `
            <div class="relative">
                <div class="overflow-hidden">
                    <div id="text-display-shared" class="text-2xl font-mono select-none tracking-wide leading-relaxed text-gray-300 whitespace-nowrap relative transition-transform duration-300 ease-out">
                    </div>
                </div>
                <textarea id="user-input" rows="5"
                    class="absolute top-0 left-0 w-full h-full p-0 bg-transparent border-none outline-none resize-none text-2xl font-mono tracking-wide leading-relaxed"></textarea>
            </div>
        `;
        view.innerHTML = content;
        playerViewsContainer.appendChild(view);
        
        const textDisplay = document.getElementById('text-display-shared');
        populateTextDisplay(textDisplay, originalText);

        Object.keys(players).forEach(playerId => {
            const isMe = playerId === peer.id;
            const cursor = document.createElement('div');
            cursor.id = `cursor-${playerId}`;
            cursor.className = `cursor-element ${isMe ? 'bg-cyan-300' : 'bg-red-300'}`;
            textDisplay.appendChild(cursor);
        });

    } else {
        playerViewsContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-8';
        const myPlayerView = createPlayerView(peer.id, true);
        playerViewsContainer.appendChild(myPlayerView);

        Object.keys(players).forEach(playerId => {
            if (playerId === peer.id) return;
            const playerView = createPlayerView(playerId, false);
            playerViewsContainer.appendChild(playerView);
        });
        
        Object.keys(players).forEach(playerId => {
            const textDisplay = document.getElementById(`text-display-${playerId}`);
            populateTextDisplay(textDisplay, originalText);
        });
    }


    const userInput = document.getElementById('user-input');
    userInput.addEventListener('input', checkInput);

    userInput.maxLength = originalText.length;
    userInput.disabled = true;
    userInput.value = '';
    
    if (!scrollingViewEnabled) {
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
    const wpm = calculateWPM(userInput.value, elapsedTime);
    const accuracy = calculateAccuracy(userInput.value, originalText);
    wpmDisplay.innerHTML = `WPM: <span class="font-mono">${wpm}</span>`;

    raceStats.push({ time: elapsedTime, wpm, accuracy });

    if (isHost) {
        broadcast({ type: 'progress', payload: { id: peer.id, progress: userInput.value.length, wpm: wpm } });
    } else if (conn) {
        const payload = { type: 'progress', payload: { wpm, typedText: userInput.value } };
        conn.send(payload);
    }
}

function calculateWPM(text, elapsedTime) {
    if (elapsedTime > 0) {
        const words = text.trim().split(/\s+/).length;
        return Math.round((words / elapsedTime) * 60);
    }
    return 0;
}

function calculateAccuracy(typed, original) {
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] === original[i]) {
            correct++;
        }
    }
    return typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
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

    if (viewType === 'my-view' && scrollingViewEnabled) {
        const cursorSpan = container.querySelector('.cursor.my-view');
        if (cursorSpan) {
            const containerWrapper = container.parentElement;
            const containerRect = containerWrapper.getBoundingClientRect();
            const cursorRect = cursorSpan.getBoundingClientRect();
            
            const scrollOffset = cursorRect.left - containerRect.left - (containerRect.width / 2) + (cursorRect.width / 2);
            
            container.style.transform = `translateX(-${scrollOffset}px)`;
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

    if (typedText === originalText) {
        finishGame();
    }
}

function finishGame() {
    if (players[peer.id].finished) return;
    gameFinished = true;
    players[peer.id].finished = true;

    clearInterval(timerInterval);
    const userInput = document.getElementById('user-input');
    userInput.disabled = true;
    const finalTime = Math.floor((new Date().getTime() - startTime) / 1000);
    const wpm = calculateWPM(userInput.value, finalTime);
    players[peer.id].result = { time: finalTime, wpm: wpm };
    
    const myResult = players[peer.id].result;

    if (isHost) {
        broadcast({ type: 'finished', payload: { id: peer.id, result: myResult } });
        checkAllFinished();
    } else {
        conn.send({ type: 'finished', payload: myResult });
    }

    if (scrollingViewEnabled && isHost) {
        const textDisplay = document.getElementById('text-display-shared');
        if(textDisplay) textDisplay.style.transform = 'translateX(0px)';
    }

    const allFinished = Object.values(players).every(p => p.finished);
    if (!allFinished) {
        showModal('Race Finished!', `You finished in ${myResult.time}s with ${myResult.wpm} WPM!\nWaiting for other players...`);
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
        
        const opponentView = document.getElementById(`player-view-${data.id}`);
        if (opponentView) {
            opponentView.classList.add('opacity-50');
        }
        
        gameStatus.textContent = `${players[data.id].name} finished!`;
        checkAllFinished();
    }
}

function showGameOverScreen() {
    const sortedPlayers = Object.values(players).sort((a, b) => {
        if (!a.result) return 1;
        if (!b.result) return -1;
        return b.result.wpm - a.result.wpm;
    });

    let title = 'Game Over!';
    if (sortedPlayers.length > 0 && sortedPlayers[0].name === players[peer.id].name) {
        title = 'You Win!';
    }

    let message = sortedPlayers.map((p, index) => {
        return `${index + 1}. ${p.name} - ${p.result.wpm} WPM in ${p.result.time}s`;
    }).join('\n');

    showModal(title, message, () => {
        switchToLobbyView();
        chartContainer.style.display = 'none';
        if (statsChartInstance) {
            statsChartInstance.destroy();
        }
    });

    if (players[peer.id].finished) {
        displayStatsGraph();
    }
}

function displayStatsGraph() {
    chartContainer.style.display = 'block';
    if (statsChartInstance) {
        statsChartInstance.destroy();
    }

    const labels = raceStats.map(s => `${s.time}s`);
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
                    tension: 0.3,
                    yAxisID: 'y',
                },
                {
                    label: 'Accuracy (%)',
                    data: accuracyData,
                    borderColor: '#fca5a5', // red-300
                    backgroundColor: 'rgba(252, 165, 165, 0.1)',
                    tension: 0.3,
                    yAxisID: 'y1',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Time' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'WPM' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    title: { display: true, text: 'Accuracy (%)' },
                    grid: {
                        drawOnChartArea: false, 
                    },
                }
            }
        }
    });
}

function resetGame() {
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
                messages: [{ role: 'user', content: `Generate a paragraph of text for a typing race based on this prompt: ${prompt}` }]
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const generatedText = data.choices[0].message.content.trim();
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

scrollingViewToggle.addEventListener('change', (e) => {
    scrollingViewEnabled = e.target.checked;
});

initializePeer();