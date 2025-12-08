import { io, Socket } from 'socket.io-client'
import * as THREE from 'three'
import {
    VehicleState,
    PlayerInfo,
    ServerToClientEvents,
    ClientToServerEvents
} from './types'
import { StateInterpolator } from './StateInterpolator'
import { RemoteVehicle } from './RemoteVehicle'
import { Vehicle } from '../entities/Vehicle'

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface NetworkManagerConfig {
    serverUrl: string
    updateRate?: number // Updates per second
}

/**
 * NetworkManager - Handles all multiplayer networking
 */
export class NetworkManager {
    private socket: GameSocket | null = null
    private scene: THREE.Scene
    private localVehicle: Vehicle | null = null
    private interpolator: StateInterpolator
    private remoteVehicles: Map<string, RemoteVehicle> = new Map()

    private playerId: string = ''
    private playerName: string = ''
    private isConnected = false
    private updateRate: number
    private lastUpdateTime = 0
    private updateInterval: number // ms between updates

    // Event callbacks
    private onPlayerJoinCallback?: (player: PlayerInfo) => void
    private onPlayerLeaveCallback?: (playerId: string) => void
    private onConnectedCallback?: (playerId: string, players: PlayerInfo[]) => void
    private onDisconnectedCallback?: () => void
    private onRoomFullCallback?: () => void

    constructor(scene: THREE.Scene, config: Partial<NetworkManagerConfig> = {}) {
        this.scene = scene
        this.interpolator = new StateInterpolator()
        this.updateRate = config.updateRate || 20 // 20 updates per second default
        this.updateInterval = 1000 / this.updateRate
    }

    /**
     * Connect to the game server
     */
    async connect(serverUrl: string, playerName: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                this.playerName = playerName || `Player_${Math.floor(Math.random() * 1000)}`

                this.socket = io(serverUrl, {
                    transports: ['websocket'],
                    timeout: 10000
                }) as GameSocket

                this.setupEventListeners()

                // Join room after connection
                this.socket.on('connect', () => {
                    console.log('[NetworkManager] Socket connected, joining room...')

                    this.socket!.emit('joinRoom', this.playerName, (success, playerId, players) => {
                        if (success) {
                            this.playerId = playerId
                            this.isConnected = true
                            console.log(`[NetworkManager] Joined as ${playerId}`)
                            this.onConnectedCallback?.(playerId, players)
                            resolve(true)
                        } else {
                            console.error('[NetworkManager] Failed to join room')
                            resolve(false)
                        }
                    })
                })

                this.socket.on('connect_error', (err) => {
                    console.error('[NetworkManager] Connection error:', err.message)
                    resolve(false)
                })

            } catch (error) {
                console.error('[NetworkManager] Failed to connect:', error)
                resolve(false)
            }
        })
    }

    private setupEventListeners(): void {
        if (!this.socket) return

        // Game state (initial sync)
        this.socket.on('gameState', (players, vehicles) => {
            console.log(`[NetworkManager] Received game state: ${players.length} players`)

            // Create remote vehicles for existing players
            for (const player of players) {
                if (player.id !== this.playerId && !this.remoteVehicles.has(player.id)) {
                    this.createRemoteVehicle(player)
                }
            }

            // Update vehicle states
            for (const [playerId, state] of Object.entries(vehicles)) {
                if (playerId !== this.playerId) {
                    this.interpolator.updateState(playerId, state)
                }
            }
        })

        // New player joined
        this.socket.on('playerJoined', (player) => {
            console.log(`[NetworkManager] Player joined: ${player.name}`)

            if (player.id !== this.playerId && !this.remoteVehicles.has(player.id)) {
                this.createRemoteVehicle(player)
            }

            this.onPlayerJoinCallback?.(player)
        })

        // Player left
        this.socket.on('playerLeft', (playerId) => {
            console.log(`[NetworkManager] Player left: ${playerId}`)
            this.removeRemoteVehicle(playerId)
            this.onPlayerLeaveCallback?.(playerId)
        })

        // Vehicle update from other players
        this.socket.on('vehicleUpdate', (state) => {
            if (state.id !== this.playerId) {
                this.interpolator.updateState(state.id, state)
            }
        })

        // Room full
        this.socket.on('roomFull', () => {
            console.warn('[NetworkManager] Room is full')
            this.onRoomFullCallback?.()
        })

        // Disconnect
        this.socket.on('disconnect', () => {
            console.log('[NetworkManager] Disconnected from server')
            this.isConnected = false
            this.cleanupAllRemoteVehicles()
            this.onDisconnectedCallback?.()
        })
    }

    private createRemoteVehicle(player: PlayerInfo): void {
        const remoteVehicle = new RemoteVehicle(player.id, player.name, player.color)
        this.remoteVehicles.set(player.id, remoteVehicle)
        this.scene.add(remoteVehicle.mesh)
        console.log(`[NetworkManager] Created remote vehicle for ${player.name}`)
    }

    private removeRemoteVehicle(playerId: string): void {
        const vehicle = this.remoteVehicles.get(playerId)
        if (vehicle) {
            this.scene.remove(vehicle.mesh)
            vehicle.dispose()
            this.remoteVehicles.delete(playerId)
            this.interpolator.removePlayer(playerId)
            console.log(`[NetworkManager] Removed remote vehicle: ${playerId}`)
        }
    }

    private cleanupAllRemoteVehicles(): void {
        for (const [playerId] of this.remoteVehicles) {
            this.removeRemoteVehicle(playerId)
        }
    }

    /**
     * Set the local vehicle to track and send updates for
     */
    setLocalVehicle(vehicle: Vehicle): void {
        this.localVehicle = vehicle
    }

    /**
     * Update - call this every frame
     */
    update(): void {
        if (!this.isConnected) return

        const now = Date.now()

        // Send local vehicle state at fixed rate
        if (this.localVehicle && now - this.lastUpdateTime >= this.updateInterval) {
            this.sendVehicleState()
            this.lastUpdateTime = now
        }

        // Update remote vehicles with interpolated states
        for (const [playerId, remoteVehicle] of this.remoteVehicles) {
            const interpolated = this.interpolator.getInterpolatedState(playerId)

            if (interpolated) {
                remoteVehicle.update(
                    interpolated.position,
                    interpolated.quaternion,
                    interpolated.velocity,
                    interpolated.steering,
                    interpolated.lightsOn
                )
            }
        }
    }

    private sendVehicleState(): void {
        if (!this.socket || !this.localVehicle) return

        const pos = this.localVehicle.getPosition()
        const physics = this.localVehicle.physics
        const body = physics.chassisBody

        const state: Omit<VehicleState, 'id'> = {
            position: [pos.x, pos.y, pos.z],
            rotation: [
                body.quaternion.x,
                body.quaternion.y,
                body.quaternion.z,
                body.quaternion.w
            ],
            velocity: [
                body.velocity.x,
                body.velocity.y,
                body.velocity.z
            ],
            steering: 0, // Steering visualization not critical for remote players
            throttle: 0,
            brake: 0,
            lightsOn: (this.localVehicle as any).lightsOn || false,
            timestamp: Date.now()
        }

        this.socket.emit('vehicleState', state)
    }

    /**
     * Disconnect from the server
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.emit('leaveRoom')
            this.socket.disconnect()
            this.socket = null
        }

        this.isConnected = false
        this.cleanupAllRemoteVehicles()
    }

    // Event registration methods
    onPlayerJoin(callback: (player: PlayerInfo) => void): void {
        this.onPlayerJoinCallback = callback
    }

    onPlayerLeave(callback: (playerId: string) => void): void {
        this.onPlayerLeaveCallback = callback
    }

    onConnected(callback: (playerId: string, players: PlayerInfo[]) => void): void {
        this.onConnectedCallback = callback
    }

    onDisconnected(callback: () => void): void {
        this.onDisconnectedCallback = callback
    }

    onRoomFull(callback: () => void): void {
        this.onRoomFullCallback = callback
    }

    // Getters
    getPlayerId(): string {
        return this.playerId
    }

    getPlayerName(): string {
        return this.playerName
    }

    isOnline(): boolean {
        return this.isConnected
    }

    getRemotePlayerCount(): number {
        return this.remoteVehicles.size
    }

    getRemoteVehicles(): Map<string, RemoteVehicle> {
        return this.remoteVehicles
    }
}
