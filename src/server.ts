import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { NpmRegistryResponse } from './types';
import * as tar from 'tar';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Function to extract repository path from GitHub URL
function extractGitHubRepoPath(githubUrl: string): string | null {
  try {
    // Handle git+https:// URLs
    const cleanUrl = githubUrl.replace(/^git\+/, '');
    
    // Parse the URL
    const url = new URL(cleanUrl);
    
    // Check if it's a GitHub URL
    if (url.hostname === 'github.com') {
      // Extract the pathname and remove leading slash
      const path = url.pathname.substring(1);
      
      // Remove .git extension if present
      return path.replace(/\.git$/, '');
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing GitHub URL:', error);
    return null;
  }
}

// Function to extract tarball and get README content
export async function extractTarballAndGetReadme(tarballUrl: string, packageName: string): Promise<string> {
  try {
    // Create a temporary directory for extraction
    const tempDir = path.join(os.tmpdir(), `npm-docs-${packageName}-${Date.now()}`);
    await fs.ensureDir(tempDir);
    
    // Download the tarball
    const response = await fetch(tarballUrl);
    if (!response.ok) {
      throw new Error(`Failed to download tarball: ${response.statusText}`);
    }
    
    const tarballBuffer = await response.arrayBuffer();
    
    // Extract filename from tarball URL
    const urlParts = tarballUrl.split('/');
    const tarballFilename = urlParts[urlParts.length - 1];
    if (!tarballFilename) {
      throw new Error('Could not extract filename from tarball URL');
    }
    const tarballPath = path.join(tempDir, tarballFilename);

    // Write tarball to file
    await fs.writeFile(tarballPath, Buffer.from(tarballBuffer));
    
    // Extract the tarball
    await tar.extract({
      file: tarballPath,
      cwd: tempDir
    });
    
    // Find the package directory (usually named package-version)
    const extractedDirs = await fs.readdir(tempDir);
    const packageDir = extractedDirs.find(dir => dir.startsWith('package'));
    
    if (!packageDir) {
      throw new Error('Could not find package directory in tarball');
    }
    
    const packagePath = path.join(tempDir, packageDir);
    
    // Look for README files (case insensitive)
    const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt', 'README'];
    let readmeContent = '';
    
    for (const readmeFile of readmeFiles) {
      const readmePath = path.join(packagePath, readmeFile);
      if (await fs.pathExists(readmePath)) {
        readmeContent = await fs.readFile(readmePath, 'utf-8');
        break;
      }
    }
    
    // Clean up temporary files
    await fs.remove(tempDir);
    
    return readmeContent || 'No README file found in package';
    
  } catch (error) {
    console.error('Error extracting tarball:', error);
    throw error;
  }
}

// Create an MCP server
const server = new McpServer({
  name: 'npm-package-docs-mcp',
  version: '1.0.1'
});

// Register the tool
server.registerTool(
  'get_docs_for_npm_package',
  {
    title: 'Get docs for an npm package',
    description: 'Get the docs for an npm package',
    inputSchema: {
      packageName: z.string().describe("Name of the npm package")
    }
  },
  async ({ packageName }) => {
    try {
      console.error(`Processing request for package: ${packageName}`);

      const npmPackage = await fetch(`https://registry.npmjs.org/${packageName}/latest`).then( res => res.json() as Promise<NpmRegistryResponse>);
      const tarball = npmPackage.dist.tarball;
      const repoUrl = npmPackage.repository?.url; 
      let docTxt = '';

      // First, try to get docs from GitHub repository if available
      if (repoUrl) {
        const repoPath = extractGitHubRepoPath(repoUrl);
        if (repoPath) {
          console.error("repoPath", repoPath);
          
          // Try multiple branch names to find the README
          const branches = ['master', 'main', 'develop'];
          
          for (const branch of branches) {
            try {
              const response = await fetch(`https://raw.githubusercontent.com/${repoPath}/refs/heads/${branch}/README.md`);
              if (response.ok) {
                docTxt = await response.text();
                break;
              }
            } catch (error) {
              console.error(`Failed to fetch README from ${branch} branch:`, error);
              continue;
            }
          }
        }
      }
      
      // If no docs found from GitHub, try tarball fallback
      if (!docTxt) {
        try {
          docTxt = await extractTarballAndGetReadme(tarball, packageName);
        } catch (error) {
          console.error('Failed to extract tarball:', error);
        }
      }
      
      // Return the result
      if (docTxt) {
        return {
          content: [{
            type: "text",
            text: docTxt
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: "No documentation found in any common branches or package tarball"
          }]
        };
      }
      
    } catch (error) {
      console.error('Error in tool execution:', error);
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }
);

// Start the server
async function main() {
  try {
    console.error('Starting NPM Package Docs MCP Server...');
    
    const transport = new StdioServerTransport();
    
    // Connect to the transport
    await server.connect(transport);
    
    console.error('NPM Package Docs MCP Server started successfully');
    
    // Keep the process alive
    process.on('SIGINT', () => {
      console.error('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only run main if this file is being executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
