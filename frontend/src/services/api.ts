const API_BASE = '/api';

function decodeSafeString(str: unknown): string {
  if (typeof str !== 'string') return String(str ?? '');
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

function sanitizeNodeData<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeNodeData) as unknown as T;
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (key === 'label' && typeof val === 'string') {
        result[key] = decodeSafeString(val);
      } else if (key === 'properties' && val && typeof val === 'object') {
        const props: Record<string, string> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          props[k] = decodeSafeString(v);
        }
        result[key] = props;
      } else {
        result[key] = sanitizeNodeData(val);
      }
    }
    return result as T;
  }
  if (typeof data === 'string') {
    return decodeSafeString(data) as unknown as T;
  }
  return data;
}

let activeController: AbortController | null = null;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  if (activeController) {
    activeController.abort();
  }
  const controller = new AbortController();
  activeController = controller;

  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    const data = await res.json();
    return sanitizeNodeData(data);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    throw err;
  } finally {
    if (activeController === controller) {
      activeController = null;
    }
  }
}

async function longRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  const data = await res.json();
  return sanitizeNodeData(data);
}

export interface KGNode {
  id: string;
  label: string;
  properties: Record<string, string>;
  graph_id: string;
}

export interface KGEdge {
  id: string;
  source_id: string;
  target_id: string;
  label: string;
  properties: Record<string, string>;
  graph_id: string;
}

export interface KGGraph {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  nodes: KGNode[];
  edges: KGEdge[];
}

export interface KGGraphSummary {
  id: string;
  name: string;
  description: string;
  node_count: number;
  edge_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SearchResult {
  nodes: KGNode[];
  edges: KGEdge[];
}

export interface PathResult {
  node_ids: string[];
  edge_ids: string[];
  length: number;
}

export interface ConflictProperty {
  key: string;
  source_value: string;
  target_value: string;
}

export interface ConflictNode {
  source_node: KGNode;
  target_node: KGNode;
  conflict_properties: ConflictProperty[];
}

export interface MergePreview {
  source_graph_id: string;
  target_graph_id: string;
  auto_merged_nodes: KGNode[];
  auto_merged_count: number;
  unique_source_nodes: KGNode[];
  unique_target_nodes: KGNode[];
  conflicts: ConflictNode[];
  total_source_nodes: number;
  total_target_nodes: number;
  total_source_edges: number;
  total_target_edges: number;
}

export interface ConflictResolution {
  source_node_id: string;
  target_node_id: string;
  resolution: 'source' | 'target' | 'merge';
  merged_properties?: Record<string, string>;
}

export interface MergeExecuteRequest {
  source_graph_id: string;
  target_graph_id: string;
  merged_name?: string;
  delete_source: boolean;
  delete_target: boolean;
  resolutions: ConflictResolution[];
}

export interface MergeExecuteResult {
  merged_graph_id: string;
  merged_graph_name: string;
  total_nodes: number;
  total_edges: number;
  conflicts_resolved: number;
}

export const api = {
  listGraphs: () => request<KGGraphSummary[]>('/graphs'),

  createGraph: (name: string, description?: string) =>
    request<KGGraph>('/graphs', {
      method: 'POST',
      body: JSON.stringify({ name, description: description || '' }),
    }),

  getGraph: (id: string) => request<KGGraph>(`/graphs/${id}`),

  updateGraph: (id: string, data: { name?: string; description?: string }) =>
    request<KGGraph>(`/graphs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteGraph: (id: string) =>
    request<{ status: string }>(`/graphs/${id}`, { method: 'DELETE' }),

  addNode: (graphId: string, label: string, properties?: Record<string, string>) =>
    request<KGNode>(`/graphs/${graphId}/nodes`, {
      method: 'POST',
      body: JSON.stringify({ label, properties: properties || {} }),
    }),

  updateNode: (nodeId: string, data: { label?: string; properties?: Record<string, string> }) =>
    request<KGNode>(`/nodes/${nodeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteNode: (nodeId: string) =>
    request<{ status: string }>(`/nodes/${nodeId}`, { method: 'DELETE' }),

  addEdge: (graphId: string, sourceId: string, targetId: string, label: string, properties?: Record<string, string>) =>
    request<KGEdge>(`/graphs/${graphId}/edges`, {
      method: 'POST',
      body: JSON.stringify({ source_id: sourceId, target_id: targetId, label, properties: properties || {} }),
    }),

  updateEdge: (edgeId: string, data: { label?: string; properties?: Record<string, string> }) =>
    request<KGEdge>(`/edges/${edgeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteEdge: (edgeId: string) =>
    request<{ status: string }>(`/edges/${edgeId}`, { method: 'DELETE' }),

  search: (graphId: string, query: string) =>
    request<SearchResult>(`/graphs/${graphId}/search?q=${encodeURIComponent(query)}`),

  findPath: (graphId: string, source: string, target: string) =>
    request<PathResult>(`/graphs/${graphId}/path?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`),

  mergePreview: (sourceGraphId: string, targetGraphId: string) =>
    longRequest<MergePreview>('/graphs/merge/preview', {
      method: 'POST',
      body: JSON.stringify({ source_graph_id: sourceGraphId, target_graph_id: targetGraphId }),
    }),

  mergeExecute: (data: MergeExecuteRequest) =>
    longRequest<MergeExecuteResult>('/graphs/merge/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
