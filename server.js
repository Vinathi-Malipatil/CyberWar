const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Game Configuration
const CONFIG = {
  MAX_SECURITY: 10,
  MIN_SECURITY: 0,
  INITIAL_RESOURCES: 15,
  TURN_RESOURCES: {
    attacker: 2,
    defender: 3
  },
  SECURITY_DECAY: 0.3,
  CRITICAL_NODE_PENALTY: 0.9,
  MINIMAX_DEPTH: 3
};

// Win Probability Calculation
function calculateWinProbability(gameState) {
  if (gameState.gameOver) {
    return {
      attacker: gameState.winner === 'attacker' ? 100 : 0,
      defender: gameState.winner === 'defender' ? 100 : 0,
      factors: {
        gameOver: true,
        winner: gameState.winner
      }
    };
  }

  // Base factors for probability calculation
  let attackerScore = 0;
  let defenderScore = 0;
  const factors = {};

  // 1. Security Level Factor (35% weight)
  const securityFactor = gameState.network.security_level / CONFIG.MAX_SECURITY;
  const securityWeight = 35;
  defenderScore += securityFactor * securityWeight;
  attackerScore += (1 - securityFactor) * securityWeight;
  factors.securityLevel = {
    current: gameState.network.security_level.toFixed(2),
    defenderAdvantage: (securityFactor * 100).toFixed(1) + '%'
  };

  // 2. Resource Advantage (25% weight)
  const totalResources = gameState.attacker.resources + gameState.defender.resources;
  if (totalResources > 0) {
    const attackerResourceRatio = gameState.attacker.resources / totalResources;
    const defenderResourceRatio = gameState.defender.resources / totalResources;
    const resourceWeight = 25;
    
    attackerScore += attackerResourceRatio * resourceWeight;
    defenderScore += defenderResourceRatio * resourceWeight;
    factors.resources = {
      attacker: gameState.attacker.resources,
      defender: gameState.defender.resources,
      advantage: gameState.defender.resources > gameState.attacker.resources ? 'Defender' : 'Attacker'
    };
  }

  // 3. Critical Node Status (20% weight)
  const criticalNodes = gameState.network.nodes.filter(n => n.criticality === 'Critical');
  const protectedCritical = criticalNodes.filter(n => n.protected).length;
  const attackedCritical = criticalNodes.filter(n => n.attacked).length;
  const criticalWeight = 20;
  
  if (criticalNodes.length > 0) {
    const protectionRatio = protectedCritical / criticalNodes.length;
    const attackRatio = attackedCritical / criticalNodes.length;
    
    defenderScore += protectionRatio * criticalWeight;
    attackerScore += attackRatio * criticalWeight;
    factors.criticalNodes = {
      total: criticalNodes.length,
      protected: protectedCritical,
      attacked: attackedCritical,
      protectionRate: (protectionRatio * 100).toFixed(1) + '%'
    };
  }

  // 4. Defense Coverage Analysis (10% weight)
  const recentAttacks = gameState.attacker.attacks.slice(-3);
  let coverageEffectiveness = 0;
  
  if (recentAttacks.length > 0) {
    recentAttacks.forEach(attack => {
      const bestDefenseEffectiveness = gameState.defender.defenses.reduce((max, defense) => {
        const defData = defenseOptions.find(d => d.id === defense.id);
        return Math.max(max, defData?.effectiveness?.[attack.type] || 0);
      }, 0);
      coverageEffectiveness += bestDefenseEffectiveness;
    });
    coverageEffectiveness /= recentAttacks.length;
  }
  
  const coverageWeight = 10;
  defenderScore += coverageEffectiveness * coverageWeight;
  factors.defenseCoverage = {
    effectiveness: (coverageEffectiveness * 100).toFixed(1) + '%',
    recentAttacks: recentAttacks.length
  };

  // 5. Turn-based Momentum (10% weight)
  const momentumWeight = 10;
  if (gameState.turn > 0) {
    // Recent security trend
    const securityTrend = gameState.network.security_level > 4 ? 'improving' : 'declining';
    if (securityTrend === 'improving') {
      defenderScore += momentumWeight * 0.7;
    } else {
      attackerScore += momentumWeight * 0.7;
    }
    factors.momentum = {
      trend: securityTrend,
      turn: gameState.turn
    };
  }

  // Normalize scores to probabilities
  const totalScore = attackerScore + defenderScore;
  let attackerProbability = totalScore > 0 ? (attackerScore / totalScore) * 100 : 50;
  let defenderProbability = totalScore > 0 ? (defenderScore / totalScore) * 100 : 50;

  // Apply critical thresholds
  if (gameState.network.security_level <= 1) {
    attackerProbability = Math.max(attackerProbability, 85);
    defenderProbability = 100 - attackerProbability;
  } else if (gameState.network.security_level >= 8) {
    defenderProbability = Math.max(defenderProbability, 80);
    attackerProbability = 100 - defenderProbability;
  }

  // Check for imminent threats
  if (gameState.attacker.resources >= 10 && gameState.network.security_level <= 3) {
    attackerProbability = Math.max(attackerProbability, 75);
    defenderProbability = 100 - attackerProbability;
  }

  // Ensure probabilities sum to 100
  const total = attackerProbability + defenderProbability;
  if (total !== 100) {
    attackerProbability = (attackerProbability / total) * 100;
    defenderProbability = (defenderProbability / total) * 100;
  }

  return {
    attacker: Math.round(attackerProbability * 10) / 10,
    defender: Math.round(defenderProbability * 10) / 10,
    factors: factors,
    confidence: gameState.turn > 5 ? 'High' : gameState.turn > 2 ? 'Medium' : 'Low',
    trend: attackerProbability > 50 ? 'Attacker Favored' : 'Defender Favored'
  };
}

// Enhanced JSON Loader with Validation
const loadJSONData = (filename) => {
  try {
    const filePath = path.join(__dirname, 'data', filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filename}`);
    }

    const rawData = fs.readFileSync(filePath, 'utf-8').trim();
    if (!rawData) {
      throw new Error(`Empty file: ${filename}`);
    }

    const parsedData = JSON.parse(rawData);
    console.log(`✓ Successfully loaded ${filename}`);
    return parsedData;
  } catch (err) {
    console.error(`✗ Error loading ${filename}:`, err.message);
    process.exit(1);
  }
};

// Load Game Data
console.log('\nLoading game data...');
const gameData = {
  attacks: loadJSONData('attack_patterns.json').attacks,
  defenses: loadJSONData('defense_patterns.json').defenses,
  network: loadJSONData('network.json').network,
  threats: loadJSONData('threat_history.json')
};

const { attacks: attackPatterns, defenses: defenseOptions, network: networkConfig } = gameData;

// Initialize Game State
let gameState = {
  turn: 0,
  attacker: {
    resources: CONFIG.INITIAL_RESOURCES,
    lastMove: null,
    attacks: [],
    availableAttacks: attackPatterns.map(a => a.id)
  },
  defender: {
    resources: CONFIG.INITIAL_RESOURCES,
    lastMove: null,
    defenses: [],
    availableDefenses: defenseOptions.map(d => d.id)
  },
  network: {
    security_level: 5,
    nodes: networkConfig.nodes.map(node => ({
      ...node,
      protected: false,
      attacked: false,
      protections: node.protections || [],
      vulnerabilities: node.vulnerabilities || []
    })),
    traffic: networkConfig.traffic_patterns.normal
  },
  gameOver: false,
  winner: null,
  currentPlayer: 'attacker'
};

// Deterministic Minimax AI Implementation
class MinimaxAI {
  constructor(depth = CONFIG.MINIMAX_DEPTH) {
    this.depth = depth;
    this.threatHistory = gameData.threats;
    this.lastDefense = null;
    this.defenseStreak = 0;
  }

  evaluate(state) {
    if (state.gameOver) {
      return state.winner === 'defender' ? Infinity : -Infinity;
    }

    // Base security score (0-40 points)
    let score = (state.network.security_level / CONFIG.MAX_SECURITY) * 40;
    
    // Resource advantage (up to 20 points)
    const resourceDiff = state.defender.resources - state.attacker.resources;
    score += Math.min(20, resourceDiff * 0.5);
    
    // Critical node protection (up to 20 points)
    const criticalNodes = state.network.nodes.filter(n => n.criticality === 'Critical');
    const protectedCritical = criticalNodes.filter(n => n.protected).length;
    score += (protectedCritical / criticalNodes.length) * 20;
    
    // Vulnerability coverage (up to 20 points)
    let coverageScore = 0;
    state.defender.defenses.forEach(defense => {
      const defData = defenseOptions.find(d => d.id === defense.id);
      if (!defData) return;
      
      // Calculate coverage effectiveness based on recent attacks
      const recentAttacks = state.attacker.attacks.slice(-3);
      let attackCoverage = 0;
      
      recentAttacks.forEach(attack => {
        if (defData.effectiveness[attack.type]) {
          attackCoverage += defData.effectiveness[attack.type];
        }
      });
      
      coverageScore += attackCoverage * 5;
    });
    score += Math.min(20, coverageScore);
    
    // Defense variety bonus (up to 10 points)
    const defenseTypes = new Set(state.defender.defenses.map(d => d.type));
    score += defenseTypes.size * 2;
    
    // Recent attack pattern penalty
    if (state.attacker.lastMove) {
      const attackType = state.attacker.lastMove.type;
      const defenseEffectiveness = state.defender.defenses.reduce((max, defense) => {
        const defData = defenseOptions.find(d => d.id === defense.id);
        return Math.max(max, defData?.effectiveness[attackType] || 0);
      }, 0);
      
      score -= (1 - defenseEffectiveness) * 10;
    }
    
    return score;
  }

  getBestMove(state) {
    const validDefenses = defenseOptions.filter(d =>
      state.defender.resources >= d.cost &&
      state.defender.availableDefenses.includes(d.id)
    );

    if (validDefenses.length === 0) return null;

    let bestScore = -Infinity;
    let bestMoves = [];
    let alpha = -Infinity;
    let beta = Infinity;

    // First pass: evaluate all defenses
    for (const defense of validDefenses) {
      const simulatedState = this.simulateMove(JSON.parse(JSON.stringify(state)), defense);
      const score = this.minimax(simulatedState, this.depth - 1, false, alpha, beta);
      
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [defense];
        alpha = Math.max(alpha, bestScore);
      } else if (score === bestScore) {
        bestMoves.push(defense);
      }
      
      if (beta <= alpha) break;
    }

    // Strategic selection from equally good defenses
    if (bestMoves.length > 1) {
      // Get recent attack types
      const recentAttacks = state.attacker.attacks.slice(-3).map(a => a.type);
      
      // Score each defense based on recent attack coverage
      const scoredDefenses = bestMoves.map(defense => {
        let defenseScore = 0;
        
        // Coverage against recent attacks
        recentAttacks.forEach(attackType => {
          defenseScore += defense.effectiveness[attackType] || 0;
        });
        
        // Variety bonus - prefer less used defense types
        const defenseTypeCount = state.defender.defenses
          .filter(d => d.type === defense.type).length;
        defenseScore -= defenseTypeCount * 0.5;
        
        return { defense, score: defenseScore };
      });
      
      // Sort by coverage score and select top
      scoredDefenses.sort((a, b) => b.score - a.score);
      return scoredDefenses[0].defense;
    }
    
    return bestMoves[0];
  }

  getDefenseTypeCount(state, type) {
    return state.defender.defenses.filter(d => {
      const defData = defenseOptions.find(def => def.id === d.id);
      return defData && defData.type === type;
    }).length;
  }

  minimax(state, depth, isMaximizing, alpha, beta) {
    if (depth === 0 || state.gameOver) {
      return this.evaluate(state);
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      const validDefenses = defenseOptions.filter(d =>
        state.defender.resources >= d.cost &&
        state.defender.availableDefenses.includes(d.id)
      );
      
      if (validDefenses.length === 0) {
        return this.evaluate(state);
      }
      
      for (const defense of validDefenses) {
        const newState = this.simulateMove(JSON.parse(JSON.stringify(state)), defense);
        const evaluation = this.minimax(newState, depth - 1, false, alpha, beta);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      const validAttacks = attackPatterns.filter(a =>
        state.attacker.resources >= a.cost &&
        state.attacker.availableAttacks.includes(a.id)
      );
      
      if (validAttacks.length === 0) {
        return this.evaluate(state);
      }
      
      for (const attack of validAttacks) {
        const newState = this.simulateMove(JSON.parse(JSON.stringify(state)), attack);
        const evaluation = this.minimax(newState, depth - 1, true, alpha, beta);
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  simulateMove(state, move) {
    if (move.type) {
      // Defense move
      state.defender.resources -= move.cost || 0;
      state.network.security_level = Math.min(
        CONFIG.MAX_SECURITY,
        state.network.security_level + (move.security_boost || 0)
      );
      
      // Apply protection based on coverage
      if (move.coverage && state.network.nodes) {
        state.network.nodes.forEach(node => {
          if (node.protections && move.coverage.some(cov => 
            node.protections.includes(cov))) {
            node.protected = true;
            
            // Special effects for certain defenses
            if (move.type === 'EDR' && node.attacked) {
              // EDR can recover some security from attacked nodes
              state.network.security_level += 0.2;
            }
          }
        });
      }
      
      // Special effects for SIEM
      if (move.type === 'SIEM') {
        // SIEM improves detection of future attacks
        state.defender.defenses.forEach(d => {
          const defData = defenseOptions.find(def => def.id === d.id);
          if (defData && (defData.type === 'IDS' || defData.type === 'Firewall')) {
            // Create a new effectiveness object with boosted values
            const boostedEffectiveness = {};
            for (const [attackType, effectiveness] of Object.entries(defData.effectiveness)) {
              boostedEffectiveness[attackType] = Math.min(1, effectiveness * 1.1);
            }
            // Update the defense data
            d.effectiveness = boostedEffectiveness;
          }
        });
      }
      
      state.defender.lastMove = move;
      state.defender.defenses.push(move);
      state.currentPlayer = 'attacker';
    } else {
      // Attack move
      const attackData = attackPatterns.find(a => a.id === move.id);
      if (!attackData) return state;

      state.attacker.resources -= attackData.cost;

      // Find vulnerable nodes safely
      const targetNodes = state.network.nodes.filter(n => 
        n.vulnerabilities && n.vulnerabilities.includes(attackData.type) && 
        !n.protected
      ) || [];
      
      const vulnerabilityModifier = targetNodes.length > 0 ? 
        1.0 + (0.1 * targetNodes.length) : 1.0;

      state.network.security_level = Math.max(
        CONFIG.MIN_SECURITY,
        state.network.security_level - (attackData.success_rate * vulnerabilityModifier)
      );
      
      // Mark attacked nodes
      targetNodes.forEach(node => {
        node.attacked = true;
        if (node.criticality === 'Critical') {
          state.network.security_level *= CONFIG.CRITICAL_NODE_PENALTY;
        }
      });

      state.attacker.lastMove = attackData;
      state.attacker.attacks.push(attackData);
      state.currentPlayer = 'defender';
    }
    
    this.updateGameState(state);
    return state;
  }

  updateGameState(state) {
    if (!state || !state.network) return;
    
    state.turn++;
    
    state.network.security_level = Math.max(
      CONFIG.MIN_SECURITY,
      (state.network.security_level || 5) - CONFIG.SECURITY_DECAY
    );

    if (state.attacker.attacks && state.attacker.attacks.some(a => a.type === 'DDoS')) {
      state.network.traffic = networkConfig.traffic_patterns.under_attack;
    } else {
      state.network.traffic = networkConfig.traffic_patterns.normal;
    }

    if (state.currentPlayer === 'attacker') {
      state.attacker.resources += CONFIG.TURN_RESOURCES.attacker;
    } else {
      state.defender.resources += CONFIG.TURN_RESOURCES.defender;
    }

    this.checkGameEnd(state);
  }

  checkGameEnd(state) {
    if (!state || !state.network) return;

    // Security level check
    if (state.network.security_level <= CONFIG.MIN_SECURITY) {
      state.gameOver = true;
      state.winner = 'attacker';
      return;
    }

    // Resource exhaustion
    if (state.attacker.resources <= 0) {
      state.gameOver = true;
      state.winner = 'defender';
      return;
    }

    // Critical node compromise
    const criticalNodes = state.network.nodes.filter(n => n.criticality === 'Critical');
    if (criticalNodes.some(n => n.attacked)) {
      state.gameOver = true;
      state.winner = 'attacker';
      return;
    }

    // Defense victory condition
    const allCriticalProtected = criticalNodes.every(n => n.protected);
    if (allCriticalProtected && state.network.security_level >= 7 && state.turn > 10) {
      state.gameOver = true;
      state.winner = 'defender';
    }
  }
}

const ai = new MinimaxAI();

// API Endpoints
app.use(express.json());
app.use(express.static('public'));

// Game Initialization
app.get('/init', (req, res) => {
  gameState = {
    turn: 0,
    attacker: {
      resources: CONFIG.INITIAL_RESOURCES,
      lastMove: null,
      attacks: [],
      availableAttacks: attackPatterns.map(a => a.id)
    },
    defender: {
      resources: CONFIG.INITIAL_RESOURCES,
      lastMove: null,
      defenses: [],
      availableDefenses: defenseOptions.map(d => d.id)
    },
    network: {
      security_level: 5,
      nodes: networkConfig.nodes.map(node => ({
        ...node,
        protected: false,
        attacked: false,
        protections: node.protections || [],
        vulnerabilities: node.vulnerabilities || []
      })),
      traffic: networkConfig.traffic_patterns.normal
    },
    gameOver: false,
    winner: null,
    currentPlayer: 'attacker'
  };

  res.json({
    gameState,
    attacks: attackPatterns,
    defenses: defenseOptions,
    network: networkConfig,
    config: CONFIG
  });
});

// Attack Endpoint
app.post('/attack', (req, res) => {
  try {
    if (gameState.gameOver) {
      return res.status(400).json({ error: "Game has ended" });
    }
    if (gameState.currentPlayer !== 'attacker') {
      return res.status(400).json({ error: "Not attacker's turn" });
    }

    const { attackId } = req.body;
    const attack = attackPatterns.find(a => a.id === attackId);

    if (!attack || !gameState.attacker.availableAttacks.includes(attackId)) {
      return res.status(400).json({ error: "Invalid attack" });
    }
    if (gameState.attacker.resources < attack.cost) {
      return res.status(400).json({ 
        error: `Need ${attack.cost} resources (have ${gameState.attacker.resources})` 
      });
    }

    gameState.attacker.resources -= attack.cost;

    const targetNodes = gameState.network.nodes.filter(n => 
      n.vulnerabilities && n.vulnerabilities.includes(attack.type) && 
      !n.protected
    ) || [];
    
    const vulnerabilityModifier = targetNodes.length > 0 ? 
      1.0 + (0.1 * targetNodes.length) : 1.0;

    const damage = attack.success_rate * vulnerabilityModifier;
    gameState.network.security_level = Math.max(
      CONFIG.MIN_SECURITY,
      gameState.network.security_level - damage
    );

    targetNodes.forEach(node => {
      node.attacked = true;
      if (node.criticality === 'Critical') {
        gameState.network.security_level *= CONFIG.CRITICAL_NODE_PENALTY;
      }
    });

    gameState.attacker.lastMove = attack;
    gameState.attacker.attacks.push(attack);
    gameState.currentPlayer = 'defender';

    ai.updateGameState(gameState);
    const winProbability = calculateWinProbability(gameState);

    res.json({
      gameState,
      attack: {
        name: attack.name,
        type: attack.type,
        cost: attack.cost,
        damage: damage.toFixed(2),
        criticalHit: targetNodes.some(n => n.criticality === 'Critical'),
        targetNodes: targetNodes.map(n => n.name)
      },
      securityDisplay: {
        value: gameState.network.security_level.toFixed(2),
        max: CONFIG.MAX_SECURITY,
        percent: (gameState.network.security_level / CONFIG.MAX_SECURITY) * 100
      },
      winProbability: winProbability
    });
  } catch (err) {
    console.error('Attack error:', err);
    res.status(500).json({ 
      error: "Internal server error",
      details: err.message 
    });
  }
});

// Defend Endpoint
app.post('/defend', (req, res) => {
  try {
    if (gameState.gameOver) {
      return res.status(400).json({ error: "Game has ended" });
    }
    if (gameState.currentPlayer !== 'defender') {
      return res.status(400).json({ error: "Not defender's turn" });
    }

    const defense = ai.getBestMove(gameState);
    
    if (!defense || !defenseOptions.find(d => d.id === defense.id)) {
      gameState.currentPlayer = 'attacker';
      ai.updateGameState(gameState);
      return res.json({
        gameState,
        defense: null,
        message: "No valid defense available - turn skipped",
        securityLevel: gameState.network.security_level.toFixed(2)
      });
    }

    // Ensure defense has required properties
    defense.security_boost = defense.security_boost || 0;
    defense.coverage = defense.coverage || [];
    defense.cost = defense.cost || 0;

    gameState.defender.resources -= defense.cost;
    gameState.network.security_level = Math.min(
      CONFIG.MAX_SECURITY,
      gameState.network.security_level + defense.security_boost
    );

    gameState.network.nodes.forEach(node => {
      if (defense.coverage.some(cov => 
        (node.protections || []).includes(cov))) {
        node.protected = true;
      }
    });

    gameState.defender.lastMove = defense;
    gameState.defender.defenses.push(defense);
    gameState.currentPlayer = 'attacker';

    ai.updateGameState(gameState);
    const winProbability = calculateWinProbability(gameState);

    res.json({
      gameState,
      defense: {
        type: defense.type,
        name: defense.name,
        cost: defense.cost,
        boost: defense.security_boost,
        coverage: defense.coverage,
        protectedNodes: gameState.network.nodes
          .filter(n => defense.coverage.some(c => 
            (n.protections || []).includes(c)))
          .map(n => n.name)
      },
      analysis: {
        score: ai.evaluate(gameState),
        threatsMitigated: defense.effectiveness || {}
      },
      securityDisplay: {
        value: gameState.network.security_level.toFixed(2),
        max: CONFIG.MAX_SECURITY,
        percent: (gameState.network.security_level / CONFIG.MAX_SECURITY) * 100
      },
      winProbability: winProbability
    });
  } catch (err) {
    console.error('Defense error:', err);
    res.status(500).json({ 
      error: "Internal server error",
      details: err.message 
    });
  }
});

// Game State Inspection
app.get('/game-state', (req, res) => {
  res.json({
    state: gameState,
    threats: gameData.threats,
    network: networkConfig,
    securityDisplay: {
      value: gameState.network.security_level.toFixed(2),
      max: CONFIG.MAX_SECURITY,
      percent: (gameState.network.security_level / CONFIG.MAX_SECURITY) * 100
    },
    analysis: ai.evaluate(gameState)
  });
});

// Win Probability Endpoint
app.get('/win-probability', (req, res) => {
  try {
    const probability = calculateWinProbability(gameState);
    res.json({
      probability: probability,
      gameState: {
        turn: gameState.turn,
        security: gameState.network.security_level.toFixed(2),
        currentPlayer: gameState.currentPlayer,
        gameOver: gameState.gameOver
      }
    });
  } catch (err) {
    console.error('Win probability error:', err);
    res.status(500).json({ 
      error: "Could not calculate win probability",
      details: err.message 
    });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`\n=== CYBER SECURITY MINIMAX SIMULATION ===`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Attack patterns: ${attackPatterns.length}`);
  console.log(`Defense options: ${defenseOptions.length}`);
  console.log(`Network nodes: ${networkConfig.nodes.length}`);
  console.log(`AI Depth: ${CONFIG.MINIMAX_DEPTH}`);
  console.log(`Initial resources: ${CONFIG.INITIAL_RESOURCES}\n`);
});

// Error Handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use.`);
    console.log(`1. Kill the process: 'lsof -i :${PORT}' then 'kill <PID>'`);
    console.log(`2. Use a different port: 'PORT=4000 node server.js'`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nShutting down server gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});