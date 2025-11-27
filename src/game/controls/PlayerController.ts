import * as THREE from 'three'
import { Player } from '../entities/Player'
import { InputManager } from './InputManager'

export class PlayerController {
  private player: Player
  private input: InputManager
  private camera: THREE.PerspectiveCamera

  // Camera settings
  private cameraDistance = 8
  private cameraHeight = 4
  private cameraLookHeight = 1.5
  private cameraSensitivity = 0.002

  // Camera rotation
  private yaw = 0
  private pitch = 0.3
  private minPitch = -0.5
  private maxPitch = 1.2

  // Auto-follow camera
  private autoFollowSpeed = 0.06
  private manualControlActive = false
  private manualControlTimer: number | null = null
  private lastMovementYaw = 0

  // Movement direction
  private moveDirection = new THREE.Vector3()

  // Reusable vectors to avoid GC
  private targetCameraPos = new THREE.Vector3()
  private lookTarget = new THREE.Vector3()
  private rotatedDirection = new THREE.Vector3()

  constructor(player: Player, camera: THREE.PerspectiveCamera, input: InputManager) {
    this.player = player
    this.camera = camera
    this.input = input
  }

  update(): void {
    if (this.player.isInVehicle) return

    this.handleCameraRotation()
    this.handleMovement()
    this.handleJump()
    this.updateCameraPosition()
  }

  private handleCameraRotation(): void {
    const state = this.input.getState()

    // Manual camera control (works with or without pointer lock)
    if (Math.abs(state.mouseDeltaX) > 0 || Math.abs(state.mouseDeltaY) > 0) {
      // Inverted for natural trackpad/mouse feel (same as vehicle)
      this.yaw -= state.mouseDeltaX * this.cameraSensitivity
      this.pitch -= state.mouseDeltaY * this.cameraSensitivity
      this.manualControlActive = true

      // Reset manual control flag after short delay
      if (this.manualControlTimer) {
        clearTimeout(this.manualControlTimer)
      }
      this.manualControlTimer = window.setTimeout(() => {
        this.manualControlActive = false
      }, 800)
    }

    // Clamp pitch
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch))

    this.input.resetMouseDelta()
  }

  private handleMovement(): void {
    const state = this.input.getState()
    this.moveDirection.set(0, 0, 0)

    if (state.forward) this.moveDirection.z -= 1
    if (state.backward) this.moveDirection.z += 1
    if (state.left) this.moveDirection.x -= 1
    if (state.right) this.moveDirection.x += 1

    if (this.moveDirection.lengthSq() > 0) {
      this.moveDirection.normalize()

      // Rotate movement direction based on camera yaw
      this.rotatedDirection.set(
        this.moveDirection.x * Math.cos(this.yaw) - this.moveDirection.z * Math.sin(this.yaw),
        0,
        this.moveDirection.x * Math.sin(this.yaw) + this.moveDirection.z * Math.cos(this.yaw)
      )

      this.player.physics.move(this.rotatedDirection, state.sprint)

      // Rotate player mesh to face movement direction
      const targetRotation = Math.atan2(this.rotatedDirection.x, this.rotatedDirection.z)
      this.player.setRotation(targetRotation)

      // Store movement direction for auto-follow
      this.lastMovementYaw = targetRotation + Math.PI

      // GTA-style auto-follow: gentle, only when not manually controlling
      if (!this.manualControlActive) {
        let deltaYaw = this.lastMovementYaw - this.yaw

        // Normalize delta to -PI to PI range
        while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2
        while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2

        // Very gentle follow (GTA style)
        this.yaw += deltaYaw * 0.02
      }
    } else {
      this.player.physics.stop()
    }
  }

  private handleJump(): void {
    const state = this.input.getState()
    if (state.jump) {
      this.player.physics.jump()
    }
  }

  private updateCameraPosition(): void {
    const playerPos = this.player.physics.getPosition()

    // Calculate camera position based on spherical coordinates
    const horizontalDistance = this.cameraDistance * Math.cos(this.pitch)
    const verticalDistance = this.cameraDistance * Math.sin(this.pitch)

    this.targetCameraPos.set(
      playerPos.x + horizontalDistance * Math.sin(this.yaw),
      playerPos.y + this.cameraHeight + verticalDistance,
      playerPos.z + horizontalDistance * Math.cos(this.yaw)
    )

    // Smoothly interpolate camera position
    this.camera.position.lerp(this.targetCameraPos, 0.1)

    // Camera looks at player
    this.lookTarget.set(
      playerPos.x,
      playerPos.y + this.cameraLookHeight,
      playerPos.z
    )
    this.camera.lookAt(this.lookTarget)
  }

  getYaw(): number {
    return this.yaw
  }

  setYaw(yaw: number): void {
    this.yaw = yaw
  }
}
