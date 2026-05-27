from app.models.database import Neo4jConnection
from app.models.schemas import SearchResult, NodeOut, EdgeOut


class SearchService:

    @staticmethod
    def fulltext_search(graph_id: str, query: str) -> SearchResult:
        with Neo4jConnection.session() as s:
            try:
                s.run(
                    """
                    CALL db.index.fulltext.createNodeIndex IF NOT EXISTS
                    ('node_search', ['Node'], ['label', 'properties'])
                    """
                )
            except Exception:
                pass
            try:
                s.run(
                    """
                    CALL db.index.fulltext.createNodeIndex IF NOT EXISTS
                    ('edge_search', ['Edge'], ['label', 'properties'])
                    """
                )
            except Exception:
                pass

            nodes = []
            node_result = s.run(
                """
                CALL db.index.fulltext.queryNodes('node_search', $q)
                YIELD node, score
                WHERE node.graph_id = $gid
                RETURN node, score
                ORDER BY score DESC
                LIMIT 50
                """,
                q=query, gid=graph_id,
            )
            for rec in node_result:
                n = rec["node"]
                nodes.append(NodeOut(
                    id=n["id"], label=n["label"],
                    properties=dict(n.get("properties", {})),
                    graph_id=n["graph_id"],
                ))

            edges = []
            edge_result = s.run(
                """
                CALL db.index.fulltext.queryNodes('edge_search', $q)
                YIELD node, score
                WHERE node:Edge AND node.graph_id = $gid
                RETURN node, score
                ORDER BY score DESC
                LIMIT 50
                """,
                q=query, gid=graph_id,
            )
            for rec in edge_result:
                e = rec["node"]
                edges.append(EdgeOut(
                    id=e["id"], source_id=e["source_id"], target_id=e["target_id"],
                    label=e["label"], properties=dict(e.get("properties", {})),
                    graph_id=e["graph_id"],
                ))

        return SearchResult(nodes=nodes, edges=edges)

    @staticmethod
    def simple_search(graph_id: str, query: str) -> SearchResult:
        pattern = f"(?i).*{query}.*"
        with Neo4jConnection.session() as s:
            node_result = s.run(
                """
                MATCH (n:Node {graph_id: $gid})
                WHERE n.label =~ $pattern
                   OR ANY(k IN keys(n.properties) WHERE n.properties[k] =~ $pattern)
                RETURN n
                LIMIT 50
                """,
                gid=graph_id, pattern=pattern,
            )
            nodes = []
            for rec in node_result:
                n = rec["n"]
                nodes.append(NodeOut(
                    id=n["id"], label=n["label"],
                    properties=dict(n.get("properties", {})),
                    graph_id=n["graph_id"],
                ))

            edge_result = s.run(
                """
                MATCH (e:Edge {graph_id: $gid})
                WHERE e.label =~ $pattern
                   OR ANY(k IN keys(e.properties) WHERE e.properties[k] =~ $pattern)
                RETURN e
                LIMIT 50
                """,
                gid=graph_id, pattern=pattern,
            )
            edges = []
            for rec in edge_result:
                e = rec["e"]
                edges.append(EdgeOut(
                    id=e["id"], source_id=e["source_id"], target_id=e["target_id"],
                    label=e["label"], properties=dict(e.get("properties", {})),
                    graph_id=e["graph_id"],
                ))

        return SearchResult(nodes=nodes, edges=edges)
