import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { communityProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
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

    const profile = await db
      .select()
      .from(communityProfiles)
      .where(eq(communityProfiles.userId, session.user.id))
      .get();

    if (!profile) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("Error fetching community profile:", error);
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

    const existingProfile = await db
      .select()
      .from(communityProfiles)
      .where(eq(communityProfiles.userId, session.user.id))
      .get();

    if (existingProfile) {
      const updated = await db
        .update(communityProfiles)
        .set({
          ...body,
            userId: session.user.id,
            updatedAt: now,
            skills: body.skills ? JSON.stringify(body.skills) : null,
            workExperience: body.workExperience ? JSON.stringify(body.workExperience) : null,
            portfolioUrls: body.portfolioUrls ? JSON.stringify(body.portfolioUrls) : null,
            paymentMethods: body.paymentMethods ? JSON.stringify(body.paymentMethods) : null,
            pricingText: body.pricingText || null,
        })
        .where(eq(communityProfiles.userId, session.user.id))
        .returning();

      return NextResponse.json({ profile: updated[0] }, { status: 200 });
    }

    const newProfile = await db
      .insert(communityProfiles)
      .values({
        userId: session.user.id,
        userType: body.userType,
        displayName: body.displayName,
        bio: body.bio || null,
        headline: body.headline || null,
        location: body.location || null,
        website: body.website || null,
        skills: body.skills ? JSON.stringify(body.skills) : null,
        hourlyRate: body.hourlyRate || null,
          pricingText: body.pricingText || null,
          availability: body.availability || null,
        workExperience: body.workExperience ? JSON.stringify(body.workExperience) : null,
        cvUrl: body.cvUrl || null,
        portfolioUrls: body.portfolioUrls ? JSON.stringify(body.portfolioUrls) : null,
        companyName: body.companyName || null,
        companyDescription: body.companyDescription || null,
        companySize: body.companySize || null,
        industry: body.industry || null,
        paymentMethods: body.paymentMethods ? JSON.stringify(body.paymentMethods) : null,
        profileComplete: body.profileComplete || false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ profile: newProfile[0] }, { status: 201 });
  } catch (error) {
    console.error("Error saving community profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
