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

// Shared geometries for reuse
const sharedGeometries = {
  window: new THREE.PlaneGeometry(1, 1.5),
  roadMarkingH: new THREE.PlaneGeometry(2, 0.2),
  roadMarkingV: new THREE.PlaneGeometry(0.2, 2)
}

// Shared materials
const sharedMaterials = {
  window: new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    emissive: 0x112233,
    emissiveIntensity: 0.3,
    roughness: 0.1,
    metalness: 0.9
  }),
  road: new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9
  }),
  marking: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5
  })
}

export class Building {
  public mesh: THREE.Group
  public body: CANNON.Body
  public windowCount = 0

  constructor(physicsWorld: PhysicsWorld, config: BuildingConfig) {
    this.mesh = new THREE.Group()
    this.createMesh(config)
    this.createBody(physicsWorld, config)
  }

  private createMesh(config: BuildingConfig): void {
    const geometry = new THREE.BoxGeometry(config.width, config.height, config.depth)
    const material = new THREE.MeshStandardMaterial({
      color: config.color || 0x666666,
      roughness: 0.9,
      metalness: 0.1
    })

    const buildingMesh = new THREE.Mesh(geometry, material)
    buildingMesh.castShadow = true
    buildingMesh.receiveShadow = true
    this.mesh.add(buildingMesh)

    this.mesh.position.copy(config.position)
    this.mesh.position.y += config.height / 2

    // Count windows for instancing
    this.windowCount = this.countWindows(config)
  }

  private countWindows(config: BuildingConfig): number {
    const windowSpacingX = 3
    const windowSpacingY = 3
    const numWindowsX = Math.floor(config.width / windowSpacingX)
    const numWindowsY = Math.floor(config.height / windowSpacingY) - 1
    const numWindowsZ = Math.floor(config.depth / windowSpacingX)

    // Front + back + 2 sides
    return (numWindowsX * numWindowsY * 2) + (numWindowsZ * numWindowsY * 2)
  }

  getWindowPositions(config: BuildingConfig): { position: THREE.Vector3; rotation: number }[] {
    const positions: { position: THREE.Vector3; rotation: number }[] = []
    const windowSpacingX = 3
    const windowSpacingY = 3
    const windowOffset = 0.01

    const numWindowsX = Math.floor(config.width / windowSpacingX)
    const numWindowsY = Math.floor(config.height / windowSpacingY) - 1
    const numWindowsZ = Math.floor(config.depth / windowSpacingX)

    // Front and back
    for (let side = 0; side < 2; side++) {
      const zPos = side === 0 ? config.depth / 2 + windowOffset : -config.depth / 2 - windowOffset
      const rotation = side === 0 ? 0 : Math.PI

      for (let x = 0; x < numWindowsX; x++) {
        for (let y = 0; y < numWindowsY; y++) {
          const xPos = (x - numWindowsX / 2 + 0.5) * windowSpacingX
          const yPos = (y - config.height / 2 + 2) + y * 2
          positions.push({
            position: new THREE.Vector3(
              config.position.x + xPos,
              config.position.y + config.height / 2 + yPos,
              config.position.z + zPos
            ),
            rotation
          })
        }
      }
    }

    // Sides
    for (let side = 0; side < 2; side++) {
      const xPos = side === 0 ? config.width / 2 + windowOffset : -config.width / 2 - windowOffset
      const rotation = side === 0 ? -Math.PI / 2 : Math.PI / 2

      for (let z = 0; z < numWindowsZ; z++) {
        for (let y = 0; y < numWindowsY; y++) {
          const zOffset = (z - numWindowsZ / 2 + 0.5) * windowSpacingX
          const yPos = (y - config.height / 2 + 2) + y * 2
          positions.push({
            position: new THREE.Vector3(
              config.position.x + xPos,
              config.position.y + config.height / 2 + yPos,
              config.position.z + zOffset
            ),
            rotation
          })
        }
      }
    }

    return positions
  }

  private createBody(physicsWorld: PhysicsWorld, config: BuildingConfig): void {
    const shape = new CANNON.Box(new CANNON.Vec3(
      config.width / 2,
      config.height / 2,
      config.depth / 2
    ))

    this.body = new CANNON.Body({
      mass: 0,
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
  public windowInstances: THREE.InstancedMesh | null = null

  private physicsWorld: PhysicsWorld
  private buildingConfigs: BuildingConfig[] = []

  constructor(physicsWorld: PhysicsWorld) {
    this.physicsWorld = physicsWorld
    this.initBuildingConfigs()
    this.createGround()
    this.createBoundaries()
    this.createRoads()
    this.createBuildings()
    this.createWindowInstances()
    this.createProps()
  }

  private initBuildingConfigs(): void {
    this.buildingConfigs = [
      // ===== Center area (downtown) - tall buildings =====
      { width: 15, height: 40, depth: 15, position: new THREE.Vector3(-40, 0, -40), color: 0x556677 },
      { width: 12, height: 55, depth: 12, position: new THREE.Vector3(-40, 0, 40), color: 0x667788 },
      { width: 18, height: 35, depth: 18, position: new THREE.Vector3(40, 0, -40), color: 0x778899 },
      { width: 14, height: 45, depth: 14, position: new THREE.Vector3(40, 0, 40), color: 0x889999 },

      // Small buildings near center
      { width: 8, height: 8, depth: 8, position: new THREE.Vector3(-25, 0, 25), color: 0xaa8866 },
      { width: 8, height: 6, depth: 8, position: new THREE.Vector3(25, 0, -25), color: 0x88aa66 },
      { width: 6, height: 5, depth: 8, position: new THREE.Vector3(-25, 0, -25), color: 0x6688aa },
      { width: 8, height: 7, depth: 6, position: new THREE.Vector3(25, 0, 25), color: 0xaa6688 },

      // ===== Block (-150 to -50, -150 to -50) - Industrial =====
      { width: 25, height: 12, depth: 30, position: new THREE.Vector3(-100, 0, -140), color: 0x555555 },
      { width: 20, height: 15, depth: 25, position: new THREE.Vector3(-140, 0, -100), color: 0x666655 },
      { width: 30, height: 10, depth: 20, position: new THREE.Vector3(-120, 0, -120), color: 0x554444 },

      // ===== Block (50 to 150, -150 to -50) - Commercial =====
      { width: 18, height: 30, depth: 18, position: new THREE.Vector3(140, 0, -140), color: 0x667788 },
      { width: 15, height: 25, depth: 15, position: new THREE.Vector3(120, 0, -120), color: 0x778899 },
      { width: 12, height: 20, depth: 12, position: new THREE.Vector3(140, 0, -100), color: 0x889999 },

      // ===== Block (-150 to -50, 50 to 150) - Residential =====
      { width: 10, height: 15, depth: 10, position: new THREE.Vector3(-140, 0, 140), color: 0x998877 },
      { width: 10, height: 12, depth: 10, position: new THREE.Vector3(-120, 0, 120), color: 0x887766 },
      { width: 10, height: 18, depth: 10, position: new THREE.Vector3(-140, 0, 100), color: 0x776655 },
      { width: 8, height: 10, depth: 8, position: new THREE.Vector3(-100, 0, 140), color: 0x665544 },

      // ===== Block (50 to 150, 50 to 150) - Mixed use =====
      { width: 20, height: 35, depth: 15, position: new THREE.Vector3(140, 0, 140), color: 0x556688 },
      { width: 15, height: 28, depth: 15, position: new THREE.Vector3(120, 0, 100), color: 0x668899 },
      { width: 12, height: 22, depth: 12, position: new THREE.Vector3(100, 0, 120), color: 0x7799aa },

      // ===== Along main roads =====
      { width: 10, height: 20, depth: 10, position: new THREE.Vector3(-70, 0, 50), color: 0x666677 },
      { width: 10, height: 25, depth: 10, position: new THREE.Vector3(70, 0, 50), color: 0x776666 },
      { width: 10, height: 18, depth: 10, position: new THREE.Vector3(-70, 0, -50), color: 0x667766 },
      { width: 10, height: 22, depth: 10, position: new THREE.Vector3(70, 0, -50), color: 0x777766 },
      { width: 10, height: 20, depth: 10, position: new THREE.Vector3(50, 0, -70), color: 0x666677 },
      { width: 10, height: 25, depth: 10, position: new THREE.Vector3(50, 0, 70), color: 0x776666 },
      { width: 10, height: 18, depth: 10, position: new THREE.Vector3(-50, 0, -70), color: 0x667766 },
      { width: 10, height: 22, depth: 10, position: new THREE.Vector3(-50, 0, 70), color: 0x777766 },

      // ===== Far corners =====
      { width: 20, height: 30, depth: 15, position: new THREE.Vector3(-160, 0, -60), color: 0x555566 },
      { width: 15, height: 35, depth: 20, position: new THREE.Vector3(160, 0, 60), color: 0x665555 },
      { width: 12, height: 25, depth: 12, position: new THREE.Vector3(-60, 0, 160), color: 0x556655 },
      { width: 18, height: 28, depth: 14, position: new THREE.Vector3(60, 0, -160), color: 0x665566 },

      // ===== Additional scattered buildings =====
      { width: 15, height: 40, depth: 15, position: new THREE.Vector3(-150, 0, 50), color: 0x445566 },
      { width: 12, height: 35, depth: 12, position: new THREE.Vector3(150, 0, -50), color: 0x554466 },
      { width: 14, height: 32, depth: 14, position: new THREE.Vector3(50, 0, 150), color: 0x446655 },
      { width: 16, height: 38, depth: 16, position: new THREE.Vector3(-50, 0, -150), color: 0x665544 }
    ]
  }

  private createGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000)
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a5a3a,
      roughness: 1
    })
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial)
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true

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

  private createBoundaries(): void {
    const mapSize = 500
    const wallHeight = 50
    const wallThickness = 2

    const wallPositions = [
      { x: 0, z: mapSize, rotY: 0 },
      { x: 0, z: -mapSize, rotY: 0 },
      { x: mapSize, z: 0, rotY: Math.PI / 2 },
      { x: -mapSize, z: 0, rotY: Math.PI / 2 }
    ]

    for (const pos of wallPositions) {
      const wallShape = new CANNON.Box(new CANNON.Vec3(
        pos.rotY === 0 ? mapSize : wallThickness / 2,
        wallHeight / 2,
        pos.rotY === 0 ? wallThickness / 2 : mapSize
      ))

      const wallBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.STATIC
      })
      wallBody.addShape(wallShape)
      wallBody.position.set(pos.x, wallHeight / 2, pos.z)
      this.physicsWorld.addBody(wallBody)
    }
  }

  private createRoads(): void {
    this.roads = new THREE.Group()

    const roadWidth = 15
    const roadLength = 400
    const gridSpacing = 100

    // Reuse single geometry for all roads
    const roadGeomH = new THREE.PlaneGeometry(roadLength, roadWidth)
    const roadGeomV = new THREE.PlaneGeometry(roadWidth, roadLength)

    // Create horizontal roads
    for (let z = -200; z <= 200; z += gridSpacing) {
      const road = new THREE.Mesh(roadGeomH, sharedMaterials.road)
      road.rotation.x = -Math.PI / 2
      road.position.set(0, 0.01, z)
      road.receiveShadow = true
      this.roads.add(road)
    }

    // Create vertical roads
    for (let x = -200; x <= 200; x += gridSpacing) {
      const road = new THREE.Mesh(roadGeomV, sharedMaterials.road)
      road.rotation.x = -Math.PI / 2
      road.position.set(x, 0.01, 0)
      road.receiveShadow = true
      this.roads.add(road)
    }

    // Add optimized road markings using merged geometry
    this.addRoadMarkings()
  }

  private addRoadMarkings(): void {
    const gridSpacing = 100
    const roadLength = 400

    // Collect all marking positions for merged geometry
    const centerMarkingsH: THREE.Vector3[] = []
    const centerMarkingsV: THREE.Vector3[] = []
    const edgeMarkings: { pos: THREE.Vector3; length: number }[] = []

    // Center line positions for horizontal roads
    for (let z = -200; z <= 200; z += gridSpacing) {
      for (let i = -195; i < 200; i += 5) {
        centerMarkingsH.push(new THREE.Vector3(i, 0.02, z))
      }
    }

    // Center line positions for vertical roads
    for (let x = -200; x <= 200; x += gridSpacing) {
      for (let i = -195; i < 200; i += 5) {
        centerMarkingsV.push(new THREE.Vector3(x, 0.02, i))
      }
    }

    // Edge line positions
    for (let z = -200; z <= 200; z += gridSpacing) {
      edgeMarkings.push({ pos: new THREE.Vector3(0, 0.02, z + 6.5), length: roadLength })
      edgeMarkings.push({ pos: new THREE.Vector3(0, 0.02, z - 6.5), length: roadLength })
    }

    // Create instanced mesh for horizontal center markings
    if (centerMarkingsH.length > 0) {
      const instancedH = new THREE.InstancedMesh(
        sharedGeometries.roadMarkingH,
        sharedMaterials.marking,
        centerMarkingsH.length
      )
      const matrix = new THREE.Matrix4()
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))

      centerMarkingsH.forEach((pos, i) => {
        matrix.compose(pos, rotation, new THREE.Vector3(1, 1, 1))
        instancedH.setMatrixAt(i, matrix)
      })
      instancedH.instanceMatrix.needsUpdate = true
      this.roads.add(instancedH)
    }

    // Create instanced mesh for vertical center markings
    if (centerMarkingsV.length > 0) {
      const instancedV = new THREE.InstancedMesh(
        sharedGeometries.roadMarkingV,
        sharedMaterials.marking,
        centerMarkingsV.length
      )
      const matrix = new THREE.Matrix4()
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))

      centerMarkingsV.forEach((pos, i) => {
        matrix.compose(pos, rotation, new THREE.Vector3(1, 1, 1))
        instancedV.setMatrixAt(i, matrix)
      })
      instancedV.instanceMatrix.needsUpdate = true
      this.roads.add(instancedV)
    }

    // Edge lines - reuse geometry
    const edgeGeom = new THREE.PlaneGeometry(roadLength, 0.3)
    for (const edge of edgeMarkings) {
      const edgeLine = new THREE.Mesh(edgeGeom, sharedMaterials.marking)
      edgeLine.rotation.x = -Math.PI / 2
      edgeLine.position.copy(edge.pos)
      this.roads.add(edgeLine)
    }
  }

  private createBuildings(): void {
    for (const config of this.buildingConfigs) {
      const building = new Building(this.physicsWorld, config)
      this.buildings.push(building)
    }
  }

  private createWindowInstances(): void {
    // Count total windows needed
    let totalWindows = 0
    const windowData: { position: THREE.Vector3; rotation: number }[] = []

    for (let i = 0; i < this.buildings.length; i++) {
      const building = this.buildings[i]
      const config = this.buildingConfigs[i]
      const positions = building.getWindowPositions(config)
      windowData.push(...positions)
      totalWindows += positions.length
    }

    if (totalWindows === 0) return

    // Create single instanced mesh for ALL windows
    this.windowInstances = new THREE.InstancedMesh(
      sharedGeometries.window,
      sharedMaterials.window,
      totalWindows
    )

    const matrix = new THREE.Matrix4()
    const tempQuat = new THREE.Quaternion()
    const scale = new THREE.Vector3(1, 1, 1)

    windowData.forEach((data, i) => {
      tempQuat.setFromEuler(new THREE.Euler(0, data.rotation, 0))
      matrix.compose(data.position, tempQuat, scale)
      this.windowInstances!.setMatrixAt(i, matrix)
    })

    this.windowInstances.instanceMatrix.needsUpdate = true
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

    if (this.windowInstances) {
      scene.add(this.windowInstances)
    }
  }
}
