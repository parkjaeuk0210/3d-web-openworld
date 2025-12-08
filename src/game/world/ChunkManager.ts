import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { PhysicsWorld } from '../physics/PhysicsWorld'
import { SimplexNoise } from './SimplexNoise'
import { BiomeGenerator, BiomeType } from './BiomeGenerator'

export interface ChunkData {
    key: string
    x: number
    z: number
    biome: BiomeType
    ground: THREE.Mesh
    objects: THREE.Group
    physicsObjects: CANNON.Body[]
    isLoaded: boolean
}

export class ChunkManager {
    public static readonly CHUNK_SIZE = 100
    public static readonly RENDER_DISTANCE = 2 // Number of chunks in each direction

    private scene: THREE.Scene
    private physicsWorld: PhysicsWorld
    private chunks: Map<string, ChunkData> = new Map()
    private biomeGenerator: BiomeGenerator
    private noise: SimplexNoise

    private loadQueue: string[] = []
    private unloadQueue: string[] = []
    private isProcessing = false

    // Object pools for reuse
    private groundMeshPool: THREE.Mesh[] = []
    private objectGroupPool: THREE.Group[] = []

    // Ground materials cache
    private groundMaterials: Map<BiomeType, THREE.Material> = new Map()

    constructor(scene: THREE.Scene, physicsWorld: PhysicsWorld, seed: number = 12345) {
        this.scene = scene
        this.physicsWorld = physicsWorld
        this.noise = new SimplexNoise(seed)
        this.biomeGenerator = new BiomeGenerator(seed)
        this.initMaterials()
    }

    private initMaterials(): void {
        // City - dark asphalt
        this.groundMaterials.set(BiomeType.City, new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.95,
            metalness: 0.1
        }))

        // Suburban - green grass
        this.groundMaterials.set(BiomeType.Suburban, new THREE.MeshStandardMaterial({
            color: 0x3a5a3a,
            roughness: 1.0,
            metalness: 0
        }))

        // Desert - sandy tan
        this.groundMaterials.set(BiomeType.Desert, new THREE.MeshStandardMaterial({
            color: 0xc4a35a,
            roughness: 0.9,
            metalness: 0
        }))

        // Forest - dark green
        this.groundMaterials.set(BiomeType.Forest, new THREE.MeshStandardMaterial({
            color: 0x2d4a2d,
            roughness: 1.0,
            metalness: 0
        }))

        // Snow - white
        this.groundMaterials.set(BiomeType.Snow, new THREE.MeshStandardMaterial({
            color: 0xe8e8f0,
            roughness: 0.5,
            metalness: 0.1
        }))
    }

    update(playerPosition: THREE.Vector3): void {
        const playerChunkX = Math.floor(playerPosition.x / ChunkManager.CHUNK_SIZE)
        const playerChunkZ = Math.floor(playerPosition.z / ChunkManager.CHUNK_SIZE)

        // Determine which chunks should be loaded
        const neededChunks = new Set<string>()
        for (let dx = -ChunkManager.RENDER_DISTANCE; dx <= ChunkManager.RENDER_DISTANCE; dx++) {
            for (let dz = -ChunkManager.RENDER_DISTANCE; dz <= ChunkManager.RENDER_DISTANCE; dz++) {
                const chunkX = playerChunkX + dx
                const chunkZ = playerChunkZ + dz
                const key = `${chunkX},${chunkZ}`
                neededChunks.add(key)

                // Queue for loading if not already loaded
                if (!this.chunks.has(key) && !this.loadQueue.includes(key)) {
                    this.loadQueue.push(key)
                }
            }
        }

        // Queue chunks for unloading that are too far
        for (const [key, chunk] of this.chunks) {
            if (!neededChunks.has(key) && !this.unloadQueue.includes(key)) {
                this.unloadQueue.push(key)
            }
        }

        // Process queues
        this.processQueues()
    }

    private processQueues(): void {
        if (this.isProcessing) return
        this.isProcessing = true

        // Process one load per frame
        if (this.loadQueue.length > 0) {
            const key = this.loadQueue.shift()!
            this.loadChunk(key)
        }

        // Process one unload per frame
        if (this.unloadQueue.length > 0) {
            const key = this.unloadQueue.shift()!
            this.unloadChunk(key)
        }

        this.isProcessing = false
    }

    private loadChunk(key: string): void {
        const [xStr, zStr] = key.split(',')
        const chunkX = parseInt(xStr)
        const chunkZ = parseInt(zStr)

        // Determine biome for this chunk
        const worldX = chunkX * ChunkManager.CHUNK_SIZE
        const worldZ = chunkZ * ChunkManager.CHUNK_SIZE
        const biome = this.biomeGenerator.getBiome(worldX, worldZ)

        // Create ground mesh
        const ground = this.createGround(chunkX, chunkZ, biome)

        // Create objects group
        const objects = this.objectGroupPool.pop() || new THREE.Group()
        objects.clear()

        // Generate biome-specific content
        const physicsObjects = this.biomeGenerator.generateChunkContent(
            objects,
            this.physicsWorld,
            chunkX,
            chunkZ,
            biome
        )

        // Add to scene
        this.scene.add(ground)
        this.scene.add(objects)

        // Store chunk data
        const chunkData: ChunkData = {
            key,
            x: chunkX,
            z: chunkZ,
            biome,
            ground,
            objects,
            physicsObjects,
            isLoaded: true
        }

        this.chunks.set(key, chunkData)
    }

    private unloadChunk(key: string): void {
        const chunk = this.chunks.get(key)
        if (!chunk) return

        // Remove from scene
        this.scene.remove(chunk.ground)
        this.scene.remove(chunk.objects)

        // Remove physics bodies
        for (const body of chunk.physicsObjects) {
            this.physicsWorld.removeBody(body)
        }

        // Return to pools
        this.groundMeshPool.push(chunk.ground)
        this.objectGroupPool.push(chunk.objects)

        // Remove from chunks map
        this.chunks.delete(key)
    }

    private createGround(chunkX: number, chunkZ: number, biome: BiomeType): THREE.Mesh {
        // Try to reuse from pool
        let ground = this.groundMeshPool.pop()

        if (!ground) {
            const geometry = new THREE.PlaneGeometry(ChunkManager.CHUNK_SIZE, ChunkManager.CHUNK_SIZE)
            ground = new THREE.Mesh(geometry)
            ground.rotation.x = -Math.PI / 2
            ground.receiveShadow = true
        }

        // Set material based on biome
        ground.material = this.groundMaterials.get(biome) || this.groundMaterials.get(BiomeType.Suburban)!

        // Position the ground
        const worldX = chunkX * ChunkManager.CHUNK_SIZE + ChunkManager.CHUNK_SIZE / 2
        const worldZ = chunkZ * ChunkManager.CHUNK_SIZE + ChunkManager.CHUNK_SIZE / 2
        ground.position.set(worldX, 0, worldZ)

        return ground
    }

    getChunkAt(worldX: number, worldZ: number): ChunkData | undefined {
        const chunkX = Math.floor(worldX / ChunkManager.CHUNK_SIZE)
        const chunkZ = Math.floor(worldZ / ChunkManager.CHUNK_SIZE)
        return this.chunks.get(`${chunkX},${chunkZ}`)
    }

    getBiomeAt(worldX: number, worldZ: number): BiomeType {
        return this.biomeGenerator.getBiome(worldX, worldZ)
    }

    dispose(): void {
        // Unload all chunks
        for (const key of this.chunks.keys()) {
            this.unloadChunk(key)
        }

        // Dispose pools
        for (const mesh of this.groundMeshPool) {
            mesh.geometry.dispose()
        }

        // Dispose materials
        for (const material of this.groundMaterials.values()) {
            material.dispose()
        }
    }
}
