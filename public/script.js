// Add this to your script.js file - new DOM elements and functions

// Add these new DOM element references at the top with your other DOM elements
const predictionPanel = document.getElementById('prediction-panel');
const predictionList = document.getElementById('prediction-list');
const predictionSummary = document.getElementById('prediction-summary');
const togglePredictionsBtn = document.getElementById('toggle-predictions');

// Add prediction state variables
let predictionsVisible = true;
let currentPredictions = null;

// Add this function to fetch and display attack predictions
async function fetchAttackPredictions() {
  try {
    const response = await fetch('/attack-predictions');
    if (!response.ok) {
      throw new Error('Failed to fetch predictions');
    }
    
    const data = await response.json();
    currentPredictions = data;
    renderPredictions(data);
  } catch (error) {
    console.error('Prediction fetch error:', error);
    addLog('Failed to fetch attack predictions', true);
  }
}

// Function to render predictions in the UI
function renderPredictions(data) {
  if (!predictionPanel || !data.predictions) return;

  // Update summary
  if (predictionSummary) {
    predictionSummary.innerHTML = `
      <div class="prediction-summary">
        <h3>🔮 Attack Prediction Analysis</h3>
        <div class="summary-stats">
          <div class="stat">
            <span class="stat-label">Most Likely:</span>
            <span class="stat-value">${data.summary.mostLikely}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Confidence:</span>
            <span class="stat-value confidence-${data.summary.confidence.toLowerCase()}">${data.summary.confidence}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Pattern:</span>
            <span class="stat-value">${data.summary.recentPattern}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Attacks Analyzed:</span>
            <span class="stat-value">${data.summary.totalAttacks}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Update prediction list
  if (predictionList) {
    predictionList.innerHTML = '';
    
    data.predictions.forEach((prediction, index) => {
      const predictionItem = document.createElement('div');
      predictionItem.className = `prediction-item ${index === 0 ? 'most-likely' : ''}`;
      
      predictionItem.innerHTML = `
        <div class="prediction-header">
          <span class="attack-name">${prediction.attackName}</span>
          <span class="probability">${prediction.probability}%</span>
        </div>
        <div class="prediction-details">
          <span class="attack-type">${prediction.attackType}</span>
          <span class="confidence-badge confidence-${prediction.confidence.toLowerCase()}">${prediction.confidence}</span>
        </div>
        <div class="prediction-factors">
          ${renderFactors(prediction.factors)}
        </div>
      `;
      
      predictionList.appendChild(predictionItem);
    });
  }
}

// Function to render prediction factors as mini bars
function renderFactors(factors) {
  const factorNames = {
    transition: 'Pattern',
    frequency: 'Frequency',
    resource: 'Resources',
    efficiency: 'Efficiency',
    recency: 'Recency',
    security: 'Security'
  };
  
  return Object.entries(factors)
    .map(([key, value]) => {
      const percentage = Math.round(value * 100);
      return `
        <div class="factor">
          <span class="factor-name">${factorNames[key] || key}</span>
          <div class="factor-bar">
            <div class="factor-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="factor-value">${percentage}%</span>
        </div>
      `;
    }).join('');
}

// Function to get detailed prediction analysis
async function fetchDetailedAnalysis() {
  try {
    const response = await fetch('/prediction-analysis');
    if (!response.ok) {
      throw new Error('Failed to fetch detailed analysis');
    }
    
    const data = await response.json();
    showDetailedAnalysis(data);
  } catch (error) {
    console.error('Detailed analysis error:', error);
    addLog('Failed to fetch detailed analysis', true);
  }
}

// Function to show detailed analysis modal/popup
function showDetailedAnalysis(data) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'analysis-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>🔍 Detailed Attack Prediction Analysis</h2>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="analysis-section">
          <h3>Attack Probabilities</h3>
          ${data.detailedAnalysis.map(pred => `
            <div class="detailed-prediction">
              <div class="attack-info">
                <h4>${pred.attack.name} (${pred.attack.type})</h4>
                <p>Cost: ${pred.attack.cost} | Success Rate: ${Math.round(pred.attack.successRate * 100)}% | Probability: ${pred.probability}%</p>
              </div>
              <div class="factor-breakdown">
                ${Object.entries(pred.factors).map(([factor, value]) => `
                  <div class="factor-detail">
                    <span>${factor.charAt(0).toUpperCase() + factor.slice(1)}: ${value}%</span>
                    <div class="mini-bar">
                      <div class="mini-fill" style="width: ${value}%; background-color: ${getFactorColor(factor)}"></div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="analysis-section">
          <h3>Historical Statistics</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-number">${data.historyStats.totalAttacks}</span>
              <span class="stat-label">Total Attacks</span>
            </div>
            <div class="stat-card">
              <span class="stat-number">${data.historyStats.uniqueTypes}</span>
              <span class="stat-label">Unique Types</span>
            </div>
            <div class="stat-card">
              <span class="stat-number">${data.historyStats.avgCost}</span>
              <span class="stat-label">Avg Cost</span>
            </div>
            <div class="stat-card">
              <span class="stat-number">${data.historyStats.mostUsedType}</span>
              <span class="stat-label">Most Used</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal functionality
  const closeBtn = modal.querySelector('.close-modal');
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// Helper function to get color for factors
function getFactorColor(factor) {
  const colors = {
    transition: '#3498db',
    frequency: '#e74c3c',
    resource: '#2ecc71',
    efficiency: '#f39c12',
    recency: '#9b59b6',
    security: '#1abc9c'
  };
  return colors[factor] || '#95a5a6';
}

// Modify your existing sendAttack function to update predictions
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
    
    // Update predictions if included in response
    if (data.predictions) {
      currentPredictions = data.predictions;
      renderPredictions(data.predictions);
    }
    
    addLog(`Attacked with ${attack.name} (${attack.type})`);
    updateUI();
    renderNetworkGraph();

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

// Modify your existing updateUI function to include prediction updates
function updateUI() {
  // Update all existing UI elements
  updatePlayerInfo();
  updateNetworkStatus();
  updateButtonStates();
  updateAvailableAttacks();
  updateGameLog();
  
  // Update predictions when it's attacker's turn and game is not over
  if (gameState.currentPlayer === 'attacker' && !gameState.gameOver) {
    fetchAttackPredictions();
  }
  
  // Hide predictions panel if game is over or it's defender's turn
  if (gameState.gameOver || gameState.currentPlayer === 'defender') {
    if (predictionPanel) {
      predictionPanel.style.display = 'none';
    }
  } else {
    if (predictionPanel && predictionsVisible) {
      predictionPanel.style.display = 'block';
    }
  }
}

// Toggle predictions panel visibility
function togglePredictions() {
  predictionsVisible = !predictionsVisible;
  if (predictionPanel) {
    predictionPanel.style.display = predictionsVisible ? 'block' : 'none';
  }
  if (togglePredictionsBtn) {
    togglePredictionsBtn.textContent = predictionsVisible ? 'Hide Predictions' : 'Show Predictions';
  }
}

// Add event listeners for prediction features
document.addEventListener('DOMContentLoaded', () => {
  // Toggle predictions button
  if (togglePredictionsBtn) {
    togglePredictionsBtn.addEventListener('click', togglePredictions);
  }
  
  // Add detailed analysis button if it exists
  const detailedAnalysisBtn = document.getElementById('detailed-analysis-btn');
  if (detailedAnalysisBtn) {
    detailedAnalysisBtn.addEventListener('click', fetchDetailedAnalysis);
  }
  
  // Add refresh predictions button if it exists
  const refreshPredictionsBtn = document.getElementById('refresh-predictions-btn');
  if (refreshPredictionsBtn) {
    refreshPredictionsBtn.addEventListener('click', fetchAttackPredictions);
  }
});

// Auto-refresh predictions periodically when it's attacker's turn
setInterval(() => {
  if (gameState && gameState.currentPlayer === 'attacker' && !gameState.gameOver && predictionsVisible) {
    fetchAttackPredictions();
  }
}, 5000); // Refresh every 5 seconds

// Add keyboard shortcuts for prediction features
document.addEventListener('keydown', (e) => {
  // Press 'P' to toggle predictions
  if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.altKey) {
    togglePredictions();
  }
  
  // Press 'A' to show detailed analysis
  if (e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.altKey) {
    if (gameState && gameState.currentPlayer === 'attacker' && !gameState.gameOver) {
      fetchDetailedAnalysis();
    }
  }
  
  // Press 'R' to refresh predictions
  if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.altKey) {
    if (gameState && gameState.currentPlayer === 'attacker' && !gameState.gameOver) {
      fetchAttackPredictions();
    }
  }
});

// Helper function to format prediction confidence
function formatConfidence(confidence) {
  const confidenceMap = {
    'Very High': '🔥',
    'High': '⚡',
    'Medium': '⚠️',
    'Low': '🤔',
    'Very Low': '❓'
  };
  return confidenceMap[confidence] || confidence;
}

// Helper function to get prediction color based on probability
function getPredictionColor(probability) {
  if (probability >= 80) return '#e74c3c'; // Red for very high
  if (probability >= 60) return '#f39c12'; // Orange for high
  if (probability >= 40) return '#f1c40f'; // Yellow for medium
  if (probability >= 20) return '#3498db'; // Blue for low
  return '#95a5a6'; // Gray for very low
}

// Enhanced prediction item click handler
function onPredictionItemClick(attackId) {
  if (gameState && gameState.currentPlayer === 'attacker' && !gameState.gameOver) {
    // Highlight the corresponding attack button
    const attackBtn = document.querySelector(`[data-attack-id="${attackId}"]`);
    if (attackBtn) {
      attackBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      attackBtn.classList.add('highlighted');
      setTimeout(() => {
        attackBtn.classList.remove('highlighted');
      }, 2000);
    }
  }
}

// Function to show prediction tooltip
function showPredictionTooltip(element, prediction) {
  const tooltip = document.createElement('div');
  tooltip.className = 'prediction-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-content">
      <h4>${prediction.attackName}</h4>
      <p><strong>Type:</strong> ${prediction.attackType}</p>
      <p><strong>Probability:</strong> ${prediction.probability}%</p>
      <p><strong>Confidence:</strong> ${prediction.confidence}</p>
      <div class="tooltip-factors">
        <strong>Key Factors:</strong>
        ${Object.entries(prediction.factors).map(([key, value]) => 
          `<span class="factor-tag">${key}: ${Math.round(value * 100)}%</span>`
        ).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(tooltip);
  
  const rect = element.getBoundingClientRect();
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
  
  // Remove tooltip after 3 seconds or on mouse leave
  setTimeout(() => {
    if (tooltip.parentNode) {
      document.body.removeChild(tooltip);
    }
  }, 3000);
  
  element.addEventListener('mouseleave', () => {
    if (tooltip.parentNode) {
      document.body.removeChild(tooltip);
    }
  }, { once: true });
}

// Export functions for use in other files if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchAttackPredictions,
    renderPredictions,
    fetchDetailedAnalysis,
    togglePredictions,
    formatConfidence,
    getPredictionColor
  };
}