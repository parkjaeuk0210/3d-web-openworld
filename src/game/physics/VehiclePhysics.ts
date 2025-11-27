import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { PhysicsWorld } from './PhysicsWorld'

export interface VehicleConfig {
  chassisWidth: number
  chassisHeight: number
  chassisLength: number
  chassisMass: number
  wheelRadius: number
  wheelWidth: number
  suspensionStiffness: number
  suspensionDamping: number
  suspensionCompression: number
  suspensionRestLength: number
  frictionSlip: number
  rollInfluence: number
  maxEngineForce: number
  maxBrakingForce: number
  maxSteeringAngle: number
}

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  chassisWidth: 1.8,
  chassisHeight: 0.6,
  chassisLength: 4.0,
  chassisMass: 800,
  wheelRadius: 0.4,
  wheelWidth: 0.3,
  suspensionStiffness: 30,
  suspensionDamping: 4.4,
  suspensionCompression: 4.4,
  suspensionRestLength: 0.3,
  frictionSlip: 5,
  rollInfluence: 0.01,
  maxEngineForce: 2000,
  maxBrakingForce: 100,
  maxSteeringAngle: Math.PI / 6
}

export class VehiclePhysics {
  public vehicle: CANNON.RaycastVehicle
  public chassisBody: CANNON.Body
  public wheelBodies: CANNON.Body[] = []

  private config: VehicleConfig
  private physicsWorld: PhysicsWorld

  // Control states
  private engineForce = 0
  private brakingForce = 0
  private steeringValue = 0
  private steeringIncrement = 0.04

  // Wheel indices
  private readonly FRONT_LEFT = 0
  private readonly FRONT_RIGHT = 1
  private readonly BACK_LEFT = 2
  private readonly BACK_RIGHT = 3

  constructor(physicsWorld: PhysicsWorld, config: Partial<VehicleConfig> = {}) {
    this.physicsWorld = physicsWorld
    this.config = { ...DEFAULT_VEHICLE_CONFIG, ...config }
    this.createVehicle()
  }

  private createVehicle(): void {
    // Create chassis body
    const chassisShape = new CANNON.Box(new CANNON.Vec3(
      this.config.chassisWidth / 2,
      this.config.chassisHeight / 2,
      this.config.chassisLength / 2
    ))

    this.chassisBody = new CANNON.Body({
      mass: this.config.chassisMass,
      material: this.physicsWorld.createVehicleMaterial()
    })
    this.chassisBody.addShape(chassisShape)
    this.chassisBody.position.set(0, 2, 0)
    this.chassisBody.angularDamping = 0.4

    // Create raycast vehicle
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2
    })

    // Wheel options
    const wheelOptions = {
      radius: this.config.wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: this.config.suspensionStiffness,
      suspensionRestLength: this.config.suspensionRestLength,
      frictionSlip: this.config.frictionSlip,
      dampingRelaxation: this.config.suspensionDamping,
      dampingCompression: this.config.suspensionCompression,
      maxSuspensionForce: 100000,
      rollInfluence: this.config.rollInfluence,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    }

    // Calculate wheel positions
    const wheelX = this.config.chassisWidth / 2 + 0.1
    const wheelY = 0
    const wheelZ = this.config.chassisLength / 2 - 0.5

    // Front left wheel
    wheelOptions.chassisConnectionPointLocal.set(-wheelX, wheelY, wheelZ)
    this.vehicle.addWheel(wheelOptions)

    // Front right wheel
    wheelOptions.chassisConnectionPointLocal.set(wheelX, wheelY, wheelZ)
    this.vehicle.addWheel(wheelOptions)

    // Back left wheel
    wheelOptions.chassisConnectionPointLocal.set(-wheelX, wheelY, -wheelZ)
    this.vehicle.addWheel(wheelOptions)

    // Back right wheel
    wheelOptions.chassisConnectionPointLocal.set(wheelX, wheelY, -wheelZ)
    this.vehicle.addWheel(wheelOptions)

    // Add vehicle to world
    this.vehicle.addToWorld(this.physicsWorld.world)

    // Create wheel bodies for visualization (optional physics bodies)
    const wheelShape = new CANNON.Cylinder(
      this.config.wheelRadius,
      this.config.wheelRadius,
      this.config.wheelWidth,
      20
    )

    for (let i = 0; i < 4; i++) {
      const wheelBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: 0
      })
      wheelBody.addShape(wheelShape, new CANNON.Vec3(), new CANNON.Quaternion().setFromEuler(0, 0, Math.PI / 2))
      this.wheelBodies.push(wheelBody)
      this.physicsWorld.addBody(wheelBody)
    }
  }

  // Control methods
  accelerate(force: number = this.config.maxEngineForce): void {
    this.engineForce = -force // Negative for forward in cannon-es
  }

  brake(force: number = this.config.maxBrakingForce): void {
    this.brakingForce = force
  }

  reverse(force: number = this.config.maxEngineForce * 0.5): void {
    this.engineForce = force // Positive for backward
  }

  steerLeft(): void {
    this.steeringValue = Math.min(
      this.steeringValue + this.steeringIncrement,
      this.config.maxSteeringAngle
    )
  }

  steerRight(): void {
    this.steeringValue = Math.max(
      this.steeringValue - this.steeringIncrement,
      -this.config.maxSteeringAngle
    )
  }

  resetSteering(): void {
    if (this.steeringValue > 0) {
      this.steeringValue = Math.max(0, this.steeringValue - this.steeringIncrement)
    } else if (this.steeringValue < 0) {
      this.steeringValue = Math.min(0, this.steeringValue + this.steeringIncrement)
    }
  }

  resetControls(): void {
    this.engineForce = 0
    this.brakingForce = 0
  }

  update(): void {
    // Apply steering to front wheels
    this.vehicle.setSteeringValue(this.steeringValue, this.FRONT_LEFT)
    this.vehicle.setSteeringValue(this.steeringValue, this.FRONT_RIGHT)

    // Apply engine force to rear wheels (rear-wheel drive)
    this.vehicle.applyEngineForce(this.engineForce, this.BACK_LEFT)
    this.vehicle.applyEngineForce(this.engineForce, this.BACK_RIGHT)

    // Apply braking force
    this.vehicle.setBrake(this.brakingForce, this.FRONT_LEFT)
    this.vehicle.setBrake(this.brakingForce, this.FRONT_RIGHT)
    this.vehicle.setBrake(this.brakingForce * 0.8, this.BACK_LEFT)
    this.vehicle.setBrake(this.brakingForce * 0.8, this.BACK_RIGHT)

    // Update wheel body positions
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i)
      const transform = this.vehicle.wheelInfos[i].worldTransform
      this.wheelBodies[i].position.copy(transform.position)
      this.wheelBodies[i].quaternion.copy(transform.quaternion)
    }
  }

  getSpeed(): number {
    const velocity = this.chassisBody.velocity
    return Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2) * 3.6 // m/s to km/h
  }

  getSpeedKmh(): number {
    return this.getSpeed()
  }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.chassisBody.position.x,
      this.chassisBody.position.y,
      this.chassisBody.position.z
    )
  }

  getRotation(): THREE.Quaternion {
    return new THREE.Quaternion(
      this.chassisBody.quaternion.x,
      this.chassisBody.quaternion.y,
      this.chassisBody.quaternion.z,
      this.chassisBody.quaternion.w
    )
  }

  setPosition(x: number, y: number, z: number): void {
    this.chassisBody.position.set(x, y, z)
    this.chassisBody.velocity.setZero()
    this.chassisBody.angularVelocity.setZero()
  }

  reset(): void {
    this.setPosition(0, 2, 0)
    this.chassisBody.quaternion.setFromEuler(0, 0, 0)
    this.steeringValue = 0
    this.engineForce = 0
    this.brakingForce = 0
  }
}
