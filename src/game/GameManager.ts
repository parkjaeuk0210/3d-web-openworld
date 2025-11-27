import * as THREE from 'three'
import { PhysicsWorld } from './physics/PhysicsWorld'
import { Player } from './entities/Player'
import { Vehicle } from './entities/Vehicle'
import { City } from './entities/Building'
import { InputManager } from './controls/InputManager'
import { PlayerController } from './controls/PlayerController'
import { VehicleController } from './controls/VehicleController'
import { GameUI } from './ui/GameUI'

export enum GameMode {
  OnFoot,
  InVehicle
}

export class GameManager {
  // Three.js
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera

  // Physics
  private physicsWorld: PhysicsWorld

  // Entities
  private player: Player
  private vehicles: Vehicle[] = []
  private city: City

  // Controls
  private inputManager: InputManager
  private playerController: PlayerController
  private vehicleController: VehicleController | null = null

  // State
  private gameMode: GameMode = GameMode.OnFoot
  private currentVehicle: Vehicle | null = null
  private canInteract = true
  private interactCooldown = 500 // ms

  // UI
  private ui: GameUI

  // Timing
  private clock: THREE.Clock
  private lastTime = 0

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

    this.updateLoadingProgress(70, 'Spawning vehicles...')
    this.createVehicles()

    this.updateLoadingProgress(80, 'Creating player...')
    this.createPlayer()

    this.updateLoadingProgress(90, 'Setting up UI...')
    this.initUI()

    // Start in vehicle
    this.enterVehicle(this.vehicles[0])

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
    this.scene.fog = new THREE.Fog(0x87ceeb, 100, 500)

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
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
    sunLight.shadow.mapSize.width = 4096
    sunLight.shadow.mapSize.height = 4096
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 500
    sunLight.shadow.camera.left = -150
    sunLight.shadow.camera.right = 150
    sunLight.shadow.camera.top = 150
    sunLight.shadow.camera.bottom = -150
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

  private createVehicles(): void {
    // Create multiple vehicles around the city
    const vehicleConfigs = [
      { position: { x: 0, y: 2, z: 10 }, color: 0xff3333 },
      { position: { x: -30, y: 2, z: 0 }, color: 0x3333ff },
      { position: { x: 30, y: 2, z: 0 }, color: 0x33ff33 },
      { position: { x: 0, y: 2, z: -30 }, color: 0xffff33 },
      { position: { x: 50, y: 2, z: 50 }, color: 0xff33ff }
    ]

    for (const config of vehicleConfigs) {
      const vehicle = new Vehicle(this.physicsWorld, {}, config.color)
      vehicle.physics.setPosition(config.position.x, config.position.y, config.position.z)

      this.scene.add(vehicle.mesh)
      for (const wheelMesh of vehicle.wheelMeshes) {
        this.scene.add(wheelMesh)
      }

      this.vehicles.push(vehicle)
    }
  }

  private createPlayer(): void {
    this.player = new Player(this.physicsWorld)
    this.scene.add(this.player.mesh)

    this.playerController = new PlayerController(
      this.player,
      this.camera,
      this.inputManager
    )
  }

  private initUI(): void {
    this.ui = new GameUI()
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate())

    const deltaTime = this.clock.getDelta()
    const time = this.clock.getElapsedTime()

    // Update physics
    this.physicsWorld.update(deltaTime)

    // Update entities
    this.player.update()
    for (const vehicle of this.vehicles) {
      vehicle.update()
    }

    // Handle interactions
    this.handleInteraction()

    // Update controls based on game mode
    if (this.gameMode === GameMode.OnFoot) {
      this.playerController.update()
      this.checkNearbyVehicles()
    } else if (this.gameMode === GameMode.InVehicle && this.vehicleController) {
      this.vehicleController.update()
    }

    // Update UI
    this.updateUI()

    // Render
    this.renderer.render(this.scene, this.camera)
  }

  private handleInteraction(): void {
    if (!this.canInteract) return

    const state = this.inputManager.getState()
    if (state.interact) {
      this.canInteract = false

      if (this.gameMode === GameMode.OnFoot) {
        this.tryEnterVehicle()
      } else {
        this.exitVehicle()
      }

      setTimeout(() => {
        this.canInteract = true
      }, this.interactCooldown)
    }
  }

  private checkNearbyVehicles(): void {
    const playerPos = this.player.physics.getPosition()
    let nearestVehicle: Vehicle | null = null
    let nearestDistance = Infinity

    for (const vehicle of this.vehicles) {
      const vehiclePos = vehicle.getPosition()
      const distance = playerPos.distanceTo(vehiclePos)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestVehicle = vehicle
      }
    }

    // Show vehicle indicator if close enough
    const indicator = document.getElementById('vehicle-indicator')
    if (indicator) {
      if (nearestDistance < 5 && nearestVehicle) {
        indicator.classList.add('active')
      } else {
        indicator.classList.remove('active')
      }
    }
  }

  private tryEnterVehicle(): void {
    const playerPos = this.player.physics.getPosition()

    for (const vehicle of this.vehicles) {
      const vehiclePos = vehicle.getPosition()
      const distance = playerPos.distanceTo(vehiclePos)

      if (distance < 5) {
        this.enterVehicle(vehicle)
        break
      }
    }
  }

  private enterVehicle(vehicle: Vehicle): void {
    this.currentVehicle = vehicle
    this.gameMode = GameMode.InVehicle
    this.player.enterVehicle()

    // Create vehicle controller
    this.vehicleController = new VehicleController(
      vehicle,
      this.camera,
      this.inputManager
    )

    // Transfer camera yaw to vehicle controller
    const vehicleRotation = new THREE.Euler().setFromQuaternion(vehicle.mesh.quaternion)
    this.vehicleController.setYaw(vehicleRotation.y + Math.PI)

    // Hide vehicle indicator
    const indicator = document.getElementById('vehicle-indicator')
    if (indicator) {
      indicator.classList.remove('active')
    }
  }

  private exitVehicle(): void {
    if (!this.currentVehicle) return

    // Check if vehicle is slow enough to exit
    if (this.currentVehicle.getSpeed() > 20) {
      return // Can't exit while moving fast
    }

    const exitPosition = this.currentVehicle.getExitPosition()
    this.player.exitVehicle(exitPosition)

    // Transfer camera orientation back to player
    if (this.vehicleController) {
      this.playerController.setYaw(this.vehicleController.getYaw() - Math.PI)
    }

    this.gameMode = GameMode.OnFoot
    this.currentVehicle = null
    this.vehicleController = null
  }

  private updateUI(): void {
    // Update speed
    let speed = 0
    if (this.gameMode === GameMode.InVehicle && this.currentVehicle) {
      speed = Math.round(this.currentVehicle.getSpeed())
    }
    this.ui.updateSpeed(speed)

    // Update minimap
    const position = this.gameMode === GameMode.InVehicle && this.currentVehicle
      ? this.currentVehicle.getPosition()
      : this.player.physics.getPosition()

    const rotation = this.gameMode === GameMode.InVehicle && this.currentVehicle
      ? new THREE.Euler().setFromQuaternion(this.currentVehicle.mesh.quaternion).y
      : this.player.mesh.rotation.y

    this.ui.updateMinimap(
      position,
      rotation,
      this.vehicles.map(v => v.getPosition()),
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
