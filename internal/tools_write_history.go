package internal

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func registerWriteHistoryTools(s *server.MCPServer, node *Node) {
	groupTool := func(name, description string) {
		s.AddTool(mcp.NewTool(name,
			mcp.WithDescription(description),
			mcp.WithString("groupId", mcp.Required(), mcp.Description("Caller-generated undo group id")),
		), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			groupID, _ := req.GetArguments()["groupId"].(string)
			resp, err := node.Send(ctx, name, nil, map[string]interface{}{"groupId": groupID})
			return renderResponse(resp, err)
		})
	}

	groupTool("begin_undo_group", "Start one grouped Figma undo transaction. Writes remain in this group until commit or trigger undo.")
	groupTool("commit_undo_group", "Commit the active grouped transaction as one native Figma undo step.")
	groupTool("trigger_undo_group", "Undo every write in the active grouped transaction with Figma's native undo API.")
	s.AddTool(mcp.NewTool("get_undo_group",
		mcp.WithDescription("Read the active grouped undo transaction and its successful mutation count."),
	), makeHandler(node, "get_undo_group", nil, map[string]interface{}{}))
}
