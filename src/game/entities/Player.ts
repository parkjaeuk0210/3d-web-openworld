import * as THREE from 'three'
import { CharacterPhysics } from '../physics/CharacterPhysics'
import { PhysicsWorld } from '../physics/PhysicsWorld'

export class Player {
  public mesh: THREE.Group
  public physics: CharacterPhysics
  public isInVehicle = false

  private bodyMesh: THREE.Mesh
  private headMesh: THREE.Mesh

  constructor(physicsWorld: PhysicsWorld) {
    this.physics = new CharacterPhysics(physicsWorld)
    this.createMesh()
  }

  private createMesh(): void {
    this.mesh = new THREE.Group()

    // Body (torso)
    const bodyGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.3)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2244aa,
      roughness: 0.8
    })
    this.bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
    this.bodyMesh.position.y = 0.1
    this.bodyMesh.castShadow = true
    this.mesh.add(this.bodyMesh)

    // Head
    const headGeometry = new THREE.SphereGeometry(0.2, 16, 16)
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc99,
      roughness: 0.6
    })
    this.headMesh = new THREE.Mesh(headGeometry, headMaterial)
    this.headMesh.position.y = 0.7
    this.headMesh.castShadow = true
    this.mesh.add(this.headMesh)

    // Legs
    const legGeometry = new THREE.BoxGeometry(0.18, 0.6, 0.2)
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x333366,
      roughness: 0.8
    })

    const leftLeg = new THREE.Mesh(legGeometry, legMaterial)
    leftLeg.position.set(-0.12, -0.6, 0)
    leftLeg.castShadow = true
    this.mesh.add(leftLeg)

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial)
    rightLeg.position.set(0.12, -0.6, 0)
    rightLeg.castShadow = true
    this.mesh.add(rightLeg)

    // Arms
    const armGeometry = new THREE.BoxGeometry(0.15, 0.5, 0.15)
    const armMaterial = new THREE.MeshStandardMaterial({
      color: 0x2244aa,
      roughness: 0.8
    })

    const leftArm = new THREE.Mesh(armGeometry, armMaterial)
    leftArm.position.set(-0.35, 0.15, 0)
    leftArm.castShadow = true
    this.mesh.add(leftArm)

    const rightArm = new THREE.Mesh(armGeometry, armMaterial)
    rightArm.position.set(0.35, 0.15, 0)
    rightArm.castShadow = true
    this.mesh.add(rightArm)
  }

  update(): void {
    if (!this.isInVehicle) {
      this.physics.update()
      const position = this.physics.getPosition()
      this.mesh.position.copy(position)
    }
  }

  setRotation(yRotation: number): void {
    this.mesh.rotation.y = yRotation
  }

  show(): void {
    this.mesh.visible = true
  }

  hide(): void {
    this.mesh.visible = false
  }

  enterVehicle(): void {
    this.isInVehicle = true
    this.hide()
  }

  exitVehicle(position: THREE.Vector3): void {
    this.isInVehicle = false
    this.physics.setPosition(position.x, position.y + 1, position.z)
    this.show()
  }
}
