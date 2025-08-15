#!/usr/bin/env node

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTarballAndGetReadme = extractTarballAndGetReadme;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const tar = __importStar(require("tar"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function extractGitHubRepoPath(githubUrl) {
    try {
        const cleanUrl = githubUrl.replace(/^git\+/, '');
        const url = new URL(cleanUrl);
        if (url.hostname === 'github.com') {
            const path = url.pathname.substring(1);
            return path.replace(/\.git$/, '');
        }
        return null;
    }
    catch (error) {
        console.error('Error parsing GitHub URL:', error);
        return null;
    }
}
async function extractTarballAndGetReadme(tarballUrl, packageName) {
    try {
        const tempDir = path.join(os.tmpdir(), `npm-docs-${packageName}-${Date.now()}`);
        await fs.ensureDir(tempDir);
        const response = await fetch(tarballUrl);
        if (!response.ok) {
            throw new Error(`Failed to download tarball: ${response.statusText}`);
        }
        const tarballBuffer = await response.arrayBuffer();
        const urlParts = tarballUrl.split('/');
        const tarballFilename = urlParts[urlParts.length - 1];
        if (!tarballFilename) {
            throw new Error('Could not extract filename from tarball URL');
        }
        const tarballPath = path.join(tempDir, tarballFilename);
        await fs.writeFile(tarballPath, Buffer.from(tarballBuffer));
        await tar.extract({
            file: tarballPath,
            cwd: tempDir
        });
        const extractedDirs = await fs.readdir(tempDir);
        const packageDir = extractedDirs.find(dir => dir.startsWith('package'));
        if (!packageDir) {
            throw new Error('Could not find package directory in tarball');
        }
        const packagePath = path.join(tempDir, packageDir);
        const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt', 'README'];
        let readmeContent = '';
        for (const readmeFile of readmeFiles) {
            const readmePath = path.join(packagePath, readmeFile);
            if (await fs.pathExists(readmePath)) {
                readmeContent = await fs.readFile(readmePath, 'utf-8');
                break;
            }
        }
        await fs.remove(tempDir);
        return readmeContent || 'No README file found in package';
    }
    catch (error) {
        console.error('Error extracting tarball:', error);
        throw error;
    }
}
const server = new mcp_js_1.McpServer({
    name: 'npm-package-docs-mcp',
    version: '1.0.0'
});
server.registerTool('get_docs_for_npm_package', {
    title: 'Get docs for an npm package',
    description: 'Get the docs for an npm package',
    inputSchema: {
        packageName: zod_1.z.string().describe("Name of the npm package")
    }
}, async ({ packageName }) => {
    try {
        const npmPackage = await fetch(`https://registry.npmjs.org/${packageName}/latest`).then(res => res.json());
        const tarball = npmPackage.dist.tarball;
        const repoUrl = npmPackage.repository?.url;
        let docTxt = '';
        if (repoUrl) {
            const repoPath = extractGitHubRepoPath(repoUrl);
            if (repoPath) {
                console.error("repoPath", repoPath);
                const branches = ['master', 'main', 'develop'];
                for (const branch of branches) {
                    try {
                        const response = await fetch(`https://raw.githubusercontent.com/${repoPath}/refs/heads/${branch}/README.md`);
                        if (response.ok) {
                            docTxt = await response.text();
                            break;
                        }
                    }
                    catch (error) {
                        console.error(`Failed to fetch README from ${branch} branch:`, error);
                        continue;
                    }
                }
            }
        }
        if (!docTxt) {
            try {
                docTxt = await extractTarballAndGetReadme(tarball, packageName);
            }
            catch (error) {
                console.error('Failed to extract tarball:', error);
            }
        }
        if (docTxt) {
            return {
                content: [{
                        type: "text",
                        text: docTxt
                    }]
            };
        }
        else {
            return {
                content: [{
                        type: "text",
                        text: "No documentation found in any common branches or package tarball"
                    }]
            };
        }
    }
    catch (error) {
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
                }],
            isError: true
        };
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('NPM Package Docs MCP Server started');
}
main().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
//# sourceMappingURL=server.js.map