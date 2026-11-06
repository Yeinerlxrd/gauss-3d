import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './formula-enhancements.css'

type FieldKind = 'constant' | 'radial' | 'inward' | 'swirl'
type Geometry = 'cube' | 'sphere' | 'cylinder'
type Vec = { x: number; y: number; z: number }
type Exercise = { title: string; prompt: string; steps: string[]; answer: string; aliases: string[] }
type InspectPoint = { x: number; y: number; z: number; vector: Vec; divergence: number }

const sections = ['inicio', 'introduccion', 'fundamentos', 'teorema', 'visualizador', 'aplicaciones', 'ejercicios', 'conclusiones']
const navLabels = ['Inicio', 'Introducción', 'Fundamentos', 'Teorema', 'Visualizador', 'Aplicaciones', 'Ejercicios', 'Cierre']

const exercises: Exercise[] = [
  { title: 'Cubo unitario · campo cuadrático', prompt: 'F=(x²,y²,z²) en [0,1]³. Calcula el flujo saliente.', steps: ['Calcula la divergencia: ∇·F = 2x + 2y + 2z.', 'Integra en el volumen: Φ = ∭[0,1]³ (2x + 2y + 2z) dV.', 'Cada término integra 1. Suma: Φ = 1 + 1 + 1.'], answer: 'Φ = 3', aliases: ['x²,y²,z²', 'x2,y2,z2'] },
  { title: 'Campo polinómico · cubo', prompt: 'F=(xy,yz,zx) en [0,1]³. Calcula el flujo.', steps: ['∇·F = ∂(xy)/∂x + ∂(yz)/∂y + ∂(zx)/∂z = x + y + z.', 'Φ = ∭[0,1]³ (x + y + z) dV.', 'Son tres integrales iguales de 1/2.'], answer: 'Φ = 3/2', aliases: ['xy,yz,zx'] },
  { title: 'Campo mixto · cubo', prompt: 'F=(x²+y,y²+z,z²+x) en [0,1]³.', steps: ['∇·F = 2x + 2y + 2z.', 'Aplica Φ = ∭V ∇·F dV.', 'Cada contribución vale 1: Φ = 1 + 1 + 1.'], answer: 'Φ = 3', aliases: ['x²+y', 'y²+z', 'z²+x'] },
  { title: 'Esfera unitaria · campo radial', prompt: 'F=(x,y,z) en x²+y²+z²≤1.', steps: ['∇·F = 1 + 1 + 1 = 3.', 'El volumen de la esfera unidad es 4π/3.', 'Φ = 3 · (4π/3) = 4π.'], answer: 'Φ = 4π', aliases: ['x,y,z', 'esfera'] },
  { title: 'Cilindro cerrado · coordenadas cilíndricas', prompt: 'F=(x²,y²,z²), x²+y²≤1, 0≤z≤2. Usa dV=r dr dθ dz.', steps: ['∇·F = 2x + 2y + 2z.', 'Sustituye x=r cosθ, y=r sinθ; los términos trigonométricos se anulan.', 'La contribución de 2z queda: Φ = 4π. (3π sería inconsistente con estos datos.)'], answer: 'Φ = 4π', aliases: ['cilindro', 'x²,y²,z²'] }
]

function Formula({ children, label, className = '' }: { children: React.ReactNode; label: string; className?: string }) {
  return <span className={`math-display ${className}`} role="img" aria-label={label}>{children}</span>
}

function FieldCanvas({ field, geometry, density, yaw, pitch, zoom, selected, onSelect, onOrbit, onZoom, onReset }: { field: FieldKind; geometry: Geometry; density: number; yaw: number; pitch: number; zoom: number; selected: InspectPoint | null; onSelect: (point: { x: number; y: number }) => void; onOrbit: (dx: number, dy: number) => void; onZoom: (delta: number) => void; onReset: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drag = useRef({ active: false, x: 0, y: 0, startX: 0, startY: 0 })
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let frame = 0
    const draw = (time = 0) => {
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h)
      const glow = ctx.createRadialGradient(w * .5, h * .48, 5, w * .5, h * .48, w * .55)
      glow.addColorStop(0, 'rgba(48,212,190,.2)'); glow.addColorStop(1, 'rgba(5,14,27,0)')
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(104,142,177,.15)'; ctx.lineWidth = 1
      for (let x = 25; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
      for (let y = 20; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
      const cx = w * .5, cy = h * .53, size = Math.min(w, h) * .29 * zoom, sy = Math.cos(pitch * Math.PI / 180) * .75
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(yaw * .08); ctx.scale(1, sy)
      ctx.strokeStyle = 'rgba(48,212,190,.78)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5])
      if (geometry === 'sphere') { ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 0, size, size * .3, 0, 0, Math.PI * 2); ctx.stroke() }
      if (geometry === 'cube') { ctx.strokeRect(-size * .72, -size * .72, size * 1.45, size * 1.45); ctx.strokeRect(-size * .42, -size * .92, size * 1.45, size * 1.45); for (const p of [[-.72, -.72], [-.72, .72], [.72, -.72], [.72, .72]]) { ctx.beginPath(); ctx.moveTo(size * p[0], size * p[1]); ctx.lineTo(size * (p[0] + .3), size * (p[1] - .2)); ctx.stroke() } }
      if (geometry === 'cylinder') { ctx.beginPath(); ctx.ellipse(0, -size * .65, size * .78, size * .2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, size * .65, size * .78, size * .2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-size * .78, -size * .65); ctx.lineTo(-size * .78, size * .65); ctx.moveTo(size * .78, -size * .65); ctx.lineTo(size * .78, size * .65); ctx.stroke() }
      ctx.setLineDash([])
      const n = Math.max(5, Math.round(density / 2))
      for (let yi = -n; yi <= n; yi++) for (let xi = -n; xi <= n; xi++) {
        const x = xi * size / n, y = yi * size / n
        let vx = field === 'constant' ? 1 : field === 'radial' ? xi / Math.max(1, Math.abs(xi) + Math.abs(yi)) : field === 'inward' ? -xi / Math.max(1, Math.abs(xi) + Math.abs(yi)) : -yi / Math.max(1, Math.abs(xi) + Math.abs(yi))
        let vy = field === 'swirl' ? xi : field === 'constant' ? 0 : field === 'radial' ? yi / Math.max(1, Math.abs(xi) + Math.abs(yi)) : -yi / Math.max(1, Math.abs(xi) + Math.abs(yi))
        const len = 12 + Math.sin(time / 650 + xi * .4 + yi * .25) * 1.8, norm = Math.hypot(vx, vy) || 1; vx /= norm; vy /= norm
        ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.beginPath(); ctx.moveTo(x - vx * len * .5, y - vy * len * .5); ctx.lineTo(x + vx * len * .5, y + vy * len * .5); ctx.stroke()
        ctx.fillStyle = 'rgba(48,212,190,.95)'; ctx.beginPath(); ctx.moveTo(x + vx * len * .5, y + vy * len * .5); ctx.lineTo(x + vx * len * .5 - vx * 5 - vy * 3, y + vy * len * .5 - vy * 5 + vx * 3); ctx.lineTo(x + vx * len * .5 - vx * 5 + vy * 3, y + vy * len * .5 - vy * 5 - vx * 3); ctx.fill()
      }
      if (selected) {
        const sx = selected.x * size / 1.8, syPoint = selected.y * size / 1.8
        ctx.fillStyle = '#ff8b67'; ctx.beginPath(); ctx.arc(sx, syPoint, 6, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(255,139,103,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, syPoint, 13 + Math.sin(time / 300) * 2, 0, Math.PI * 2); ctx.stroke()
      }
      ctx.restore()
      ctx.fillStyle = 'rgba(226,241,247,.7)'; ctx.font = '12px DM Mono,monospace'
      ctx.fillText(({ constant: 'F = (1, 0, 0)', radial: 'F = (x, y, z)', inward: 'F = (−x, −y, −z)', swirl: 'F = (−y, x, 0)' }[field]), 18, 24)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    const resize = () => draw()
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize) }
  }, [field, geometry, density, yaw, pitch, zoom, selected])
  const pointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => { drag.current = { active: true, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }
  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drag.current.active) return; onOrbit(e.clientX - drag.current.x, e.clientY - drag.current.y); drag.current.x = e.clientX; drag.current.y = e.clientY }
  const pointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => { const moved = Math.hypot(e.clientX - drag.current.startX, e.clientY - drag.current.startY); drag.current.active = false; if (moved < 3) { const rect = e.currentTarget.getBoundingClientRect(); onSelect({ x: (e.clientX - rect.left) / rect.width * 2 - 1, y: (e.clientY - rect.top) / rect.height * 2 - 1 }) } }
  return <canvas className="field-canvas" ref={ref} aria-label="Visualización matemática de un campo vectorial. Arrastra para orbitar, rueda para zoom y pulsa para inspeccionar." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current.active = false }} onWheel={e => onZoom(e.deltaY)} onDoubleClick={onReset} />
}

function App() {
  const [active, setActive] = useState(0), [presentation, setPresentation] = useState(false)
  const [density, setDensity] = useState(12), [field, setField] = useState<FieldKind>('radial'), [geometry, setGeometry] = useState<Geometry>('sphere')
  const [yaw, setYaw] = useState(18), [pitch, setPitch] = useState(24), [zoom, setZoom] = useState(1), [selected, setSelected] = useState<InspectPoint | null>(null), [open, setOpen] = useState<number | null>(null), [boardStep, setBoardStep] = useState(0)
  const [problem, setProblem] = useState(''), [evaluation, setEvaluation] = useState<{ match?: Exercise; message: string; explanation?: string } | null>(null), [evaluating, setEvaluating] = useState(false)
  const go = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setActive(Math.max(0, sections.indexOf(id))) }
  useEffect(() => { const obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setActive(sections.indexOf(e.target.id)) }), { rootMargin: '-35% 0px -55%' }); sections.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el) }); return () => obs.disconnect() }, [])
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(sections[Math.min(active + 1, sections.length - 1)]) } if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(sections[Math.max(active - 1, 0)]) } if (e.key.toLowerCase() === 'p' && !e.metaKey) setPresentation(v => !v) }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [active])
  const evaluate = async () => {
    if (!problem.trim()) {
      setEvaluation({ message: 'Escribe un ejercicio antes de evaluarlo.' })
      return
    }
    setEvaluating(true)
    const text = problem.toLowerCase()
    const match = exercises.find(x => x.aliases.some(a => text.includes(a.toLowerCase())))
    try {
      const response = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problem }) })
      const explanation = await response.text()
      if (!response.ok) throw new Error(explanation || `El servidor respondió HTTP ${response.status}`)
      let data: { explanation?: string }
      try {
        data = JSON.parse(explanation) as { explanation?: string }
      } catch {
        throw new Error('El servidor local devolvió una respuesta inválida')
      }
      setEvaluation({ match, message: match ? 'También recibí una explicación de Gemini:' : 'Explicación de Gemini:', explanation: data.explanation })
    } catch (error) {
      setEvaluation({
        match,
        message: `Gemini no está disponible ahora: ${error instanceof Error ? error.message : 'error desconocido'}`,
        explanation: match
          ? `Solución local disponible:\n${match.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}\n\nResultado: ${match.answer}`
          : undefined,
      })
    } finally {
      setEvaluating(false)
    }
  }
  const inspect = ({ x, y }: { x: number; y: number }) => {
    const point = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), z: 0 }
    const denominator = Math.max(1, Math.abs(point.x) + Math.abs(point.y))
    const vector = field === 'constant' ? { x: 1, y: 0, z: 0 } : field === 'radial' ? { x: point.x / denominator, y: point.y / denominator, z: 0 } : field === 'inward' ? { x: -point.x / denominator, y: -point.y / denominator, z: 0 } : { x: -point.y / denominator, y: point.x / denominator, z: 0 }
    setSelected({ ...point, vector, divergence: field === 'radial' ? 3 : field === 'inward' ? -3 : 0 })
  }
  const orbit = (dx: number, dy: number) => { setYaw(v => Math.max(-90, Math.min(90, v + dx * .45))); setPitch(v => Math.max(-30, Math.min(75, v - dy * .45))) }
  const zoomBy = (delta: number) => setZoom(v => Math.max(.65, Math.min(1.8, v - delta * .001)))
  const resetView = () => { setYaw(18); setPitch(24); setZoom(1); setSelected(null) }
  const activeExercise = open === null ? null : exercises[open]
  return <div className={presentation ? 'app presentation' : 'app'}>
    <header className="topbar"><button className="brand" onClick={() => go('inicio')}><span className="brand-mark">∇·</span><span>GAUSS <b>3D</b></span></button><nav>{sections.map((s, i) => <button key={s} className={active === i ? 'active' : ''} onClick={() => go(s)}>{navLabels[i]}</button>)}</nav><button className="present" onClick={() => setPresentation(v => !v)}>{presentation ? 'Salir' : '⛶ Presentar'}</button></header>
    <main>
      <section id="inicio" className="hero section"><div className="hero-copy"><div className="eyebrow">CÁLCULO MULTIVARIABLE · LABORATORIO INTERACTIVO</div><h1>La belleza de<br /><em>lo invisible.</em></h1><p className="lead">Aprende el Teorema de la Divergencia viendo cómo la simetría convierte integrales de superficie en integrales de volumen.</p><div className="hero-actions"><button className="primary" onClick={() => go('introduccion')}>Comenzar recorrido <span>→</span></button><button className="ghost" onClick={() => go('visualizador')}>Ver visualizador <span>◌</span></button></div><div className="stats"><div><strong>01</strong><small>Concepto central</small></div><div><strong>05</strong><small>Problemas resueltos</small></div><div><strong>360°</strong><small>Vista del campo</small></div></div></div><div className="hero-art"><div className="orbit o1" /><div className="orbit o2" /><div className="orbit o3" /><div className="charge-glow">∇</div><span className="axis x">x</span><span className="axis y">y</span><span className="axis z">z</span><div className="art-label">CAMPO<br /><b>VECTORIAL</b></div></div></section>
      <section id="introduccion" className="section split"><div><div className="eyebrow">01 — LA PREGUNTA</div><h2>¿Qué nos dice<br /><em>Gauss?</em></h2><div className="info-list"><strong>La idea en cuatro pasos</strong><span>1. Elegimos un volumen V.</span><span>2. Identificamos su frontera cerrada ∂V.</span><span>3. Medimos el flujo que sale por cada punto.</span><span>4. Sumamos la divergencia dentro del volumen.</span></div></div><div className="text-block"><p className="large">La <strong>divergencia</strong> mide cuánto nace o desaparece un campo localmente.</p><p>El teorema conecta esa información volumétrica con el flujo que cruza una frontera cerrada. Es una herramienta de cálculo multivariable, no una afirmación exclusiva de la electrostática.</p><Formula label="Divergencia de un campo vectorial">∇ · F = ∂P/∂x + ∂Q/∂y + ∂R/∂z</Formula><div className="explain-card"><strong>Cómo leerlo</strong><p>Si ∇ · F &gt; 0 predominan las fuentes; si ∇ · F &lt; 0 predominan los sumideros; si ∇ · F = 0 el flujo neto se conserva localmente.</p></div><div className="quote">“El flujo saliente por la superficie es igual a la integral de la divergencia en el volumen.”</div></div></section>
      <section id="fundamentos" className="section dark"><div className="eyebrow">02 — EL LENGUAJE</div><h2>Antes de entrar,<br /><em>tres ideas.</em></h2><p className="section-intro">Trabajaremos con un campo <strong>continuo</strong> y diferenciable en todo V y en una vecindad de su frontera. Esa regularidad permite intercambiar la información de la superficie por información del interior.</p><div className="cards"><article><span className="card-num">01</span><h3>Campo vectorial</h3><p>Asigna un vector a cada punto: dirección, sentido y magnitud pueden variar. P, Q y R son funciones escalares de x, y y z.</p><Formula label="Campo vectorial F igual a P, Q, R">F = (P, Q, R)</Formula></article><article><span className="card-num">02</span><h3>Flujo</h3><p>La cantidad de campo que atraviesa una superficie. El producto punto selecciona la componente normal y la orientación exterior fija el signo.</p><Formula label="Flujo igual a integral cerrada de F punto n diferencial de superficie">Φ = ∯<sub>∂V</sub> F · n dS</Formula></article><article><span className="card-num">03</span><h3>Divergencia</h3><p>Mide la densidad local de fuentes y sumideros. Es una suma de tres tasas de cambio, una por cada dirección coordenada.</p><Formula label="Divergencia de F igual a derivada parcial de P respecto de x más derivada parcial de Q respecto de y más derivada parcial de R respecto de z">∇ · F = ∂P/∂x + ∂Q/∂y + ∂R/∂z</Formula></article></div></section>
      <section id="teorema" className="section theorem"><div className="eyebrow">03 — EL TEOREMA</div><div className="theorem-grid"><div><h2>La ecuación que<br /><em>lo conecta todo.</em></h2><p>Elige una superficie cerrada: el flujo sobre ella equivale a integrar la divergencia en el volumen que encierra.</p><div className="compare"><div><strong>Cálculo directo</strong><span>Parametrizar cada cara.</span><span>Calcular la normal.</span><span>Sumar integrales de superficie.</span></div><div><strong>Con Gauss</strong><span>Derivar P, Q y R.</span><span>Describir el volumen.</span><span>Resolver una integral triple.</span></div></div></div><div className="big-formula"><Formula label="Teorema de la divergencia de Gauss">∯<sub>∂V</sub> F · n dS = ∭<sub>V</sub> (∇ · F) dV</Formula><p>frontera = interior acumulado</p></div></div><div className="warning-note"><strong>Condiciones:</strong> V debe ser un volumen acotado con frontera cerrada y orientación exterior; F debe tener derivadas parciales continuas en V y alrededor de ∂V.</div><div className="pill-row"><span>∇ · F = ∂P/∂x + ∂Q/∂y + ∂R/∂z</span><span>F = (P, Q, R)</span><span>∂V superficie cerrada</span></div></section>
      <section id="visualizador" className="section visual"><div className="eyebrow">04 — LABORATORIO VECTORIAL</div><div className="visual-head"><div><h2>Haz visible<br /><em>el campo.</em></h2><p>Explora como en un laboratorio interactivo: arrastra, acerca y pulsa una flecha para medirla.</p><div className="visual-guide"><strong>Qué observar</strong><span>• Campo constante: flechas paralelas, sin fuentes.</span><span>• Campo radial: las flechas se alejan, ∇ · F = 3.</span><span>• Campo convergente: las flechas entran, ∇ · F = −3.</span><span>• Campo rotacional: gira sin crear flujo neto, ∇ · F = 0.</span></div></div><div className="control-panel"><label>Campo vectorial</label><div className="segmented">{(['constant', 'radial', 'inward', 'swirl'] as FieldKind[]).map((f, i) => <button key={f} className={field === f ? 'selected' : ''} onClick={() => setField(f)}>F{i + 1}</button>)}</div><label>Superficie cerrada</label><div className="segmented">{(['cube', 'sphere', 'cylinder'] as Geometry[]).map(g => <button key={g} className={geometry === g ? 'selected' : ''} onClick={() => setGeometry(g)}>{g === 'cube' ? 'Cubo' : g === 'sphere' ? 'Esfera' : 'Cilindro'}</button>)}</div><label htmlFor="yaw">Órbita horizontal <strong>{yaw}°</strong></label><input id="yaw" aria-label="Órbita horizontal" type="range" min="-90" max="90" step="1" value={yaw} onChange={e => setYaw(+e.target.value)} /><label htmlFor="pitch">Inclinación <strong>{pitch}°</strong></label><input id="pitch" aria-label="Inclinación vertical" type="range" min="-30" max="75" step="1" value={pitch} onChange={e => setPitch(+e.target.value)} /><label htmlFor="density">Densidad de flechas <strong>{density}</strong></label><input id="density" aria-label="Densidad de flechas" type="range" min="6" max="24" step="1" value={density} onChange={e => setDensity(+e.target.value)} /><button className="reset-view" type="button" onClick={resetView}>Restablecer vista 3D</button></div></div><div className="canvas-wrap"><FieldCanvas field={field} geometry={geometry} density={density} yaw={yaw} pitch={pitch} zoom={zoom} selected={selected} onSelect={inspect} onOrbit={orbit} onZoom={zoomBy} onReset={resetView} /><div className="canvas-caption"><span><i className="dot teal" /> Flechas: dirección</span><span><i className="dot orange" /> Superficie ∂V</span><span>∇·F = {field === 'constant' || field === 'swirl' ? '0' : field === 'radial' ? '3' : '−3'}</span><span>zoom {Math.round(zoom * 100)}%</span></div></div><div className="interaction-hints"><span>↔ Arrastra para orbitar</span><span>◉ Rueda para zoom</span><span>⌕ Doble click para reiniciar</span><span>✦ Pulsa para inspeccionar</span></div>{selected && <aside className="selected-point"><div><span className="eyebrow">PUNTO INSPECCIONADO</span><button className="close-inspect" onClick={() => setSelected(null)} aria-label="Cerrar inspección">×</button></div><strong>({selected.x.toFixed(2)}, {selected.y.toFixed(2)}, {selected.z.toFixed(2)})</strong><span>F ≈ ({selected.vector.x.toFixed(2)}, {selected.vector.y.toFixed(2)}, {selected.vector.z.toFixed(2)})</span><span>∇ · F = {selected.divergence}</span></aside>}<p className="interaction-note">Consejo: cambia la inclinación para distinguir la frontera cerrada de su proyección.</p></section>
      <section id="aplicaciones" className="section applications"><div className="eyebrow">05 — EN EL MUNDO</div><h2>Una idea,<br /><em>muchas aplicaciones.</em></h2><p className="section-intro">En todos los casos aparece la misma pregunta: ¿cuánto flujo neto atraviesa la frontera de una región y cuánto se genera o consume en su interior?</p><div className="app-grid"><div className="app-feature"><span>01</span><h3>Mecánica de fluidos</h3><p>Fuentes, sumideros y conservación de masa dentro de un volumen.</p><small>Lectura: la divergencia representa producción neta por unidad de volumen.</small></div><div className="app-feature"><span>02</span><h3>Electromagnetismo</h3><p>Las ecuaciones de Maxwell describen campos mediante divergencia y flujo.</p><small>Distinción: es una aplicación física relacionada, no el teorema completo por sí solo.</small></div><div className="app-feature"><span>03</span><h3>Transferencia de calor</h3><p>Lo que cruza una frontera se conecta con lo que se genera dentro.</p><small>Un sumidero térmico produce divergencia negativa; una fuente, positiva.</small></div><div className="app-feature"><span>04</span><h3>Ingeniería y simulación</h3><p>El método de volumen finito aplica el teorema celda por celda.</p><small>Así se convierten leyes diferenciales en balances numéricos verificables.</small></div></div></section>
      <section id="ejercicios" className="section exercises dark"><div className="eyebrow">06 — PONLO A PRUEBA</div><div className="exercise-head"><div><h2>Cinco casos,<br /><em>una intuición.</em></h2><p>Abre una tarjeta y pulsa “pizarra” para ver el razonamiento aparecer paso a paso.</p></div><div className="solver-card"><div className="solver-label">EVALUADOR LOCAL + GEMINI</div><textarea value={problem} onChange={e => setProblem(e.target.value)} placeholder="Escribe un campo o pega un ejercicio conocido…" /><button className="small-button" onClick={evaluate} disabled={evaluating}>{evaluating ? 'Consultando Gemini…' : 'Explicar con Gemini ↗'}</button>{evaluation && <div className="evaluation"><strong>{evaluation.message}</strong>{evaluation.match && <><p>{evaluation.match.title}</p><code>{evaluation.match.answer}</code></>}{evaluation.explanation && <p>{evaluation.explanation}</p>}</div>}<details><summary>Estado de Gemini</summary><p>La clave se queda en el servidor local de Vite y no se envía al navegador.</p></details></div></div><div className="exercise-list">{exercises.map((x, i) => <article className={open === i ? 'exercise open' : 'exercise'} key={x.title}><button onClick={() => { setOpen(open === i ? null : i); setBoardStep(0) }}><span className="exercise-index">0{i + 1}</span><span><b>{x.title}</b><small>{x.prompt}</small></span><i>{open === i ? '−' : '+'}</i></button>{open === i && <div className="solution"><div className="board"><div className="board-head"><span>πizarra / razonamiento</span><button onClick={() => setBoardStep((boardStep + 1) % (x.steps.length + 1))}>{boardStep === x.steps.length ? 'Reiniciar' : 'Siguiente paso →'}</button></div><div className="board-lines">{x.steps.slice(0, boardStep).map((step, n) => <p className="chalk" key={step}><span>{n + 1}</span>{step}</p>)}{boardStep === x.steps.length && <strong className="answer">✓ {x.answer}</strong>}</div></div><p className="solution-note">La clave es identificar ∇·F antes de parametrizar la frontera.</p></div>}</article>)}</div></section>
      <section id="conclusiones" className="section closing"><div className="eyebrow">07 — PARA LLEVAR</div><h2>La divergencia<br /><em>es una brújula.</em></h2><p className="large">El Teorema de la Divergencia transforma un flujo sobre una superficie cerrada en una integral de volumen: una misma verdad vista desde la frontera y desde el interior.</p><p>Calcula primero ∇·F, identifica la geometría y elige coordenadas que hagan visible la simetría.</p><button className="primary" onClick={() => go('inicio')}>Repetir recorrido ↗</button><div className="footer-note">Flujo neto = integral de la divergencia sobre el volumen.</div></section>
    </main>
    <div className="progress"><span style={{ width: `${((active + 1) / sections.length) * 100}%` }} /></div><div className="keyboard-hint">↑ ↓ <span>navegar</span> · P <span>presentar</span></div>
  </div>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
