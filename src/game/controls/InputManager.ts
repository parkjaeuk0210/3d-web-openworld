import { TouchControls } from './TouchControls'

export interface InputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  sprint: boolean
  jump: boolean
  interact: boolean
  mouseX: number
  mouseY: number
  mouseDeltaX: number
  mouseDeltaY: number
}

export class InputManager {
  private keys: Set<string> = new Set()
  private mousePosition = { x: 0, y: 0 }
  private mouseDelta = { x: 0, y: 0 }
  private isPointerLocked = false
  private touchControls: TouchControls

  public state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    interact: false,
    mouseX: 0,
    mouseY: 0,
    mouseDeltaX: 0,
    mouseDeltaY: 0
  }

  public isMobile = false

  constructor() {
    this.touchControls = new TouchControls()
    this.isMobile = this.touchControls.isMobile

    if (!this.isMobile) {
      this.setupEventListeners()
    }
  }

  private setupEventListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', (e) => this.onKeyDown(e))
    document.addEventListener('keyup', (e) => this.onKeyUp(e))

    // Mouse events
    document.addEventListener('mousemove', (e) => this.onMouseMove(e))
    document.addEventListener('click', () => this.requestPointerLock())

    // Pointer lock events
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange())
    document.addEventListener('pointerlockerror', () => this.onPointerLockError())
  }

  private onKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.code)
    this.updateState()

    // Prevent default for game keys
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'ShiftLeft'].includes(event.code)) {
      event.preventDefault()
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code)
    this.updateState()
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.isPointerLocked) {
      this.mouseDelta.x = event.movementX
      this.mouseDelta.y = event.movementY
    } else {
      this.mousePosition.x = event.clientX
      this.mousePosition.y = event.clientY
      this.mouseDelta.x = 0
      this.mouseDelta.y = 0
    }

    this.state.mouseX = this.mousePosition.x
    this.state.mouseY = this.mousePosition.y
    this.state.mouseDeltaX = this.mouseDelta.x
    this.state.mouseDeltaY = this.mouseDelta.y
  }

  private requestPointerLock(): void {
    document.body.requestPointerLock()
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === document.body
  }

  private onPointerLockError(): void {
    console.error('Pointer lock error')
  }

  private updateState(): void {
    this.state.forward = this.keys.has('KeyW') || this.keys.has('ArrowUp')
    this.state.backward = this.keys.has('KeyS') || this.keys.has('ArrowDown')
    this.state.left = this.keys.has('KeyA') || this.keys.has('ArrowLeft')
    this.state.right = this.keys.has('KeyD') || this.keys.has('ArrowRight')
    this.state.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    this.state.jump = this.keys.has('Space')
    this.state.interact = this.keys.has('KeyE')
  }

  // Combined state getter - merges keyboard and touch input
  getState(): InputState {
    if (this.isMobile) {
      return this.touchControls.state
    }
    return this.state
  }

  isKeyPressed(code: string): boolean {
    return this.keys.has(code)
  }

  resetMouseDelta(): void {
    if (this.isMobile) {
      this.touchControls.resetMouseDelta()
    } else {
      this.mouseDelta.x = 0
      this.mouseDelta.y = 0
      this.state.mouseDeltaX = 0
      this.state.mouseDeltaY = 0
    }
  }

  getPointerLocked(): boolean {
    if (this.isMobile) {
      return this.touchControls.getPointerLocked()
    }
    return this.isPointerLocked
  }
}
