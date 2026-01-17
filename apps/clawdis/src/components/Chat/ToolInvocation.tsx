/**
 * ToolInvocation Component
 * Displays tool calls and results in the chat interface
 */

import type { ToolInvocation as ToolInvocationType } from "../../stores/gateway";
import "./ToolInvocation.css";

interface ToolInvocationProps {
  invocation: ToolInvocationType;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

export function ToolInvocation({
  invocation,
  onApprove,
  onReject,
}: ToolInvocationProps) {
  const {
    toolCallId,
    toolName,
    args,
    result,
    state,
    isError,
    needsApproval,
    approved,
  } = invocation;

  return (
    <div className={`tool-invocation tool-invocation--${state}`}>
      <div className="tool-invocation-header">
        <span className="tool-invocation-icon">
          {state === "pending"
            ? "⏳"
            : state === "result"
              ? isError
                ? "❌"
                : "✓"
              : "⚙️"}
        </span>
        <span className="tool-invocation-name">{toolName ?? "Tool"}</span>
        <span className="tool-invocation-state">{state}</span>
      </div>

      {args !== undefined && (
        <div className="tool-invocation-section">
          <div className="tool-invocation-label">Arguments</div>
          <pre className="tool-invocation-code">
            {typeof args === "string" ? args : JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}

      {state === "result" && result !== undefined && (
        <div className="tool-invocation-section">
          <div className="tool-invocation-label">
            {isError ? "Error" : "Result"}
          </div>
          <pre
            className={`tool-invocation-code ${isError ? "tool-invocation-code--error" : ""}`}
          >
            {typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {/* Approval buttons for pending tool calls */}
      {needsApproval && approved === undefined && (
        <div className="tool-invocation-actions">
          <button
            type="button"
            className="tool-invocation-btn tool-invocation-btn--approve"
            onClick={() => onApprove?.(toolCallId)}
          >
            Approve
          </button>
          <button
            type="button"
            className="tool-invocation-btn tool-invocation-btn--reject"
            onClick={() => onReject?.(toolCallId)}
          >
            Reject
          </button>
        </div>
      )}

      {/* Show approval status */}
      {approved !== undefined && (
        <div
          className={`tool-invocation-approval ${approved ? "approved" : "rejected"}`}
        >
          {approved ? "✓ Approved" : "✗ Rejected"}
        </div>
      )}
    </div>
  );
}
