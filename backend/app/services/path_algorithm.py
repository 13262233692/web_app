from app.models.database import Neo4jConnection
from app.models.schemas import PathResult, NodeOut, EdgeOut


class PathAlgorithm:

    @staticmethod
    def shortest_path(graph_id: str, source_id: str, target_id: str) -> PathResult:
        with Neo4jConnection.session() as s:
            result = s.run(
                """
                MATCH (src:Node {id: $src_id, graph_id: $gid})
                MATCH (tgt:Node {id: $tgt_id, graph_id: $gid})
                MATCH path = shortestPath((src)-[:CONNECTED_BY|CONNECTS_TO*]-(tgt))
                RETURN [n IN nodes(path) WHERE n:Node | n.id] AS node_ids,
                       [r IN relationships(path) WHERE type(r) = 'CONNECTS_TO' | endNode(r).id] AS via_edges
                """,
                gid=graph_id, src_id=source_id, tgt_id=target_id,
            )
            rec = result.single()
            if not rec:
                return PathResult(node_ids=[], edge_ids=[], length=0)

            node_ids = rec["node_ids"]
            return PathResult(
                node_ids=node_ids,
                edge_ids=rec.get("via_edges", []),
                length=len(node_ids) - 1 if len(node_ids) > 1 else 0,
            )

    @staticmethod
    def bfs_shortest_path(graph_id: str, source_id: str, target_id: str) -> PathResult:
        with Neo4jConnection.session() as s:
            node_result = s.run(
                """
                MATCH (n:Node {graph_id: $gid})
                RETURN n.id AS id, n.label AS label, n.properties AS props
                """,
                gid=graph_id,
            )
            nodes = {}
            for rec in node_result:
                nodes[rec["id"]] = NodeOut(
                    id=rec["id"], label=rec["label"],
                    properties=dict(rec.get("props", {})), graph_id=graph_id,
                )

            edge_result = s.run(
                """
                MATCH (e:Edge {graph_id: $gid})
                RETURN e.id AS id, e.source_id AS src, e.target_id AS tgt
                """,
                gid=graph_id,
            )
            adj = {nid: [] for nid in nodes}
            edge_map = {}
            for rec in edge_result:
                src, tgt, eid = rec["src"], rec["tgt"], rec["id"]
                adj.setdefault(src, []).append((tgt, eid))
                adj.setdefault(tgt, []).append((src, eid))
                edge_map[eid] = EdgeOut(
                    id=eid, source_id=src, target_id=tgt,
                    label="", properties={}, graph_id=graph_id,
                )

        if source_id not in nodes or target_id not in nodes:
            return PathResult(node_ids=[], edge_ids=[], length=0)
        if source_id == target_id:
            return PathResult(node_ids=[source_id], edge_ids=[], length=0)

        from collections import deque
        visited = {source_id}
        queue = deque([(source_id, [source_id], [])])

        while queue:
            current, path_nodes, path_edges = queue.popleft()
            for neighbor, eid in adj.get(current, []):
                if neighbor in visited:
                    continue
                new_nodes = path_nodes + [neighbor]
                new_edges = path_edges + [eid]
                if neighbor == target_id:
                    return PathResult(
                        node_ids=new_nodes, edge_ids=new_edges,
                        length=len(new_edges),
                    )
                visited.add(neighbor)
                queue.append((neighbor, new_nodes, new_edges))

        return PathResult(node_ids=[], edge_ids=[], length=0)
