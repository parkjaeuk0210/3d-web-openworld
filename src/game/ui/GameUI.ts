import * as THREE from 'three'

interface BuildingData {
  position: THREE.Vector3
  size: THREE.Vector2
}

export class GameUI {
  private speedElement: HTMLElement | null
  private healthFill: HTMLElement | null
  private staminaFill: HTMLElement | null
  private minimapCanvas: HTMLCanvasElement | null
  private minimapCtx: CanvasRenderingContext2D | null

  // Minimap settings
  private minimapScale = 2 // pixels per world unit
  private minimapSize = 200

  // Player stats
  private health = 100
  private maxHealth = 100
  private stamina = 100
  private maxStamina = 100

  constructor() {
    this.initElements()
    this.setupMinimap()
  }

  private initElements(): void {
    this.speedElement = document.getElementById('speed-value')
    this.healthFill = document.getElementById('health-fill')
    this.staminaFill = document.getElementById('stamina-fill')
    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement
  }

  private setupMinimap(): void {
    if (!this.minimapCanvas) return

    this.minimapCanvas.width = this.minimapSize
    this.minimapCanvas.height = this.minimapSize
    this.minimapCtx = this.minimapCanvas.getContext('2d')
  }

  updateSpeed(speed: number): void {
    if (this.speedElement) {
      this.speedElement.textContent = speed.toString()
    }
  }

  updateHealth(health: number): void {
    this.health = Math.max(0, Math.min(health, this.maxHealth))
    if (this.healthFill) {
      const percent = (this.health / this.maxHealth) * 100
      this.healthFill.style.width = `${percent}%`
    }
  }

  updateStamina(stamina: number): void {
    this.stamina = Math.max(0, Math.min(stamina, this.maxStamina))
    if (this.staminaFill) {
      const percent = (this.stamina / this.maxStamina) * 100
      this.staminaFill.style.width = `${percent}%`
    }
  }

  updateMinimap(
    playerPosition: THREE.Vector3,
    playerRotation: number,
    vehiclePositions: THREE.Vector3[],
    buildings: BuildingData[]
  ): void {
    if (!this.minimapCtx) return

    const ctx = this.minimapCtx
    const center = this.minimapSize / 2

    // Clear canvas
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, this.minimapSize, this.minimapSize)

    // Draw grid
    ctx.strokeStyle = '#2a2a4e'
    ctx.lineWidth = 0.5
    const gridSize = 20
    for (let i = 0; i <= this.minimapSize; i += gridSize) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, this.minimapSize)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(this.minimapSize, i)
      ctx.stroke()
    }

    // Transform to player-centered coordinates
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate(-playerRotation - Math.PI / 2)

    // Draw roads (simplified)
    ctx.strokeStyle = '#444466'
    ctx.lineWidth = 8

    // Main horizontal road
    const roadHStartX = (-100 - playerPosition.x) * this.minimapScale
    const roadHEndX = (100 - playerPosition.x) * this.minimapScale
    const roadHY = (0 - playerPosition.z) * this.minimapScale
    ctx.beginPath()
    ctx.moveTo(roadHStartX, roadHY)
    ctx.lineTo(roadHEndX, roadHY)
    ctx.stroke()

    // Main vertical road
    const roadVStartZ = (-100 - playerPosition.z) * this.minimapScale
    const roadVEndZ = (100 - playerPosition.z) * this.minimapScale
    const roadVX = (0 - playerPosition.x) * this.minimapScale
    ctx.beginPath()
    ctx.moveTo(roadVX, roadVStartZ)
    ctx.lineTo(roadVX, roadVEndZ)
    ctx.stroke()

    // Draw buildings
    ctx.fillStyle = '#666688'
    for (const building of buildings) {
      const bx = (building.position.x - playerPosition.x) * this.minimapScale
      const bz = (building.position.z - playerPosition.z) * this.minimapScale
      const bw = building.size.x * this.minimapScale
      const bh = building.size.y * this.minimapScale

      // Only draw if within minimap view
      if (Math.abs(bx) < center + bw && Math.abs(bz) < center + bh) {
        ctx.fillRect(bx - bw / 2, bz - bh / 2, bw, bh)
      }
    }

    // Draw vehicles
    ctx.fillStyle = '#ffaa00'
    for (const vehiclePos of vehiclePositions) {
      const vx = (vehiclePos.x - playerPosition.x) * this.minimapScale
      const vz = (vehiclePos.z - playerPosition.z) * this.minimapScale

      if (Math.abs(vx) < center && Math.abs(vz) < center) {
        ctx.beginPath()
        ctx.arc(vx, vz, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()

    // Draw player indicator (always at center, pointing up)
    ctx.fillStyle = '#00ff88'
    ctx.beginPath()
    ctx.moveTo(center, center - 8)
    ctx.lineTo(center - 5, center + 5)
    ctx.lineTo(center + 5, center + 5)
    ctx.closePath()
    ctx.fill()

    // Draw compass
    this.drawCompass(ctx, playerRotation)
  }

  private drawCompass(ctx: CanvasRenderingContext2D, playerRotation: number): void {
    const compassX = this.minimapSize - 25
    const compassY = 25
    const radius = 15

    // Draw compass background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.beginPath()
    ctx.arc(compassX, compassY, radius + 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw compass directions
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const directions = [
      { label: 'N', angle: 0, color: '#ff4444' },
      { label: 'E', angle: Math.PI / 2, color: '#ffffff' },
      { label: 'S', angle: Math.PI, color: '#ffffff' },
      { label: 'W', angle: -Math.PI / 2, color: '#ffffff' }
    ]

    for (const dir of directions) {
      const adjustedAngle = dir.angle - playerRotation - Math.PI / 2
      const dx = Math.cos(adjustedAngle) * (radius - 3)
      const dy = Math.sin(adjustedAngle) * (radius - 3)

      ctx.fillStyle = dir.color
      ctx.fillText(dir.label, compassX + dx, compassY + dy)
    }
  }

  showMessage(message: string, duration: number = 3000): void {
    // Create message element
    const messageEl = document.createElement('div')
    messageEl.className = 'game-message'
    messageEl.textContent = message
    messageEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px 40px;
      border-radius: 10px;
      font-size: 24px;
      z-index: 100;
      pointer-events: none;
      animation: fadeInOut ${duration}ms ease-in-out;
    `

    // Add animation style
    const style = document.createElement('style')
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        90% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `
    document.head.appendChild(style)

    document.body.appendChild(messageEl)

    setTimeout(() => {
      messageEl.remove()
      style.remove()
    }, duration)
  }
}
