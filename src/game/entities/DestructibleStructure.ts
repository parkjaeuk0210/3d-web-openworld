import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { PhysicsWorld } from '../physics/PhysicsWorld'

interface BoxData {
  mesh: THREE.Mesh
  body: CANNON.Body
}

export class DestructibleStructure {
  private physicsWorld: PhysicsWorld
  private boxes: BoxData[] = []

  // Box settings
  private boxSize = 1.5
  private boxMass = 2

  // Structure position
  private position: THREE.Vector3

  constructor(physicsWorld: PhysicsWorld, position: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    this.physicsWorld = physicsWorld
    this.position = position
    this.createStructure()
  }

  private createStructure(): void {
    // Create a pyramid of boxes
    const layers = 5
    const baseWidth = 5

    for (let layer = 0; layer < layers; layer++) {
      const boxesInLayer = baseWidth - layer
      const offsetX = (boxesInLayer - 1) * this.boxSize / 2
      const offsetZ = (boxesInLayer - 1) * this.boxSize / 2
      const y = layer * this.boxSize + this.boxSize / 2

      for (let i = 0; i < boxesInLayer; i++) {
        for (let j = 0; j < boxesInLayer; j++) {
          const x = this.position.x + i * this.boxSize - offsetX
          const z = this.position.z + j * this.boxSize - offsetZ

          this.createBox(x, y, z)
        }
      }
    }
  }

  private createBox(x: number, y: number, z: number): void {
    // Random color for variety
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0x6c5ce7, 0xa29bfe]
    const color = colors[Math.floor(Math.random() * colors.length)]

    // Three.js mesh
    const geometry = new THREE.BoxGeometry(this.boxSize, this.boxSize, this.boxSize)
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.1
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.set(x, y, z)

    // Cannon.js body
    const shape = new CANNON.Box(new CANNON.Vec3(
      this.boxSize / 2,
      this.boxSize / 2,
      this.boxSize / 2
    ))
    const body = new CANNON.Body({
      mass: this.boxMass,
      shape,
      position: new CANNON.Vec3(x, y, z),
      linearDamping: 0.01,
      angularDamping: 0.1
    })

    // Allow sleeping for performance
    body.allowSleep = true
    body.sleepSpeedLimit = 0.5
    body.sleepTimeLimit = 1

    this.physicsWorld.addBody(body)

    this.boxes.push({ mesh, body })
  }

  addToScene(scene: THREE.Scene): void {
    for (const box of this.boxes) {
      scene.add(box.mesh)
    }
  }

  removeFromScene(scene: THREE.Scene): void {
    for (const box of this.boxes) {
      scene.remove(box.mesh)
      this.physicsWorld.removeBody(box.body)
    }
  }

  update(): void {
    // Sync mesh positions with physics bodies
    for (const box of this.boxes) {
      box.mesh.position.copy(box.body.position as unknown as THREE.Vector3)
      box.mesh.quaternion.copy(box.body.quaternion as unknown as THREE.Quaternion)
    }
  }

  getBoxes(): BoxData[] {
    return this.boxes
  }

  // Reset structure to original position
  reset(): void {
    // Remove all boxes
    for (const box of this.boxes) {
      this.physicsWorld.removeBody(box.body)
    }
    this.boxes = []

    // Recreate structure
    this.createStructure()
  }
}
