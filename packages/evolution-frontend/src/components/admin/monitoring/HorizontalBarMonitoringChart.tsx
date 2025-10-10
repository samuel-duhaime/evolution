import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export type Value = {
    value: number;
    valueName: string;
    valueUnit?: string; // Optional unit to display after the value (e.g., km, min, %)
};

// Example data: distribution from 0 to 100 in bins
const distribution: Value[] = [
    { value: 3, valueName: '0-10 %', valueUnit: ' %' },
    { value: 8, valueName: '10-20 %', valueUnit: ' %' },
    { value: 15, valueName: '20-30 %', valueUnit: ' %' },
    { value: 25, valueName: '30-40 %', valueUnit: ' %' },
    { value: 20, valueName: '40-50 %', valueUnit: ' %' },
    { value: 18, valueName: '50-60 % ', valueUnit: ' %' },
    { value: 10, valueName: '60-70 % ', valueUnit: ' %' },
    { value: 1, valueName: '70-80 % ', valueUnit: ' %' },
    { value: 3, valueName: '80-90 % ', valueUnit: ' %' },
    { value: 8, valueName: '90-100 % ', valueUnit: ' %' }
];

// Component to display a horizontal bar chart using D3.js
export const HorizontalBarMonitoringChart: React.FC = () => {
    const chartRef = useRef<HTMLDivElement>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; value: string } | null>(null);

    // Chart titles
    const chartTitle = 'Distribution of survey difficulty ratings';
    const xAxisTitle = 'Percentage of (%)';
    const yAxisTitle = 'Difficulty Rating (%)';

    useEffect(() => {
        // Clear previous chart
        if (chartRef.current) {
            chartRef.current.innerHTML = '';
        }

        // Chart dimensions and margins
        const barHeight = 25;
        const marginTop = 90; // More space for both titles
        const marginRight = 0;
        const marginBottom = 40;
        const marginLeft = 90;
        const width = 1200;
        const height = Math.ceil((distribution.length + 0.1) * barHeight) + marginTop + marginBottom;

        // Scales x and y
        const x = d3
            .scaleLinear()
            .domain([0, d3.max(distribution, (d) => d.value) || 1])
            .range([marginLeft, width - marginRight]);
        const y = d3
            .scaleBand<string>()
            .domain(distribution.map((d) => d.valueName))
            .rangeRound([marginTop, height - marginBottom])
            .padding(0.25); // Increased padding for more space between bars

        // Determine the unit to display (use the first non-empty unit)
        const valueUnit = distribution.find((d) => d.valueUnit)?.valueUnit || '';

        // Format
        const format = (v: number, unit?: string) => `${v}${unit ? unit : ''}`;

        // SVG container
        const svg = d3
            .create('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', [0, 0, width, height])
            .attr('style', 'max-width: 100%; height: auto; font: 10px Gill Sans, Helvetica, Arial, sans-serif;');

        // Chart Title (left aligned, at the very top)
        svg.append('text')
            .attr('x', marginLeft)
            .attr('y', 32)
            .attr('text-anchor', 'start')
            .attr('font-size', 22)
            .attr('font-weight', 'bold')
            .attr('fill', '#222')
            .text(chartTitle);

        // X axis title (centered, just above the x axis values, but below the chart title)
        svg.append('text')
            .attr('x', marginLeft + (width - marginLeft - marginRight) / 2)
            .attr('y', 68) // Between chart title (32) and axis (marginTop=90), adjust as needed
            .attr('text-anchor', 'middle')
            .attr('font-size', 17)
            .attr('font-weight', 'bold')
            .attr('fill', '#444')
            .text(xAxisTitle);

        // X axis (top) with unit (shifted down for titles)
        svg.append('g')
            .attr('transform', `translate(0,${marginTop})`)
            .call(
                d3
                    .axisTop(x)
                    .ticks(width / 80)
                    .tickFormat((d) => `${d}${valueUnit}`)
                    .tickSize(0)
            )
            .call((g) => g.select('.domain').remove());

        // Y axis (left) in tick labels
        svg.append('g')
            .attr('transform', `translate(${marginLeft},0)`)
            .call(
                d3
                    .axisLeft(y)
                    .tickSize(0)
                    .tickFormat((d) => d)
            )
            .call((g) => g.select('.domain').remove());

        // Y axis title (vertically centered, left of y axis)
        svg.append('text')
            .attr('x', 20) // 20px from the left edge
            .attr('y', marginTop + (height - marginTop - marginBottom) / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', 15)
            .attr('fill', '#444')
            .attr('transform', `rotate(-90, 20, ${marginTop + (height - marginTop - marginBottom) / 2})`)
            .text(yAxisTitle);

        // Bars with hover effect (no vertical shift)
        svg.append('g')
            .attr('fill', '#6486bd')
            .selectAll('rect')
            .data(distribution)
            .join('rect')
            .attr('x', x(0))
            .attr('y', (d) => y(d.valueName)!)
            .attr('width', (d) => x(d.value) - x(0))
            .attr('height', y.bandwidth())
            .attr('class', (d) => (hovered === d.valueName ? 'bar-hovered' : ''))
            .on('mouseenter', (event, d) => {
                setHovered(d.valueName);
                setTooltip({
                    x: x(d.value) + 10,
                    y: y(d.valueName)! + y.bandwidth() / 2,
                    value: `${d.valueName}: ${format(d.value, d.valueUnit)}`
                });
            })
            .on('mouseleave', () => {
                setHovered(null);
                setTooltip(null);
            });

        // Labels (move before bars so bars are on top and capture pointer events)
        svg.append('g')
            .attr('fill', 'white')
            .attr('text-anchor', 'end')
            .selectAll('text')
            .data(distribution)
            .join('text')
            .attr('x', (d) => x(d.value))
            .attr('y', (d) => y(d.valueName)! + y.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('dx', -4)
            .text((d) => format(d.value, d.valueUnit))
            .call((text) =>
                text
                    .filter((d) => x(d.value) - x(0) < 20)
                    .attr('dx', +4)
                    .attr('fill', 'black')
                    .attr('text-anchor', 'start')
            );

        // Draw vertical lines only up to the end of each bar, at each tick value <= bar value
        const xTicks = x.ticks(width / 80);
        svg.append('g')
            .selectAll('g')
            .data(distribution)
            .join('g')
            .each(function (this: SVGGElement, d) {
                const barY = y(d.valueName)!;
                const barHeight = y.bandwidth();
                xTicks.forEach((tick) => {
                    if (tick > d.value) return;
                    d3.select(this)
                        .append('line')
                        .attr('x1', x(tick))
                        .attr('x2', x(tick))
                        .attr('y1', barY)
                        .attr('y2', barY + barHeight)
                        .attr('stroke', '#ccc')
                        .attr('stroke-width', 1);
                });
            });

        // Tooltip
        if (chartRef.current) {
            chartRef.current.innerHTML = '';
            chartRef.current.appendChild(svg.node()!);
        }
    }, [hovered]);

    return (
        <div
            style={{
                position: 'relative',
                background: 'white',
                padding: 20,
                boxSizing: 'border-box',
                borderRadius: 20,
                fontFamily: '"Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", Helvetica, Arial, sans-serif', // Tufte: preferred sans-serif
                color: '#222'
            }}
        >
            <div ref={chartRef} />
            {tooltip && (
                <div
                    style={{
                        position: 'absolute',
                        left: Math.min(tooltip.x, 1150),
                        top: tooltip.y,
                        background: 'rgba(0,0,0,0.8)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 2,
                        border: '1px solid #222',
                        pointerEvents: 'none',
                        fontSize: 13,
                        zIndex: 10,
                        maxWidth: 300,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        transform: tooltip.x > 900 ? 'translateX(-100%)' : undefined,
                        fontFamily: '"Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", Helvetica, Arial, sans-serif'
                    }}
                >
                    {tooltip.value}
                </div>
            )}
            <style>{`
                .bar-hovered {
                    fill: #b07d2c !important;
                    cursor: pointer;
                }
                svg {
                    background: white;
                    font-family: "Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", Helvetica, Arial, sans-serif;
                }
                .tick text, .monitoring-big-number, h3 {
                    font-family: "Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", Helvetica, Arial, sans-serif;
                }
                .tick line, .domain {
                    display: none;
                }
                .monitoring-big-number {
                    font-size: 2.5em;
                    color: #222;
                }
                .monitoring-error {
                    color: #b00;
                    font-size: 1em;
                }
                rect.bar-hovered {
                    cursor: pointer;
                }
            `}</style>
        </div>
    );
};
