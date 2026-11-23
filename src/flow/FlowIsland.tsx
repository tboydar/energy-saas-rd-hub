import {
  Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow,
  useEdgesState, useNodesInitialized, useNodesState, useReactFlow, type Connection, type Edge, type Node, type NodeProps, type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/style.css';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';

// 互動流程圖的「React 島」。
// 全站其他部分是原生 TypeScript；只有流程圖用 xyflow（React Flow）。
// 頁面呼叫 mountFlow(容器, 節點與連線的純資料, 選項)，拿回 { update, destroy }，
// 完全不需要知道 React 的存在。這個檔案（連同 React）是延遲載入的。

export type FlowTone = 'idle' | 'ok' | 'warn' | 'crit' | 'active' | 'done';

export type FlowNodeSpec = {
  id: string;
  /** 預設位置；使用者拖曳後的位置會記在 localStorage，優先採用。 */
  x: number;
  y: number;
  title: string;
  tag?: string;
  subtitle?: string;
  badge?: string;
  tone?: FlowTone;
  stats?: { label: string; value: string }[];
  action?: { id: string; label: string; primary?: boolean; lockedWhy?: string };
  /** 可以從這個節點拉出連線／可以被連線接上（用於「拖曳改變對齊關係」）。 */
  canSource?: boolean;
  canTarget?: boolean;
  width?: number;
};

export type FlowEdgeSpec = {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  tone?: FlowTone;
  dashed?: boolean;
  curve?: 'smoothstep' | 'default' | 'straight';
};

export type FlowSpec = { nodes: FlowNodeSpec[]; edges: FlowEdgeSpec[] };

export type FlowOptions = {
  /** 給了就會記住使用者拖曳後的版面。 */
  layoutKey?: string;
  minimap?: boolean;
  labels: { reset: string; hint: string };
  onNodeClick?(id: string): void;
  onAction?(nodeId: string, actionId: string): void;
  /** 給了就允許使用者從節點拉線；回傳值不重要，頁面自行更新資料後再 update()。 */
  onConnect?(source: string, target: string): void;
};

export type FlowHandle = { update(spec: FlowSpec, selected?: string | null): void; destroy(): void };

type CardData = FlowNodeSpec & { onAction?: FlowOptions['onAction'] };
type CardNode = Node<CardData, 'card'>;
type Snapshot = { spec: FlowSpec; selected: string | null };
type Bus = { get(): Snapshot; subscribe(fn: () => void): () => void };
type Layout = Record<string, { x: number; y: number }>;

const TONE_COLOR: Record<FlowTone, string> = { idle: '#8b9aa1', ok: '#2f6f9f', warn: '#b97c00', crit: '#d03b3b', active: '#e2552f', done: '#0a7a2c' };
const LAYOUT_PREFIX = 'esrd:flow:';
// v13 的 padding 可以帶單位；明確寫 px，避免不同版本對純數字的解讀不同。
const FIT_PADDING = '26px';

function loadLayout(key?: string): Layout {
  if (!key) return {};
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_PREFIX + key) ?? '{}') as Layout;
  } catch {
    return {};
  }
}

function saveLayout(key: string | undefined, layout: Layout): void {
  if (!key) return;
  try {
    localStorage.setItem(LAYOUT_PREFIX + key, JSON.stringify(layout));
  } catch {
    // localStorage 不可用時，版面只保留到離開頁面為止
  }
}

function Card({ id, data }: NodeProps<CardNode>) {
  const tone = data.tone ?? 'idle';
  const action = data.action;
  return (
    <div className={`fnode tone-${tone}`} style={data.width ? { width: data.width } : undefined}>
      <Handle type="target" position={Position.Left} isConnectable={!!data.canTarget} className={data.canTarget ? 'is-open' : ''} />
      {(data.tag || data.badge) && (
        <div className="fnode-head">
          {data.tag && <span className="tag">{data.tag}</span>}
          {data.badge && <span className="fnode-badge">{data.badge}</span>}
        </div>
      )}
      <div className="fnode-title">{data.title}</div>
      {data.subtitle && <div className="fnode-sub">{data.subtitle}</div>}
      {data.stats && (
        <dl className="fnode-stats">
          {data.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {action && (
        <button
          type="button"
          className={`btn btn-sm nodrag ${action.primary ? 'btn-primary' : ''}`}
          aria-disabled={action.lockedWhy ? 'true' : undefined}
          data-why={action.lockedWhy}
          title={action.lockedWhy}
          onClick={(event) => {
            event.stopPropagation();
            data.onAction?.(id, action.id);
          }}
        >
          {action.label}
        </button>
      )}
      <Handle type="source" position={Position.Right} isConnectable={!!data.canSource} className={data.canSource ? 'is-open' : ''} />
    </div>
  );
}

const nodeTypes = { card: Card };

function toEdge(e: FlowEdgeSpec): Edge {
  const color = TONE_COLOR[e.tone ?? 'idle'];
  return {
    id: e.id, source: e.source, target: e.target, label: e.label, animated: e.animated, type: e.curve ?? 'smoothstep',
    style: { stroke: color, strokeWidth: 2, strokeDasharray: e.dashed ? '6 5' : undefined },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
    labelStyle: { fontSize: 13, fill: '#1d2a30' }, labelBgStyle: { fill: '#fafbfa' }, labelBgPadding: [6, 3], labelBgBorderRadius: 3,
  };
}

/** 把頁面給的純資料轉成 xyflow 節點；已存在的節點保留目前位置（使用者可能拖過）。 */
function toNodes(snap: Snapshot, layout: Layout, options: FlowOptions, prev: CardNode[]): CardNode[] {
  const old = new Map(prev.map((n) => [n.id, n]));
  return snap.spec.nodes.map((n): CardNode => {
    const before = old.get(n.id);
    return {
      ...before,
      id: n.id,
      type: 'card',
      position: before?.position ?? layout[n.id] ?? { x: n.x, y: n.y },
      data: { ...n, onAction: options.onAction },
      selected: snap.selected === n.id,
    };
  });
}

/** 等所有節點都量到實際尺寸後再置中縮放；太早做會用錯誤的尺寸計算。 */
function AutoFit() {
  const ready = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (ready) void fitView({ padding: FIT_PADDING });
  }, [ready, fitView]);
  return null;
}

function FlowApp({ bus, options }: { bus: Bus; options: FlowOptions }) {
  const snap = useSyncExternalStore(bus.subscribe, bus.get);
  const layout = useRef<Layout>(loadLayout(options.layoutKey));
  const instance = useRef<ReactFlowInstance<CardNode, Edge> | null>(null);
  // 第一次 render 就帶入節點，fitView 才有東西可以對齊。
  const [nodes, setNodes, onNodesChange] = useNodesState<CardNode>(toNodes(snap, layout.current, options, []));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(snap.spec.edges.map(toEdge));
  const first = useRef(true);

  // 頁面之後送來新的資料時，只更新內容。
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setNodes((prev) => toNodes(snap, layout.current, options, prev));
    setEdges(snap.spec.edges.map(toEdge));
  }, [snap, options, setNodes, setEdges]);

  const resetLayout = useCallback(() => {
    layout.current = {};
    saveLayout(options.layoutKey, {});
    const home = new Map(bus.get().spec.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    setNodes((prev) => prev.map((n) => ({ ...n, position: home.get(n.id) ?? n.position })));
    requestAnimationFrame(() => void instance.current?.fitView({ padding: FIT_PADDING, duration: 300 }));
  }, [bus, options.layoutKey, setNodes]);

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target) options.onConnect?.(c.source, c.target);
  }, [options]);

  return (
    <>
      <div className="flow-bar">
        <span>{options.labels.hint}</span>
        <button type="button" className="btn btn-sm" onClick={resetLayout}>{options.labels.reset}</button>
      </div>
      <div className="flow-canvas">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onInit={(rf) => { instance.current = rf; }}
      onNodeClick={(_event, node) => options.onNodeClick?.(node.id)}
      onNodeDragStop={(_event, node) => {
        layout.current[node.id] = node.position;
        saveLayout(options.layoutKey, layout.current);
      }}
      onConnect={onConnect}
      nodesConnectable={!!options.onConnect}
      edgesFocusable={false}
      deleteKeyCode={null}
      forceColorMode="light"
      minZoom={0.35}
      maxZoom={1.8}
      // 滾輪留給頁面捲動；要縮放請按住 Ctrl／⌘ 再滾，或用左下角的控制鈕。
      zoomOnScroll={false}
      preventScrolling={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#b9c6c2" />
      <Controls showInteractive={false} />
      {options.minimap && <MiniMap pannable zoomable nodeColor={(n) => TONE_COLOR[(n.data as CardData).tone ?? 'idle']} nodeStrokeWidth={0} />}
      <AutoFit />
    </ReactFlow>
      </div>
    </>
  );
}

export function mountFlow(container: HTMLElement, spec: FlowSpec, options: FlowOptions): FlowHandle {
  let snap: Snapshot = { spec, selected: null };
  const listeners = new Set<() => void>();
  const bus: Bus = {
    get: () => snap,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  const root = createRoot(container);
  root.render(<FlowApp bus={bus} options={options} />);
  return {
    update(next, selected) {
      snap = { spec: next, selected: selected === undefined ? snap.selected : selected };
      listeners.forEach((fn) => fn());
    },
    destroy: () => root.unmount(),
  };
}
