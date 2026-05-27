import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SearchResult } from '../services/api';

interface Props {
  onSearch: (query: string) => void;
  result: SearchResult | null;
  onSelectNode: (id: string) => void;
}

function decodeSafeLabel(str: string): string {
  let result = str;
  try {
    if (/\\u[0-9a-fA-F]{4}/.test(result)) {
      result = result.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
    }
  } catch {
    /* no-op */
  }
  try {
    if (/%[0-9a-fA-F]{2}/.test(result)) {
      result = decodeURIComponent(result);
    }
  } catch {
    /* no-op */
  }
  return result;
}

export default function SearchBar({ onSearch, result, onSelectNode }: Props) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const clickLockRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);

  const triggerSearch = useCallback((q: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!q.trim()) return;
    setIsSearching(true);
    debounceTimerRef.current = window.setTimeout(() => {
      onSearch(q.trim());
      setIsSearching(false);
    }, 150);
  }, [onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setIsSearching(true);
      onSearch(query.trim());
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    triggerSearch(val);
  };

  const handleSelectNode = useCallback((nid: string, nodeLabel: string) => {
    if (clickLockRef.current) return;
    clickLockRef.current = true;
    try {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setIsSearching(false);
      onSelectNode(nid);
    } finally {
      setTimeout(() => {
        clickLockRef.current = false;
      }, 300);
    }
  }, [onSelectNode]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6 }}>
        <input
          style={styles.input}
          placeholder="搜索节点或边..."
          value={query}
          onChange={handleInputChange}
        />
        <button type="submit" style={styles.btn} disabled={isSearching || !query.trim()}>
          {isSearching ? '搜索中...' : '搜索'}
        </button>
      </form>
      {result && (
        <div style={styles.results}>
          {result.nodes.length === 0 && result.edges.length === 0 && (
            <div style={styles.empty}>未找到匹配结果</div>
          )}
          {result.nodes.map((n) => (
            <div
              key={n.id}
              style={styles.resultItem}
              onClick={() => handleSelectNode(n.id, n.label)}
            >
              <span style={styles.badge}>节点</span>
              <span style={styles.label}>{decodeSafeLabel(n.label)}</span>
              {Object.entries(n.properties).slice(0, 2).map(([k, v]) => (
                <span key={k} style={styles.prop}>{k}: {decodeSafeLabel(v)}</span>
              ))}
            </div>
          ))}
          {result.edges.map((e) => (
            <div key={e.id} style={styles.resultItem}>
              <span style={{ ...styles.badge, background: '#dbeafe', color: '#1d4ed8' }}>边</span>
              <span style={styles.label}>{decodeSafeLabel(e.label)}</span>
            </div>
          ))}
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
  input: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 13,
    outline: 'none',
  },
  btn: {
    padding: '8px 14px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  } as React.CSSProperties,
  results: {
    marginTop: 8,
    maxHeight: 200,
    overflowY: 'auto',
  },
  empty: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center' as const,
    padding: 8,
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    borderBottom: '1px solid #f1f5f9',
  },
  badge: {
    background: '#fef3c7',
    color: '#92400e',
    padding: '1px 6px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
  },
  label: {
    fontWeight: 600,
    color: '#1e293b',
  },
  prop: {
    color: '#64748b',
    fontSize: 11,
  },
};
