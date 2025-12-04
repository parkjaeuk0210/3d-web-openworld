import * as THREE from 'three'
import { PhysicsWorld } from './physics/PhysicsWorld'
import { Vehicle } from './entities/Vehicle'
import { City } from './entities/Building'
import { DestructibleStructure } from './entities/DestructibleStructure'
import { InputManager } from './controls/InputManager'
import { VehicleController } from './controls/VehicleController'
import { GameUI } from './ui/GameUI'

export class GameManager {
  // Three.js
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera

  // Physics
  private physicsWorld: PhysicsWorld

  // Entities
  private vehicle: Vehicle
  private city: City
  private destructibleStructure: DestructibleStructure

  // Controls
  private inputManager: InputManager
  private vehicleController: VehicleController

  // State
  private canToggleLights = true

  // UI
  private ui: GameUI

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

    this.updateLoadingProgress(50, 'Creating city...')
    this.createCity()

    this.updateLoadingProgress(60, 'Creating destructible structures...')
    this.createDestructibleStructures()

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

    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1)
    sunLight.position.set(50, 100, 50)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 800
    sunLight.shadow.camera.left = -250
    sunLight.shadow.camera.right = 250
    sunLight.shadow.camera.top = 250
    sunLight.shadow.camera.bottom = -250
    sunLight.shadow.bias = -0.0001
    this.scene.add(sunLight)

    // Hemisphere light for better ambient
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3a5a3a, 0.3)
    this.scene.add(hemisphereLight)
  }

  private initPhysics(): void {
    this.physicsWorld = new PhysicsWorld()
  }

  private createCity(): void {
    this.city = new City(this.physicsWorld)
    this.city.addToScene(this.scene)
  }

  private createDestructibleStructures(): void {
    // Create a destructible structure in the center of the map
    this.destructibleStructure = new DestructibleStructure(
      this.physicsWorld,
      new THREE.Vector3(0, 0, -40) // Position it in the center-north area
    )
    this.destructibleStructure.addToScene(this.scene)
  }

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

  private animate(): void {
    requestAnimationFrame(() => this.animate())

    const deltaTime = this.clock.getDelta()

    // Update physics
    this.physicsWorld.update(deltaTime)

    // Update entities
    this.vehicle.update()
    this.destructibleStructure.update()

    // Handle vehicle controls
    this.handleLightsToggle()
    this.vehicleController.update()

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

    // Update minimap
    const position = this.vehicle.getPosition()
    const rotation = new THREE.Euler().setFromQuaternion(this.vehicle.mesh.quaternion).y

    this.ui.updateMinimap(
      position,
      rotation,
      [this.vehicle.getPosition()],
      this.city.buildings.map(b => ({
        position: new THREE.Vector3(b.body.position.x, 0, b.body.position.z),
        size: new THREE.Vector2(
          (b.body.shapes[0] as any).halfExtents.x * 2,
          (b.body.shapes[0] as any).halfExtents.z * 2
        )
      }))
    )
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
