import { POST as uploadPost } from "@/app/api/supplier/uploads/route";

/** POST /api/admin/uploads — same multipart upload handler, for admin forms. */
export const POST = uploadPost;
