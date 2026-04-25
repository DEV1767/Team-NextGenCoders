const DEFAULT_COLORS = {
    bg: "#f7f3ea",
    path: "#2f5d50",
    node: "#f2a65a",
    nodeActive: "#1f6f8b",
    text: "#21313c",
    card: "#fffaf2"
}

const injectStyles = () => {
    if (document.getElementById("roadmap-visualizer-styles")) return

    const style = document.createElement("style")
    style.id = "roadmap-visualizer-styles"
    style.textContent = `
.roadmap-shell { position: relative; background: linear-gradient(160deg, #f7f3ea 0%, #eef7f4 100%); border-radius: 18px; padding: 20px; overflow: hidden; }
.roadmap-title { margin: 0 0 10px; color: #21313c; font-size: 1.1rem; letter-spacing: 0.02em; }
.roadmap-svg { width: 100%; height: 420px; display: block; }
.roadmap-node { cursor: pointer; transform-origin: center; transition: transform 180ms ease, filter 180ms ease; }
.roadmap-node:hover { transform: scale(1.06); filter: drop-shadow(0 8px 10px rgba(33,49,60,0.2)); }
.roadmap-node text { font: 600 12px 'Segoe UI', Tahoma, sans-serif; fill: #21313c; }
.roadmap-hover-card { position: absolute; min-width: 240px; max-width: 320px; background: #fffaf2; border: 1px solid rgba(47,93,80,0.2); border-radius: 12px; padding: 12px; box-shadow: 0 10px 24px rgba(21,30,36,0.18); opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity 150ms ease, transform 150ms ease; z-index: 20; }
.roadmap-hover-card.is-visible { opacity: 1; transform: translateY(0); }
.roadmap-hover-card h4 { margin: 0 0 6px; color: #21313c; font: 700 14px 'Segoe UI', Tahoma, sans-serif; }
.roadmap-hover-card p { margin: 4px 0; color: #2f4450; font: 500 12px/1.4 'Segoe UI', Tahoma, sans-serif; }
.roadmap-resource { display: block; margin-top: 6px; color: #1f6f8b; text-decoration: none; font: 600 12px 'Segoe UI', Tahoma, sans-serif; }
.roadmap-resource:hover { text-decoration: underline; }
`
    document.head.appendChild(style)
}

const makePathPoints = (count, width, height) => {
    const gutterX = 80
    const gutterY = 40
    const usableW = Math.max(240, width - gutterX * 2)
    const usableH = Math.max(220, height - gutterY * 2)

    return Array.from({ length: count }).map((_, index) => {
        const t = count === 1 ? 0 : index / (count - 1)
        const x = gutterX + usableW * t
        const wave = Math.sin(t * Math.PI * 2.3) * Math.min(55, usableH * 0.16)
        const y = gutterY + usableH * t + wave
        return { x, y }
    })
}

const makeCardHtml = (node, resources = []) => {
    const links = resources.slice(0, 3).map((resource) => {
        const provider = resource.provider ? ` (${resource.provider})` : ""
        return `<a class="roadmap-resource" href="${resource.url || '#'}" target="_blank" rel="noopener noreferrer">${resource.title}${provider}</a>`
    }).join("")

    return `
        <h4>${node.title}</h4>
        <p>${node.summary || node.hoverTip || "Focus on this step with practical examples."}</p>
        <p><strong>Duration:</strong> ${node.durationWeeks || 1} week(s)</p>
        <p><strong>Level:</strong> ${node.level || "beginner"}</p>
        <p><strong>Learn from:</strong></p>
        ${links || "<p>No resources mapped yet.</p>"}
    `
}

export const renderRoadmapVisualizer = ({
    container,
    roadmapDetails,
    title = "Your Learning Roadmap",
    colors = DEFAULT_COLORS
}) => {
    if (!container || !roadmapDetails || !Array.isArray(roadmapDetails.nodes)) return

    injectStyles()

    const resourcesByKey = (Array.isArray(roadmapDetails.resources) ? roadmapDetails.resources : [])
        .reduce((acc, item) => {
            acc[item.key] = item
            return acc
        }, {})

    const width = Math.max(640, container.clientWidth || 800)
    const height = 420
    const points = makePathPoints(roadmapDetails.nodes.length, width, height)

    const shell = document.createElement("div")
    shell.className = "roadmap-shell"
    shell.style.background = `linear-gradient(160deg, ${colors.bg} 0%, #eef7f4 100%)`

    const heading = document.createElement("h3")
    heading.className = "roadmap-title"
    heading.textContent = title

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("class", "roadmap-svg")
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`)

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
    const d = points.map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ")
    path.setAttribute("d", d)
    path.setAttribute("fill", "none")
    path.setAttribute("stroke", colors.path)
    path.setAttribute("stroke-width", "6")
    path.setAttribute("stroke-linecap", "round")
    path.setAttribute("stroke-dasharray", "2200")
    path.setAttribute("stroke-dashoffset", "2200")
    path.style.transition = "stroke-dashoffset 950ms ease"
    svg.appendChild(path)

    const hoverCard = document.createElement("div")
    hoverCard.className = "roadmap-hover-card"

    roadmapDetails.nodes.forEach((node, index) => {
        const point = points[index]
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
        group.setAttribute("class", "roadmap-node")
        group.style.opacity = "0"
        group.style.transition = `opacity 280ms ease ${120 + index * 90}ms`

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
        circle.setAttribute("cx", String(point.x))
        circle.setAttribute("cy", String(point.y))
        circle.setAttribute("r", "15")
        circle.setAttribute("fill", index === 0 ? colors.nodeActive : colors.node)

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
        text.setAttribute("x", String(point.x + 20))
        text.setAttribute("y", String(point.y + 4))
        text.textContent = `${index + 1}. ${node.title.slice(0, 34)}`

        group.appendChild(circle)
        group.appendChild(text)

        group.addEventListener("mouseenter", (event) => {
            const nodeResources = (node.resourceKeys || []).map((key) => resourcesByKey[key]).filter(Boolean)
            hoverCard.innerHTML = makeCardHtml(node, nodeResources)

            const rect = container.getBoundingClientRect()
            hoverCard.style.left = `${event.clientX - rect.left + 14}px`
            hoverCard.style.top = `${event.clientY - rect.top - 10}px`
            hoverCard.classList.add("is-visible")
        })

        group.addEventListener("mouseleave", () => {
            hoverCard.classList.remove("is-visible")
        })

        svg.appendChild(group)
    })

    container.innerHTML = ""
    shell.appendChild(heading)
    shell.appendChild(svg)
    shell.appendChild(hoverCard)
    container.appendChild(shell)

    requestAnimationFrame(() => {
        path.style.strokeDashoffset = "0"
        const nodes = shell.querySelectorAll(".roadmap-node")
        nodes.forEach((node) => {
            node.style.opacity = "1"
        })
    })
}
