import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { PhysicsWorld } from './PhysicsWorld'

export interface CharacterConfig {
  height: number
  radius: number
  mass: number
  moveSpeed: number
  sprintMultiplier: number
  jumpForce: number
}

export const DEFAULT_CHARACTER_CONFIG: CharacterConfig = {
  height: 1.8,
  radius: 0.4,
  mass: 80,
  moveSpeed: 10,
  sprintMultiplier: 1.8,
  jumpForce: 10
}

export class CharacterPhysics {
  public body: CANNON.Body
  private config: CharacterConfig
  private physicsWorld: PhysicsWorld

  // State
  private isOnGround = false
  private groundCheckRayLength = 0.1

  constructor(physicsWorld: PhysicsWorld, config: Partial<CharacterConfig> = {}) {
    this.physicsWorld = physicsWorld
    this.config = { ...DEFAULT_CHARACTER_CONFIG, ...config }
    this.createBody()
  }

  private createBody(): void {
    // Use a capsule shape (cylinder + two spheres)
    const cylinderHeight = this.config.height - this.config.radius * 2
    const cylinderShape = new CANNON.Cylinder(
      this.config.radius,
      this.config.radius,
      cylinderHeight,
      12
    )

    const sphereShape = new CANNON.Sphere(this.config.radius)

    this.body = new CANNON.Body({
      mass: this.config.mass,
      fixedRotation: true, // Prevent character from rotating
      linearDamping: 0.1,
      angularDamping: 1
    })

    // Add shapes to form capsule
    this.body.addShape(cylinderShape, new CANNON.Vec3(0, 0, 0))
    this.body.addShape(sphereShape, new CANNON.Vec3(0, cylinderHeight / 2, 0))
    this.body.addShape(sphereShape, new CANNON.Vec3(0, -cylinderHeight / 2, 0))

    this.body.position.set(5, 3, 0)

    this.physicsWorld.addBody(this.body)
  }

  move(direction: THREE.Vector3, isSprinting: boolean): void {
    const speed = isSprinting
      ? this.config.moveSpeed * this.config.sprintMultiplier
      : this.config.moveSpeed

    // Set horizontal velocity while preserving vertical velocity
    this.body.velocity.x = direction.x * speed
    this.body.velocity.z = direction.z * speed
  }

  jump(): void {
    if (this.checkGround()) {
      this.body.velocity.y = this.config.jumpForce
    }
  }

  private checkGround(): boolean {
    const from = new CANNON.Vec3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    )
    const to = new CANNON.Vec3(
      this.body.position.x,
      this.body.position.y - (this.config.height / 2 + this.groundCheckRayLength),
      this.body.position.z
    )

    const result = new CANNON.RaycastResult()
    this.physicsWorld.world.raycastClosest(from, to, {
      collisionFilterMask: ~0,
      skipBackfaces: true
    }, result)

    this.isOnGround = result.hasHit
    return this.isOnGround
  }

  update(): void {
    this.checkGround()
  }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    )
  }

  setPosition(x: number, y: number, z: number): void {
    this.body.position.set(x, y, z)
    this.body.velocity.setZero()
  }

  getIsOnGround(): boolean {
    return this.isOnGround
  }

  stop(): void {
    this.body.velocity.x = 0
    this.body.velocity.z = 0
  }
}
