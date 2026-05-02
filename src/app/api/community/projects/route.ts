import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientProjects, communityProfiles, user } from "@/db/schema";
import { eq, and, desc, like, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");

    let whereClause;
    if (userId) {
      whereClause = eq(clientProjects.userId, userId);
    } else if (search) {
      const q = `%${search}%`;
      whereClause = and(
        eq(clientProjects.status, "open"),
        or(
          like(clientProjects.title, q),
          like(clientProjects.description, q),
          like(clientProjects.category, q)
        )
      );
    } else {
      whereClause = eq(clientProjects.status, "open");
    }

    const projects = await db
      .select()
      .from(clientProjects)
      .where(whereClause)
      .orderBy(desc(clientProjects.createdAt))
      .all();

    // Attach profile info and user image
    const projectsWithProfiles = await Promise.all(
      projects.map(async (project) => {
        const profile = await db
          .select({ displayName: communityProfiles.displayName, headline: communityProfiles.headline, location: communityProfiles.location })
          .from(communityProfiles)
          .where(eq(communityProfiles.userId, project.userId))
          .get();
        
        const userInfo = await db
          .select({ image: user.image, name: user.name })
          .from(user)
          .where(eq(user.id, project.userId))
          .get();
        
        // Parse skills and extract location if stored there
        let skills: string[] = [];
        let location: string | null = null;
        
        try {
          if (project.skills) {
            const parsed = typeof project.skills === "string" ? JSON.parse(project.skills) : project.skills;
            if (Array.isArray(parsed)) {
              // Location is often stored as second item when AI creates job
              skills = parsed.filter((s: string) => 
                !['tech', 'design', 'writing', 'marketing', 'video', 'trades', 'business', 'legal', 'all'].includes(s.toLowerCase())
              );
              const possibleLocation = parsed.find((s: string) => 
                s && s.length > 2 && !['tech', 'design', 'writing', 'marketing', 'video', 'trades', 'business', 'legal'].includes(s.toLowerCase())
              );
              if (possibleLocation && possibleLocation.length < 50) {
                location = possibleLocation;
              }
            }
          }
        } catch {
          skills = [];
        }
        
        // Also try to extract location from description
        if (!location && project.description) {
          const locMatch = project.description.match(/\*\*Location:\*\*\s*(.+)/);
          if (locMatch) {
            location = locMatch[1].trim();
          }
        }
        
        return {
          ...project,
          skills,
          location: location || profile?.location || null,
          profile,
          authorName: profile?.displayName || userInfo?.name || "Client",
          clientImage: userInfo?.image || null,
        };
      })
    );

    return NextResponse.json({ projects: projectsWithProfiles }, { status: 200 });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    // Build skills array including location if provided
    const skillsArray = body.skills || [];
    if (body.location && !skillsArray.includes(body.location)) {
      skillsArray.push(body.location);
    }
    
    const result = await db
      .insert(clientProjects)
      .values({
        userId: session.user.id,
        title: body.title,
        description: body.description || null,
        category: body.category,
        budget: body.budget,
        deadline: body.deadline || null,
        skills: skillsArray.length > 0 ? JSON.stringify(skillsArray) : null,
        status: "open",
        proposals: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ project: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("id");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    await db
      .update(clientProjects)
      .set({ status: "closed", updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(clientProjects.id, parseInt(projectId)),
          eq(clientProjects.userId, session.user.id)
        )
      );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
