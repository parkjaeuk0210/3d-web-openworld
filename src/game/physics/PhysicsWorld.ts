import * as CANNON from 'cannon-es'

export class PhysicsWorld {
  public world: CANNON.World
  private fixedTimeStep = 1 / 60
  private maxSubSteps = 10
  private isWarmedUp = false
  private warmupFrames = 0

  constructor() {
    this.world = new CANNON.World()
    this.world.gravity.set(0, -9.82, 0)
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.allowSleep = false // Disable sleep for vehicles

    // Set solver iterations for stability (higher = more stable but slower)
    ;(this.world.solver as CANNON.GSSolver).iterations = 20
    ;(this.world.solver as CANNON.GSSolver).tolerance = 0.001

    // Default contact material
    const defaultMaterial = new CANNON.Material('default')
    const defaultContactMaterial = new CANNON.ContactMaterial(
      defaultMaterial,
      defaultMaterial,
      {
        friction: 0.3,
        restitution: 0.2
      }
    )
    this.world.addContactMaterial(defaultContactMaterial)
    this.world.defaultContactMaterial = defaultContactMaterial
  }

  update(deltaTime: number): void {
    // Cap deltaTime to prevent physics explosion on first frames or after tab switch
    const cappedDelta = Math.min(deltaTime, 0.1)

    // Warmup: run multiple small steps initially to stabilize physics
    if (!this.isWarmedUp) {
      this.warmupFrames++
      if (this.warmupFrames < 10) {
        // Run multiple small steps to stabilize
        for (let i = 0; i < 3; i++) {
          this.world.step(this.fixedTimeStep, this.fixedTimeStep, 1)
        }
        return
      }
      this.isWarmedUp = true
    }

    this.world.step(this.fixedTimeStep, cappedDelta, this.maxSubSteps)
  }

  addBody(body: CANNON.Body): void {
    this.world.addBody(body)
  }

  removeBody(body: CANNON.Body): void {
    this.world.removeBody(body)
  }

  createGroundMaterial(): CANNON.Material {
    return new CANNON.Material('ground')
  }

  createVehicleMaterial(): CANNON.Material {
    return new CANNON.Material('vehicle')
  }

  setupVehicleGroundContact(vehicleMaterial: CANNON.Material, groundMaterial: CANNON.Material): void {
    const vehicleGroundContact = new CANNON.ContactMaterial(
      vehicleMaterial,
      groundMaterial,
      {
        friction: 0.5,
        restitution: 0.1
      }
    )
    this.world.addContactMaterial(vehicleGroundContact)
  }
}
