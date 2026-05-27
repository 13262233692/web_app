from app.models.database import Neo4jConnection
from app.models.schemas import (
    GraphCreate, GraphUpdate, GraphOut, GraphSummary,
    NodeCreate, NodeUpdate, NodeOut,
    EdgeCreate, EdgeUpdate, EdgeOut,
)
from datetime import datetime


class GraphOperations:

    @staticmethod
    def create_graph(data: GraphCreate) -> GraphOut:
        now = datetime.utcnow().isoformat()
        with Neo4jConnection.session() as s:
            result = s.run(
                """
                CREATE (g:Graph {id: randomUUID(), name: $name, description: $description,
                         created_at: $now, updated_at: $now})
                RETURN g
                """,
                name=data.name, description=data.description, now=now,
            )
            rec = result.single()
            g = rec["g"]
            return GraphOut(
                id=g["id"], name=g["name"], description=g.get("description", ""),
                created_at=g["created_at"], updated_at=g["updated_at"],
            )

    @staticmethod
    def list_graphs() -> list[GraphSummary]:
        with Neo4jConnection.session() as s:
            result = s.run(
                """
                MATCH (g:Graph)
                OPTIONAL MATCH (g)-[:HAS_NODE]->(n:Node)
                WITH g, count(n) AS nc
                OPTIONAL MATCH (g)-[:HAS_EDGE]->(e:Edge)
                RETURN g, nc, count(e) AS ec
                ORDER BY g.created_at DESC
                """
            )
            out = []
            for rec in result:
                g = rec["g"]
                out.append(GraphSummary(
                    id=g["id"], name=g["name"], description=g.get("description", ""),
                    node_count=rec["nc"], edge_count=rec["ec"],
                    created_at=g.get("created_at"), updated_at=g.get("updated_at"),
                ))
            return out

    @staticmethod
    def get_graph(graph_id: str) -> GraphOut | None:
        with Neo4jConnection.session() as s:
            result = s.run(
                """
                MATCH (g:Graph {id: $gid})
                OPTIONAL MATCH (g)-[:HAS_NODE]->(n:Node)
                OPTIONAL MATCH (g)-[:HAS_EDGE]->(e:Edge)
                RETURN g, collect(DISTINCT n) AS nodes, collect(DISTINCT e) AS edges
                """,
                gid=graph_id,
            )
            rec = result.single()
            if not rec or not rec["g"]:
                return None
            g = rec["g"]
            nodes = [
                NodeOut(
                    id=n["id"], label=n["label"],
                    properties=dict(n.get("properties", {})),
                    graph_id=graph_id,
                )
                for n in rec["nodes"] if n is not None
            ]
            edges = [
                EdgeOut(
                    id=e["id"], source_id=e["source_id"], target_id=e["target_id"],
                    label=e["label"], properties=dict(e.get("properties", {})),
                    graph_id=graph_id,
                )
                for e in rec["edges"] if e is not None
            ]
            return GraphOut(
                id=g["id"], name=g["name"], description=g.get("description", ""),
                created_at=g.get("created_at"), updated_at=g.get("updated_at"),
                nodes=nodes, edges=edges,
            )

    @staticmethod
    def update_graph(graph_id: str, data: GraphUpdate) -> GraphOut | None:
        now = datetime.utcnow().isoformat()
        sets = []
        params = {"gid": graph_id, "now": now}
        if data.name is not None:
            sets.append("g.name = $name")
            params["name"] = data.name
        if data.description is not None:
            sets.append("g.description = $desc")
            params["desc"] = data.description
        if not sets:
            return GraphOperations.get_graph(graph_id)
        sets.append("g.updated_at = $now")
        cypher = f"MATCH (g:Graph {{id: $gid}}) SET {', '.join(sets)} RETURN g"
        with Neo4jConnection.session() as s:
            result = s.run(cypher, **params)
            rec = result.single()
            if not rec:
                return None
            g = rec["g"]
            return GraphOut(
                id=g["id"], name=g["name"], description=g.get("description", ""),
                created_at=g.get("created_at"), updated_at=g.get("updated_at"),
            )

    @staticmethod
    def delete_graph(graph_id: str) -> bool:
        with Neo4jConnection.session() as s:
            s.run(
                """
                MATCH (g:Graph {id: $gid})
                OPTIONAL MATCH (g)-[:HAS_NODE]->(n:Node)
                OPTIONAL MATCH (g)-[:HAS_EDGE]->(e:Edge)
                DETACH DELETE n, e, g
                """,
                gid=graph_id,
            )
        return True

    @staticmethod
    def add_node(graph_id: str, data: NodeCreate) -> NodeOut | None:
        with Neo4jConnection.session() as s:
            result = s.run(
                """
                MATCH (g:Graph {id: $gid})
                CREATE (n:Node {id: randomUUID(), label: $label, properties: $props, graph_id: $gid})
                CREATE (g)-[:HAS_NODE]->(n)
                RETURN n
                """,
                gid=graph_id, label=data.label, props=data.properties,
            )
            rec = result.single()
            if not rec:
                return None
            n = rec["n"]
            return NodeOut(
                id=n["id"], label=n["label"],
                properties=dict(n.get("properties", {})), graph_id=graph_id,
            )

    @staticmethod
    def update_node(node_id: str, data: NodeUpdate) -> NodeOut | None:
        sets = []
        params = {"nid": node_id}
        if data.label is not None:
            sets.append("n.label = $label")
            params["label"] = data.label
        if data.properties is not None:
            sets.append("n.properties = $props")
            params["props"] = data.properties
        if not sets:
            with Neo4jConnection.session() as s:
                result = s.run("MATCH (n:Node {id: $nid}) RETURN n", nid=node_id)
                rec = result.single()
                if not rec:
                    return None
                n = rec["n"]
                return NodeOut(
                    id=n["id"], label=n["label"],
                    properties=dict(n.get("properties", {})), graph_id=n["graph_id"],
                )
        cypher = f"MATCH (n:Node {{id: $nid}}) SET {', '.join(sets)} RETURN n"
        with Neo4jConnection.session() as s:
            result = s.run(cypher, **params)
            rec = result.single()
            if not rec:
                return None
            n = rec["n"]
            return NodeOut(
                id=n["id"], label=n["label"],
                properties=dict(n.get("properties", {})), graph_id=n["graph_id"],
            )

    @staticmethod
    def delete_node(node_id: str) -> bool:
        with Neo4jConnection.session() as s:
            s.run(
                "MATCH (n:Node {id: $nid}) DETACH DELETE n", nid=node_id
            )
        return True

    @staticmethod
    def add_edge(graph_id: str, data: EdgeCreate) -> EdgeOut | None:
        with Neo4jConnection.session() as s:
            result = s.run(
                """
                MATCH (g:Graph {id: $gid})
                MATCH (src:Node {id: $src_id})
                MATCH (tgt:Node {id: $tgt_id})
                CREATE (e:Edge {
                    id: randomUUID(), source_id: $src_id, target_id: $tgt_id,
                    label: $label, properties: $props, graph_id: $gid
                })
                CREATE (g)-[:HAS_EDGE]->(e)
                CREATE (src)-[:CONNECTED_BY]->(e)
                CREATE (e)-[:CONNECTS_TO]->(tgt)
                RETURN e
                """,
                gid=graph_id, src_id=data.source_id, tgt_id=data.target_id,
                label=data.label, props=data.properties,
            )
            rec = result.single()
            if not rec:
                return None
            e = rec["e"]
            return EdgeOut(
                id=e["id"], source_id=e["source_id"], target_id=e["target_id"],
                label=e["label"], properties=dict(e.get("properties", {})),
                graph_id=graph_id,
            )

    @staticmethod
    def update_edge(edge_id: str, data: EdgeUpdate) -> EdgeOut | None:
        sets = []
        params = {"eid": edge_id}
        if data.label is not None:
            sets.append("e.label = $label")
            params["label"] = data.label
        if data.properties is not None:
            sets.append("e.properties = $props")
            params["props"] = data.properties
        if not sets:
            with Neo4jConnection.session() as s:
                result = s.run("MATCH (e:Edge {id: $eid}) RETURN e", eid=edge_id)
                rec = result.single()
                if not rec:
                    return None
                e = rec["e"]
                return EdgeOut(
                    id=e["id"], source_id=e["source_id"], target_id=e["target_id"],
                    label=e["label"], properties=dict(e.get("properties", {})),
                    graph_id=e["graph_id"],
                )
        cypher = f"MATCH (e:Edge {{id: $eid}}) SET {', '.join(sets)} RETURN e"
        with Neo4jConnection.session() as s:
            result = s.run(cypher, **params)
            rec = result.single()
            if not rec:
                return None
            e = rec["e"]
            return EdgeOut(
                id=e["id"], source_id=e["source_id"], target_id=e["target_id"],
                label=e["label"], properties=dict(e.get("properties", {})),
                graph_id=e["graph_id"],
            )

    @staticmethod
    def delete_edge(edge_id: str) -> bool:
        with Neo4jConnection.session() as s:
            s.run("MATCH (e:Edge {id: $eid}) DETACH DELETE e", eid=edge_id)
        return True
