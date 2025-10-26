import { Handle, Position } from "reactflow"
import { HANDLE_CLASS, HANDLE_STYLE } from "../utils/constants"

export function NodeHandles({ isConnectable }: { isConnectable: boolean }) {
  return (
    <>
      <Handle
        type="target"
        id="target-left"
        position={Position.Left}
        className={HANDLE_CLASS}
        style={HANDLE_STYLE}
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        id="target-top"
        position={Position.Top}
        className={HANDLE_CLASS}
        style={HANDLE_STYLE}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        id="source-right"
        position={Position.Right}
        className={HANDLE_CLASS}
        style={HANDLE_STYLE}
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        id="source-bottom"
        position={Position.Bottom}
        className={HANDLE_CLASS}
        style={HANDLE_STYLE}
        isConnectable={isConnectable}
      />
    </>
  )
}

