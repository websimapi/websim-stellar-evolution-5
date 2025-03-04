class CommandParser {
  constructor(gameManager) {
    this.gameManager = gameManager;
    
    // Command categories and keywords
    this.commandPatterns = {
      exploration: [
        'explore', 'scout', 'survey', 'scan', 'discover', 'map', 'investigate'
      ],
      research: [
        'research', 'study', 'develop', 'investigate', 'learn', 'science', 'technology'
      ],
      building: [
        'build', 'construct', 'create', 'establish', 'develop', 'upgrade', 'expand'
      ],
      resource: [
        'mine', 'harvest', 'extract', 'gather', 'collect', 'allocate', 'distribute', 'focus'
      ],
      colony: [
        'colonize', 'settle', 'inhabit', 'populate', 'colony', 'outpost'
      ],
      diplomacy: [
        'contact', 'communicate', 'negotiate', 'alliance', 'trade', 'diplomatic'
      ],
      military: [
        'attack', 'defend', 'fight', 'war', 'fleet', 'ship', 'army', 'weapon'
      ],
      status: [
        'status', 'report', 'summary', 'overview', 'situation', 'info'
      ],
      help: [
        'help', 'guide', 'tutorial', 'instruction', 'command', 'hint', 'tip'
      ]
    };
    
    // Recent command context to provide continuity
    this.recentContext = {
      subject: null,
      action: null,
      location: null,
      timestamp: 0
    };
  }

  // Parse a command string to determine intent
  parseCommand(commandString) {
    // Normalize text
    const command = commandString.toLowerCase().trim();
    
    // First check for simple status commands
    if (this.matchPattern(command, this.commandPatterns.status)) {
      return { 
        type: 'status',
        original: commandString
      };
    }
    
    // Check for help commands
    if (this.matchPattern(command, this.commandPatterns.help)) {
      return { 
        type: 'help',
        original: commandString
      };
    }
    
    // Determine the primary command type
    let commandType = this.determineCommandType(command);
    
    // Extract additional details based on command type
    let details = this.extractDetails(command, commandType);
    
    // Update context for future commands
    this.updateContext(commandType, details);
    
    return {
      type: commandType,
      details: details,
      original: commandString
    };
  }
  
  // Match command against pattern keywords
  matchPattern(command, patterns) {
    return patterns.some(pattern => command.includes(pattern));
  }
  
  // Determine the primary type of command
  determineCommandType(command) {
    for (const [type, patterns] of Object.entries(this.commandPatterns)) {
      if (this.matchPattern(command, patterns)) {
        return type;
      }
    }
    
    // If no direct match, send to LLM for interpretation
    return 'general';
  }
  
  // Extract relevant details from the command
  extractDetails(command, type) {
    let details = {};
    
    switch(type) {
      case 'exploration':
        // Extract location information
        if (command.includes('system')) {
          details.target = this.extractNearestNoun(command, 'system');
          details.scope = 'system';
        } else if (command.includes('planet')) {
          details.target = this.extractNearestNoun(command, 'planet');
          details.scope = 'planet';
        } else if (command.includes('asteroid') || command.includes('belt')) {
          details.target = 'asteroid belt';
          details.scope = 'asteroids';
        } else {
          details.scope = 'general';
        }
        break;
        
      case 'research':
        // Extract technology to research
        for (const tech of this.gameManager.gameState.state.technologies.available) {
          if (command.includes(tech.toLowerCase())) {
            details.technology = tech;
            break;
          }
        }
        if (!details.technology) {
          details.intent = 'information';
        }
        break;
        
      case 'building':
        // Extract building type
        const buildingTypes = ['mine', 'farm', 'lab', 'factory', 'housing', 'defense', 'shipyard', 'power plant'];
        for (const buildingType of buildingTypes) {
          if (command.includes(buildingType)) {
            details.buildingType = buildingType;
            break;
          }
        }
        
        // Extract location
        for (const colony in this.gameManager.gameState.state.colonies) {
          if (command.includes(colony.toLowerCase())) {
            details.location = colony;
            break;
          }
        }
        break;
        
      // Add other types as needed
    }
    
    return details;
  }
  
  // Extract a noun near a keyword in the command
  extractNearestNoun(command, keyword) {
    const words = command.split(/\s+/);
    const keywordIndex = words.findIndex(word => word.includes(keyword));
    
    if (keywordIndex > 0) {
      // Check for "the <noun> system" pattern
      return words[keywordIndex - 1];
    }
    
    if (keywordIndex >= 0 && keywordIndex < words.length - 1) {
      // Check for "system <noun>" pattern
      return words[keywordIndex + 1];
    }
    
    return 'nearby';
  }
  
  // Update the context based on the current command
  updateContext(type, details) {
    this.recentContext = {
      subject: type,
      details: details,
      timestamp: Date.now()
    };
  }
  
  // Apply context to ambiguous commands
  applyContext(parsedCommand) {
    // Context expires after 30 seconds
    const contextValid = (Date.now() - this.recentContext.timestamp) < 30000;
    
    if (!contextValid) return parsedCommand;
    
    // If the command is ambiguous but we have recent context
    if (parsedCommand.type === 'general' && this.recentContext.subject) {
      // Example: "continue" or "do it again" after an exploration command
      if (parsedCommand.original.match(/continue|again|more|proceed/i)) {
        return {
          type: this.recentContext.subject,
          details: this.recentContext.details,
          original: parsedCommand.original,
          context: 'applied'
        };
      }
    }
    
    return parsedCommand;
  }
}

