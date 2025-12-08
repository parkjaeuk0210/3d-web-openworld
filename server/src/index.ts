import { createServer } from 'http'
import { Server } from 'socket.io'
import { GameRoom } from './GameRoom.js'
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
    VehicleState
} from './types.js'

const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'

// Create HTTP server
const httpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
            status: 'ok',
            players: gameRoom.getPlayerCount(),
            uptime: process.uptime()
        }))
        return
    }

    // Default response
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('3D Web Open World - Multiplayer Server')
})

// Create Socket.IO server
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
})

// Create game room
const gameRoom = new GameRoom()

// Socket connection handling
io.on('connection', (socket) => {
    console.log(`[Server] Client connected: ${socket.id}`)

    // Handle player joining
    socket.on('joinRoom', (playerName, callback) => {
        if (gameRoom.isFull()) {
            socket.emit('roomFull')
            callback(false, '', [])
            return
        }

        const player = gameRoom.addPlayer(socket.id, playerName)
        if (!player) {
            callback(false, '', [])
            return
        }

        // Store player data in socket
        socket.data.playerId = player.id
        socket.data.playerName = player.name
        socket.data.color = player.color

        // Send current game state to new player
        const allPlayers = gameRoom.getAllPlayers()
        const allVehicles = gameRoom.getAllVehicleStates()
        socket.emit('gameState', allPlayers, allVehicles)

        // Notify other players
        socket.broadcast.emit('playerJoined', {
            id: player.id,
            name: player.name,
            color: player.color,
            joinedAt: player.joinedAt
        })

        callback(true, player.id, allPlayers)
        console.log(`[Server] Player ${player.name} joined room`)
    })

    // Handle vehicle state updates
    socket.on('vehicleState', (state) => {
        const playerId = socket.data.playerId
        if (!playerId) return

        const fullState = gameRoom.updateVehicleState(playerId, state)
        if (fullState) {
            // Broadcast to all other players
            socket.broadcast.emit('vehicleUpdate', fullState)
        }
    })

    // Handle explicit room leave
    socket.on('leaveRoom', () => {
        handlePlayerLeave(socket)
    })

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log(`[Server] Client disconnected: ${socket.id}, reason: ${reason}`)
        handlePlayerLeave(socket)
    })
})

function handlePlayerLeave(socket: any) {
    const playerId = socket.data.playerId
    if (playerId) {
        gameRoom.removePlayer(playerId)
        io.emit('playerLeft', playerId)
        console.log(`[Server] Player ${socket.data.playerName} left room`)
    }
}

// Cleanup inactive players every 10 seconds
setInterval(() => {
    const removed = gameRoom.cleanupInactivePlayers()
    for (const playerId of removed) {
        io.emit('playerLeft', playerId)
    }
}, 10000)

// Start server
httpServer.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     3D Web Open World - Multiplayer Server               ║
╠══════════════════════════════════════════════════════════╣
║  🚗 Server running on port ${PORT}                          ║
║  🌐 CORS origin: ${CORS_ORIGIN.padEnd(36)}    ║
║  👥 Max players: 20                                      ║
╚══════════════════════════════════════════════════════════╝
  `)
})

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down...')
    io.close()
    httpServer.close()
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down...')
    io.close()
    httpServer.close()
    process.exit(0)
})
