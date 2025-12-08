import { VehicleState, PlayerInfo } from './types.js'

const MAX_PLAYERS = 20
const VEHICLE_COLORS = [
    0xff3333, 0x33ff33, 0x3333ff, 0xffff33, 0xff33ff,
    0x33ffff, 0xff8833, 0x8833ff, 0x33ff88, 0xff3388,
    0x88ff33, 0x3388ff, 0xffaa00, 0x00aaff, 0xaa00ff,
    0x00ffaa, 0xaaff00, 0xff00aa, 0x888888, 0xffffff
]

export interface Player {
    id: string
    socketId: string
    name: string
    color: number
    joinedAt: number
    lastUpdate: number
    vehicleState: VehicleState | null
}

export class GameRoom {
    private players: Map<string, Player> = new Map()
    private usedColors: Set<number> = new Set()
    private playerIdCounter = 0

    getPlayerCount(): number {
        return this.players.size
    }

    isFull(): boolean {
        return this.players.size >= MAX_PLAYERS
    }

    private getNextColor(): number {
        for (const color of VEHICLE_COLORS) {
            if (!this.usedColors.has(color)) {
                this.usedColors.add(color)
                return color
            }
        }
        // Fallback: random color
        return Math.floor(Math.random() * 0xffffff)
    }

    addPlayer(socketId: string, name: string): Player | null {
        if (this.isFull()) {
            return null
        }

        const playerId = `player_${++this.playerIdCounter}_${Date.now()}`
        const color = this.getNextColor()

        const player: Player = {
            id: playerId,
            socketId,
            name: name || `Player ${this.players.size + 1}`,
            color,
            joinedAt: Date.now(),
            lastUpdate: Date.now(),
            vehicleState: null
        }

        this.players.set(playerId, player)
        console.log(`[GameRoom] Player joined: ${player.name} (${playerId}), total: ${this.players.size}`)

        return player
    }

    removePlayer(playerId: string): boolean {
        const player = this.players.get(playerId)
        if (player) {
            this.usedColors.delete(player.color)
            this.players.delete(playerId)
            console.log(`[GameRoom] Player left: ${player.name} (${playerId}), total: ${this.players.size}`)
            return true
        }
        return false
    }

    removePlayerBySocketId(socketId: string): string | null {
        for (const [playerId, player] of this.players) {
            if (player.socketId === socketId) {
                this.removePlayer(playerId)
                return playerId
            }
        }
        return null
    }

    updateVehicleState(playerId: string, state: Omit<VehicleState, 'id'>): VehicleState | null {
        const player = this.players.get(playerId)
        if (!player) return null

        player.lastUpdate = Date.now()
        player.vehicleState = {
            ...state,
            id: playerId
        }

        return player.vehicleState
    }

    getPlayer(playerId: string): Player | undefined {
        return this.players.get(playerId)
    }

    getPlayerBySocketId(socketId: string): Player | undefined {
        for (const player of this.players.values()) {
            if (player.socketId === socketId) {
                return player
            }
        }
        return undefined
    }

    getAllPlayers(): PlayerInfo[] {
        return Array.from(this.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            color: p.color,
            joinedAt: p.joinedAt
        }))
    }

    getAllVehicleStates(): Record<string, VehicleState> {
        const states: Record<string, VehicleState> = {}
        for (const [playerId, player] of this.players) {
            if (player.vehicleState) {
                states[playerId] = player.vehicleState
            }
        }
        return states
    }

    // Clean up inactive players (no update for 30 seconds)
    cleanupInactivePlayers(): string[] {
        const now = Date.now()
        const timeout = 30000 // 30 seconds
        const removed: string[] = []

        for (const [playerId, player] of this.players) {
            if (now - player.lastUpdate > timeout) {
                this.removePlayer(playerId)
                removed.push(playerId)
                console.log(`[GameRoom] Removed inactive player: ${player.name} (${playerId})`)
            }
        }

        return removed
    }
}
