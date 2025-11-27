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

  // Movement direction
  private moveDirection = new THREE.Vector3()

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
    if (!this.input.getPointerLocked()) return

    this.yaw += state.mouseDeltaX * this.cameraSensitivity
    this.pitch += state.mouseDeltaY * this.cameraSensitivity

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
      const rotatedDirection = new THREE.Vector3(
        this.moveDirection.x * Math.cos(this.yaw) - this.moveDirection.z * Math.sin(this.yaw),
        0,
        this.moveDirection.x * Math.sin(this.yaw) + this.moveDirection.z * Math.cos(this.yaw)
      )

      this.player.physics.move(rotatedDirection, state.sprint)

      // Rotate player mesh to face movement direction
      const targetRotation = Math.atan2(rotatedDirection.x, rotatedDirection.z)
      this.player.setRotation(targetRotation)
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

    const cameraX = playerPos.x + horizontalDistance * Math.sin(this.yaw)
    const cameraY = playerPos.y + this.cameraHeight + verticalDistance
    const cameraZ = playerPos.z + horizontalDistance * Math.cos(this.yaw)

    // Smoothly interpolate camera position
    this.camera.position.lerp(
      new THREE.Vector3(cameraX, cameraY, cameraZ),
      0.1
    )

    // Camera looks at player
    const lookTarget = new THREE.Vector3(
      playerPos.x,
      playerPos.y + this.cameraLookHeight,
      playerPos.z
    )
    this.camera.lookAt(lookTarget)
  }

  getYaw(): number {
    return this.yaw
  }

  setYaw(yaw: number): void {
    this.yaw = yaw
  }
}
