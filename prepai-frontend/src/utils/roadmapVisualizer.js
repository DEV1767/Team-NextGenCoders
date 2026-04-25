const DEFAULT_COLORS = {
  bg: '#f7f3ea',
  roadOuter: '#20243a',
  roadInner: '#2d334f',
  lane: '#eef2ff',
  pin: '#f97316',
  pinActive: '#0ea5e9',
}

const injectStyles = () => {
  if (document.getElementById('roadmap-visualizer-styles')) return

  const style = document.createElement('style')
  style.id = 'roadmap-visualizer-styles'
  style.textContent = `
.roadmap-shell { position: relative; background: radial-gradient(circle at 10% 15%, #fef7e9 0%, #eef6ff 52%, #edf8f4 100%); border-radius: 18px; padding: 20px; overflow: visible; border: 1px solid rgba(64, 73, 110, 0.12); }
.roadmap-title { margin: 0 0 10px; color: #21313c; font-size: 1.1rem; letter-spacing: 0.02em; }
.roadmap-svg-wrapper { position: relative; display: block; width: 100%; }
.roadmap-svg { width: 100%; height: 420px; display: block; }
.roadmap-labels { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
.roadmap-label { position: absolute; pointer-events: auto; padding: 8px 14px; background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%); border: 2px solid #3b82f6; border-radius: 10px; box-shadow: 0 4px 12px rgba(33, 49, 60, 0.15); font: 700 13px 'Segoe UI', Tahoma, sans-serif; color: #1e293b; white-space: nowrap; transition: all 200ms ease; z-index: 20; }
.roadmap-label:hover { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; border-color: #1e40af; box-shadow: 0 8px 16px rgba(33, 49, 60, 0.25); }
.roadmap-label.active { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #ffffff; border-color: #0369a1; box-shadow: 0 8px 20px rgba(14, 165, 233, 0.4); }
.roadmap-node { cursor: pointer; transform-origin: center; transition: transform 180ms ease, filter 180ms ease; }
.roadmap-node:hover { transform: translateY(-2px) scale(1.06); filter: drop-shadow(0 8px 10px rgba(33,49,60,0.2)); }
.roadmap-node text { font: 600 12px 'Segoe UI', Tahoma, sans-serif; fill: #21313c; }
.roadmap-pin-core { transition: fill 180ms ease; }
.roadmap-pin-shadow { opacity: 0.3; }
.roadmap-card-slot { min-height: 230px; }

.roadmap-info-card { margin-top: 14px; background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(64, 73, 110, 0.18); border-radius: 16px; padding: 14px; box-shadow: 0 12px 28px rgba(21, 30, 36, 0.12); }
.roadmap-info-grid { display: grid; grid-template-columns: 1.3fr 0.9fr; gap: 12px; }
.roadmap-info-title { margin: 0; color: #111827; font: 800 15px/1.25 'Segoe UI', Tahoma, sans-serif; }
.roadmap-info-subtitle { margin: 4px 0 0; color: #6b7280; font: 600 12px/1.3 'Segoe UI', Tahoma, sans-serif; }
.roadmap-steps { display: grid; gap: 8px; margin-top: 12px; }
.roadmap-step { display: grid; grid-template-columns: 28px 1fr; gap: 8px; padding: 10px; border: 1px solid #dbe4ff; border-radius: 12px; background: #f8faff; }
.roadmap-step-index { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; background: #7c3aed; color: #fff; font: 800 12px/1 'Segoe UI', Tahoma, sans-serif; }
.roadmap-step-text { margin: 0; color: #334155; font: 600 12px/1.45 'Segoe UI', Tahoma, sans-serif; }
.roadmap-side { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; padding: 10px; }
.roadmap-side p { margin: 0 0 6px; color: #334155; font: 600 12px/1.45 'Segoe UI', Tahoma, sans-serif; }
.roadmap-link { display: inline-block; margin-top: 6px; color: #0f4f9f; text-decoration: none; font: 700 12px/1.2 'Segoe UI', Tahoma, sans-serif; }
.roadmap-link:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .roadmap-shell { padding: 14px; }
  .roadmap-svg { height: 340px; }
  .roadmap-info-grid { grid-template-columns: 1fr; }
}
`
  document.head.appendChild(style)
}

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const pickResourceForNode = (node = {}, resourcesByKey = {}, allResources = [], index = 0) => {
  const keys = Array.isArray(node.resourceKeys) ? node.resourceKeys : []
  const fromKeys = keys.map((key) => resourcesByKey[key]).filter(Boolean)
  if (fromKeys.length) return fromKeys[0]
  return allResources[index] || allResources[0] || null
}

const makePathPoints = (count, width, height) => {
  const gutterX = 80
  const gutterY = 40
  const usableW = Math.max(240, width - gutterX * 2)
  const usableH = Math.max(220, height - gutterY * 2)

  return Array.from({ length: count }).map((_, index) => {
    const t = count === 1 ? 0 : index / (count - 1)
    const x = gutterX + usableW * t
    const wave = Math.sin(t * Math.PI * 2.6) * Math.min(62, usableH * 0.18)
    const y = gutterY + usableH * t + wave
    return { x, y }
  })
}

const makeCardHtml = ({ node, resource = null }) => {
  const title = escapeHtml(resource?.boxTitle || resource?.title || node.title || 'Roadmap Step')
  const subtitle = escapeHtml(resource?.boxSubtitle || resource?.channelName || resource?.provider || 'Learning Card')
  const summary = escapeHtml(resource?.boxDescription || resource?.hoverText || node.summary || node.hoverTip || 'Follow the first steps and practice steadily.')
  const safeWeeks = Number(node.durationWeeks || 1)
  const level = escapeHtml(node.level || 'beginner')
  const steps = Array.isArray(resource?.learn) && resource.learn.length
    ? resource.learn.slice(0, 3)
    : [
      node.summary || 'Understand the basics.',
      node.hoverTip || 'Practice with examples.',
      'Revise and build one mini task.'
    ]
  const channelLink = escapeHtml(resource?.channelLink || resource?.url || '')

  const stepsHtml = steps.map((item, idx) => `
    <div class="roadmap-step">
      <div class="roadmap-step-index">${idx + 1}</div>
      <p class="roadmap-step-text">${escapeHtml(item)}</p>
    </div>
  `).join('')

  return `
    <div class="roadmap-info-card">
      <div class="roadmap-info-grid">
        <div>
          <h4 class="roadmap-info-title">${title}</h4>
          <p class="roadmap-info-subtitle">${subtitle}</p>
          <div class="roadmap-steps">${stepsHtml}</div>
        </div>
        <div class="roadmap-side">
          <p><strong>Summary:</strong> ${summary}</p>
          <p><strong>Duration:</strong> ${safeWeeks} week${safeWeeks > 1 ? 's' : ''}</p>
          <p><strong>Level:</strong> ${level}</p>
          ${channelLink ? `<a class="roadmap-link" href="${channelLink}" target="_blank" rel="noopener noreferrer">Open Channel</a>` : '<p>No channel link available</p>'}
        </div>
      </div>
    </div>
  `
}

export function renderRoadmapVisualizer({ container, roadmapDetails, title = 'Your Learning Roadmap', colors = DEFAULT_COLORS }) {
  if (!container || !roadmapDetails || !Array.isArray(roadmapDetails.nodes)) return

  injectStyles()

  const allResources = Array.isArray(roadmapDetails.resources) ? roadmapDetails.resources : []
  const resourcesByKey = allResources
    .reduce((acc, item) => {
      acc[item.key] = item
      return acc
    }, {})

  const width = Math.max(640, container.clientWidth || 800)
  const height = 420
  const points = makePathPoints(roadmapDetails.nodes.length, width, height)

  const shell = document.createElement('div')
  shell.className = 'roadmap-shell'
  shell.style.background = `linear-gradient(160deg, ${colors.bg} 0%, #eef7f4 100%)`

  const heading = document.createElement('h3')
  heading.className = 'roadmap-title'
  heading.textContent = title

  const pinCardContainer = document.createElement('div')
  pinCardContainer.className = 'roadmap-card-slot'

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'roadmap-svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

  const roadOuterPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  const d = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  roadOuterPath.setAttribute('d', d)
  roadOuterPath.setAttribute('fill', 'none')
  roadOuterPath.setAttribute('stroke', colors.roadOuter)
  roadOuterPath.setAttribute('stroke-width', '54')
  roadOuterPath.setAttribute('stroke-linecap', 'round')
  roadOuterPath.setAttribute('stroke-linejoin', 'round')
  roadOuterPath.setAttribute('stroke-dasharray', '2200')
  roadOuterPath.setAttribute('stroke-dashoffset', '2200')
  roadOuterPath.style.transition = 'stroke-dashoffset 1100ms ease'
  svg.appendChild(roadOuterPath)

  const roadInnerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  roadInnerPath.setAttribute('d', d)
  roadInnerPath.setAttribute('fill', 'none')
  roadInnerPath.setAttribute('stroke', colors.roadInner)
  roadInnerPath.setAttribute('stroke-width', '42')
  roadInnerPath.setAttribute('stroke-linecap', 'round')
  roadInnerPath.setAttribute('stroke-linejoin', 'round')
  roadInnerPath.setAttribute('stroke-dasharray', '2200')
  roadInnerPath.setAttribute('stroke-dashoffset', '2200')
  roadInnerPath.style.transition = 'stroke-dashoffset 1100ms ease 80ms'
  svg.appendChild(roadInnerPath)

  const lanePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  lanePath.setAttribute('d', d)
  lanePath.setAttribute('fill', 'none')
  lanePath.setAttribute('stroke', colors.lane)
  lanePath.setAttribute('stroke-width', '4')
  lanePath.setAttribute('stroke-linecap', 'round')
  lanePath.setAttribute('stroke-dasharray', '14 14')
  lanePath.setAttribute('stroke-dashoffset', '300')
  lanePath.style.transition = 'stroke-dashoffset 1300ms linear'
  svg.appendChild(lanePath)

  let selectedNodeGroup = null
  let selectedNodeIndex = -1
  let hoverTimer = null
  let lastActivatedAt = 0
  let labelsContainer = null

  const activateNode = (group, node, index) => {
    // Update label styling
    if (labelsContainer) {
      labelsContainer.querySelectorAll('.roadmap-label').forEach((label) => {
        label.classList.remove('active')
      })
      const activeLabel = labelsContainer.querySelector(`[data-node-index="${index}"]`)
      if (activeLabel) {
        activeLabel.classList.add('active')
      }
    }
    
    const now = Date.now()
    if (selectedNodeIndex === index) return
    if (now - lastActivatedAt < 90) return

    if (selectedNodeGroup && selectedNodeGroup !== group) {
      if (selectedNodeGroup.querySelectorAll) {
        selectedNodeGroup.querySelectorAll('.roadmap-pin-core').forEach((el) => {
          el.setAttribute('fill', colors.pin)
        })
      }
    }

    selectedNodeGroup = group
    selectedNodeIndex = index
    lastActivatedAt = now
    if (group && group.querySelectorAll) {
      group.querySelectorAll('.roadmap-pin-core').forEach((el) => {
        el.setAttribute('fill', colors.pinActive)
      })
    }

    const selectedResource = pickResourceForNode(node, resourcesByKey, allResources, index)
    pinCardContainer.innerHTML = makeCardHtml({ node, resource: selectedResource })
  }

  const scheduleActivateNode = (group, node, index) => {
    if (hoverTimer) {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }

    hoverTimer = setTimeout(() => {
      activateNode(group, node, index)
      hoverTimer = null
    }, 110)
  }

  roadmapDetails.nodes.forEach((node, index) => {
    const point = points[index]
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    group.setAttribute('class', 'roadmap-node')
    group.style.opacity = '0'
    group.style.transition = `opacity 280ms ease ${120 + index * 90}ms`

    const pinShadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    pinShadow.setAttribute('cx', String(point.x))
    pinShadow.setAttribute('cy', String(point.y + 10))
    pinShadow.setAttribute('r', '11')
    pinShadow.setAttribute('class', 'roadmap-pin-shadow')
    pinShadow.setAttribute('fill', '#0f172a')

    const pinTip = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    pinTip.setAttribute('d', `M ${point.x - 8} ${point.y - 2} L ${point.x + 8} ${point.y - 2} L ${point.x} ${point.y + 18} Z`)
    pinTip.setAttribute('fill', index === 0 ? colors.pinActive : colors.pin)
    pinTip.setAttribute('class', 'roadmap-pin-core')

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', String(point.x))
    circle.setAttribute('cy', String(point.y))
    circle.setAttribute('r', '15')
    circle.setAttribute('fill', index === 0 ? colors.pinActive : colors.pin)
    circle.setAttribute('class', 'roadmap-pin-core')

    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    center.setAttribute('cx', String(point.x))
    center.setAttribute('cy', String(point.y))
    center.setAttribute('r', '5')
    center.setAttribute('fill', '#ffffff')

    group.appendChild(pinShadow)
    group.appendChild(pinTip)
    group.appendChild(circle)
    group.appendChild(center)

    // Primary desktop interaction: show details when hovering a roadmap pin.
    group.addEventListener('mouseenter', () => scheduleActivateNode(group, node, index))
    group.addEventListener('mouseleave', () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer)
        hoverTimer = null
      }
    })

    // Fallback for touch and keyboard-like interaction.
    group.addEventListener('click', () => activateNode(group, node, index))

    svg.appendChild(group)
  })

  container.innerHTML = ''
  shell.appendChild(heading)
  
  // Create SVG wrapper to hold both SVG and labels
  const svgWrapper = document.createElement('div')
  svgWrapper.className = 'roadmap-svg-wrapper'
  svgWrapper.appendChild(svg)
  
  // Create labels container
  labelsContainer = document.createElement('div')
  labelsContainer.className = 'roadmap-labels'
  svgWrapper.appendChild(labelsContainer)
  
  shell.appendChild(svgWrapper)
  shell.appendChild(pinCardContainer)
  container.appendChild(shell)
  
  // Add labels after SVG is in DOM
  roadmapDetails.nodes.forEach((node, index) => {
    const point = points[index]
    const label = document.createElement('div')
    label.className = 'roadmap-label'
    label.style.left = `${point.x + 35}px`
    label.style.top = `${point.y - 16}px`
    label.textContent = `${index + 1}. ${String(node.title).slice(0, 30)}`
    label.dataset.nodeIndex = index
    label.addEventListener('mouseenter', () => scheduleActivateNode(null, node, index))
    label.addEventListener('mouseleave', () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer)
        hoverTimer = null
      }
    })
    label.addEventListener('click', () => activateNode(null, node, index))
    labelsContainer.appendChild(label)
  })

  requestAnimationFrame(() => {
    roadOuterPath.style.strokeDashoffset = '0'
    roadInnerPath.style.strokeDashoffset = '0'
    lanePath.style.strokeDashoffset = '0'
    const nodes = shell.querySelectorAll('.roadmap-node')
    nodes.forEach((node) => {
      node.style.opacity = '1'
    })

    const firstNode = shell.querySelector('.roadmap-node')
    if (firstNode) {
      firstNode.dispatchEvent(new Event('click'))
    }
  })
}
