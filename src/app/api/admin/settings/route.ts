import { handle, jsonOk, ApiError, parseJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  values: z.record(z.string(), z.string().max(20000)).optional(),
  seo: z
    .object({
      siteTitle: z.string().trim().max(200).optional(),
      siteDescription: z.string().trim().max(500).optional(),
      defaultTitleSuffix: z.string().trim().max(120).optional(),
      canonicalBase: z.string().trim().max(300).optional(),
      googleVerification: z.string().trim().max(300).optional(),
      bingVerification: z.string().trim().max(300).optional(),
      analyticsId: z.string().trim().max(80).optional(),
      tagManagerId: z.string().trim().max(80).optional(),
      ogImage: z.string().trim().max(500).optional(),
      twitterHandle: z.string().trim().max(80).optional(),
      noindex: z.boolean().optional(),
    })
    .optional(),
});

/** PATCH /api/admin/settings — update platform settings and/or SEO settings. */
export async function PATCH(req: Request) {
  return handle(req, async (req) => {
    const user = await requireApiUser(req, { roles: ["ADMIN"] });
    const { values, seo } = await parseJson(req, schema);

    const entries = Object.entries(values ?? {});
    if (entries.length === 0 && !seo) {
      throw new ApiError(400, "No settings provided", "validation");
    }

    if (entries.length) {
      await prisma.$transaction(
        entries.map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            create: { key, value, group: "general", label: key, type: "text" },
            update: { value },
          })
        )
      );
    }

    if (seo) {
      const clean = Object.fromEntries(
        Object.entries(seo).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(clean).length) {
        await prisma.seoSetting.upsert({
          where: { key: "site" },
          create: { key: "site", ...clean },
          update: clean,
        });
      }
    }

    await audit({
      user,
      action: "admin.settings.update",
      entityType: "Setting",
      entityId: null,
      summary: `${user.name} updated ${entries.length} setting(s)${seo ? " and SEO settings" : ""}.`,
      after: { values, seo },
    });

    return jsonOk({ updated: entries.length, seo: Boolean(seo) });
  });
}
