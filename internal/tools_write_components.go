package internal

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func registerWriteComponentTools(s *server.MCPServer, node *Node) {
	s.AddTool(mcp.NewTool("insert_component_instance",
		mcp.WithDescription("Create an instance of an existing local component by componentId, or import a published library component by componentKey and create its instance. Specify exactly one source."),
		mcp.WithString("parentId", mcp.Required(), mcp.Description("Target PAGE or FRAME node ID")),
		mcp.WithString("componentId", mcp.Description("Local COMPONENT node ID")),
		mcp.WithString("componentKey", mcp.Description("Published library component key")),
		mcp.WithNumber("x", mcp.Description("Position relative to parent")),
		mcp.WithNumber("y", mcp.Description("Position relative to parent")),
		mcp.WithString("name", mcp.Description("Optional instance layer name")),
		mcp.WithObject("properties", mcp.Description("Optional Figma component properties")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		resp, err := node.Send(ctx, "insert_component_instance", nil, req.GetArguments())
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("navigate_to_page",
		mcp.WithDescription("Switch the active Figma page. Provide either pageId or pageName."),
		mcp.WithString("pageId", mcp.Description("Page node ID in colon format e.g. '0:1'")),
		mcp.WithString("pageName", mcp.Description("Exact page name to navigate to")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := map[string]interface{}{}
		if id, ok := req.GetArguments()["pageId"].(string); ok && id != "" {
			params["pageId"] = id
		}
		if name, ok := req.GetArguments()["pageName"].(string); ok && name != "" {
			params["pageName"] = name
		}
		resp, err := node.Send(ctx, "navigate_to_page", nil, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("group_nodes",
		mcp.WithDescription("Group two or more nodes into a GROUP. All nodes must share the same parent."),
		mcp.WithArray("nodeIds",
			mcp.Required(),
			mcp.Description("Node IDs to group (minimum 2), in colon format e.g. ['4029:12345', '4029:12346']"),
			mcp.WithStringItems(),
		),
		mcp.WithString("name", mcp.Description("Optional name for the new group")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		raw, _ := req.GetArguments()["nodeIds"].([]interface{})
		nodeIDs := toStringSlice(raw)
		params := map[string]interface{}{}
		if name, ok := req.GetArguments()["name"].(string); ok && name != "" {
			params["name"] = name
		}
		resp, err := node.Send(ctx, "group_nodes", nodeIDs, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("wrap_nodes_in_section",
		mcp.WithDescription("Wrap two or more top-level frames from one page in a Figma Section, preserving their node IDs and canvas positions. Use for prototype screens so navigation targets stay usable."),
		mcp.WithArray("nodeIds", mcp.Required(), mcp.Description("Selected top-level FRAME IDs on the same page"), mcp.WithStringItems()),
		mcp.WithString("name", mcp.Description("Name of the new section")),
		mcp.WithNumber("padding", mcp.Description("Padding around the screens in pixels (default 32)")),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		raw, _ := req.GetArguments()["nodeIds"].([]interface{})
		nodeIDs := toStringSlice(raw)
		params := map[string]interface{}{}
		if name, ok := req.GetArguments()["name"].(string); ok && name != "" {
			params["name"] = name
		}
		if padding, ok := req.GetArguments()["padding"].(float64); ok {
			params["padding"] = padding
		}
		resp, err := node.Send(ctx, "wrap_nodes_in_section", nodeIDs, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("ungroup_nodes",
		mcp.WithDescription("Ungroup one or more GROUP nodes, moving their children to the parent and removing the group."),
		mcp.WithArray("nodeIds",
			mcp.Required(),
			mcp.Description("GROUP node IDs in colon format e.g. ['4029:12345']"),
			mcp.WithStringItems(),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		raw, _ := req.GetArguments()["nodeIds"].([]interface{})
		nodeIDs := toStringSlice(raw)
		resp, err := node.Send(ctx, "ungroup_nodes", nodeIDs, nil)
		return renderResponse(resp, err)
	})


	s.AddTool(mcp.NewTool("swap_component",
		mcp.WithDescription("Swap the main component of an existing INSTANCE node, replacing it with a different component while keeping position and size."),
		mcp.WithString("nodeId",
			mcp.Required(),
			mcp.Description("INSTANCE node ID in colon format e.g. 4029:12345"),
		),
		mcp.WithString("componentId",
			mcp.Required(),
			mcp.Description("Target COMPONENT node ID in colon format (from get_local_components)"),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		nodeID, _ := args["nodeId"].(string)
		nodeID = NormalizeNodeID(nodeID)
		componentID, _ := args["componentId"].(string)
		componentID = NormalizeNodeID(componentID)
		params := map[string]interface{}{"componentId": componentID}
		resp, err := node.Send(ctx, "swap_component", []string{nodeID}, params)
		return renderResponse(resp, err)
	})

	s.AddTool(mcp.NewTool("detach_instance",
		mcp.WithDescription("Detach one or more component instances, converting them to plain frames. The link to the main component is broken; all visual properties are preserved."),
		mcp.WithArray("nodeIds",
			mcp.Required(),
			mcp.Description("INSTANCE node IDs in colon format e.g. ['4029:12345']"),
			mcp.WithStringItems(),
		),
	), func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		raw, _ := req.GetArguments()["nodeIds"].([]interface{})
		nodeIDs := toStringSlice(raw)
		for i, id := range nodeIDs {
			nodeIDs[i] = NormalizeNodeID(id)
		}
		resp, err := node.Send(ctx, "detach_instance", nodeIDs, nil)
		return renderResponse(resp, err)
	})
}
