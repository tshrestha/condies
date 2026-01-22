import { area, curveCatmullRom, line, scaleLinear, scalePoint, select } from "d3"
import { onCleanup, onMount } from "solid-js"

import type { Period } from "./lib/nws.ts"

export interface ForecastChartProps {
    title: string
    classList?: string[]
    colorDomain: number[]
    colorRange: string[]
    periods: Period[]
    getX: (p: Period) => number
    getXLabel: (p: Period) => string
    getY?: (p: Period) => number
    getForecastLabel: (p: Period) => string
    getColorValue: (p: Period) => number
}

export default function ForecastChart({
    title,
    colorDomain,
    colorRange,
    periods,
    getX,
    getXLabel,
    getForecastLabel,
    getColorValue,
}: ForecastChartProps) {
    let containerRef!: HTMLDivElement

    onMount(() => {
        if (!containerRef || !periods) {
            return
        }

        const { paddingLeft, paddingRight, paddingTop, paddingBottom } = getComputedStyle(containerRef)
        const margin = {
            top: parseInt(paddingTop),
            left: parseInt(paddingLeft),
            right: parseInt(paddingRight),
            bottom: parseInt(paddingBottom),
        }
        const width = containerRef.clientWidth - margin.left - margin.right
        const height = periods.length * 40
        const curve = curveCatmullRom.alpha(1)

        const xMin = Math.min(...periods.map((p) => getX(p)))
        const xMax = Math.max(...periods.map((p) => getX(p)))
        const relativeMinX = xMin - (xMax - xMin)
        const timeLabelPadding = 10

        // data-value to color scale
        const tempColorScale = scaleLinear<string>().domain(colorDomain).range(colorRange).clamp(true)

        const svg = select(containerRef)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height)
            .append("g")

        // Y scale for time periods (vertical)
        const yScale = scalePoint<number>()
            .domain(periods.map((_, i) => i))
            .range([0, height])
            .padding(0.5)

        // Add time labels on the left
        const timeLabels = svg
            .selectAll(".time-label")
            .data(periods)
            .enter()
            .append("text")
            .attr("class", "time-label")
            .attr("x", -timeLabelPadding)
            .attr("y", (_, i) => yScale(i) ?? 0)
            .attr("dy", "0.35em")
            .attr("text-anchor", "end")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", (_, i) => (i === 0 ? "rgba(59, 130, 246, 1)" : "var(--bs-body-color)"))
            .text((d, i) => (i === 0 ? "NOW" : d.hourString))

        // Get width of the widest time label
        const timeLabelWidths = timeLabels.nodes().map((n) => n.scrollWidth)
        const maxTimeLabelWidth = Math.max(...timeLabelWidths)

        // Use the maxTimeLabelWidth to determine how much the chart area needs to shift right
        svg.attr("transform", `translate(${maxTimeLabelWidth + timeLabelPadding},0)`)

        const dataPointLabelGroup = svg
            .selectAll(".data-point-label-group")
            .data(periods)
            .enter()
            .append("g")
            .attr("class", "data-point-label-group")

        const dataPointLabelBg = dataPointLabelGroup.append("rect").attr("class", "data-point-label-bg")

        // Add data point labels on the right (colored by data point)
        const dataPointLabels = dataPointLabelGroup
            .append("text")
            .attr("class", "data-point-label")
            .attr("font-size", "0.875rem")
            .attr("fill", "var(--bs-body-color)")
            .text((d) => `${getXLabel(d)}`)

        const golden = 1.618
        const half = 0.5
        const quarter = 0.25
        const dataPointLabelDim = dataPointLabels.nodes().map((n) => ({ width: n.scrollWidth, height: n.scrollHeight }))
        const maxDataPointLabelWidth = Math.max(...dataPointLabelDim.map((d) => d.width))
        const dataPointLabelBgHeight = dataPointLabelDim[0].height + dataPointLabelDim[0].height * quarter
        const dataPointLabelBgWidth = maxDataPointLabelWidth + dataPointLabelBgHeight * golden * half
        const dataPointLabelBgStrokeWidth = 2.5

        // X scale for data point (horizontal)
        const xScale = scaleLinear()
            .domain([relativeMinX, xMax])
            .range([
                0,
                width
                + margin.left
                + margin.right
                - maxTimeLabelWidth
                - timeLabelPadding
                - dataPointLabelBgWidth * half
                - dataPointLabelBgStrokeWidth,
            ])

        dataPointLabelBg
            .attr("height", dataPointLabelBgHeight)
            .attr("width", dataPointLabelBgWidth)
            .attr("rx", dataPointLabelBgHeight * half)
            .attr("fill", (d) => tempColorScale(getColorValue(d)).replace("0.6)", "1)"))
            .attr("stroke", "#e9ecef")
            .attr("stroke-width", dataPointLabelBgStrokeWidth)
            .style("filter", "drop-shadow(0px 1px 2px rgba(0, 0, 0, .3))")

        dataPointLabelGroup.attr(
            "transform",
            (d, i) =>
                `translate(${xScale(getX(d)) - dataPointLabelBgWidth * half}, ${
                    (yScale(i) ?? 0) - dataPointLabelBgHeight * half
                })`,
        )
        dataPointLabels
            .attr("dy", (_, i) => dataPointLabelBgHeight * half + dataPointLabelDim[i].height * quarter)
            .attr("dx", (_, i) => dataPointLabelBgWidth * half - dataPointLabelDim[i].width * half)
            .attr("fill", "white")

        // Create the area generator for vertical orientation
        const areaGenerator = area<Period>()
            .x0(xScale(relativeMinX))
            .x1((d) => xScale(getX(d)))
            .y((_, i) => yScale(i) ?? 0)
            .curve(curve)

        const lineGenerator = line<Period>()
            .x((d) => xScale(getX(d)))
            .y((_, i) => yScale(i) ?? 0)
            .curve(curve)

        // Create defs for gradients and filters
        const defs = svg.append("defs")

        // Create vertical gradient based on data point at each point
        const areaGradient = defs
            .append("linearGradient")
            .attr("id", "temp-gradient")
            .attr("x1", "0%")
            .attr("x2", "0%")
            .attr("y1", "0%")
            .attr("y2", "100%")

        // Create gradient for the line stroke
        const lineGradient = defs
            .append("linearGradient")
            .attr("id", "line-gradient")
            .attr("x1", "0%")
            .attr("x2", "0%")
            .attr("y1", "0%")
            .attr("y2", "100%")

        // Add gradient stops for each data point based on its data point
        periods.forEach((period, i) => {
            const offset = (i / (periods.length - 1)) * 100
            const color = tempColorScale(getColorValue(period))
            areaGradient.append("stop").attr("offset", `${offset}%`).attr("stop-color", color)
            lineGradient.append("stop").attr("offset", `${offset}%`).attr("stop-color", color.replace("0.6)", "1)"))
        })

        // Draw the area
        svg.append("path")
            .datum(periods)
            .attr("fill", "url(#temp-gradient)")
            .attr("fill-opacity", 0.4)
            .attr("d", areaGenerator)

        svg.append("path")
            .datum(periods)
            .attr("fill", "none")
            .attr("stroke", "url(#line-gradient)")
            .attr("stroke-width", 5)
            .attr("d", lineGenerator)

        // Add short forecast description (only when different from previous hour)
        const forecastLabels = periods
            .map((d, i) => ({ ...d, index: i }))
            .filter((d, i) => i === 0 || getForecastLabel(d) !== getForecastLabel(periods[i - 1]))

        const forecastLabelGroup = svg
            .selectAll(".forecast-label")
            .data(forecastLabels)
            .enter()
            .append("g")
            .attr("class", "forecast-label")
            .attr("transform", (d) => `translate(0, ${yScale(d.index) ?? 0})`)

        const forecastLabelBg = forecastLabelGroup
            .append("rect")
            .attr("height", 20)
            .attr("width", 40)
            .attr("fill", "rgba(255, 255, 255, 0.3)")

        const forecastLabelText = forecastLabelGroup
            .append("text")
            .attr("class", "forecast-label")
            .attr("dx", "0.3em")
            .attr("dy", "1.0em")
            .attr("text-anchor", "start")
            .attr("font-size", "0.8rem")
            .attr("fill", "black")
            .text((d) => getForecastLabel(d))

        const forecastLabelWidths = forecastLabelText.nodes().map((el) => [el.scrollHeight, el.scrollWidth])

        forecastLabelBg
            .attr("height", (_, i) => forecastLabelWidths[i][0])
            .attr("width", (_, i) => forecastLabelWidths[i][1] + 10)

        // Add axis lines connecting time labels to data point circles
        svg.selectAll(".axis-line")
            .data(periods)
            .enter()
            .append("line")
            .attr("class", "axis-line")
            .attr("x1", 0)
            .attr("y1", (_, i) => yScale(i) ?? 0)
            .attr("x2", (d) => xScale(getX(d)))
            .attr("y2", (_, i) => yScale(i) ?? 0)
            .attr("stroke", (d) => tempColorScale(getColorValue(d)).replace("0.6)", "1)"))
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2")

        dataPointLabelGroup.raise()
        dataPointLabels.raise()

        onCleanup(() => {
            select(containerRef).selectAll("*").remove()
        })
    })

    return (
        <div class={"card rounded-4 mb-2"}>
            <div class={"card-header"}>{title}</div>
            <div class={"card-body rounded-bottom-4"}>
                <div ref={containerRef} class="w-100 forecast-chart"></div>
            </div>
        </div>
    )
}
