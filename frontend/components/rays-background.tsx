"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

type RaysColor =
  | { mode: "random" }
  | { mode: "single"; color: string }
  | { mode: "multi"; color1: string; color2: string }

type Animation = { animate: boolean; speed: number }

export interface RaysBackgroundProps {
  raysColor?: RaysColor
  backgroundColor?: string
  animation?: Animation
  intensity?: number
  rays?: number
  reach?: number
  position?: number
  vertical?: number
  showGrid?: boolean
  gridSize?: number
  gridOpacity?: number
  gridColor?: string
  gridThickness?: number
  gridBlur?: number
  radius?: string | number
  className?: string
  style?: React.CSSProperties
}

const RAY_Y_POSITION_1 = -0.4
const RAY_Y_POSITION_2 = -0.5

export default function RaysBackground(props: RaysBackgroundProps) {
  const {
    raysColor = { mode: "multi", color1: "#ffffff", color2: "#FFCB47" },
    backgroundColor = "transparent",
    animation = { animate: true, speed: 10 },
    intensity = 50,
    rays = 30,
    reach = 40,
    position = 80,
    vertical = 50,
    showGrid = true,
    gridSize = 28,
    gridOpacity = 0.12,
    gridColor = "#ffffff",
    gridThickness = 2,
    gridBlur = 1,
    radius = 0,
    className,
    style,
  } = props

  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<any>(null)
  const sceneRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const meshRef = useRef<any>(null)
  const frameIdRef = useRef<number | undefined>(undefined)
  const threeRef = useRef<any>(null)
  const animationRef = useRef(animation)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    animationRef.current = animation
  }, [animation])

  const [randomColor1RGB, randomColor2RGB] = useMemo(() => {
    if (raysColor.mode === "random") {
      const h = Math.random() * 360
      const s = 60 + Math.random() * 40
      return [hslToRgb(h, s, 50), hslToRgb(h, s, 65)]
    }
    return [[1, 1, 1], [1, 1, 1]]
  }, [raysColor])

  const [color1RGB, color2RGB, raysOpacity] = useMemo(() => {
    if (raysColor.mode === "random") {
      return [randomColor1RGB, randomColor2RGB, 1]
    } else {
      let color1 = ""
      let color2 = ""
      if (raysColor.mode === "single") {
        color1 = raysColor.color
        color2 = raysColor.color
      } else if (raysColor.mode === "multi") {
        color1 = raysColor.color1
        color2 = raysColor.color2
      }
      const [r1, g1, b1, a1] = colorToRGBA(color1)
      const [r2, g2, b2, a2] = colorToRGBA(color2)
      return [[r1, g1, b1], [r2, g2, b2], Math.max(a1, a2)]
    }
  }, [raysColor, randomColor1RGB, randomColor2RGB]) as any

  useEffect(() => {
    if (!mounted) return
    const container = containerRef.current
    if (!container) return

    let disposed = false
    ;(async () => {
      try {
        const THREE = await import("three")
        if (disposed) return
        threeRef.current = THREE

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000)
        camera.position.z = 5
        const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, premultipliedAlpha: true, alpha: true, antialias: true })
        renderer.setSize(container.clientWidth, container.clientHeight)
        renderer.setPixelRatio(1)
        container.appendChild(renderer.domElement)

        const geometry = new THREE.PlaneGeometry(1024, 1024)
        const material = new THREE.ShaderMaterial({
          fragmentShader: FRAGMENT_SHADER,
          vertexShader: VERTEX_SHADER,
          uniforms: {
            u_colors: {
              value: [
                new THREE.Vector4(color1RGB[0], color1RGB[1], color1RGB[2], Math.min(raysOpacity ?? 1, 0.6)),
                new THREE.Vector4(color2RGB[0], color2RGB[1], color2RGB[2], Math.min(raysOpacity ?? 1, 0.6)),
              ],
            },
            u_intensity: { value: mapRange(intensity, 0, 100, 0, 0.5) },
            u_rays: { value: mapRange(rays, 0, 100, 0, 0.3) },
            u_reach: { value: mapRange(reach, 0, 100, 0, 0.5) },
            u_time: { value: Math.random() * 10000 },
            u_mouse: { value: [0, 0] },
            u_resolution: { value: [container.clientWidth, container.clientHeight] },
            u_rayPos1: { value: [((position ?? 80) / 100) * container.clientWidth, ((vertical ?? 50) / 100) * container.clientHeight] },
            u_rayPos2: { value: [(((position ?? 80) / 100) + 0.02) * container.clientWidth, ((vertical ?? 50) / 100) * container.clientHeight] },
          },
          wireframe: false,
          dithering: false,
          flatShading: true,
          side: THREE.DoubleSide,
        })
        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)

        sceneRef.current = scene
        cameraRef.current = camera
        rendererRef.current = renderer
        meshRef.current = mesh

        let lastTime = 0
        const animate = (time: number) => {
          const anim = animationRef.current
          if (!anim.animate) lastTime = time
          const delta = time - lastTime
          lastTime = time
          if (mesh.material instanceof THREE.ShaderMaterial) {
            if (anim.animate) mesh.material.uniforms.u_time.value += (delta * anim.speed) / 1000 / 10
          }
          renderer.render(scene, camera)
          frameIdRef.current = requestAnimationFrame(animate)
        }
        frameIdRef.current = requestAnimationFrame(animate)
      } catch (e) {
        // three failed to load; ignore to keep UI working
      }
    })()

    return () => {
      disposed = true
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
      try {
        rendererRef.current?.dispose?.()
        meshRef.current?.geometry?.dispose?.()
        meshRef.current?.material?.dispose?.()
        if (container && rendererRef.current?.domElement) container.removeChild(rendererRef.current.domElement)
      } catch {}
    }
  }, [mounted])

  // Update uniforms when props change
  useEffect(() => {
    const THREE = threeRef.current
    const material: any = meshRef.current?.material
    if (!material || !(material.isShaderMaterial || (THREE && material instanceof THREE.ShaderMaterial))) return
    const container = containerRef.current
    if (!container) return
    material.uniforms.u_colors.value = [
      new THREE.Vector4(color1RGB[0], color1RGB[1], color1RGB[2], Math.min(raysOpacity ?? 1, 0.6)),
      new THREE.Vector4(color2RGB[0], color2RGB[1], color2RGB[2], Math.min(raysOpacity ?? 1, 0.6)),
    ]
    material.uniforms.u_intensity.value = mapRange(intensity, 0, 100, 0, 0.5)
    material.uniforms.u_rays.value = mapRange(rays, 0, 100, 0, 0.3)
    material.uniforms.u_reach.value = mapRange(reach, 0, 100, 0, 0.5)
    material.uniforms.u_rayPos1.value = [((position ?? 80) / 100) * container.clientWidth, ((vertical ?? 50) / 100) * container.clientHeight]
    material.uniforms.u_rayPos2.value = [(((position ?? 80) / 100) + 0.02) * container.clientWidth, ((vertical ?? 50) / 100) * container.clientHeight]
  }, [intensity, rays, reach, position, color1RGB, color2RGB])

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, borderRadius: radius as any, overflow: "hidden", backgroundColor, ...style }}
      aria-hidden
    >
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            color: gridColor,
            opacity: gridOpacity,
            filter: `blur(${gridBlur}px)` ,
            backgroundImage:
              `linear-gradient(to right, currentColor ${gridThickness}px, transparent ${gridThickness}px),` +
              `linear-gradient(to bottom, currentColor ${gridThickness}px, transparent ${gridThickness}px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
        />
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  )
}

function getColorValue(color: string) {
  if (color.startsWith("var(")) {
    if (typeof window !== "undefined" && typeof getComputedStyle !== "undefined") {
      try {
        const name = color.slice(4, -1).trim()
        return getComputedStyle(document.body).getPropertyValue(name).trim() || ""
      } catch {
        return ""
      }
    }
    return ""
  }
  return color
}

function colorToRGBA(color?: string) {
  let r = 1, g = 1, b = 1, a = 1
  if (color && typeof color === "string") {
    const value = getColorValue(color)
    if (value.startsWith("rgba(")) {
      const parts = value.slice(5, -1).split(",")
      r = parseInt(parts[0]) / 255
      g = parseInt(parts[1]) / 255
      b = parseInt(parts[2]) / 255
      a = parseFloat(parts[3])
    } else if (value.startsWith("rgb(")) {
      const parts = value.slice(4, -1).split(",")
      r = parseInt(parts[0]) / 255
      g = parseInt(parts[1]) / 255
      b = parseInt(parts[2]) / 255
    } else if (value.startsWith("#")) {
      const hex = value.slice(1)
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) / 255
        g = parseInt(hex[1] + hex[1], 16) / 255
        b = parseInt(hex[2] + hex[2], 16) / 255
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16) / 255
        g = parseInt(hex.slice(2, 4), 16) / 255
        b = parseInt(hex.slice(4, 6), 16) / 255
      } else if (hex.length === 8) {
        r = parseInt(hex.slice(0, 2), 16) / 255
        g = parseInt(hex.slice(2, 4), 16) / 255
        b = parseInt(hex.slice(4, 6), 16) / 255
        a = parseInt(hex.slice(6, 8), 16) / 255
      }
    }
  }
  return [r, g, b, a]
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h >= 0 && h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  return [r + m, g + m, b + m]
}

function mapRange(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number) {
  const percentage = (value - fromLow) / (fromHigh - fromLow)
  return toLow + percentage * (toHigh - toLow)
}

const VERTEX_SHADER = `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAGMENT_SHADER = `
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform vec4 u_colors[2];
uniform float u_intensity;
uniform float u_rays;
uniform float u_reach;
uniform vec2 u_rayPos1;
uniform vec2 u_rayPos2;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed)
{
    vec2 sourceToCoord = coord - raySource;
    float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
    float diagonal = length(u_resolution);
    return clamp((.45 + 0.15 * sin(cosAngle * seedA + u_time * speed)) + (0.3 + 0.2 * cos(-cosAngle * seedB + u_time * speed)), u_reach, 1.0) * clamp((diagonal - length(sourceToCoord)) / diagonal, u_reach, 1.0);
}

void main()
{
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.y = 1.0 - uv.y;
    vec2 coord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    float speed = u_rays * 10.0;
    vec2 rayPos1 = u_rayPos1;
    vec2 rayRefDir1 = normalize(vec2(1.0, -0.116));
    float raySeedA1 = 36.2214*speed;
    float raySeedB1 = 21.11349*speed;
    float raySpeed1 = 1.5*speed;
    vec2 rayPos2 = u_rayPos2;
    vec2 rayRefDir2 = normalize(vec2(1.0, 0.241));
    float raySeedA2 = 22.39910*speed;
    float raySeedB2 = 18.0234*speed;
    float raySpeed2 = 1.1*speed;
    float strength1 = rayStrength(rayPos1, rayRefDir1, coord, raySeedA1, raySeedB1, raySpeed1);
    float strength2 = rayStrength(rayPos2, rayRefDir2, coord, raySeedA2, raySeedB2, raySpeed2);
    float brightness = 1.0*u_reach - (coord.y / u_resolution.y);
    float attenuation = clamp(brightness + (0.5 + u_intensity), 0.0, 1.0);
    float alpha1 = strength1 * attenuation * u_colors[0].a;
    float alpha2 = strength2 * attenuation * u_colors[1].a;
    vec3 premultColor1 = u_colors[0].rgb * alpha1;
    vec3 premultColor2 = u_colors[1].rgb * alpha2;
    vec3 blendedColor = premultColor1 + premultColor2;
    float blendedAlpha = alpha1 + alpha2 * (1.0 - alpha1);
    vec3 finalRGB = blendedColor / max(blendedAlpha, 0.0001);
    gl_FragColor = vec4(finalRGB * blendedAlpha, blendedAlpha);
}
`
