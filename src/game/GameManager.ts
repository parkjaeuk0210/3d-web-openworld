import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { PhysicsWorld } from './physics/PhysicsWorld'
import { Vehicle } from './entities/Vehicle'
import { ChunkManager } from './world/ChunkManager'
// import { DestructibleStructure } from './entities/DestructibleStructure' // Temporarily disabled
import { InputManager } from './controls/InputManager'
import { VehicleController } from './controls/VehicleController'
import { GameUI } from './ui/GameUI'
import { NetworkManager } from './network/NetworkManager'

export class GameManager {
  // Three.js
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera

  // Physics
  private physicsWorld: PhysicsWorld

  // Entities
  private vehicle: Vehicle
  private chunkManager: ChunkManager
  private groundBody: CANNON.Body
  // private destructibleStructure: DestructibleStructure // Temporarily disabled

  // Controls
  private inputManager: InputManager
  private vehicleController: VehicleController

  // State
  private canToggleLights = true

  // UI
  private ui: GameUI

  // Lighting
  private sunLight: THREE.DirectionalLight

  // Network
  private networkManager: NetworkManager | null = null
  private isMultiplayerEnabled = false

  // Timing
  private clock: THREE.Clock

  constructor() {
    this.clock = new THREE.Clock()
    this.inputManager = new InputManager()
  }

  async init(): Promise<void> {
    this.updateLoadingProgress(10, 'Initializing renderer...')
    this.initRenderer()

    this.updateLoadingProgress(20, 'Creating scene...')
    this.initScene()

    this.updateLoadingProgress(30, 'Setting up physics...')
    this.initPhysics()

    this.updateLoadingProgress(50, 'Creating procedural world...')
    this.createWorld()

    // this.updateLoadingProgress(60, 'Creating destructible structures...')
    // this.createDestructibleStructures() // Temporarily disabled

    this.updateLoadingProgress(70, 'Spawning vehicle...')
    this.createVehicle()

    this.updateLoadingProgress(90, 'Setting up UI...')
    this.initUI()

    // Setup vehicle controller
    this.vehicleController = new VehicleController(
      this.vehicle,
      this.camera,
      this.inputManager
    )
    this.vehicleController.alignToVehicle()

    this.updateLoadingProgress(100, 'Ready!')

    // Hide loading screen
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen')
      if (loadingScreen) {
        loadingScreen.style.opacity = '0'
        loadingScreen.style.transition = 'opacity 0.5s'
        setTimeout(() => {
          loadingScreen.style.display = 'none'
        }, 500)
      }
    }, 500)

    // Setup resize handler
    window.addEventListener('resize', () => this.onWindowResize())

    // Try to connect to multiplayer server
    this.initMultiplayer()

    // Start game loop
    this.animate()
  }

  private updateLoadingProgress(percent: number, text: string): void {
    const fill = document.getElementById('loading-fill')
    const loadingText = document.getElementById('loading-text')
    if (fill) fill.style.width = `${percent}%`
    if (loadingText) loadingText.textContent = text
  }

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1

    const container = document.getElementById('game-container')
    if (container) {
      container.insertBefore(this.renderer.domElement, container.firstChild)
    }
  }

  private initScene(): void {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x87ceeb) // Sky blue
    this.scene.fog = new THREE.Fog(0x87ceeb, 150, 800) // Extended fog for larger map

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1500 // Extended far plane for larger map
    )
    this.camera.position.set(0, 10, 20)

    // Lighting
    this.setupLighting()
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)

    // Directional light (sun) - follows vehicle for proper shadowing
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1)
    this.sunLight.position.set(50, 100, 50)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.width = 4096
    this.sunLight.shadow.mapSize.height = 4096
    this.sunLight.shadow.camera.near = 0.5
    this.sunLight.shadow.camera.far = 300
    this.sunLight.shadow.camera.left = -100
    this.sunLight.shadow.camera.right = 100
    this.sunLight.shadow.camera.top = 100
    this.sunLight.shadow.camera.bottom = -100
    this.sunLight.shadow.bias = -0.0001
    this.scene.add(this.sunLight)
    this.scene.add(this.sunLight.target) // Add target to scene for dynamic updates

    // Hemisphere light for better ambient
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3a5a3a, 0.3)
    this.scene.add(hemisphereLight)
  }

  private initPhysics(): void {
    this.physicsWorld = new PhysicsWorld()
  }

  private createWorld(): void {
    // Create infinite ground plane for physics
    const groundShape = new CANNON.Plane()
    this.groundBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: this.physicsWorld.createGroundMaterial()
    })
    this.groundBody.addShape(groundShape)
    this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.physicsWorld.addBody(this.groundBody)

    // Create chunk manager for procedural world
    this.chunkManager = new ChunkManager(this.scene, this.physicsWorld, 12345)
  }

  // Temporarily disabled
  // private createDestructibleStructures(): void {
  //   // Create a destructible structure in the center of the map
  //   this.destructibleStructure = new DestructibleStructure(
  //     this.physicsWorld,
  //     new THREE.Vector3(0, 0, -40) // Position it in the center-north area
  //   )
  //   this.destructibleStructure.addToScene(this.scene)
  // }

  private createVehicle(): void {
    this.vehicle = new Vehicle(this.physicsWorld, {}, 0xff3333)
    this.vehicle.physics.setPosition(0, 2, 10)

    this.scene.add(this.vehicle.mesh)
    for (const wheelMesh of this.vehicle.wheelMeshes) {
      this.scene.add(wheelMesh)
    }
  }

  private initUI(): void {
    this.ui = new GameUI()
  }

  private async initMultiplayer(): Promise<void> {
    // Server URL - change this for production
    const serverUrl = 'http://localhost:3001'
    const playerName = `Player_${Math.floor(Math.random() * 10000)}`

    this.networkManager = new NetworkManager(this.scene)

    // Setup event handlers
    this.networkManager.onConnected((playerId, players) => {
      console.log(`Connected as ${playerId}, ${players.length} players online`)
      this.isMultiplayerEnabled = true
    })

    this.networkManager.onDisconnected(() => {
      console.log('Disconnected from server')
      this.isMultiplayerEnabled = false
    })

    this.networkManager.onPlayerJoin((player) => {
      console.log(`${player.name} joined the game`)
    })

    this.networkManager.onPlayerLeave((playerId) => {
      console.log(`Player ${playerId} left the game`)
    })

    this.networkManager.onRoomFull(() => {
      console.warn('Game room is full (20 players)')
    })

    // Set local vehicle and connect
    this.networkManager.setLocalVehicle(this.vehicle)

    try {
      const connected = await this.networkManager.connect(serverUrl, playerName)
      if (connected) {
        console.log('Multiplayer connected successfully!')
      } else {
        console.log('Multiplayer unavailable, playing offline')
      }
    } catch (error) {
      console.log('Multiplayer server not available, playing offline')
    }
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate())

    const deltaTime = this.clock.getDelta()

    // Update physics
    this.physicsWorld.update(deltaTime)

    // Update entities
    this.vehicle.update()
    // this.destructibleStructure.update() // Temporarily disabled

    // Update chunk manager based on player position
    this.chunkManager.update(this.vehicle.getPosition())

    // Update sun light to follow vehicle for proper shadows
    const vehiclePos = this.vehicle.getPosition()
    this.sunLight.position.set(vehiclePos.x + 50, 100, vehiclePos.z + 50)
    this.sunLight.target.position.set(vehiclePos.x, 0, vehiclePos.z)

    // Handle vehicle controls
    this.handleLightsToggle()
    this.vehicleController.update()

    // Update network (send/receive vehicle states)
    if (this.networkManager) {
      this.networkManager.update()
    }

    // Update UI
    this.updateUI()

    // Render
    this.renderer.render(this.scene, this.camera)
  }

  private handleLightsToggle(): void {
    if (!this.canToggleLights) return

    // L key to toggle lights
    if (this.inputManager.isKeyPressed('KeyL')) {
      this.vehicle.toggleLights()
      this.canToggleLights = false

      setTimeout(() => {
        this.canToggleLights = true
      }, 300)
    }

    // R key to flip/reset vehicle
    if (this.inputManager.isKeyPressed('KeyR')) {
      this.vehicle.flipReset()
      this.canToggleLights = false

      setTimeout(() => {
        this.canToggleLights = true
      }, 1000)
    }
  }

  private updateUI(): void {
    // Update speed
    const speed = Math.round(this.vehicle.getSpeed())
    this.ui.updateSpeed(speed)

    // Update minimap (simplified - no building data for now)
    const position = this.vehicle.getPosition()
    const rotation = new THREE.Euler().setFromQuaternion(this.vehicle.mesh.quaternion).y

    // Collect all vehicle positions (local + remote)
    const vehiclePositions = [this.vehicle.getPosition()]
    if (this.networkManager && this.isMultiplayerEnabled) {
      for (const remoteVehicle of this.networkManager.getRemoteVehicles().values()) {
        vehiclePositions.push(remoteVehicle.mesh.position.clone())
      }
    }

    this.ui.updateMinimap(
      position,
      rotation,
      vehiclePositions,
      [] // Buildings now managed by ChunkManager - TODO: expose building data if needed
    )

    // Update online status
    if (this.isMultiplayerEnabled && this.networkManager) {
      const playerCount = this.networkManager.getRemotePlayerCount() + 1
      this.ui.updateOnlineStatus?.(true, playerCount)
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
