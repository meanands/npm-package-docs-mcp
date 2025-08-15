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
  version: '1.0.0'
});

// Register the get_transcript tool
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

      const npmPackage = await fetch(`https://registry.npmjs.org/${packageName}/latest`).then( res => res.json() as Promise<NpmRegistryResponse>);
      const tarball = npmPackage.dist.tarball;
      const repoUrl = npmPackage.repository?.url; 
      let docTxt = '';

      if(repoUrl){
        // Extract repository path from GitHub URL
        const repoPath = extractGitHubRepoPath(repoUrl);
        if (repoPath) {
          console.error("repoPath", repoPath);
          
          // Try multiple branch names to find the README
          const branches = ['master', 'main', 'develop'];
          let docTxt = '';
          
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
          
          if (docTxt) {
            return {
              content: [{
                type: "text",
                text: docTxt
              }]
            }
          } else {
            return {
              content:[{
                type: "text",
                text: "No README found in any of the common branches (master, main, develop)"
              }]
            }
          }
        }else{
          return {
            content:[{
              type: "text",
              text: "No doc found"
            }]
          }
        }
      }else{
        // Extract tarball and get README content
        docTxt = await extractTarballAndGetReadme(tarball, packageName);
        
        return {
          content:[{
            type: "text",
            text: docTxt
          }]
        }
      }
      
    } catch (error) {
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NPM Package Docs MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
