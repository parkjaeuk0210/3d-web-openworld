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

  // Auto-follow camera
  private autoFollowSpeed = 0.15
  private isAutoFollow = true
  private manualControlTimer: number | null = null

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
      const speed = this.vehicle.physics.getSpeed()
      if (speed > 5) {
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

    // Manual camera control with mouse/touch (inverted for natural trackpad feel)
    if (Math.abs(state.mouseDeltaX) > 0 || Math.abs(state.mouseDeltaY) > 0) {
      this.yaw -= state.mouseDeltaX * this.cameraSensitivity
      this.pitch -= state.mouseDeltaY * this.cameraSensitivity
      this.isAutoFollow = false

      // Reset auto-follow after a delay
      if (this.manualControlTimer) {
        clearTimeout(this.manualControlTimer)
      }
      this.manualControlTimer = window.setTimeout(() => {
        this.isAutoFollow = true
      }, 1500)
    }

    // Clamp pitch
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch))

    this.input.resetMouseDelta()

    // Auto-follow: gradually return camera behind vehicle
    if (this.isAutoFollow) {
      const vehicleRotation = new THREE.Euler().setFromQuaternion(this.vehicle.mesh.quaternion)
      const targetYaw = vehicleRotation.y + Math.PI

      // Smoothly interpolate yaw towards target
      let deltaYaw = targetYaw - this.yaw

      // Normalize delta to -PI to PI range
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2

      // Smooth follow
      this.yaw += deltaYaw * this.autoFollowSpeed
    }
  }

  private updateCameraPosition(): void {
    const vehiclePos = this.vehicle.getPosition()

    // Calculate camera position
    const horizontalDistance = this.cameraDistance * Math.cos(this.pitch)
    const verticalDistance = this.cameraDistance * Math.sin(this.pitch)

    const cameraX = vehiclePos.x + horizontalDistance * Math.sin(this.yaw)
    const cameraY = vehiclePos.y + this.cameraHeight + verticalDistance
    const cameraZ = vehiclePos.z + horizontalDistance * Math.cos(this.yaw)

    // Smoothly interpolate camera position
    this.camera.position.lerp(
      new THREE.Vector3(cameraX, cameraY, cameraZ),
      0.08
    )

    // Camera looks at vehicle
    const lookTarget = new THREE.Vector3(
      vehiclePos.x,
      vehiclePos.y + this.cameraLookHeight,
      vehiclePos.z
    )
    this.camera.lookAt(lookTarget)
  }

  getYaw(): number {
    return this.yaw
  }

  setYaw(yaw: number): void {
    this.yaw = yaw
    this.isAutoFollow = true
  }
}
