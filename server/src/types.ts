// Shared types for client-server communication

export interface VehicleState {
    id: string
    position: [number, number, number]
    rotation: [number, number, number, number] // quaternion
    velocity: [number, number, number]
    steering: number
    throttle: number
    brake: number
    lightsOn: boolean
    timestamp: number
}

export interface PlayerInfo {
    id: string
    name: string
    color: number
    joinedAt: number
}

export interface ServerToClientEvents {
    playerJoined: (player: PlayerInfo) => void
    playerLeft: (playerId: string) => void
    vehicleUpdate: (state: VehicleState) => void
    gameState: (players: PlayerInfo[], vehicles: Record<string, VehicleState>) => void
    roomFull: () => void
}

export interface ClientToServerEvents {
    joinRoom: (playerName: string, callback: (success: boolean, playerId: string, players: PlayerInfo[]) => void) => void
    leaveRoom: () => void
    vehicleState: (state: Omit<VehicleState, 'id'>) => void
}

export interface InterServerEvents {
    ping: () => void
}

export interface SocketData {
    playerId: string
    playerName: string
    color: number
}
