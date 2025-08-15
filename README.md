# NPM Package Docs MCP

A Model Context Protocol (MCP) tool that provides up-to-date documentation for npm packages directly in your IDE. This tool fetches the latest README documentation from either the package's GitHub repository or the README bundled with the npm package itself.

## What it does

This MCP tool helps your IDE (like Cursor) get the most current documentation for any npm package instead of relying on outdated or incomplete information. It works by:

1. **GitHub Repository First**: If the package has a GitHub repository, it fetches the README directly from the repository's main branch (trying `master`, `main`, or `develop` branches)
2. **NPM Package Fallback**: If no GitHub repository is available, it downloads the package tarball and extracts the README file from the bundled package
3. **Real-time Updates**: Always gets the latest documentation, ensuring you have the most current information

## Why this matters

- **No more guesswork**: Get accurate, up-to-date documentation instead of relying on potentially outdated IDE suggestions
- **Better development experience**: Understand package APIs and usage patterns with current documentation
- **Reduced errors**: Avoid issues caused by using outdated API references or deprecated methods
- **Seamless integration**: Works directly in your IDE through the MCP protocol

## Tools Provided

### `get_docs_for_npm_package`

**Description**: Retrieves the latest documentation for any npm package

**Parameters**:
- `packageName` (string): The name of the npm package (e.g., "react", "lodash", "express")

**Returns**: The README content as text, either from the GitHub repository or the package tarball

**Example Usage**:
```typescript
// In your IDE, you can now ask for documentation like:
// "Show me the docs for express"
// "What's the latest API for react-router-dom?"
// "Get documentation for axios"
```

## How it Works

1. **Package Lookup**: Queries the npm registry to get package metadata
2. **Repository Detection**: Checks if the package has a GitHub repository URL
3. **GitHub Fetch**: If available, fetches README.md from the repository's main branch
4. **Tarball Extraction**: If no GitHub repo, downloads and extracts the package tarball to find the README
5. **Content Return**: Returns the documentation content to your IDE

## Installation

### Prerequisites

- Node.js (v16 or higher)
- Cursor IDE (or any MCP-compatible IDE)

### Installation

#### Add to Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=npm-package-docs-mcp&config=eyJjb21tYW5kIjoibnB4IG1lYW5hbmRzL25wbS1wYWNrYWdlLWRvY3MtbWNwIn0%3D)

#### Add manually to Cursor

   Edit your Cursor MCP configuration file (usually located at `~/.cursor/mcp.json`):

   ```json
   {
     "mcpServers": {
       "npm-package-docs-mcp": {
         "command": "npx",
         "args": [
           "meanands/npm-package-docs-mcp"
         ]
       }
     }
   }
   ```

5. **Restart Cursor**: Restart Cursor IDE to load the new MCP server

## Usage

Once installed, you can use the tool in Cursor by:

1. Opening the command palette (Cmd/Ctrl + Shift + P)
2. Typing your request, for example:
   - "Get docs for express"
   - "Show me the latest react documentation"
   - "What's new in lodash v4?"

The tool will fetch and display the current documentation for the requested package.

## Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Project Structure

```
npm-docs-mcp/
├── src/
│   ├── server.ts          # Main MCP server implementation
│   └── types/
│       └── index.ts       # TypeScript type definitions
├── package.json
├── tsconfig.json
└── README.md
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.
