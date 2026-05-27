import React, { useState } from 'react';
import { KGNode, KGEdge } from '../services/api';

interface Props {
  node: KGNode | null;
  edges: KGEdge[];
  allNodes: KGNode[];
  onUpdateNode: (id: string, data: { label?: string; properties?: Record<string, string> }) => void;
  onDeleteNode: (id: string) => void;
  onUpdateEdge: (id: string, data: { label?: string; properties?: Record<string, string> }) => void;
  onDeleteEdge: (id: string) => void;
}

export default function NodeEditor({
  node,
  edges,
  allNodes,
  onUpdateNode,
  onDeleteNode,
  onUpdateEdge,
  onDeleteEdge,
}: Props) {
  const [label, setLabel] = useState('');
  const [propKey, setPropKey] = useState('');
  const [propValue, setPropValue] = useState('');
  const [edgeLabelInput, setEdgeLabelInput] = useState<Record<string, string>>({});

  const nodeId = node?.id;

  React.useEffect(() => {
    if (node) {
      let cleanLabel = node.label;
      try {
        if (/\\u[0-9a-fA-F]{4}/.test(cleanLabel)) {
          cleanLabel = cleanLabel.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
            String.fromCharCode(parseInt(hex, 16))
          );
        }
      } catch {
        /* no-op */
      }
      try {
        if (/%[0-9a-fA-F]{2}/.test(cleanLabel)) {
          cleanLabel = decodeURIComponent(cleanLabel);
        }
      } catch {
        /* no-op */
      }
      setLabel(cleanLabel);
      setPropKey('');
      setPropValue('');
      setEdgeLabelInput({});
    }
  }, [nodeId]);

  if (!node) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>选择一个节点进行编辑</div>
      </div>
    );
  }

  const connectedEdges = edges.filter(
    (e) => e.source_id === node.id || e.target_id === node.id
  );

  const handleSaveLabel = () => {
    if (label.trim()) {
      onUpdateNode(node.id, { label: label.trim() });
    }
  };

  const handleAddProp = () => {
    if (propKey.trim()) {
      const newProps = { ...node.properties, [propKey.trim()]: propValue };
      onUpdateNode(node.id, { properties: newProps });
      setPropKey('');
      setPropValue('');
    }
  };

  const handleRemoveProp = (key: string) => {
    const newProps = { ...node.properties };
    delete newProps[key];
    onUpdateNode(node.id, { properties: newProps });
  };

  const handleEdgeLabelSave = (edgeId: string) => {
    const val = edgeLabelInput[edgeId];
    if (val !== undefined && val.trim()) {
      onUpdateEdge(edgeId, { label: val.trim() });
      setEdgeLabelInput((prev) => {
        const copy = { ...prev };
        delete copy[edgeId];
        return copy;
      });
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>节点编辑器</h3>

      <div style={styles.section}>
        <label style={styles.label}>标签</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={styles.input}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel()}
          />
          <button style={styles.btn} onClick={handleSaveLabel}>保存</button>
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>属性</label>
        {Object.entries(node.properties).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#475569' }}>{k}:</span>
            <span style={{ fontSize: 12, color: '#1e293b', fontWeight: 500 }}>{v}</span>
            <button style={styles.btnSmall} onClick={() => handleRemoveProp(k)}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="键"
            value={propKey}
            onChange={(e) => setPropKey(e.target.value)}
          />
          <input
            style={{ ...styles.input, flex: 1 }}
            placeholder="值"
            value={propValue}
            onChange={(e) => setPropValue(e.target.value)}
          />
          <button style={styles.btnSmall} onClick={handleAddProp}>+</button>
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>关联边 ({connectedEdges.length})</label>
        {connectedEdges.map((edge) => {
          const otherNodeId = edge.source_id === node.id ? edge.target_id : edge.source_id;
          const otherNode = allNodes.find((n) => n.id === otherNodeId);
          return (
            <div key={edge.id} style={{ ...styles.edgeRow, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#475569' }}>
                → {otherNode?.label || otherNodeId}
              </span>
              <input
                style={{ ...styles.input, flex: 1, fontSize: 11, padding: '2px 4px' }}
                placeholder={edge.label || '边标签'}
                value={edgeLabelInput[edge.id] ?? edge.label}
                onChange={(e) =>
                  setEdgeLabelInput((prev) => ({ ...prev, [edge.id]: e.target.value }))
                }
                onKeyDown={(e) => e.key === 'Enter' && handleEdgeLabelSave(edge.id)}
              />
              <button style={styles.btnSmall} onClick={() => handleEdgeLabelSave(edge.id)}>✓</button>
              <button style={styles.btnSmall} onClick={() => onDeleteEdge(edge.id)}>×</button>
            </div>
          );
        })}
      </div>

      <button
        style={{ ...styles.btn, width: '100%', background: '#ef4444', color: '#fff', marginTop: 12 }}
        onClick={() => {
          if (window.confirm('确定删除此节点？')) onDeleteNode(node.id);
        }}
      >
        删除节点
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    minWidth: 260,
    maxHeight: '100%',
    overflowY: 'auto',
  },
  empty: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center' as const,
    padding: '24px 0',
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 12px 0',
  },
  section: {
    marginBottom: 14,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    marginBottom: 4,
  },
  input: {
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 13,
    outline: 'none',
  },
  btn: {
    padding: '6px 12px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  btnSmall: {
    padding: '2px 6px',
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1,
  },
  edgeRow: {
    padding: '4px 0',
    borderBottom: '1px solid #f1f5f9',
  },
};
