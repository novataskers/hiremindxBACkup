import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientProjects, communityProfiles } from "@/db/schema";
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

    // Attach profile info
    const projectsWithProfiles = await Promise.all(
      projects.map(async (project) => {
        const profile = await db
          .select({ displayName: communityProfiles.displayName, headline: communityProfiles.headline })
          .from(communityProfiles)
          .where(eq(communityProfiles.userId, project.userId))
          .get();
        return {
          ...project,
          skills: typeof project.skills === "string" ? JSON.parse(project.skills) : project.skills,
          profile,
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

    const result = await db
      .insert(clientProjects)
      .values({
        userId: session.user.id,
        title: body.title,
        description: body.description || null,
        category: body.category,
        budget: body.budget,
        deadline: body.deadline || null,
        skills: body.skills ? JSON.stringify(body.skills) : null,
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
