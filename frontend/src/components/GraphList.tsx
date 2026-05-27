import React, { useState } from 'react';
import { KGGraphSummary } from '../services/api';

interface Props {
  graphs: KGGraphSummary[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description?: string) => void;
  onDelete: (id: string) => void;
  onMerge: () => void;
}

export default function GraphList({ graphs, currentId, onSelect, onCreate, onDelete, onMerge }: Props) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), desc.trim());
      setName('');
      setDesc('');
      setShowForm(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={styles.title}>知识图谱</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={styles.btnMerge} onClick={onMerge} disabled={graphs.length < 2}>
            合并
          </button>
          <button style={styles.btnNew} onClick={() => setShowForm(!showForm)}>
            {showForm ? '取消' : '+ 新建'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={styles.form}>
          <input
            style={styles.input}
            placeholder="图谱名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            style={styles.input}
            placeholder="描述 (可选)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <button type="submit" style={styles.btnCreate}>创建</button>
        </form>
      )}

      <div style={styles.list}>
        {graphs.length === 0 && (
          <div style={styles.empty}>暂无图谱，点击新建开始</div>
        )}
        {graphs.map((g) => (
          <div
            key={g.id}
            style={{
              ...styles.item,
              background: g.id === currentId ? '#eef2ff' : '#fff',
              borderLeft: g.id === currentId ? '3px solid #6366f1' : '3px solid transparent',
            }}
            onClick={() => onSelect(g.id)}
          >
            <div style={styles.itemName}>{g.name}</div>
            {g.description && <div style={styles.itemDesc}>{g.description}</div>}
            <div style={styles.itemMeta}>
              {g.node_count} 节点 · {g.edge_count} 边
            </div>
            <button
              style={styles.btnDelete}
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`删除图谱 "${g.name}"？`)) onDelete(g.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    overflowY: 'auto' as const,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  },
  btnNew: {
    padding: '4px 10px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  btnMerge: {
    padding: '4px 10px',
    background: '#0891b2',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  form: {
    display: 'flex',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap' as const,
  },
  input: {
    flex: 1,
    minWidth: 120,
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 12,
    outline: 'none',
  },
  btnCreate: {
    padding: '6px 12px',
    background: '#059669',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  empty: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center' as const,
    padding: 16,
  },
  item: {
    padding: '8px 10px',
    borderRadius: 4,
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background 0.15s',
  },
  itemName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1e293b',
  },
  itemDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  itemMeta: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  btnDelete: {
    position: 'absolute' as const,
    top: 8,
    right: 6,
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
    padding: 2,
  },
};
