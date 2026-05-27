import React, { useState } from 'react';
import { KGNode, PathResult } from '../services/api';

interface Props {
  nodes: KGNode[];
  onFindPath: (sourceId: string, targetId: string) => Promise<PathResult | null>;
  pathResult: PathResult | null;
  onHighlightPath: (nodeIds: Set<string>, edgeIds: Set<string>) => void;
}

export default function PathFinder({ nodes, onFindPath, pathResult, onHighlightPath }: Props) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFind = async () => {
    if (!sourceId || !targetId) return;
    setLoading(true);
    try {
      const result = await onFindPath(sourceId, targetId);
      if (result && result.length > 0) {
        onHighlightPath(new Set(result.node_ids), new Set(result.edge_ids));
      } else {
        onHighlightPath(new Set(), new Set());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSourceId('');
    setTargetId('');
    onHighlightPath(new Set(), new Set());
  };

  return (
    <div style={styles.container}>
      <h4 style={styles.title}>最短路径查询</h4>

      <div style={styles.row}>
        <label style={styles.label}>起始节点</label>
        <select
          style={styles.select}
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          <option value="">-- 选择 --</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>目标节点</label>
        <select
          style={styles.select}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          <option value="">-- 选择 --</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          style={styles.btn}
          onClick={handleFind}
          disabled={loading || !sourceId || !targetId}
        >
          {loading ? '查询中...' : '查找路径'}
        </button>
        <button style={styles.btnClear} onClick={handleClear}>清除</button>
      </div>

      {pathResult && pathResult.length > 0 && (
        <div style={styles.result}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 4 }}>
            找到路径 (长度: {pathResult.length})
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {pathResult.node_ids.map((nid, i) => {
              const n = nodes.find((nd) => nd.id === nid);
              return (
                <span key={nid}>
                  <span style={{ fontWeight: 600 }}>{n?.label || nid}</span>
                  {i < pathResult.node_ids.length - 1 && <span style={{ color: '#94a3b8' }}> → </span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {pathResult && pathResult.length === 0 && (sourceId || targetId) && (
        <div style={{ ...styles.result, color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
          未找到路径
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 12,
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 10px 0',
  },
  row: {
    marginBottom: 8,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    marginBottom: 2,
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 12,
    outline: 'none',
    background: '#fff',
  },
  btn: {
    flex: 1,
    padding: '7px 10px',
    background: '#059669',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  btnClear: {
    padding: '7px 10px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  },
  result: {
    marginTop: 10,
    padding: 8,
    background: '#ecfdf5',
    borderRadius: 4,
  },
};
