import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { PhysicsWorld } from '../physics/PhysicsWorld'

export interface BuildingConfig {
  width: number
  height: number
  depth: number
  position: THREE.Vector3
  color?: number
}

export class Building {
  public mesh: THREE.Mesh
  public body: CANNON.Body

  constructor(physicsWorld: PhysicsWorld, config: BuildingConfig) {
    this.createMesh(config)
    this.createBody(physicsWorld, config)
  }

  private createMesh(config: BuildingConfig): void {
    const geometry = new THREE.BoxGeometry(config.width, config.height, config.depth)

    // Create building material with windows
    const material = new THREE.MeshStandardMaterial({
      color: config.color || 0x666666,
      roughness: 0.9,
      metalness: 0.1
    })

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.position.copy(config.position)
    this.mesh.position.y += config.height / 2
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true

    // Add windows
    this.addWindows(config)
  }

  private addWindows(config: BuildingConfig): void {
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x112233,
      emissiveIntensity: 0.3,
      roughness: 0.1,
      metalness: 0.9
    })

    const windowWidth = 1
    const windowHeight = 1.5
    const windowSpacingX = 3
    const windowSpacingY = 3
    const windowOffset = 0.01

    const numWindowsX = Math.floor(config.width / windowSpacingX)
    const numWindowsY = Math.floor(config.height / windowSpacingY) - 1

    // Front and back windows
    for (let side = 0; side < 2; side++) {
      const zPos = side === 0 ? config.depth / 2 + windowOffset : -config.depth / 2 - windowOffset
      const rotation = side === 0 ? 0 : Math.PI

      for (let x = 0; x < numWindowsX; x++) {
        for (let y = 0; y < numWindowsY; y++) {
          const windowGeom = new THREE.PlaneGeometry(windowWidth, windowHeight)
          const windowMesh = new THREE.Mesh(windowGeom, windowMaterial)

          const xPos = (x - numWindowsX / 2 + 0.5) * windowSpacingX
          const yPos = (y - config.height / 2 + 2) * 1 + y * 2

          windowMesh.position.set(xPos, yPos, zPos)
          windowMesh.rotation.y = rotation
          this.mesh.add(windowMesh)
        }
      }
    }

    // Side windows
    const numWindowsZ = Math.floor(config.depth / windowSpacingX)

    for (let side = 0; side < 2; side++) {
      const xPos = side === 0 ? config.width / 2 + windowOffset : -config.width / 2 - windowOffset
      const rotation = side === 0 ? -Math.PI / 2 : Math.PI / 2

      for (let z = 0; z < numWindowsZ; z++) {
        for (let y = 0; y < numWindowsY; y++) {
          const windowGeom = new THREE.PlaneGeometry(windowWidth, windowHeight)
          const windowMesh = new THREE.Mesh(windowGeom, windowMaterial)

          const zOffset = (z - numWindowsZ / 2 + 0.5) * windowSpacingX
          const yPos = (y - config.height / 2 + 2) * 1 + y * 2

          windowMesh.position.set(xPos, yPos, zOffset)
          windowMesh.rotation.y = rotation
          this.mesh.add(windowMesh)
        }
      }
    }
  }

  private createBody(physicsWorld: PhysicsWorld, config: BuildingConfig): void {
    const shape = new CANNON.Box(new CANNON.Vec3(
      config.width / 2,
      config.height / 2,
      config.depth / 2
    ))

    this.body = new CANNON.Body({
      mass: 0, // Static body
      type: CANNON.Body.STATIC
    })
    this.body.addShape(shape)
    this.body.position.set(
      config.position.x,
      config.position.y + config.height / 2,
      config.position.z
    )

    physicsWorld.addBody(this.body)
  }
}

export class City {
  public buildings: Building[] = []
  public ground: THREE.Mesh
  public groundBody: CANNON.Body
  public roads: THREE.Group

  private physicsWorld: PhysicsWorld

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld
    this.createGround()
    this.createRoads()
    this.createBuildings()
    this.createProps()
  }

  private createGround(): void {
    // Visual ground
    const groundGeometry = new THREE.PlaneGeometry(500, 500)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a5a3a,
      roughness: 1
    })
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true

    // Physics ground
    const groundShape = new CANNON.Plane()
    this.groundBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.physicsWorld.createGroundMaterial()
    })
    this.groundBody.addShape(groundShape)
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.physicsWorld.addBody(this.groundBody)
  }

  private createRoads(): void {
    this.roads = new THREE.Group()

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9
    })

    // Main horizontal road
    const mainRoadH = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 15),
      roadMaterial
    )
    mainRoadH.rotation.x = -Math.PI / 2
    mainRoadH.position.y = 0.01
    mainRoadH.receiveShadow = true
    this.roads.add(mainRoadH)

    // Main vertical road
    const mainRoadV = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 200),
      roadMaterial
    )
    mainRoadV.rotation.x = -Math.PI / 2
    mainRoadV.position.y = 0.01
    mainRoadV.receiveShadow = true
    this.roads.add(mainRoadV)

    // Add road markings
    this.addRoadMarkings()
  }

  private addRoadMarkings(): void {
    const markingMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5
    })

    // Center line markings (dashed)
    for (let i = -95; i < 100; i += 5) {
      const marking = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 0.2),
        markingMaterial
      )
      marking.rotation.x = -Math.PI / 2
      marking.position.set(i, 0.02, 0)
      this.roads.add(marking)
    }

    for (let i = -95; i < 100; i += 5) {
      const marking = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 2),
        markingMaterial
      )
      marking.rotation.x = -Math.PI / 2
      marking.position.set(0, 0.02, i)
      this.roads.add(marking)
    }

    // Edge lines (solid)
    const edgeLineH1 = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 0.3),
      markingMaterial
    )
    edgeLineH1.rotation.x = -Math.PI / 2
    edgeLineH1.position.set(0, 0.02, 6.5)
    this.roads.add(edgeLineH1)

    const edgeLineH2 = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 0.3),
      markingMaterial
    )
    edgeLineH2.rotation.x = -Math.PI / 2
    edgeLineH2.position.set(0, 0.02, -6.5)
    this.roads.add(edgeLineH2)
  }

  private createBuildings(): void {
    const buildingConfigs: BuildingConfig[] = [
      // Downtown area - tall buildings
      { width: 15, height: 40, depth: 15, position: new THREE.Vector3(-40, 0, -40), color: 0x556677 },
      { width: 12, height: 55, depth: 12, position: new THREE.Vector3(-40, 0, 40), color: 0x667788 },
      { width: 18, height: 35, depth: 18, position: new THREE.Vector3(40, 0, -40), color: 0x778899 },
      { width: 14, height: 45, depth: 14, position: new THREE.Vector3(40, 0, 40), color: 0x889999 },

      // Medium buildings
      { width: 10, height: 20, depth: 10, position: new THREE.Vector3(-70, 0, 0), color: 0x666677 },
      { width: 10, height: 25, depth: 10, position: new THREE.Vector3(70, 0, 0), color: 0x776666 },
      { width: 10, height: 18, depth: 10, position: new THREE.Vector3(0, 0, -70), color: 0x667766 },
      { width: 10, height: 22, depth: 10, position: new THREE.Vector3(0, 0, 70), color: 0x777766 },

      // Small buildings/shops
      { width: 8, height: 8, depth: 8, position: new THREE.Vector3(-25, 0, 25), color: 0xaa8866 },
      { width: 8, height: 6, depth: 8, position: new THREE.Vector3(25, 0, -25), color: 0x88aa66 },
      { width: 6, height: 5, depth: 8, position: new THREE.Vector3(-25, 0, -25), color: 0x6688aa },
      { width: 8, height: 7, depth: 6, position: new THREE.Vector3(25, 0, 25), color: 0xaa6688 },

      // Additional buildings for city feel
      { width: 20, height: 30, depth: 15, position: new THREE.Vector3(-80, 0, -60), color: 0x555566 },
      { width: 15, height: 35, depth: 20, position: new THREE.Vector3(80, 0, 60), color: 0x665555 },
      { width: 12, height: 25, depth: 12, position: new THREE.Vector3(-60, 0, 80), color: 0x556655 },
      { width: 18, height: 28, depth: 14, position: new THREE.Vector3(60, 0, -80), color: 0x665566 }
    ]

    for (const config of buildingConfigs) {
      const building = new Building(this.physicsWorld, config)
      this.buildings.push(building)
    }
  }

  private createProps(): void {
    // Street lights, barriers, etc. can be added here
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.ground)
    scene.add(this.roads)

    for (const building of this.buildings) {
      scene.add(building.mesh)
    }
  }
}
