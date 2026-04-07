import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { NextRequest } from 'next/server';
import { headers } from "next/headers"
import { db } from "@/db";
 
export const getBaseURL = () => {
	if (process.env.BETTER_AUTH_URL && !process.env.BETTER_AUTH_URL.includes("localhost")) {
		return process.env.BETTER_AUTH_URL;
	}
	if (process.env.VERCEL === "1") {
		return "https://hiremindx.com";
	}
	if (process.env.VERCEL_URL) {
		return "https://hiremindx.com";
	}
	return process.env.BETTER_AUTH_URL || "http://localhost:3000";
};

export const auth = betterAuth({
	baseURL: getBaseURL(),
	trustedOrigins: [
		"http://localhost:3000",
		"http://192.168.1.102:3000",
		"https://hiremindx.com",
		"https://www.hiremindx.com"
	],
	database: drizzleAdapter(db, {
		provider: "sqlite",
	}),
	emailAndPassword: {    
		enabled: true
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID || "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
			scope: [
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
				"https://www.googleapis.com/auth/gmail.send"
			],
			accessType: "offline",
			prompt: "consent",
		},
		microsoft: {
			clientId: process.env.MICROSOFT_CLIENT_ID || "",
			clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
			tenantId: process.env.MICROSOFT_TENANT_ID || "common",
			scope: [
				"openid",
				"profile",
				"email",
				"offline_access",
				"https://graph.microsoft.com/Mail.Send",
			],
			prompt: "consent",
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google", "microsoft"],
		},
	},
	plugins: [bearer()]
});

// Session validation helper
export async function getCurrentUser(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user || null;
}