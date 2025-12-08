import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { PhysicsWorld } from '../physics/PhysicsWorld'
import { SimplexNoise } from './SimplexNoise'

// Chunk size constant - must match CHUNK_SIZE
const CHUNK_SIZE = 100

export enum BiomeType {
    City = 'city',
    Suburban = 'suburban',
    Desert = 'desert',
    Forest = 'forest',
    Snow = 'snow'
}

// Shared geometries for performance
const sharedGeometries = {
    road: new THREE.PlaneGeometry(CHUNK_SIZE, 15),
    building: new THREE.BoxGeometry(1, 1, 1), // Will be scaled per-building
    tree: new THREE.ConeGeometry(2, 4, 8),
    trunk: new THREE.CylinderGeometry(0.3, 0.4, 2, 8),
    cactus: new THREE.CylinderGeometry(0.5, 0.6, 4, 8),
    rock: new THREE.DodecahedronGeometry(1.5, 0)
}

// Shared materials
const sharedMaterials = {
    road: new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }),
    roadMarking: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    building: new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.8 }),
    buildingDark: new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.8 }),
    tree: new THREE.MeshStandardMaterial({ color: 0x228833, roughness: 0.9 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9 }),
    cactus: new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.8 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.95 }),
    rockDesert: new THREE.MeshStandardMaterial({ color: 0xaa8866, roughness: 0.9 }),
    snowRock: new THREE.MeshStandardMaterial({ color: 0xccccdd, roughness: 0.7 })
}

export class BiomeGenerator {
    private noise: SimplexNoise
    private seed: number

    constructor(seed: number = 12345) {
        this.seed = seed
        this.noise = new SimplexNoise(seed)
    }

    getBiome(worldX: number, worldZ: number): BiomeType {
        // Use large-scale noise to determine biome regions
        const scale = 0.002 // Larger scale = bigger biome regions
        const noiseValue = this.noise.fbm(worldX * scale, worldZ * scale, 3, 2, 0.5)

        // Also use secondary noise for temperature/moisture-like variation
        const tempNoise = this.noise.noise2D(worldX * scale * 0.7, worldZ * scale * 0.7)

        // Map noise to biomes
        if (noiseValue > 0.3) {
            return tempNoise > 0 ? BiomeType.City : BiomeType.Suburban
        } else if (noiseValue > 0) {
            return BiomeType.Forest
        } else if (noiseValue > -0.3) {
            return tempNoise > 0.2 ? BiomeType.Snow : BiomeType.Desert
        } else {
            return BiomeType.Desert
        }
    }

    generateChunkContent(
        objectsGroup: THREE.Group,
        physicsWorld: PhysicsWorld,
        chunkX: number,
        chunkZ: number,
        biome: BiomeType
    ): CANNON.Body[] {
        const physicsBodies: CANNON.Body[] = []
        const chunkWorldX = chunkX * CHUNK_SIZE
        const chunkWorldZ = chunkZ * CHUNK_SIZE

        // Generate road if applicable
        if (biome === BiomeType.City || biome === BiomeType.Suburban) {
            this.generateRoads(objectsGroup, chunkX, chunkZ)
        }

        switch (biome) {
            case BiomeType.City:
                this.generateCityContent(objectsGroup, physicsBodies, physicsWorld, chunkWorldX, chunkWorldZ, chunkX, chunkZ)
                break
            case BiomeType.Suburban:
                this.generateSuburbanContent(objectsGroup, physicsBodies, physicsWorld, chunkWorldX, chunkWorldZ, chunkX, chunkZ)
                break
            case BiomeType.Desert:
                this.generateDesertContent(objectsGroup, physicsBodies, physicsWorld, chunkWorldX, chunkWorldZ, chunkX, chunkZ)
                break
            case BiomeType.Forest:
                this.generateForestContent(objectsGroup, physicsBodies, physicsWorld, chunkWorldX, chunkWorldZ, chunkX, chunkZ)
                break
            case BiomeType.Snow:
                this.generateSnowContent(objectsGroup, physicsBodies, physicsWorld, chunkWorldX, chunkWorldZ, chunkX, chunkZ)
                break
        }

        return physicsBodies
    }

    private seededRandom(x: number, z: number, offset: number = 0): number {
        const n = Math.sin(x * 12.9898 + z * 78.233 + offset + this.seed) * 43758.5453
        return n - Math.floor(n)
    }

    private generateRoads(group: THREE.Group, chunkX: number, chunkZ: number): void {
        const chunkSize = CHUNK_SIZE
        const worldX = chunkX * chunkSize + chunkSize / 2
        const worldZ = chunkZ * chunkSize + chunkSize / 2

        // Main roads run through chunks divisible by 2
        const hasHorizontalRoad = chunkZ % 2 === 0
        const hasVerticalRoad = chunkX % 2 === 0

        if (hasHorizontalRoad) {
            const roadGeom = new THREE.PlaneGeometry(chunkSize, 15)
            const road = new THREE.Mesh(roadGeom, sharedMaterials.road)
            road.rotation.x = -Math.PI / 2
            road.position.set(worldX, 0.02, worldZ)
            road.receiveShadow = true
            group.add(road)

            // Road markings
            this.addRoadMarkings(group, worldX, worldZ, true, chunkSize)
        }

        if (hasVerticalRoad) {
            const roadGeom = new THREE.PlaneGeometry(15, chunkSize)
            const road = new THREE.Mesh(roadGeom, sharedMaterials.road)
            road.rotation.x = -Math.PI / 2
            road.position.set(worldX, 0.02, worldZ)
            road.receiveShadow = true
            group.add(road)

            // Road markings
            this.addRoadMarkings(group, worldX, worldZ, false, chunkSize)
        }
    }

    private addRoadMarkings(group: THREE.Group, worldX: number, worldZ: number, isHorizontal: boolean, chunkSize: number): void {
        const markingGeom = isHorizontal
            ? new THREE.PlaneGeometry(3, 0.3)
            : new THREE.PlaneGeometry(0.3, 3)

        const numMarkings = Math.floor(chunkSize / 8)
        const startOffset = -chunkSize / 2 + 4

        for (let i = 0; i < numMarkings; i++) {
            const marking = new THREE.Mesh(markingGeom, sharedMaterials.roadMarking)
            marking.rotation.x = -Math.PI / 2

            if (isHorizontal) {
                marking.position.set(worldX + startOffset + i * 8, 0.03, worldZ)
            } else {
                marking.position.set(worldX, 0.03, worldZ + startOffset + i * 8)
            }

            group.add(marking)
        }
    }

    private generateCityContent(
        group: THREE.Group,
        bodies: CANNON.Body[],
        physics: PhysicsWorld,
        worldX: number,
        worldZ: number,
        chunkX: number,
        chunkZ: number
    ): void {
        const chunkSize = CHUNK_SIZE

        // Skip if this is a road chunk
        if (chunkX % 2 === 0 || chunkZ % 2 === 0) {
            // Only add side buildings
            this.addBuildingsAlongRoad(group, bodies, physics, worldX, worldZ, chunkX, chunkZ)
            return
        }

        // Generate buildings in grid pattern for non-road chunks
        const numBuildings = 2 + Math.floor(this.seededRandom(chunkX, chunkZ) * 3)

        for (let i = 0; i < numBuildings; i++) {
            const offsetX = (this.seededRandom(chunkX, chunkZ, i * 10) - 0.5) * (chunkSize - 30)
            const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 10 + 5) - 0.5) * (chunkSize - 30)

            const width = 10 + this.seededRandom(chunkX, chunkZ, i * 20) * 15
            const height = 20 + this.seededRandom(chunkX, chunkZ, i * 30) * 40
            const depth = 10 + this.seededRandom(chunkX, chunkZ, i * 40) * 15

            const x = worldX + chunkSize / 2 + offsetX
            const z = worldZ + chunkSize / 2 + offsetZ

            this.createBuilding(group, bodies, physics, x, z, width, height, depth)
        }
    }

    private addBuildingsAlongRoad(
        group: THREE.Group,
        bodies: CANNON.Body[],
        physics: PhysicsWorld,
        worldX: number,
        worldZ: number,
        chunkX: number,
        chunkZ: number
    ): void {
        const chunkSize = CHUNK_SIZE
        const hasHRoad = chunkZ % 2 === 0
        const hasVRoad = chunkX % 2 === 0

        // Add buildings on sides of roads
        if (hasHRoad && !hasVRoad) {
            // Buildings on top and bottom of horizontal road
            for (let i = 0; i < 2; i++) {
                const offsetX = (this.seededRandom(chunkX, chunkZ, i * 100) - 0.5) * (chunkSize - 30)
                const offsetZ = (i === 0 ? -1 : 1) * 30

                const width = 15 + this.seededRandom(chunkX, chunkZ, i * 110) * 10
                const height = 15 + this.seededRandom(chunkX, chunkZ, i * 120) * 25
                const depth = 12 + this.seededRandom(chunkX, chunkZ, i * 130) * 8

                this.createBuilding(group, bodies, physics,
                    worldX + chunkSize / 2 + offsetX,
                    worldZ + chunkSize / 2 + offsetZ,
                    width, height, depth)
            }
        }

        if (hasVRoad && !hasHRoad) {
            // Buildings on left and right of vertical road
            for (let i = 0; i < 2; i++) {
                const offsetX = (i === 0 ? -1 : 1) * 30
                const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 200) - 0.5) * (chunkSize - 30)

                const width = 12 + this.seededRandom(chunkX, chunkZ, i * 210) * 8
                const height = 15 + this.seededRandom(chunkX, chunkZ, i * 220) * 25
                const depth = 15 + this.seededRandom(chunkX, chunkZ, i * 230) * 10

                this.createBuilding(group, bodies, physics,
                    worldX + chunkSize / 2 + offsetX,
                    worldZ + chunkSize / 2 + offsetZ,
                    width, height, depth)
            }
        }
    }

    private createBuilding(
        group: THREE.Group,
        bodies: CANNON.Body[],
        physics: PhysicsWorld,
        x: number,
        z: number,
        width: number,
        height: number,
        depth: number
    ): void {
        // Visual mesh
        const geometry = new THREE.BoxGeometry(width, height, depth)
        const material = this.seededRandom(x, z) > 0.5 ? sharedMaterials.building : sharedMaterials.buildingDark
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, height / 2, z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)

        // Physics body
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2))
        const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
        body.addShape(shape)
        body.position.set(x, height / 2, z)
        physics.addBody(body)
        bodies.push(body)
    }

    private generateSuburbanContent(
        group: THREE.Group,
        bodies: CANNON.Body[],
        physics: PhysicsWorld,
        worldX: number,
        worldZ: number,
        chunkX: number,
        chunkZ: number
    ): void {
        const chunkSize = CHUNK_SIZE

        // Smaller houses, more spread out
        if (chunkX % 2 !== 0 && chunkZ % 2 !== 0) {
            const numHouses = 1 + Math.floor(this.seededRandom(chunkX, chunkZ) * 2)

            for (let i = 0; i < numHouses; i++) {
                const offsetX = (this.seededRandom(chunkX, chunkZ, i * 50) - 0.5) * (chunkSize - 20)
                const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 60) - 0.5) * (chunkSize - 20)

                const width = 8 + this.seededRandom(chunkX, chunkZ, i * 70) * 6
                const height = 5 + this.seededRandom(chunkX, chunkZ, i * 80) * 4
                const depth = 8 + this.seededRandom(chunkX, chunkZ, i * 90) * 6

                this.createBuilding(group, bodies, physics,
                    worldX + chunkSize / 2 + offsetX,
                    worldZ + chunkSize / 2 + offsetZ,
                    width, height, depth)
            }
        }

        // Add some trees around houses
        const numTrees = 3 + Math.floor(this.seededRandom(chunkX, chunkZ, 500) * 4)
        for (let i = 0; i < numTrees; i++) {
            const offsetX = (this.seededRandom(chunkX, chunkZ, i * 300) - 0.5) * chunkSize
            const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 310) - 0.5) * chunkSize
            this.createTree(group, worldX + chunkSize / 2 + offsetX, worldZ + chunkSize / 2 + offsetZ)
        }
    }

    private generateDesertContent(
        group: THREE.Group,
        bodies: CANNON.Body[],
        physics: PhysicsWorld,
        worldX: number,
        worldZ: number,
        chunkX: number,
        chunkZ: number
    ): void {
        const chunkSize = CHUNK_SIZE

        // Cacti
        const numCacti = 2 + Math.floor(this.seededRandom(chunkX, chunkZ) * 5)
        for (let i = 0; i < numCacti; i++) {
            const offsetX = (this.seededRandom(chunkX, chunkZ, i * 400) - 0.5) * chunkSize
            const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 410) - 0.5) * chunkSize
            this.createCactus(group, worldX + chunkSize / 2 + offsetX, worldZ + chunkSize / 2 + offsetZ)
        }

        // Rocks
        const numRocks = 1 + Math.floor(this.seededRandom(chunkX, chunkZ, 100) * 3)
        for (let i = 0; i < numRocks; i++) {
            const offsetX = (this.seededRandom(chunkX, chunkZ, i * 420) - 0.5) * chunkSize
            const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 430) - 0.5) * chunkSize
            const scale = 0.5 + this.seededRandom(chunkX, chunkZ, i * 440) * 1.5
            this.createRock(group, bodies, physics,
                worldX + chunkSize / 2 + offsetX,
                worldZ + chunkSize / 2 + offsetZ,
                scale, sharedMaterials.rockDesert)
        }
    }

    private generateForestContent(
        group: THREE.Group,
        bodies: CANNON.Body[],
        physics: PhysicsWorld,
        worldX: number,
        worldZ: number,
        chunkX: number,
        chunkZ: number
    ): void {
        const chunkSize = CHUNK_SIZE

        // Many trees
        const numTrees = 8 + Math.floor(this.seededRandom(chunkX, chunkZ) * 10)
        for (let i = 0; i < numTrees; i++) {
            const offsetX = (this.seededRandom(chunkX, chunkZ, i * 500) - 0.5) * chunkSize
            const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 510) - 0.5) * chunkSize
            this.createTree(group, worldX + chunkSize / 2 + offsetX, worldZ + chunkSize / 2 + offsetZ)
        }

        // A few rocks
        const numRocks = Math.floor(this.seededRandom(chunkX, chunkZ, 200) * 3)
        for (let i = 0; i < numRocks; i++) {
            const offsetX = (this.seededRandom(chunkX, chunkZ, i * 520) - 0.5) * chunkSize
            const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 530) - 0.5) * chunkSize
            const scale = 0.3 + this.seededRandom(chunkX, chunkZ, i * 540) * 0.8
            this.createRock(group, bodies, physics,
                worldX + chunkSize / 2 + offsetX,
                worldZ + chunkSize / 2 + offsetZ,
                scale, sharedMaterials.rock)
        }
    }

    private generateSnowContent(
        group: THREE.Group,
        bodies: CANNON.Body[],
        physics: PhysicsWorld,
        worldX: number,
        worldZ: number,
        chunkX: number,
        chunkZ: number
    ): void {
        const chunkSize = CHUNK_SIZE

        // Conifer trees (same shape, different color could be added)
        const numTrees = 4 + Math.floor(this.seededRandom(chunkX, chunkZ) * 6)
        for (let i = 0; i < numTrees; i++) {
            const offsetX = (this.seededRandom(chunkX, chunkZ, i * 600) - 0.5) * chunkSize
            const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 610) - 0.5) * chunkSize
            this.createTree(group, worldX + chunkSize / 2 + offsetX, worldZ + chunkSize / 2 + offsetZ)
        }

        // Snow-covered rocks
        const numRocks = 2 + Math.floor(this.seededRandom(chunkX, chunkZ, 300) * 3)
        for (let i = 0; i < numRocks; i++) {
            const offsetX = (this.seededRandom(chunkX, chunkZ, i * 620) - 0.5) * chunkSize
            const offsetZ = (this.seededRandom(chunkX, chunkZ, i * 630) - 0.5) * chunkSize
            const scale = 0.5 + this.seededRandom(chunkX, chunkZ, i * 640) * 1.2
            this.createRock(group, bodies, physics,
                worldX + chunkSize / 2 + offsetX,
                worldZ + chunkSize / 2 + offsetZ,
                scale, sharedMaterials.snowRock)
        }
    }

    private createTree(group: THREE.Group, x: number, z: number): void {
        const treeGroup = new THREE.Group()

        // Trunk
        const trunk = new THREE.Mesh(sharedGeometries.trunk, sharedMaterials.trunk)
        trunk.position.y = 1
        trunk.castShadow = true
        treeGroup.add(trunk)

        // Foliage
        const foliage = new THREE.Mesh(sharedGeometries.tree, sharedMaterials.tree)
        foliage.position.y = 4
        foliage.castShadow = true
        treeGroup.add(foliage)

        treeGroup.position.set(x, 0, z)
        group.add(treeGroup)
    }

    private createCactus(group: THREE.Group, x: number, z: number): void {
        const cactus = new THREE.Mesh(sharedGeometries.cactus, sharedMaterials.cactus)
        cactus.position.set(x, 2, z)
        cactus.castShadow = true
        group.add(cactus)
    }

    private createRock(
        group: THREE.Group,
        bodies: CANNON.Body[],
        physics: PhysicsWorld,
        x: number,
        z: number,
        scale: number,
        material: THREE.Material
    ): void {
        const rock = new THREE.Mesh(sharedGeometries.rock, material)
        rock.position.set(x, scale * 0.75, z)
        rock.scale.setScalar(scale)
        rock.rotation.y = Math.random() * Math.PI * 2
        rock.castShadow = true
        group.add(rock)

        // Physics body for rock
        const shape = new CANNON.Sphere(scale * 1.2)
        const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC })
        body.addShape(shape)
        body.position.set(x, scale * 0.75, z)
        physics.addBody(body)
        bodies.push(body)
    }
}
