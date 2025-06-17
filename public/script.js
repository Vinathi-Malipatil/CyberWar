document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const defendBtn = document.getElementById('defend-btn');
  const statusDiv = document.getElementById('status');
  const securityBar = document.getElementById('security-bar');
  const gameLog = document.getElementById('game-log');
  const attackButtons = document.getElementById('attack-buttons');
  const attackerResourcesDiv = document.getElementById('attacker-resources');
  const defenderResourcesDiv = document.getElementById('defender-resources');
  const turnIndicator = document.getElementById('turn-indicator');
  const restartBtn = document.getElementById('restart-btn');
  const attackerWinChance = document.getElementById('attacker-win-chance');
  const defenderWinChance = document.getElementById('defender-win-chance');
  const confidenceDisplay = document.getElementById('confidence');

  // Game state
  let gameState = {
    turn: 0,
    attacker: { resources: 0, lastMove: null, attacks: [] },
    defender: { resources: 0, lastMove: null, defenses: [] },
    network: { 
      security_level: 5,
      nodes: []
    },
    gameOver: false,
    winner: null,
    currentPlayer: 'attacker'
  };

  let attackPatterns = [];
  let defenseOptions = [];
  let config = {
    MAX_SECURITY: 10,
    MIN_SECURITY: 0,
    INITIAL_RESOURCES: 15,
    TURN_RESOURCES: {
      attacker: 2,
      defender: 3
    },
    SECURITY_DECAY: 0.3
  };

  // Initialize game
  async function initGame(retryCount = 0) {
    try {
      const [gameResponse, networkResponse] = await Promise.all([
        fetch('/init'),
        fetch('/game-state')
      ]);

      if (!gameResponse.ok || !networkResponse.ok) {
        throw new Error('Server not responding');
      }

      const gameData = await gameResponse.json();
      const networkData = await networkResponse.json();

      gameState = gameData.gameState;
      attackPatterns = gameData.attacks || [];
      defenseOptions = gameData.defenses || [];
      config = gameData.config || config;

      renderAttackButtons();
      updateUI();
      addLog('Game initialized successfully');
    } catch (error) {
      console.error('Init error:', error);
      addLog(`Initialization failed: ${error.message}`, true);
      
      if (retryCount < 3) {
        addLog(`Retrying... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return initGame(retryCount + 1);
      } else {
        addLog('Failed to initialize after 3 attempts', true);
        setupDemoMode();
      }
    }
  }

  function setupDemoMode() {
    addLog('Running in demo mode with sample data');
    attackPatterns = [
      { id: 1, name: 'Phishing', cost: 1, success_rate: 0.7, type: 'Social' },
      { id: 2, name: 'DDoS', cost: 2, success_rate: 0.6, type: 'Network' },
      { id: 3, name: 'SQL Injection', cost: 2, success_rate: 0.65, type: 'Application' },
      { id: 4, name: 'Ransomware', cost: 3, success_rate: 0.55, type: 'Malware' }
    ];
    defenseOptions = [
      { id: 1, type: 'Firewall', cost: 3, security_boost: 1.5, coverage: ['Network'] },
      { id: 2, type: 'IDS', cost: 2, security_boost: 1.0, coverage: ['Host'] },
      { id: 3, type: 'WAF', cost: 2, security_boost: 1.2, coverage: ['Application'] }
    ];
    gameState = {
      turn: 0,
      attacker: { resources: config.INITIAL_RESOURCES, lastMove: null, attacks: [] },
      defender: { resources: config.INITIAL_RESOURCES, lastMove: null, defenses: [] },
      network: { 
        security_level: 5,
        nodes: [
          { id: 1, name: 'Web Server', criticality: 'High', vulnerabilities: ['Network', 'Application'] },
          { id: 2, name: 'Database', criticality: 'Critical', vulnerabilities: ['Application'] },
          { id: 3, name: 'Auth Server', criticality: 'High', vulnerabilities: ['Social', 'Application'] }
        ]
      },
      gameOver: false,
      winner: null,
      currentPlayer: 'attacker'
    };
    renderAttackButtons();
    updateUI();
  }

  function renderAttackButtons() {
    attackButtons.innerHTML = '';
    
    attackPatterns.forEach(attack => {
      const btn = document.createElement('button');
      btn.className = 'attack-button';
      btn.dataset.id = attack.id;
      btn.dataset.type = attack.type;
      btn.innerHTML = `
        <strong>${attack.name}</strong><br>
        <small>Type: ${attack.type} | Cost: ${attack.cost} | Power: ${Math.round(attack.success_rate * 100)}%</small>
      `;
      btn.addEventListener('click', () => sendAttack(attack.id));
      attackButtons.appendChild(btn);
    });
  }

  async function sendAttack(attackId) {
    try {
      const attack = attackPatterns.find(a => a.id === attackId);
      if (!attack) {
        throw new Error('Invalid attack selected');
      }

      if (gameState.attacker.resources < attack.cost) {
        throw new Error(`Not enough resources (need ${attack.cost}, have ${gameState.attacker.resources})`);
      }

      const response = await fetch('/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackId })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Attack failed');
      }

      const data = await response.json();
      gameState = data.gameState;
      addLog(`Attacked with ${attack.name} (${attack.type})`);
      updateUI();

      if (gameState.gameOver) {
        endGame();
      } else if (gameState.currentPlayer === 'defender') {
        setTimeout(autoDefend, 1500);
      }
    } catch (error) {
      console.error('Attack error:', error);
      addLog(error.message, true);
      updateButtonStates();
    }
  }

  async function autoDefend() {
    try {
      const response = await fetch('/defend', { method: 'POST' });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Defense failed');
      }

      const data = await response.json();
      gameState = data.gameState;
      
      if (data.defense) {
        addLog(`Defended with ${data.defense.name}`);
      } else {
        addLog(data.message || 'Defense skipped');
      }
      
      updateUI();

      if (gameState.gameOver) {
        endGame();
      }
    } catch (error) {
      console.error('Defense error:', error);
      addLog(error.message, true);
      gameState.currentPlayer = 'attacker';
      updateUI();
    }
  }

  function updateUI() {
    // Update security display
    const securityPercent = Math.max(0, 
        Math.min(100, (gameState.network.security_level / config.MAX_SECURITY) * 100)
    );
    securityBar.style.width = `${securityPercent}%`;
    securityBar.style.backgroundColor = 
        securityPercent > 70 ? '#4CAF50' : 
        securityPercent > 30 ? '#FFC107' : '#F44336';
    statusDiv.querySelector('p').textContent = 
        `Security Level: ${gameState.network.security_level.toFixed(2)}/${config.MAX_SECURITY}`;

    // Update resources
    attackerResourcesDiv.innerHTML = `
        <h3>Attacker Resources: ${gameState.attacker.resources}</h3>
        ${gameState.attacker.lastMove ? 
            `<p>Last Attack: ${gameState.attacker.lastMove.name}</p>` : ''}
    `;

    defenderResourcesDiv.innerHTML = `
        <h3>Defender Resources: ${gameState.defender.resources}</h3>
        ${gameState.defender.lastMove ? 
            `<p>Last Defense: ${gameState.defender.lastMove.name}</p>` : ''}
    `;

    // Update turn indicator
    turnIndicator.textContent = `Current Turn: ${gameState.currentPlayer.toUpperCase()}`;
    turnIndicator.className = `${gameState.currentPlayer}-turn`;

    // Update win probability
    updateWinProbability();

    // Update button states
    updateButtonStates();
  }

  async function updateWinProbability() {
    try {
      const response = await fetch('/win-probability');
      if (response.ok) {
        const data = await response.json();
        const prob = data.probability;
        attackerWinChance.textContent = `${Math.round(prob.attacker)}%`;
        defenderWinChance.textContent = `${Math.round(prob.defender)}%`;
        confidenceDisplay.textContent = prob.confidence;
        
        // Update visual bars
        document.querySelector('.attacker-bar').style.width = `${prob.attacker}%`;
        document.querySelector('.defender-bar').style.width = `${prob.defender}%`;
      }
    } catch (error) {
      console.error('Error updating win probability:', error);
    }
  }

  function updateButtonStates() {
    const attackBtns = attackButtons.querySelectorAll('button');
    attackBtns.forEach(btn => {
      const attackId = parseInt(btn.dataset.id);
      const attack = attackPatterns.find(a => a.id === attackId);
      btn.disabled = gameState.gameOver || 
                    gameState.currentPlayer !== 'attacker' ||
                    !attack ||
                    gameState.attacker.resources < attack.cost;
      
      if (btn.disabled) {
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    });

    defendBtn.disabled = gameState.gameOver || 
                        gameState.currentPlayer !== 'defender' ||
                        gameState.defender.resources <= 0;
    
    if (defendBtn.disabled) {
      defendBtn.style.opacity = '0.6';
      defendBtn.style.cursor = 'not-allowed';
    } else {
      defendBtn.style.opacity = '1';
      defendBtn.style.cursor = 'pointer';
    }
  }

  function addLog(message, isError = false) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${isError ? 'error' : ''}`;
    entry.innerHTML = `
      <span class="log-time">[${timeString}]</span>
      <span class="log-message">${message}</span>
    `;
    gameLog.insertBefore(entry, gameLog.firstChild);
    
    if (gameLog.children.length > 100) {
      gameLog.removeChild(gameLog.lastChild);
    }
  }

  function endGame() {
    addLog(`Game Over! Winner: ${gameState.winner}`);
    
    const buttons = attackButtons.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    });
    
    defendBtn.disabled = true;
    defendBtn.style.opacity = '0.5';
    
    const gameOverDiv = document.createElement('div');
    gameOverDiv.className = `game-over ${gameState.winner}`;
    gameOverDiv.innerHTML = `
      <h2>${gameState.winner.toUpperCase()} WINS!</h2>
      <p>Final Security: ${gameState.network.security_level.toFixed(1)}</p>
      <p>Turns: ${gameState.turn}</p>
      <button onclick="location.reload()">Play Again</button>
    `;
    statusDiv.appendChild(gameOverDiv);
  }

  // Event Listeners
  defendBtn.addEventListener('click', autoDefend);
  restartBtn.addEventListener('click', () => location.reload());

  document.addEventListener('keydown', (e) => {
    if (gameState.gameOver) return;
    
    if (gameState.currentPlayer === 'attacker' && e.key >= '1' && e.key <= '9') {
      const index = parseInt(e.key) - 1;
      const buttons = attackButtons.querySelectorAll('button');
      if (index < buttons.length && !buttons[index].disabled) {
        buttons[index].click();
      }
    }
    
    if (gameState.currentPlayer === 'defender' && e.key === ' ' && !defendBtn.disabled) {
      defendBtn.click();
    }
  });

  // Initialize game
  initGame();
});