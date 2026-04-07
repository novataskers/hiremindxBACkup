/**
 * Canvas Deploy API
 * Deploys canvas projects to Vercel or prepares files for download
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { code, projectName, action } = await request.json();
    
    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const name = projectName || `hiremindx-canvas-${Date.now().toString(36)}`;

    // Generate project files
    const vercelConfig = {
      version: 2,
      builds: [{ src: "index.html", use: "@vercel/static" }],
      routes: [{ src: "/(.*)", dest: "/index.html" }],
    };

    const packageJson = {
      name,
      version: "1.0.0",
      description: "Created with HireMindX Assist Canvas",
      scripts: { start: "npx serve ." },
    };

    const files = {
      "index.html": code,
      "vercel.json": JSON.stringify(vercelConfig, null, 2),
      "package.json": JSON.stringify(packageJson, null, 2),
    };

    if (action === 'deploy') {
      // Try direct Vercel deploy using their API
      // Uses the Vercel Deployments API: POST /v13/deployments
      const vercelToken = process.env.VERCEL_TOKEN;
      
      if (vercelToken) {
        try {
          const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${vercelToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name,
              files: [
                { file: 'index.html', data: code },
                { file: 'vercel.json', data: JSON.stringify(vercelConfig, null, 2) },
              ],
              projectSettings: {
                framework: null,
              },
            }),
          });

          if (deployRes.ok) {
            const deployData = await deployRes.json();
            const deployUrl = `https://${deployData.url}`;
            return NextResponse.json({
              success: true,
              deployUrl,
              projectName: name,
              files,
            });
          }
        } catch (e) {
          console.error('Vercel API deploy failed:', e);
        }
      }

      // Fallback: return files for manual deploy
      return NextResponse.json({
        success: true,
        projectName: name,
        files,
        deployCommand: `npx vercel --yes`,
        message: 'Add VERCEL_TOKEN to your .env for direct deploy. Code copied to clipboard — paste into a new Vercel project.',
      });
    }

    // Default: return files for download
    return NextResponse.json({
      success: true,
      projectName: name,
      files,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Deploy preparation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
