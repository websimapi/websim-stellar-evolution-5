class GameManager {
  constructor() {
    this.gameState = new GameState();
    this.commandParser = new CommandParser(this);
    this.outputElement = document.getElementById('output');
    this.pendingLLMResponse = false;
    
    // Technology tree with dependencies and effects
    this.technologyTree = {
      "solar power": {
        cost: 100,
        dependencies: [],
        effects: { resourceRates: { energy: 10 } },
        unlocks: ["photovoltaic cells", "solar satellites"]
      },
      "basic mining": {
        cost: 120,
        dependencies: [],
        effects: { resourceRates: { minerals: 8 } },
        unlocks: ["automated mining", "deep drilling"]
      },
      "primitive astronomy": {
        cost: 80,
        dependencies: [],
        effects: { resourceRates: { knowledge: 5 } },
        unlocks: ["orbital mechanics", "stellar cartography"]
      },
      // Add more technologies as needed
    };
    
    // Discovery templates for exploration
    this.discoveryTemplates = {
      system: [
        { name: "Binary Star System", probability: 0.2, description: "A system with two stars orbiting each other." },
        { name: "Red Dwarf System", probability: 0.4, description: "A system with a small, cool red star." },
        { name: "Gas Giant Dominated", probability: 0.3, description: "A system with multiple massive gas giants." },
        { name: "Star Cluster", probability: 0.1, description: "A dense cluster of multiple stars." }
      ],
      planet: [
        { name: "Rocky World", probability: 0.3, description: "A terrestrial planet with a solid surface." },
        { name: "Ocean Planet", probability: 0.2, description: "A world covered almost entirely in water." },
        { name: "Desert Planet", probability: 0.15, description: "An arid world with vast deserts." },
        { name: "Ice Planet", probability: 0.2, description: "A frozen world covered in ice and snow." },
        { name: "Volcanic Planet", probability: 0.15, description: "A world with intense volcanic activity." }
      ],
      anomaly: [
        { name: "Ancient Ruins", probability: 0.2, description: "Remnants of an ancient civilization." },
        { name: "Strange Signal", probability: 0.3, description: "An unexplained transmission from deep space." },
        { name: "Spatial Anomaly", probability: 0.1, description: "A distortion in space-time." },
        { name: "Derelict Station", probability: 0.25, description: "An abandoned space station of unknown origin." },
        { name: "Resource Deposit", probability: 0.15, description: "An unusually rich concentration of valuable resources." }
      ]
    };
  }

  // Initialize the game
  init() {
    this.updateResourceDisplay();
    this.checkForContinuation();
    this.addMessage("Welcome to Stellar Evolution", "info");
    this.addMessage("You lead a fledgling civilization taking its first steps into space. Your home world orbits a stable G-type star, with plentiful resources to begin your journey.", "info");
    this.addMessage("Try commands like 'explore nearby space', 'research solar power', or 'build a mine'.", "info");
    
    // Set up event handlers
    document.getElementById('submit-button').addEventListener('click', () => this.handleCommand());
    document.getElementById('command-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleCommand();
    });
    document.getElementById('save-game').addEventListener('click', () => this.saveGame());
    document.getElementById('load-game').addEventListener('click', () => this.loadGame());
    
    // Set update interval for resource accumulation
    setInterval(() => {
      this.gameState.updateResources();
      this.updateResourceDisplay();
      this.checkRandomEvents();
    }, 10000); // Update every 10 seconds
  }

  // Update the resource display
  updateResourceDisplay() {
    const resources = this.gameState.getResources();
    for (const resource in resources) {
      const element = document.getElementById(resource);
      if (element) {
        element.querySelector('.value').textContent = Math.floor(resources[resource]);
      }
    }
  }

  // Handle a command input
  async handleCommand() {
    const inputElement = document.getElementById('command-input');
    const commandText = inputElement.value.trim();
    
    if (commandText === '' || this.pendingLLMResponse) return;
    
    // Clear input and display user command
    inputElement.value = '';
    this.addMessage(`> ${commandText}`, 'command');
    
    // Parse command
    const parsedCommand = this.commandParser.parseCommand(commandText);
    const contextualCommand = this.commandParser.applyContext(parsedCommand);
    
    // Process command
    await this.processCommand(contextualCommand);
    
    // Save state after each command
    this.gameState.saveState();
    this.updateResourceDisplay();
  }

  // Process a parsed command
  async processCommand(command) {
    switch (command.type) {
      case 'exploration':
        await this.handleExploration(command);
        break;
      case 'research':
        await this.handleResearch(command);
        break;
      case 'building':
        await this.handleBuilding(command);
        break;
      case 'resource':
        await this.handleResource(command);
        break;
      case 'colony':
        await this.handleColony(command);
        break;
      case 'status':
        this.showStatus();
        break;
      case 'help':
        this.showHelp();
        break;
      case 'general':
      default:
        await this.handleGeneral(command);
        break;
    }
  }

  // Handle exploration commands
  async handleExploration(command) {
    // Check if we have enough resources for exploration
    if (this.gameState.state.resources.energy < 20) {
      this.addMessage("Your civilization lacks the energy resources to mount an exploration mission.", "warning");
      return;
    }
    
    // Consume resources
    this.gameState.modifyResource('energy', -20);
    this.gameState.modifyResource('knowledge', 5);
    
    let target, description;
    
    if (command.details.scope === 'system') {
      target = command.details.target === 'nearby' ? 
        "Nearby Star System" : `${command.details.target} System`;
      
      if (!this.gameState.state.discoveredSystems[target]) {
        // Discover a new system
        const systemType = this.randomDiscovery('system');
        this.gameState.state.discoveredSystems[target] = {
          star: { type: systemType.name, age: this.randomStarAge() },
          planets: this.generatePlanets(),
          explored: false
        };
        
        description = `Your explorers have charted a new star system: ${target}. ${systemType.description}`;
        this.gameState.addEvent(`Discovered ${target}`, 'success');
      } else {
        description = `Your explorers return with more detailed information about ${target}.`;
        this.gameState.state.discoveredSystems[target].explored = true;
      }
    } else if (command.details.scope === 'planet') {
      // Find system that contains this planet
      let system, planet;
      
      for (const [sysName, sysData] of Object.entries(this.gameState.state.discoveredSystems)) {
        if (sysData.planets.includes(command.details.target)) {
          system = sysName;
          planet = command.details.target;
          break;
        }
      }
      
      if (system) {
        description = `Your explorers have surveyed ${planet} in the ${system}. They've discovered valuable resource deposits and potential colony sites.`;
        this.gameState.addEvent(`Surveyed ${planet}`, 'success');
        this.gameState.modifyResource('minerals', 15);
      } else {
        description = "Your explorers couldn't locate the specified planet in your known star charts.";
      }
    } else {
      // General exploration
      const anomalyChance = Math.random();
      
      if (anomalyChance < 0.3) {
        // Discover an anomaly
        const anomaly = this.randomDiscovery('anomaly');
        description = `Your explorers have discovered ${anomaly.name}! ${anomaly.description}`;
        this.gameState.addEvent(`Found ${anomaly.name}`, 'success');
        
        // Generate an image for the discovery
        await this.generateDiscoveryImage(anomaly.name);
      } else if (this.gameState.state.knownSystems.length > 0 && anomalyChance < 0.7) {
        // Move a known system to discovered
        const systemIndex = Math.floor(Math.random() * this.gameState.state.knownSystems.length);
        const systemName = this.gameState.state.knownSystems[systemIndex];
        
        // Create the star system
        const systemType = this.randomDiscovery('system');
        this.gameState.state.discoveredSystems[systemName] = {
          star: { type: systemType.name, age: this.randomStarAge() },
          planets: this.generatePlanets(),
          explored: false
        };
        
        // Remove from known systems
        this.gameState.state.knownSystems.splice(systemIndex, 1);
        
        description = `Your explorers have found a route to ${systemName}. ${systemType.description}`;
        this.gameState.addEvent(`Route to ${systemName} discovered`, 'success');
      } else {
        // Discover new planets in known systems
        description = "Your explorers have mapped additional astronomical objects in already known systems.";
        this.gameState.addEvent(`Astronomical survey completed`, 'info');
      }
    }
    
    this.addMessage(description, 'success');
  }

  // Handle research commands
  async handleResearch(command) {
    // If already researching something
    if (this.gameState.state.technologies.researching) {
      const current = this.gameState.state.technologies.researching;
      
      // Check if asking about current research
      if (command.original.match(/progress|status|current/i)) {
        this.addMessage(`Your scientists are currently researching ${current}. The project is making steady progress.`, 'info');
        return;
      }
      
      // Check if wanting to complete current research
      if (command.original.match(/complete|finish|accelerate/i)) {
        // Check if we have enough knowledge resources
        const techCost = this.technologyTree[current] ? this.technologyTree[current].cost : 100;
        
        if (this.gameState.state.resources.knowledge >= techCost) {
          this.gameState.modifyResource('knowledge', -techCost);
          const completed = this.gameState.completeResearch();
          
          this.addMessage(`Your scientists have completed research on ${completed}!`, 'success');
          
          // Apply technology effects
          if (this.technologyTree[completed] && this.technologyTree[completed].effects) {
            this.applyTechnologyEffects(completed);
          }
          
          // Add new available technologies
          if (this.technologyTree[completed] && this.technologyTree[completed].unlocks) {
            for (const newTech of this.technologyTree[completed].unlocks) {
              if (!this.gameState.state.technologies.available.includes(newTech) &&
                  !this.gameState.state.technologies.researched.includes(newTech)) {
                this.gameState.state.technologies.available.push(newTech);
              }
            }
            this.addMessage(`This breakthrough has unlocked new research opportunities!`, 'info');
          }
        } else {
          this.addMessage(`Your scientists need more knowledge resources to complete this research. Current progress: ${Math.floor((this.gameState.state.resources.knowledge / techCost) * 100)}%`, 'warning');
        }
        return;
      }
      
      // If switching research
      this.addMessage(`Your scientists are currently focused on researching ${current}. Would you like them to change focus?`, 'warning');
      return;
    }
    
    // Starting new research
    if (command.details && command.details.technology) {
      const tech = command.details.technology;
      
      // Check if we have prerequisites
      if (this.technologyTree[tech] && this.technologyTree[tech].dependencies) {
        for (const dependency of this.technologyTree[tech].dependencies) {
          if (!this.gameState.state.technologies.researched.includes(dependency)) {
            this.addMessage(`You must first research ${dependency} before you can research ${tech}.`, 'warning');
            return;
          }
        }
      }
      
      this.gameState.startResearch(tech);
      this.addMessage(`Your scientists have begun researching ${tech}.`, 'success');
      this.gameState.addEvent(`Started research: ${tech}`, 'info');
    } else {
      // Display available research options
      this.addMessage(`Available technologies for research:`, 'info');
      this.gameState.state.technologies.available.forEach(tech => {
        const costText = this.technologyTree[tech] ? ` (Cost: ${this.technologyTree[tech].cost} knowledge)` : '';
        this.addMessage(`- ${tech}${costText}`, 'info');
      });
    }
  }

  // Handle building commands
  async handleBuilding(command) {
    const buildingCosts = {
      'mine': { minerals: 50, energy: 30 },
      'farm': { minerals: 40, energy: 20 },
      'lab': { minerals: 60, energy: 40 },
      'factory': { minerals: 80, energy: 50 },
      'housing': { minerals: 70, energy: 30 },
      'defense': { minerals: 100, energy: 60 },
      'shipyard': { minerals: 120, energy: 80 },
      'power plant': { minerals: 90, energy: 10 }
    };
    
    if (!command.details || !command.details.buildingType) {
      this.addMessage("What would you like to build? Options include: mine, farm, lab, factory, housing, defense, shipyard, power plant.", 'info');
      return;
    }
    
    const buildingType = command.details.buildingType;
    const location = command.details.location || "Home World"; // Default to home world
    
    // Check if we have the colony
    if (!this.gameState.state.colonies[location]) {
      this.addMessage(`You don't have a colony established on ${location} yet.`, 'warning');
      return;
    }
    
    // Check building costs
    const costs = buildingCosts[buildingType];
    if (!costs) {
      this.addMessage(`Unknown building type: ${buildingType}`, 'warning');
      return;
    }
    
    // Check if we have enough resources
    for (const resource in costs) {
      if (this.gameState.state.resources[resource] < costs[resource]) {
        this.addMessage(`You don't have enough ${resource} to build a ${buildingType}. Required: ${costs[resource]}, Available: ${Math.floor(this.gameState.state.resources[resource])}`, 'warning');
        return;
      }
    }
    
    // Deduct resources
    for (const resource in costs) {
      this.gameState.modifyResource(resource, -costs[resource]);
    }
    
    // Add the building to the colony
    this.gameState.state.colonies[location].buildings.push(buildingType);
    
    // Apply effects of the building
    this.applyBuildingEffects(buildingType);
    
    this.addMessage(`Construction of a new ${buildingType} on ${location} is complete!`, 'success');
    this.gameState.addEvent(`Built ${buildingType} on ${location}`, 'success');
  }

  // Handle resource management commands
  async handleResource(command) {
    // This would handle commands like "mine asteroids" or "allocate resources to energy production"
    // For now, we'll implement a simpler version
    
    if (command.original.match(/mine|extract|harvest/i)) {
      if (command.original.includes('asteroid')) {
        // Check if we have explored asteroid belts
        let hasAsteroidBelt = false;
        for (const system in this.gameState.state.discoveredSystems) {
          if (this.gameState.state.discoveredSystems[system].explored) {
            hasAsteroidBelt = true;
            break;
          }
        }
        
        if (!hasAsteroidBelt) {
          this.addMessage("You need to explore nearby star systems to locate asteroid belts first.", 'warning');
          return;
        }
        
        // Mining asteroids gives minerals but costs energy
        const energyCost = 30;
        if (this.gameState.state.resources.energy < energyCost) {
          this.addMessage(`You don't have enough energy for asteroid mining operations. Required: ${energyCost}`, 'warning');
          return;
        }
        
        this.gameState.modifyResource('energy', -energyCost);
        const mineralsGained = 40 + Math.floor(Math.random() * 30);
        this.gameState.modifyResource('minerals', mineralsGained);
        
        this.addMessage(`Your mining ships have returned with ${mineralsGained} units of minerals from the asteroid belt.`, 'success');
      } else {
        // Generic mining operation on home world
        const energyCost = 15;
        if (this.gameState.state.resources.energy < energyCost) {
          this.addMessage(`You don't have enough energy for mining operations. Required: ${energyCost}`, 'warning');
          return;
        }
        
        this.gameState.modifyResource('energy', -energyCost);
        const mineralsGained = 20 + Math.floor(Math.random() * 15);
        this.gameState.modifyResource('minerals', mineralsGained);
        
        this.addMessage(`Your mining operations have produced ${mineralsGained} units of minerals.`, 'success');
      }
    } else if (command.original.match(/allocate|focus|distribute/i)) {
      // Handle resource allocation - increases production rates at the cost of immediate resources
      if (command.original.includes('energy')) {
        const knowledgeCost = 20;
        const mineralsCost = 30;
        
        if (this.gameState.state.resources.knowledge < knowledgeCost || 
            this.gameState.state.resources.minerals < mineralsCost) {
          this.addMessage(`You don't have enough resources to improve energy production. Required: ${knowledgeCost} knowledge, ${mineralsCost} minerals`, 'warning');
          return;
        }
        
        this.gameState.modifyResource('knowledge', -knowledgeCost);
        this.gameState.modifyResource('minerals', -mineralsCost);
        this.gameState.state.resourceRates.energy += 2;
        
        this.addMessage("You've improved your civilization's energy production capabilities.", 'success');
      } else if (command.original.includes('mineral')) {
        const energyCost = 40;
        const knowledgeCost = 15;
        
        if (this.gameState.state.resources.energy < energyCost ||
            this.gameState.state.resources.knowledge < knowledgeCost) {
          this.addMessage(`You don't have enough resources to improve mineral production. Required: ${energyCost} energy, ${knowledgeCost} knowledge`, 'warning');
          return;
        }
        
        this.gameState.modifyResource('energy', -energyCost);
        this.gameState.modifyResource('knowledge', -knowledgeCost);
        this.gameState.state.resourceRates.minerals += 1.5;
        
        this.addMessage("You've improved your civilization's mineral extraction capabilities.", 'success');
      } else if (command.original.includes('knowledge') || command.original.includes('research')) {
        const energyCost = 30;
        const mineralsCost = 20;
        
        if (this.gameState.state.resources.energy < energyCost ||
            this.gameState.state.resources.minerals < mineralsCost) {
          this.addMessage(`You don't have enough resources to improve knowledge generation. Required: ${energyCost} energy, ${mineralsCost} minerals`, 'warning');
          return;
        }
        
        this.gameState.modifyResource('energy', -energyCost);
        this.gameState.modifyResource('minerals', -mineralsCost);
        this.gameState.state.resourceRates.knowledge += 1;
        
        this.addMessage("You've improved your civilization's knowledge acquisition capabilities.", 'success');
      } else {
        this.addMessage("Please specify which resource production you want to focus on: energy, minerals, or knowledge.", 'info');
      }
    } else {
      this.addMessage("You can mine resources from your planets or asteroid belts, or allocate resources to improve production rates.", 'info');
    }
  }

  // Handle colony commands
  async handleColony(command) {
    // For colonization, we need to have discovered planets and have necessary technology
    
    // Find if a specific planet was mentioned
    let targetPlanet = null;
    for (const system in this.gameState.state.discoveredSystems) {
      for (const planet of this.gameState.state.discoveredSystems[system].planets) {
        if (command.original.toLowerCase().includes(planet.toLowerCase())) {
          targetPlanet = planet;
          break;
        }
      }
      if (targetPlanet) break;
    }
    
    // If no specific planet, check if we can find a general colonization target
    if (!targetPlanet) {
      for (const system in this.gameState.state.discoveredSystems) {
        if (this.gameState.state.discoveredSystems[system].explored) {
          for (const planet of this.gameState.state.discoveredSystems[system].planets) {
            if (!this.gameState.state.colonies[planet] && planet !== "Home World") {
              targetPlanet = planet;
              break;
            }
          }
        }
        if (targetPlanet) break;
      }
    }
    
    if (!targetPlanet) {
      this.addMessage("You need to explore star systems to find suitable planets for colonization.", 'warning');
      return;
    }
    
    // Check if we already have a colony there
    if (this.gameState.state.colonies[targetPlanet]) {
      this.addMessage(`You already have a colony established on ${targetPlanet}.`, 'info');
      return;
    }
    
    // Check if we have the necessary technology
    if (!this.gameState.hasTechnology('basic mining') || !this.gameState.hasTechnology('primitive astronomy')) {
      this.addMessage("Your civilization lacks the necessary technology for interplanetary colonization. Research basic mining and primitive astronomy first.", 'warning');
      return;
    }
    
    // Check if we have enough resources
    const energyCost = 150;
    const mineralsCost = 200;
    const populationCost = 200;
    
    if (this.gameState.state.resources.energy < energyCost ||
        this.gameState.state.resources.minerals < mineralsCost ||
        this.gameState.state.resources.population < populationCost) {
      this.addMessage(`You don't have enough resources to establish a colony. Required: ${energyCost} energy, ${mineralsCost} minerals, ${populationCost} population`, 'warning');
      return;
    }
    
    // Deduct resources
    this.gameState.modifyResource('energy', -energyCost);
    this.gameState.modifyResource('minerals', -mineralsCost);
    this.gameState.modifyResource('population', -populationCost);
    
    // Determine planet type
    const planetType = this.randomDiscovery('planet');
    
    // Establish the colony
    this.gameState.state.colonies[targetPlanet] = {
      type: planetType.name.toLowerCase(),
      population: populationCost,
      buildings: ["settlement"],
      specialization: "none"
    };
    
    this.addMessage(`Your colonists have successfully established a new colony on ${targetPlanet}! The ${planetType.name.toLowerCase()} world shows promise.`, 'success');
    this.gameState.addEvent(`Established colony on ${targetPlanet}`, 'success');
    
    // Generate an image for the new colony
    await this.generateColonyImage(targetPlanet, planetType.name);
  }

  // Handle general/unknown commands using LLM
  async handleGeneral(command) {
    this.pendingLLMResponse = true;
    
    try {
      // Create a state summary for the LLM
      const stateSummary = {
        resources: this.gameState.state.resources,
        resourceRates: this.gameState.state.resourceRates,
        technologies: this.gameState.state.technologies,
        colonies: Object.keys(this.gameState.state.colonies),
        discoveredSystems: Object.keys(this.gameState.state.discoveredSystems),
        gameStage: this.gameState.state.stage
      };
      
      // Send to LLM for interpretation
      const completion = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are the AI narrator for a space exploration and civilization-building game called "Stellar Evolution." 
            Your role is to interpret player commands and provide appropriate responses based on the current game state.
            When the player gives a command, analyze it and respond with both an action to take and narrative text.
            Be creative but realistic within the game world. Don't invent technologies they haven't researched or places they haven't discovered.
            Focus on making the game experience immersive and engaging. Use descriptive language that evokes the vastness of space and the challenges of building a stellar civilization.`
          },
          {
            role: "user",
            content: `The player has entered this command: "${command.original}".
            Current game state: ${JSON.stringify(stateSummary, null, 2)}
            Interpret this command and provide a response that includes:
            1. The main game action this corresponds to (exploration, research, building, resource, colony, etc.)
            2. A narrative description of what happens based on this command
            3. Any game effects that should occur`
          }
        ]
      });
      
      // Parse the LLM response
      const llmResponse = completion.content;
      
      // Extract the narrative part from the LLM response
      const narrativeLines = llmResponse.split('\n').filter(line => !line.startsWith('Action:') && !line.startsWith('Game effects:'));
      const narrative = narrativeLines.join('\n');
      
      // Add the response to the game
      this.addMessage(narrative, 'info');
      
      // Try to extract game effects if present
      if (llmResponse.includes('Game effects:')) {
        const effectsSection = llmResponse.split('Game effects:')[1];
        
        // Look for resource changes
        const resourceMatches = effectsSection.match(/(\+|\-)\s*(\d+)\s+([a-zA-Z]+)/g);
        if (resourceMatches) {
          resourceMatches.forEach(match => {
            const [, sign, amount, resource] = match.match(/(\+|\-)\s*(\d+)\s+([a-zA-Z]+)/);
            
            if (this.gameState.state.resources[resource.toLowerCase()]) {
              const change = parseInt(amount) * (sign === '+' ? 1 : -1);
              this.gameState.modifyResource(resource.toLowerCase(), change);
            }
          });
        }
      }
    } catch (error) {
      console.error("Error getting LLM response:", error);
      this.addMessage("Your mission control is experiencing communication difficulties. Please try a different command.", 'warning');
    }
    
    this.pendingLLMResponse = false;
  }

  // Show game status
  showStatus() {
    this.addMessage("=== CIVILIZATION STATUS ===", 'info');
    
    // Resources
    this.addMessage("RESOURCES:", 'info');
    for (const resource in this.gameState.state.resources) {
      this.addMessage(`${resource.toUpperCase()}: ${Math.floor(this.gameState.state.resources[resource])} (${this.gameState.state.resourceRates[resource]}/hr)`, 'info');
    }
    
    // Technologies
    this.addMessage("TECHNOLOGIES:", 'info');
    this.addMessage(`Researched: ${this.gameState.state.technologies.researched.join(', ')}`, 'info');
    if (this.gameState.state.technologies.researching) {
      this.addMessage(`Currently researching: ${this.gameState.state.technologies.researching}`, 'info');
    }
    
    // Colonies
    this.addMessage("COLONIES:", 'info');
    for (const colony in this.gameState.state.colonies) {
      const colonyData = this.gameState.state.colonies[colony];
      this.addMessage(`${colony}: ${colonyData.type} world, Population: ${colonyData.population}, Buildings: ${colonyData.buildings.join(', ')}`, 'info');
    }
    
    // Discovered systems
    this.addMessage("DISCOVERED STAR SYSTEMS:", 'info');
    for (const system in this.gameState.state.discoveredSystems) {
      const systemData = this.gameState.state.discoveredSystems[system];
      this.addMessage(`${system}: ${systemData.star.type} star, Planets: ${systemData.planets.join(', ')}`, 'info');
    }
    
    // Game time
    const gameDays = Math.floor(this.gameState.state.gameTime);
    const gameYears = Math.floor(gameDays / 365);
    const remainingDays = gameDays % 365;
    this.addMessage(`TIME ELAPSED: Year ${gameYears}, Day ${remainingDays}`, 'info');
  }

  // Show help information
  showHelp() {
    this.addMessage("=== STELLAR EVOLUTION HELP ===", 'info');
    this.addMessage("You control your civilization through natural language commands. Here are some examples:", 'info');
    this.addMessage("- Exploration: 'explore nearby space', 'survey the gas giant', 'scout the asteroid belt'", 'info');
    this.addMessage("- Research: 'research solar power', 'study orbital mechanics', 'develop fusion technology'", 'info');
    this.addMessage("- Building: 'build a mine', 'construct a research lab on Alpha Centauri II', 'upgrade power plants'", 'info');
    this.addMessage("- Resources: 'mine asteroids', 'allocate resources to energy production', 'focus on mineral extraction'", 'info');
    this.addMessage("- Colonies: 'colonize the ocean planet', 'establish an outpost in the nearby system', 'develop Mars as a mining colony'", 'info');
    this.addMessage("- Status: 'show status', 'resource report', 'civilization overview'", 'info');
    this.addMessage("Remember, your decisions shape the destiny of your stellar civilization!", 'info');
  }

  // Apply the effects of a new technology
  applyTechnologyEffects(technology) {
    if (!this.technologyTree[technology] || !this.technologyTree[technology].effects) return;
    
    const effects = this.technologyTree[technology].effects;
    
    // Apply resource rate effects
    if (effects.resourceRates) {
      for (const resource in effects.resourceRates) {
        this.gameState.state.resourceRates[resource] += effects.resourceRates[resource];
      }
    }
    
    // Other effects would go here (colony bonuses, exploration bonuses, etc.)
  }

  // Apply the effects of a new building
  applyBuildingEffects(buildingType) {
    switch(buildingType) {
      case 'mine':
        this.gameState.state.resourceRates.minerals += 2;
        break;
      case 'farm':
        this.gameState.state.resourceRates.population += 1;
        break;
      case 'lab':
        this.gameState.state.resourceRates.knowledge += 2;
        break;
      case 'factory':
        this.gameState.state.resourceRates.minerals += 1;
        this.gameState.state.resourceRates.energy -= 1;
        break;
      case 'housing':
        this.gameState.state.resourceRates.population += 2;
        break;
      case 'power plant':
        this.gameState.state.resourceRates.energy += 3;
        break;
      // Other building types would go here
    }
  }

  // Generate random planets for a star system
  generatePlanets() {
    const planetCount = 2 + Math.floor(Math.random() * 5); // 2-6 planets
    const planets = [];
    
    for (let i = 0; i < planetCount; i++) {
      const planetType = this.randomDiscovery('planet');
      planets.push(`${planetType.name}-${i+1}`);
    }
    
    return planets;
  }

  // Get a random discovery from templates
  randomDiscovery(type) {
    const options = this.discoveryTemplates[type];
    const totalWeight = options.reduce((sum, option) => sum + option.probability, 0);
    let random = Math.random() * totalWeight;
    
    for (const option of options) {
      random -= option.probability;
      if (random <= 0) return option;
    }
    
    return options[0]; // Fallback
  }

  // Generate random star age
  randomStarAge() {
    const ages = ["young", "middle-aged", "old", "ancient"];
    const weights = [0.2, 0.5, 0.2, 0.1];
    let random = Math.random();
    
    for (let i = 0; i < ages.length; i++) {
      random -= weights[i];
      if (random <= 0) return ages[i];
    }
    
    return "middle-aged"; // Fallback
  }

  // Check for random events
  checkRandomEvents() {
    // Only trigger events occasionally
    if (Math.random() > 0.1) return;
    
    const possibleEvents = [
      {
        name: "Solar Flare",
        description: "A sudden solar flare from your star has temporarily disrupted communications and energy systems.",
        effect: () => this.gameState.modifyResource('energy', -10),
        condition: () => true // Always possible
      },
      {
        name: "Asteroid Near Miss",
        description: "An asteroid passed dangerously close to one of your colonies. The close call has provided valuable data for your scientists.",
        effect: () => this.gameState.modifyResource('knowledge', 15),
        condition: () => Object.keys(this.gameState.state.colonies).length > 1 // Only if we have colonies
      },
      {
        name: "Resource Discovery",
        description: "Your surveyors have discovered an unexpected mineral deposit on your home world.",
        effect: () => this.gameState.modifyResource('minerals', 25),
        condition: () => true // Always possible
      },
      {
        name: "Scientific Breakthrough",
        description: "Your scientists have made an unexpected breakthrough in their research!",
        effect: () => {
          this.gameState.modifyResource('knowledge', 20);
          if (this.gameState.state.technologies.researching) {
            this.addMessage(`This breakthrough has accelerated your research on ${this.gameState.state.technologies.researching}!`, 'success');
          }
        },
        condition: () => this.gameState.state.technologies.researching !== null
      }
    ];
    
    // Filter events by their conditions
    const validEvents = possibleEvents.filter(event => event.condition());
    
    if (validEvents.length > 0) {
      const event = validEvents[Math.floor(Math.random() * validEvents.length)];
      this.addMessage(`EVENT: ${event.name} - ${event.description}`, 'warning');
      event.effect();
      this.gameState.addEvent(event.name, 'warning');
      this.updateResourceDisplay();
    }
  }

  // Check if we should offer to restore a previous game
  checkForContinuation() {
    const savedState = localStorage.getItem('stellarEvolution');
    if (savedState) {
      this.addMessage("A previous civilization has been detected. Would you like to resume your leadership? Use 'load game' to continue or start a new journey.", 'info');
    }
  }

  // Save game to database
  async saveGame() {
    const success = await this.gameState.saveToDatabase();
    
    if (success) {
      this.addMessage("Your civilization's progress has been archived for future generations.", 'success');
    } else {
      this.addMessage("There was an issue archiving your civilization. Local backup maintained.", 'warning');
    }
  }

  // Load game from database or local storage
  async loadGame() {
    // Try database first
    const databaseLoad = await this.gameState.loadFromDatabase();
    
    if (!databaseLoad) {
      // Fall back to local storage
      const localLoad = this.gameState.loadState();
      
      if (localLoad) {
        this.gameState.state = localLoad;
        this.gameState.updateResources();
        this.addMessage("Your civilization's records have been restored from local archives.", 'success');
      } else {
        this.addMessage("No previous civilization records found.", 'warning');
      }
    } else {
      this.addMessage("Your civilization's records have been restored from central archives.", 'success');
    }
    
    this.updateResourceDisplay();
  }

  // Add a message to the output
  addMessage(text, type = 'info') {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = text;
    
    // Add to the top (we're using flex-direction: column-reverse)
    this.outputElement.prepend(messageElement);
    
    // Limit the number of messages
    if (this.outputElement.children.length > 100) {
      this.outputElement.removeChild(this.outputElement.lastChild);
    }
  }

  // Generate an image for a discovery using LLM
  async generateDiscoveryImage(discoveryName) {
    try {
      const result = await websim.imageGen({
        prompt: `A science fiction space scene showing a ${discoveryName} in outer space, digital art style`,
        aspect_ratio: "16:9"
      });
      
      // Create an image element and add it to the output
      const imgElement = document.createElement('img');
      imgElement.src = result.url;
      imgElement.alt = discoveryName;
      imgElement.className = 'event-image';
      
      // Add to the top (we're using flex-direction: column-reverse)
      this.outputElement.prepend(imgElement);
    } catch (error) {
      console.error("Failed to generate discovery image:", error);
    }
  }

  // Generate an image for a new colony
  async generateColonyImage(planetName, planetType) {
    try {
      const result = await websim.imageGen({
        prompt: `A science fiction view of a new human colony on a ${planetType} planet called ${planetName}, digital art style`,
        aspect_ratio: "16:9"
      });
      
      // Create an image element and add it to the output
      const imgElement = document.createElement('img');
      imgElement.src = result.url;
      imgElement.alt = `Colony on ${planetName}`;
      imgElement.className = 'event-image';
      
      // Add to the top (we're using flex-direction: column-reverse)
      this.outputElement.prepend(imgElement);
    } catch (error) {
      console.error("Failed to generate colony image:", error);
    }
  }
}

