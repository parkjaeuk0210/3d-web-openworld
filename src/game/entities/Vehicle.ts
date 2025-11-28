import * as THREE from 'three'
import { VehiclePhysics, VehicleConfig, DEFAULT_VEHICLE_CONFIG } from '../physics/VehiclePhysics'
import { PhysicsWorld } from '../physics/PhysicsWorld'

export class Vehicle {
  public mesh: THREE.Group
  public physics: VehiclePhysics
  public wheelMeshes: THREE.Mesh[] = []

  private chassisMesh: THREE.Mesh
  private config: VehicleConfig

  // Lights
  private headlightLeft: THREE.SpotLight
  private headlightRight: THREE.SpotLight
  private taillightLeft: THREE.PointLight
  private taillightRight: THREE.PointLight
  public lightsOn = false  // Default OFF for battery saving

  // Reusable objects for update (avoid GC)
  private tempWheelPos = new THREE.Vector3()
  private tempWheelQuat = new THREE.Quaternion()

  constructor(physicsWorld: PhysicsWorld, config: Partial<VehicleConfig> = {}, color: number = 0xff3333) {
    this.config = { ...DEFAULT_VEHICLE_CONFIG, ...config }
    this.physics = new VehiclePhysics(physicsWorld, this.config)
    this.createMesh(color)
  }

  private createMesh(color: number): void {
    this.mesh = new THREE.Group()

    // Main chassis body
    const chassisGeometry = new THREE.BoxGeometry(
      this.config.chassisWidth,
      this.config.chassisHeight,
      this.config.chassisLength
    )
    const chassisMaterial = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.3,
      metalness: 0.8
    })
    this.chassisMesh = new THREE.Mesh(chassisGeometry, chassisMaterial)
    this.chassisMesh.castShadow = true
    this.chassisMesh.receiveShadow = true
    this.mesh.add(this.chassisMesh)

    // Cabin/roof
    const cabinGeometry = new THREE.BoxGeometry(
      this.config.chassisWidth * 0.9,
      this.config.chassisHeight * 0.8,
      this.config.chassisLength * 0.5
    )
    const cabinMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.3
    })
    const cabinMesh = new THREE.Mesh(cabinGeometry, cabinMaterial)
    cabinMesh.position.set(0, this.config.chassisHeight * 0.7, -this.config.chassisLength * 0.1)
    cabinMesh.castShadow = true
    this.mesh.add(cabinMesh)

    // Windows (transparent)
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.5,
      roughness: 0.1,
      metalness: 0.9
    })

    // Front windshield
    const windshieldGeometry = new THREE.PlaneGeometry(
      this.config.chassisWidth * 0.8,
      this.config.chassisHeight * 0.6
    )
    const windshield = new THREE.Mesh(windshieldGeometry, windowMaterial)
    windshield.position.set(0, this.config.chassisHeight * 0.7, this.config.chassisLength * 0.15)
    windshield.rotation.x = -Math.PI / 6
    this.mesh.add(windshield)

    // Rear windshield
    const rearWindshield = new THREE.Mesh(windshieldGeometry, windowMaterial)
    rearWindshield.position.set(0, this.config.chassisHeight * 0.7, -this.config.chassisLength * 0.35)
    rearWindshield.rotation.x = Math.PI / 6
    rearWindshield.rotation.y = Math.PI
    this.mesh.add(rearWindshield)

    // Headlights
    const headlightGeometry = new THREE.CircleGeometry(0.15, 16)
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      emissive: 0xffffcc,
      emissiveIntensity: 0.5
    })

    const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial)
    leftHeadlight.position.set(-0.5, 0, this.config.chassisLength / 2 + 0.01)
    this.mesh.add(leftHeadlight)

    const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial)
    rightHeadlight.position.set(0.5, 0, this.config.chassisLength / 2 + 0.01)
    this.mesh.add(rightHeadlight)

    // Tail lights
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.3
    })

    const leftTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial)
    leftTaillight.position.set(-0.5, 0, -this.config.chassisLength / 2 - 0.01)
    leftTaillight.rotation.y = Math.PI
    this.mesh.add(leftTaillight)

    const rightTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial)
    rightTaillight.position.set(0.5, 0, -this.config.chassisLength / 2 - 0.01)
    rightTaillight.rotation.y = Math.PI
    this.mesh.add(rightTaillight)

    // Create actual lights
    this.createLights()

    // Create wheels
    this.createWheels()
  }

  private createLights(): void {
    const frontZ = this.config.chassisLength / 2
    const rearZ = -this.config.chassisLength / 2

    // Headlights - SpotLights pointing forward
    this.headlightLeft = new THREE.SpotLight(0xffffee, 3, 40, Math.PI / 6, 0.3, 1)
    this.headlightLeft.position.set(-0.5, 0.1, frontZ)
    this.mesh.add(this.headlightLeft)

    const targetLeft = new THREE.Object3D()
    targetLeft.position.set(-0.5, -0.5, frontZ + 15)
    this.mesh.add(targetLeft)
    this.headlightLeft.target = targetLeft

    this.headlightRight = new THREE.SpotLight(0xffffee, 3, 40, Math.PI / 6, 0.3, 1)
    this.headlightRight.position.set(0.5, 0.1, frontZ)
    this.mesh.add(this.headlightRight)

    const targetRight = new THREE.Object3D()
    targetRight.position.set(0.5, -0.5, frontZ + 15)
    this.mesh.add(targetRight)
    this.headlightRight.target = targetRight

    // Taillights - PointLights for red glow
    this.taillightLeft = new THREE.PointLight(0xff0000, 1, 8, 2)
    this.taillightLeft.position.set(-0.5, 0.1, rearZ - 0.1)
    this.mesh.add(this.taillightLeft)

    this.taillightRight = new THREE.PointLight(0xff0000, 1, 8, 2)
    this.taillightRight.position.set(0.5, 0.1, rearZ - 0.1)
    this.mesh.add(this.taillightRight)

    // Start with lights OFF
    this.setLights(false)
  }

  private createWheels(): void {
    const wheelGeometry = new THREE.CylinderGeometry(
      this.config.wheelRadius,
      this.config.wheelRadius,
      this.config.wheelWidth,
      24
    )
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9
    })

    // Hub cap geometry
    const hubGeometry = new THREE.CircleGeometry(this.config.wheelRadius * 0.6, 16)
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.3
    })

    for (let i = 0; i < 4; i++) {
      const wheelGroup = new THREE.Group()

      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.castShadow = true
      wheelGroup.add(wheel)

      // Add hub caps on both sides
      const hubLeft = new THREE.Mesh(hubGeometry, hubMaterial)
      hubLeft.position.x = -this.config.wheelWidth / 2 - 0.01
      hubLeft.rotation.y = Math.PI / 2
      wheelGroup.add(hubLeft)

      const hubRight = new THREE.Mesh(hubGeometry, hubMaterial)
      hubRight.position.x = this.config.wheelWidth / 2 + 0.01
      hubRight.rotation.y = -Math.PI / 2
      wheelGroup.add(hubRight)

      this.wheelMeshes.push(wheelGroup as unknown as THREE.Mesh)
    }
  }

  update(): void {
    this.physics.update()

    // Update chassis position and rotation with smoothing to reduce jitter
    const position = this.physics.getPosition()
    const rotation = this.physics.getRotation()

    // Smooth interpolation for chassis
    this.mesh.position.lerp(position, 0.3)
    this.mesh.quaternion.slerp(rotation, 0.3)

    // Update wheel positions with smoothing (reuse temp objects)
    for (let i = 0; i < 4; i++) {
      const wheelBody = this.physics.wheelBodies[i]
      this.tempWheelPos.set(
        wheelBody.position.x,
        wheelBody.position.y,
        wheelBody.position.z
      )
      this.tempWheelQuat.set(
        wheelBody.quaternion.x,
        wheelBody.quaternion.y,
        wheelBody.quaternion.z,
        wheelBody.quaternion.w
      )
      this.wheelMeshes[i].position.lerp(this.tempWheelPos, 0.3)
      this.wheelMeshes[i].quaternion.slerp(this.tempWheelQuat, 0.3)
    }
  }

  getSpeed(): number {
    return this.physics.getSpeedKmh()
  }

  getPosition(): THREE.Vector3 {
    return this.physics.getPosition()
  }

  getForwardDirection(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, 1)
    forward.applyQuaternion(this.mesh.quaternion)
    return forward
  }

  getExitPosition(): THREE.Vector3 {
    // Calculate position to the left of the vehicle
    const leftDir = new THREE.Vector3(-1, 0, 0)
    leftDir.applyQuaternion(this.mesh.quaternion)

    const exitPos = this.getPosition().clone()
    exitPos.add(leftDir.multiplyScalar(2))
    exitPos.y += 0.5

    return exitPos
  }

  reset(): void {
    this.physics.reset()
  }

  toggleLights(): void {
    this.lightsOn = !this.lightsOn
    this.headlightLeft.visible = this.lightsOn
    this.headlightRight.visible = this.lightsOn
    this.taillightLeft.visible = this.lightsOn
    this.taillightRight.visible = this.lightsOn
  }

  setLights(on: boolean): void {
    this.lightsOn = on
    this.headlightLeft.visible = on
    this.headlightRight.visible = on
    this.taillightLeft.visible = on
    this.taillightRight.visible = on
  }

  flipReset(): void {
    // Get current position and reset slightly above
    const pos = this.physics.getPosition()
    this.physics.chassisBody.position.set(pos.x, pos.y + 2, pos.z)

    // Reset rotation to upright
    this.physics.chassisBody.quaternion.setFromEuler(0, 0, 0)

    // Stop all movement
    this.physics.chassisBody.velocity.setZero()
    this.physics.chassisBody.angularVelocity.setZero()
  }
}
