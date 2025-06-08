// server.js - Complete structure with Attack Predictor

const express = require('express');
const path = require('path');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Game Configuration
const CONFIG = {
  MAX_SECURITY: 100,
  MIN_SECURITY: 0,
  CRITICAL_NODE_PENALTY: 0.8,
  INITIAL_ATTACKER_RESOURCES: 20,
  INITIAL_DEFENDER_RESOURCES: 15
};

// Attack Patterns
const attackPatterns = [
  { id: 'dos', name: 'DDoS Attack', type: 'network', cost: 3, success_rate: 0.7 },
  { id: 'sql', name: 'SQL Injection', type: 'application', cost: 4, success_rate: 0.6 },
  { id: 'phishing', name: 'Phishing Campaign', type: 'social', cost: 2, success_rate: 0.8 },
  { id: 'malware', name: 'Malware Deploy', type: 'system', cost: 5, success_rate: 0.5 },
  { id: 'mitm', name: 'Man-in-Middle', type: 'network', cost: 6, success_rate: 0.4 },
  { id: 'brute', name: 'Brute Force', type: 'authentication', cost: 3, success_rate: 0.6 },
  { id: 'zero_day', name: 'Zero-Day Exploit', type: 'system', cost: 8, success_rate: 0.9 }
];

// AttackPredictor Class Definition
class AttackPredictor {
  constructor() {
    this.attackHistory = [];
    this.transitionMatrix = new Map();
    this.attackFrequency = new Map();
    this.lastUpdateTime = Date.now();
  }

  updateHistory(attack, gameState) {
    const attackRecord = {
      id: attack.id,
      name: attack.name,
      type: attack.type,
      cost: attack.cost,
      successRate: attack.success_rate,
      timestamp: Date.now(),
      gameContext: {
        turn: gameState.turn,
        securityLevel: gameState.network.security_level,
        attackerResources: gameState.attacker.resources,
        availableAttacks: [...gameState.attacker.availableAttacks]
      }
    };

    this.attackHistory.push(attackRecord);
    this.updateTransitionMatrix();
    this.updateFrequencyMap();
    this.lastUpdateTime = Date.now();

    if (this.attackHistory.length > 50) {
      this.attackHistory.shift();
    }
  }

  updateTransitionMatrix() {
    this.transitionMatrix.clear();
    
    for (let i = 1; i < this.attackHistory.length; i++) {
      const prevAttack = this.attackHistory[i - 1];
      const currentAttack = this.attackHistory[i];
      
      const key = `${prevAttack.type}->${currentAttack.type}`;
      this.transitionMatrix.set(key, (this.transitionMatrix.get(key) || 0) + 1);
    }
  }

  updateFrequencyMap() {
    this.attackFrequency.clear();
    
    this.attackHistory.forEach(attack => {
      this.attackFrequency.set(attack.type, (this.attackFrequency.get(attack.type) || 0) + 1);
    });
  }

  predictNextAttack(availableAttacks, gameState) {
    if (this.attackHistory.length === 0) {
      return availableAttacks.map(attack => ({
        attack,
        probability: 1 / availableAttacks.length,
        confidence: 'Low',
        factors: {
          transition: 0,
          frequency: 0,
          resource: 1 / availableAttacks.length,
          efficiency: attack.success_rate || 0.5,
          recency: 0,
          security: this.getSecurityFactor(attack, gameState)
        }
      }));
    }

    const predictions = availableAttacks.map(attack => {
      const factors = this.calculatePredictionFactors(attack, gameState);
      const probability = this.calculateOverallProbability(factors);
      const confidence = this.calculateConfidence(probability, factors);

      return {
        attack,
        probability,
        confidence,
        factors
      };
    });

    const totalProb = predictions.reduce((sum, pred) => sum + pred.probability, 0);
    if (totalProb > 0) {
      predictions.forEach(pred => {
        pred.probability = pred.probability / totalProb;
      });
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  calculatePredictionFactors(attack, gameState) {
    return {
      transition: this.getTransitionProbability(attack),
      frequency: this.getFrequencyScore(attack),
      resource: this.getResourceScore(attack, gameState),
      efficiency: this.getEfficiencyScore(attack, gameState),
      recency: this.getRecencyScore(attack),
      security: this.getSecurityFactor(attack, gameState)
    };
  }

  getTransitionProbability(attack) {
    if (this.attackHistory.length === 0) return 0;
    
    const lastAttack = this.attackHistory[this.attackHistory.length - 1];
    const transitionKey = `${lastAttack.type}->${attack.type}`;
    const transitionCount = this.transitionMatrix.get(transitionKey) || 0;
    
    const totalFromLastType = Array.from(this.transitionMatrix.entries())
      .filter(([key]) => key.startsWith(`${lastAttack.type}->`))
      .reduce((sum, [, count]) => sum + count, 0);
    
    return totalFromLastType > 0 ? transitionCount / totalFromLastType : 0;
  }

  getFrequencyScore(attack) {
    const attackCount = this.attackFrequency.get(attack.type) || 0;
    const totalAttacks = this.attackHistory.length;
    return totalAttacks > 0 ? attackCount / totalAttacks : 0;
  }

  getResourceScore(attack, gameState) {
    const resourceRatio = gameState.attacker.resources / attack.cost;
    return Math.min(resourceRatio / 5, 1);
  }

  getEfficiencyScore(attack, gameState) {
    const baseEfficiency = attack.success_rate || 0.5;
    
    const vulnerableNodes = gameState.network.nodes.filter(n => 
      n.vulnerabilities && n.vulnerabilities.includes(attack.type) && !n.protected
    );
    
    const vulnerabilityBonus = vulnerableNodes.length * 0.1;
    return Math.min(baseEfficiency + vulnerabilityBonus, 1);
  }

  getRecencyScore(attack) {
    const recentAttacks = this.attackHistory.slice(-3);
    const recentCount = recentAttacks.filter(a => a.type === attack.type).length;
    return Math.max(0, 1 - (recentCount * 0.3));
  }

  getSecurityFactor(attack, gameState) {
    const securityLevel = gameState.network.security_level;
    const maxSecurity = 100;
    
    const securityRatio = securityLevel / maxSecurity;
    const costFactor = attack.cost / 10;
    
    return securityRatio * costFactor;
  }

  calculateOverallProbability(factors) {
    const weights = {
      transition: 0.25,
      frequency: 0.20,
      resource: 0.15,
      efficiency: 0.20,
      recency: 0.10,
      security: 0.10
    };

    return Object.entries(factors).reduce((sum, [factor, value]) => {
      return sum + (value * (weights[factor] || 0));
    }, 0);
  }

  calculateConfidence(probability, factors) {
    const avgFactor = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;
    const confidenceScore = (probability + avgFactor) / 2;

    if (confidenceScore >= 0.8) return 'Very High';
    if (confidenceScore >= 0.6) return 'High';
    if (confidenceScore >= 0.4) return 'Medium';
    if (confidenceScore >= 0.2) return 'Low';
    return 'Very Low';
  }

  getPredictionSummary(availableAttacks, gameState) {
    const predictions = this.predictNextAttack(availableAttacks, gameState);
    
    if (predictions.length === 0) {
      return {
        predictions: [],
        summary: {
          mostLikely: 'No attacks available',
          confidence: 'N/A',
          totalAttacks: this.attackHistory.length,
          recentPattern: 'No pattern detected'
        }
      };
    }

    const topPrediction = predictions[0];
    const recentPattern = this.getRecentPattern();

    return {
      predictions: predictions.map(pred => ({
        attackId: pred.attack.id,
        attackName: pred.attack.name,
        attackType: pred.attack.type,
        probability: Math.round(pred.probability * 100),
        confidence: pred.confidence,
        factors: pred.factors
      })),
      summary: {
        mostLikely: topPrediction.attack.name,
        confidence: topPrediction.confidence,
        totalAttacks: this.attackHistory.length,
        recentPattern: recentPattern
      }
    };
  }

  getRecentPattern() {
    if (this.attackHistory.length < 2) {
      return 'Insufficient data';
    }

    const recentAttacks = this.attackHistory.slice(-5);
    const types = recentAttacks.map(a => a.type);
    
    const uniqueTypes = new Set(types);
    
    if (uniqueTypes.size === 1) {
      return `Repeating ${types[0]} attacks`;
    } else if (uniqueTypes.size === types.length) {
      return 'Diverse attack strategy';
    } else {
      const mostCommon = this.getMostFrequentType(types);
      return `Favoring ${mostCommon} attacks`;
    }
  }

  getMostFrequentType(types) {
    const frequency = {};
    types.forEach(type => {
      frequency[type] = (frequency[type] || 0) + 1;
    });
    
    return Object.keys(frequency).reduce((a, b) => 
      frequency[a] > frequency[b] ? a : b
    );
  }

  getMostUsedAttackType() {
    if (this.attackHistory.length === 0) return 'None';
    
    const typeCounts = {};
    this.attackHistory.forEach(attack => {
      typeCounts[attack.type] = (typeCounts[attack.type] || 0) + 1;
    });
    
    return Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b
    );
  }

  reset() {
    this.attackHistory = [];
    this.transitionMatrix.clear();
    this.attackFrequency.clear();
    this.lastUpdateTime = Date.now();
  }

  getStats() {
    return {
      totalAttacks: this.attackHistory.length,
      uniqueAttackTypes: new Set(this.attackHistory.map(a => a.type)).size,
      avgAttackCost: this.attackHistory.length > 0 ? 
        this.attackHistory.reduce((sum, a) => sum + a.cost, 0) / this.attackHistory.length : 0,
      mostUsedType: this.getMostUsedAttackType(),
      transitionCount: this.transitionMatrix.size,
      lastUpdate: this.lastUpdateTime
    };
  }
}

// Initialize the attack predictor
const attackPredictor = new AttackPredictor();

// Game State (you'll need to add your existing game state structure here)
let gameState = {
  gameOver: false,
  currentPlayer: 'attacker',
  turn: 1,
  attacker: {
    resources: CONFIG.INITIAL_ATTACKER_RESOURCES,
    availableAttacks: ['dos', 'sql', 'phishing', 'malware', 'brute'],
    attacks: [],
    lastMove: null
  },
  defender: {
    resources: CONFIG.INITIAL_DEFENDER_RESOURCES,
    defenses: [],
    lastMove: null
  },
  network: {
    security_level: CONFIG.MAX_SECURITY,
    nodes: [
      { name: 'Web Server', vulnerabilities: ['application', 'network'], protected: false, criticality: 'High' },
      { name: 'Database', vulnerabilities: ['application', 'system'], protected: false, criticality: 'Critical' },
      { name: 'User Accounts', vulnerabilities: ['social', 'authentication'], protected: false, criticality: 'Medium' }
    ]
  }
};

// MinimaxAI Class (add your existing AI implementation here)
class MinimaxAI {
  constructor() {
    this.maxDepth = 3;
  }

  updateGameState(newGameState) {
    // Update AI with current game state
    this.currentGameState = JSON.parse(JSON.stringify(newGameState));
  }

  // Add your existing AI methods here
  // makeMove(), minimax(), evaluateGameState(), etc.
}

const ai = new MinimaxAI();

// API Routes

// Get attack predictions
app.get('/attack-predictions', (req, res) => {
  try {
    if (gameState.gameOver) {
      return res.json({ 
        error: "Game has ended",
        predictions: []
      });
    }

    const availableAttacks = attackPatterns.filter(a =>
      gameState.attacker.resources >= a.cost &&
      gameState.attacker.availableAttacks.includes(a.id)
    );

    if (availableAttacks.length === 0) {
      return res.json({
        predictions: [],
        summary: {
          mostLikely: 'No attacks available',
          confidence: 'N/A',
          totalAttacks: attackPredictor.attackHistory.length,
          recentPattern: 'No available attacks'
        }
      });
    }

    const predictionSummary = attackPredictor.getPredictionSummary(availableAttacks, gameState);

    res.json({
      ...predictionSummary,
      gameState: {
        currentPlayer: gameState.currentPlayer,
        attackerResources: gameState.attacker.resources,
        securityLevel: gameState.network.security_level,
        turn: gameState.turn
      }
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ 
      error: "Failed to generate predictions",
      details: error.message 
    });
  }
});

// Execute attack
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

    // Update attack predictor
    attackPredictor.updateHistory(attack, gameState);
    ai.updateGameState(gameState);

    // Generate predictions for next possible attacks
    const availableAttacks = attackPatterns.filter(a =>
      gameState.attacker.resources >= a.cost &&
      gameState.attacker.availableAttacks.includes(a.id)
    );

    let nextPredictions = null;
    if (availableAttacks.length > 0 && !gameState.gameOver) {
      nextPredictions = attackPredictor.getPredictionSummary(availableAttacks, gameState);
    }

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
      predictions: nextPredictions
    });
  } catch (err) {
    console.error('Attack error:', err);
    res.status(500).json({ 
      error: "Internal server error",
      details: err.message 
    });
  }
});

// Get detailed prediction analysis
app.get('/prediction-analysis', (req, res) => {
  try {
    const availableAttacks = attackPatterns.filter(a =>
      gameState.attacker.resources >= a.cost &&
      gameState.attacker.availableAttacks.includes(a.id)
    );

    if (availableAttacks.length === 0) {
      return res.json({
        error: "No attacks available",
        analysis: null
      });
    }

    const predictions = attackPredictor.predictNextAttack(availableAttacks, gameState);
    
    res.json({
      detailedAnalysis: predictions.map(pred => ({
        attack: {
          id: pred.attack.id,
          name: pred.attack.name,
          type: pred.attack.type,
          cost: pred.attack.cost,
          successRate: pred.attack.success_rate
        },
        probability: Math.round(pred.probability * 100),
        factors: {
          transition: Math.round(pred.factors.transition * 100),
          frequency: Math.round(pred.factors.frequency * 100),
          resource: Math.round(pred.factors.resource * 100),
          efficiency: Math.round(pred.factors.efficiency * 100),
          recency: Math.round(pred.factors.recency * 100),
          security: Math.round(pred.factors.security * 100)
        }
      })),
      historyStats: {
        totalAttacks: attackPredictor.attackHistory.length,
        uniqueTypes: new Set(attackPredictor.attackHistory.map(a => a.type)).size,
        avgCost: attackPredictor.attackHistory.length > 0 ? 
          (attackPredictor.attackHistory.reduce((sum, a) => sum + a.cost, 0) / attackPredictor.attackHistory.length).toFixed(1) : 0,
        mostUsedType: attackPredictor.getMostUsedAttackType()
      }
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: "Failed to generate analysis",
      details: error.message 
    });
  }
});

// Get game state
app.get('/game-state', (req, res) => {
  res.json(gameState);
});

// Reset game
app.post('/reset-game', (req, res) => {
  gameState = {
    gameOver: false,
    currentPlayer: 'attacker',
    turn: 1,
    attacker: {
      resources: CONFIG.INITIAL_ATTACKER_RESOURCES,
      availableAttacks: ['dos', 'sql', 'phishing', 'malware', 'brute'],
      attacks: [],
      lastMove: null
    },
    defender: {
      resources: CONFIG.INITIAL_DEFENDER_RESOURCES,
      defenses: [],
      lastMove: null
    },
    network: {
      security_level: CONFIG.MAX_SECURITY,
      nodes: [
        { name: 'Web Server', vulnerabilities: ['application', 'network'], protected: false, criticality: 'High' },
        { name: 'Database', vulnerabilities: ['application', 'system'], protected: false, criticality: 'Critical' },
        { name: 'User Accounts', vulnerabilities: ['social', 'authentication'], protected: false, criticality: 'Medium' }
      ]
    }
  };
  
  attackPredictor.reset();
  ai.updateGameState(gameState);
  
  res.json({ message: 'Game reset successfully', gameState });
});

// Start server
app.listen(PORT, () => {
  console.log(`Cybersecurity game server running on port ${PORT}`);
  console.log(`Attack prediction system initialized`);
});