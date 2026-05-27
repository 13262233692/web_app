import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { KGNode, KGEdge } from '../services/api';

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  properties: Record<string, string>;
  graph_id: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  label: string;
  source_id: string;
  target_id: string;
}

interface Props {
  nodes: KGNode[];
  edges: KGEdge[];
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  onNodeSelect: (id: string | null) => void;
  onNodeDragCreate: (x: number, y: number) => void;
  onEdgeCreate: (sourceId: string, targetId: string) => void;
  onNodeDelete: (id: string) => void;
  onEdgeDelete: (id: string) => void;
}

const NODE_RADIUS = 24;

export default function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  highlightedNodeIds,
  highlightedEdgeIds,
  onNodeSelect,
  onNodeDragCreate,
  onEdgeCreate,
  onNodeDelete,
  onEdgeDelete,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const linkModeRef = useRef(false);
  const linkSourceRef = useRef<string | null>(null);
  const tempLineRef = useRef<SVGLineElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const simNodes: SimNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    properties: n.properties,
    graph_id: n.graph_id,
  }));

  const simLinks: SimLink[] = edges.map((e) => ({
    id: e.id,
    label: e.label,
    source_id: e.source_id,
    target_id: e.target_id,
    source: e.source_id,
    target: e.target_id,
  }));

  const handleBackgroundClick = useCallback(
    (event: React.MouseEvent) => {
      if (linkModeRef.current) {
        linkModeRef.current = false;
        linkSourceRef.current = null;
        return;
      }
      onNodeSelect(null);
    },
    [onNodeSelect]
  );

  const handleBackgroundDblClick = useCallback(
    (event: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      onNodeDragCreate(x, y);
    },
    [onNodeDragCreate]
  );

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(NODE_RADIUS + 10));

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', NODE_RADIUS + 8)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#6b7280');

    const linkGroup = g.append('g').attr('class', 'links');
    const linkElements = linkGroup
      .selectAll('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', (d) =>
        highlightedEdgeIds.has(d.id) ? '#f59e0b' : '#6b7280'
      )
      .attr('stroke-width', (d) =>
        highlightedEdgeIds.has(d.id) ? 3 : 1.5
      )
      .attr('marker-end', 'url(#arrowhead)')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (window.confirm(`Delete edge "${d.label}"?`)) {
          onEdgeDelete(d.id);
        }
      });

    const linkLabels = linkGroup
      .selectAll('text')
      .data(simLinks)
      .enter()
      .append('text')
      .text((d) => d.label)
      .attr('font-size', 11)
      .attr('fill', '#374151')
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    const nodeGroup = g.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup
      .selectAll('g')
      .data(simNodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeElements
      .append('circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d) => {
        if (d.id === selectedNodeId) return '#3b82f6';
        if (highlightedNodeIds.has(d.id)) return '#f59e0b';
        return '#e0e7ff';
      })
      .attr('stroke', (d) => {
        if (d.id === selectedNodeId) return '#1d4ed8';
        if (highlightedNodeIds.has(d.id)) return '#d97706';
        return '#6366f1';
      })
      .attr('stroke-width', (d) => {
        if (d.id === selectedNodeId || highlightedNodeIds.has(d.id)) return 3;
        return 2;
      });

    nodeElements
      .append('text')
      .text((d) => (d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', '#1e1b4b')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    nodeElements.on('click', (event, d) => {
      event.stopPropagation();
      if (linkModeRef.current && linkSourceRef.current) {
        onEdgeCreate(linkSourceRef.current, d.id);
        linkModeRef.current = false;
        linkSourceRef.current = null;
      } else {
        onNodeSelect(d.id);
      }
    });

    nodeElements.on('contextmenu', (event, d) => {
      event.preventDefault();
      linkModeRef.current = true;
      linkSourceRef.current = d.id;
    });

    simulation.on('tick', () => {
      linkElements
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!);

      linkLabels
        .attr('x', (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
        .attr('y', (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2 - 8);

      nodeElements.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [
    simNodes,
    simLinks,
    dimensions,
    selectedNodeId,
    highlightedNodeIds,
    highlightedEdgeIds,
    onNodeSelect,
    onEdgeCreate,
    onEdgeDelete,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleBackgroundClick}
        onDoubleClick={handleBackgroundDblClick}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'rgba(255,255,255,0.9)',
          padding: '6px 10px',
          borderRadius: 4,
          fontSize: 11,
          color: '#64748b',
        }}
      >
        双击空白处添加节点 · 右键节点开始连线 · 点击节点选择编辑
      </div>
    </div>
  );
}
