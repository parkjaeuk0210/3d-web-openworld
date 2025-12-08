import * as THREE from 'three'

/**
 * RemoteVehicle - Visual representation of another player's vehicle
 * No physics, just visual interpolation
 */
export class RemoteVehicle {
    public mesh: THREE.Group
    public wheelMeshes: THREE.Mesh[] = []
    private chassisMesh: THREE.Mesh
    private headlightLeft: THREE.SpotLight
    private headlightRight: THREE.SpotLight
    private taillightLeft: THREE.PointLight
    private taillightRight: THREE.PointLight
    private lightsOn = false
    public playerId: string
    public playerName: string

    // Current state for interpolation
    public currentPosition = new THREE.Vector3()
    public currentQuaternion = new THREE.Quaternion()
    public currentVelocity = new THREE.Vector3()
    public currentSteering = 0

    // Nameplate
    private nameSprite: THREE.Sprite

    constructor(playerId: string, playerName: string, color: number = 0x33ff33) {
        this.playerId = playerId
        this.playerName = playerName
        this.mesh = new THREE.Group()

        this.chassisMesh = this.createChassis(color)
        this.mesh.add(this.chassisMesh)

        this.createWheels()
        const lights = this.createLights()
        this.headlightLeft = lights.headlightLeft
        this.headlightRight = lights.headlightRight
        this.taillightLeft = lights.taillightLeft
        this.taillightRight = lights.taillightRight

        this.nameSprite = this.createNameplate(playerName)
        this.mesh.add(this.nameSprite)
    }

    private createChassis(color: number): THREE.Mesh {
        const group = new THREE.Group()

        // Main body
        const bodyGeom = new THREE.BoxGeometry(2.2, 0.7, 4.5)
        const bodyMat = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.8,
            roughness: 0.2
        })
        const body = new THREE.Mesh(bodyGeom, bodyMat)
        body.position.y = 0.5
        body.castShadow = true
        group.add(body)

        // Roof/cabin
        const cabinGeom = new THREE.BoxGeometry(1.8, 0.6, 2)
        const cabinMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.5,
            roughness: 0.3
        })
        const cabin = new THREE.Mesh(cabinGeom, cabinMat)
        cabin.position.set(0, 1.0, -0.3)
        cabin.castShadow = true
        group.add(cabin)

        // Windshield
        const windshieldGeom = new THREE.BoxGeometry(1.7, 0.5, 0.1)
        const windshieldMat = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.6
        })
        const windshield = new THREE.Mesh(windshieldGeom, windshieldMat)
        windshield.position.set(0, 0.95, 0.75)
        windshield.rotation.x = -0.3
        group.add(windshield)

        return group as unknown as THREE.Mesh
    }

    private createWheels(): void {
        const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16)
        const wheelMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.3,
            roughness: 0.8
        })

        const positions = [
            { x: 1.0, y: 0.4, z: 1.3 },  // Front right
            { x: -1.0, y: 0.4, z: 1.3 }, // Front left
            { x: 1.0, y: 0.4, z: -1.3 }, // Rear right
            { x: -1.0, y: 0.4, z: -1.3 } // Rear left
        ]

        positions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeom.clone(), wheelMat.clone())
            wheel.position.set(pos.x, pos.y, pos.z)
            wheel.rotation.z = Math.PI / 2
            wheel.castShadow = true
            this.mesh.add(wheel)
            this.wheelMeshes.push(wheel)
        })
    }

    private createLights(): {
        headlightLeft: THREE.SpotLight
        headlightRight: THREE.SpotLight
        taillightLeft: THREE.PointLight
        taillightRight: THREE.PointLight
    } {
        // Headlights
        const headlightLeft = new THREE.SpotLight(0xffffee, 0, 30, Math.PI / 6, 0.5)
        headlightLeft.position.set(-0.7, 0.5, 2.3)
        this.mesh.add(headlightLeft)
        this.mesh.add(headlightLeft.target)
        headlightLeft.target.position.set(-0.7, 0, 20)

        const headlightRight = new THREE.SpotLight(0xffffee, 0, 30, Math.PI / 6, 0.5)
        headlightRight.position.set(0.7, 0.5, 2.3)
        this.mesh.add(headlightRight)
        this.mesh.add(headlightRight.target)
        headlightRight.target.position.set(0.7, 0, 20)

        // Taillights
        const taillightLeft = new THREE.PointLight(0xff0000, 0, 5)
        taillightLeft.position.set(-0.8, 0.5, -2.3)
        this.mesh.add(taillightLeft)

        const taillightRight = new THREE.PointLight(0xff0000, 0, 5)
        taillightRight.position.set(0.8, 0.5, -2.3)
        this.mesh.add(taillightRight)

        return { headlightLeft, headlightRight, taillightLeft, taillightRight }
    }

    private createNameplate(name: string): THREE.Sprite {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')!
        canvas.width = 256
        canvas.height = 64

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.roundRect(0, 0, 256, 64, 8)
        ctx.fill()

        ctx.font = 'bold 32px Arial'
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(name.substring(0, 12), 128, 32)

        const texture = new THREE.CanvasTexture(canvas)
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        })

        const sprite = new THREE.Sprite(material)
        sprite.position.set(0, 2.5, 0)
        sprite.scale.set(3, 0.75, 1)

        return sprite
    }

    /**
     * Update vehicle visual state from interpolated data
     */
    update(
        position: THREE.Vector3,
        quaternion: THREE.Quaternion,
        velocity: THREE.Vector3,
        steering: number,
        lightsOn: boolean
    ): void {
        // Smooth position update
        this.currentPosition.lerp(position, 0.3)
        this.currentQuaternion.slerp(quaternion, 0.3)
        this.currentVelocity.copy(velocity)
        this.currentSteering = steering

        // Apply to mesh
        this.mesh.position.copy(this.currentPosition)
        this.mesh.quaternion.copy(this.currentQuaternion)

        // Update wheel rotation based on velocity
        const speed = this.currentVelocity.length()
        const wheelRotation = speed * 0.1

        this.wheelMeshes.forEach((wheel, index) => {
            wheel.rotation.x += wheelRotation

            // Front wheel steering
            if (index < 2) {
                wheel.rotation.y = steering * 0.5
            }
        })

        // Update lights
        if (lightsOn !== this.lightsOn) {
            this.setLights(lightsOn)
        }
    }

    setLights(on: boolean): void {
        this.lightsOn = on
        const intensity = on ? 1 : 0

        this.headlightLeft.intensity = intensity * 2
        this.headlightRight.intensity = intensity * 2
        this.taillightLeft.intensity = intensity * 0.5
        this.taillightRight.intensity = intensity * 0.5
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose()
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose())
                } else {
                    child.material.dispose()
                }
            }
        })

        if (this.nameSprite.material.map) {
            this.nameSprite.material.map.dispose()
        }
        this.nameSprite.material.dispose()
    }
}
