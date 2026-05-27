import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GraphCanvas from '../components/GraphCanvas';
import NodeEditor from '../components/NodeEditor';
import SearchBar from '../components/SearchBar';
import PathFinder from '../components/PathFinder';
import { api, KGNode, KGEdge, SearchResult, PathResult } from '../services/api';

export default function GraphPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [nodes, setNodes] = useState<KGNode[]>([]);
  const [edges, setEdges] = useState<KGEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [pathResult, setPathResult] = useState<PathResult | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const searchRequestId = useRef(0);
  const loadRequestId = useRef(0);
  const searchDebounceTimer = useRef<number | null>(null);

  const loadGraph = useCallback(async () => {
    if (!id) return;
    const reqId = ++loadRequestId.current;
    setLoading(true);
    try {
      const graph = await api.getGraph(id);
      if (reqId !== loadRequestId.current) return;
      setNodes(graph.nodes);
      setEdges(graph.edges);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to load graph:', err);
    } finally {
      if (reqId === loadRequestId.current) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    setSearchResult(null);
    setPathResult(null);
    setHighlightedNodeIds(new Set());
    setHighlightedEdgeIds(new Set());
    setSelectedNodeId(null);
    loadRequestId.current = 0;
    searchRequestId.current = 0;
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
      searchDebounceTimer.current = null;
    }
  }, [id]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const handleNodeDragCreate = async (x: number, y: number) => {
    if (!id) return;
    const label = `Node ${nodes.length + 1}`;
    try {
      const newNode = await api.addNode(id, label);
      setNodes((prev) => [...prev, newNode]);
    } catch (err) {
      console.error('Failed to add node:', err);
    }
  };

  const handleEdgeCreate = async (sourceId: string, targetId: string) => {
    if (!id || sourceId === targetId) return;
    const label = 'related';
    try {
      const newEdge = await api.addEdge(id, sourceId, targetId, label);
      setEdges((prev) => [...prev, newEdge]);
    } catch (err) {
      console.error('Failed to add edge:', err);
    }
  };

  const handleUpdateNode = async (nodeId: string, data: { label?: string; properties?: Record<string, string> }) => {
    try {
      const updated = await api.updateNode(nodeId, data);
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? updated : n)));
    } catch (err) {
      console.error('Failed to update node:', err);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      await api.deleteNode(nodeId);
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter((e) => e.source_id !== nodeId && e.target_id !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  };

  const handleUpdateEdge = async (edgeId: string, data: { label?: string; properties?: Record<string, string> }) => {
    try {
      const updated = await api.updateEdge(edgeId, data);
      setEdges((prev) => prev.map((e) => (e.id === edgeId ? updated : e)));
    } catch (err) {
      console.error('Failed to update edge:', err);
    }
  };

  const handleDeleteEdge = async (edgeId: string) => {
    try {
      await api.deleteEdge(edgeId);
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
    } catch (err) {
      console.error('Failed to delete edge:', err);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!id || !query.trim()) return;

    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    const reqId = ++searchRequestId.current;

    searchDebounceTimer.current = window.setTimeout(async () => {
      try {
        const result = await api.search(id, query.trim());
        if (reqId !== searchRequestId.current) return;
        setSearchResult(result);
        const nodeIds = new Set(result.nodes.map((n) => n.id));
        const edgeIds = new Set(result.edges.map((e) => e.id));
        setHighlightedNodeIds(nodeIds);
        setHighlightedEdgeIds(edgeIds);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (reqId === searchRequestId.current) {
          console.error('Search failed:', err);
        }
      }
    }, 200);
  }, [id]);

  const handleSelectNodeFromSearch = useCallback((nid: string) => {
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
      searchDebounceTimer.current = null;
    }
    searchRequestId.current++;
    setSelectedNodeId(nid);
    setHighlightedNodeIds(new Set([nid]));
    setHighlightedEdgeIds(new Set());
  }, []);

  const pathRequestId = useRef(0);

  const handleFindPath = useCallback(async (sourceId: string, targetId: string): Promise<PathResult | null> => {
    if (!id || !sourceId || !targetId) return null;
    const reqId = ++pathRequestId.current;
    try {
      const result = await api.findPath(id, sourceId, targetId);
      if (reqId !== pathRequestId.current) return null;
      setPathResult(result);
      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      console.error('Path finding failed:', err);
      return null;
    }
  }, [id]);

  const handleHighlightPath = (nodeIds: Set<string>, edgeIds: Set<string>) => {
    setHighlightedNodeIds(nodeIds);
    setHighlightedEdgeIds(edgeIds);
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  if (!id) {
    return <div style={styles.empty}>请从左侧选择或创建一个图谱</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.main}>
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          highlightedNodeIds={highlightedNodeIds}
          highlightedEdgeIds={highlightedEdgeIds}
          onNodeSelect={setSelectedNodeId}
          onNodeDragCreate={handleNodeDragCreate}
          onEdgeCreate={handleEdgeCreate}
          onNodeDelete={handleDeleteNode}
          onEdgeDelete={handleDeleteEdge}
        />
      </div>
      <div style={styles.sidebar}>
        <NodeEditor
          node={selectedNode}
          edges={edges}
          allNodes={nodes}
          onUpdateNode={handleUpdateNode}
          onDeleteNode={handleDeleteNode}
          onUpdateEdge={handleUpdateEdge}
          onDeleteEdge={handleDeleteEdge}
        />
        <div style={{ marginTop: 12 }}>
          <SearchBar
            onSearch={handleSearch}
            result={searchResult}
            onSelectNode={handleSelectNodeFromSearch}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <PathFinder
            nodes={nodes}
            onFindPath={handleFindPath}
            pathResult={pathResult}
            onHighlightPath={handleHighlightPath}
          />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: 'calc(100vh - 56px)',
    gap: 12,
    padding: 12,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  sidebar: {
    width: 300,
    flexShrink: 0,
    overflowY: 'auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 56px)',
    color: '#64748b',
    fontSize: 16,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 56px)',
    color: '#94a3b8',
    fontSize: 16,
  },
};
