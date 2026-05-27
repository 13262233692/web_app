from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    GraphCreate, GraphUpdate, GraphOut, GraphSummary,
    NodeCreate, NodeUpdate, NodeOut,
    EdgeCreate, EdgeUpdate, EdgeOut,
    SearchResult, PathResult,
    MergeRequest, MergePreview, MergeExecuteRequest, MergeExecuteResult,
)
from app.services.graph_ops import GraphOperations
from app.services.search_service import SearchService
from app.services.path_algorithm import PathAlgorithm
from app.services.merge_service import MergeService

router = APIRouter(prefix="/api")


@router.get("/graphs", response_model=list[GraphSummary])
def list_graphs():
    return GraphOperations.list_graphs()


@router.post("/graphs", response_model=GraphOut, status_code=201)
def create_graph(data: GraphCreate):
    return GraphOperations.create_graph(data)


@router.get("/graphs/{graph_id}", response_model=GraphOut)
def get_graph(graph_id: str):
    g = GraphOperations.get_graph(graph_id)
    if not g:
        raise HTTPException(status_code=404, detail="Graph not found")
    return g


@router.put("/graphs/{graph_id}", response_model=GraphOut)
def update_graph(graph_id: str, data: GraphUpdate):
    g = GraphOperations.update_graph(graph_id, data)
    if not g:
        raise HTTPException(status_code=404, detail="Graph not found")
    return g


@router.delete("/graphs/{graph_id}")
def delete_graph(graph_id: str):
    GraphOperations.delete_graph(graph_id)
    return {"status": "deleted"}


@router.post("/graphs/{graph_id}/nodes", response_model=NodeOut, status_code=201)
def add_node(graph_id: str, data: NodeCreate):
    n = GraphOperations.add_node(graph_id, data)
    if not n:
        raise HTTPException(status_code=404, detail="Graph not found")
    return n


@router.put("/nodes/{node_id}", response_model=NodeOut)
def update_node(node_id: str, data: NodeUpdate):
    n = GraphOperations.update_node(node_id, data)
    if not n:
        raise HTTPException(status_code=404, detail="Node not found")
    return n


@router.delete("/nodes/{node_id}")
def delete_node(node_id: str):
    GraphOperations.delete_node(node_id)
    return {"status": "deleted"}


@router.post("/graphs/{graph_id}/edges", response_model=EdgeOut, status_code=201)
def add_edge(graph_id: str, data: EdgeCreate):
    e = GraphOperations.add_edge(graph_id, data)
    if not e:
        raise HTTPException(status_code=404, detail="Graph or node not found")
    return e


@router.put("/edges/{edge_id}", response_model=EdgeOut)
def update_edge(edge_id: str, data: EdgeUpdate):
    e = GraphOperations.update_edge(edge_id, data)
    if not e:
        raise HTTPException(status_code=404, detail="Edge not found")
    return e


@router.delete("/edges/{edge_id}")
def delete_edge(edge_id: str):
    GraphOperations.delete_edge(edge_id)
    return {"status": "deleted"}


@router.get("/graphs/{graph_id}/search", response_model=SearchResult)
def search_graph(graph_id: str, q: str = ""):
    if not q:
        return SearchResult()
    try:
        return SearchService.fulltext_search(graph_id, q)
    except Exception:
        return SearchService.simple_search(graph_id, q)


@router.get("/graphs/{graph_id}/path", response_model=PathResult)
def find_path(graph_id: str, source: str, target: str):
    if not source or not target:
        raise HTTPException(status_code=400, detail="source and target required")
    result = PathAlgorithm.shortest_path(graph_id, source, target)
    if result.length == 0:
        result = PathAlgorithm.bfs_shortest_path(graph_id, source, target)
    return result


@router.post("/graphs/merge/preview", response_model=MergePreview)
def merge_preview(data: MergeRequest):
    if data.source_graph_id == data.target_graph_id:
        raise HTTPException(status_code=400, detail="Cannot merge a graph with itself")
    try:
        return MergeService.preview(data.source_graph_id, data.target_graph_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/graphs/merge/execute", response_model=MergeExecuteResult)
def merge_execute(data: MergeExecuteRequest):
    if data.source_graph_id == data.target_graph_id:
        raise HTTPException(status_code=400, detail="Cannot merge a graph with itself")
    try:
        return MergeService.execute(data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Merge failed: {str(e)}")
