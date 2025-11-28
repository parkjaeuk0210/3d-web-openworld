import * as THREE from 'three'
import { Vehicle } from '../entities/Vehicle'
import { InputManager } from './InputManager'

export class VehicleController {
  private vehicle: Vehicle
  private input: InputManager
  private camera: THREE.PerspectiveCamera

  // Camera settings
  private cameraDistance = 12
  private cameraHeight = 5
  private cameraLookHeight = 1
  private cameraSensitivity = 0.002

  // Camera rotation
  private yaw = Math.PI // Start looking from behind
  private pitch = 0.3
  private minPitch = -0.2
  private maxPitch = 0.8

  // Auto-follow camera - always on, manual input temporarily slows it
  private autoFollowSpeed = 0.08
  private manualControlActive = false
  private manualControlTimer: number | null = null

  // Reusable vectors to avoid GC
  private targetCameraPos = new THREE.Vector3()
  private lookTarget = new THREE.Vector3()

  // Smoothed vehicle position (reduces jitter from physics)
  private smoothedVehiclePos = new THREE.Vector3()
  private isFirstUpdate = true

  constructor(vehicle: Vehicle, camera: THREE.PerspectiveCamera, input: InputManager) {
    this.vehicle = vehicle
    this.camera = camera
    this.input = input
  }

  update(): void {
    this.handleInput()
    this.handleCameraRotation()
    this.updateCameraPosition()
  }

  private handleInput(): void {
    const state = this.input.getState()

    // Reset controls each frame
    this.vehicle.physics.resetControls()

    // Acceleration
    if (state.forward) {
      this.vehicle.physics.accelerate()
    }

    // Braking/Reverse
    if (state.backward) {
      const forwardSpeed = this.vehicle.physics.getForwardSpeed()
      // If moving forward fast, brake. Otherwise reverse.
      if (forwardSpeed > 5) {
        this.vehicle.physics.brake()
      } else {
        this.vehicle.physics.reverse()
      }
    }

    // Steering
    if (state.left) {
      this.vehicle.physics.steerLeft()
    } else if (state.right) {
      this.vehicle.physics.steerRight()
    } else {
      this.vehicle.physics.resetSteering()
    }

    // Handbrake (sprint key)
    if (state.sprint) {
      this.vehicle.physics.brake(200)
    }
  }

  private handleCameraRotation(): void {
    const state = this.input.getState()
    const speed = this.vehicle.getSpeed()

    // Manual camera control with mouse/touch
    if (Math.abs(state.mouseDeltaX) > 0 || Math.abs(state.mouseDeltaY) > 0) {
      this.yaw -= state.mouseDeltaX * this.cameraSensitivity
      this.pitch += state.mouseDeltaY * this.cameraSensitivity
      this.manualControlActive = true

      // Reset manual control flag after delay (longer = more manual control time)
      if (this.manualControlTimer) {
        clearTimeout(this.manualControlTimer)
      }
      this.manualControlTimer = window.setTimeout(() => {
        this.manualControlActive = false
      }, 2000)
    }

    // Clamp pitch
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch))

    this.input.resetMouseDelta()

    // Keep yaw normalized to prevent overflow
    while (this.yaw > Math.PI) this.yaw -= Math.PI * 2
    while (this.yaw < -Math.PI) this.yaw += Math.PI * 2

    // GTA-style auto-follow: only when NOT manually controlling AND moving
    if (!this.manualControlActive && speed > 5) {
      // Use actual forward direction vector instead of Euler angles
      const forward = this.vehicle.getForwardDirection()
      let targetYaw = Math.atan2(-forward.x, -forward.z) // Camera behind vehicle

      // Calculate yaw difference (shortest path)
      let deltaYaw = targetYaw - this.yaw

      // Normalize delta to -PI to PI range (always take shortest rotation)
      if (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2
      if (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2

      // Gentle follow - GTA style (very gradual)
      const followSpeed = 0.02 + Math.min(0.03, speed * 0.0005)
      this.yaw += deltaYaw * followSpeed
    }
  }

  private updateCameraPosition(): void {
    const vehiclePos = this.vehicle.getPosition()
    const speed = this.vehicle.getSpeed()

    // Smooth the vehicle position to reduce physics jitter
    if (this.isFirstUpdate) {
      this.smoothedVehiclePos.copy(vehiclePos)
      this.isFirstUpdate = false
    } else {
      // Heavily smooth position - higher value = more responsive but more jitter
      // Lower value = smoother but more lag
      const positionSmoothing = 0.15
      this.smoothedVehiclePos.lerp(vehiclePos, positionSmoothing)
    }

    // Calculate camera position using smoothed vehicle position
    const horizontalDistance = this.cameraDistance * Math.cos(this.pitch)
    const verticalDistance = this.cameraDistance * Math.sin(this.pitch)

    this.targetCameraPos.set(
      this.smoothedVehiclePos.x + horizontalDistance * Math.sin(this.yaw),
      this.smoothedVehiclePos.y + this.cameraHeight + verticalDistance,
      this.smoothedVehiclePos.z + horizontalDistance * Math.cos(this.yaw)
    )

    // Speed-based lerp: faster movement = faster camera follow
    const baseLerp = 0.08
    const speedLerp = Math.min(0.2, baseLerp + speed * 0.001)

    // Smoothly interpolate camera position
    this.camera.position.lerp(this.targetCameraPos, speedLerp)

    // Camera looks at smoothed vehicle position
    this.lookTarget.set(
      this.smoothedVehiclePos.x,
      this.smoothedVehiclePos.y + this.cameraLookHeight,
      this.smoothedVehiclePos.z
    )
    this.camera.lookAt(this.lookTarget)
  }

  getYaw(): number {
    return this.yaw
  }

  setYaw(yaw: number): void {
    this.yaw = yaw
  }

  // Initialize camera to face vehicle direction immediately
  alignToVehicle(): void {
    const forward = this.vehicle.getForwardDirection()
    this.yaw = Math.atan2(-forward.x, -forward.z)
  }
}
