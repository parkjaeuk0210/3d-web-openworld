import { InputState } from './InputManager'

export class TouchControls {
  private container: HTMLElement
  private joystickArea: HTMLElement
  private joystickKnob: HTMLElement
  private buttonsArea: HTMLElement

  private joystickActive = false
  private joystickCenter = { x: 0, y: 0 }
  private joystickRadius = 50

  private cameraActive = false
  private lastCameraTouch = { x: 0, y: 0 }

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
    this.isMobile = this.checkMobile()
    if (this.isMobile) {
      this.createUI()
      this.setupEventListeners()
    }
  }

  private checkMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  }

  private createUI(): void {
    // Main container
    this.container = document.createElement('div')
    this.container.id = 'touch-controls'
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      user-select: none;
      -webkit-user-select: none;
    `
    document.body.appendChild(this.container)

    // Joystick area (left side)
    this.joystickArea = document.createElement('div')
    this.joystickArea.id = 'joystick-area'
    this.joystickArea.style.cssText = `
      position: absolute;
      bottom: 30px;
      left: 30px;
      width: 120px;
      height: 120px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      pointer-events: auto;
      touch-action: none;
    `
    this.container.appendChild(this.joystickArea)

    // Joystick knob
    this.joystickKnob = document.createElement('div')
    this.joystickKnob.id = 'joystick-knob'
    this.joystickKnob.style.cssText = `
      position: absolute;
      width: 50px;
      height: 50px;
      background: rgba(255, 255, 255, 0.5);
      border: 2px solid rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `
    this.joystickArea.appendChild(this.joystickKnob)

    // Buttons area (right side)
    this.buttonsArea = document.createElement('div')
    this.buttonsArea.id = 'buttons-area'
    this.buttonsArea.style.cssText = `
      position: absolute;
      bottom: 30px;
      right: 30px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: auto;
    `
    this.container.appendChild(this.buttonsArea)

    // Create buttons (minimal - joystick handles movement)
    this.createButton('interact-btn', 'E', '탑승/하차', () => this.state.interact = true, () => this.state.interact = false)
    this.createButton('sprint-btn', '⇧', '드리프트', () => this.state.sprint = true, () => this.state.sprint = false)

    // Camera touch area (center-right)
    const cameraArea = document.createElement('div')
    cameraArea.id = 'camera-area'
    cameraArea.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      width: 60%;
      height: 70%;
      pointer-events: auto;
      touch-action: none;
    `
    this.container.appendChild(cameraArea)

    cameraArea.addEventListener('touchstart', (e) => this.onCameraTouchStart(e), { passive: false })
    cameraArea.addEventListener('touchmove', (e) => this.onCameraTouchMove(e), { passive: false })
    cameraArea.addEventListener('touchend', () => this.onCameraTouchEnd(), { passive: false })
  }

  private createButton(id: string, symbol: string, label: string, onPress: () => void, onRelease: () => void): void {
    const buttonContainer = document.createElement('div')
    buttonContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
    `

    const button = document.createElement('div')
    button.id = id
    button.style.cssText = `
      width: 60px;
      height: 60px;
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: white;
      touch-action: none;
    `
    button.textContent = symbol

    const labelEl = document.createElement('span')
    labelEl.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
    `
    labelEl.textContent = label

    buttonContainer.appendChild(button)
    buttonContainer.appendChild(labelEl)
    this.buttonsArea.appendChild(buttonContainer)

    button.addEventListener('touchstart', (e) => {
      e.preventDefault()
      button.style.background = 'rgba(255, 255, 255, 0.5)'
      onPress()
    }, { passive: false })

    button.addEventListener('touchend', (e) => {
      e.preventDefault()
      button.style.background = 'rgba(255, 255, 255, 0.2)'
      onRelease()
    }, { passive: false })

    button.addEventListener('touchcancel', () => {
      button.style.background = 'rgba(255, 255, 255, 0.2)'
      onRelease()
    })
  }

  private setupEventListeners(): void {
    this.joystickArea.addEventListener('touchstart', (e) => this.onJoystickStart(e), { passive: false })
    this.joystickArea.addEventListener('touchmove', (e) => this.onJoystickMove(e), { passive: false })
    this.joystickArea.addEventListener('touchend', () => this.onJoystickEnd(), { passive: false })
    this.joystickArea.addEventListener('touchcancel', () => this.onJoystickEnd(), { passive: false })
  }

  private onJoystickStart(e: TouchEvent): void {
    e.preventDefault()
    this.joystickActive = true
    const rect = this.joystickArea.getBoundingClientRect()
    this.joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    this.onJoystickMove(e)
  }

  private onJoystickMove(e: TouchEvent): void {
    if (!this.joystickActive) return
    e.preventDefault()

    const touch = e.touches[0]
    let deltaX = touch.clientX - this.joystickCenter.x
    let deltaY = touch.clientY - this.joystickCenter.y

    // Clamp to radius
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    if (distance > this.joystickRadius) {
      deltaX = (deltaX / distance) * this.joystickRadius
      deltaY = (deltaY / distance) * this.joystickRadius
    }

    // Update knob position
    this.joystickKnob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`

    // Normalize to -1 to 1
    const normalX = deltaX / this.joystickRadius
    const normalY = deltaY / this.joystickRadius

    // Dead zone
    const deadZone = 0.2

    // Update state
    this.state.left = normalX < -deadZone
    this.state.right = normalX > deadZone
    this.state.forward = normalY < -deadZone
    this.state.backward = normalY > deadZone
  }

  private onJoystickEnd(): void {
    this.joystickActive = false
    this.joystickKnob.style.transform = 'translate(-50%, -50%)'
    this.state.left = false
    this.state.right = false
    this.state.forward = false
    this.state.backward = false
  }

  private onCameraTouchStart(e: TouchEvent): void {
    e.preventDefault()
    this.cameraActive = true
    const touch = e.touches[0]
    this.lastCameraTouch = { x: touch.clientX, y: touch.clientY }
  }

  private onCameraTouchMove(e: TouchEvent): void {
    if (!this.cameraActive) return
    e.preventDefault()

    const touch = e.touches[0]
    this.state.mouseDeltaX = (touch.clientX - this.lastCameraTouch.x) * 0.5
    this.state.mouseDeltaY = (touch.clientY - this.lastCameraTouch.y) * 0.5
    this.lastCameraTouch = { x: touch.clientX, y: touch.clientY }
  }

  private onCameraTouchEnd(): void {
    this.cameraActive = false
    this.state.mouseDeltaX = 0
    this.state.mouseDeltaY = 0
  }

  resetMouseDelta(): void {
    this.state.mouseDeltaX = 0
    this.state.mouseDeltaY = 0
  }

  getPointerLocked(): boolean {
    return this.cameraActive
  }
}
