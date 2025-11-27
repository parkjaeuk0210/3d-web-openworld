import { GameManager } from './game/GameManager'

// Initialize the game
const game = new GameManager()
game.init().catch(console.error)
