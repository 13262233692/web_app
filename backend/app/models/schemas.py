from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class NodeCreate(BaseModel):
    label: str
    properties: Optional[dict] = Field(default_factory=dict)


class NodeUpdate(BaseModel):
    label: Optional[str] = None
    properties: Optional[dict] = None


class NodeOut(BaseModel):
    id: str
    label: str
    properties: dict = Field(default_factory=dict)
    graph_id: str


class EdgeCreate(BaseModel):
    source_id: str
    target_id: str
    label: str
    properties: Optional[dict] = Field(default_factory=dict)


class EdgeUpdate(BaseModel):
    label: Optional[str] = None
    properties: Optional[dict] = None


class EdgeOut(BaseModel):
    id: str
    source_id: str
    target_id: str
    label: str
    properties: dict = Field(default_factory=dict)
    graph_id: str


class GraphCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class GraphUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class GraphOut(BaseModel):
    id: str
    name: str
    description: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    nodes: List[NodeOut] = Field(default_factory=list)
    edges: List[EdgeOut] = Field(default_factory=list)


class GraphSummary(BaseModel):
    id: str
    name: str
    description: str = ""
    node_count: int = 0
    edge_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SearchResult(BaseModel):
    nodes: List[NodeOut] = Field(default_factory=list)
    edges: List[EdgeOut] = Field(default_factory=list)


class PathResult(BaseModel):
    node_ids: List[str] = Field(default_factory=list)
    edge_ids: List[str] = Field(default_factory=list)
    length: int = 0


class MergeRequest(BaseModel):
    source_graph_id: str
    target_graph_id: str
    merged_name: Optional[str] = None


class ConflictProperty(BaseModel):
    key: str
    source_value: str
    target_value: str


class ConflictNode(BaseModel):
    source_node: NodeOut
    target_node: NodeOut
    conflict_properties: List[ConflictProperty] = Field(default_factory=list)


class MergePreview(BaseModel):
    source_graph_id: str
    target_graph_id: str
    auto_merged_nodes: List[NodeOut] = Field(default_factory=list)
    auto_merged_count: int = 0
    unique_source_nodes: List[NodeOut] = Field(default_factory=list)
    unique_target_nodes: List[NodeOut] = Field(default_factory=list)
    conflicts: List[ConflictNode] = Field(default_factory=list)
    total_source_nodes: int = 0
    total_target_nodes: int = 0
    total_source_edges: int = 0
    total_target_edges: int = 0


class ConflictResolution(BaseModel):
    source_node_id: str
    target_node_id: str
    resolution: str = "source"
    merged_properties: Optional[dict] = Field(default_factory=dict)


class MergeExecuteRequest(BaseModel):
    source_graph_id: str
    target_graph_id: str
    merged_name: Optional[str] = None
    delete_source: bool = False
    delete_target: bool = False
    resolutions: List[ConflictResolution] = Field(default_factory=list)


class MergeExecuteResult(BaseModel):
    merged_graph_id: str
    merged_graph_name: str
    total_nodes: int = 0
    total_edges: int = 0
    conflicts_resolved: int = 0
