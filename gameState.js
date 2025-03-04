// Initial game state definition
const initialGameState = {
  resources: {
    energy: 100,
    minerals: 100,
    knowledge: 50,
    population: 1000
  },
  resourceRates: {
    energy: 5,
    minerals: 3,
    knowledge: 2,
    population: 10
  },
  technologies: {
    researched: ["basic agriculture", "simple tools", "fire control"],
    researching: null,
    available: ["solar power", "basic mining", "primitive astronomy"]
  },
  colonies: {
    "Home World": {
      type: "terrestrial",
      population: 1000,
      buildings: ["settlement", "farm", "mine"],
      specialization: "balanced"
    }
  },
  discoveredSystems: {
    "Home System": {
      star: { type: "G-type", age: "middle-aged" },
      planets: ["Home World", "Inner Rocky Planet", "Gas Giant"],
      explored: true
    }
  },
  knownSystems: ["Nearby Star System"],
  explorationProgress: {},
  lastUpdated: Date.now(),
  gameTime: 0, // in-game days
  events: [],
  stage: "early", // early, mid, late, advanced
  settings: {
    notifications: true,
    tutorial: true
  }
};

// Game state management
class GameState {
  constructor() {
    this.state = this.loadState() || structuredClone(initialGameState);
    this.room = new WebsimSocket();
  }

  // Update resources based on time passed
  updateResources() {
    const now = Date.now();
    const secondsPassed = (now - this.state.lastUpdated) / 1000;
    const hoursPassed = secondsPassed / 3600;
    
    // Update resources based on production rates and time passed
    for (const resource in this.state.resources) {
      if (this.state.resourceRates[resource]) {
        this.state.resources[resource] += this.state.resourceRates[resource] * hoursPassed;
        this.state.resources[resource] = Math.round(this.state.resources[resource] * 10) / 10;
      }
    }
    
    // Update game time (1 real hour = 24 game days)
    this.state.gameTime += hoursPassed * 24;
    this.state.lastUpdated = now;
  }

  // Save state to local storage
  saveState() {
    localStorage.setItem('stellarEvolution', JSON.stringify(this.state));
    return true;
  }

  // Load state from local storage
  loadState() {
    const saved = localStorage.getItem('stellarEvolution');
    return saved ? JSON.parse(saved) : null;
  }

  // Save to database using WebsimSocket
  async saveToDatabase() {
    try {
      const saveData = await this.room.collection('gameSaves').create({
        gameState: this.state
      });
      return saveData.id;
    } catch (error) {
      console.error("Failed to save to database:", error);
      return null;
    }
  }

  // Load from database using WebsimSocket
  async loadFromDatabase() {
    try {
      const saves = this.room.collection('gameSaves').getList();
      if (saves && saves.length > 0) {
        // Get the most recent save
        const latestSave = saves[0];
        this.state = latestSave.gameState;
        this.updateResources();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to load from database:", error);
      return false;
    }
  }

  // Add an event to history
  addEvent(text, type = 'info') {
    this.state.events.unshift({
      text,
      type,
      timestamp: Date.now(),
      gameDay: Math.floor(this.state.gameTime)
    });
    
    // Limit event history
    if (this.state.events.length > 100) {
      this.state.events = this.state.events.slice(0, 100);
    }
  }

  // Get current resource values
  getResources() {
    this.updateResources();
    return this.state.resources;
  }

  // Add or subtract resources
  modifyResource(resource, amount) {
    if (this.state.resources[resource] !== undefined) {
      this.state.resources[resource] += amount;
      return true;
    }
    return false;
  }

  // Get current technologies
  getTechnologies() {
    return {
      researched: this.state.technologies.researched,
      researching: this.state.technologies.researching,
      available: this.state.technologies.available
    };
  }

  // Start researching a technology
  startResearch(technology) {
    if (this.state.technologies.available.includes(technology)) {
      this.state.technologies.researching = technology;
      return true;
    }
    return false;
  }

  // Complete a research project
  completeResearch() {
    const tech = this.state.technologies.researching;
    if (tech) {
      this.state.technologies.researched.push(tech);
      const index = this.state.technologies.available.indexOf(tech);
      if (index > -1) {
        this.state.technologies.available.splice(index, 1);
      }
      this.state.technologies.researching = null;
      return tech;
    }
    return null;
  }

  // Get colony information
  getColony(name) {
    return this.state.colonies[name];
  }

  // Get all colonies
  getAllColonies() {
    return this.state.colonies;
  }

  // Get discovered star systems
  getDiscoveredSystems() {
    return this.state.discoveredSystems;
  }

  // Get events
  getEvents() {
    return this.state.events;
  }

  // Check if a technology is researched
  hasTechnology(tech) {
    return this.state.technologies.researched.includes(tech.toLowerCase());
  }

  // Reset game state
  resetGame() {
    this.state = structuredClone(initialGameState);
    this.state.lastUpdated = Date.now();
    this.saveState();
  }
}

