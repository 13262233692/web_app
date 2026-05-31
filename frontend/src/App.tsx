import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import GraphList from './components/GraphList';
import MergeModal from './components/MergeModal';
import GraphPage from './pages/GraphPage';
import { api, KGGraphSummary, KGGraph, MergeExecuteResult } from './services/api';

function AppLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [graphs, setGraphs] = useState<KGGraphSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(id || null);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const loadGraphs = async () => {
    try {
      const data = await api.listGraphs();
      setGraphs(data);
      if (data.length > 0 && !currentId) {
        setCurrentId(data[0].id);
        navigate(`/graph/${data[0].id}`);
      }
    } catch (err) {
      console.error('Failed to load graphs:', err);
    }
  };

  useEffect(() => {
    loadGraphs();
  }, []);

  useEffect(() => {
    if (id) setCurrentId(id);
  }, [id]);

  const handleCreate = async (name: string, description?: string) => {
    try {
      const g = await api.createGraph(name, description);
      await loadGraphs();
      navigate(`/graph/${g.id}`);
    } catch (err) {
      console.error('Failed to create graph:', err);
    }
  };

  const handleSelect = (gid: string) => {
    navigate(`/graph/${gid}`);
  };

  const handleDelete = async (gid: string) => {
    try {
      await api.deleteGraph(gid);
      await loadGraphs();
      if (currentId === gid) {
        setCurrentId(null);
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to delete graph:', err);
    }
  };

  const handleMerged = async (result: MergeExecuteResult) => {
    await loadGraphs();
    navigate(`/graph/${result.merged_graph_id}`);
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.logo}>🧠 Knowledge Graph Manager</div>
        <div style={styles.subtitle}>个人知识图谱管理工具</div>
      </header>
      <div style={styles.body}>
        <aside style={styles.leftSidebar}>
          <GraphList
            graphs={graphs}
            currentId={currentId}
            onSelect={handleSelect}
            onCreate={handleCreate}
            onDelete={handleDelete}
            onMerge={() => setShowMergeModal(true)}
          />
        </aside>
        <main style={styles.mainContent}>
          <Routes>
            <Route path="/graph/:id" element={<GraphPage />} />
            <Route path="/" element={
              <div style={styles.hero}>
                <h1 style={styles.heroTitle}>欢迎使用知识图谱管理器</h1>
                <p style={styles.heroDesc}>
                  从左侧选择一个图谱，或点击「新建」创建你的第一个知识图谱。
                </p>
                <div style={styles.heroFeatures}>
                  <div style={styles.feature}>
                    <div style={styles.featureIcon}>⚡</div>
                    <div style={styles.featureTitle}>可视化编辑</div>
                    <div style={styles.featureDesc}>拖拽新建节点、右键连线，直观构建知识网络</div>
                  </div>
                  <div style={styles.feature}>
                    <div style={styles.featureIcon}>🔍</div>
                    <div style={styles.featureTitle}>全文搜索</div>
                    <div style={styles.featureDesc}>快速定位节点和关系，支持属性全文检索</div>
                  </div>
                  <div style={styles.feature}>
                    <div style={styles.featureIcon}>🔗</div>
                    <div style={styles.featureTitle}>图谱合并</div>
                    <div style={styles.featureDesc}>合并多个图谱，自动处理同名节点和属性冲突</div>
                  </div>
                </div>
              </div>
            } />
          </Routes>
        </main>
        {showMergeModal && (
          <MergeModal
            graphs={graphs}
            onClose={() => setShowMergeModal(false)}
            onMerged={handleMerged}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    background: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
    padding: '12px 20px',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4f46e5',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  body: {
    display: 'flex',
    height: 'calc(100vh - 56px)',
  },
  leftSidebar: {
    width: 280,
    flexShrink: 0,
    padding: 12,
    overflowY: 'auto',
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
  },
  hero: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 40,
    textAlign: 'center' as const,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: '#1e293b',
    margin: '0 0 8px 0',
  },
  heroDesc: {
    fontSize: 15,
    color: '#64748b',
    margin: '0 0 40px 0',
  },
  heroFeatures: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap' as const,
    justifyContent: 'center',
  },
  feature: {
    width: 200,
    padding: 20,
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.5,
  },
};
