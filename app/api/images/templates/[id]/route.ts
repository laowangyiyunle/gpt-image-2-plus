import { NextRequest, NextResponse } from "next/server";
import { updateImageTemplate } from "@/lib/services/session-service";
import { updateImageTemplateSchema } from "@/lib/validations/chat";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateImageTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "模板参数不合法" }, { status: 400 });
  }

  const image = await updateImageTemplate({
    imageId: id,
    isTemplate: parsed.data.isTemplate,
    templateName: parsed.data.templateName,
    templatePrompt: parsed.data.templatePrompt
  });

  if (!image) {
    return NextResponse.json({ error: "图片不存在或不能设为模板" }, { status: 404 });
  }

  return NextResponse.json({ image });
}
