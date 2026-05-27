from app.models.database import Neo4jConnection
from app.models.schemas import (
    NodeOut, EdgeOut,
    MergePreview, ConflictNode, ConflictProperty,
    MergeExecuteRequest, MergeExecuteResult, ConflictResolution,
)
from app.services.graph_ops import GraphOperations
from datetime import datetime


class MergeService:

    @staticmethod
    def preview(source_graph_id: str, target_graph_id: str) -> MergePreview:
        source_graph = GraphOperations.get_graph(source_graph_id)
        target_graph = GraphOperations.get_graph(target_graph_id)

        if not source_graph:
            raise ValueError(f"Source graph {source_graph_id} not found")
        if not target_graph:
            raise ValueError(f"Target graph {target_graph_id} not found")

        source_nodes = source_graph.nodes
        target_nodes = target_graph.nodes

        target_label_map: dict[str, list[NodeOut]] = {}
        for tn in target_nodes:
            target_label_map.setdefault(tn.label, []).append(tn)

        auto_merged_nodes: list[NodeOut] = []
        unique_source_nodes: list[NodeOut] = []
        conflicts: list[ConflictNode] = []
        matched_target_ids: set[str] = set()

        for sn in source_nodes:
            same_label_nodes = target_label_map.get(sn.label, [])
            if not same_label_nodes:
                unique_source_nodes.append(sn)
                continue

            matched_tn = None
            for tn in same_label_nodes:
                if tn.id not in matched_target_ids:
                    matched_tn = tn
                    matched_target_ids.add(tn.id)
                    break

            if matched_tn is None:
                unique_source_nodes.append(sn)
                continue

            conflict_props: list[ConflictProperty] = []
            all_keys = set(list(sn.properties.keys()) + list(matched_tn.properties.keys()))
            for key in all_keys:
                sv = sn.properties.get(key, "")
                tv = matched_tn.properties.get(key, "")
                if sv != tv:
                    conflict_props.append(ConflictProperty(
                        key=key, source_value=sv, target_value=tv,
                    ))

            if conflict_props:
                conflicts.append(ConflictNode(
                    source_node=sn, target_node=matched_tn,
                    conflict_properties=conflict_props,
                ))
            else:
                auto_merged_nodes.append(sn)

        unique_target_nodes = [
            tn for tn in target_nodes if tn.id not in matched_target_ids
        ]

        return MergePreview(
            source_graph_id=source_graph_id,
            target_graph_id=target_graph_id,
            auto_merged_nodes=auto_merged_nodes,
            auto_merged_count=len(auto_merged_nodes),
            unique_source_nodes=unique_source_nodes,
            unique_target_nodes=unique_target_nodes,
            conflicts=conflicts,
            total_source_nodes=len(source_nodes),
            total_target_nodes=len(target_nodes),
            total_source_edges=len(source_graph.edges),
            total_target_edges=len(target_graph.edges),
        )

    @staticmethod
    def execute(data: MergeExecuteRequest) -> MergeExecuteResult:
        preview = MergeService.preview(data.source_graph_id, data.target_graph_id)

        source_graph = GraphOperations.get_graph(data.source_graph_id)
        target_graph = GraphOperations.get_graph(data.target_graph_id)

        if not source_graph or not target_graph:
            raise ValueError("Source or target graph not found")

        now = datetime.utcnow().isoformat()
        merged_name = data.merged_name or f"{source_graph.name} + {target_graph.name}"

        resolution_map: dict[str, ConflictResolution] = {}
        for r in data.resolutions:
            resolution_map[f"{r.source_node_id}::{r.target_node_id}"] = r

        with Neo4jConnection.session() as session:
            tx = session.begin_transaction()
            try:
                result = tx.run(
                    """
                    CREATE (g:Graph {id: randomUUID(), name: $name,
                             description: $desc, created_at: $now, updated_at: $now})
                    RETURN g
                    """,
                    name=merged_name,
                    desc=f"Merged from {source_graph.name} and {target_graph.name}",
                    now=now,
                )
                rec = result.single()
                merged_graph_id = rec["g"]["id"]

                source_node_id_map: dict[str, str] = {}
                target_node_id_map: dict[str, str] = {}

                for sn in source_graph.nodes:
                    matched_conflict = None
                    for c in preview.conflicts:
                        if c.source_node.id == sn.id:
                            matched_conflict = c
                            break

                    if matched_conflict:
                        resolution = resolution_map.get(
                            f"{matched_conflict.source_node.id}::{matched_conflict.target_node.id}"
                        )
                        if resolution and resolution.resolution == "target":
                            new_props = dict(matched_conflict.target_node.properties)
                        elif resolution and resolution.resolution == "merge":
                            new_props = dict(matched_conflict.source_node.properties)
                            if resolution.merged_properties:
                                new_props.update(resolution.merged_properties)
                        else:
                            new_props = dict(matched_conflict.source_node.properties)

                        new_node_id = _create_node_in_tx(
                            tx, merged_graph_id, sn.label, new_props
                        )
                        source_node_id_map[sn.id] = new_node_id
                        target_node_id_map[matched_conflict.target_node.id] = new_node_id
                    else:
                        is_auto = any(n.id == sn.id for n in preview.auto_merged_nodes)
                        if is_auto:
                            new_props = dict(sn.properties)
                            for tn in target_graph.nodes:
                                if tn.label == sn.label and tn.id not in target_node_id_map:
                                    for k, v in tn.properties.items():
                                        if k not in new_props:
                                            new_props[k] = v
                                    target_node_id_map[tn.id] = "pending"
                                    break
                            new_node_id = _create_node_in_tx(
                                tx, merged_graph_id, sn.label, new_props
                            )
                            source_node_id_map[sn.id] = new_node_id
                            for k, v in list(target_node_id_map.items()):
                                if v == "pending":
                                    target_node_id_map[k] = new_node_id
                                    break
                        else:
                            new_node_id = _create_node_in_tx(
                                tx, merged_graph_id, sn.label, dict(sn.properties)
                            )
                            source_node_id_map[sn.id] = new_node_id

                for tn in preview.unique_target_nodes:
                    new_node_id = _create_node_in_tx(
                        tx, merged_graph_id, tn.label, dict(tn.properties)
                    )
                    target_node_id_map[tn.id] = new_node_id

                for edge in source_graph.edges:
                    new_src = source_node_id_map.get(edge.source_id)
                    new_tgt = source_node_id_map.get(edge.target_id)
                    if new_src and new_tgt:
                        _create_edge_in_tx(
                            tx, merged_graph_id, new_src, new_tgt,
                            edge.label, dict(edge.properties),
                        )

                for edge in target_graph.edges:
                    new_src = target_node_id_map.get(edge.source_id)
                    new_tgt = target_node_id_map.get(edge.target_id)
                    if new_src and new_tgt:
                        _create_edge_in_tx(
                            tx, merged_graph_id, new_src, new_tgt,
                            edge.label, dict(edge.properties),
                        )

                tx.commit()
            except Exception:
                tx.rollback()
                raise

        if data.delete_source:
            GraphOperations.delete_graph(data.source_graph_id)
        if data.delete_target:
            GraphOperations.delete_graph(data.target_graph_id)

        merged = GraphOperations.get_graph(merged_graph_id)
        return MergeExecuteResult(
            merged_graph_id=merged_graph_id,
            merged_graph_name=merged_name,
            total_nodes=len(merged.nodes) if merged else 0,
            total_edges=len(merged.edges) if merged else 0,
            conflicts_resolved=len(data.resolutions),
        )


def _create_node_in_tx(tx, graph_id: str, label: str, properties: dict) -> str:
    result = tx.run(
        """
        MATCH (g:Graph {id: $gid})
        CREATE (n:Node {id: randomUUID(), label: $label, properties: $props, graph_id: $gid})
        CREATE (g)-[:HAS_NODE]->(n)
        RETURN n.id AS nid
        """,
        gid=graph_id, label=label, props=properties,
    )
    rec = result.single()
    return rec["nid"]


def _create_edge_in_tx(tx, graph_id: str, source_id: str, target_id: str, label: str, properties: dict) -> str:
    result = tx.run(
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
        RETURN e.id AS eid
        """,
        gid=graph_id, src_id=source_id, tgt_id=target_id,
        label=label, props=properties,
    )
    rec = result.single()
    return rec["eid"]
