import React, { useState, useEffect, useCallback } from 'react';
import {
  api, KGGraphSummary, MergePreview, ConflictResolution,
  MergeExecuteResult,
} from '../services/api';

type Step = 'select' | 'preview' | 'resolving' | 'executing' | 'done';

interface Props {
  graphs: KGGraphSummary[];
  onClose: () => void;
  onMerged: (result: MergeExecuteResult) => void;
}

export default function MergeModal({ graphs, onClose, onMerged }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [mergedName, setMergedName] = useState('');
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [error, setError] = useState('');
  const [result, setResult] = useState<MergeExecuteResult | null>(null);
  const [deleteSource, setDeleteSource] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(false);

  const handlePreview = useCallback(async () => {
    if (!sourceId || !targetId || sourceId === targetId) {
      setError('请选择两个不同的图谱');
      return;
    }
    setError('');
    setStep('preview');
    try {
      const p = await api.mergePreview(sourceId, targetId);
      setPreview(p);
      const srcName = graphs.find((g) => g.id === sourceId)?.name || '';
      const tgtName = graphs.find((g) => g.id === targetId)?.name || '';
      setMergedName(`${srcName} + ${tgtName}`);
      const initRes: Record<string, ConflictResolution> = {};
      for (const c of p.conflicts) {
        initRes[`${c.source_node.id}::${c.target_node.id}`] = {
          source_node_id: c.source_node.id,
          target_node_id: c.target_node.id,
          resolution: 'source',
          merged_properties: { ...c.source_node.properties },
        };
      }
      setResolutions(initRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览失败');
      setStep('select');
    }
  }, [sourceId, targetId, graphs]);

  const setResolution = useCallback(
    (conflictKey: string, resolution: 'source' | 'target' | 'merge', conflict: MergePreview['conflicts'][0]) => {
      setResolutions((prev) => {
        const existing = prev[conflictKey];
        let mergedProps = { ...conflict.source_node.properties };
        if (resolution === 'target') {
          mergedProps = { ...conflict.target_node.properties };
        } else if (resolution === 'merge') {
          mergedProps = { ...conflict.source_node.properties };
          for (const cp of conflict.conflict_properties) {
            mergedProps[cp.key] = prev[conflictKey]?.merged_properties?.[cp.key] ?? cp.source_value;
          }
        }
        return {
          ...prev,
          [conflictKey]: {
            ...existing,
            resolution,
            merged_properties: mergedProps,
          },
        };
      });
    },
    []
  );

  const updateMergedProp = useCallback((conflictKey: string, key: string, value: string) => {
    setResolutions((prev) => {
      const existing = prev[conflictKey];
      if (!existing) return prev;
      return {
        ...prev,
        [conflictKey]: {
          ...existing,
          merged_properties: { ...existing.merged_properties, [key]: value },
        },
      };
    });
  }, []);

  const handleExecute = useCallback(async () => {
    if (!preview) return;
    setStep('executing');
    setError('');
    try {
      const res = await api.mergeExecute({
        source_graph_id: preview.source_graph_id,
        target_graph_id: preview.target_graph_id,
        merged_name: mergedName || undefined,
        delete_source: deleteSource,
        delete_target: deleteTarget,
        resolutions: Object.values(resolutions),
      });
      setResult(res);
      setStep('done');
      onMerged(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '合并失败');
      setStep('resolving');
    }
  }, [preview, mergedName, deleteSource, deleteTarget, resolutions, onMerged]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {step === 'select' && '合并图谱'}
            {step === 'preview' && '合并预览'}
            {(step === 'resolving' || step === 'preview') && '冲突解决'}
            {step === 'executing' && '正在合并...'}
            {step === 'done' && '合并完成'}
          </h2>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          {error && <div style={styles.error}>{error}</div>}

          {step === 'select' && (
            <div>
              <div style={styles.field}>
                <label style={styles.label}>源图谱</label>
                <select style={styles.select} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                  <option value="">-- 选择源图谱 --</option>
                  {graphs.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.node_count} 节点, {g.edge_count} 边)</option>
                  ))}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>目标图谱</label>
                <select style={styles.select} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">-- 选择目标图谱 --</option>
                  {graphs.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.node_count} 节点, {g.edge_count} 边)</option>
                  ))}
                </select>
              </div>
              <button
                style={{ ...styles.primaryBtn, opacity: !sourceId || !targetId ? 0.5 : 1 }}
                onClick={handlePreview}
                disabled={!sourceId || !targetId}
              >
                预览合并结果
              </button>
            </div>
          )}

          {(step === 'preview' || step === 'resolving') && preview && (
            <div>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{preview.total_source_nodes}</div>
                  <div style={styles.statLabel}>源节点</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{preview.total_target_nodes}</div>
                  <div style={styles.statLabel}>目标节点</div>
                </div>
                <div style={{ ...styles.statCard, background: '#ecfdf5' }}>
                  <div style={{ ...styles.statValue, color: '#059669' }}>{preview.auto_merged_count}</div>
                  <div style={styles.statLabel}>自动合并</div>
                </div>
                <div style={{ ...styles.statCard, background: '#fef3c7' }}>
                  <div style={{ ...styles.statValue, color: '#d97706' }}>{preview.conflicts.length}</div>
                  <div style={styles.statLabel}>冲突</div>
                </div>
              </div>

              {preview.auto_merged_count > 0 && (
                <div style={{ ...styles.section, borderLeft: '3px solid #059669' }}>
                  <h4 style={{ ...styles.sectionTitle, color: '#059669' }}>
                    ✓ 自动合并节点 ({preview.auto_merged_count})
                  </h4>
                  <div style={styles.nodeList}>
                    {preview.auto_merged_nodes.map((n) => (
                      <span key={n.id} style={styles.nodeTag}>{n.label}</span>
                    ))}
                  </div>
                </div>
              )}

              {preview.unique_source_nodes.length > 0 && (
                <div style={{ ...styles.section, borderLeft: '3px solid #6366f1' }}>
                  <h4 style={{ ...styles.sectionTitle, color: '#6366f1' }}>
                    源图谱独有节点 ({preview.unique_source_nodes.length})
                  </h4>
                  <div style={styles.nodeList}>
                    {preview.unique_source_nodes.map((n) => (
                      <span key={n.id} style={styles.nodeTag}>{n.label}</span>
                    ))}
                  </div>
                </div>
              )}

              {preview.unique_target_nodes.length > 0 && (
                <div style={{ ...styles.section, borderLeft: '3px solid #0891b2' }}>
                  <h4 style={{ ...styles.sectionTitle, color: '#0891b2' }}>
                    目标图谱独有节点 ({preview.unique_target_nodes.length})
                  </h4>
                  <div style={styles.nodeList}>
                    {preview.unique_target_nodes.map((n) => (
                      <span key={n.id} style={styles.nodeTag}>{n.label}</span>
                    ))}
                  </div>
                </div>
              )}

              {preview.conflicts.length > 0 && (
                <div style={{ ...styles.section, borderLeft: '3px solid #f59e0b' }}>
                  <h4 style={{ ...styles.sectionTitle, color: '#d97706' }}>
                    ⚠ 冲突节点 ({preview.conflicts.length})
                  </h4>
                  <p style={styles.hint}>以下同名节点属性不一致，请选择保留方式：</p>
                  {preview.conflicts.map((c) => {
                    const key = `${c.source_node.id}::${c.target_node.id}`;
                    const res = resolutions[key];
                    return (
                      <div key={key} style={styles.conflictCard}>
                        <div style={styles.conflictHeader}>
                          <span style={styles.conflictLabel}>{c.source_node.label}</span>
                        </div>
                        <div style={styles.radioGroup}>
                          <label style={styles.radio}>
                            <input
                              type="radio"
                              name={`res-${key}`}
                              checked={res?.resolution === 'source'}
                              onChange={() => setResolution(key, 'source', c)}
                            />
                            <span>保留源属性</span>
                          </label>
                          <label style={styles.radio}>
                            <input
                              type="radio"
                              name={`res-${key}`}
                              checked={res?.resolution === 'target'}
                              onChange={() => setResolution(key, 'target', c)}
                            />
                            <span>保留目标属性</span>
                          </label>
                          <label style={styles.radio}>
                            <input
                              type="radio"
                              name={`res-${key}`}
                              checked={res?.resolution === 'merge'}
                              onChange={() => setResolution(key, 'merge', c)}
                            />
                            <span>手动合并</span>
                          </label>
                        </div>
                        <div style={styles.propCompare}>
                          {c.conflict_properties.map((cp) => (
                            <div key={cp.key} style={styles.propRow}>
                              <span style={styles.propKey}>{cp.key}</span>
                              <span style={{
                                ...styles.propVal,
                                color: res?.resolution === 'target' ? '#94a3b8' : '#1e293b',
                                textDecoration: res?.resolution === 'target' ? 'line-through' : 'none',
                              }}>
                                源: {cp.source_value || '(空)'}
                              </span>
                              <span style={{
                                ...styles.propVal,
                                color: res?.resolution === 'source' ? '#94a3b8' : '#1e293b',
                                textDecoration: res?.resolution === 'source' ? 'line-through' : 'none',
                              }}>
                                目标: {cp.target_value || '(空)'}
                              </span>
                              {res?.resolution === 'merge' && (
                                <input
                                  style={styles.mergeInput}
                                  value={res.merged_properties?.[cp.key] ?? ''}
                                  onChange={(e) => updateMergedProp(key, cp.key, e.target.value)}
                                  placeholder="合并值"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={styles.field}>
                <label style={styles.label}>合并后图谱名称</label>
                <input
                  style={styles.input}
                  value={mergedName}
                  onChange={(e) => setMergedName(e.target.value)}
                />
              </div>

              <div style={styles.checkRow}>
                <label style={styles.check}>
                  <input type="checkbox" checked={deleteSource} onChange={(e) => setDeleteSource(e.target.checked)} />
                  <span>合并后删除源图谱</span>
                </label>
                <label style={styles.check}>
                  <input type="checkbox" checked={deleteTarget} onChange={(e) => setDeleteTarget(e.target.checked)} />
                  <span>合并后删除目标图谱</span>
                </label>
              </div>

              <div style={styles.btnRow}>
                <button style={styles.secondaryBtn} onClick={() => { setStep('select'); setPreview(null); }}>
                  返回
                </button>
                <button style={styles.primaryBtn} onClick={() => setStep('resolving')}>
                  {preview.conflicts.length > 0 ? '解决冲突' : '确认合并'}
                </button>
              </div>

              {step === 'resolving' && (
                <div style={styles.btnRow}>
                  <button
                    style={{ ...styles.primaryBtn, background: '#059669', width: '100%' }}
                    onClick={handleExecute}
                  >
                    执行合并 ({preview.conflicts.length > 0
                      ? `${Object.values(resolutions).filter((r) => r.resolution).length}/${preview.conflicts.length} 冲突已解决`
                      : '无冲突'}
                    )
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'executing' && (
            <div style={styles.loadingBox}>
              <div className="merge-spinner" style={styles.spinner} />
              <p>正在执行合并操作，请稍候...</p>
              <p style={styles.hint}>合并涉及长事务，可能需要几秒钟</p>
            </div>
          )}

          {step === 'done' && result && (
            <div style={styles.doneBox}>
              <div style={styles.doneIcon}>✅</div>
              <h3 style={styles.doneTitle}>合并成功！</h3>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{result.total_nodes}</div>
                  <div style={styles.statLabel}>节点数</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{result.total_edges}</div>
                  <div style={styles.statLabel}>边数</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{result.conflicts_resolved}</div>
                  <div style={styles.statLabel}>冲突已解决</div>
                </div>
              </div>
              <p style={styles.doneName}>图谱: {result.merged_graph_name}</p>
              <button style={{ ...styles.primaryBtn, width: '100%' }} onClick={onClose}>
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: 640,
    maxWidth: '95vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 22,
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  body: {
    padding: 20,
    overflowY: 'auto',
    flex: 1,
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
    border: '1px solid #fecaca',
  },
  field: {
    marginBottom: 14,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 4,
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    background: '#fff',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
  },
  primaryBtn: {
    padding: '10px 20px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  secondaryBtn: {
    padding: '10px 20px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    background: '#f8fafc',
    borderRadius: 8,
    padding: '10px 12px',
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 800,
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  section: {
    background: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    margin: '0 0 8px 0',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    margin: '0 0 8px 0',
  },
  nodeList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  nodeTag: {
    background: '#e0e7ff',
    color: '#3730a3',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 500,
  },
  conflictCard: {
    background: '#fff',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  conflictHeader: {
    marginBottom: 8,
  },
  conflictLabel: {
    fontSize: 14,
    fontWeight: 700,
    color: '#92400e',
    background: '#fef3c7',
    padding: '2px 8px',
    borderRadius: 4,
  },
  radioGroup: {
    display: 'flex',
    gap: 16,
    marginBottom: 10,
  },
  radio: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: '#374151',
    cursor: 'pointer',
  },
  propCompare: {
    background: '#f8fafc',
    borderRadius: 6,
    padding: 8,
  },
  propRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
    fontSize: 12,
    flexWrap: 'wrap' as const,
  },
  propKey: {
    fontWeight: 700,
    color: '#4f46e5',
    minWidth: 60,
  },
  propVal: {
    fontSize: 12,
    flex: '0 1 auto',
  },
  mergeInput: {
    flex: 1,
    minWidth: 100,
    padding: '3px 6px',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    fontSize: 12,
    outline: 'none',
  },
  checkRow: {
    display: 'flex',
    gap: 20,
    marginBottom: 14,
  },
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#475569',
    cursor: 'pointer',
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  loadingBox: {
    textAlign: 'center' as const,
    padding: '40px 20px',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #e2e8f0',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    margin: '0 auto 16px',
  },
  doneBox: {
    textAlign: 'center' as const,
    padding: '20px',
  },
  doneIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  doneTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#059669',
    margin: '0 0 16px 0',
  },
  doneName: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    marginBottom: 16,
  },
};
