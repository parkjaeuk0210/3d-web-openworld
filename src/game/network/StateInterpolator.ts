import * as THREE from 'three'
import { VehicleState } from './types'

interface InterpolationState {
    previous: VehicleState | null
    target: VehicleState | null
    lastUpdateTime: number
}

/**
 * StateInterpolator - Smoothly interpolates between network updates
 * Uses client-side prediction and interpolation to hide network latency
 */
export class StateInterpolator {
    private states: Map<string, InterpolationState> = new Map()
    private interpolationDelay = 100 // ms - buffer for smooth playback

    // Reusable objects to avoid GC
    private tempPosition = new THREE.Vector3()
    private tempQuaternion = new THREE.Quaternion()
    private tempVelocity = new THREE.Vector3()

    /**
     * Update the target state for a player
     */
    updateState(playerId: string, newState: VehicleState): void {
        let interpolation = this.states.get(playerId)

        if (!interpolation) {
            interpolation = {
                previous: null,
                target: null,
                lastUpdateTime: 0
            }
            this.states.set(playerId, interpolation)
        }

        // Shift current target to previous
        interpolation.previous = interpolation.target
        interpolation.target = { ...newState }
        interpolation.lastUpdateTime = Date.now()
    }

    /**
     * Get the interpolated state for a player
     */
    getInterpolatedState(playerId: string): {
        position: THREE.Vector3
        quaternion: THREE.Quaternion
        velocity: THREE.Vector3
        steering: number
        throttle: number
        brake: number
        lightsOn: boolean
    } | null {
        const interpolation = this.states.get(playerId)

        if (!interpolation || !interpolation.target) {
            return null
        }

        const target = interpolation.target
        const previous = interpolation.previous

        // If no previous state, just return target
        if (!previous) {
            this.tempPosition.set(target.position[0], target.position[1], target.position[2])
            this.tempQuaternion.set(target.rotation[0], target.rotation[1], target.rotation[2], target.rotation[3])
            this.tempVelocity.set(target.velocity[0], target.velocity[1], target.velocity[2])

            return {
                position: this.tempPosition.clone(),
                quaternion: this.tempQuaternion.clone(),
                velocity: this.tempVelocity.clone(),
                steering: target.steering,
                throttle: target.throttle,
                brake: target.brake,
                lightsOn: target.lightsOn
            }
        }

        // Calculate interpolation factor
        const now = Date.now()
        const elapsed = now - interpolation.lastUpdateTime + this.interpolationDelay
        const duration = target.timestamp - previous.timestamp

        // Clamp factor between 0 and 1
        const factor = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1

        // Interpolate position
        this.tempPosition.set(
            THREE.MathUtils.lerp(previous.position[0], target.position[0], factor),
            THREE.MathUtils.lerp(previous.position[1], target.position[1], factor),
            THREE.MathUtils.lerp(previous.position[2], target.position[2], factor)
        )

        // Interpolate rotation (quaternion slerp)
        const prevQuat = new THREE.Quaternion(
            previous.rotation[0], previous.rotation[1], previous.rotation[2], previous.rotation[3]
        )
        const targetQuat = new THREE.Quaternion(
            target.rotation[0], target.rotation[1], target.rotation[2], target.rotation[3]
        )
        this.tempQuaternion.copy(prevQuat).slerp(targetQuat, factor)

        // Interpolate velocity
        this.tempVelocity.set(
            THREE.MathUtils.lerp(previous.velocity[0], target.velocity[0], factor),
            THREE.MathUtils.lerp(previous.velocity[1], target.velocity[1], factor),
            THREE.MathUtils.lerp(previous.velocity[2], target.velocity[2], factor)
        )

        return {
            position: this.tempPosition.clone(),
            quaternion: this.tempQuaternion.clone(),
            velocity: this.tempVelocity.clone(),
            steering: target.steering,
            throttle: target.throttle,
            brake: target.brake,
            lightsOn: target.lightsOn
        }
    }

    /**
     * Remove a player's interpolation state
     */
    removePlayer(playerId: string): void {
        this.states.delete(playerId)
    }

    /**
     * Get all tracked player IDs
     */
    getTrackedPlayers(): string[] {
        return Array.from(this.states.keys())
    }
}
